import { CalendarEvent, CalendarEventProps, EventType, EventTypes } from '../../../domain/calendar/entities/CalendarEvent';
// import { SubEvent } from '../../../domain/calendar/entities/SubEvent'; // Unused import
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { getLogger } from '../../../utils/logger';
import { trackOperation } from '../../../utils/errorHandler';

const logger = getLogger('update-event-use-case');


export class UpdateEventUseCase {
  private eventRepository: CalendarEventRepository;
  private subEventRepository: SubEventRepository;
  private subEventFactory: SubEventFactory;

  constructor(
    eventRepository: CalendarEventRepository,
    subEventRepository: SubEventRepository,
    subEventFactory: SubEventFactory
  ) {
    this.eventRepository = eventRepository;
    this.subEventRepository = subEventRepository;
    this.subEventFactory = subEventFactory;
  }

  async execute(eventProps: CalendarEventProps): Promise<CalendarEventProps> {
    return trackOperation(
      `UpdateEvent(${eventProps.id})`,
      async () => {
        logger.info(`Updating event with ID: ${eventProps.id}`);
        
        const originalEvent = await this.eventRepository.getById(eventProps.id);
        if (!originalEvent) {
          logger.error(`Event with ID ${eventProps.id} not found for update.`);
          // Consider using a more specific error type if available/appropriate
          throw new Error(`Event with ID ${eventProps.id} not found.`);
        }

        const originalEventIsHoliday = originalEvent.type === EventTypes.HOLIDAY;
        const originalEventStart = new Date(originalEvent.start);
        const originalEventEnd = new Date(originalEvent.end);

        // This is the event instance with incoming changes
        const updatedEvent = new CalendarEvent(eventProps);

        // 1. Update the main event document in Firestore.
        // This is crucial so that subsequent calls to getHolidayEvents() reflect this change accurately.
        await this.eventRepository.update(updatedEvent);
        logger.debug(`Successfully updated main event document ${updatedEvent.id} in Firestore.`);

        // 2. Regenerate and save sub-events for the event being updated.
        // Fetch all holidays *after* the main event has been updated to ensure consistency.
        const allHolidaysForOwnSubEvents = await this.eventRepository.getHolidayEvents();
        logger.debug(`Fetched ${allHolidaysForOwnSubEvents.length} holiday events for regenerating sub-events of ${updatedEvent.id}`);
        
        await this.subEventRepository.deleteByParentId(updatedEvent.id);
        logger.debug(`Deleted existing sub-events for ${updatedEvent.id}`);

        const subEventsForUpdatedEvent = this.subEventFactory.generateSubEvents(updatedEvent, allHolidaysForOwnSubEvents);
        if (subEventsForUpdatedEvent.length > 0) {
          await this.subEventRepository.save(subEventsForUpdatedEvent);
          logger.debug(`Created and saved ${subEventsForUpdatedEvent.length} new sub-events for event ${updatedEvent.id}`);
        } else {
          logger.debug(`No sub-events generated for event ${updatedEvent.id}`);
        }
        
        // 3. Determine if a ripple effect is needed due to changes in holiday status or dates.
        const updatedEventIsHoliday = updatedEvent.type === EventTypes.HOLIDAY;
        // Ensure start/end are treated as Dates for comparison
        const updatedEventStart = new Date(updatedEvent.start);
        const updatedEventEnd = new Date(updatedEvent.end);

        let rippleNeeded = false;
        if (originalEventIsHoliday !== updatedEventIsHoliday) {
          rippleNeeded = true;
          logger.info(`Ripple effect needed: Event ${updatedEvent.id} changed holiday status. Was holiday: ${originalEventIsHoliday}, Is holiday: ${updatedEventIsHoliday}.`);
        } else if (updatedEventIsHoliday && 
                   (originalEventStart.getTime() !== updatedEventStart.getTime() || 
                    originalEventEnd.getTime() !== updatedEventEnd.getTime())) {
          rippleNeeded = true;
          logger.info(`Ripple effect needed: Holiday event ${updatedEvent.id} dates changed. Original: ${originalEventStart.toISOString()}-${originalEventEnd.toISOString()}, New: ${updatedEventStart.toISOString()}-${updatedEventEnd.toISOString()}.`);
        }

        if (rippleNeeded) {
          logger.info(`Holiday change detected for event ${updatedEvent.id}. Triggering ripple effect.`);
          // The list of all holidays fetched earlier (allHolidaysForOwnSubEvents) is up-to-date.
          const currentAllHolidaysAfterUpdate = allHolidaysForOwnSubEvents; 
            
          const oldHolidayProperties = originalEventIsHoliday 
            ? { start: originalEventStart, end: originalEventEnd, type: originalEvent.type as EventType } // Cast type here
            : null;
            
          await this.triggerHolidayUpdateRippleEffect(oldHolidayProperties, updatedEvent, currentAllHolidaysAfterUpdate);
        }
        
        return updatedEvent.toJSON();
      },
      {
        eventType: eventProps.type,
        eventStartDate: new Date(eventProps.start).toISOString(),
        eventEndDate: new Date(eventProps.end).toISOString()
      }
    );
  }

  // Added private method for holiday update ripple effect
  private async triggerHolidayUpdateRippleEffect(
    originalHolidayState: { start: Date, end: Date, type: EventType } | null, // Use EventType
    currentEventState: CalendarEvent, // This is the holiday that changed or was created/deleted
    currentAllHolidays: CalendarEvent[]
  ): Promise<void> {
    const affectedRanges: { start: Date, end: Date }[] = [];

    // If the event is now a holiday, its new range is affected
    if (currentEventState.type === EventTypes.HOLIDAY) {
      affectedRanges.push({ start: new Date(currentEventState.start), end: new Date(currentEventState.end) });
    }
    // If the event *was* a holiday (and its type might have changed or dates shifted), its old range was affected
    if (originalHolidayState) { 
      affectedRanges.push({ start: new Date(originalHolidayState.start), end: new Date(originalHolidayState.end) });
    }

    if (affectedRanges.length === 0) {
      logger.info(`HolidayUpdateRipple: No relevant date ranges to process for event ${currentEventState.id}. This might happen if an event changed from non-holiday to non-holiday.`);
      return;
    }
    
    // Merge overlapping/adjacent date ranges to reduce queries
    const mergedRanges = this.mergeDateRanges(affectedRanges);
    let allPotentiallyAffectedParentEvents: CalendarEvent[] = [];
    const processedEventIds = new Set<string>(); // To avoid processing the same parent event multiple times

    for (const range of mergedRanges) {
      logger.info(`HolidayUpdateRipple: Querying events overlapping range ${range.start.toISOString()} - ${range.end.toISOString()} for ripple effect.`);
      const eventsInThisRange = await this.eventRepository.getEventsOverlappingDateRange(
        range.start,
        range.end,
        [EventTypes.ONCALL, EventTypes.INCIDENT] // Use constants instead of hardcoded strings
      );
      eventsInThisRange.forEach(event => {
        if (!processedEventIds.has(event.id)) {
          allPotentiallyAffectedParentEvents.push(event);
          processedEventIds.add(event.id);
        }
      });
    }
    
    logger.info(`HolidayUpdateRipple: Found ${allPotentiallyAffectedParentEvents.length} unique potentially affected parent events for event ${currentEventState.id}.`);
    if (allPotentiallyAffectedParentEvents.length === 0) return;

    for (const parentEvent of allPotentiallyAffectedParentEvents) {
      // Don't reprocess the updated/triggering holiday event itself if it was fetched as an overlapping event.
      if (parentEvent.id === currentEventState.id) {
        logger.debug(`HolidayUpdateRipple: Skipping self-reprocessing for event ${parentEvent.id}.`);
        continue; 
      }

      logger.info(`HolidayUpdateRipple: Re-processing sub-events for parent event: ${parentEvent.id} (${parentEvent.title || 'No Title'}) due to changes in/related to event ${currentEventState.id}.`);
      try {
        await this.subEventRepository.deleteByParentId(parentEvent.id);
        // currentAllHolidays is the critical list of all holidays *after* the update that triggered this ripple
        const newSubEvents = this.subEventFactory.generateSubEvents(parentEvent, currentAllHolidays);
        if (newSubEvents.length > 0) {
          await this.subEventRepository.save(newSubEvents);
          logger.info(`HolidayUpdateRipple: Saved ${newSubEvents.length} new sub-events for parent event ${parentEvent.id}.`);
        } else {
          logger.info(`HolidayUpdateRipple: No sub-events generated for parent event ${parentEvent.id}.`);
        }
      } catch (error) {
        // Log detailed error, including which parent event failed and the trigger event.
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`HolidayUpdateRipple: Failed to re-process sub-events for parent ${parentEvent.id} (triggered by ${currentEventState.id}). Error: ${errorMessage}`, { originalError: error });
        // Decide on error handling: continue with other events or propagate/throw? For now, it continues.
      }
    }
    logger.info(`HolidayUpdateRipple: Finished processing affected events related to event ${currentEventState.id}.`);
  }

  /**
   * Merges an array of date ranges into the minimum number of contiguous ranges.
   * @param ranges An array of objects with start and end Date properties.
   * @returns A new array of merged date ranges.
   */
  private mergeDateRanges(ranges: { start: Date, end: Date }[]): { start: Date, end: Date }[] {
    if (ranges.length <= 1) {
      return ranges;
    }

    // Sort ranges by start date
    const sortedRanges = ranges.sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: { start: Date, end: Date }[] = [];
    let currentMerge = sortedRanges[0];

    for (let i = 1; i < sortedRanges.length; i++) {
      const nextRange = sortedRanges[i];
      // Check for overlap: next range starts before or at the same time the current merge ends
      if (nextRange.start.getTime() <= currentMerge.end.getTime()) {
        // We have an overlap, so extend the end of the current merge if the next range ends later
        if (nextRange.end.getTime() > currentMerge.end.getTime()) {
          currentMerge.end = nextRange.end;
        }
      } else {
        // No overlap, push the completed merge and start a new one
        merged.push(currentMerge);
        currentMerge = nextRange;
      }
    }
    // Add the last merged range
    merged.push(currentMerge);

    return merged;
  }
} 
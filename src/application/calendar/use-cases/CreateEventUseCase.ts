import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { createUseCaseLogger } from '../../../utils/initializeLogger';
import { 
  trackOperation, 
  ApplicationError, 
  BaseError, 
  DatabaseError,
  withErrorHandling
} from '../../../utils/errorHandler';

// Use standardized use case logger
const logger = createUseCaseLogger('createEvent');

export class CreateEventUseCase {
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

  /**
   * Execute the create event use case
   * @param eventData Data for the event to create
   * @returns The created calendar event
   */
  async execute(eventData: CalendarEventProps): Promise<CalendarEvent> {
    // return trackOperation(
    //   'CreateEvent',
    //   async () => {
        logger.info('Creating new calendar event', { 
          eventTitle: eventData.title,
          eventType: eventData.type
        });

        try {
          const eventId = eventData.id || crypto.randomUUID();

          const event = new CalendarEvent({
            ...eventData,
            id: eventId,
          });
          logger.info(`Created event with ID ${event.id}`);

          // Get all holidays *before* saving the new event, if the new event is a holiday itself,
          // it won't be in this list yet, which is fine for its own sub-event generation.
          // For the ripple effect, we'll get the list *after* this new holiday is saved.
          const holidaysForOwnSubEvents = await this.eventRepository.getHolidayEvents();

          const subEvents = this.subEventFactory.generateSubEvents(event, holidaysForOwnSubEvents);
          
          logger.info(`Generated ${subEvents.length} sub-events for event ${event.id}`);

          await this.eventRepository.save([event]);

          if (subEvents.length > 0) {
             await this.subEventRepository.save(subEvents);
          }

          logger.info('Successfully created event and sub-events', { 
            eventId: event.id, 
            subEventCount: subEvents.length 
          });

          // Holiday Ripple Effect
          if (event.type === 'holiday') {
            logger.info(`Holiday ${event.id} created. Triggering ripple effect for affected events.`);
            // Get all holidays *after* this new one is saved to ensure it's included
            const currentAllHolidays = await this.eventRepository.getHolidayEvents(); 
            await this.triggerHolidayRippleEffect(event, currentAllHolidays);
          }

          return event;
        } catch (error) {
          logger.error('Failed to create event', error);
          
          if (!(error instanceof BaseError)) {
            throw new ApplicationError(
              'Failed to create event',
              'CREATE_EVENT_ERROR',
              500,
              error instanceof Error ? error : new Error(String(error)),
              { 
                eventTitle: eventData.title,
                eventType: eventData.type,
                eventStart: eventData.start instanceof Date ? eventData.start.toISOString() : String(eventData.start),
                eventEnd: eventData.end instanceof Date ? eventData.end.toISOString() : String(eventData.end)
              }
            );
          }
          
          throw error;
        }
    //   },
    //   {
    //     eventType: eventData.type,
    //     eventTitle: eventData.title
    //   }
    // );
  }

  // Added private method for ripple effect
  private async triggerHolidayRippleEffect(changedHoliday: CalendarEvent, currentAllHolidays: CalendarEvent[]): Promise<void> {
    const holidayDateRange = { start: new Date(changedHoliday.start), end: new Date(changedHoliday.end) };
    logger.info(`HolidayRipple: Processing events affected by holiday change in range ${holidayDateRange.start.toISOString()} - ${holidayDateRange.end.toISOString()}`);

    const potentiallyAffectedParentEvents = await this.eventRepository.getEventsOverlappingDateRange(
      holidayDateRange.start,
      holidayDateRange.end,
      ['oncall', 'incident'] // Only affect these types
    );

    logger.info(`HolidayRipple: Found ${potentiallyAffectedParentEvents.length} potentially affected parent events.`);
    if (potentiallyAffectedParentEvents.length === 0) return;

    for (const parentEvent of potentiallyAffectedParentEvents) {
      // Don't reprocess the holiday event itself if it somehow got included, though 'types' filter should prevent this.
      if (parentEvent.id === changedHoliday.id) continue; 

      logger.info(`HolidayRipple: Re-processing sub-events for parent event: ${parentEvent.id} (${parentEvent.title || 'No Title'})`);
      try {
        await this.subEventRepository.deleteByParentId(parentEvent.id);
        const newSubEvents = this.subEventFactory.generateSubEvents(parentEvent, currentAllHolidays);
        if (newSubEvents.length > 0) {
          await this.subEventRepository.save(newSubEvents);
          logger.info(`HolidayRipple: Saved ${newSubEvents.length} new sub-events for parent event ${parentEvent.id}.`);
        } else {
          logger.info(`HolidayRipple: No sub-events generated for parent event ${parentEvent.id}.`);
        }
      } catch (error) {
        logger.error(`HolidayRipple: Failed to re-process sub-events for parent ${parentEvent.id}. Error: ${error instanceof Error ? error.message : String(error)}`);
        // Optionally, decide if one failure should stop the whole ripple or continue with others.
        // For now, it continues.
      }
    }
    logger.info(`HolidayRipple: Finished processing affected events for holiday ${changedHoliday.id}.`);
  }
} 
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { CalendarEvent, EventType } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { createUseCaseLogger } from '../../../utils/initializeLogger';

const logger = createUseCaseLogger('deleteEvent');

export class DeleteEventUseCase {
  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository,
    private subEventFactory: SubEventFactory
  ) {}
 
  async execute(eventId: string): Promise<void> {
    logger.info(`Attempting to delete event with ID: ${eventId}`);

    const eventToDelete = await this.eventRepository.getById(eventId);
    
    if (!eventToDelete) {
      logger.warn(`Event ${eventId} not found for deletion. Nothing to do.`);
      return;
    }

    logger.info(`Event ${eventId} found (type: ${eventToDelete.type}). Proceeding with deletion process.`);

    if (eventToDelete.type === 'holiday') {
      logger.info(`Holiday ${eventToDelete.id} is being deleted. Triggering ripple effect for affected events.`);
      const allOtherHolidays = (await this.eventRepository.getHolidayEvents()).filter(h => h.id !== eventId);
      await this.triggerHolidayRippleEffect(eventToDelete, allOtherHolidays);
    }

    await this.subEventRepository.deleteByParentId(eventId);
    logger.info(`Deleted sub-events for event ${eventId}.`);
    
    await this.eventRepository.delete(eventId);
    logger.info(`Successfully deleted event ${eventId}.`);
  }

  private async triggerHolidayRippleEffect(deletedHoliday: CalendarEvent, currentAllHolidaysAfterDeletion: CalendarEvent[]): Promise<void> {
    const holidayDateRange = { start: new Date(deletedHoliday.start), end: new Date(deletedHoliday.end) };
    logger.info(`HolidayRipple (Delete): Processing events affected by deletion of holiday ${deletedHoliday.id} in range ${holidayDateRange.start.toISOString()} - ${holidayDateRange.end.toISOString()}`);

    const potentiallyAffectedParentEvents = await this.eventRepository.getEventsOverlappingDateRange(
      holidayDateRange.start,
      holidayDateRange.end,
      ['oncall', 'incident']
    );

    logger.info(`HolidayRipple (Delete): Found ${potentiallyAffectedParentEvents.length} potentially affected parent events.`);
    if (potentiallyAffectedParentEvents.length === 0) return;

    for (const parentEvent of potentiallyAffectedParentEvents) {
      logger.info(`HolidayRipple (Delete): Re-processing sub-events for parent event: ${parentEvent.id} (${parentEvent.title || 'No Title'})`);
      try {
        await this.subEventRepository.deleteByParentId(parentEvent.id);
        const newSubEvents = this.subEventFactory.generateSubEvents(parentEvent, currentAllHolidaysAfterDeletion);
        if (newSubEvents.length > 0) {
          await this.subEventRepository.save(newSubEvents);
          logger.info(`HolidayRipple (Delete): Saved ${newSubEvents.length} new sub-events for parent event ${parentEvent.id}.`);
        } else {
          logger.info(`HolidayRipple (Delete): No sub-events generated for parent event ${parentEvent.id}.`);
        }
      } catch (error) {
        logger.error(`HolidayRipple (Delete): Failed to re-process sub-events for parent ${parentEvent.id}. Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    logger.info(`HolidayRipple (Delete): Finished processing affected events due to deletion of holiday ${deletedHoliday.id}.`);
  }
} 
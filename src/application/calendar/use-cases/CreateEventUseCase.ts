import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { EventSubDivider } from '../../../domain/calendar/services/EventSubDivider';
import { HolidayCheckerService } from '../../../domain/calendar/services/HolidayCheckerService';
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
  private eventSubDivider: EventSubDivider;
  private holidayChecker: HolidayCheckerService;

  constructor(
    eventRepository: CalendarEventRepository,
    subEventRepository: SubEventRepository,
    eventSubDivider: EventSubDivider,
    holidayChecker: HolidayCheckerService
  ) {
    this.eventRepository = eventRepository;
    this.subEventRepository = subEventRepository;
    this.eventSubDivider = eventSubDivider;
    this.holidayChecker = holidayChecker;
  }

  /**
   * Execute the create event use case
   * @param eventData Data for the event to create
   * @returns The created calendar event
   */
  async execute(eventData: CalendarEventProps): Promise<CalendarEvent> {
    return trackOperation(
      'CreateEvent',
      async () => {
        logger.info('Creating new calendar event', { 
          eventTitle: eventData.title,
          eventType: eventData.type
        });

        try {
          // 1. Create the main calendar event
          const event = new CalendarEvent(eventData);
          logger.info(`Created event with ID ${event.id}`);

          // 2. Generate sub-events
          const subEvents = await withErrorHandling(
            async () => this.eventSubDivider.divideEvent(event),
            'Failed to divide event into sub-events',
            { eventId: event.id }
          );
          
          logger.info(`Generated ${subEvents.length} sub-events for event ${event.id}`);

          // 3. Check for holidays and mark sub-events
          if (this.holidayChecker) {
            await withErrorHandling(
              async () => this.markHolidays(subEvents),
              'Failed to check holidays for sub-events',
              { eventId: event.id, subEventCount: subEvents.length }
            );
          }

          // 4. Save the main event
          await this.eventRepository.save([event]);

          // 5. Save the sub-events
          await this.subEventRepository.save(subEvents);

          logger.info('Successfully created event and sub-events', { 
            eventId: event.id, 
            subEventCount: subEvents.length 
          });

          return event;
        } catch (error) {
          logger.error('Failed to create event', error);
          
          // Convert to application error with appropriate context if not already typed
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
          
          // Re-throw original error
          throw error;
        }
      },
      {
        eventType: eventData.type,
        eventTitle: eventData.title
      }
    );
  }

  /**
   * Mark sub-events that fall on holidays
   * @param subEvents List of sub-events to check
   */
  private async markHolidays(subEvents: SubEvent[]): Promise<void> {
    logger.info(`Checking ${subEvents.length} sub-events for holidays`);
    
    try {
      for (const subEvent of subEvents) {
        const isHoliday = await this.holidayChecker.isHoliday(subEvent.start);
        if (isHoliday) {
          subEvent.markAsHoliday();
          logger.info(`Marked sub-event ${subEvent.id} as holiday`);
        }
      }
      logger.info('Holiday check completed for all sub-events');
    } catch (error) {
      logger.error('Error while checking for holidays', error);
      throw new ApplicationError(
        'Failed to check holidays for sub-events',
        'HOLIDAY_CHECK_ERROR',
        500,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
} 
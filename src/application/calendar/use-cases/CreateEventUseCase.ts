import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
// HolidayChecker is used statically by SubEventFactory, no need to inject into use case if SEF handles it
// import { HolidayChecker } from '../../../domain/calendar/services/HolidayChecker'; 
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
  // private holidayChecker: HolidayChecker; // Removed

  constructor(
    eventRepository: CalendarEventRepository,
    subEventRepository: SubEventRepository,
    subEventFactory: SubEventFactory
    // holidayChecker: HolidayChecker // Removed
  ) {
    this.eventRepository = eventRepository;
    this.subEventRepository = subEventRepository;
    this.subEventFactory = subEventFactory;
    // this.holidayChecker = holidayChecker; // Removed
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

          // Get all existing events for holiday checking during sub-event generation
          const allExistingEventsProps = await this.eventRepository.getAll();
          const allExistingDomainEvents = allExistingEventsProps.map(props => new CalendarEvent(props));

          // Generate sub-events using SubEventFactory
          const subEvents = this.subEventFactory.generateSubEvents(event, allExistingDomainEvents);
          
          logger.info(`Generated ${subEvents.length} sub-events for event ${event.id}`);

          // Assuming SubEventFactory now correctly handles marking holidays on sub-events internally
          // No explicit holiday marking step here in the use case.

          // 4. Save the main event
          await this.eventRepository.save([event]);

          // 5. Save the sub-events
          if (subEvents.length > 0) {
             await this.subEventRepository.save(subEvents);
          }

          logger.info('Successfully created event and sub-events', { 
            eventId: event.id, 
            subEventCount: subEvents.length 
          });

          return event;
        } catch (error) {
          logger.error('Failed to create event', error); // This is the key log we want to see
          
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

  // The markHolidays method can be removed if SubEventFactory handles it, or kept if it performs additional checks.
  // For now, let's keep the explicit holiday marking step commented out as before, 
  // as SubEventFactory might already do it.
  /*
  private async markHolidays(subEvents: SubEvent[], allCalendarEvents: CalendarEvent[]): Promise<void> {
    logger.info(`Checking ${subEvents.length} sub-events for holidays (SKIPPING ACTUAL CHECK FOR DEBUGGING)`);
  }
  */
} 
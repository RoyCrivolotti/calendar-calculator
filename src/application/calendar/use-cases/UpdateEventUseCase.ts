import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
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

  async execute(eventProps: CalendarEventProps): Promise<void> {
    return trackOperation(
      `UpdateEvent(${eventProps.id})`,
      async () => {
        logger.info(`Updating event with ID: ${eventProps.id}`);
        
        const event = new CalendarEvent(eventProps);

        // First, delete all existing sub-events for this event
        await this.subEventRepository.deleteByParentId(event.id);
        
        // Generate new sub-events based on current settings and holidays
        const holidayEvents = await this.eventRepository.getHolidayEvents();
        logger.debug(`Found ${holidayEvents.length} holiday events for update`);
        const subEvents = this.subEventFactory.generateSubEvents(event, holidayEvents);
        
        // Save the sub-events
        if (subEvents.length > 0) {
          await this.subEventRepository.save(subEvents);
          logger.debug(`Created ${subEvents.length} sub-events for event ${event.id}`);
        }
        
        // Update the main event
        await this.eventRepository.update(event);
      },
      {
        eventType: eventProps.type,
        eventStartDate: new Date(eventProps.start).toISOString(),
        eventEndDate: new Date(eventProps.end).toISOString()
      }
    );
  }
} 
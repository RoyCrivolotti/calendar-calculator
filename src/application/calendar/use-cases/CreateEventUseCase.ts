import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { EventSubDivider } from '../../../domain/calendar/services/EventSubDivider';
import { HolidayCheckerService } from '../../../domain/calendar/services/HolidayCheckerService';
import { getLogger } from '../../../utils/logger';
import { trackOperation } from '../../../utils/errorHandler';

const logger = getLogger('create-event-use-case');

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

  async execute(eventProps: CalendarEventProps): Promise<void> {
    return trackOperation(
      `CreateEvent(${eventProps.id})`,
      async () => {
        logger.info(`Creating new event with ID: ${eventProps.id}, Type: ${eventProps.type}`);
        
        const event = new CalendarEvent(eventProps);
        
        // First save the event
        await this.eventRepository.save([event]);
        
        // Then generate sub-events based on the event type and time slots
        const subEvents = await this.generateSubEvents(event);
        
        // Save the sub-events
        if (subEvents.length > 0) {
          logger.debug(`Saving ${subEvents.length} sub-events for event ${event.id}`);
          await this.subEventRepository.save(subEvents);
        }
        
        return { eventId: event.id, subEventsCount: subEvents.length };
      },
      {
        eventType: eventProps.type,
        eventStartDate: new Date(eventProps.start).toISOString(),
        eventEndDate: new Date(eventProps.end).toISOString()
      }
    );
  }

  /**
   * Generate sub-events for a given event
   * This handles the logic of creating hourly/daily chunks
   * and marking them as holidays if applicable
   */
  private async generateSubEvents(event: CalendarEvent): Promise<SubEvent[]> {
    logger.debug(`Generating sub-events for event: ${event.id}`);
    
    // Step 1: Generate basic time slices
    const timeSlices = this.eventSubDivider.divideEvent(event);
    logger.debug(`Generated ${timeSlices.length} time slices`);
    
    // Step 2: Load all holiday events
    const allEvents = await this.eventRepository.getAll();
    const holidayEvents = allEvents.filter(e => e.type === 'holiday');
    logger.debug(`Found ${holidayEvents.length} holiday events`);
    
    // Step 3: Initialize the holiday checker with current holidays
    this.holidayChecker.setHolidays(holidayEvents);
    
    // Step 4: Process each time slice
    const subEvents: SubEvent[] = [];
    
    for (const slice of timeSlices) {
      const isWeekend = this.holidayChecker.isWeekend(slice.start);
      const isHoliday = this.holidayChecker.isHoliday(slice.start);
      
      subEvents.push(new SubEvent({
        id: crypto.randomUUID(),
        parentEventId: event.id,
        start: slice.start,
        end: slice.end,
        isWeekday: !isWeekend,
        isWeekend,
        isHoliday,
        isNightShift: false, // This will be set by the EventSubDivider
        isOfficeHours: false, // This will be calculated based on the time
        type: event.type
      }));
    }
    
    logger.debug(`Created ${subEvents.length} sub-events, including ${subEvents.filter(se => se.isHoliday).length} on holidays`);
    
    return subEvents;
  }
} 
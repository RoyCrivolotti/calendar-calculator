import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { EventType } from '../../../domain/calendar/entities/CalendarEvent';

export interface UpdateEventProps {
  id: string;
  start: Date;
  end: Date;
  type: EventType;
}

export class UpdateEventUseCase {
  private subEventFactory: SubEventFactory;

  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {
    this.subEventFactory = new SubEventFactory();
  }

  async execute(props: UpdateEventProps): Promise<CalendarEvent> {
    // Update the main event
    const event = CalendarEvent.create({
      id: props.id,
      start: props.start,
      end: props.end,
      type: props.type
    });

    await this.eventRepository.update(event);

    await this.subEventRepository.deleteByParentId(event.id);
    
    const holidayEvents = await this.eventRepository.getHolidayEvents();
    const subEvents = this.subEventFactory.generateSubEvents(event, holidayEvents);
    if (subEvents.length > 0) {
      await this.subEventRepository.save(subEvents);
    }

    return event;
  }
} 
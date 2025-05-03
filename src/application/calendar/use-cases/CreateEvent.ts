import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { EventType } from '../../../domain/calendar/entities/CalendarEvent';

export interface CreateEventProps {
  start: Date;
  end: Date;
  type: EventType;
}

export class CreateEventUseCase {
  private subEventFactory: SubEventFactory;

  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {
    this.subEventFactory = new SubEventFactory();
  }

  async execute(props: CreateEventProps): Promise<CalendarEvent> {
    // Create the main event
    const event = CalendarEvent.create({
      id: crypto.randomUUID(),
      start: props.start,
      end: props.end,
      type: props.type
    });

    // Save the main event
    const events = await this.eventRepository.getAll();
    await this.eventRepository.save([...events, event]);

    // Generate and save sub-events
    const subEvents = this.subEventFactory.generateSubEvents(event, events);
    if (subEvents.length > 0) {
      const allSubEvents = await this.subEventRepository.getAll();
      await this.subEventRepository.save([...allSubEvents, ...subEvents]);
    }

    return event;
  }
} 
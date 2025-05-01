import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { EventType } from '../../../domain/calendar/value-objects/EventType';

export interface CreateEventProps {
  start: Date;
  end: Date;
  type: EventType;
}

export class CreateEventUseCase {
  constructor(private eventRepository: CalendarEventRepository) {}

  async execute(props: CreateEventProps): Promise<CalendarEvent> {
    const event = CalendarEvent.create({
      id: crypto.randomUUID(),
      start: props.start,
      end: props.end,
      type: props.type
    });

    const events = await this.eventRepository.getAll();
    await this.eventRepository.save([...events, event]);

    return event;
  }
} 
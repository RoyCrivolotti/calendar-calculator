import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { EventType } from '../../../domain/calendar/value-objects/EventType';

export interface UpdateEventProps {
  id: string;
  start: Date;
  end: Date;
  type: EventType;
}

export class UpdateEventUseCase {
  constructor(private eventRepository: CalendarEventRepository) {}

  async execute(props: UpdateEventProps): Promise<CalendarEvent> {
    const event = CalendarEvent.create({
      id: props.id,
      start: props.start,
      end: props.end,
      type: props.type
    });

    await this.eventRepository.update(event);
    return event;
  }
} 
import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';

export type EventType = 'oncall' | 'incident' | 'holiday';

export interface CalendarEventProps {
  id: string;
  start: Date | string;
  end: Date | string;
  type: EventType;
  title?: string;
}

export class CalendarEvent {
  id: string;
  start: Date;
  end: Date;
  type: EventType;
  title?: string;

  constructor(props: CalendarEventProps) {
    if (!props.id) {
      throw new Error('CalendarEvent must have an id');
    }
    if (!props.type) {
      throw new Error('CalendarEvent must have a type');
    }
    this.id = props.id;
    this.start = props.start instanceof Date ? props.start : new Date(props.start);
    this.end = props.end instanceof Date ? props.end : new Date(props.end);
    this.type = props.type;
    this.title = props.title;
  }

  static create(props: CalendarEventProps): CalendarEvent {
    return new CalendarEvent(props);
  }

  toJSON(): CalendarEventProps {
    return {
      id: this.id,
      start: this.start.toISOString(),
      end: this.end.toISOString(),
      type: this.type,
      title: this.title
    };
  }
}

export function createCalendarEvent(props: CalendarEventProps): CalendarEvent {
  const start = props.start instanceof Date ? props.start : new Date(props.start);
  const end = props.end instanceof Date ? props.end : new Date(props.end);

  return new CalendarEvent({
    ...props,
    start,
    end
  });
} 
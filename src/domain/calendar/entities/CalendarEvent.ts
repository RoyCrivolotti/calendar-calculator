import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';

export type EventType = 'oncall' | 'incident';

export interface CalendarEventProps {
  id: string;
  start: Date | string;
  end: Date | string;
  type: EventType;
  isWeekend?: boolean;
  isNightShift?: boolean;
  title?: string;
}

export class CalendarEvent {
  id: string;
  start: Date;
  end: Date;
  type: EventType;
  isWeekend: boolean;
  isNightShift: boolean;
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
    this.isWeekend = props.isWeekend || false;
    this.isNightShift = props.isNightShift || false;
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
      isWeekend: this.isWeekend,
      isNightShift: this.isNightShift,
      title: this.title
    };
  }
}

export function createCalendarEvent(props: Omit<CalendarEventProps, 'isWeekend' | 'isNightShift'>): CalendarEvent {
  const start = props.start instanceof Date ? props.start : new Date(props.start);
  const end = props.end instanceof Date ? props.end : new Date(props.end);
  const isWeekendValue = isWeekend(start);
  const isNightShiftValue = calculateNightShiftHours(start, end) > 0;

  return new CalendarEvent({
    ...props,
    start,
    end,
    isWeekend: isWeekendValue,
    isNightShift: isNightShiftValue
  });
} 
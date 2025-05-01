import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';

export type EventType = 'oncall' | 'incident';

export interface CalendarEventProps {
  id: string;
  start: Date;
  end: Date;
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
    this.id = props.id;
    this.start = props.start;
    this.end = props.end;
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
      start: this.start,
      end: this.end,
      type: this.type,
      isWeekend: this.isWeekend,
      isNightShift: this.isNightShift,
      title: this.title
    };
  }
}

export function createCalendarEvent(props: Omit<CalendarEventProps, 'isWeekend' | 'isNightShift'>): CalendarEvent {
  const isWeekendValue = isWeekend(props.start);
  const isNightShiftValue = calculateNightShiftHours(props.start, props.end) > 0;

  return new CalendarEvent({
    ...props,
    isWeekend: isWeekendValue,
    isNightShift: isNightShiftValue
  });
} 
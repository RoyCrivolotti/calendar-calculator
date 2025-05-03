import { EventType } from './CalendarEvent';

export interface SubEventProps {
  id: string;
  parentEventId: string;
  start: Date | string;
  end: Date | string;
  isWeekday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isNightShift: boolean;
  isOfficeHours: boolean;
  type: EventType;
}

export class SubEvent {
  id: string;
  parentEventId: string;
  start: Date;
  end: Date;
  isWeekday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isNightShift: boolean;
  isOfficeHours: boolean;
  type: EventType;

  constructor(props: SubEventProps) {
    if (!props.id) {
      throw new Error('SubEvent must have an id');
    }
    if (!props.parentEventId) {
      throw new Error('SubEvent must have a parentEventId');
    }
    
    this.id = props.id;
    this.parentEventId = props.parentEventId;
    this.start = props.start instanceof Date ? props.start : new Date(props.start);
    this.end = props.end instanceof Date ? props.end : new Date(props.end);
    this.isWeekday = props.isWeekday;
    this.isWeekend = props.isWeekend;
    this.isHoliday = props.isHoliday;
    this.isNightShift = props.isNightShift;
    this.isOfficeHours = props.isOfficeHours;
    this.type = props.type;
  }

  static create(props: SubEventProps): SubEvent {
    return new SubEvent(props);
  }

  toJSON(): SubEventProps {
    return {
      id: this.id,
      parentEventId: this.parentEventId,
      start: this.start.toISOString(),
      end: this.end.toISOString(),
      isWeekday: this.isWeekday,
      isWeekend: this.isWeekend,
      isHoliday: this.isHoliday,
      isNightShift: this.isNightShift,
      isOfficeHours: this.isOfficeHours,
      type: this.type
    };
  }
} 
import { EventTypes } from '../entities/CalendarEvent';

export interface HoursBreakdown {
  weekday: number;
  weekend: number;
  nightShift: number;
  weekendNight: number;
}

export interface CompensationBreakdown {
  type: EventTypes.ONCALL | EventTypes.INCIDENT | 'total';
  amount: number;
  count: number;
  description: string;
  month?: Date;
  hours?: HoursBreakdown;
  events?: Array<{
    id: string;
    start: Date;
    end: Date;
    isHoliday?: boolean;
  }>;
} 
import { EventTypes } from '../entities/CalendarEvent';

export interface CompensationBreakdown {
  type: EventTypes.ONCALL | EventTypes.INCIDENT | 'total';
  amount: number;
  count: number;
  description: string;
  month?: Date;
  events?: Array<{
    id: string;
    start: Date;
    end: Date;
    isHoliday?: boolean;
  }>;
} 
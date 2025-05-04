import { CalendarEvent } from '../entities/CalendarEvent';

export interface CompensationBreakdown {
  type: 'oncall' | 'incident' | 'total';
  amount: number;
  count: number;
  description: string;
  month?: Date;
  events?: Array<{
    id: string;
    start: Date;
    end: Date;
  }>;
} 
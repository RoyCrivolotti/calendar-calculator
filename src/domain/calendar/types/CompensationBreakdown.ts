import { CalendarEvent } from '../entities/CalendarEvent';

export interface CompensationBreakdown {
  month: string;
  date: string;
  onCallHours: number;
  incidentHours: number;
  nightShiftHours: number;
  totalCompensation: number;
  weekdayHours: number;
  weekendHours: number;
  onCallShifts: CalendarEvent[];
  incidents: CalendarEvent[];
  weekdayOnCallHours: number;
  weekendOnCallHours: number;
  weekdayIncidentHours: number;
  weekendIncidentHours: number;
  breakdown: {
    weekdayOnCallCompensation: number;
    weekendOnCallCompensation: number;
    weekdayIncidentCompensation: number;
    weekendIncidentCompensation: number;
    nightShiftIncidentBonus: number;
  };
} 
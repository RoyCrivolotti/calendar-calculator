import { CalendarEvent } from './CalendarEvent';

export interface CompensationRates {
  weekdayOnCallRate: number;      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: number;      // €7.34/hr for weekend on-call
  baseHourlySalary: number;       // €35.58 base hourly salary
  weekdayIncidentMultiplier: number; // 1.8x for weekday incidents
  weekendIncidentMultiplier: number; // 2x for weekend incidents
  nightShiftBonusMultiplier: number; // 1.4x (40% bonus) for night shift incidents
}

export interface CompensationBreakdownProps {
  date: string;
  weekdayHours: number;
  weekendHours: number;
  totalCompensation: number;
  onCallShifts: CalendarEvent[];
  incidents: CalendarEvent[];
  nightShiftHours: number;
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

export interface ICompensationBreakdown {
  month: string;
  onCallHours: number;
  incidentHours: number;
  nightShiftHours: number;
  totalCompensation: number;
}

export class CompensationBreakdown implements ICompensationBreakdown {
  readonly month: string;
  readonly onCallHours: number;
  readonly incidentHours: number;
  readonly nightShiftHours: number;
  readonly totalCompensation: number;

  constructor(
    public readonly date: string,
    public readonly weekdayHours: number,
    public readonly weekendHours: number,
    totalCompensation: number,
    public readonly onCallShifts: CalendarEvent[],
    public readonly incidents: CalendarEvent[],
    nightShiftHours: number,
    public readonly weekdayOnCallHours: number,
    public readonly weekendOnCallHours: number,
    public readonly weekdayIncidentHours: number,
    public readonly weekendIncidentHours: number,
    public readonly breakdown: {
      weekdayOnCallCompensation: number;
      weekendOnCallCompensation: number;
      weekdayIncidentCompensation: number;
      weekendIncidentCompensation: number;
      nightShiftIncidentBonus: number;
    }
  ) {
    this.month = new Date(date).toLocaleString('default', { month: 'long', year: 'numeric' });
    this.onCallHours = weekdayOnCallHours + weekendOnCallHours;
    this.incidentHours = weekdayIncidentHours + weekendIncidentHours;
    this.nightShiftHours = nightShiftHours;
    this.totalCompensation = totalCompensation;
    this.validate();
  }

  private validate(): void {
    if (this.weekdayHours < 0 || this.weekendHours < 0) {
      throw new Error('Hours cannot be negative');
    }
    if (this.totalCompensation < 0) {
      throw new Error('Compensation cannot be negative');
    }
    if (this.nightShiftHours < 0) {
      throw new Error('Night shift hours cannot be negative');
    }
  }

  toJSON(): CompensationBreakdownProps {
    return {
      date: this.date,
      weekdayHours: this.weekdayHours,
      weekendHours: this.weekendHours,
      totalCompensation: this.totalCompensation,
      onCallShifts: this.onCallShifts,
      incidents: this.incidents,
      nightShiftHours: this.nightShiftHours,
      weekdayOnCallHours: this.weekdayOnCallHours,
      weekendOnCallHours: this.weekendOnCallHours,
      weekdayIncidentHours: this.weekdayIncidentHours,
      weekendIncidentHours: this.weekendIncidentHours,
      breakdown: this.breakdown
    };
  }
} 
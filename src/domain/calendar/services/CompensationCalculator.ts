import { CalendarEvent } from '../entities/CalendarEvent';
import { CompensationBreakdown } from '../entities/CompensationBreakdown';
import { isWeekend, calculateNightShiftHours, calculateTotalHours } from '../../../utils/calendarUtils';

const RATES = {
  weekdayOnCallRate: 3.90,      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: 7.34,      // €7.34/hr for weekend on-call
  baseHourlySalary: 35.58,      // €35.58 base hourly salary
  weekdayIncidentMultiplier: 1.8, // 1.8x for weekday incidents
  weekendIncidentMultiplier: 2.0, // 2x for weekend incidents
  nightShiftBonusMultiplier: 1.4  // 1.4x (40% bonus) for night shift incidents
};

export class CompensationCalculator {
  calculateMonthlyCompensation(
    events: CalendarEvent[],
    date: Date = new Date()
  ): CompensationBreakdown[] {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= monthStart && eventDate <= monthEnd;
    });

    const onCallShifts = monthEvents.filter(event => event.type === 'oncall');
    const incidents = monthEvents.filter(event => event.type === 'incident');

    const weekdayOnCallHours = onCallShifts
      .filter(event => !isWeekend(event.start))
      .reduce((total, event) => total + calculateTotalHours(event.start, event.end), 0);

    const weekendOnCallHours = onCallShifts
      .filter(event => isWeekend(event.start))
      .reduce((total, event) => total + calculateTotalHours(event.start, event.end), 0);

    const weekdayIncidentHours = incidents
      .filter(event => !isWeekend(event.start))
      .reduce((total, event) => total + calculateTotalHours(event.start, event.end), 0);

    const weekendIncidentHours = incidents
      .filter(event => isWeekend(event.start))
      .reduce((total, event) => total + calculateTotalHours(event.start, event.end), 0);

    const nightShiftHours = incidents
      .reduce((total, event) => total + calculateNightShiftHours(event.start, event.end), 0);

    const breakdown = {
      weekdayOnCallCompensation: weekdayOnCallHours * RATES.weekdayOnCallRate,
      weekendOnCallCompensation: weekendOnCallHours * RATES.weekendOnCallRate,
      weekdayIncidentCompensation: weekdayIncidentHours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier,
      weekendIncidentCompensation: weekendIncidentHours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier,
      nightShiftIncidentBonus: nightShiftHours * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1)
    };

    const totalCompensation = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return [new CompensationBreakdown(
      monthStart.toISOString(),
      weekdayOnCallHours + weekdayIncidentHours,
      weekendOnCallHours + weekendIncidentHours,
      totalCompensation,
      onCallShifts,
      incidents,
      nightShiftHours,
      weekdayOnCallHours,
      weekendOnCallHours,
      weekdayIncidentHours,
      weekendIncidentHours,
      breakdown
    )];
  }
} 
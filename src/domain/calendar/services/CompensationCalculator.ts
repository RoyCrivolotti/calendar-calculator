import { CalendarEvent } from '../entities/CalendarEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';

const RATES = {
  weekdayOnCallRate: 3.90,      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: 7.34,      // €7.34/hr for weekend on-call
  baseHourlySalary: 35.58,      // €35.58 base hourly salary
  weekdayIncidentMultiplier: 1.8, // 1.8x for weekday incidents
  weekendIncidentMultiplier: 2.0, // 2x for weekend incidents
  nightShiftBonusMultiplier: 1.4  // 1.4x (40% bonus) for night shift incidents
};

const OFFICE_HOURS = {
  start: 9, // 9 AM
  end: 18, // 6 PM
  days: [1, 2, 3, 4, 5] // Monday to Friday (0 is Sunday, 6 is Saturday)
};

export class CompensationCalculator {
  private isWithinOfficeHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    
    return OFFICE_HOURS.days.includes(day) && 
           hour >= OFFICE_HOURS.start && 
           hour < OFFICE_HOURS.end;
  }

  private calculateCompensableHours(event: CalendarEvent): { weekday: number; weekend: number } {
    const start = new Date(event.start);
    const end = new Date(event.end);
    let weekdayHours = 0;
    let weekendHours = 0;

    // Iterate through each hour of the event
    for (let d = new Date(start); d < end; d.setHours(d.getHours() + 1)) {
      // Skip office hours
      if (this.isWithinOfficeHours(d)) {
        continue;
      }

      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) {
        weekendHours++;
      } else {
        weekdayHours++;
      }
    }

    return { weekday: weekdayHours, weekend: weekendHours };
  }

  private calculateEventCompensation(event: CalendarEvent): { weekday: number; weekend: number; nightShift: number } {
    const hours = this.calculateCompensableHours(event);
    let weekdayComp = 0;
    let weekendComp = 0;
    let nightShiftComp = 0;

    if (event.type === 'oncall') {
      weekdayComp = hours.weekday * RATES.weekdayOnCallRate;
      weekendComp = hours.weekend * RATES.weekendOnCallRate;
    } else if (event.type === 'incident') {
      const totalHours = hours.weekday + hours.weekend;
      const isWeekend = event.isWeekend;
      const multiplier = isWeekend ? RATES.weekendIncidentMultiplier : RATES.weekdayIncidentMultiplier;
      
      if (isWeekend) {
        weekendComp = totalHours * RATES.baseHourlySalary * multiplier;
      } else {
        weekdayComp = totalHours * RATES.baseHourlySalary * multiplier;
      }

      if (event.isNightShift) {
        nightShiftComp = totalHours * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1);
      }
    }

    return { weekday: weekdayComp, weekend: weekendComp, nightShift: nightShiftComp };
  }

  calculateMonthlyCompensation(events: CalendarEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const monthEvents = events.filter(event => {
      const eventMonthKey = `${event.start.getFullYear()}-${event.start.getMonth() + 1}`;
      return eventMonthKey === monthKey;
    });

    const oncallEvents = monthEvents.filter(event => event.type === 'oncall');
    const incidentEvents = monthEvents.filter(event => event.type === 'incident');

    let totalWeekdayOnCallHours = 0;
    let totalWeekendOnCallHours = 0;
    let totalWeekdayIncidentHours = 0;
    let totalWeekendIncidentHours = 0;
    let totalNightShiftHours = 0;
    let totalCompensation = 0;

    // Calculate on-call compensation
    oncallEvents.forEach(event => {
      const hours = this.calculateCompensableHours(event);
      totalWeekdayOnCallHours += hours.weekday;
      totalWeekendOnCallHours += hours.weekend;
      const comp = this.calculateEventCompensation(event);
      totalCompensation += comp.weekday + comp.weekend;
    });

    // Calculate incident compensation
    incidentEvents.forEach(event => {
      const hours = this.calculateCompensableHours(event);
      if (event.isWeekend) {
        totalWeekendIncidentHours += hours.weekday + hours.weekend;
      } else {
        totalWeekdayIncidentHours += hours.weekday + hours.weekend;
      }
      if (event.isNightShift) {
        totalNightShiftHours += hours.weekday + hours.weekend;
      }
      const comp = this.calculateEventCompensation(event);
      totalCompensation += comp.weekday + comp.weekend + comp.nightShift;
    });

    const breakdown: CompensationBreakdown[] = [];

    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalWeekdayOnCallHours * RATES.weekdayOnCallRate + totalWeekendOnCallHours * RATES.weekendOnCallRate,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours}h weekday, ${totalWeekendOnCallHours}h weekend)`
      });
    }

    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0) {
      breakdown.push({
        type: 'incident',
        amount: totalWeekdayIncidentHours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier +
                totalWeekendIncidentHours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier +
                totalNightShiftHours * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1),
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalNightShiftHours}h night shift)`
      });
    }

    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation'
      });
    }

    return breakdown;
  }

  calculateTotalCompensation(events: CalendarEvent[]): number {
    return events.reduce((total, event) => {
      const comp = this.calculateEventCompensation(event);
      return total + comp.weekday + comp.weekend + comp.nightShift;
    }, 0);
  }
} 
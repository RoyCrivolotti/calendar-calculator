import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';

const RATES = {
  weekdayOnCallRate: 3.90,      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: 7.34,      // €7.34/hr for weekend on-call
  baseHourlySalary: 35.58,      // €35.58 base hourly salary
  weekdayIncidentMultiplier: 1.8, // 1.8x for weekday incidents
  weekendIncidentMultiplier: 2.0, // 2x for weekend incidents
  nightShiftBonusMultiplier: 1.4  // 1.4x (40% bonus) for night shift incidents
};

export class SubEventCompensationCalculator {
  calculateMonthlyCompensation(events: CalendarEvent[], subEvents: SubEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    // Filter events for the current month
    const monthEvents = events.filter(event => {
      const eventMonthKey = `${new Date(event.start).getFullYear()}-${new Date(event.start).getMonth() + 1}`;
      return eventMonthKey === monthKey;
    });
    
    // Get all parent event IDs for the month
    const monthEventIds = monthEvents.map(event => event.id);
    
    // Filter sub-events for the current month's events
    const monthSubEvents = subEvents.filter(subEvent => 
      monthEventIds.includes(subEvent.parentEventId)
    );

    // Separate oncall and incident events
    const oncallEvents = monthEvents.filter(event => event.type === 'oncall');
    const incidentEvents = monthEvents.filter(event => event.type === 'incident');
    
    // Get all sub-events for on-call and incidents
    const oncallSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'oncall');
    const incidentSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'incident');
    
    // Calculate compensation statistics
    let totalWeekdayOnCallHours = 0;
    let totalWeekendOnCallHours = 0;
    let totalWeekdayIncidentHours = 0;
    let totalWeekendIncidentHours = 0;
    let totalWeekdayNightShiftHours = 0;
    let totalWeekendNightShiftHours = 0;
    let totalCompensation = 0;

    // Process on-call sub-events
    oncallSubEvents.forEach(subEvent => {
      if (!subEvent.isOfficeHours) { // Skip office hours for on-call
        const hours = this.calculateHoursInSubEvent(subEvent);
        
        if (subEvent.isWeekend) {
          totalWeekendOnCallHours += hours;
        } else {
          totalWeekdayOnCallHours += hours;
        }
      }
    });

    // Process incident sub-events
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      
      if (subEvent.isWeekend) {
        if (subEvent.isNightShift) {
          totalWeekendNightShiftHours += hours;
        } else {
          totalWeekendIncidentHours += hours;
        }
      } else {
        if (subEvent.isNightShift) {
          totalWeekdayNightShiftHours += hours;
        } else {
          totalWeekdayIncidentHours += hours;
        }
      }
    });

    // Calculate compensation for on-call
    const weekdayOnCallComp = totalWeekdayOnCallHours * RATES.weekdayOnCallRate;
    const weekendOnCallComp = totalWeekendOnCallHours * RATES.weekendOnCallRate;
    
    // Calculate compensation for weekday incidents
    const weekdayRegularIncidentComp = totalWeekdayIncidentHours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier;
    
    // Calculate compensation for weekday nightshift incidents (with both multipliers)
    const weekdayNightshiftIncidentComp = totalWeekdayNightShiftHours * RATES.baseHourlySalary 
                                      * RATES.weekdayIncidentMultiplier * RATES.nightShiftBonusMultiplier;
    
    // Calculate compensation for weekend incidents
    const weekendRegularIncidentComp = totalWeekendIncidentHours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier;
    
    // Calculate compensation for weekend nightshift incidents (with both multipliers)
    const weekendNightshiftIncidentComp = totalWeekendNightShiftHours * RATES.baseHourlySalary 
                                      * RATES.weekendIncidentMultiplier * RATES.nightShiftBonusMultiplier;
    
    // Calculate total on-call compensation
    const totalOnCallComp = weekdayOnCallComp + weekendOnCallComp;
    
    // Calculate total incident compensation
    const totalIncidentComp = weekdayRegularIncidentComp + weekdayNightshiftIncidentComp +
                             weekendRegularIncidentComp + weekendNightshiftIncidentComp;
    
    // Total compensation
    totalCompensation = totalOnCallComp + totalIncidentComp;

    const breakdown: CompensationBreakdown[] = [];

    // Add on-call compensation to breakdown
    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalOnCallComp,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours}h weekday, ${totalWeekendOnCallHours}h weekend)`
      });
    }

    // Add incident compensation to breakdown
    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0 || 
        totalWeekdayNightShiftHours > 0 || totalWeekendNightShiftHours > 0) {
      breakdown.push({
        type: 'incident',
        amount: totalIncidentComp,
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night shift, ${totalWeekendNightShiftHours}h weekend night shift)`
      });
    }

    // Add total compensation to breakdown
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

  private calculateHoursInSubEvent(subEvent: SubEvent): number {
    const start = new Date(subEvent.start);
    const end = new Date(subEvent.end);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // For incidents, round up to the nearest hour
    if (subEvent.type === 'incident') {
      return Math.ceil(hours);
    }
    
    return hours;
  }

  calculateTotalCompensation(events: CalendarEvent[], subEvents: SubEvent[]): number {
    const allSubEvents = subEvents.filter(subEvent => 
      events.some(event => event.id === subEvent.parentEventId)
    );
    
    let totalCompensation = 0;
    
    // Process on-call sub-events
    const oncallSubEvents = allSubEvents.filter(subEvent => subEvent.type === 'oncall');
    oncallSubEvents.forEach(subEvent => {
      if (!subEvent.isOfficeHours) { // Skip office hours for on-call
        const hours = this.calculateHoursInSubEvent(subEvent);
        const rate = subEvent.isWeekend ? RATES.weekendOnCallRate : RATES.weekdayOnCallRate;
        totalCompensation += hours * rate;
      }
    });
    
    // Process incident sub-events
    const incidentSubEvents = allSubEvents.filter(subEvent => subEvent.type === 'incident');
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      
      if (subEvent.isWeekend) {
        if (subEvent.isNightShift) {
          // Weekend night shift - full calculation with both multipliers
          totalCompensation += hours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier * RATES.nightShiftBonusMultiplier;
        } else {
          // Regular weekend incident
          totalCompensation += hours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier;
        }
      } else {
        if (subEvent.isNightShift) {
          // Weekday night shift - full calculation with both multipliers
          totalCompensation += hours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier * RATES.nightShiftBonusMultiplier;
        } else {
          // Regular weekday incident
          totalCompensation += hours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier;
        }
      }
    });
    
    return totalCompensation;
  }
}
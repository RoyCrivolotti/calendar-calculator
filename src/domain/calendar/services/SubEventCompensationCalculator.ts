import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { COMPENSATION_RATES } from '../constants/CompensationRates';

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
      // Also include night shift hours for on-call, even during office hours
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
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
    const weekdayOnCallComp = totalWeekdayOnCallHours * COMPENSATION_RATES.weekdayOnCallRate;
    const weekendOnCallComp = totalWeekendOnCallHours * COMPENSATION_RATES.weekendOnCallRate;
    
    // Calculate compensation for weekday incidents
    const weekdayRegularIncidentComp = totalWeekdayIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    
    // Calculate compensation for weekday nightshift incidents 
    // Night shift hours get the base compensation PLUS the additional bonus
    const weekdayNightshiftBaseComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    const weekdayNightshiftBonusComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
    const weekdayNightshiftIncidentComp = weekdayNightshiftBaseComp + weekdayNightshiftBonusComp;
    
    // Calculate compensation for weekend incidents
    const weekendRegularIncidentComp = totalWeekendIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
    
    // Calculate compensation for weekend nightshift incidents
    // Night shift hours get the base compensation PLUS the additional bonus
    const weekendNightshiftBaseComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
    const weekendNightshiftBonusComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
    const weekendNightshiftIncidentComp = weekendNightshiftBaseComp + weekendNightshiftBonusComp;
    
    // Calculate total on-call compensation
    const totalOnCallComp = weekdayOnCallComp + weekendOnCallComp;
    
    // Calculate total incident compensation
    const totalIncidentComp = weekdayRegularIncidentComp + weekdayNightshiftIncidentComp +
                             weekendRegularIncidentComp + weekendNightshiftIncidentComp;
    
    // Total compensation
    totalCompensation = totalOnCallComp + totalIncidentComp;

    const breakdown: CompensationBreakdown[] = [];
    
    // Make sure we have a proper date object for the month
    const monthDate = new Date(date);

    // Add on-call compensation to breakdown
    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalOnCallComp,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours.toFixed(1)}h weekday, ${totalWeekendOnCallHours.toFixed(1)}h weekend)`,
        month: monthDate
      });
    }

    // Add incident compensation to breakdown
    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0 || 
        totalWeekdayNightShiftHours > 0 || totalWeekendNightShiftHours > 0) {
      
      breakdown.push({
        type: 'incident',
        amount: totalIncidentComp,
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night, ${totalWeekendNightShiftHours}h weekend night)`,
        month: monthDate
      });
    }

    // Add total compensation to breakdown
    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation',
        month: monthDate
      });
    } else if (monthEvents.length > 0) {
      // Even if total compensation is 0, still add a total item if there are events
      // This ensures that the month appears in the summary
      breakdown.push({
        type: 'total',
        amount: 0,
        count: monthEvents.length,
        description: 'No compensation calculated',
        month: monthDate
      });
    }

    return breakdown;
  }

  private calculateHoursInSubEvent(subEvent: SubEvent): number {
    const start = new Date(subEvent.start);
    const end = new Date(subEvent.end);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // For incidents, round up to the nearest hour even if just a few minutes
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
      // Calculate hours for any non-office-hour subevent
      // for on-call shifts, including night shifts
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        const hours = this.calculateHoursInSubEvent(subEvent);
        const rate = subEvent.isWeekend ? COMPENSATION_RATES.weekendOnCallRate : COMPENSATION_RATES.weekdayOnCallRate;
        totalCompensation += hours * rate;
      }
    });
    
    // Process incident sub-events
    const incidentSubEvents = allSubEvents.filter(subEvent => subEvent.type === 'incident');
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      
      if (subEvent.isWeekend) {
        if (subEvent.isNightShift) {
          // Weekend night shift - calculate full compensation directly
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                              COMPENSATION_RATES.weekendIncidentMultiplier * 
                              COMPENSATION_RATES.nightShiftBonusMultiplier;
          totalCompensation += compensation;
        } else {
          // Regular weekend incident
          totalCompensation += hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
        }
      } else {
        if (subEvent.isNightShift) {
          // Weekday night shift - calculate full compensation directly
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                              COMPENSATION_RATES.weekdayIncidentMultiplier * 
                              COMPENSATION_RATES.nightShiftBonusMultiplier;
          totalCompensation += compensation;
        } else {
          // Regular weekday incident
          totalCompensation += hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
        }
      }
    });
    
    return totalCompensation;
  }
}
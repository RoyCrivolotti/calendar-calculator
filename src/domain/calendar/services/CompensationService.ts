import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';

export const COMPENSATION_RATES = {
  weekdayOnCallRate: 3.90,      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: 7.34,      // €7.34/hr for weekend on-call
  baseHourlySalary: 35.58,      // €35.58 base hourly salary
  weekdayIncidentMultiplier: 1.8, // 1.8x for weekday incidents
  weekendIncidentMultiplier: 2.0, // 2x for weekend incidents
  nightShiftBonusMultiplier: 1.4  // 1.4x (40% bonus) for night shift incidents
};

/**
 * Centralized service for all compensation calculations in the application
 */
export class CompensationService {
  /**
   * Calculate the number of compensated hours for a sub-event
   */
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

  /**
   * Calculate the total compensation for all events and sub-events
   */
  calculateTotalCompensation(events: CalendarEvent[], subEvents: SubEvent[]): number {
    const relevantSubEvents = subEvents.filter(subEvent => 
      events.some(event => event.id === subEvent.parentEventId)
    );
    
    let totalCompensation = 0;
    
    // Process on-call sub-events
    const oncallSubEvents = relevantSubEvents.filter(subEvent => subEvent.type === 'oncall');
    oncallSubEvents.forEach(subEvent => {
      // Include hours that are either outside office hours OR night shift hours
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        const hours = this.calculateHoursInSubEvent(subEvent);
        const rate = subEvent.isWeekend ? COMPENSATION_RATES.weekendOnCallRate : COMPENSATION_RATES.weekdayOnCallRate;
        totalCompensation += hours * rate;
      }
    });
    
    // Process incident sub-events
    const incidentSubEvents = relevantSubEvents.filter(subEvent => subEvent.type === 'incident');
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      
      if (subEvent.isWeekend) {
        if (subEvent.isNightShift) {
          // Weekend night shift - apply base rate plus night shift bonus
          const baseCompensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
          totalCompensation += baseCompensation;
          
          // Add the night shift bonus (40% extra)
          const nightShiftBonus = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
          totalCompensation += nightShiftBonus;
        } else {
          // Regular weekend incident
          totalCompensation += hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
        }
      } else {
        if (subEvent.isNightShift) {
          // Weekday night shift - apply base rate plus night shift bonus
          const baseCompensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
          totalCompensation += baseCompensation;
          
          // Add the night shift bonus (40% extra)
          const nightShiftBonus = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
          totalCompensation += nightShiftBonus;
        } else {
          // Regular weekday incident
          totalCompensation += hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
        }
      }
    });
    
    return totalCompensation;
  }

  /**
   * Calculate monthly compensation breakdown
   */
  calculateMonthlyCompensation(events: CalendarEvent[], subEvents: SubEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    console.debug(`Calculating compensation for month: ${monthKey}`);
    console.debug(`Total events: ${events.length}, Total subEvents: ${subEvents.length}`);
    
    // Filter events for the current month
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      const eventMonthKey = `${eventDate.getFullYear()}-${eventDate.getMonth() + 1}`;
      return eventMonthKey === monthKey;
    });
    
    console.debug(`Events for month ${monthKey}: ${monthEvents.length}`);
    
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
    
    // Process on-call sub-events
    oncallSubEvents.forEach(subEvent => {
      // Include both outside office hours AND night shifts
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
    const weekdayIncidentBaseComp = totalWeekdayIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    
    // Calculate compensation for weekday night shift incidents - base + bonus
    const weekdayNightShiftBaseComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    const weekdayNightShiftBonusComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
    const weekdayNightShiftTotalComp = weekdayNightShiftBaseComp + weekdayNightShiftBonusComp;
    
    // Calculate compensation for weekend incidents
    const weekendIncidentBaseComp = totalWeekendIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
    
    // Calculate compensation for weekend night shift incidents - base + bonus
    const weekendNightShiftBaseComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
    const weekendNightShiftBonusComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier * (COMPENSATION_RATES.nightShiftBonusMultiplier - 1);
    const weekendNightShiftTotalComp = weekendNightShiftBaseComp + weekendNightShiftBonusComp;
    
    // Calculate total on-call compensation
    const totalOnCallComp = weekdayOnCallComp + weekendOnCallComp;
    
    // Calculate total incident compensation
    const totalIncidentComp = weekdayIncidentBaseComp + weekdayNightShiftTotalComp + weekendIncidentBaseComp + weekendNightShiftTotalComp;
    
    // Total compensation
    const totalCompensation = totalOnCallComp + totalIncidentComp;

    const breakdown: CompensationBreakdown[] = [];

    // Add on-call compensation to breakdown
    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalOnCallComp,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours}h weekday, ${totalWeekendOnCallHours}h weekend)`,
        month: new Date(date)
      });
    }

    // Add incident compensation to breakdown
    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0 || 
        totalWeekdayNightShiftHours > 0 || totalWeekendNightShiftHours > 0) {
      
      // Debug compensation calculation
      console.debug('Incident compensation breakdown:');
      console.debug(`Weekday regular: ${totalWeekdayIncidentHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekdayIncidentMultiplier} = €${weekdayIncidentBaseComp.toFixed(2)}`);
      console.debug(`Weekday night: ${totalWeekdayNightShiftHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekdayIncidentMultiplier} × ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekdayNightShiftTotalComp.toFixed(2)}`);
      console.debug(`Weekend regular: ${totalWeekendIncidentHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekendIncidentMultiplier} = €${weekendIncidentBaseComp.toFixed(2)}`);
      console.debug(`Weekend night: ${totalWeekendNightShiftHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekendIncidentMultiplier} × ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekendNightShiftTotalComp.toFixed(2)}`);
      console.debug(`Total incident: €${totalIncidentComp.toFixed(2)}`);
      
      breakdown.push({
        type: 'incident',
        amount: totalIncidentComp,
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night shift, ${totalWeekendNightShiftHours}h weekend night shift)`,
        month: new Date(date)
      });
    }

    // Add total compensation to breakdown
    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation',
        month: new Date(date)
      });
    }

    console.debug(`Compensation breakdown for ${monthKey}:`, breakdown.map(b => ({
      type: b.type,
      amount: b.amount,
      month: b.month ? b.month.toISOString() : 'undefined'
    })));

    return breakdown;
  }
} 
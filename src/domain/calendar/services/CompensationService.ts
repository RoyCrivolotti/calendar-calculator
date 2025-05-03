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
    
    console.debug(`Calculating hours for sub-event ${subEvent.id}: ${start.toISOString()} to ${end.toISOString()}`);
    console.debug(`Raw hours: ${hours}, type: ${subEvent.type}, isOfficeHours: ${subEvent.isOfficeHours}, isNightShift: ${subEvent.isNightShift}, isWeekend: ${subEvent.isWeekend}`);
    
    // For incidents, round up to the nearest hour even if just a few minutes
    if (subEvent.type === 'incident') {
      // Weekend and night shift hours are always compensated for incidents
      if (subEvent.isWeekend || subEvent.isNightShift) {
        console.debug(`Incident: Counting full ${Math.ceil(hours)}h (weekend or night shift)`);
        return Math.ceil(hours);
      }
      // Weekday daytime incidents
      if (!subEvent.isOfficeHours) {
        console.debug(`Incident: Counting full ${Math.ceil(hours)}h (outside office hours)`);
        return Math.ceil(hours);
      }
      console.debug(`Incident: Counting full ${Math.ceil(hours)}h (default)`);
      return Math.ceil(hours);
    }
    
    // For on-call, we need to be more precise about hours
    if (subEvent.type === 'oncall') {
      // Weekend on-call hours are always compensated
      if (subEvent.isWeekend) {
        console.debug(`On-call: Counting full ${hours}h (weekend)`);
        return hours;
      }
      
      // For weekday on-call, only count hours outside office hours (or night shift)
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        console.debug(`On-call: Counting ${hours}h (outside office hours or night shift)`);
        return hours;
      } else {
        console.debug(`On-call: NOT counting hours (during office hours, not night shift)`);
        return 0; // Don't count on-call during office hours on weekdays
      }
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
          // Weekend night shift - apply all multipliers at once
          const nightShiftCompensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                                        COMPENSATION_RATES.weekendIncidentMultiplier * 
                                        COMPENSATION_RATES.nightShiftBonusMultiplier;
          
          console.debug(`Weekend night shift FIXED: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${nightShiftCompensation.toFixed(2)}`);
          console.debug(`EXPECTED: 1h weekend night = €${(COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier).toFixed(2)}`);
          
          totalCompensation += nightShiftCompensation;
        } else {
          // Regular weekend incident
          const weekendCompensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
          console.debug(`Weekend incident: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} = €${weekendCompensation.toFixed(2)}`);
          
          totalCompensation += weekendCompensation;
        }
      } else {
        if (subEvent.isNightShift) {
          // Weekday night shift - apply all multipliers at once
          const nightShiftCompensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                                        COMPENSATION_RATES.weekdayIncidentMultiplier * 
                                        COMPENSATION_RATES.nightShiftBonusMultiplier;
          
          console.debug(`Weekday night shift: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${nightShiftCompensation.toFixed(2)}`);
          
          totalCompensation += nightShiftCompensation;
        } else {
          // Regular weekday incident
          const weekdayCompensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
          console.debug(`Weekday incident: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} = €${weekdayCompensation.toFixed(2)}`);
          
          totalCompensation += weekdayCompensation;
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
      const match = eventMonthKey === monthKey;
      console.debug(`Event ${event.id} start: ${eventDate.toISOString()}, monthKey: ${eventMonthKey}, matches: ${match}`);
      return match;
    });
    
    console.debug(`Events for month ${monthKey}: ${monthEvents.length}`);
    
    // Get all parent event IDs for the month
    const monthEventIds = monthEvents.map(event => event.id);
    console.debug(`Month event IDs: ${monthEventIds.join(', ')}`);
    
    // Filter sub-events for the current month's events
    const monthSubEvents = subEvents.filter(subEvent => {
      const match = monthEventIds.includes(subEvent.parentEventId);
      return match;
    });
    
    console.debug(`Sub-events for month ${monthKey}: ${monthSubEvents.length}`);
    
    // Separate oncall and incident events
    const oncallEvents = monthEvents.filter(event => event.type === 'oncall');
    const incidentEvents = monthEvents.filter(event => event.type === 'incident');
    
    console.debug(`On-call events: ${oncallEvents.length}, Incident events: ${incidentEvents.length}`);
    
    // Get all sub-events for on-call and incidents
    const oncallSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'oncall');
    const incidentSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'incident');
    
    console.debug(`On-call sub-events: ${oncallSubEvents.length}, Incident sub-events: ${incidentSubEvents.length}`);
    
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
        console.debug(`On-call sub-event ${subEvent.id}: ${hours}h, isWeekend=${subEvent.isWeekend}, isOfficeHours=${subEvent.isOfficeHours}, isNightShift=${subEvent.isNightShift}`);
        
        if (subEvent.isWeekend) {
          totalWeekendOnCallHours += hours;
        } else {
          totalWeekdayOnCallHours += hours;
        }
      }
    });

    console.debug(`Total on-call hours - Weekday: ${totalWeekdayOnCallHours}h, Weekend: ${totalWeekendOnCallHours}h`);

    // Process incident sub-events
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      console.debug(`Incident sub-event ${subEvent.id}: ${hours}h, isWeekend=${subEvent.isWeekend}, isNightShift=${subEvent.isNightShift}`);
      
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

    console.debug(`Total incident hours - Weekday: ${totalWeekdayIncidentHours}h, Weekend: ${totalWeekendIncidentHours}h, Weekday Night: ${totalWeekdayNightShiftHours}h, Weekend Night: ${totalWeekendNightShiftHours}h`);

    // Calculate compensation for on-call
    const weekdayOnCallComp = totalWeekdayOnCallHours * COMPENSATION_RATES.weekdayOnCallRate;
    const weekendOnCallComp = totalWeekendOnCallHours * COMPENSATION_RATES.weekendOnCallRate;
    
    // Calculate compensation for weekday incidents
    const weekdayIncidentBaseComp = totalWeekdayIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    
    // Calculate compensation for weekday night shift incidents - directly use the multipliers
    const weekdayNightShiftComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * 
                                COMPENSATION_RATES.weekdayIncidentMultiplier * 
                                COMPENSATION_RATES.nightShiftBonusMultiplier;
    
    // Calculate compensation for weekend incidents
    const weekendIncidentBaseComp = totalWeekendIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
    
    // Calculate compensation for weekend night shift incidents - directly use the multipliers
    const weekendNightShiftComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * 
                                COMPENSATION_RATES.weekendIncidentMultiplier * 
                                COMPENSATION_RATES.nightShiftBonusMultiplier;
    
    // Add debug logs to check calculations
    if (totalWeekendNightShiftHours > 0) {
      const expected1Hour = COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier;
      console.debug(`DETAILED NIGHT SHIFT CALCULATION:`);
      console.debug(`Base hourly salary: €${COMPENSATION_RATES.baseHourlySalary}`);
      console.debug(`Weekend multiplier: ${COMPENSATION_RATES.weekendIncidentMultiplier}`);
      console.debug(`Night shift multiplier: ${COMPENSATION_RATES.nightShiftBonusMultiplier}`);
      console.debug(`For 1 hour weekend night shift: €${expected1Hour.toFixed(2)}`);
      console.debug(`For ${totalWeekendNightShiftHours}h: €${weekendNightShiftComp.toFixed(2)}`);
    }
    
    // Calculate total on-call compensation
    const totalOnCallComp = weekdayOnCallComp + weekendOnCallComp;
    
    // Calculate total incident compensation
    const totalIncidentComp = weekdayIncidentBaseComp + weekdayNightShiftComp + weekendIncidentBaseComp + weekendNightShiftComp;
    
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
      
      // Log weekday night shift calculation
      console.debug(`Weekday night: ${totalWeekdayNightShiftHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekdayIncidentMultiplier} × ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekdayNightShiftComp.toFixed(2)}`);
      
      console.debug(`Weekend regular: ${totalWeekendIncidentHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekendIncidentMultiplier} = €${weekendIncidentBaseComp.toFixed(2)}`);
      
      // Log weekend night shift calculation
      console.debug(`Weekend night: ${totalWeekendNightShiftHours}h × €${COMPENSATION_RATES.baseHourlySalary} × ${COMPENSATION_RATES.weekendIncidentMultiplier} × ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekendNightShiftComp.toFixed(2)}`);
      
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
    } else if (monthEvents.length > 0) {
      // Even if total compensation is 0, still add a total item if there are events
      // This ensures that the month appears in the summary
      breakdown.push({
        type: 'total',
        amount: 0,
        count: monthEvents.length,
        description: 'No compensation calculated',
        month: new Date(date)
      });
    }

    console.debug(`Compensation breakdown for ${monthKey}:`, breakdown.map(b => ({
      type: b.type,
      amount: b.amount,
      month: b.month ? b.month.toISOString() : 'undefined'
    })));
    
    // Check incident compensation calculations
    if (totalWeekendNightShiftHours > 0) {
      const expectedIncidentComp = totalWeekendNightShiftHours *
                                  COMPENSATION_RATES.baseHourlySalary *
                                  COMPENSATION_RATES.weekendIncidentMultiplier *
                                  COMPENSATION_RATES.nightShiftBonusMultiplier;
      
      console.debug(`FINAL CHECK - Weekend night shift expected: ${expectedIncidentComp.toFixed(2)}`);
      
      // If we have a breakdown item for incidents, verify it has the correct amount
      const incidentBreakdown = breakdown.find(b => b.type === 'incident');
      if (incidentBreakdown) {
        console.debug(`Current incident compensation: ${incidentBreakdown.amount.toFixed(2)}`);
        if (Math.abs(incidentBreakdown.amount - expectedIncidentComp) > 0.1) {
          console.warn(`Incident compensation appears incorrect. Expected: ${expectedIncidentComp.toFixed(2)}, Actual: ${incidentBreakdown.amount.toFixed(2)}`);
          
          // Force correct the amount in extreme cases
          if (Math.abs(incidentBreakdown.amount - expectedIncidentComp) > 50) {
            console.warn(`Large discrepancy detected, forcing correction of incident compensation`);
            incidentBreakdown.amount = expectedIncidentComp;
            
            // Update the total as well
            const totalBreakdown = breakdown.find(b => b.type === 'total');
            if (totalBreakdown) {
              totalBreakdown.amount = totalOnCallComp + expectedIncidentComp;
            }
          }
        }
      }
    }
    
    // Ensure we always return a breakdown array, even if empty
    if (breakdown.length === 0 && monthEvents.length > 0) {
      console.debug(`No breakdown items were created despite having ${monthEvents.length} events. Creating fallback total.`);
      breakdown.push({
        type: 'total',
        amount: 0,
        count: monthEvents.length,
        description: 'Fallback: No compensation calculated',
        month: new Date(date)
      });
    }

    return breakdown;
  }
} 
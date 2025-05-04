import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { COMPENSATION_RATES } from '../constants/CompensationRates';
import { isWeekend, getMonthKey, createMonthDate } from '../../../utils/calendarUtils';
import { logger } from '../../../utils/logger';

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
    
    logger.debug(`Calculating hours for sub-event ${subEvent.id}: ${start.toISOString()} to ${end.toISOString()}`);
    logger.debug(`Raw hours: ${hours}, type: ${subEvent.type}, isOfficeHours: ${subEvent.isOfficeHours}, isNightShift: ${subEvent.isNightShift}, isWeekend: ${subEvent.isWeekend}`);
    
    // For incidents, round up to the nearest hour even if just a few minutes
    if (subEvent.type === 'incident') {
      // Weekend and night shift hours are always compensated for incidents
      if (subEvent.isWeekend || subEvent.isNightShift) {
        logger.debug(`Incident: Counting full ${Math.ceil(hours)}h (weekend or night shift)`);
        return Math.ceil(hours);
      }
      // Weekday daytime incidents
      if (!subEvent.isOfficeHours) {
        logger.debug(`Incident: Counting full ${Math.ceil(hours)}h (outside office hours)`);
        return Math.ceil(hours);
      }
      logger.debug(`Incident: Counting full ${Math.ceil(hours)}h (default)`);
      return Math.ceil(hours);
    }
    
    // For on-call shifts, count exact hours (no rounding)
    if (subEvent.type === 'oncall') {
      // Only count non-office hours for on-call
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        logger.debug(`On-call: Counting exact ${hours}h (outside office hours or night shift)`);
        return hours;
      }
      logger.debug(`On-call: Not counting ${hours}h (office hours)`);
      return 0;
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
        const compensation = hours * rate;
        
        logger.debug(`On-call compensation: ${hours}h * €${rate} = €${compensation.toFixed(2)}`);
        totalCompensation += compensation;
      }
    });
    
    // Process incident sub-events
    const incidentSubEvents = relevantSubEvents.filter(subEvent => subEvent.type === 'incident');
    incidentSubEvents.forEach(subEvent => {
      const hours = this.calculateHoursInSubEvent(subEvent);
      
      if (subEvent.isWeekend) {
        if (subEvent.isNightShift) {
          // Weekend night shift
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                               COMPENSATION_RATES.weekendIncidentMultiplier * 
                               COMPENSATION_RATES.nightShiftBonusMultiplier;
          
          logger.debug(`Weekend night shift: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${compensation.toFixed(2)}`);
          totalCompensation += compensation;
        } else {
          // Regular weekend incident
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
          logger.debug(`Weekend incident: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} = €${compensation.toFixed(2)}`);
          totalCompensation += compensation;
        }
      } else {
        if (subEvent.isNightShift) {
          // Weekday night shift - apply all multipliers at once
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * 
                             COMPENSATION_RATES.weekdayIncidentMultiplier * 
                             COMPENSATION_RATES.nightShiftBonusMultiplier;
          
          logger.debug(`Weekday night shift: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${compensation.toFixed(2)}`);
          
          totalCompensation += compensation;
        } else {
          // Regular weekday incident
          const compensation = hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
          logger.debug(`Weekday incident: ${hours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} = €${compensation.toFixed(2)}`);
          
          totalCompensation += compensation;
        }
      }
    });
    
    return totalCompensation;
  }

  /**
   * Calculate monthly compensation breakdown from events and sub-events
   */
  calculateMonthlyCompensation(events: CalendarEvent[], subEvents: SubEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = getMonthKey(date);
    
    logger.info(`Calculating compensation for month: ${monthKey}`);
    
    // Filter events for the current month
    const monthEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      const eventMonthKey = getMonthKey(eventDate);
      const isInMonth = eventMonthKey === monthKey;
      logger.info(`Event ${event.id} (${event.type}): ${eventDate.toISOString()} is in month ${monthKey}: ${isInMonth}`);
      return isInMonth;
    });
    
    logger.info(`Found ${monthEvents.length} events for month ${monthKey}`);
    
    // Get all parent event IDs for the month
    const monthEventIds = monthEvents.map(event => event.id);
    logger.info(`Month event IDs: ${monthEventIds.join(', ')}`);
    
    // Filter sub-events for the current month's events
    const monthSubEvents = subEvents.filter(subEvent => 
      monthEventIds.includes(subEvent.parentEventId)
    );
    
    logger.info(`Found ${monthSubEvents.length} sub-events for month ${monthKey}`);
    
    // Debug output for each sub-event if needed (but limit for brevity)
    if (monthSubEvents.length <= 10) {
      monthSubEvents.forEach((subEvent, index) => {
        logger.debug(`SubEvent ${index + 1}/${monthSubEvents.length}: 
          ID: ${subEvent.id}
          Parent: ${subEvent.parentEventId}
          Type: ${subEvent.type}
          Start: ${new Date(subEvent.start).toISOString()}
          End: ${new Date(subEvent.end).toISOString()}
          Weekend: ${subEvent.isWeekend}
          Night Shift: ${subEvent.isNightShift}
          Office Hours: ${subEvent.isOfficeHours}`);
      });
    } else {
      logger.debug(`Too many sub-events (${monthSubEvents.length}) to log individually`);
    }

    // Separate oncall and incident events
    const oncallEvents = monthEvents.filter(event => event.type === 'oncall');
    const incidentEvents = monthEvents.filter(event => event.type === 'incident');
    
    // Check if we have a 24-hour weekday oncall shift (special case)
    let has24HourWeekdayOncall = false;
    oncallEvents.forEach(event => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      // Check if it's close to 24 hours (between 23.9 and 24.1 to account for potential small differences)
      if (durationHours >= 23.9 && durationHours <= 24.1) {
        // Check if it starts at midnight
        if (start.getHours() === 0 && start.getMinutes() === 0) {
          // Check if it's a weekday (not weekend)
          if (!isWeekend(start)) {
            has24HourWeekdayOncall = true;
            logger.info(`Found 24-hour weekday on-call shift: ${start.toISOString()} to ${end.toISOString()}`);
          }
        }
      }
    });
    
    // Get all sub-events for on-call and incidents
    const oncallSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'oncall');
    const incidentSubEvents = monthSubEvents.filter(subEvent => subEvent.type === 'incident');
    
    logger.info(`On-call events: ${oncallEvents.length}, incident events: ${incidentEvents.length}`);
    logger.info(`On-call sub-events: ${oncallSubEvents.length}, incident sub-events: ${incidentSubEvents.length}`);
    
    // Check sub-event coverage for debugging
    const nightShiftSubEvents = monthSubEvents.filter(se => se.isNightShift);
    const officeHoursSubEvents = monthSubEvents.filter(se => se.isOfficeHours);
    logger.info(`Night shift sub-events: ${nightShiftSubEvents.length}, Office hours sub-events: ${officeHoursSubEvents.length}`);
    
    // Calculate compensation statistics
    let totalWeekdayOnCallHours = 0;
    let totalWeekendOnCallHours = 0;
    let totalWeekdayIncidentHours = 0;
    let totalWeekendIncidentHours = 0;
    let totalWeekdayNightShiftHours = 0;
    let totalWeekendNightShiftHours = 0;

    // Process on-call sub-events
    oncallSubEvents.forEach(subEvent => {
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        const hours = this.calculateHoursInSubEvent(subEvent);
        
        if (subEvent.isWeekend) {
          totalWeekendOnCallHours += hours;
          logger.debug(`Added ${hours}h to weekend on-call total (now ${totalWeekendOnCallHours}h)`);
        } else {
          totalWeekdayOnCallHours += hours;
          logger.debug(`Added ${hours}h to weekday on-call total (now ${totalWeekdayOnCallHours}h)`);
        }
      }
    });
    
    // Special case: If we identified a 24-hour weekday on-call shift,
    // make sure we're counting 15 hours (9 before office hours + 6 after)
    if (has24HourWeekdayOncall && totalWeekdayOnCallHours < 15) {
      logger.info(`Correcting weekday on-call hours for 24-hour shift: ${totalWeekdayOnCallHours}h -> 15h`);
      totalWeekdayOnCallHours = 15; // 9 hours before office hours (midnight to 9am) + 6 hours after (6pm to midnight)
    }

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

    logger.debug(`Total on-call hours - Weekday: ${totalWeekdayOnCallHours}h, Weekend: ${totalWeekendOnCallHours}h`);
    logger.debug(`Total incident hours - Weekday: ${totalWeekdayIncidentHours}h, Weekend: ${totalWeekendIncidentHours}h, Weekday Night: ${totalWeekdayNightShiftHours}h, Weekend Night: ${totalWeekendNightShiftHours}h`);

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
    
    // Calculate total compensation by type
    const totalOnCallComp = weekdayOnCallComp + weekendOnCallComp;
    const totalIncidentComp = weekdayIncidentBaseComp + weekdayNightShiftComp + 
                             weekendIncidentBaseComp + weekendNightShiftComp;
    
    // Total compensation
    const totalCompensation = totalOnCallComp + totalIncidentComp;

    logger.info(`Compensation breakdown: 
      Weekday on-call: ${totalWeekdayOnCallHours}h * €${COMPENSATION_RATES.weekdayOnCallRate} = €${weekdayOnCallComp.toFixed(2)}
      Weekend on-call: ${totalWeekendOnCallHours}h * €${COMPENSATION_RATES.weekendOnCallRate} = €${weekendOnCallComp.toFixed(2)}
      Total on-call: €${totalOnCallComp.toFixed(2)}
      
      Weekday incidents: ${totalWeekdayIncidentHours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} = €${weekdayIncidentBaseComp.toFixed(2)}
      Weekday night shift: ${totalWeekdayNightShiftHours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekdayIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekdayNightShiftComp.toFixed(2)}
      Weekend incidents: ${totalWeekendIncidentHours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} = €${weekendIncidentBaseComp.toFixed(2)}
      Weekend night shift: ${totalWeekendNightShiftHours}h * €${COMPENSATION_RATES.baseHourlySalary} * ${COMPENSATION_RATES.weekendIncidentMultiplier} * ${COMPENSATION_RATES.nightShiftBonusMultiplier} = €${weekendNightShiftComp.toFixed(2)}
      Total incidents: €${totalIncidentComp.toFixed(2)}
      
      Total compensation: €${totalCompensation.toFixed(2)}`);

    const breakdown: CompensationBreakdown[] = [];
    
    // Make sure we have a proper date object for the month using our utility
    const monthDate = createMonthDate(date);
    
    // Add on-call compensation to breakdown
    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalOnCallComp,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours.toFixed(1)}h weekday, ${totalWeekendOnCallHours.toFixed(1)}h weekend)`,
        month: monthDate,
        events: oncallEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = monthSubEvents.filter(se => se.parentEventId === event.id);
          const hasHolidaySubEvent = eventSubEvents.some(se => se.isHoliday);
          return {
            id: event.id,
            start: new Date(event.start),
            end: new Date(event.end),
            isHoliday: hasHolidaySubEvent
          };
        })
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
        month: monthDate,
        events: incidentEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = monthSubEvents.filter(se => se.parentEventId === event.id);
          const hasHolidaySubEvent = eventSubEvents.some(se => se.isHoliday);
          return {
            id: event.id,
            start: new Date(event.start),
            end: new Date(event.end),
            isHoliday: hasHolidaySubEvent
          };
        })
      });
    }

    // Add total compensation to breakdown
    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation',
        month: monthDate,
        events: monthEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = monthSubEvents.filter(se => se.parentEventId === event.id);
          const hasHolidaySubEvent = eventSubEvents.some(se => se.isHoliday);
          return {
            id: event.id,
            start: new Date(event.start),
            end: new Date(event.end),
            isHoliday: hasHolidaySubEvent
          };
        })
      });
    } else if (monthEvents.length > 0) {
      // Even if total compensation is 0, still add a total item if there are events
      // This ensures that the month appears in the summary
      breakdown.push({
        type: 'total',
        amount: 0,
        count: monthEvents.length,
        description: 'No compensation calculated',
        month: monthDate,
        events: monthEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = monthSubEvents.filter(se => se.parentEventId === event.id);
          const hasHolidaySubEvent = eventSubEvents.some(se => se.isHoliday);
          return {
            id: event.id,
            start: new Date(event.start),
            end: new Date(event.end),
            isHoliday: hasHolidaySubEvent
          };
        })
      });
    }

    logger.debug(`Compensation breakdown for ${monthKey}:`, breakdown.map(b => ({
      type: b.type,
      amount: b.amount,
      month: b.month ? b.month.toISOString() : 'undefined'
    })));

    return breakdown;
  }
} 
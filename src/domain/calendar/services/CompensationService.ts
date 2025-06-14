import { CalendarEvent, EventTypes } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { COMPENSATION_RATES } from '../constants/CompensationRates';
import { isWeekend, getMonthKey, createMonthDate } from '../../../utils/calendarUtils';
import { logger } from '../../../utils/logger';

/**
 * Centralized service for all compensation calculations in the application
 */
export class CompensationService {
  // Cache storage for expensive calculations
  private cache: Map<string, { data: CompensationBreakdown[], timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
  
  /**
   * Clear the calculation cache
   * This should be called when events or sub-events are modified
   */
  public clearCache(): void {
    logger.info('Clearing CompensationService cache');
    this.cache.clear();
  }
  
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
    if (subEvent.type === EventTypes.INCIDENT) {
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
      // Incidents during office hours are not compensated
      return 0;
    }
    
    // For on-call shifts, also round up to the nearest hour
    if (subEvent.type === EventTypes.ONCALL) {
      // Only count non-office hours for on-call
      if (!subEvent.isOfficeHours || subEvent.isNightShift) {
        return Math.ceil(hours);
      }
      logger.debug(`On-call: Not counting ${hours}h (office hours)`);
      return 0;
    }
    
    return hours;
  }

  /**
   * Calculate monthly compensation breakdown from events and sub-events
   */
  calculateMonthlyCompensation(events: CalendarEvent[], subEvents: SubEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = getMonthKey(date);
    
    const cacheKey = this.generateCacheKey(events, subEvents, monthKey);
    
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < this.CACHE_TTL_MS) {
      logger.debug(`Using cached compensation data for ${monthKey}`);
      return cachedResult.data;
    }
    
    logger.info(`Calculating compensation for month: ${monthKey} using ${events.length} processed parent events.`);

    // Define month boundaries for sub-event filtering
    const year = date.getFullYear();
    const month = date.getMonth();
    // Note: month for Date constructor is 0-indexed
    const firstDayOfTargetMonth = new Date(year, month, 1, 0, 0, 0, 0);
    // Get last millisecond of the last day of the month
    const lastDayOfTargetMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Filter sub-events to those that actually overlap with the target month.
    // The `events` array is already processed by the facade for this month.
    // The `subEvents` array contains all sub-events for the parent `events`.
    const subEventsForMonth = subEvents.filter(subEvent => {
        const subStart = new Date(subEvent.start);
        const subEnd = new Date(subEvent.end);
        
        // Check for overlap:
        // Sub-event starts before or at the same time as month ends AND sub-event ends after or at the same time as month starts
        const overlaps = subStart <= lastDayOfTargetMonth && subEnd >= firstDayOfTargetMonth;
        
        return overlaps;
    });

    logger.info(`Filtered to ${subEventsForMonth.length} sub-events for month ${monthKey} based on strict date overlap.`);
    
    // Debug output for sub-events if needed
    if (subEventsForMonth.length > 0 && subEventsForMonth.length <= 10) { // Log details for a small number
        subEventsForMonth.forEach((subEvent, index) => {
            logger.debug(`Relevant SubEvent ${index + 1}/${subEventsForMonth.length} for ${monthKey}: 
            ID: ${subEvent.id}, Parent: ${subEvent.parentEventId}, Type: ${subEvent.type}, 
            Start: ${new Date(subEvent.start).toISOString()}, End: ${new Date(subEvent.end).toISOString()}`);
        });
    } else if (subEventsForMonth.length > 10) {
        logger.debug(`Found ${subEventsForMonth.length} relevant sub-events for month ${monthKey}.`);
    }


    // Separate oncall and incident events (using the already processed `events` from the facade)
    const oncallEvents = events.filter(event => event.type === EventTypes.ONCALL);
    const incidentEvents = events.filter(event => event.type === EventTypes.INCIDENT);
    
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
    
    // Get all sub-events for on-call and incidents from the *month-filtered* list
    const oncallSubEvents = subEventsForMonth.filter(subEvent => subEvent.type === EventTypes.ONCALL);
    const incidentSubEvents = subEventsForMonth.filter(subEvent => subEvent.type === EventTypes.INCIDENT);
    
    logger.info(`Using ${oncallEvents.length} on-call parent events and ${incidentEvents.length} incident parent events for month ${monthKey}.`);
    logger.info(`Processing ${oncallSubEvents.length} on-call sub-events and ${incidentSubEvents.length} incident sub-events for month ${monthKey}.`);
    
    // Check sub-event coverage for debugging
    const nightShiftSubEvents = subEventsForMonth.filter(se => se.isNightShift);
    const officeHoursSubEvents = subEventsForMonth.filter(se => se.isOfficeHours);
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
        } else {
          totalWeekdayOnCallHours += hours;
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

    logger.debug(`Compensation breakdown: 
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
        type: EventTypes.ONCALL,
        amount: totalOnCallComp,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours.toFixed(1)}h weekday, ${totalWeekendOnCallHours.toFixed(1)}h weekend)`,
        month: monthDate,
        events: oncallEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = subEventsForMonth.filter(se => se.parentEventId === event.id);
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
        type: EventTypes.INCIDENT,
        amount: totalIncidentComp,
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night, ${totalWeekendNightShiftHours}h weekend night)`,
        month: monthDate,
        events: incidentEvents.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = subEventsForMonth.filter(se => se.parentEventId === event.id);
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
        count: events.length,
        description: 'Total compensation',
        month: monthDate,
        events: events.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = subEventsForMonth.filter(se => se.parentEventId === event.id);
          const hasHolidaySubEvent = eventSubEvents.some(se => se.isHoliday);
          return {
            id: event.id,
            start: new Date(event.start),
            end: new Date(event.end),
            isHoliday: hasHolidaySubEvent
          };
        })
      });
    } else if (events.length > 0) {
      // Even if total compensation is 0, still add a total item if there are events
      // This ensures that the month appears in the summary
      breakdown.push({
        type: 'total',
        amount: 0,
        count: events.length,
        description: 'No compensation calculated',
        month: monthDate,
        events: events.map(event => {
          // Find if any sub-events for this event are holidays
          const eventSubEvents = subEventsForMonth.filter(se => se.parentEventId === event.id);
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

    // Store result in cache
    this.cache.set(cacheKey, {
      data: breakdown,
      timestamp: Date.now()
    });

    return breakdown;
  }
  
  /**
   * Generate a cache key based on events, sub-events, and month
   */
  private generateCacheKey(events: CalendarEvent[], subEvents: SubEvent[], monthKey: string): string {
    // Include the event IDs in the cache key
    const eventsHash = events.map(e => e.id).sort().join(',');
    const subEventsHash = subEvents.map(se => se.id).sort().join(',');
    
    // Using the full hash of IDs for a more reliable cache key
    return `${monthKey}:${eventsHash}:${subEventsHash}`;
  }
} 
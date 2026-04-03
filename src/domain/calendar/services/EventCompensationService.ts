import { CalendarEvent, EventTypes } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationSummary, HoursSummary, CompensationDetail, MonthlyCompensation } from '../types/CompensationSummary';
import { COMPENSATION_RATES } from '../constants/CompensationRates';
import { getMonthKey } from '../../../utils/calendarUtils';
import { logger } from '../../../utils/logger';
import { calculateBillableHours } from './compensationHelpers';

/**
 * Service for generating detailed compensation summaries for calendar events
 */
export class EventCompensationService {
  private static instance: EventCompensationService;

  private constructor() {}

  public static getInstance(): EventCompensationService {
    if (!EventCompensationService.instance) {
      EventCompensationService.instance = new EventCompensationService();
    }
    return EventCompensationService.instance;
  }

  public calculateEventCompensation(event: CalendarEvent, subEvents: SubEvent[], baseHourlySalary?: number): CompensationSummary {
    logger.debug(`Calculating detailed compensation for event ${event.id}`);
    
    // Filter sub-events that belong to this event
    const eventSubEvents = subEvents.filter(subEvent => subEvent.parentEventId === event.id);
    
    if (eventSubEvents.length === 0) {
      logger.warn(`No sub-events found for event ${event.id}`);
      return this.createEmptyCompensationSummary(event.id);
    }

    // Calculate hours summary
    const hours = this.calculateHoursSummary(event, eventSubEvents);
    
    const details = this.calculateCompensationDetails(event, eventSubEvents, baseHourlySalary);
    
    // Calculate total compensation
    const total = details.reduce((sum, detail) => sum + detail.amount, 0);
    
    // Check if this event spans multiple months
    const monthlyBreakdown = this.calculateMonthlyBreakdown(event, eventSubEvents);
    
    const summary: CompensationSummary = {
      eventId: event.id,
      hours,
      details,
      total
    };
    
    // Only include monthlyBreakdown if the event spans multiple months
    if (monthlyBreakdown.length > 1) {
      summary.monthlyBreakdown = monthlyBreakdown;
    }
    
    return summary;
  }

  /**
   * Create an empty compensation summary for events with no sub-events
   */
  private createEmptyCompensationSummary(eventId: string): CompensationSummary {
    return {
      eventId,
      total: 0,
      hours: {
        total: 0,
        billable: 0,
        weekday: 0,
        weekend: 0,
        nightShift: 0,
        officeHours: 0
      },
      details: []
    };
  }

  /**
   * Calculate a summary of hours for the event
   */
  private calculateHoursSummary(event: CalendarEvent, subEvents: SubEvent[]): HoursSummary {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    let billableHours = 0;
    let weekdayHours = 0;
    let weekendHours = 0;
    let nightShiftHours = 0;
    let officeHours = 0;
    
    // Sum up hours from sub-events
    subEvents.forEach(subEvent => {
      const subEventStart = new Date(subEvent.start);
      const subEventEnd = new Date(subEvent.end);
      const hours = (subEventEnd.getTime() - subEventStart.getTime()) / (1000 * 60 * 60);
      
      // For incidents, only hours outside office hours, on weekends or night shifts are billable
      if (subEvent.type === EventTypes.INCIDENT && (!subEvent.isOfficeHours || subEvent.isWeekend || subEvent.isNightShift)) {
        billableHours += hours;
      } 
      // For on-call, only non-office hours are billable
      else if (subEvent.type === EventTypes.ONCALL && (!subEvent.isOfficeHours || subEvent.isNightShift)) {
        billableHours += hours;
      }
      
      // Categorize by day type
      if (subEvent.isWeekend) {
        weekendHours += hours;
      } else {
        weekdayHours += hours;
      }
      
      // Categorize by time of day
      if (subEvent.isNightShift) {
        nightShiftHours += hours;
      }
      
      // Track office hours
      if (subEvent.isOfficeHours && !subEvent.isNightShift) {
        officeHours += hours;
      }
    });
    
    return {
      total: totalHours,
      billable: billableHours,
      weekday: weekdayHours,
      weekend: weekendHours,
      nightShift: nightShiftHours,
      officeHours: officeHours
    };
  }

  private calculateCompensationDetails(event: CalendarEvent, subEvents: SubEvent[], baseHourlySalary?: number): CompensationDetail[] {
    const details: CompensationDetail[] = [];
    const effectiveRate = baseHourlySalary ?? COMPENSATION_RATES.baseHourlySalary;
    
    const oncallWeekday = subEvents.filter(se => se.type === EventTypes.ONCALL && !se.isWeekend && (!se.isOfficeHours || se.isNightShift));
    const oncallWeekend = subEvents.filter(se => se.type === EventTypes.ONCALL && se.isWeekend);
    const incidentWeekday = subEvents.filter(se => se.type === EventTypes.INCIDENT && !se.isWeekend && !se.isNightShift);
    const incidentWeekdayNight = subEvents.filter(se => se.type === EventTypes.INCIDENT && !se.isWeekend && se.isNightShift);
    const incidentWeekend = subEvents.filter(se => se.type === EventTypes.INCIDENT && se.isWeekend && !se.isNightShift);
    const incidentWeekendNight = subEvents.filter(se => se.type === EventTypes.INCIDENT && se.isWeekend && se.isNightShift);
    
    if (oncallWeekday.length > 0) {
      const hours = this.sumSubEventHours(oncallWeekday);
      details.push({
        hours,
        rate: COMPENSATION_RATES.weekdayOnCallRate,
        amount: hours * COMPENSATION_RATES.weekdayOnCallRate,
        description: 'Weekday On-Call'
      });
    }
    
    if (oncallWeekend.length > 0) {
      const hours = this.sumSubEventHours(oncallWeekend);
      details.push({
        hours,
        rate: COMPENSATION_RATES.weekendOnCallRate,
        amount: hours * COMPENSATION_RATES.weekendOnCallRate,
        description: 'Weekend On-Call'
      });
    }
    
    if (incidentWeekday.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekday);
      details.push({
        hours,
        rate: effectiveRate,
        multiplier: COMPENSATION_RATES.weekdayIncidentMultiplier,
        amount: hours * effectiveRate * COMPENSATION_RATES.weekdayIncidentMultiplier,
        description: 'Weekday Incident'
      });
    }
    
    if (incidentWeekdayNight.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekdayNight);
      details.push({
        hours,
        rate: effectiveRate,
        multiplier: COMPENSATION_RATES.weekdayIncidentMultiplier,
        nightShiftMultiplier: COMPENSATION_RATES.nightShiftBonusMultiplier,
        amount: hours * effectiveRate * 
                COMPENSATION_RATES.weekdayIncidentMultiplier * 
                COMPENSATION_RATES.nightShiftBonusMultiplier,
        description: 'Weekday Night Incident'
      });
    }
    
    if (incidentWeekend.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekend);
      details.push({
        hours,
        rate: effectiveRate,
        multiplier: COMPENSATION_RATES.weekendIncidentMultiplier,
        amount: hours * effectiveRate * COMPENSATION_RATES.weekendIncidentMultiplier,
        description: 'Weekend Incident'
      });
    }
    
    if (incidentWeekendNight.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekendNight);
      details.push({
        hours,
        rate: effectiveRate,
        multiplier: COMPENSATION_RATES.weekendIncidentMultiplier,
        nightShiftMultiplier: COMPENSATION_RATES.nightShiftBonusMultiplier,
        amount: hours * effectiveRate * 
                COMPENSATION_RATES.weekendIncidentMultiplier * 
                COMPENSATION_RATES.nightShiftBonusMultiplier,
        description: 'Weekend Night Incident'
      });
    }
    
    return details;
  }

  /**
   * Calculate monthly breakdown for events that span multiple months
   */
  private calculateMonthlyBreakdown(event: CalendarEvent, subEvents: SubEvent[]): MonthlyCompensation[] {
    // Group sub-events by month
    const subEventsByMonth: Record<string, SubEvent[]> = {};
    
    subEvents.forEach(subEvent => {
      const monthKey = getMonthKey(new Date(subEvent.start));
      if (!subEventsByMonth[monthKey]) {
        subEventsByMonth[monthKey] = [];
      }
      subEventsByMonth[monthKey].push(subEvent);
    });
    
    // Calculate compensation for each month
    const monthlyBreakdown: MonthlyCompensation[] = [];
    
    for (const [month, monthSubEvents] of Object.entries(subEventsByMonth)) {
      const details = this.calculateCompensationDetails(event, monthSubEvents);
      const amount = details.reduce((sum, detail) => sum + detail.amount, 0);
      
      monthlyBreakdown.push({
        month,
        amount,
        details
      });
    }
    
    return monthlyBreakdown;
  }

  private sumSubEventHours(subEvents: SubEvent[]): number {
    return subEvents.reduce((sum, subEvent) => sum + calculateBillableHours(subEvent), 0);
  }
} 
import { CalendarEvent, EventTypes } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationSummary, HoursSummary, CompensationDetail, MonthlyCompensation } from '../types/CompensationSummary';
import { COMPENSATION_RATES } from '../constants/CompensationRates';
import { getMonthKey } from '../../../utils/calendarUtils';
import { logger } from '../../../utils/logger';

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

  /**
   * Calculate a detailed compensation summary for a single event
   */
  public calculateEventCompensation(event: CalendarEvent, subEvents: SubEvent[]): CompensationSummary {
    logger.debug(`Calculating detailed compensation for event ${event.id}`);
    
    // Filter sub-events that belong to this event
    const eventSubEvents = subEvents.filter(subEvent => subEvent.parentEventId === event.id);
    
    if (eventSubEvents.length === 0) {
      logger.warn(`No sub-events found for event ${event.id}`);
      return this.createEmptyCompensationSummary(event.id);
    }

    // Calculate hours summary
    const hours = this.calculateHoursSummary(event, eventSubEvents);
    
    // Calculate compensation details
    const details = this.calculateCompensationDetails(event, eventSubEvents);
    
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

  /**
   * Calculate detailed compensation breakdown for the event
   */
  private calculateCompensationDetails(event: CalendarEvent, subEvents: SubEvent[]): CompensationDetail[] {
    const details: CompensationDetail[] = [];
    
    // Group sub-events by type and category
    const oncallWeekday = subEvents.filter(se => se.type === EventTypes.ONCALL && !se.isWeekend && (!se.isOfficeHours || se.isNightShift));
    const oncallWeekend = subEvents.filter(se => se.type === EventTypes.ONCALL && se.isWeekend);
    const incidentWeekday = subEvents.filter(se => se.type === EventTypes.INCIDENT && !se.isWeekend && !se.isNightShift);
    const incidentWeekdayNight = subEvents.filter(se => se.type === EventTypes.INCIDENT && !se.isWeekend && se.isNightShift);
    const incidentWeekend = subEvents.filter(se => se.type === EventTypes.INCIDENT && se.isWeekend && !se.isNightShift);
    const incidentWeekendNight = subEvents.filter(se => se.type === EventTypes.INCIDENT && se.isWeekend && se.isNightShift);
    
    // Calculate on-call weekday compensation
    if (oncallWeekday.length > 0) {
      const hours = this.sumSubEventHours(oncallWeekday);
      details.push({
        hours,
        rate: COMPENSATION_RATES.weekdayOnCallRate,
        amount: hours * COMPENSATION_RATES.weekdayOnCallRate,
        description: 'Weekday On-Call'
      });
    }
    
    // Calculate on-call weekend compensation
    if (oncallWeekend.length > 0) {
      const hours = this.sumSubEventHours(oncallWeekend);
      details.push({
        hours,
        rate: COMPENSATION_RATES.weekendOnCallRate,
        amount: hours * COMPENSATION_RATES.weekendOnCallRate,
        description: 'Weekend On-Call'
      });
    }
    
    // Calculate incident weekday compensation
    if (incidentWeekday.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekday);
      details.push({
        hours,
        rate: COMPENSATION_RATES.baseHourlySalary,
        multiplier: COMPENSATION_RATES.weekdayIncidentMultiplier,
        amount: hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier,
        description: 'Weekday Incident'
      });
    }
    
    // Calculate incident weekday night shift compensation
    if (incidentWeekdayNight.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekdayNight);
      details.push({
        hours,
        rate: COMPENSATION_RATES.baseHourlySalary,
        multiplier: COMPENSATION_RATES.weekdayIncidentMultiplier,
        nightShiftMultiplier: COMPENSATION_RATES.nightShiftBonusMultiplier,
        amount: hours * COMPENSATION_RATES.baseHourlySalary * 
                COMPENSATION_RATES.weekdayIncidentMultiplier * 
                COMPENSATION_RATES.nightShiftBonusMultiplier,
        description: 'Weekday Night Incident'
      });
    }
    
    // Calculate incident weekend compensation
    if (incidentWeekend.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekend);
      details.push({
        hours,
        rate: COMPENSATION_RATES.baseHourlySalary,
        multiplier: COMPENSATION_RATES.weekendIncidentMultiplier,
        amount: hours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier,
        description: 'Weekend Incident'
      });
    }
    
    // Calculate incident weekend night shift compensation
    if (incidentWeekendNight.length > 0) {
      const hours = this.sumSubEventHours(incidentWeekendNight);
      details.push({
        hours,
        rate: COMPENSATION_RATES.baseHourlySalary,
        multiplier: COMPENSATION_RATES.weekendIncidentMultiplier,
        nightShiftMultiplier: COMPENSATION_RATES.nightShiftBonusMultiplier,
        amount: hours * COMPENSATION_RATES.baseHourlySalary * 
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

  /**
   * Helper method to sum hours across sub-events with proper rounding
   */
  private sumSubEventHours(subEvents: SubEvent[]): number {
    return subEvents.reduce((sum, subEvent) => {
      const start = new Date(subEvent.start);
      const end = new Date(subEvent.end);
      const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      // Skip incidents during office hours (not billable)
      if (subEvent.type === EventTypes.INCIDENT && subEvent.isOfficeHours && !subEvent.isWeekend && !subEvent.isNightShift) {
        return sum;
      }
      
      // Round up to the nearest hour for compensation calculations
      let hours = Math.ceil(rawHours);
      
      return sum + hours;
    }, 0);
  }
} 
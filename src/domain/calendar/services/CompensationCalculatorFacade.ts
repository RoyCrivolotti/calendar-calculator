import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationService } from './CompensationService';
import { storageService } from '../../../presentation/services/storage';
import { logger } from '../../../utils/logger';
import { getMonthKey, createMonthDate, isSameMonth } from '../../../utils/calendarUtils';
import { EventCompensationService } from './EventCompensationService';
import { CompensationSummary } from '../types/CompensationSummary';

/**
 * Facade for compensation calculations to ensure consistent results across the application
 * This class coordinates data loading and calculation to avoid race conditions
 */
export class CompensationCalculatorFacade {
  private static instance: CompensationCalculatorFacade;
  private compensationService: CompensationService;
  private eventCompensationService: EventCompensationService;
  
  private constructor() {
    this.compensationService = new CompensationService();
    this.eventCompensationService = EventCompensationService.getInstance();
  }
  
  /**
   * Get the singleton instance of the facade
   */
  public static getInstance(): CompensationCalculatorFacade {
    if (!this.instance) {
      this.instance = new CompensationCalculatorFacade();
    }
    return this.instance;
  }
  
  /**
   * Check if an event spans across months
   * @param event The event to check
   * @returns True if the event spans multiple months
   */
  private eventSpansAcrossMonths(event: CalendarEvent): boolean {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return getMonthKey(start) !== getMonthKey(end);
  }

  /**
   * Determine if an event belongs to a specific month, either fully or partially
   * @param event The event to check
   * @param monthKey The month key in format YYYY-M
   * @returns True if the event belongs to the month
   */
  private eventBelongsToMonth(event: CalendarEvent, monthKey: string): boolean {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startMonthKey = getMonthKey(start);
    const endMonthKey = getMonthKey(end);
    
    // Event belongs to this month if either start or end date is in this month
    return startMonthKey === monthKey || endMonthKey === monthKey;
  }
  
  /**
   * Split an event that spans across months into month-specific parts
   * @param event The event to split
   * @param targetMonthKey The month key we're interested in
   * @returns A new event that only covers the portion in the target month
   */
  private splitEventForMonth(event: CalendarEvent, targetMonthKey: string): CalendarEvent {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startMonthKey = getMonthKey(start);
    const endMonthKey = getMonthKey(end);
    
    // Create a copy of the event
    const eventCopy = new CalendarEvent({
      ...event.toJSON(),
      start: new Date(start),
      end: new Date(end)
    });
    
    // If the event starts before the target month, adjust the start date
    if (startMonthKey !== targetMonthKey) {
      const [year, month] = targetMonthKey.split('-').map(Number);
      const firstDayOfMonth = new Date(year, month - 1, 1, 0, 0, 0);
      eventCopy.start = firstDayOfMonth;
      logger.info(`Adjusted cross-month event start date to beginning of month ${targetMonthKey}`);
    }
    
    // If the event ends after the target month, adjust the end date
    if (endMonthKey !== targetMonthKey) {
      const [year, month] = targetMonthKey.split('-').map(Number);
      // Set to the first day of next month at 00:00:00
      const firstDayOfNextMonth = new Date(year, month, 1, 0, 0, 0);
      eventCopy.end = firstDayOfNextMonth;
      logger.info(`Adjusted cross-month event end date to end of month ${targetMonthKey}`);
    }
    
    return eventCopy;
  }
  
  /**
   * Filter sub-events that belong to a specific month
   */
  private filterSubEventsByMonth(subEvents: SubEvent[], monthKey: string): SubEvent[] {
    return subEvents.filter(subEvent => {
      const subEventStart = new Date(subEvent.start);
      const subEventMonthKey = getMonthKey(subEventStart);
      return subEventMonthKey === monthKey;
    });
  }
  
  /**
   * Calculate compensation breakdown for a specific month
   * This method ensures sub-events are loaded before calculation
   * and properly handles events that span across month boundaries
   */
  public async calculateMonthlyCompensation(
    events: CalendarEvent[],
    date: Date
  ): Promise<CompensationBreakdown[]> {
    try {
      const monthKey = getMonthKey(date);
      logger.info(`Calculating compensation via facade for month: ${monthKey}`);
      
      // Filter events that belong to the current month (either start or end in this month)
      const relevantEvents = events.filter(event => this.eventBelongsToMonth(event, monthKey));
      
      if (relevantEvents.length === 0) {
        logger.info(`No events found for month ${monthKey}`);
        return [];
      }
      
      // Process events to handle cross-month events
      const monthEvents: CalendarEvent[] = [];
      
      for (const event of relevantEvents) {
        if (this.eventSpansAcrossMonths(event)) {
          logger.info(`Event ${event.id} spans across months, splitting for month ${monthKey}`);
          const splitEvent = this.splitEventForMonth(event, monthKey);
          monthEvents.push(splitEvent);
        } else {
          monthEvents.push(event);
        }
      }
      
      logger.info(`Processed ${monthEvents.length} events for month ${monthKey}`);
      
      // Load all sub-events from storage
      const allSubEvents = await storageService.loadSubEvents();
      logger.info(`Loaded ${allSubEvents.length} sub-events for calculation`);
      
      // Get relevant event IDs
      const eventIds = monthEvents.map(event => event.id);
      
      // First filter sub-events by parent event ID
      const eventSubEvents = allSubEvents.filter(subEvent => 
        eventIds.includes(subEvent.parentEventId)
      );
      
      // Then filter sub-events by month
      const relevantSubEvents = this.filterSubEventsByMonth(eventSubEvents, monthKey);
      
      logger.info(`Found ${relevantSubEvents.length} relevant sub-events for month ${monthKey}`);
      
      // Calculate compensation
      const breakdown = this.compensationService.calculateMonthlyCompensation(
        monthEvents, 
        relevantSubEvents,
        date
      );
      
      return breakdown;
    } catch (error) {
      logger.error('Error in compensation calculation facade:', error);
      return [];
    }
  }

  /**
   * Calculate detailed compensation summary for a specific event
   * @param event The event to calculate compensation for
   * @returns A detailed compensation summary
   */
  public async calculateEventCompensation(event: CalendarEvent): Promise<CompensationSummary> {
    try {
      logger.info(`Calculating detailed compensation for event ${event.id}`);
      
      // Load all sub-events from storage
      const allSubEvents = await storageService.loadSubEvents();
      
      // Filter sub-events for this event
      const eventSubEvents = allSubEvents.filter(subEvent => 
        subEvent.parentEventId === event.id
      );
      
      logger.info(`Found ${eventSubEvents.length} sub-events for event ${event.id}`);
      
      // Calculate compensation summary
      const summary = this.eventCompensationService.calculateEventCompensation(
        event,
        eventSubEvents
      );
      
      return summary;
    } catch (error) {
      logger.error(`Error calculating compensation for event ${event.id}:`, error);
      return {
        eventId: event.id,
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
  }
} 
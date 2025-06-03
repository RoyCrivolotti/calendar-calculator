import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationService } from './CompensationService';
import { SubEventRepository } from '../repositories/SubEventRepository';
import { CalendarEventRepository } from '../repositories/CalendarEventRepository';
import { logger } from '../../../utils/logger';
import { getMonthKey } from '../../../utils/calendarUtils';
import { EventCompensationService } from './EventCompensationService';
import { CompensationSummary } from '../types/CompensationSummary';
import { HolidayChecker } from './HolidayChecker';

/**
 * Facade for compensation calculations to ensure consistent results across the application
 * This class coordinates data loading and calculation to avoid race conditions
 */
export class CompensationCalculatorFacade {
  private static instance: CompensationCalculatorFacade;
  private compensationService: CompensationService;
  private eventCompensationService: EventCompensationService;
  private eventRepository: CalendarEventRepository;
  private subEventRepository: SubEventRepository;
  
  private constructor(eventRepository: CalendarEventRepository, subEventRepository: SubEventRepository) {
    this.compensationService = new CompensationService();
    this.eventCompensationService = EventCompensationService.getInstance();
    this.eventRepository = eventRepository;
    this.subEventRepository = subEventRepository;
  }
  
  /**
   * Get the singleton instance of the facade
   */
  public static getInstance(
    eventRepository: CalendarEventRepository,
    subEventRepository: SubEventRepository
  ): CompensationCalculatorFacade {
    if (!this.instance) {
      this.instance = new CompensationCalculatorFacade(eventRepository, subEventRepository);
    } else if (this.instance.subEventRepository !== subEventRepository || 
               this.instance.eventRepository !== eventRepository) {
      logger.warn('CompensationCalculatorFacade.getInstance called with new Repositories. Re-initializing.');
      this.instance = new CompensationCalculatorFacade(eventRepository, subEventRepository);
    }
    return this.instance;
  }
  
  /**
   * Clear all calculation caches
   * Call this when events or sub-events are modified
   */
  public clearCaches(): void {
    logger.info('Clearing all compensation calculation caches');
    this.compensationService.clearCache();
    HolidayChecker.clearCache();
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
    date: Date | string, // Allow string for flexibility from callers
    allDomainEvents?: CalendarEvent[],
    allDomainSubEvents?: SubEvent[]
  ): Promise<CompensationBreakdown[]> {
    try {
      const actualDateObject = date instanceof Date ? date : new Date(date);
      const monthKey = getMonthKey(actualDateObject);
      logger.info(`Calculating compensation via facade for month: ${monthKey} (input date type: ${typeof date})`);

      let eventsForMonthCalculation: CalendarEvent[];
      let subEventsForCalculation: SubEvent[];

      if (allDomainEvents && allDomainSubEvents) {
        logger.debug(`Using pre-fetched domain events (${allDomainEvents.length}) and sub-events (${allDomainSubEvents.length}) for month ${monthKey}`);
        // Filter pre-fetched events for the current month
        eventsForMonthCalculation = allDomainEvents.filter(event => {
          const calEvent = event instanceof CalendarEvent ? event : new CalendarEvent(event as any);
          return this.eventBelongsToMonth(calEvent, monthKey);
        });
        
        if (eventsForMonthCalculation.length === 0) {
          logger.info(`No pre-fetched events belong to month ${monthKey}`);
          return [];
        }

        const relevantParentEventIds = eventsForMonthCalculation.map(e => e.id);
        // Filter pre-fetched sub-events by parent ID and then by month
        const subEventsForRelevantParents = allDomainSubEvents.filter(subEvent => 
          relevantParentEventIds.includes(subEvent.parentEventId)
        );
        subEventsForCalculation = this.filterSubEventsByMonth(subEventsForRelevantParents, monthKey);
        logger.debug(`Filtered to ${eventsForMonthCalculation.length} parent events and ${subEventsForCalculation.length} sub-events for month ${monthKey} from pre-fetched data.`);

      } else {
        logger.debug(`Fetching events and sub-events from repositories for month ${monthKey}`);
        const year = actualDateObject.getFullYear(); // Use actualDateObject
        const month = actualDateObject.getMonth(); // Use actualDateObject
        const firstDayOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
        const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

        logger.debug(`Fetching parent events for range: ${firstDayOfMonth.toISOString()} - ${lastDayOfMonth.toISOString()}`);
        const fetchedParentEvents = await this.eventRepository.getEventsForDateRange(firstDayOfMonth, lastDayOfMonth);
        logger.debug(`Fetched ${fetchedParentEvents.length} parent events for month ${monthKey}`);
        
        if (fetchedParentEvents.length === 0) {
          logger.info(`No events found for month ${monthKey} via repository.`);
          return [];
        }
        eventsForMonthCalculation = fetchedParentEvents;

        const eventIds = eventsForMonthCalculation.map(event => event.id);
        logger.debug(`Fetching sub-events for ${eventIds.length} parent event IDs.`);
        subEventsForCalculation = await this.subEventRepository.getSubEventsForEventIds(eventIds);
        logger.info(`Loaded ${subEventsForCalculation.length} sub-events for the fetched parent events.`);
      }
      
      // Process events to handle cross-month events (applies to both paths)
      const processedMonthEvents: CalendarEvent[] = [];
      for (const event of eventsForMonthCalculation) {
        const calendarEventInstance = event instanceof CalendarEvent ? event : new CalendarEvent(event as any);
        // Ensure dates are Date objects for eventSpansAcrossMonths and splitEventForMonth
        calendarEventInstance.start = new Date(calendarEventInstance.start);
        calendarEventInstance.end = new Date(calendarEventInstance.end);

        if (this.eventSpansAcrossMonths(calendarEventInstance)) {
          const eventStartMonthKey = getMonthKey(calendarEventInstance.start);
          const eventEndMonthKey = getMonthKey(calendarEventInstance.end);
          // Use actualDateObject for year/month of the *target* month for splitting range
          const targetYear = actualDateObject.getFullYear();
          const targetMonth = actualDateObject.getMonth();
          const firstDayOfTargetMonth = new Date(targetYear, targetMonth, 1);
          const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

          // Check if the event actually overlaps with the target month before splitting
          if (calendarEventInstance.start <= lastDayOfTargetMonth && calendarEventInstance.end >= firstDayOfTargetMonth) {
            logger.info(`Event ${calendarEventInstance.id} spans across months, splitting for month ${monthKey}`);
            const splitEvent = this.splitEventForMonth(calendarEventInstance, monthKey);
            processedMonthEvents.push(splitEvent);
          } else {
            logger.warn(`Event ${calendarEventInstance.id} (originally from ${eventStartMonthKey} to ${eventEndMonthKey}) was considered but does not overlap with target month ${monthKey}, skipping.`);
          }
        } else {
          const eventActualMonthKey = getMonthKey(calendarEventInstance.start);
          if (eventActualMonthKey === monthKey) {
            processedMonthEvents.push(calendarEventInstance);
          } else {
            logger.warn(`Non-spanning event ${calendarEventInstance.id} (month ${eventActualMonthKey}) is not in target month ${monthKey}, skipping.`);
          }
        }
      }
      logger.info(`Processed ${processedMonthEvents.length} events for month ${monthKey} after filtering/splitting.`);
      if (processedMonthEvents.length === 0) {
        logger.info(`No relevant events for month ${monthKey} after full processing.`);
        return [];
      }
      
      // If using pre-fetched sub-events, they are already filtered by month and parent ID.
      // If fetched from repo, subEventsForCalculation are for the parent events, but might need further month filtering 
      // if a parent event (post-split) is shorter than its original sub-events extent.
      // However, compensationService.calculateMonthlyCompensation takes the date and should handle this fine.
      const finalSubEventsForService = subEventsForCalculation;

      const breakdown = this.compensationService.calculateMonthlyCompensation(
        processedMonthEvents, 
        finalSubEventsForService,
        actualDateObject // Pass the Date object to the service
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
      
      // Load sub-events for the specific parent event ID
      const eventSubEvents = await this.subEventRepository.getByParentId(event.id);
      
      logger.info(`Found ${eventSubEvents.length} sub-events for event ${event.id} from Firestore`);
      
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
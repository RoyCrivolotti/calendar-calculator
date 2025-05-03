import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { CompensationService } from './CompensationService';
import { storageService } from '../../../presentation/services/storage';
import { logger } from '../../../utils/logger';
import { getMonthKey, createMonthDate } from '../../../utils/calendarUtils';

/**
 * Facade for compensation calculations to ensure consistent results across the application
 * This class coordinates data loading and calculation to avoid race conditions
 */
export class CompensationCalculatorFacade {
  private static instance: CompensationCalculatorFacade;
  private compensationService: CompensationService;
  
  private constructor() {
    this.compensationService = new CompensationService();
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
   * Calculate compensation breakdown for a specific month
   * This method ensures sub-events are loaded before calculation
   */
  public async calculateMonthlyCompensation(
    events: CalendarEvent[],
    date: Date
  ): Promise<CompensationBreakdown[]> {
    try {
      const monthKey = getMonthKey(date);
      logger.info(`Calculating compensation via facade for month: ${monthKey}`);
      
      // Filter events for the current month
      const monthEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        const eventMonthKey = getMonthKey(eventDate);
        return eventMonthKey === monthKey;
      });
      
      if (monthEvents.length === 0) {
        logger.info(`No events found for month ${monthKey}`);
        return [];
      }
      
      // Load all sub-events from storage
      const allSubEvents = await storageService.loadSubEvents();
      logger.info(`Loaded ${allSubEvents.length} sub-events for calculation`);
      
      // Get relevant event IDs
      const eventIds = monthEvents.map(event => event.id);
      
      // Filter sub-events for the current month's events
      const relevantSubEvents = allSubEvents.filter(subEvent => 
        eventIds.includes(subEvent.parentEventId)
      );
      
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
} 
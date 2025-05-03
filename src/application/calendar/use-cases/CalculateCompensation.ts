import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { CompensationService } from '../../../domain/calendar/services/CompensationService';
import { logger } from '../../../utils/logger';
import { createMonthDate } from '../../../utils/calendarUtils';

/**
 * Use case for calculating compensation based on events and sub-events
 * This centralizes the compensation calculation logic and ensures consistency
 */
export class CalculateCompensationUseCase {
  private compensationService: CompensationService;

  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {
    this.compensationService = new CompensationService();
  }

  /**
   * Calculate compensation breakdown for the specified month
   * @param date - Date within the month to calculate compensation for
   * @returns Array of compensation breakdown objects
   */
  async execute(date?: Date): Promise<CompensationBreakdown[]> {
    const currentDate = date || new Date();
    
    try {
      logger.info(`Calculating compensation for month: ${currentDate.toISOString()}`);
      
      const events = await this.eventRepository.getAll();
      logger.info(`Loaded ${events.length} total events`);
      
      const subEvents = await this.subEventRepository.getAll();
      logger.info(`Loaded ${subEvents.length} total sub-events`);
      
      const result = this.compensationService.calculateMonthlyCompensation(events, subEvents, currentDate);
      
      // Ensure the month property is set on all breakdown items
      const resultsWithMonth = result.map(item => {
        if (!item.month) {
          // Create a standardized month date (first day of month at midnight)
          const monthDate = createMonthDate(currentDate);
          
          return {
            ...item,
            month: monthDate
          };
        }
        return item;
      });
      
      logger.info(`Calculated ${resultsWithMonth.length} compensation breakdown items`);
      
      return resultsWithMonth;
    } catch (error) {
      logger.error('Error in CalculateCompensationUseCase:', error);
      throw error;
    }
  }
} 
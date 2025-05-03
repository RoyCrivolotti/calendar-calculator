import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { CompensationService } from '../../../domain/calendar/services/CompensationService';

export class CalculateCompensationUseCase {
  private compensationService: CompensationService;

  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {
    this.compensationService = new CompensationService();
  }

  async execute(date?: Date): Promise<CompensationBreakdown[]> {
    const currentDate = date || new Date();
    
    try {
      console.log(`Calculating compensation for month: ${currentDate.toISOString()}`);
      
      const events = await this.eventRepository.getAll();
      console.log(`Loaded ${events.length} total events`);
      
      const subEvents = await this.subEventRepository.getAll();
      console.log(`Loaded ${subEvents.length} total sub-events`);
      
      const result = this.compensationService.calculateMonthlyCompensation(events, subEvents, currentDate);
      
      // Ensure the month property is set on all breakdown items
      const resultsWithMonth = result.map(item => {
        if (!item.month) {
          // Create a standardized month date (first day of month at midnight)
          const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          monthDate.setHours(0, 0, 0, 0);
          
          return {
            ...item,
            month: monthDate
          };
        }
        return item;
      });
      
      console.log(`Calculated ${resultsWithMonth.length} compensation breakdown items`);
      
      return resultsWithMonth;
    } catch (error) {
      console.error('Error in CalculateCompensationUseCase:', error);
      throw error;
    }
  }
} 
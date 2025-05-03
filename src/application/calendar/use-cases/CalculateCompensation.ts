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
    const events = await this.eventRepository.getAll();
    const subEvents = await this.subEventRepository.getAll();
    
    return this.compensationService.calculateMonthlyCompensation(events, subEvents, date || new Date());
  }
} 
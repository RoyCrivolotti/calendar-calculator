import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { SubEventCompensationCalculator } from '../../../domain/calendar/services/SubEventCompensationCalculator';

export class CalculateCompensationUseCase {
  private calculator: SubEventCompensationCalculator;

  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {
    this.calculator = new SubEventCompensationCalculator();
  }

  async execute(date?: Date): Promise<CompensationBreakdown[]> {
    const events = await this.eventRepository.getAll();
    const subEvents = await this.subEventRepository.getAll();
    
    return this.calculator.calculateMonthlyCompensation(events, subEvents, date || new Date());
  }
} 
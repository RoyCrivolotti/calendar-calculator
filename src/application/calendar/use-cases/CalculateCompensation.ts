import { CompensationBreakdown } from '../../../domain/calendar/entities/CompensationBreakdown';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { CompensationCalculator } from '../../../domain/calendar/services/CompensationCalculator';

export class CalculateCompensationUseCase {
  private calculator: CompensationCalculator;

  constructor(private eventRepository: CalendarEventRepository) {
    this.calculator = new CompensationCalculator();
  }

  async execute(date?: Date): Promise<CompensationBreakdown[]> {
    const events = await this.eventRepository.getAll();
    return this.calculator.calculateMonthlyCompensation(events, date);
  }
} 
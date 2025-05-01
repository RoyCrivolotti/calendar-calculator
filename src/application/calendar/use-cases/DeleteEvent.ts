import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';

export class DeleteEventUseCase {
  constructor(private eventRepository: CalendarEventRepository) {}
 
  async execute(id: string): Promise<void> {
    await this.eventRepository.delete(id);
  }
} 
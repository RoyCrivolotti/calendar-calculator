import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';

export class DeleteEventUseCase {
  constructor(
    private eventRepository: CalendarEventRepository,
    private subEventRepository: SubEventRepository
  ) {}
 
  async execute(id: string): Promise<void> {
    // Delete the main event
    await this.eventRepository.delete(id);
    
    // Delete all sub-events associated with the deleted event
    await this.subEventRepository.deleteByParentId(id);
  }
} 
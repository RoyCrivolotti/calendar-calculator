import { CalendarEvent } from '../entities/CalendarEvent';

export interface CalendarEventRepository {
  save(events: CalendarEvent[]): Promise<void>;
  getAll(): Promise<CalendarEvent[]>;
  delete(id: string): Promise<void>;
  update(event: CalendarEvent): Promise<void>;
  deleteMultipleByIds(ids: string[]): Promise<void>;
} 
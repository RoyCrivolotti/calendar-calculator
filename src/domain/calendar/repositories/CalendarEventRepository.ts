import { CalendarEvent } from '../entities/CalendarEvent';

export interface CalendarEventRepository {
  save(events: CalendarEvent[]): Promise<void>;
  getAll(): Promise<CalendarEvent[]>;
  getById(id: string): Promise<CalendarEvent | null>;
  getHolidayEvents(): Promise<CalendarEvent[]>;
  getEventsForDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  delete(id: string): Promise<void>;
  update(event: CalendarEvent): Promise<void>;
  deleteMultipleByIds(ids: string[]): Promise<void>;
} 
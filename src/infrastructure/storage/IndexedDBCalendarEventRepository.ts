import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { storageService } from '../../presentation/services/storage';

export class IndexedDBCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    try {
      await storageService.saveEvents(events);
    } catch (error) {
      console.error('Failed to save events:', error);
      throw new Error('Failed to save events to IndexedDB');
    }
  }

  async getAll(): Promise<CalendarEvent[]> {
    try {
      return await storageService.loadEvents();
    } catch (error) {
      console.error('Failed to load events:', error);
      throw new Error('Failed to load events from IndexedDB');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const events = await this.getAll();
      const filteredEvents = events.filter(event => event.id !== id);
      await this.save(filteredEvents);
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw new Error('Failed to delete event from IndexedDB');
    }
  }

  async update(event: CalendarEvent): Promise<void> {
    try {
      const events = await this.getAll();
      const eventIndex = events.findIndex(e => e.id === event.id);
      
      if (eventIndex === -1) {
        throw new Error(`Event with id ${event.id} not found`);
      }
      
      // Replace the event at the found index
      events[eventIndex] = event;
      await this.save(events);
    } catch (error) {
      console.error('Failed to update event:', error);
      throw new Error('Failed to update event in IndexedDB');
    }
  }
} 
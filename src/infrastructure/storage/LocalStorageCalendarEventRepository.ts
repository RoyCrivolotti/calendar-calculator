import { CalendarEvent, CalendarEventProps } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';

const STORAGE_KEY = 'calendar_events';

export class LocalStorageCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    try {
      const serializedEvents = events.map(event => event.toJSON());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedEvents));
    } catch (error) {
      console.error('Failed to save events:', error);
      throw new Error('Failed to save events to local storage');
    }
  }

  async getAll(): Promise<CalendarEvent[]> {
    try {
      const serializedEvents = localStorage.getItem(STORAGE_KEY);
      if (!serializedEvents) {
        return [];
      }

      const eventsData = JSON.parse(serializedEvents) as CalendarEventProps[];
      return eventsData.map(eventData => 
        CalendarEvent.create({
          id: eventData.id,
          start: new Date(eventData.start),
          end: new Date(eventData.end),
          type: eventData.type
        })
      );
    } catch (error) {
      console.error('Failed to load events:', error);
      throw new Error('Failed to load events from local storage');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const events = await this.getAll();
      const updatedEvents = events.filter(event => event.id !== id);
      await this.save(updatedEvents);
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw new Error('Failed to delete event from local storage');
    }
  }

  async update(event: CalendarEvent): Promise<void> {
    try {
      const events = await this.getAll();
      const updatedEvents = events.map(e => e.id === event.id ? event : e);
      await this.save(updatedEvents);
    } catch (error) {
      console.error('Failed to update event:', error);
      throw new Error('Failed to update event in local storage');
    }
  }
} 
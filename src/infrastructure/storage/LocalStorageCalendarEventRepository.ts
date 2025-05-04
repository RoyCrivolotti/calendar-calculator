import { CalendarEvent, CalendarEventProps } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { getLogger } from '../../utils/logger';

const STORAGE_KEY = 'calendar_events';
const logger = getLogger('localStorage-repository');

export class LocalStorageCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    const startTime = performance.now();
    try {
      logger.debug(`Saving ${events.length} events to localStorage`);
      const serializedEvents = events.map(event => event.toJSON());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedEvents));
      const endTime = performance.now();
      logger.debug(`Saved ${events.length} events to localStorage (${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
      logger.error('Failed to save events to localStorage:', error);
      throw new Error('Failed to save events to local storage');
    }
  }

  async getAll(): Promise<CalendarEvent[]> {
    const startTime = performance.now();
    try {
      const serializedEvents = localStorage.getItem(STORAGE_KEY);
      if (!serializedEvents) {
        logger.debug('No events found in localStorage');
        return [];
      }

      const eventsData = JSON.parse(serializedEvents) as CalendarEventProps[];
      const events = eventsData.map(eventData => 
        CalendarEvent.create({
          id: eventData.id,
          start: new Date(eventData.start),
          end: new Date(eventData.end),
          type: eventData.type
        })
      );
      
      const endTime = performance.now();
      logger.debug(`Loaded ${events.length} events from localStorage (${(endTime - startTime).toFixed(2)}ms)`);
      return events;
    } catch (error) {
      logger.error('Failed to load events from localStorage:', error);
      throw new Error('Failed to load events from local storage');
    }
  }

  async delete(id: string): Promise<void> {
    const startTime = performance.now();
    try {
      const events = await this.getAll();
      const eventToDelete = events.find(event => event.id === id);
      if (!eventToDelete) {
        logger.warn(`Attempted to delete non-existent event with ID: ${id}`);
        return;
      }
      
      const updatedEvents = events.filter(event => event.id !== id);
      await this.save(updatedEvents);
      
      const endTime = performance.now();
      logger.debug(`Deleted event ${id} from localStorage (${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
      logger.error(`Failed to delete event ${id} from localStorage:`, error);
      throw new Error('Failed to delete event from local storage');
    }
  }

  async update(event: CalendarEvent): Promise<void> {
    const startTime = performance.now();
    try {
      const events = await this.getAll();
      const exists = events.some(e => e.id === event.id);
      
      if (!exists) {
        logger.warn(`Attempted to update non-existent event: ${event.id}`);
      }
      
      const updatedEvents = events.map(e => e.id === event.id ? event : e);
      await this.save(updatedEvents);
      
      const endTime = performance.now();
      logger.debug(`Updated event ${event.id} in localStorage (${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
      logger.error(`Failed to update event ${event.id} in localStorage:`, error);
      throw new Error('Failed to update event in local storage');
    }
  }
} 
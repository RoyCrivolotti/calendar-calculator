import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { storageService } from '../../presentation/services/storage';
import { logger } from '../../utils/logger';

export class IndexedDBCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    try {
      logger.info(`Saving ${events.length} events to repository`);
      await storageService.saveEvents(events);
    } catch (error) {
      logger.error('Failed to save events to IndexedDB:', error);
      throw new Error('Failed to save events to IndexedDB');
    }
  }

  async getAll(): Promise<CalendarEvent[]> {
    try {
      logger.info('Loading all events from repository');
      const events = await storageService.loadEvents();
      logger.info(`Loaded ${events.length} events from repository`);
      return events;
    } catch (error) {
      logger.error('Failed to load events from IndexedDB:', error);
      throw new Error('Failed to load events from IndexedDB');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      logger.info(`Deleting event with ID: ${id}`);
      const events = await this.getAll();
      const updatedEvents = events.filter(event => event.id !== id);
      await this.save(updatedEvents);
      logger.info(`Successfully deleted event with ID: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete event with ID ${id}:`, error);
      throw new Error('Failed to delete event from IndexedDB');
    }
  }

  async update(event: CalendarEvent): Promise<void> {
    try {
      logger.info(`Updating event with ID: ${event.id}`);
      const events = await this.getAll();
      const eventIndex = events.findIndex(e => e.id === event.id);
      
      if (eventIndex === -1) {
        logger.error(`Event with id ${event.id} not found`);
        throw new Error(`Event with id ${event.id} not found`);
      }
      
      // Replace the event at the found index
      events[eventIndex] = event;
      await this.save(events);
      logger.info(`Successfully updated event with ID: ${event.id}`);
    } catch (error) {
      logger.error(`Failed to update event with ID ${event.id}:`, error);
      throw new Error('Failed to update event in IndexedDB');
    }
  }
} 
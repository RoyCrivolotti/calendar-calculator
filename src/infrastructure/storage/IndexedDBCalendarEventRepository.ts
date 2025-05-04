import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { storageService } from '../../presentation/services/storage';
import { getLogger } from '../../utils/logger';
import { 
  trackWithRetry, 
  StorageReadError, 
  StorageWriteError, 
  StorageDeleteError,
  NotFoundError
} from '../../utils/errorHandler';

const logger = getLogger('indexeddb-event-repository');

export class IndexedDBCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    return trackWithRetry(
      'SaveEventsToIndexedDB',
      async () => {
        try {
          logger.info(`Saving ${events.length} events to repository`);
          await storageService.saveEvents(events);
        } catch (error) {
          logger.error('Failed to save events to IndexedDB:', error);
          throw new StorageWriteError(
            'Failed to save events to IndexedDB',
            error instanceof Error ? error : new Error(String(error)),
            { eventCount: events.length }
          );
        }
      },
      {
        context: { 
          eventCount: events.length,
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }

  async getAll(): Promise<CalendarEvent[]> {
    return trackWithRetry(
      'GetAllEventsFromIndexedDB',
      async () => {
        try {
          logger.info('Loading all events from repository');
          const events = await storageService.loadEvents();
          logger.info(`Loaded ${events.length} events from repository`);
          return events;
        } catch (error) {
          logger.error('Failed to load events from IndexedDB:', error);
          throw new StorageReadError(
            'Failed to load events from IndexedDB',
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'getAll' }
          );
        }
      },
      {
        context: { 
          operation: 'getAll',
          storageType: 'indexedDB'
        },
        retries: 3
      }
    );
  }

  async delete(id: string): Promise<void> {
    return trackWithRetry(
      `DeleteEventFromIndexedDB(${id})`,
      async () => {
        try {
          logger.info(`Deleting event with ID: ${id}`);
          
          // First check if the event exists
          const events = await this.getAll();
          const eventExists = events.some(e => e.id === id);
          
          if (!eventExists) {
            logger.warn(`Attempted to delete non-existent event with ID: ${id}`);
            return; // If event doesn't exist, consider the delete successful
          }
          
          const updatedEvents = events.filter(event => event.id !== id);
          await this.save(updatedEvents);
          
          logger.info(`Successfully deleted event with ID: ${id}`);
        } catch (error) {
          // Don't wrap errors from getAll or save
          if (error instanceof StorageReadError || error instanceof StorageWriteError) {
            throw error;
          }
          
          logger.error(`Failed to delete event with ID ${id}:`, error);
          throw new StorageDeleteError(
            `Failed to delete event with ID ${id} from IndexedDB`,
            error instanceof Error ? error : new Error(String(error)),
            { eventId: id }
          );
        }
      },
      {
        context: { 
          eventId: id,
          operation: 'delete',
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }

  async update(event: CalendarEvent): Promise<void> {
    return trackWithRetry(
      `UpdateEventInIndexedDB(${event.id})`,
      async () => {
        try {
          logger.info(`Updating event with ID: ${event.id}`);
          
          // First check if the event exists
          const events = await this.getAll();
          const eventExists = events.some(e => e.id === event.id);
          
          if (!eventExists) {
            logger.warn(`Attempted to update non-existent event with ID: ${event.id}`);
            throw new NotFoundError(
              `Event with ID ${event.id} not found`,
              'EVENT_NOT_FOUND',
              404,
              undefined,
              { eventId: event.id }
            );
          }
          
          // Replace with updated event
          const updatedEvents = events.map(e => e.id === event.id ? event : e);
          await this.save(updatedEvents);
          
          logger.info(`Successfully updated event with ID: ${event.id}`);
        } catch (error) {
          // Don't wrap NotFoundError, StorageReadError, or StorageWriteError
          if (
            error instanceof NotFoundError || 
            error instanceof StorageReadError || 
            error instanceof StorageWriteError
          ) {
            throw error;
          }
          
          logger.error(`Failed to update event with ID ${event.id}:`, error);
          throw new StorageWriteError(
            `Failed to update event with ID ${event.id} in IndexedDB`,
            error instanceof Error ? error : new Error(String(error)),
            { 
              eventId: event.id,
              eventType: event.type
            }
          );
        }
      },
      {
        context: { 
          eventId: event.id,
          eventType: event.type,
          operation: 'update',
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }
} 
import { CalendarEvent, CalendarEventProps } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { createRepositoryLogger } from '../../utils/initializeLogger';
import { 
  trackWithRetry, 
  StorageReadError, 
  StorageWriteError, 
  StorageDeleteError,
  NotFoundError
} from '../../utils/errorHandler';

const STORAGE_KEY = 'calendar_events';
// Use standardized repository logger with consistent naming
const logger = createRepositoryLogger('calendarEvent', 'localStorage');

export class LocalStorageCalendarEventRepository implements CalendarEventRepository {
  async save(events: CalendarEvent[]): Promise<void> {
    return trackWithRetry(
      'SaveEvents',
      async () => {
        logger.info(`Saving ${events.length} events to localStorage`);
        
        try {
          const serializedEvents = events.map(event => event.toJSON());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedEvents));
          
          logger.info(`Successfully saved ${events.length} events to localStorage`);
        } catch (error) {
          // Convert to a more specific error type
          logger.error('Failed to save events to localStorage:', error);
          throw new StorageWriteError(
            'Failed to save events to local storage',
            error instanceof Error ? error : new Error(String(error)),
            { eventCount: events.length }
          );
        }
      },
      {
        context: { 
          eventCount: events.length,
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }

  async getAll(): Promise<CalendarEvent[]> {
    return trackWithRetry(
      'GetAllEvents',
      async () => {
        logger.info('Loading all events from localStorage');
        
        try {
          const eventsJson = localStorage.getItem(STORAGE_KEY);
          
          if (!eventsJson) {
            logger.info('No events found in localStorage, returning empty array');
            return [];
          }
          
          const eventsData = JSON.parse(eventsJson);
          const events = eventsData.map((eventData: CalendarEventProps) => {
            return new CalendarEvent({
              id: eventData.id,
              start: new Date(eventData.start),
              end: new Date(eventData.end),
              type: eventData.type,
              title: eventData.title
            });
          });
          
          logger.info(`Successfully loaded ${events.length} events from localStorage`);
          return events;
        } catch (error) {
          logger.error('Failed to load events from localStorage:', error);
          throw new StorageReadError(
            'Failed to load events from local storage',
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'getAll' }
          );
        }
      },
      {
        context: { 
          operation: 'getAll', 
          storageType: 'localStorage' 
        },
        retries: 3
      }
    );
  }

  async getById(id: string): Promise<CalendarEvent> {
    return trackWithRetry(
      'GetEventById',
      async () => {
        logger.info(`Loading event with ID ${id} from localStorage`);
        
        try {
          const events = await this.getAll();
          const event = events.find(e => e.id === id);
          
          if (!event) {
            logger.warn(`Event with ID ${id} not found in localStorage`);
            throw new NotFoundError(`Event with ID ${id} not found`);
          }
          
          logger.info(`Successfully loaded event with ID ${id} from localStorage`);
          return event;
        } catch (error) {
          if (error instanceof NotFoundError) {
            throw error; // Don't wrap already typed errors
          }
          
          logger.error(`Failed to load event with ID ${id} from localStorage:`, error);
          throw new StorageReadError(
            `Failed to load event with ID ${id} from local storage`,
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'getById', eventId: id }
          );
        }
      },
      {
        context: { 
          operation: 'getById', 
          eventId: id,
          storageType: 'localStorage' 
        },
        retries: 3
      }
    );
  }

  async delete(id: string): Promise<void> {
    return trackWithRetry(
      'DeleteEvent',
      async () => {
        logger.info(`Deleting event with ID ${id} from localStorage`);
        
        try {
          const events = await this.getAll();
          const filteredEvents = events.filter(e => e.id !== id);
          
          if (events.length === filteredEvents.length) {
            logger.warn(`Event with ID ${id} not found for deletion`);
            throw new NotFoundError(`Event with ID ${id} not found`);
          }
          
          await this.save(filteredEvents);
          logger.info(`Successfully deleted event with ID ${id} from localStorage`);
        } catch (error) {
          if (error instanceof NotFoundError) {
            throw error; // Don't wrap already typed errors
          }
          
          logger.error(`Failed to delete event with ID ${id} from localStorage:`, error);
          throw new StorageDeleteError(
            `Failed to delete event with ID ${id} from local storage`,
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'delete', eventId: id }
          );
        }
      },
      {
        context: { 
          operation: 'delete', 
          eventId: id,
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }

  async update(event: CalendarEvent): Promise<void> {
    return trackWithRetry(
      `UpdateEvent(${event.id})`,
      async () => {
        try {
          const events = await this.getAll();
          const exists = events.some(e => e.id === event.id);
          
          if (!exists) {
            logger.warn(`Attempted to update non-existent event: ${event.id}`);
            throw new NotFoundError(
              `Event with ID ${event.id} not found`,
              'EVENT_NOT_FOUND',
              404,
              undefined,
              { eventId: event.id }
            );
          }
          
          const updatedEvents = events.map(e => e.id === event.id ? event : e);
          await this.save(updatedEvents);
          
          logger.debug(`Updated event ${event.id} in localStorage`);
        } catch (error) {
          // Don't wrap NotFoundError or StorageReadError
          if (error instanceof NotFoundError || error instanceof StorageReadError) {
            throw error;
          }
          
          logger.error(`Failed to update event ${event.id} in localStorage:`, error);
          throw new StorageWriteError(
            `Failed to update event ${event.id} in local storage`,
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
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }
} 
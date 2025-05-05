import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { StorageInitError, StorageReadError, StorageWriteError } from '../../utils/errorHandler';
import { createServiceLogger } from '../../utils/initializeLogger';
import { logStorageInit, logStorageError, logStorageSuccess } from './storageLogger';
import { trackWithRetry } from '../../utils/errorHandler';

const EVENTS_STORAGE_KEY = 'calendarEvents';
const SUBEVENTS_STORAGE_KEY = 'calendarSubEvents';
const DB_NAME = 'calendarDB';
const DB_VERSION = 2; // Increased version for new object store
const EVENTS_STORE_NAME = 'events';
const SUBEVENTS_STORE_NAME = 'subevents';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Use standardized service logger
const logger = createServiceLogger('storageService');

class StorageService {
  private syncTimeout: number | null = null;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private initAttempts = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

  constructor() {
    this.initDatabase()
      .then(() => {
        logger.info('Storage service initialized successfully, starting periodic sync');
        this.startPeriodicSync();
      })
      .catch(error => {
        logger.error('Failed to initialize storage service', error);
        // We will retry initialization on first operation
      });
  }

  /**
   * Initialize database with retry logic
   */
  private async initDatabase(): Promise<void> {
    // If already initialized, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // If max attempts reached, throw error
    if (this.initAttempts >= this.MAX_INIT_ATTEMPTS) {
      throw new StorageInitError(
        `Failed to initialize database after ${this.MAX_INIT_ATTEMPTS} attempts`,
        undefined,
        { dbName: DB_NAME, dbVersion: DB_VERSION }
      );
    }

    this.initAttempts++;
    
    // Create a new initialization promise
    this.initPromise = trackWithRetry(
      'InitializeDatabase',
      async () => {
        logStorageInit(DB_NAME, DB_VERSION, { attempt: this.initAttempts });

        return new Promise<void>((resolve, reject) => {
          try {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
              const error = request.error;
              logger.error('Failed to open IndexedDB:', error);
              logStorageError(
                error || new Error('Unknown database open error'),
                'INIT',
                { dbName: DB_NAME, dbVersion: DB_VERSION, attempt: this.initAttempts }
              );
              
              // Reset the promise so we can try again
              this.initPromise = null;
              reject(new StorageInitError(
                'Failed to open IndexedDB database',
                error || new Error('Unknown database open error'),
                { dbName: DB_NAME, dbVersion: DB_VERSION, attempt: this.initAttempts }
              ));
            };

            request.onsuccess = () => {
              this.db = request.result;
              
              // Set up error handler for the database
              this.db.onerror = (event) => {
                logger.error('Database error:', (event.target as any).error);
              };
              
              logStorageSuccess('INIT', `IndexedDB initialized successfully (version ${DB_VERSION})`, 
                { dbName: DB_NAME, dbVersion: DB_VERSION });
              resolve();
            };

            request.onupgradeneeded = (event) => {
              logger.info(`Upgrading IndexedDB schema to version ${DB_VERSION}`);
              const db = (event.target as IDBOpenDBRequest).result;
              
              if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
                logger.info('Creating events store with indexes');
                const eventStore = db.createObjectStore(EVENTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
                eventStore.createIndex('start', 'start', { unique: false });
                eventStore.createIndex('end', 'end', { unique: false });
                eventStore.createIndex('type', 'type', { unique: false });
              }
              
              if (!db.objectStoreNames.contains(SUBEVENTS_STORE_NAME)) {
                logger.info('Creating subevents store with indexes');
                const subEventStore = db.createObjectStore(SUBEVENTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
                subEventStore.createIndex('parentEventId', 'parentEventId', { unique: false });
                subEventStore.createIndex('start', 'start', { unique: false });
                subEventStore.createIndex('end', 'end', { unique: false });
                subEventStore.createIndex('type', 'type', { unique: false });
              }
            };
          } catch (error) {
            // This catches issues with indexedDB availability
            logger.error('Critical error initializing IndexedDB:', error);
            // Reset the promise so we can try again
            this.initPromise = null;
            reject(new StorageInitError(
              'Critical error initializing IndexedDB',
              error instanceof Error ? error : new Error(String(error)),
              { dbName: DB_NAME, dbVersion: DB_VERSION, attempt: this.initAttempts }
            ));
          }
        });
      },
      {
        context: { dbName: DB_NAME, dbVersion: DB_VERSION, operation: 'init' },
        retries: 2, // Add 2 retries for transient errors
        initialDelay: 1000 // Start with 1 second delay
      }
    );

    return this.initPromise;
  }

  /**
   * Ensures the database is initialized before performing operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      try {
        await this.initDatabase();
      } catch (error) {
        // Reset init promise to allow retrying later
        this.initPromise = null;
        throw error;
      }
    }
    
    if (!this.db) {
      throw new StorageInitError(
        'Database not initialized after initialization attempt',
        undefined,
        { dbName: DB_NAME, dbVersion: DB_VERSION }
      );
    }
  }

  /**
   * Synchronize data between localStorage and IndexedDB
   */
  private async syncToLocalStorage(): Promise<void> {
    logger.info('Syncing data to localStorage for backup');
    try {
      // Get events from IndexedDB and sync to localStorage
      const events = await this.loadEventsFromIndexedDB();
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(e => e.toJSON())));
      
      // Get sub-events from IndexedDB and sync to localStorage
      const subEvents = await this.loadSubEventsFromIndexedDB();
      localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(se => se.toJSON())));
      
      logger.info('Successfully synced data to localStorage');
    } catch (error) {
      logger.error('Error syncing to localStorage:', error);
      throw new StorageWriteError(
        'Failed to sync data to localStorage',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private startPeriodicSync(): void {
    // Clear any existing timeout
    if (this.syncTimeout !== null) {
      clearTimeout(this.syncTimeout);
    }

    // Set up a new periodic sync
    this.syncTimeout = setTimeout(() => {
      logger.info('Running periodic storage sync');
      this.syncToLocalStorage().catch((error: unknown) => {
        logger.error('Error during periodic sync:', error);
      }).finally(() => {
        this.startPeriodicSync();
      });
    }, SYNC_INTERVAL) as unknown as number;
  }

  private async loadEventsFromIndexedDB(): Promise<CalendarEvent[]> {
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        logger.error('Database not initialized');
        reject(new Error('Database not initialized'));
        return;
      }

      logger.info('Loading events from IndexedDB...');
      try {
        const transaction = this.db.transaction(EVENTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(EVENTS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          logger.info(`Loaded ${request.result.length} events from IndexedDB`);
          const events = request.result.map((eventData: any) => {
            try {
              return new CalendarEvent({
                id: eventData.id,
                start: new Date(eventData.start),
                end: new Date(eventData.end),
                type: eventData.type,
                title: eventData.title
              });
            } catch (err) {
              logger.error('Error parsing event:', eventData, err);
              return null;
            }
          }).filter((event): event is CalendarEvent => event !== null);
          resolve(events);
        };

        request.onerror = () => {
          logger.error('Error loading events from IndexedDB:', request.error);
          reject(request.error);
        };
      } catch (err) {
        logger.error('Error creating transaction:', err);
        reject(err);
      }
    });
  }

  private async loadSubEventsFromIndexedDB(): Promise<SubEvent[]> {
    if (!this.db) {
      await this.initDatabase();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        logger.error('Database not initialized');
        reject(new Error('Database not initialized'));
        return;
      }

      logger.info('Loading sub-events from IndexedDB...');
      try {
        const transaction = this.db.transaction(SUBEVENTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SUBEVENTS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          logger.info(`Loaded ${request.result.length} sub-events from IndexedDB`);
          const subEvents = request.result.map((subEventData: any) => {
            try {
              return new SubEvent({
                id: subEventData.id,
                parentEventId: subEventData.parentEventId,
                start: new Date(subEventData.start),
                end: new Date(subEventData.end),
                isWeekday: subEventData.isWeekday,
                isWeekend: subEventData.isWeekend,
                isHoliday: subEventData.isHoliday,
                isNightShift: subEventData.isNightShift,
                isOfficeHours: subEventData.isOfficeHours,
                type: subEventData.type
              });
            } catch (err) {
              logger.error('Error parsing sub-event:', subEventData, err);
              return null;
            }
          }).filter((subEvent): subEvent is SubEvent => subEvent !== null);
          resolve(subEvents);
        };

        request.onerror = () => {
          logger.error('Error loading sub-events from IndexedDB:', request.error);
          reject(request.error);
        };
      } catch (err) {
        logger.error('Error creating transaction:', err);
        reject(err);
      }
    });
  }

  private loadEventsFromLocalStorage(): CalendarEvent[] {
    try {
      const data = localStorage.getItem(EVENTS_STORAGE_KEY);
      if (data) {
        return JSON.parse(data).map((event: any) => new CalendarEvent(event));
      }
    } catch (error) {
      logger.error('Error loading events from localStorage:', error);
    }
    return [];
  }

  private loadSubEventsFromLocalStorage(): SubEvent[] {
    try {
      const data = localStorage.getItem(SUBEVENTS_STORAGE_KEY);
      if (data) {
        return JSON.parse(data).map((subEvent: any) => new SubEvent(subEvent));
      }
    } catch (error) {
      logger.error('Error loading sub-events from localStorage:', error);
    }
    return [];
  }

  async saveEvents(events: CalendarEvent[]): Promise<void> {
    try {
      // Save to IndexedDB
      if (!this.db) {
        await this.initDatabase();
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      logger.info(`Saving ${events.length} events to IndexedDB...`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(EVENTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(EVENTS_STORE_NAME);
        
        // Set up transaction event handlers
        transaction.onerror = (event) => {
          logger.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
        
        transaction.oncomplete = () => {
          logger.info(`Successfully saved ${events.length} events to IndexedDB`);
          // Also update localStorage as a backup
          localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
          resolve();
        };
        
        // Clear existing events
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          logger.info('Cleared existing events');
          
          // Add new events
          events.forEach(event => {
            if (!event.id) {
              logger.warn('Skipping event without ID:', event);
              return;
            }
            
            const eventData = event.toJSON();
            const request = store.put(eventData);
            
            request.onerror = () => {
              logger.error('Error saving event:', event.id, request.error);
            };
          });
        };
        
        clearRequest.onerror = () => {
          logger.error('Error clearing events:', clearRequest.error);
          reject(clearRequest.error);
        };
      });
    } catch (error) {
      logger.error('Error in saveEvents:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
      throw error;
    }

  }

  async saveSubEvents(subEvents: SubEvent[]): Promise<void> {
    try {
      // Save to IndexedDB
      if (!this.db) {
        await this.initDatabase();
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      logger.info(`Saving ${subEvents.length} sub-events to IndexedDB...`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(SUBEVENTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SUBEVENTS_STORE_NAME);
        
        // Set up transaction event handlers
        transaction.onerror = (event) => {
          logger.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
        
        transaction.oncomplete = () => {
          logger.info(`Successfully saved ${subEvents.length} sub-events to IndexedDB`);
          // Also update localStorage as a backup
          localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
          resolve();
        };
        
        // Clear existing sub-events
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          logger.info('Cleared existing sub-events');
          
          // Add new sub-events
          subEvents.forEach(subEvent => {
            if (!subEvent.id) {
              logger.warn('Skipping sub-event without ID:', subEvent);
              return;
            }
            
            const subEventData = subEvent.toJSON();
            const request = store.put(subEventData);
            
            request.onerror = () => {
              logger.error('Error saving sub-event:', subEvent.id, request.error);
            };
          });
        };
        
        clearRequest.onerror = () => {
          logger.error('Error clearing sub-events:', clearRequest.error);
          reject(clearRequest.error);
        };
      });
    } catch (error) {
      logger.error('Error in saveSubEvents:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
      throw error;
    }
  }

  async loadEvents(): Promise<CalendarEvent[]> {
    try {
      // Try to load from IndexedDB first
      const events = await this.loadEventsFromIndexedDB();
      if (events.length > 0) {
        return events;
      }
    } catch (error) {
      logger.error('Error loading from IndexedDB:', error);
    }

    // Fallback to localStorage if IndexedDB fails or is empty
    return this.loadEventsFromLocalStorage();
  }

  async loadSubEvents(): Promise<SubEvent[]> {
    try {
      // Try to load from IndexedDB first
      const subEvents = await this.loadSubEventsFromIndexedDB();
      if (subEvents.length > 0) {
        return subEvents;
      }
    } catch (error) {
      logger.error('Error loading from IndexedDB:', error);
    }

    // Fallback to localStorage if IndexedDB fails or is empty
    return this.loadSubEventsFromLocalStorage();
  }

  async clearAllData(): Promise<void> {
    try {
      // Clear IndexedDB
      if (this.db) {
        const eventsTransaction = this.db.transaction(EVENTS_STORE_NAME, 'readwrite');
        const eventsStore = eventsTransaction.objectStore(EVENTS_STORE_NAME);
        eventsStore.clear();
        
        const subEventsTransaction = this.db.transaction(SUBEVENTS_STORE_NAME, 'readwrite');
        const subEventsStore = subEventsTransaction.objectStore(SUBEVENTS_STORE_NAME);
        subEventsStore.clear();
        
        logger.info('Cleared all data from IndexedDB');
      }
      
      // Clear localStorage
      localStorage.removeItem(EVENTS_STORAGE_KEY);
      localStorage.removeItem(SUBEVENTS_STORAGE_KEY);
      logger.info('Cleared all data from localStorage');
      
      return Promise.resolve();
    } catch (error) {
      logger.error('Error clearing data:', error);
      return Promise.reject(error);
    }
  }
}

export const storageService = new StorageService(); 
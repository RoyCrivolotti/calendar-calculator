/**
 * @deprecated This service is being phased out in favor of Firestore-based repositories.
 * All new data persistence and retrieval should use FirestoreCalendarEventRepository and FirestoreSubEventRepository.
 * Existing methods here are for legacy data access and migration purposes only.
 */
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

/**
 * @deprecated This class is being phased out in favor of Firestore-based repositories.
 */
class StorageService {
  private syncTimeout: number | null = null;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private initAttempts = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;

  constructor() {
    // ... (constructor logic can remain for now if migration script still uses it, 
    // but ideally, migration would also use DI for repositories if possible in future)
    logger.warn('StorageService is deprecated and should not be actively used for new features.');
    this.initDatabase()
      .then(() => {
        logger.info('Legacy Storage service initialized successfully, starting periodic sync (deprecated behavior)');
        this.startPeriodicSync(); // This sync itself is deprecated
      })
      .catch(error => {
        logger.error('Failed to initialize legacy storage service', error);
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
   * @deprecated Syncing to localStorage is part of the old deprecated system.
   */
  private async syncToLocalStorage(): Promise<void> {
    logger.warn('[Deprecated] syncToLocalStorage called.');
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

  /**
   * @deprecated Periodic sync is part of the old deprecated system.
   */
  private startPeriodicSync(): void {
    logger.warn('[Deprecated] startPeriodicSync called.');
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

  /**
   * @deprecated Load events from IndexedDB. Use FirestoreCalendarEventRepository instead.
   */
  private async loadEventsFromIndexedDB(): Promise<CalendarEvent[]> {
    logger.warn('[Deprecated] loadEventsFromIndexedDB called.');
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

  /**
   * @deprecated Load sub-events from IndexedDB. Use FirestoreSubEventRepository instead.
   */
  private async loadSubEventsFromIndexedDB(): Promise<SubEvent[]> {
    logger.warn('[Deprecated] loadSubEventsFromIndexedDB called.');
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

  /**
   * @deprecated Load events from localStorage. Part of the old deprecated system.
   */
  private loadEventsFromLocalStorage(): CalendarEvent[] {
    logger.warn('[Deprecated] loadEventsFromLocalStorage called.');
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

  /**
   * @deprecated Load sub-events from localStorage. Part of the old deprecated system.
   */
  private loadSubEventsFromLocalStorage(): SubEvent[] {
    logger.warn('[Deprecated] loadSubEventsFromLocalStorage called.');
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

  /**
   * @deprecated Save events to IndexedDB. Use FirestoreCalendarEventRepository instead.
   * This method will now only log a warning and not save to prevent accidental writes to old store.
   */
  async saveEvents(events: CalendarEvent[]): Promise<void> {
    logger.warn('[Deprecated] storageService.saveEvents called. Data NOT saved to IndexedDB. Use FirestoreCalendarEventRepository.');
    // Original implementation commented out to prevent writes:
    /*
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      // ... original save logic ...
    });
    */
   return Promise.resolve(); // Fulfill the promise without action
  }

  /**
   * @deprecated Save sub-events to IndexedDB. Use FirestoreSubEventRepository instead.
   * This method will now only log a warning and not save to prevent accidental writes to old store.
   */
  async saveSubEvents(subEvents: SubEvent[]): Promise<void> {
    logger.warn('[Deprecated] storageService.saveSubEvents called. Data NOT saved to IndexedDB. Use FirestoreSubEventRepository.');
    // Original implementation commented out to prevent writes:
    /*
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      // ... original save logic ...
    });
    */
   return Promise.resolve(); // Fulfill the promise without action
  }

  /**
   * @deprecated Load events from IndexedDB/localStorage. Use FirestoreCalendarEventRepository instead.
   * Migration script might still use this. For general app use, switch to Firestore.
   */
  async loadEvents(): Promise<CalendarEvent[]> {
    logger.warn('[Deprecated] storageService.loadEvents called. Consider using Firestore for new features.');
    // ... (original loadEvents logic can remain for migration script compatibility for now)
    await this.ensureInitialized();
    // ... (rest of original loadEvents implementation)
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

  /**
   * @deprecated Load sub-events from IndexedDB/localStorage. Use FirestoreSubEventRepository instead.
   * Migration script might still use this. For general app use, switch to Firestore.
   */
  async loadSubEvents(): Promise<SubEvent[]> {
    logger.warn('[Deprecated] storageService.loadSubEvents called. Consider using Firestore for new features.');
    // ... (original loadSubEvents logic can remain for migration script compatibility for now)
    await this.ensureInitialized();
    // ... (rest of original loadSubEvents implementation)
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

  /**
   * @deprecated Clear data from IndexedDB. This should be part of a final cleanup, not regular use.
   */
  async clearAllData(): Promise<void> {
    logger.warn('[Deprecated] storageService.clearAllData called for IndexedDB.');
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

// export const storageService = new StorageService(); // Prevent auto-initialization of deprecated service

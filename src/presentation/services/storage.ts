import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';

const EVENTS_STORAGE_KEY = 'calendarEvents';
const SUBEVENTS_STORAGE_KEY = 'calendarSubEvents';
const DB_NAME = 'calendarDB';
const DB_VERSION = 2; // Increased version for new object store
const EVENTS_STORE_NAME = 'events';
const SUBEVENTS_STORE_NAME = 'subevents';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

class StorageService {
  private syncTimeout: number | null = null;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB().then(() => {
      // Start periodic sync after DB is initialized
      this.startPeriodicSync();
    });
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('Upgrading IndexedDB schema...');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create or update events store
        if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
          console.log('Creating events store...');
          const eventStore = db.createObjectStore(EVENTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          // Create indexes for better querying
          eventStore.createIndex('start', 'start', { unique: false });
          eventStore.createIndex('end', 'end', { unique: false });
          eventStore.createIndex('type', 'type', { unique: false });
        }
        
        // Create or update subevents store
        if (!db.objectStoreNames.contains(SUBEVENTS_STORE_NAME)) {
          console.log('Creating subevents store...');
          const subEventStore = db.createObjectStore(SUBEVENTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          // Create indexes for better querying
          subEventStore.createIndex('parentEventId', 'parentEventId', { unique: false });
          subEventStore.createIndex('start', 'start', { unique: false });
          subEventStore.createIndex('end', 'end', { unique: false });
          subEventStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  private startPeriodicSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.syncToStorage();
      this.startPeriodicSync();
    }, SYNC_INTERVAL);
  }

  private async syncToStorage() {
    try {
      const events = await this.loadEventsFromIndexedDB();
      const subEvents = await this.loadSubEventsFromIndexedDB();
      
      // Update localStorage as a backup
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
      localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
    } catch (error) {
      console.error('Error syncing to storage:', error);
    }
  }

  private async loadEventsFromIndexedDB(): Promise<CalendarEvent[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error('Database not initialized');
        reject(new Error('Database not initialized'));
        return;
      }

      console.log('Loading events from IndexedDB...');
      try {
        const transaction = this.db.transaction(EVENTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(EVENTS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          console.log(`Loaded ${request.result.length} events from IndexedDB`);
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
              console.error('Error parsing event:', eventData, err);
              return null;
            }
          }).filter(Boolean);
          resolve(events);
        };

        request.onerror = () => {
          console.error('Error loading events from IndexedDB:', request.error);
          reject(request.error);
        };
      } catch (err) {
        console.error('Error creating transaction:', err);
        reject(err);
      }
    });
  }

  private async loadSubEventsFromIndexedDB(): Promise<SubEvent[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error('Database not initialized');
        reject(new Error('Database not initialized'));
        return;
      }

      console.log('Loading sub-events from IndexedDB...');
      try {
        const transaction = this.db.transaction(SUBEVENTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SUBEVENTS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          console.log(`Loaded ${request.result.length} sub-events from IndexedDB`);
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
              console.error('Error parsing sub-event:', subEventData, err);
              return null;
            }
          }).filter(Boolean);
          resolve(subEvents);
        };

        request.onerror = () => {
          console.error('Error loading sub-events from IndexedDB:', request.error);
          reject(request.error);
        };
      } catch (err) {
        console.error('Error creating transaction:', err);
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
      console.error('Error loading events from localStorage:', error);
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
      console.error('Error loading sub-events from localStorage:', error);
    }
    return [];
  }

  async saveEvents(events: CalendarEvent[]): Promise<void> {
    try {
      // Save to IndexedDB
      if (!this.db) {
        await this.initDB();
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      console.log(`Saving ${events.length} events to IndexedDB...`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(EVENTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(EVENTS_STORE_NAME);
        
        // Set up transaction event handlers
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
        
        transaction.oncomplete = () => {
          console.log(`Successfully saved ${events.length} events to IndexedDB`);
          // Also update localStorage as a backup
          localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
          resolve();
        };
        
        // Clear existing events
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          console.log('Cleared existing events');
          
          // Add new events
          events.forEach(event => {
            if (!event.id) {
              console.warn('Skipping event without ID:', event);
              return;
            }
            
            const eventData = event.toJSON();
            const request = store.put(eventData);
            
            request.onerror = () => {
              console.error('Error saving event:', event.id, request.error);
            };
            
            request.onsuccess = () => {
              console.log('Successfully saved event:', event.id);
            };
          });
        };
        
        clearRequest.onerror = () => {
          console.error('Error clearing events:', clearRequest.error);
          reject(clearRequest.error);
        };
      });
    } catch (error) {
      console.error('Error in saveEvents:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
      throw error;
    }
  }

  async saveSubEvents(subEvents: SubEvent[]): Promise<void> {
    try {
      // Save to IndexedDB
      if (!this.db) {
        await this.initDB();
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      console.log(`Saving ${subEvents.length} sub-events to IndexedDB...`);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(SUBEVENTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SUBEVENTS_STORE_NAME);
        
        // Set up transaction event handlers
        transaction.onerror = (event) => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
        
        transaction.oncomplete = () => {
          console.log(`Successfully saved ${subEvents.length} sub-events to IndexedDB`);
          // Also update localStorage as a backup
          localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
          resolve();
        };
        
        // Clear existing sub-events
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          console.log('Cleared existing sub-events');
          
          // Add new sub-events
          subEvents.forEach(subEvent => {
            if (!subEvent.id) {
              console.warn('Skipping sub-event without ID:', subEvent);
              return;
            }
            
            const subEventData = subEvent.toJSON();
            const request = store.put(subEventData);
            
            request.onerror = () => {
              console.error('Error saving sub-event:', subEvent.id, request.error);
            };
            
            request.onsuccess = () => {
              console.log('Successfully saved sub-event:', subEvent.id);
            };
          });
        };
        
        clearRequest.onerror = () => {
          console.error('Error clearing sub-events:', clearRequest.error);
          reject(clearRequest.error);
        };
      });
    } catch (error) {
      console.error('Error in saveSubEvents:', error);
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
      console.error('Error loading from IndexedDB:', error);
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
      console.error('Error loading from IndexedDB:', error);
    }

    // Fallback to localStorage if IndexedDB fails or is empty
    return this.loadSubEventsFromLocalStorage();
  }
}

export const storageService = new StorageService(); 
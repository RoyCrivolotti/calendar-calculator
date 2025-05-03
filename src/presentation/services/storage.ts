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
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
          // Create object store for events
          const eventStore = db.createObjectStore(EVENTS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          // Create indexes for better querying
          eventStore.createIndex('start', 'start', { unique: false });
          eventStore.createIndex('end', 'end', { unique: false });
          eventStore.createIndex('type', 'type', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(SUBEVENTS_STORE_NAME)) {
          // Create object store for sub-events
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
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(EVENTS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(EVENTS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result.map((event: any) => new CalendarEvent(event));
        resolve(events);
      };

      request.onerror = () => {
        console.error('Error loading events from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  private async loadSubEventsFromIndexedDB(): Promise<SubEvent[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(SUBEVENTS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(SUBEVENTS_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const subEvents = request.result.map((subEvent: any) => new SubEvent(subEvent));
        resolve(subEvents);
      };

      request.onerror = () => {
        console.error('Error loading sub-events from IndexedDB:', request.error);
        reject(request.error);
      };
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

      const transaction = this.db.transaction(EVENTS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(EVENTS_STORE_NAME);

      // Clear existing events
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = resolve;
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new events
      for (const event of events) {
        if (!event.id) {
          console.warn('Skipping event without ID:', event);
          continue;
        }
        await new Promise((resolve, reject) => {
          const eventData = event.toJSON();
          const request = store.put(eventData);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        });
      }

      // Make sure the transaction completes
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
      });

      // Also update localStorage as a backup
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
      console.log(`Successfully saved ${events.length} events to storage`);
    } catch (error) {
      console.error('Error saving events:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
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

      const transaction = this.db.transaction(SUBEVENTS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SUBEVENTS_STORE_NAME);

      // Clear existing sub-events
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = resolve;
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Add new sub-events
      for (const subEvent of subEvents) {
        if (!subEvent.id) {
          console.warn('Skipping sub-event without ID:', subEvent);
          continue;
        }
        await new Promise((resolve, reject) => {
          const subEventData = subEvent.toJSON();
          const request = store.put(subEventData);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        });
      }

      // Make sure the transaction completes
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(new Error('Transaction aborted'));
      });

      // Also update localStorage as a backup
      localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
      console.log(`Successfully saved ${subEvents.length} sub-events to storage`);
    } catch (error) {
      console.error('Error saving sub-events:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(SUBEVENTS_STORAGE_KEY, JSON.stringify(subEvents.map(subEvent => subEvent.toJSON())));
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
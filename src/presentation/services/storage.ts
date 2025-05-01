import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';

const STORAGE_KEY = 'calendarEvents';
const DB_NAME = 'calendarDB';
const DB_VERSION = 1;
const STORE_NAME = 'events';
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // Create object store with id as the key path
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // Create indexes for better querying
          store.createIndex('start', 'start', { unique: false });
          store.createIndex('end', 'end', { unique: false });
          store.createIndex('type', 'type', { unique: false });
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
      const events = await this.loadFromIndexedDB();
      // Update localStorage as a backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
      console.log('Calendar data synced to storage');
    } catch (error) {
      console.error('Error syncing to storage:', error);
    }
  }

  private async loadFromIndexedDB(): Promise<CalendarEvent[]> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result.map((event: any) => new CalendarEvent(event));
        resolve(events);
      };

      request.onerror = () => {
        console.error('Error loading from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  private loadFromLocalStorage(): CalendarEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data).map((event: any) => new CalendarEvent(event));
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
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

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

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
          const request = store.put(event.toJSON());
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        });
      }

      // Also update localStorage as a backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
    } catch (error) {
      console.error('Error saving events:', error);
      // Fallback to localStorage only if IndexedDB fails
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.map(event => event.toJSON())));
    }
  }

  async loadEvents(): Promise<CalendarEvent[]> {
    try {
      // Try to load from IndexedDB first
      const events = await this.loadFromIndexedDB();
      if (events.length > 0) {
        return events;
      }
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
    }

    // Fallback to localStorage if IndexedDB fails or is empty
    return this.loadFromLocalStorage();
  }
}

export const storageService = new StorageService(); 
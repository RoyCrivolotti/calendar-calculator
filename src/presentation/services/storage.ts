import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), 'calendar-data.json');
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

class StorageService {
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic sync
    this.startPeriodicSync();
  }

  private startPeriodicSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setInterval(() => {
      this.syncToFile();
    }, SYNC_INTERVAL);
  }

  private async syncToFile() {
    try {
      const events = this.loadFromLocalStorage();
      await fs.promises.writeFile(STORAGE_FILE, JSON.stringify(events, null, 2));
      console.log('Calendar data synced to file');
    } catch (error) {
      console.error('Error syncing to file:', error);
    }
  }

  private loadFromLocalStorage(): CalendarEvent[] {
    try {
      const storedEvents = localStorage.getItem('calendarEvents');
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        return parsedEvents.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return [];
  }

  async loadEvents(): Promise<CalendarEvent[]> {
    try {
      // First try to load from file
      if (fs.existsSync(STORAGE_FILE)) {
        const fileData = await fs.promises.readFile(STORAGE_FILE, 'utf-8');
        const events = JSON.parse(fileData).map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
        
        // Update localStorage with file data
        localStorage.setItem('calendarEvents', JSON.stringify(events));
        return events;
      }
    } catch (error) {
      console.error('Error loading from file:', error);
    }

    // Fallback to localStorage
    return this.loadFromLocalStorage();
  }

  saveEvents(events: CalendarEvent[]) {
    // Save to localStorage immediately
    localStorage.setItem('calendarEvents', JSON.stringify(events));
    
    // Trigger a sync to file
    this.syncToFile();
  }

  cleanup() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
  }
}

export const storageService = new StorageService(); 
import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { logger } from '../../../utils/logger';

export class HolidayChecker {
  // Simple static cache to avoid redundant holiday checks
  private static cache: Map<string, { isHoliday: boolean, timestamp: number }> = new Map();
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hour cache TTL

  /**
   * Clear the holiday check cache
   * Should be called when holiday events are added, removed, or modified
   */
  static clearCache(): void {
    logger.info('Clearing HolidayChecker cache');
    HolidayChecker.cache.clear();
  }

  /**
   * Checks if a given date is a holiday based on the holiday events.
   * 
   * @param date The date to check
   * @param events All calendar events
   * @returns True if the date is a holiday, false otherwise
   */
  static isHoliday(date: Date, events: CalendarEvent[]): boolean {
    const dateToCheck = new Date(date);
    // Reset time to ensure we only compare calendar dates
    dateToCheck.setHours(0, 0, 0, 0);
    
    // Generate cache key using date string
    const cacheKey = dateToCheck.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we have a cached result
    const cachedResult = HolidayChecker.cache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < HolidayChecker.CACHE_TTL_MS) {
      return cachedResult.isHoliday;
    }
    
    logger.debug(`Checking if ${dateToCheck.toDateString()} is a holiday among ${events.length} events`);
    
    // Filter events to only include holidays for more efficient debugging
    const holidayEvents = events.filter(event => event.type === 'holiday');
    logger.debug(`Found ${holidayEvents.length} holiday events to check against`);
    
    const isHoliday = events.some(event => {
      if (event.type !== 'holiday') return false;
      
      const eventStart = new Date(event.start);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(event.end);
      eventEnd.setHours(0, 0, 0, 0);
      
      const isInRange = dateToCheck >= eventStart && dateToCheck <= eventEnd;
      
      return isInRange;
    });
    
    // Cache the result
    HolidayChecker.cache.set(cacheKey, { isHoliday, timestamp: Date.now() });
    
    return isHoliday;
  }
} 
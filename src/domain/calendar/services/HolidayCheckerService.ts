import { CalendarEvent } from '../entities/CalendarEvent';
import { HolidayChecker } from './HolidayChecker';

export class HolidayCheckerService implements HolidayChecker {
  private cache = new Map<string, boolean>();

  public isHoliday(currentDate: Date, holidayEvents: CalendarEvent[]): boolean {
    // Sort by ID for stable cache key, though start/end changes would also be needed for perfect key if holidays could change content
    const cacheKey = `${currentDate.toISOString()}_${holidayEvents.map(h => h.id).sort().join(',')}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    for (const holiday of holidayEvents) {
      // holiday.start and holiday.end are Date objects from CalendarEvent instances,
      // representing the precise UTC start and end of the holiday period.
      if (currentDate.getTime() >= holiday.start.getTime() && currentDate.getTime() <= holiday.end.getTime()) {
        this.cache.set(cacheKey, true);
        return true;
      }
    }

    this.cache.set(cacheKey, false);
    return false;
  }

  public clearCache(): void {
    // ... existing code ...
  }
} 
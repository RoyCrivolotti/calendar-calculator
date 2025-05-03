import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';

export class HolidayChecker {
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
    
    return events.some(event => {
      if (event.type !== 'holiday') return false;
      
      const eventStart = new Date(event.start);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(event.end);
      eventEnd.setHours(0, 0, 0, 0);
      
      return dateToCheck >= eventStart && dateToCheck <= eventEnd;
    });
  }

  /**
   * Checks if a given date is a holiday based on existing sub-events.
   * This is more efficient than checking all events when sub-events exist.
   * 
   * @param date The date to check
   * @param subEvents All sub-events
   * @returns True if the date is a holiday, false otherwise
   */
  static isHolidayFromSubEvents(date: Date, subEvents: SubEvent[]): boolean {
    const dateToCheck = new Date(date);
    // Reset time to ensure we only compare calendar dates
    dateToCheck.setHours(0, 0, 0, 0);
    
    // Check if there's a sub-event for this day that is marked as a holiday
    return subEvents.some(subEvent => {
      // Only check sub-events from holiday parent events
      if (subEvent.type !== 'holiday') return false;
      
      const subEventStart = new Date(subEvent.start);
      subEventStart.setHours(0, 0, 0, 0);
      
      // Check if the date matches the sub-event's start date
      return dateToCheck.getTime() === subEventStart.getTime();
    });
  }
} 
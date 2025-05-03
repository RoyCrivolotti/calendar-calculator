import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { logger } from '../../../utils/logger';

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
    
    logger.debug(`Checking if ${dateToCheck.toDateString()} is a holiday among ${events.length} events`);
    
    // Filter events to only include holidays for more efficient debugging
    const holidayEvents = events.filter(event => event.type === 'holiday');
    logger.debug(`Found ${holidayEvents.length} holiday events to check against`);
    
    // Output all holiday events for debugging
    if (holidayEvents.length > 0) {
      holidayEvents.forEach(holiday => {
        const start = new Date(holiday.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(holiday.end);
        end.setHours(0, 0, 0, 0);
        logger.debug(`Holiday: ${holiday.id} from ${start.toDateString()} to ${end.toDateString()}`);
      });
    }
    
    const isHoliday = events.some(event => {
      if (event.type !== 'holiday') return false;
      
      const eventStart = new Date(event.start);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(event.end);
      eventEnd.setHours(0, 0, 0, 0);
      
      const isInRange = dateToCheck >= eventStart && dateToCheck <= eventEnd;
      
      if (isInRange) {
        logger.debug(`${dateToCheck.toDateString()} IS a holiday - matched holiday event ${event.id}`);
      }
      
      return isInRange;
    });
    
    if (!isHoliday) {
      logger.debug(`${dateToCheck.toDateString()} is NOT a holiday`);
    }
    
    return isHoliday;
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
import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { isWeekend, isNightShift, isOfficeHours } from '../../../utils/calendarUtils';
import { HolidayChecker } from './HolidayChecker';

export class SubEventFactory {
  generateSubEvents(event: CalendarEvent, allEvents: CalendarEvent[]): SubEvent[] {
    const subEvents: SubEvent[] = [];
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    // Create hourly sub-events
    const currentTime = new Date(start);
    currentTime.setMinutes(0, 0, 0); // Round to the nearest hour start
    
    while (currentTime < end) {
      // Determine the end of this sub-event (1 hour later or the end of the parent event)
      const nextHour = new Date(currentTime);
      nextHour.setHours(nextHour.getHours() + 1);
      const subEventEnd = nextHour > end ? end : nextHour;
      
      // Skip creating sub-events that are less than 1 minute long
      if (subEventEnd.getTime() - currentTime.getTime() < 60000) {
        currentTime.setTime(nextHour.getTime());
        continue;
      }
      
      // Determine the properties of this hour
      const isWeekendHour = isWeekend(currentTime);
      const isHolidayHour = HolidayChecker.isHoliday(currentTime, allEvents);
      const isNightShiftHour = isNightShift(currentTime, subEventEnd);
      const isOfficeHoursTime = isOfficeHours(currentTime);
      
      console.debug(`Creating sub-event for ${currentTime.toISOString()}: isWeekend=${isWeekendHour}, isHoliday=${isHolidayHour}, isNightShift=${isNightShiftHour}, isOfficeHours=${isOfficeHoursTime}`);
      
      // Create the sub-event
      const subEvent = SubEvent.create({
        id: crypto.randomUUID(),
        parentEventId: event.id,
        start: currentTime,
        end: subEventEnd,
        isWeekday: !isWeekendHour && !isHolidayHour,
        isWeekend: isWeekendHour || isHolidayHour,
        isHoliday: isHolidayHour,
        isNightShift: isNightShiftHour,
        isOfficeHours: isOfficeHoursTime,
        type: event.type
      });
      
      subEvents.push(subEvent);
      
      // Move to the next hour
      currentTime.setTime(nextHour.getTime());
    }
    
    return subEvents;
  }
} 
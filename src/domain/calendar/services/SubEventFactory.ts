import { CalendarEvent } from '../entities/CalendarEvent';
import { SubEvent } from '../entities/SubEvent';
import { isWeekend, isNightShift, isOfficeHours } from '../../../utils/calendarUtils';
import { HolidayChecker } from './HolidayChecker';
import { logger } from '../../../utils/logger';

export class SubEventFactory {
  generateSubEvents(event: CalendarEvent, holidayEvents: CalendarEvent[]): SubEvent[] {
    const subEvents: SubEvent[] = [];
    const start = new Date(event.start);
    const end = new Date(event.end);
    
    logger.info(`Generating sub-events for ${event.type} event: ${start.toISOString()} - ${end.toISOString()}`);
    
    // Log holiday events for debugging
    logger.info(`Received ${holidayEvents.length} holiday events for checking.`);
    holidayEvents.forEach(holiday => {
      logger.info(`Holiday: ${holiday.id}, Start: ${new Date(holiday.start).toLocaleDateString()}, End: ${new Date(holiday.end).toLocaleDateString()}`);
    });
    
    // Determine the list of holidays to actually check against
    let effectiveHolidayEvents = [...holidayEvents]; // Start with a copy
    if (event.type === 'holiday') {
      // If the event being processed is a holiday, ensure it's in the list
      // for checking its own sub-event dates against.
      if (!effectiveHolidayEvents.find(h => h.id === event.id)) {
        effectiveHolidayEvents.push(event);
      }
    }
    
    // Create hourly sub-events
    const currentTime = new Date(start);
    currentTime.setMinutes(0, 0, 0);
    
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
      // Use effectiveHolidayEvents for the check
      const isHolidayHour = HolidayChecker.isHoliday(currentTime, effectiveHolidayEvents);
      const isNightShiftHour = isNightShift(currentTime, subEventEnd);
      // Check office hours - but never consider holidays as office hours
      const isOfficeHoursTime = !isHolidayHour && isOfficeHours(currentTime);
      
      const hourString = `${currentTime.getHours().toString().padStart(2, '0')}:00`;
      logger.debug(`Sub-event at ${hourString}: Weekend: ${isWeekendHour}, Holiday: ${isHolidayHour}, Night Shift: ${isNightShiftHour}, Office Hours: ${isOfficeHoursTime}`);
      
      // If a day is both a weekend and a holiday, we keep isWeekend as true
      // In either case, we treat holidays like weekends for compensation purposes
      
      // Create the sub-event
      const subEvent = SubEvent.create({
        id: crypto.randomUUID(),
        parentEventId: event.id,
        start: new Date(currentTime),
        end: new Date(subEventEnd),
        isWeekday: !isWeekendHour && !isHolidayHour,
        isWeekend: isWeekendHour || isHolidayHour, // Treat holidays as weekends for compensation
        isHoliday: isHolidayHour,
        isNightShift: isNightShiftHour,
        isOfficeHours: isOfficeHoursTime,
        type: event.type
      });
      
      subEvents.push(subEvent);
      
      // Move to the next hour
      currentTime.setTime(nextHour.getTime());
    }
    
    logger.info(`Generated ${subEvents.length} sub-events for ${event.type} event`);
    
    // Log detailed sub-event stats for debugging
    const weekdaySubEvents = subEvents.filter(se => se.isWeekday);
    const weekendSubEvents = subEvents.filter(se => se.isWeekend);
    const holidaySubEvents = subEvents.filter(se => se.isHoliday);
    const nightShiftSubEvents = subEvents.filter(se => se.isNightShift);
    const officeHoursSubEvents = subEvents.filter(se => se.isOfficeHours);
    
    logger.info(`Sub-event breakdown:
      - Weekday: ${weekdaySubEvents.length}
      - Weekend/Holiday: ${weekendSubEvents.length}
      - Holiday specifically: ${holidaySubEvents.length}
      - Night Shift: ${nightShiftSubEvents.length}
      - Office Hours: ${officeHoursSubEvents.length}`);
    
    return subEvents;
  }
} 
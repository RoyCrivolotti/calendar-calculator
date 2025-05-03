import { OFFICE_HOURS } from '../domain/calendar/constants/CompensationRates';
import { logger } from './logger';

export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Determines if a time period is during night shift hours (22:00-6:00)
 * Only checks the starting hour to determine if it's a night shift
 */
export const isNightShift = (start: Date, end: Date): boolean => {
  const startHour = start.getHours();
  
  // Night shift is from 22:00 to 6:00
  const isNight = startHour >= 22 || startHour < 6;
  
  logger.debug(`isNightShift check: ${start.toISOString()} (hour: ${startHour}) => ${isNight}`);
  
  return isNight;
};

export const isOfficeHours = (date: Date): boolean => {
  const hour = date.getHours();
  const day = date.getDay();
  
  // Check if it's a weekday in the OFFICE_HOURS.days array and between OFFICE_HOURS.start and OFFICE_HOURS.end
  const isWorkingDay = OFFICE_HOURS.days.includes(day);
  const isDuringWorkingHours = hour >= OFFICE_HOURS.start && hour < OFFICE_HOURS.end;
  const result = isWorkingDay && isDuringWorkingHours;
  
  // Add more detailed debugging
  const timeString = `${hour.toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[day];
  
  logger.debug(
    `isOfficeHours: ${date.toISOString()} (${dayName} ${timeString}) => ` +
    `isWorkingDay: ${isWorkingDay}, isDuringWorkingHours: ${isDuringWorkingHours}, RESULT: ${result}`
  );
  
  return result;
};

export const calculateCompensatedHours = (start: Date, end: Date, isOnCall: boolean): number => {
  let totalHours = 0;
  let current = new Date(start);

  while (current < end) {
    const nextHour = new Date(current);
    nextHour.setHours(current.getHours() + 1);

    // If the next hour would be past the end time, use the end time
    const segmentEnd = nextHour > end ? end : nextHour;

    // Only count hours outside office hours (9am-6pm on weekdays)
    if (!isOfficeHours(current)) {
      const hoursInSegment = (segmentEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
      totalHours += hoursInSegment;
    }

    current = nextHour;
  }

  // For incidents, round up to the nearest hour
  if (!isOnCall) {
    totalHours = Math.ceil(totalHours);
  }

  return totalHours;
};

/**
 * Calculates how many hours within a time period fall during night shift hours (22:00-6:00)
 */
export const calculateNightShiftHours = (start: Date, end: Date): number => {
  if (!isNightShift(start, end)) return 0;
  
  const startHour = start.getHours();
  const endHour = end.getHours();
  let nightHours = 0;

  // Calculate hours between 22:00 and 06:00
  if (startHour >= 22) {
    nightHours += Math.min(endHour, 6) + (24 - startHour);
  } else if (startHour < 6) {
    nightHours += Math.min(endHour, 6) - startHour;
  }

  return nightHours;
};

export const calculateTotalHours = (start: Date, end: Date): number => {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
};

/**
 * Returns a standardized string key for a month in format 'YYYY-M'
 */
export const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
};

/**
 * Creates a date object representing the first day of the month at midnight
 */
export const createMonthDate = (date: Date): Date => {
  const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
  monthDate.setHours(0, 0, 0, 0);
  return monthDate;
};

/**
 * Returns true if two dates are in the same month
 */
export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() && 
         date1.getMonth() === date2.getMonth();
};

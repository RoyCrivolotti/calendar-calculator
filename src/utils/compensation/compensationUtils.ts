/**
 * Utility functions for compensation calculations
 */
import { logger } from '../logger';

/**
 * Extracts hours data from compensation description string
 * @param description The description string to parse
 * @returns Object containing extracted hours data
 */
export const extractHoursData = (description: string): { 
  weekday: number, 
  weekend: number, 
  nightShift: number, 
  weekendNight: number 
} => {
  try {
    const match = description.match(/\((.+?)\)/);
    if (!match) return { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    const parts = match[1].split(',').map(s => s.trim());
    
    const result = { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    parts.forEach(part => {
      const [hoursStr, ...typeParts] = part.split(' ');
      const type = typeParts.join(' '); // Rejoin in case there are spaces in the type
      const hours = parseFloat(hoursStr);
      
      if (type.includes('weekday') && !type.includes('night')) {
        result.weekday = hours;
      } else if (type.includes('weekend') && !type.includes('night')) {
        result.weekend = hours;
      } else if (type.includes('weekday') && type.includes('night')) {
        result.nightShift = hours;
      } else if (type.includes('weekend') && type.includes('night')) {
        result.weekendNight = hours;
      }
    });
    
    return result;
  } catch (error) {
    logger.error('Error parsing hours:', error);
    return { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
  }
};

/**
 * Calculates the total hours from hours data
 * @param hoursData The hours data object
 * @returns Total hours
 */
export const calculateTotalHours = (hoursData: { 
  weekday: number, 
  weekend: number, 
  nightShift: number, 
  weekendNight: number 
}): number => {
  return hoursData.weekday + hoursData.weekend + hoursData.nightShift + hoursData.weekendNight;
};

/**
 * Gets the combined billable weekday hours for incidents
 * @param description The description string to parse
 * @returns Billable weekday hours
 */
export const getIncidentBillableWeekdayHours = (description: string): number => {
  const hours = extractHoursData(description);
  // For incident charts, weekday hours should include both regular weekday and night shift hours
  return hours.weekday + hours.nightShift;
};

/**
 * Gets the combined weekend hours for incidents
 * @param description The description string to parse
 * @returns Weekend hours
 */
export const getIncidentWeekendHours = (description: string): number => {
  const hours = extractHoursData(description);
  // Combine regular weekend hours and weekend night hours
  return hours.weekend + hours.weekendNight;
}; 
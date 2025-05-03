export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

/**
 * Determines if a time period is during night shift hours (22:00-6:00)
 * Only checks the starting hour to determine if it's a night shift
 */
export const isNightShift = (start: Date, end: Date): boolean => {
  // Only check the starting hour to determine if it's a night shift
  const startHour = start.getHours();
  
  // Night shift is from 22:00 to 6:00
  return startHour >= 22 || startHour < 6;
};

export const isOfficeHours = (date: Date): boolean => {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const day = date.getDay();
  const timeInMinutes = hour * 60 + minutes;
  
  // Check if it's a weekday (1-5) and between 9am (540 minutes) and 5pm (1020 minutes)
  // Note: 5pm is 17:00 which is 17*60 = 1020 minutes
  const isWeekday = day >= 1 && day <= 5;
  const isDuringWorkingHours = timeInMinutes >= 540 && timeInMinutes < 1020;
  const result = isWeekday && isDuringWorkingHours;
  
  // Add more detailed debugging
  const timeString = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[day];
  
  console.debug(
    `isOfficeHours: ${date.toISOString()} (${dayName} ${timeString}) => ` +
    `isWeekday: ${isWeekday}, isDuringWorkingHours: ${isDuringWorkingHours}, RESULT: ${result}`
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

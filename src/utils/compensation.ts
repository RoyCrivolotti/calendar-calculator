import { CalendarEvent } from '../types/calendar';
import { isWeekend, startOfHour, eachHourOfInterval } from 'date-fns';

interface HourBlock {
  isOnCall: boolean;
  isIncident: boolean;
  isNightShift: boolean;
  isWeekend: boolean;
}

export interface MonthlyCompensation {
  weekdayHours: number;
  weekendHours: number;
  totalCompensation: number;
  nightShiftHours: number;
  weekdayOnCallHours: number;
  weekendOnCallHours: number;
  weekdayIncidentHours: number;
  weekendIncidentHours: number;
  breakdown: {
    weekdayOnCallCompensation: number;
    weekendOnCallCompensation: number;
    weekdayIncidentCompensation: number;
    weekendIncidentCompensation: number;
    nightShiftIncidentBonus: number;
  };
}

export const calculateMonthlyCompensation = (
  events: CalendarEvent[]
): MonthlyCompensation => {
  const rates = defaultRates;
  const hourBlocks = new Map<number, HourBlock>();

  const getEffectiveHourRange = (start: Date, end: Date): Date[] =>
    eachHourOfInterval({ start: startOfHour(start), end: new Date(end.getTime() - 1) });

  // Process on-call events
  events
    .filter(event => event.type === 'oncall')
    .forEach(event => {
      const hours = getEffectiveHourRange(event.start, event.end);

      hours.forEach(hour => {
        const timestamp = hour.getTime();
        hourBlocks.set(timestamp, {
          isOnCall: true,
          isIncident: false,
          isNightShift: hour.getHours() >= 22 || hour.getHours() < 7,
          isWeekend: isWeekend(hour)
        });
      });
    });

  // Process incident events
  events
    .filter(event => event.type === 'incident')
    .forEach(event => {
      const hours = getEffectiveHourRange(event.start, event.end);

      hours.forEach(hour => {
        // Skip office hours (9am-6pm on weekdays)
        if (!isWeekend(hour) && hour.getHours() >= 9 && hour.getHours() < 18) {
          return;
        }

        const timestamp = hour.getTime();
        const existing = hourBlocks.get(timestamp);
        
        if (existing) {
          existing.isIncident = true;
        } else {
          // Create a new block for incident hours even if there's no on-call
          hourBlocks.set(timestamp, {
            isOnCall: false,
            isIncident: true,
            isNightShift: hour.getHours() >= 22 || hour.getHours() < 7,
            isWeekend: isWeekend(hour)
          });
        }
      });
    });

  // Totals
  let totalWeekdayOnCallHours = 0;
  let totalWeekendOnCallHours = 0;
  let totalNightShiftHours = 0;
  let weekdayIncidentHours = 0;
  let weekendIncidentHours = 0;
  let weekdayNightShiftIncidentHours = 0;
  let weekendNightShiftIncidentHours = 0;

  hourBlocks.forEach((block) => {
    if (block.isIncident) {
      if (block.isWeekend) {
        if (block.isNightShift) {
          weekendNightShiftIncidentHours++;
        } else {
          weekendIncidentHours++;
        }
      } else {
        if (block.isNightShift) {
          weekdayNightShiftIncidentHours++;
        } else {
          weekdayIncidentHours++;
        }
      }
    }

    if (block.isOnCall) {
      if (block.isWeekend) {
        totalWeekendOnCallHours++;
      } else {
        totalWeekdayOnCallHours++;
      }

      if (block.isNightShift) {
        totalNightShiftHours++;
      }
    }
  });
  
  // Compensation calculations
  const weekdayOnCallCompensation = totalWeekdayOnCallHours * rates.weekdayOnCallRate;
  const weekendOnCallCompensation = totalWeekendOnCallHours * rates.weekendOnCallRate;

  // Regular incident hours (without night shift)
  const weekdayIncidentCompensation = weekdayIncidentHours *
    rates.baseHourlySalary * rates.weekdayIncidentMultiplier;

  const weekendIncidentCompensation = weekendIncidentHours *
    rates.baseHourlySalary * rates.weekendIncidentMultiplier;

  // Night shift incident hours (with full multipliers)
  const nightShiftIncidentCompensation =
    weekdayNightShiftIncidentHours * rates.baseHourlySalary * rates.weekdayIncidentMultiplier * rates.nightShiftBonusMultiplier +
    weekendNightShiftIncidentHours * rates.baseHourlySalary * rates.weekendIncidentMultiplier * rates.nightShiftBonusMultiplier;

  const totalCompensation =
    weekdayOnCallCompensation +
    weekendOnCallCompensation +
    weekdayIncidentCompensation +
    weekendIncidentCompensation +
    nightShiftIncidentCompensation;

  return {
    weekdayHours: totalWeekdayOnCallHours,
    weekendHours: totalWeekendOnCallHours,
    totalCompensation,
    nightShiftHours: totalNightShiftHours,
    weekdayOnCallHours: totalWeekdayOnCallHours,
    weekendOnCallHours: totalWeekendOnCallHours,
    weekdayIncidentHours: weekdayIncidentHours,
    weekendIncidentHours: weekendIncidentHours,
    breakdown: {
      weekdayOnCallCompensation,
      weekendOnCallCompensation,
      weekdayIncidentCompensation,
      weekendIncidentCompensation,
      nightShiftIncidentBonus: nightShiftIncidentCompensation
    }
  };
};
export const defaultRates = {
  weekdayOnCallRate: 3.90,
  weekendOnCallRate: 7.34,
  baseHourlySalary: 35.58,
  weekdayIncidentMultiplier: 1.8,
  weekendIncidentMultiplier: 2.0,
  nightShiftBonusMultiplier: 1.4,
};


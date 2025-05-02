import { CalendarEvent } from '../entities/CalendarEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';

const RATES = {
  weekdayOnCallRate: 3.90,      // €3.90/hr for weekday on-call outside office hours
  weekendOnCallRate: 7.34,      // €7.34/hr for weekend on-call
  baseHourlySalary: 35.58,      // €35.58 base hourly salary
  weekdayIncidentMultiplier: 1.8, // 1.8x for weekday incidents
  weekendIncidentMultiplier: 2.0, // 2x for weekend incidents
  nightShiftBonusMultiplier: 1.4  // 1.4x (40% bonus) for night shift incidents
};

const OFFICE_HOURS = {
  start: 9, // 9 AM
  end: 18, // 6 PM
  days: [1, 2, 3, 4, 5] // Monday to Friday (0 is Sunday, 6 is Saturday)
};

export class CompensationCalculator {
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  private isNightShift(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 22 || hour < 6;
  }

  private isHoliday(date: Date, events: CalendarEvent[]): boolean {
    return events.some(event => 
      event.type === 'holiday' && 
      date >= event.start && 
      date < event.end
    );
  }

  private isWithinOfficeHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    
    return OFFICE_HOURS.days.includes(day) && 
           hour >= OFFICE_HOURS.start && 
           hour < OFFICE_HOURS.end;
  }

  private calculateCompensableHours(event: CalendarEvent, allEvents: CalendarEvent[]): { weekday: number; weekend: number; weekdayNightShift: number; weekendNightShift: number } {
    const start = new Date(event.start);
    const end = new Date(event.end);
    let weekdayHours = 0;
    let weekendHours = 0;
    let weekdayNightShiftHours = 0;
    let weekendNightShiftHours = 0;

    // For on-call shifts, we need to handle each day separately
    if (event.type === 'oncall') {
      let currentDay = new Date(start);
      currentDay.setHours(0, 0, 0, 0);
      
      while (currentDay < end) {
        const nextDay = new Date(currentDay);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const isWeekendDay = this.isWeekend(currentDay);
        const isFirstDay = currentDay.getTime() === new Date(start).setHours(0, 0, 0, 0);
        const isLastDay = nextDay.getTime() > end.getTime();
        
        let dayStart = isFirstDay ? start : new Date(currentDay);
        let dayEnd = isLastDay ? end : nextDay;
        
        // Skip office hours (9:00-18:00) on weekdays
        if (!isWeekendDay) {
          const officeStart = new Date(dayStart);
          officeStart.setHours(9, 0, 0, 0);
          const officeEnd = new Date(dayStart);
          officeEnd.setHours(18, 0, 0, 0);
          
          // For first day, if start is before office hours, count from start to office start
          if (isFirstDay && start < officeStart) {
            const preOfficeHours = (officeStart.getTime() - start.getTime()) / (1000 * 60 * 60);
            weekdayHours += preOfficeHours;
          }
          
          // For last day, if end is after office hours, count from office end to end
          if (isLastDay && end > officeEnd) {
            const postOfficeHours = (end.getTime() - officeEnd.getTime()) / (1000 * 60 * 60);
            weekdayHours += postOfficeHours;
          }
          
          // For full days, count from office end to next day's office start
          if (!isFirstDay && !isLastDay) {
            const fullDayHours = 15; // 24 - 9 hours of office time
            weekdayHours += fullDayHours;
          }
        } else {
          // For weekends, count all hours
          const hours = (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
          weekendHours += hours;
        }
        
        currentDay = nextDay;
      }
    } else {
      // For incidents, handle each day separately
      let currentDay = new Date(start);
      currentDay.setHours(0, 0, 0, 0);
      
      while (currentDay < end) {
        const nextDay = new Date(currentDay);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const isWeekendDay = this.isWeekend(currentDay) || this.isHoliday(currentDay, allEvents);
        const isFirstDay = currentDay.getTime() === new Date(start).setHours(0, 0, 0, 0);
        const isLastDay = nextDay.getTime() > end.getTime();
        
        let dayStart = isFirstDay ? start : new Date(currentDay);
        let dayEnd = isLastDay ? end : nextDay;
        
        // For each hour in the day
        for (let d = new Date(dayStart); d < dayEnd; d.setHours(d.getHours() + 1)) {
          const isNightShiftHour = this.isNightShift(d);
          
          if (isWeekendDay) {
            if (isNightShiftHour) {
              weekendNightShiftHours++;
            } else {
              weekendHours++;
            }
          } else {
            if (isNightShiftHour) {
              weekdayNightShiftHours++;
            } else {
              weekdayHours++;
            }
          }
        }
        
        currentDay = nextDay;
      }
    }

    return { weekday: weekdayHours, weekend: weekendHours, weekdayNightShift: weekdayNightShiftHours, weekendNightShift: weekendNightShiftHours };
  }

  private calculateEventCompensation(event: CalendarEvent, allEvents: CalendarEvent[]): { weekday: number; weekend: number; nightShift: number } {
    const hours = this.calculateCompensableHours(event, allEvents);
    let weekdayComp = 0;
    let weekendComp = 0;
    let nightShiftComp = 0;

    if (event.type === 'oncall') {
      weekdayComp = hours.weekday * RATES.weekdayOnCallRate;
      weekendComp = hours.weekend * RATES.weekendOnCallRate;
    } else if (event.type === 'incident') {
      const isWeekend = this.isWeekend(event.start) || this.isHoliday(event.start, allEvents);
      const multiplier = isWeekend ? RATES.weekendIncidentMultiplier : RATES.weekdayIncidentMultiplier;
      
      // Calculate base compensation for regular hours
      weekdayComp = hours.weekday * RATES.baseHourlySalary * multiplier;
      weekendComp = hours.weekend * RATES.baseHourlySalary * multiplier;

      // Add night shift bonus for both weekday and weekend night shifts
      if (hours.weekdayNightShift > 0) {
        nightShiftComp += hours.weekdayNightShift * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1);
      }
      if (hours.weekendNightShift > 0) {
        nightShiftComp += hours.weekendNightShift * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1);
      }
    }

    return { weekday: weekdayComp, weekend: weekendComp, nightShift: nightShiftComp };
  }

  calculateMonthlyCompensation(events: CalendarEvent[], date: Date): CompensationBreakdown[] {
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    
    const monthEvents = events.filter(event => {
      const eventMonthKey = `${event.start.getFullYear()}-${event.start.getMonth() + 1}`;
      const isInMonth = eventMonthKey === monthKey;
      return isInMonth;
    });

    const oncallEvents = monthEvents.filter(event => event.type === 'oncall');
    const incidentEvents = monthEvents.filter(event => event.type === 'incident');

    let totalWeekdayOnCallHours = 0;
    let totalWeekendOnCallHours = 0;
    let totalWeekdayIncidentHours = 0;
    let totalWeekendIncidentHours = 0;
    let totalWeekdayNightShiftHours = 0;
    let totalWeekendNightShiftHours = 0;
    let totalCompensation = 0;

    // Calculate on-call compensation
    oncallEvents.forEach(event => {
      const hours = this.calculateCompensableHours(event, monthEvents);
      totalWeekdayOnCallHours += hours.weekday;
      totalWeekendOnCallHours += hours.weekend;
      const comp = this.calculateEventCompensation(event, monthEvents);
      totalCompensation += comp.weekday + comp.weekend;
    });

    // Calculate incident compensation
    incidentEvents.forEach(event => {
      const hours = this.calculateCompensableHours(event, monthEvents);
      totalWeekdayIncidentHours += hours.weekday;
      totalWeekendIncidentHours += hours.weekend;
      totalWeekdayNightShiftHours += hours.weekdayNightShift;
      totalWeekendNightShiftHours += hours.weekendNightShift;
      const comp = this.calculateEventCompensation(event, monthEvents);
      totalCompensation += comp.weekday + comp.weekend + comp.nightShift;
    });

    const breakdown: CompensationBreakdown[] = [];

    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalWeekdayOnCallHours * RATES.weekdayOnCallRate + totalWeekendOnCallHours * RATES.weekendOnCallRate,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours}h weekday, ${totalWeekendOnCallHours}h weekend)`
      });
    }

    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0 || totalWeekdayNightShiftHours > 0 || totalWeekendNightShiftHours > 0) {
      breakdown.push({
        type: 'incident',
        amount: totalWeekdayIncidentHours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier +
                totalWeekendIncidentHours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier +
                totalWeekdayNightShiftHours * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1) +
                totalWeekendNightShiftHours * RATES.baseHourlySalary * (RATES.nightShiftBonusMultiplier - 1),
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night shift, ${totalWeekendNightShiftHours}h weekend night shift)`
      });
    }

    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation'
      });
    }

    return breakdown;
  }

  calculateTotalCompensation(events: CalendarEvent[]): number {
    return events.reduce((total, event) => {
      const comp = this.calculateEventCompensation(event, events);
      return total + comp.weekday + comp.weekend + comp.nightShift;
    }, 0);
  }
} 
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
      
      // Add debug logs
      console.debug(`Calculating on-call hours for ${start.toISOString()} to ${end.toISOString()}`);
      
      while (currentDay < end) {
        const nextDay = new Date(currentDay);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const isWeekendDay = this.isWeekend(currentDay);
        const isFirstDay = currentDay.getTime() === new Date(start).setHours(0, 0, 0, 0);
        const isLastDay = nextDay.getTime() > end.getTime();
        
        let dayStart = isFirstDay ? start : new Date(currentDay);
        let dayEnd = isLastDay ? end : nextDay;
        
        console.debug(`Processing day: ${currentDay.toISOString()} (${isWeekendDay ? 'Weekend' : 'Weekday'}), first day: ${isFirstDay}, last day: ${isLastDay}`);
        
        // For weekdays, handle office hours
        if (!isWeekendDay) {
          const officeStart = new Date(dayStart);
          officeStart.setHours(OFFICE_HOURS.start, 0, 0, 0);
          const officeEnd = new Date(dayStart);
          officeEnd.setHours(OFFICE_HOURS.end, 0, 0, 0);
          
          // Special case: 24-hour shift (midnight to midnight on the same day)
          if (isFirstDay && isLastDay && 
              start.getHours() === 0 && start.getMinutes() === 0 &&
              end.getHours() === 0 && end.getMinutes() === 0 &&
              end.getDate() === start.getDate() + 1) {
            
            // For a 24h shift, we count all hours outside of office hours
            const morningHours = OFFICE_HOURS.start; // Hours from midnight to office start
            const eveningHours = 24 - OFFICE_HOURS.end; // Hours from office end to midnight
            weekdayHours += morningHours + eveningHours;
            console.debug(`  24-hour shift detected - Adding non-office hours: ${morningHours + eveningHours}h (${morningHours}h morning + ${eveningHours}h evening)`);
            
          } else {
            // Normal cases - partial days
            // For first day, if start is before office hours, count from start to office start
            if (isFirstDay && start < officeStart) {
              const preOfficeHours = (officeStart.getTime() - start.getTime()) / (1000 * 60 * 60);
              weekdayHours += preOfficeHours;
              console.debug(`  Before office hours: ${preOfficeHours.toFixed(2)}h`);
            }
            
            // For last day, if end is after office hours, count from office end to end
            if (isLastDay && end > officeEnd) {
              const postOfficeHours = (end.getTime() - officeEnd.getTime()) / (1000 * 60 * 60);
              weekdayHours += postOfficeHours;
              console.debug(`  After office hours: ${postOfficeHours.toFixed(2)}h`);
            }
          }
          
          // For full days that are neither first nor last, count standard non-office hours
          if (!isFirstDay && !isLastDay) {
            const morningHours = OFFICE_HOURS.start; // Hours from midnight to office start
            const eveningHours = 24 - OFFICE_HOURS.end; // Hours from office end to midnight
            weekdayHours += morningHours + eveningHours;
            console.debug(`  Full day non-office hours: ${morningHours + eveningHours}h (${morningHours}h morning + ${eveningHours}h evening)`);
          }
        } else {
          // For weekends, count all hours
          const hours = (dayEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
          weekendHours += hours;
          console.debug(`  Weekend hours: ${hours.toFixed(2)}h`);
        }
        
        currentDay = nextDay;
      }
      
      console.debug(`Total calculated hours - Weekday: ${weekdayHours.toFixed(2)}h, Weekend: ${weekendHours.toFixed(2)}h`);
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
      // Calculate base compensation for regular hours
      weekdayComp = hours.weekday * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier;
      weekendComp = hours.weekend * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier;

      // For night shifts, apply the full multiplier chain (not just the bonus)
      if (hours.weekdayNightShift > 0) {
        // Full calculation: base salary * weekday multiplier * night shift multiplier
        nightShiftComp += hours.weekdayNightShift * RATES.baseHourlySalary * 
                        RATES.weekdayIncidentMultiplier * RATES.nightShiftBonusMultiplier;
        
        // We already counted the base weekday rate, so subtract it
        nightShiftComp -= hours.weekdayNightShift * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier;
      }
      
      if (hours.weekendNightShift > 0) {
        // Full calculation: base salary * weekend multiplier * night shift multiplier
        nightShiftComp += hours.weekendNightShift * RATES.baseHourlySalary * 
                        RATES.weekendIncidentMultiplier * RATES.nightShiftBonusMultiplier;
        
        // We already counted the base weekend rate, so subtract it
        nightShiftComp -= hours.weekendNightShift * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier;
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
      // Calculate each component separately for clarity
      const weekdayRegularComp = totalWeekdayIncidentHours * RATES.baseHourlySalary * RATES.weekdayIncidentMultiplier;
      const weekendRegularComp = totalWeekendIncidentHours * RATES.baseHourlySalary * RATES.weekendIncidentMultiplier;
      
      // Calculate night shift compensation using full multipliers
      const weekdayNightComp = totalWeekdayNightShiftHours * RATES.baseHourlySalary * 
                             RATES.weekdayIncidentMultiplier * RATES.nightShiftBonusMultiplier;
      const weekendNightComp = totalWeekendNightShiftHours * RATES.baseHourlySalary * 
                             RATES.weekendIncidentMultiplier * RATES.nightShiftBonusMultiplier;
      
      const totalIncidentComp = weekdayRegularComp + weekendRegularComp + weekdayNightComp + weekendNightComp;
      
      // Add debug logs
      console.debug(`COMPENSATION BREAKDOWN: Weekend night shift: ${totalWeekendNightShiftHours}h * ${RATES.baseHourlySalary} * ${RATES.weekendIncidentMultiplier} * ${RATES.nightShiftBonusMultiplier} = ${weekendNightComp.toFixed(2)}`);
      
      breakdown.push({
        type: 'incident',
        amount: totalIncidentComp,
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
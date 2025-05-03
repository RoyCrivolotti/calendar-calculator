import { CalendarEvent } from '../entities/CalendarEvent';
import { CompensationBreakdown } from '../types/CompensationBreakdown';
import { COMPENSATION_RATES, OFFICE_HOURS } from '../constants/CompensationRates';

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
      weekdayComp = hours.weekday * COMPENSATION_RATES.weekdayOnCallRate;
      weekendComp = hours.weekend * COMPENSATION_RATES.weekendOnCallRate;
    } else if (event.type === 'incident') {
      // Calculate base compensation for regular hours
      weekdayComp = hours.weekday * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
      weekendComp = hours.weekend * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;

      // For night shifts, apply the full multiplier chain (not just the bonus)
      if (hours.weekdayNightShift > 0) {
        // Full calculation: base salary * weekday multiplier * night shift multiplier
        nightShiftComp += hours.weekdayNightShift * COMPENSATION_RATES.baseHourlySalary * 
                        COMPENSATION_RATES.weekdayIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier;
        
        // We already counted the base weekday rate, so subtract it
        nightShiftComp -= hours.weekdayNightShift * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
      }
      
      if (hours.weekendNightShift > 0) {
        // Full calculation: base salary * weekend multiplier * night shift multiplier
        nightShiftComp += hours.weekendNightShift * COMPENSATION_RATES.baseHourlySalary * 
                        COMPENSATION_RATES.weekendIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier;
        
        // We already counted the base weekend rate, so subtract it
        nightShiftComp -= hours.weekendNightShift * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
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
    
    // Make sure we have a proper date object for the month
    const monthDate = new Date(date);

    if (totalWeekdayOnCallHours > 0 || totalWeekendOnCallHours > 0) {
      breakdown.push({
        type: 'oncall',
        amount: totalWeekdayOnCallHours * COMPENSATION_RATES.weekdayOnCallRate + totalWeekendOnCallHours * COMPENSATION_RATES.weekendOnCallRate,
        count: oncallEvents.length,
        description: `On-call shifts (${totalWeekdayOnCallHours.toFixed(1)}h weekday, ${totalWeekendOnCallHours.toFixed(1)}h weekend)`,
        month: monthDate
      });
    }

    if (totalWeekdayIncidentHours > 0 || totalWeekendIncidentHours > 0 || totalWeekdayNightShiftHours > 0 || totalWeekendNightShiftHours > 0) {
      // Calculate each component separately for clarity
      const weekdayRegularComp = totalWeekdayIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
      const weekendRegularComp = totalWeekendIncidentHours * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekendIncidentMultiplier;
      
      // Calculate night shift compensation using full multipliers
      const weekdayNightComp = totalWeekdayNightShiftHours * COMPENSATION_RATES.baseHourlySalary * 
                             COMPENSATION_RATES.weekdayIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier;
      const weekendNightComp = totalWeekendNightShiftHours * COMPENSATION_RATES.baseHourlySalary * 
                             COMPENSATION_RATES.weekendIncidentMultiplier * COMPENSATION_RATES.nightShiftBonusMultiplier;
      
      const totalIncidentComp = weekdayRegularComp + weekendRegularComp + weekdayNightComp + weekendNightComp;
      
      breakdown.push({
        type: 'incident',
        amount: totalIncidentComp,
        count: incidentEvents.length,
        description: `Incidents (${totalWeekdayIncidentHours}h weekday, ${totalWeekendIncidentHours}h weekend, ${totalWeekdayNightShiftHours}h weekday night shift, ${totalWeekendNightShiftHours}h weekend night shift)`,
        month: monthDate
      });
    }

    if (totalCompensation > 0) {
      breakdown.push({
        type: 'total',
        amount: totalCompensation,
        count: monthEvents.length,
        description: 'Total compensation',
        month: monthDate
      });
    } else if (monthEvents.length > 0) {
      // Even if total compensation is 0, still add a total item if there are events
      // This ensures that the month appears in the summary
      breakdown.push({
        type: 'total',
        amount: 0,
        count: monthEvents.length,
        description: 'No compensation calculated',
        month: monthDate
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
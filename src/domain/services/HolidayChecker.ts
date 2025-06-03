import { CalendarEvent } from '../calendar/entities/CalendarEvent';
import { logger }  from '../../utils/logger';

export class HolidayChecker {
    private holidays: CalendarEvent[];
    private static holidayDateCache: Map<string, boolean> = new Map();

    constructor(holidays: CalendarEvent[]) {
        this.holidays = holidays;
    }

    public isHoliday(date: Date): boolean {
        const inputDateISO = date.toISOString();

        for (const holiday of this.holidays) {
            if (!holiday.start || !holiday.end) {
                logger.warn(`[HolidayChecker] Holiday ${holiday.id} has null or undefined start/end. Skipping.`);
                continue;
            }

            let holidayStart: Date;
            let holidayEnd: Date;

            try {
                holidayStart = new Date(holiday.start);
                holidayEnd = new Date(holiday.end);
            } catch (e) {
                logger.error(`[HolidayChecker] Error parsing holiday dates for ${holiday.id}: ${e}`);
                continue;
            }
            
            if (isNaN(holidayStart.getTime()) || isNaN(holidayEnd.getTime())) {
                logger.warn(`[HolidayChecker] Holiday ${holiday.id} has Invalid Date objects. Raw start: "${holiday.start}", Raw end: "${holiday.end}". Skipping.`);
                continue;
            }

            const holidayDayStart = new Date(holidayStart);
            holidayDayStart.setHours(0, 0, 0, 0);

            const holidayDayEnd = new Date(holidayEnd);
            holidayDayEnd.setHours(23, 59, 59, 999);
            
            const isDateInHolidayRange = date >= holidayDayStart && date <= holidayDayEnd;

            // Extensive logging for the specific holiday f40ad9d3-f518-410f-948d-5e211a59a881
            // and a date that should match, like one on Aug 13, 2025.
            // Example problem date: "2025-08-13T00:00:00.000Z" (which is one of the sub-event slots for the on-call)
            if (holiday.id === 'f40ad9d3-f518-410f-948d-5e211a59a881' && inputDateISO.startsWith('2025-08-13')) {
                logger.info(`[HolidayChecker DIAGNOSTIC holiday ${holiday.id}]`);
                logger.info(`  Input Date (UTC): ${inputDateISO}`);
                logger.info(`  Holiday Raw Start: ${JSON.stringify(holiday.start)}, End: ${JSON.stringify(holiday.end)}`);
                logger.info(`  Holiday Parsed Start (UTC): ${holidayStart.toISOString()}, End (UTC): ${holidayEnd.toISOString()}`);
                logger.info(`  Holiday Effective Day Start (Local then UTC): ${holidayDayStart.toISOString()}`);
                logger.info(`  Holiday Effective Day End (Local then UTC): ${holidayDayEnd.toISOString()}`);
                logger.info(`  Comparison: inputDate (${date.getTime()}) >= holidayDayStart (${holidayDayStart.getTime()}) -> ${date >= holidayDayStart}`);
                logger.info(`  Comparison: inputDate (${date.getTime()}) <= holidayDayEnd (${holidayDayEnd.getTime()}) -> ${date <= holidayDayEnd}`);
                logger.info(`  Result for this holiday: ${isDateInHolidayRange}`);
            }

            if (isDateInHolidayRange) {
                return true;
            }
        }

        return false;
    }
} 
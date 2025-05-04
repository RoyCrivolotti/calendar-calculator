import { describe, it, expect } from 'vitest';
import {
  isWeekend,
  isNightShift,
  isOfficeHours,
  calculateNightShiftHours,
  calculateOfficeHours,
  calculateWeekendHours,
  getMonthKey,
  createMonthDate
} from '../../utils/calendarUtils';

describe('calendarUtils', () => {
  describe('isWeekend', () => {
    it('should identify weekdays correctly', () => {
      const monday = new Date('2024-01-01T12:00:00'); // Monday
      const wednesday = new Date('2024-01-03T12:00:00'); // Wednesday
      const friday = new Date('2024-01-05T12:00:00'); // Friday

      expect(isWeekend(monday)).toBe(false);
      expect(isWeekend(wednesday)).toBe(false);
      expect(isWeekend(friday)).toBe(false);
    });

    it('should identify weekends correctly', () => {
      const saturday = new Date('2024-01-06T12:00:00'); // Saturday
      const sunday = new Date('2024-01-07T12:00:00'); // Sunday

      expect(isWeekend(saturday)).toBe(true);
      expect(isWeekend(sunday)).toBe(true);
    });
  });

  describe('isNightShift', () => {
    it('should identify night shift hours correctly', () => {
      const nightStart = new Date('2024-01-01T22:00:00');
      const earlyMorning = new Date('2024-01-02T05:00:00');
      const dayTime = new Date('2024-01-02T14:00:00');

      expect(isNightShift(nightStart)).toBe(true);
      expect(isNightShift(earlyMorning)).toBe(true);
      expect(isNightShift(dayTime)).toBe(false);
    });

    it('should handle edge cases', () => {
      const startOfNight = new Date('2024-01-01T17:00:00');
      const endOfNight = new Date('2024-01-02T09:00:00');
      const justBeforeNight = new Date('2024-01-01T16:59:00');

      expect(isNightShift(startOfNight)).toBe(true);
      expect(isNightShift(endOfNight)).toBe(true);
      expect(isNightShift(justBeforeNight)).toBe(false);
    });
  });

  describe('isOfficeHours', () => {
    it('should identify office hours correctly', () => {
      const morningStart = new Date('2024-01-01T09:00:00');
      const middleOfDay = new Date('2024-01-01T13:00:00');
      const endOfDay = new Date('2024-01-01T17:00:00');

      expect(isOfficeHours(morningStart)).toBe(true);
      expect(isOfficeHours(middleOfDay)).toBe(true);
      expect(isOfficeHours(endOfDay)).toBe(true);
    });

    it('should identify non-office hours correctly', () => {
      const beforeOfficeHours = new Date('2024-01-01T08:59:00');
      const afterOfficeHours = new Date('2024-01-01T17:01:00');
      const nightTime = new Date('2024-01-01T22:00:00');

      expect(isOfficeHours(beforeOfficeHours)).toBe(false);
      expect(isOfficeHours(afterOfficeHours)).toBe(false);
      expect(isOfficeHours(nightTime)).toBe(false);
    });
  });

  describe('calculateNightShiftHours', () => {
    it('should calculate night shift hours within the same day', () => {
      const start = new Date('2024-01-01T22:00:00');
      const end = new Date('2024-01-02T06:00:00');

      expect(calculateNightShiftHours(start, end)).toBe(8);
    });

    it('should calculate night shift hours across multiple days', () => {
      const start = new Date('2024-01-01T17:00:00');
      const end = new Date('2024-01-03T09:00:00');

      // 7 hours (17:00-00:00) + 24 hours + 9 hours (00:00-09:00) = 40 hours
      expect(calculateNightShiftHours(start, end)).toBe(40);
    });

    it('should handle non-night shift hours', () => {
      const start = new Date('2024-01-01T09:00:00');
      const end = new Date('2024-01-01T17:00:00');

      expect(calculateNightShiftHours(start, end)).toBe(0);
    });
  });

  describe('calculateOfficeHours', () => {
    it('should calculate office hours within the same day', () => {
      const start = new Date('2024-01-01T09:00:00');
      const end = new Date('2024-01-01T17:00:00');

      expect(calculateOfficeHours(start, end)).toBe(8);
    });

    it('should calculate office hours across multiple days', () => {
      const start = new Date('2024-01-01T09:00:00');
      const end = new Date('2024-01-03T17:00:00');

      // 8 hours per day for 3 days = 24 hours
      expect(calculateOfficeHours(start, end)).toBe(24);
    });

    it('should handle partial office hours', () => {
      const start = new Date('2024-01-01T11:00:00');
      const end = new Date('2024-01-01T15:00:00');

      expect(calculateOfficeHours(start, end)).toBe(4);
    });
  });

  describe('calculateWeekendHours', () => {
    it('should calculate weekend hours correctly', () => {
      const start = new Date('2024-01-06T00:00:00'); // Saturday
      const end = new Date('2024-01-07T23:59:59'); // Sunday

      expect(calculateWeekendHours(start, end)).toBe(48); // 2 full days
    });

    it('should handle partial weekend hours', () => {
      const start = new Date('2024-01-05T17:00:00'); // Friday evening
      const end = new Date('2024-01-06T09:00:00'); // Saturday morning

      expect(calculateWeekendHours(start, end)).toBe(9); // 9 hours on Saturday
    });

    it('should handle non-weekend hours', () => {
      const start = new Date('2024-01-01T09:00:00'); // Monday
      const end = new Date('2024-01-05T17:00:00'); // Friday

      expect(calculateWeekendHours(start, end)).toBe(0);
    });
  });

  describe('getMonthKey', () => {
    it('should generate correct month keys', () => {
      const january = new Date('2024-01-15');
      const december = new Date('2024-12-25');

      expect(getMonthKey(january)).toBe('2024-01');
      expect(getMonthKey(december)).toBe('2024-12');
    });

    it('should handle single digit months', () => {
      const may = new Date('2024-05-01');
      const september = new Date('2024-09-30');

      expect(getMonthKey(may)).toBe('2024-05');
      expect(getMonthKey(september)).toBe('2024-09');
    });
  });

  describe('createMonthDate', () => {
    it('should create correct month dates', () => {
      const date = new Date('2024-01-15T14:30:00');
      const monthDate = createMonthDate(date);

      expect(monthDate.getFullYear()).toBe(2024);
      expect(monthDate.getMonth()).toBe(0); // January
      expect(monthDate.getDate()).toBe(1);
      expect(monthDate.getHours()).toBe(0);
      expect(monthDate.getMinutes()).toBe(0);
      expect(monthDate.getSeconds()).toBe(0);
      expect(monthDate.getMilliseconds()).toBe(0);
    });

    it('should handle different months', () => {
      const december = new Date('2024-12-25T23:59:59');
      const monthDate = createMonthDate(december);

      expect(monthDate.getFullYear()).toBe(2024);
      expect(monthDate.getMonth()).toBe(11); // December
      expect(monthDate.getDate()).toBe(1);
      expect(monthDate.getHours()).toBe(0);
      expect(monthDate.getMinutes()).toBe(0);
      expect(monthDate.getSeconds()).toBe(0);
      expect(monthDate.getMilliseconds()).toBe(0);
    });
  });
}); 
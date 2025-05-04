import { describe, it, expect, beforeEach } from 'vitest';
import { CompensationService } from '../../domain/calendar/services/CompensationService';
import { createTestSubEvent } from '../setup';

describe('CompensationService', () => {
  let service: CompensationService;

  beforeEach(() => {
    service = new CompensationService();
  });

  describe('calculateTotalCompensation', () => {
    it('should calculate total compensation for a list of sub events', () => {
      const subEvents = [
        // Weekday office hours (8 hours at base rate)
        createTestSubEvent({
          start: new Date('2024-01-01T09:00:00'),
          end: new Date('2024-01-01T17:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        }),
        // Weekend (8 hours at 2x rate)
        createTestSubEvent({
          start: new Date('2024-01-06T09:00:00'),
          end: new Date('2024-01-06T17:00:00'),
          isWeekday: false,
          isWeekend: true,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        }),
        // Night shift (8 hours at 1.5x rate)
        createTestSubEvent({
          start: new Date('2024-01-02T22:00:00'),
          end: new Date('2024-01-03T06:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: true,
          isOfficeHours: false
        })
      ];

      const total = service.calculateTotalCompensation(subEvents);
      // 8 + 16 + 12 = 36 hours equivalent
      expect(total).toBe(36);
    });

    it('should handle empty list of events', () => {
      const total = service.calculateTotalCompensation([]);
      expect(total).toBe(0);
    });
  });

  describe('calculateMonthlyCompensation', () => {
    it('should calculate compensation for a specific month', () => {
      const subEvents = [
        // January events
        createTestSubEvent({
          start: new Date('2024-01-01T09:00:00'),
          end: new Date('2024-01-01T17:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        }),
        // February events (should not be included)
        createTestSubEvent({
          start: new Date('2024-02-01T09:00:00'),
          end: new Date('2024-02-01T17:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        })
      ];

      const total = service.calculateMonthlyCompensation(subEvents, new Date('2024-01-15'));
      expect(total).toBe(8); // Only January events should be counted
    });

    it('should handle events spanning multiple months', () => {
      const subEvents = [
        // Event spanning January and February
        createTestSubEvent({
          start: new Date('2024-01-31T22:00:00'),
          end: new Date('2024-02-01T06:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: true,
          isOfficeHours: false
        })
      ];

      const januaryTotal = service.calculateMonthlyCompensation(subEvents, new Date('2024-01-15'));
      const februaryTotal = service.calculateMonthlyCompensation(subEvents, new Date('2024-02-15'));

      // 2 hours in January at 1.5x rate = 3
      expect(januaryTotal).toBe(3);
      // 6 hours in February at 1.5x rate = 9
      expect(februaryTotal).toBe(9);
    });
  });

  describe('calculateCompensationBreakdown', () => {
    it('should provide detailed breakdown of compensation by type', () => {
      const subEvents = [
        // Regular hours
        createTestSubEvent({
          start: new Date('2024-01-01T09:00:00'),
          end: new Date('2024-01-01T17:00:00'),
          isWeekday: true,
          isWeekend: false,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        }),
        // Weekend hours
        createTestSubEvent({
          start: new Date('2024-01-06T09:00:00'),
          end: new Date('2024-01-06T17:00:00'),
          isWeekday: false,
          isWeekend: true,
          isHoliday: false,
          isNightShift: false,
          isOfficeHours: true
        })
      ];

      const breakdown = service.calculateCompensationBreakdown(subEvents);
      expect(breakdown).toEqual({
        regular: 8,
        weekend: 16,
        nightShift: 0,
        holiday: 0,
        total: 24
      });
    });

    it('should handle overlapping compensation types', () => {
      const subEvents = [
        // Holiday during weekend
        createTestSubEvent({
          start: new Date('2024-01-06T09:00:00'),
          end: new Date('2024-01-06T17:00:00'),
          isWeekday: false,
          isWeekend: true,
          isHoliday: true,
          isNightShift: false,
          isOfficeHours: true
        })
      ];

      const breakdown = service.calculateCompensationBreakdown(subEvents);
      // Should use highest rate (holiday at 3x) instead of weekend rate
      expect(breakdown).toEqual({
        regular: 0,
        weekend: 0,
        nightShift: 0,
        holiday: 24,
        total: 24
      });
    });
  });
}); 
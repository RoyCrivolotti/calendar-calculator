// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateBillableHours } from '../../domain/calendar/services/compensationHelpers';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { v4 as uuidv4 } from 'uuid';

function makeSubEvent(overrides: Partial<{
  type: 'oncall' | 'incident';
  start: Date;
  end: Date;
  isWeekend: boolean;
  isNightShift: boolean;
  isOfficeHours: boolean;
  isHoliday: boolean;
}>): SubEvent {
  const defaults = {
    id: uuidv4(),
    parentEventId: uuidv4(),
    start: new Date('2026-03-10T09:00:00'),
    end: new Date('2026-03-10T17:00:00'),
    type: 'oncall' as const,
    isWeekday: true,
    isWeekend: false,
    isHoliday: false,
    isNightShift: false,
    isOfficeHours: true,
  };
  const merged = { ...defaults, ...overrides };
  if (overrides.isWeekend !== undefined) merged.isWeekday = !overrides.isWeekend;
  return new SubEvent(merged);
}

describe('calculateBillableHours', () => {
  describe('on-call events', () => {
    it('returns 0 for office hours (not billable)', () => {
      const sub = makeSubEvent({ type: 'oncall', isOfficeHours: true, isNightShift: false });
      expect(calculateBillableHours(sub)).toBe(0);
    });

    it('returns hours for non-office hours', () => {
      const sub = makeSubEvent({
        type: 'oncall',
        start: new Date('2026-03-10T18:00:00'),
        end: new Date('2026-03-10T22:00:00'),
        isOfficeHours: false,
        isNightShift: false,
      });
      expect(calculateBillableHours(sub)).toBe(4);
    });

    it('returns hours for night shift even if marked office hours', () => {
      const sub = makeSubEvent({
        type: 'oncall',
        start: new Date('2026-03-10T06:00:00'),
        end: new Date('2026-03-10T09:00:00'),
        isOfficeHours: true,
        isNightShift: true,
      });
      expect(calculateBillableHours(sub)).toBe(3);
    });

    it('rounds up partial hours', () => {
      const sub = makeSubEvent({
        type: 'oncall',
        start: new Date('2026-03-10T18:00:00'),
        end: new Date('2026-03-10T18:30:00'),
        isOfficeHours: false,
      });
      expect(calculateBillableHours(sub)).toBe(1);
    });
  });

  describe('incident events', () => {
    it('returns 0 for office hours weekday (not billable)', () => {
      const sub = makeSubEvent({
        type: 'incident',
        isOfficeHours: true,
        isWeekend: false,
        isNightShift: false,
      });
      expect(calculateBillableHours(sub)).toBe(0);
    });

    it('returns hours for weekend incidents', () => {
      const sub = makeSubEvent({
        type: 'incident',
        start: new Date('2026-03-14T10:00:00'),
        end: new Date('2026-03-14T12:00:00'),
        isWeekend: true,
        isOfficeHours: true,
      });
      expect(calculateBillableHours(sub)).toBe(2);
    });

    it('returns hours for night shift incidents', () => {
      const sub = makeSubEvent({
        type: 'incident',
        start: new Date('2026-03-10T22:00:00'),
        end: new Date('2026-03-11T02:00:00'),
        isNightShift: true,
        isOfficeHours: false,
      });
      expect(calculateBillableHours(sub)).toBe(4);
    });

    it('returns hours for outside-office-hours weekday incidents', () => {
      const sub = makeSubEvent({
        type: 'incident',
        start: new Date('2026-03-10T06:00:00'),
        end: new Date('2026-03-10T08:00:00'),
        isOfficeHours: false,
        isNightShift: false,
        isWeekend: false,
      });
      expect(calculateBillableHours(sub)).toBe(2);
    });

    it('rounds up partial hours', () => {
      const sub = makeSubEvent({
        type: 'incident',
        start: new Date('2026-03-14T10:00:00'),
        end: new Date('2026-03-14T10:15:00'),
        isWeekend: true,
      });
      expect(calculateBillableHours(sub)).toBe(1);
    });
  });
});

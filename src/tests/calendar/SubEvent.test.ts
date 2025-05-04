import { describe, it, expect } from 'vitest';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { createTestSubEvent } from '../setup';

describe('SubEvent', () => {
  describe('creation', () => {
    it('should create a valid sub event', () => {
      const event = createTestSubEvent();
      expect(event).toBeInstanceOf(SubEvent);
      expect(event.id).toBeDefined();
      expect(event.parentEventId).toBeDefined();
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
      expect(event.isWeekday).toBeDefined();
      expect(event.isWeekend).toBeDefined();
      expect(event.isHoliday).toBeDefined();
      expect(event.isNightShift).toBeDefined();
      expect(event.isOfficeHours).toBeDefined();
    });

    it('should validate end date is after start date', () => {
      expect(() => {
        createTestSubEvent({
          start: new Date('2024-01-01T17:00:00'),
          end: new Date('2024-01-01T09:00:00')
        });
      }).toThrow('End date must be after start date');
    });

    it('should validate parent event ID', () => {
      expect(() => {
        createTestSubEvent({
          parentEventId: ''
        });
      }).toThrow('Parent event ID is required');
    });
  });

  describe('time period classification', () => {
    it('should correctly identify weekday events', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T09:00:00'), // Monday
        end: new Date('2024-01-01T17:00:00')
      });
      expect(event.isWeekday).toBe(true);
      expect(event.isWeekend).toBe(false);
    });

    it('should correctly identify weekend events', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-06T09:00:00'), // Saturday
        end: new Date('2024-01-06T17:00:00')
      });
      expect(event.isWeekday).toBe(false);
      expect(event.isWeekend).toBe(true);
    });

    it('should correctly identify night shift events', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T22:00:00'),
        end: new Date('2024-01-02T06:00:00')
      });
      expect(event.isNightShift).toBe(true);
      expect(event.isOfficeHours).toBe(false);
    });

    it('should correctly identify office hours events', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00')
      });
      expect(event.isNightShift).toBe(false);
      expect(event.isOfficeHours).toBe(true);
    });
  });

  describe('compensation calculation', () => {
    it('should calculate base compensation for weekday office hours', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00'),
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: true
      });
      expect(event.calculateCompensation()).toBe(8); // 8 hours at base rate
    });

    it('should calculate increased compensation for weekend hours', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-06T09:00:00'),
        end: new Date('2024-01-06T17:00:00'),
        isWeekday: false,
        isWeekend: true,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: true
      });
      expect(event.calculateCompensation()).toBe(16); // 8 hours at 2x rate
    });

    it('should calculate increased compensation for night shift hours', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T22:00:00'),
        end: new Date('2024-01-02T06:00:00'),
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: true,
        isOfficeHours: false
      });
      expect(event.calculateCompensation()).toBe(12); // 8 hours at 1.5x rate
    });

    it('should calculate maximum compensation for holiday hours', () => {
      const event = createTestSubEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00'),
        isWeekday: true,
        isWeekend: false,
        isHoliday: true,
        isNightShift: false,
        isOfficeHours: true
      });
      expect(event.calculateCompensation()).toBe(24); // 8 hours at 3x rate
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const event = createTestSubEvent({
        id: '123',
        parentEventId: '456',
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00'),
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: true,
        type: 'oncall'
      });

      const json = event.toJSON();
      expect(json).toEqual({
        id: '123',
        parentEventId: '456',
        start: '2024-01-01T09:00:00.000Z',
        end: '2024-01-01T17:00:00.000Z',
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: true,
        type: 'oncall'
      });
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: '123',
        parentEventId: '456',
        start: '2024-01-01T09:00:00.000Z',
        end: '2024-01-01T17:00:00.000Z',
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: true,
        type: 'oncall' as const
      };

      const event = SubEvent.fromJSON(json);
      expect(event).toBeInstanceOf(SubEvent);
      expect(event.id).toBe('123');
      expect(event.parentEventId).toBe('456');
      expect(event.start).toEqual(new Date('2024-01-01T09:00:00.000Z'));
      expect(event.end).toEqual(new Date('2024-01-01T17:00:00.000Z'));
      expect(event.isWeekday).toBe(true);
      expect(event.isWeekend).toBe(false);
      expect(event.isHoliday).toBe(false);
      expect(event.isNightShift).toBe(false);
      expect(event.isOfficeHours).toBe(true);
      expect(event.type).toBe('oncall');
    });
  });
}); 
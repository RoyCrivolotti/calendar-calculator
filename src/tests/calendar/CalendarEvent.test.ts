import { describe, it, expect } from 'vitest';
import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { createTestEvent } from '../setup';

describe('CalendarEvent', () => {
  describe('creation', () => {
    it('should create a valid calendar event', () => {
      const event = createTestEvent();
      expect(event).toBeInstanceOf(CalendarEvent);
      expect(event.id).toBeDefined();
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
      expect(event.type).toBe('oncall');
    });

    it('should validate end date is after start date', () => {
      expect(() => {
        createTestEvent({
          start: new Date('2024-01-01T17:00:00'),
          end: new Date('2024-01-01T09:00:00')
        });
      }).toThrow('End date must be after start date');
    });

    it('should validate event type', () => {
      expect(() => {
        createTestEvent({
          type: 'invalid' as any
        });
      }).toThrow('Invalid event type');
    });
  });

  describe('duration calculations', () => {
    it('should calculate total duration in hours', () => {
      const event = createTestEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00')
      });
      expect(event.getDurationInHours()).toBe(8);
    });

    it('should handle multi-day events', () => {
      const event = createTestEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-03T17:00:00')
      });
      expect(event.getDurationInHours()).toBe(56);
    });
  });

  describe('overlap detection', () => {
    it('should detect overlapping events', () => {
      const event1 = createTestEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00')
      });

      const event2 = createTestEvent({
        start: new Date('2024-01-01T12:00:00'),
        end: new Date('2024-01-01T20:00:00')
      });

      expect(event1.overlaps(event2)).toBe(true);
      expect(event2.overlaps(event1)).toBe(true);
    });

    it('should handle adjacent events', () => {
      const event1 = createTestEvent({
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00')
      });

      const event2 = createTestEvent({
        start: new Date('2024-01-01T17:00:00'),
        end: new Date('2024-01-02T01:00:00')
      });

      expect(event1.overlaps(event2)).toBe(false);
      expect(event2.overlaps(event1)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T09:00:00'),
        end: new Date('2024-01-01T17:00:00'),
        type: 'oncall'
      });

      const json = event.toJSON();
      expect(json).toEqual({
        id: '123',
        start: '2024-01-01T09:00:00.000Z',
        end: '2024-01-01T17:00:00.000Z',
        type: 'oncall'
      });
    });

    it('should deserialize from JSON correctly', () => {
      const json = {
        id: '123',
        start: '2024-01-01T09:00:00.000Z',
        end: '2024-01-01T17:00:00.000Z',
        type: 'oncall'
      };

      const event = CalendarEvent.fromJSON(json);
      expect(event).toBeInstanceOf(CalendarEvent);
      expect(event.id).toBe('123');
      expect(event.start).toEqual(new Date('2024-01-01T09:00:00.000Z'));
      expect(event.end).toEqual(new Date('2024-01-01T17:00:00.000Z'));
      expect(event.type).toBe('oncall');
    });
  });
}); 
import { describe, it, expect, beforeEach } from 'vitest';
import { EventCompensationService } from '../../domain/calendar/services/EventCompensationService';
import { createTestEvent, createTestSubEvent } from '../setup';
import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';

describe('EventCompensationService', () => {
  let service: EventCompensationService;

  beforeEach(() => {
    service = EventCompensationService.getInstance();
  });

  describe('splitEventIntoSubEvents', () => {
    it('should split a weekday event into office hours and non-office hours', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T00:00:00'), // Monday
        end: new Date('2024-01-02T00:00:00'),
        type: 'oncall'
      });

      const subEvents = service.splitEventIntoSubEvents(event);

      expect(subEvents).toHaveLength(3);
      
      // Night shift (00:00-09:00)
      expect(subEvents[0]).toBeInstanceOf(SubEvent);
      expect(subEvents[0].start).toEqual(new Date('2024-01-01T00:00:00'));
      expect(subEvents[0].end).toEqual(new Date('2024-01-01T09:00:00'));
      expect(subEvents[0].isNightShift).toBe(true);
      expect(subEvents[0].isOfficeHours).toBe(false);
      expect(subEvents[0].isWeekday).toBe(true);
      expect(subEvents[0].isWeekend).toBe(false);

      // Office hours (09:00-17:00)
      expect(subEvents[1]).toBeInstanceOf(SubEvent);
      expect(subEvents[1].start).toEqual(new Date('2024-01-01T09:00:00'));
      expect(subEvents[1].end).toEqual(new Date('2024-01-01T17:00:00'));
      expect(subEvents[1].isNightShift).toBe(false);
      expect(subEvents[1].isOfficeHours).toBe(true);
      expect(subEvents[1].isWeekday).toBe(true);
      expect(subEvents[1].isWeekend).toBe(false);

      // Evening/Night shift (17:00-00:00)
      expect(subEvents[2]).toBeInstanceOf(SubEvent);
      expect(subEvents[2].start).toEqual(new Date('2024-01-01T17:00:00'));
      expect(subEvents[2].end).toEqual(new Date('2024-01-02T00:00:00'));
      expect(subEvents[2].isNightShift).toBe(true);
      expect(subEvents[2].isOfficeHours).toBe(false);
      expect(subEvents[2].isWeekday).toBe(true);
      expect(subEvents[2].isWeekend).toBe(false);
    });

    it('should handle weekend events correctly', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-06T00:00:00'), // Saturday
        end: new Date('2024-01-07T00:00:00'),
        type: 'oncall'
      });

      const subEvents = service.splitEventIntoSubEvents(event);

      expect(subEvents).toHaveLength(3);
      
      subEvents.forEach(subEvent => {
        expect(subEvent.isWeekend).toBe(true);
        expect(subEvent.isWeekday).toBe(false);
        expect(subEvent.parentEventId).toBe(event.id);
      });
    });

    it('should handle events spanning weekday to weekend', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-05T17:00:00'), // Friday evening
        end: new Date('2024-01-06T09:00:00'), // Saturday morning
        type: 'oncall'
      });

      const subEvents = service.splitEventIntoSubEvents(event);

      // Friday evening (weekday)
      expect(subEvents[0].start).toEqual(new Date('2024-01-05T17:00:00'));
      expect(subEvents[0].end).toEqual(new Date('2024-01-06T00:00:00'));
      expect(subEvents[0].isWeekday).toBe(true);
      expect(subEvents[0].isWeekend).toBe(false);
      expect(subEvents[0].isNightShift).toBe(true);

      // Saturday early morning (weekend)
      expect(subEvents[1].start).toEqual(new Date('2024-01-06T00:00:00'));
      expect(subEvents[1].end).toEqual(new Date('2024-01-06T09:00:00'));
      expect(subEvents[1].isWeekday).toBe(false);
      expect(subEvents[1].isWeekend).toBe(true);
      expect(subEvents[1].isNightShift).toBe(true);
    });

    it('should handle holiday events', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T00:00:00'), // New Year's Day
        end: new Date('2024-01-02T00:00:00'),
        type: 'oncall'
      });

      // Mock the holiday check
      service.isHoliday = (date: Date) => date.getMonth() === 0 && date.getDate() === 1;

      const subEvents = service.splitEventIntoSubEvents(event);

      subEvents.forEach(subEvent => {
        expect(subEvent.isHoliday).toBe(true);
        expect(subEvent.parentEventId).toBe(event.id);
      });
    });
  });

  describe('calculateEventCompensation', () => {
    it('should calculate compensation for a weekday event', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T09:00:00'), // Monday
        end: new Date('2024-01-01T17:00:00'),
        type: 'oncall'
      });

      const compensation = service.calculateEventCompensation(event);
      expect(compensation).toBe(8); // 8 hours at base rate
    });

    it('should calculate compensation for a weekend event', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-06T09:00:00'), // Saturday
        end: new Date('2024-01-06T17:00:00'),
        type: 'oncall'
      });

      const compensation = service.calculateEventCompensation(event);
      expect(compensation).toBe(16); // 8 hours at 2x rate
    });

    it('should calculate compensation for a night shift event', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T22:00:00'),
        end: new Date('2024-01-02T06:00:00'),
        type: 'oncall'
      });

      const compensation = service.calculateEventCompensation(event);
      expect(compensation).toBe(12); // 8 hours at 1.5x rate
    });

    it('should calculate compensation for a holiday event', () => {
      const event = createTestEvent({
        id: '123',
        start: new Date('2024-01-01T09:00:00'), // New Year's Day
        end: new Date('2024-01-01T17:00:00'),
        type: 'oncall'
      });

      // Mock the holiday check
      service.isHoliday = (date: Date) => date.getMonth() === 0 && date.getDate() === 1;

      const compensation = service.calculateEventCompensation(event);
      expect(compensation).toBe(24); // 8 hours at 3x rate
    });
  });
}); 
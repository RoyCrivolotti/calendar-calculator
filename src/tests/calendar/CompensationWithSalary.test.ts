// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CompensationService } from '../../domain/calendar/services/CompensationService';
import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { COMPENSATION_RATES } from '../../domain/calendar/constants/CompensationRates';
import { v4 as uuidv4 } from 'uuid';

function makeIncidentEvent(start: Date, end: Date): CalendarEvent {
  return new CalendarEvent({
    id: uuidv4(),
    type: 'incident',
    start,
    end,
    title: 'Test Incident',
  });
}

function makeSubEventsForIncident(
  parentId: string,
  start: Date,
  end: Date,
  isWeekend: boolean
): SubEvent[] {
  return [
    new SubEvent({
      id: uuidv4(),
      parentEventId: parentId,
      start,
      end,
      type: 'incident',
      isWeekday: !isWeekend,
      isWeekend,
      isHoliday: false,
      isNightShift: false,
      isOfficeHours: false,
    }),
  ];
}

describe('CompensationService salary integration', () => {
  let service: CompensationService;

  beforeEach(() => {
    service = new CompensationService();
  });

  it('uses default rate when no baseHourlySalary is provided', () => {
    const event = makeIncidentEvent(
      new Date('2026-03-10T06:00:00'),
      new Date('2026-03-10T08:00:00')
    );
    const subEvents = makeSubEventsForIncident(
      event.id,
      new Date('2026-03-10T06:00:00'),
      new Date('2026-03-10T08:00:00'),
      false
    );

    const result = service.calculateMonthlyCompensation(
      [event],
      subEvents,
      new Date('2026-03-01')
    );

    const incidentItem = result.find(r => r.type === 'incident');
    expect(incidentItem).toBeDefined();
    const expectedAmount = 2 * COMPENSATION_RATES.baseHourlySalary * COMPENSATION_RATES.weekdayIncidentMultiplier;
    expect(incidentItem!.amount).toBeCloseTo(expectedAmount, 2);
  });

  it('uses provided baseHourlySalary (old rate) for March', () => {
    const event = makeIncidentEvent(
      new Date('2026-03-10T06:00:00'),
      new Date('2026-03-10T08:00:00')
    );
    const subEvents = makeSubEventsForIncident(
      event.id,
      new Date('2026-03-10T06:00:00'),
      new Date('2026-03-10T08:00:00'),
      false
    );

    const result = service.calculateMonthlyCompensation(
      [event],
      subEvents,
      new Date('2026-03-01'),
      33.50
    );

    const incidentItem = result.find(r => r.type === 'incident');
    expect(incidentItem).toBeDefined();
    // 2 hours * €33.50 * 1.8x = €120.60
    expect(incidentItem!.amount).toBeCloseTo(120.60, 2);
  });

  it('uses provided baseHourlySalary (new rate) for April', () => {
    const event = makeIncidentEvent(
      new Date('2026-04-10T06:00:00'),
      new Date('2026-04-10T08:00:00')
    );
    const subEvents = makeSubEventsForIncident(
      event.id,
      new Date('2026-04-10T06:00:00'),
      new Date('2026-04-10T08:00:00'),
      false
    );

    const result = service.calculateMonthlyCompensation(
      [event],
      subEvents,
      new Date('2026-04-01'),
      34.41
    );

    const incidentItem = result.find(r => r.type === 'incident');
    expect(incidentItem).toBeDefined();
    // 2 hours * €34.41 * 1.8x = €123.876
    expect(incidentItem!.amount).toBeCloseTo(123.876, 1);
  });

  it('on-call rates are NOT affected by salary parameter', () => {
    const eventId = uuidv4();
    const event = new CalendarEvent({
      id: eventId,
      type: 'oncall',
      start: new Date('2026-04-10T18:00:00'),
      end: new Date('2026-04-10T22:00:00'),
      title: 'On-Call',
    });
    const subEvents = [
      new SubEvent({
        id: uuidv4(),
        parentEventId: eventId,
        start: new Date('2026-04-10T18:00:00'),
        end: new Date('2026-04-10T22:00:00'),
        type: 'oncall',
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: false,
      }),
    ];

    const resultOldRate = service.calculateMonthlyCompensation(
      [event], subEvents, new Date('2026-04-01'), 33.50
    );
    service.clearCache();
    const resultNewRate = service.calculateMonthlyCompensation(
      [event], subEvents, new Date('2026-04-01'), 34.41
    );

    const oncallOld = resultOldRate.find(r => r.type === 'oncall');
    const oncallNew = resultNewRate.find(r => r.type === 'oncall');

    expect(oncallOld).toBeDefined();
    expect(oncallNew).toBeDefined();
    // On-call amount must be IDENTICAL regardless of salary
    expect(oncallOld!.amount).toBe(oncallNew!.amount);
    // 4 hours * €3.90 = €15.60
    expect(oncallOld!.amount).toBeCloseTo(15.60, 2);
  });

  it('populates structured hours field in breakdown', () => {
    const eventId = uuidv4();
    const event = new CalendarEvent({
      id: eventId,
      type: 'oncall',
      start: new Date('2026-03-09T18:00:00'),
      end: new Date('2026-03-10T08:00:00'),
    });
    const subEvents = [
      new SubEvent({
        id: uuidv4(),
        parentEventId: eventId,
        start: new Date('2026-03-09T18:00:00'),
        end: new Date('2026-03-10T00:00:00'),
        type: 'oncall',
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: false,
        isOfficeHours: false,
      }),
      new SubEvent({
        id: uuidv4(),
        parentEventId: eventId,
        start: new Date('2026-03-10T00:00:00'),
        end: new Date('2026-03-10T08:00:00'),
        type: 'oncall',
        isWeekday: true,
        isWeekend: false,
        isHoliday: false,
        isNightShift: true,
        isOfficeHours: false,
      }),
    ];

    const result = service.calculateMonthlyCompensation(
      [event], subEvents, new Date('2026-03-01')
    );

    const oncallItem = result.find(r => r.type === 'oncall');
    expect(oncallItem).toBeDefined();
    expect(oncallItem!.hours).toBeDefined();
    expect(oncallItem!.hours!.weekday).toBe(14);
    expect(oncallItem!.hours!.weekend).toBe(0);
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { SalaryRecord, deriveHourlyRate, HOURS_PER_YEAR } from '../../domain/calendar/entities/SalaryRecord';

describe('SalaryRecord', () => {
  it('constructs from props with Date', () => {
    const record = new SalaryRecord({
      id: 'test-1',
      annualSalary: 73960,
      baseHourlySalary: 33.50,
      effectiveDate: new Date('2000-01-01'),
    });
    expect(record.id).toBe('test-1');
    expect(record.annualSalary).toBe(73960);
    expect(record.baseHourlySalary).toBe(33.50);
    expect(record.effectiveDate).toBeInstanceOf(Date);
    expect(record.effectiveDate.getFullYear()).toBe(2000);
  });

  it('constructs from props with ISO string date', () => {
    const record = new SalaryRecord({
      id: 'test-2',
      annualSalary: 75960,
      baseHourlySalary: 34.41,
      effectiveDate: '2026-04-01T00:00:00.000Z',
    });
    expect(record.effectiveDate).toBeInstanceOf(Date);
    expect(record.effectiveDate.getUTCFullYear()).toBe(2026);
    expect(record.effectiveDate.getUTCMonth()).toBe(3);
  });

  it('serializes to JSON and back', () => {
    const original = new SalaryRecord({
      id: 'round-trip',
      annualSalary: 73960,
      baseHourlySalary: 33.50,
      effectiveDate: new Date('2000-01-01'),
    });
    const json = original.toJSON();
    const restored = new SalaryRecord(json);
    expect(restored.id).toBe(original.id);
    expect(restored.annualSalary).toBe(original.annualSalary);
    expect(restored.baseHourlySalary).toBe(original.baseHourlySalary);
  });
});

describe('deriveHourlyRate', () => {
  it('derives the old rate from 73960', () => {
    const rate = deriveHourlyRate(73960);
    expect(rate).toBeCloseTo(33.50, 1);
  });

  it('derives the new rate from 75960', () => {
    const rate = deriveHourlyRate(75960);
    expect(rate).toBeCloseTo(34.41, 1);
  });

  it('uses HOURS_PER_YEAR = 2208', () => {
    expect(HOURS_PER_YEAR).toBe(2208);
    expect(deriveHourlyRate(2208)).toBeCloseTo(1.0, 2);
  });
});

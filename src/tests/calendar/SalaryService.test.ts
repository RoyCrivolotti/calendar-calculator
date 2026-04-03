// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { SalaryService } from '../../domain/calendar/services/SalaryService';
import { SalaryRecord } from '../../domain/calendar/entities/SalaryRecord';
import { SalaryRecordRepository } from '../../domain/calendar/repositories/SalaryRecordRepository';
import { COMPENSATION_RATES } from '../../domain/calendar/constants/CompensationRates';

class MockSalaryRecordRepository implements SalaryRecordRepository {
  private records: SalaryRecord[] = [];

  setRecords(records: SalaryRecord[]) {
    this.records = records;
  }

  async getAll(): Promise<SalaryRecord[]> {
    return [...this.records].sort(
      (a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime()
    );
  }
  async save(record: SalaryRecord): Promise<void> {
    this.records = this.records.filter(r => r.id !== record.id);
    this.records.push(record);
  }
  async delete(id: string): Promise<void> {
    this.records = this.records.filter(r => r.id !== id);
  }
}

describe('SalaryService', () => {
  let service: SalaryService;
  let repo: MockSalaryRecordRepository;

  const oldRecord = new SalaryRecord({
    id: 'old',
    annualSalary: 73960,
    baseHourlySalary: 33.50,
    effectiveDate: new Date(2000, 0, 1),
  });

  const newRecord = new SalaryRecord({
    id: 'new',
    annualSalary: 75960,
    baseHourlySalary: 34.41,
    effectiveDate: new Date(2026, 3, 1),
  });

  beforeEach(async () => {
    repo = new MockSalaryRecordRepository();
    service = new SalaryService(repo);
  });

  describe('getHourlyRateForDate with no records', () => {
    it('falls back to COMPENSATION_RATES.baseHourlySalary', async () => {
      await service.loadRecords();
      const rate = service.getHourlyRateForDate(new Date('2026-03-15'));
      expect(rate).toBe(COMPENSATION_RATES.baseHourlySalary);
    });
  });

  describe('getHourlyRateForDate with salary history', () => {
    beforeEach(async () => {
      repo.setRecords([oldRecord, newRecord]);
      await service.loadRecords();
    });

    it('returns old rate for dates before April 2026', () => {
      expect(service.getHourlyRateForDate(new Date(2025, 11, 1))).toBe(33.50);
      expect(service.getHourlyRateForDate(new Date(2026, 0, 1))).toBe(33.50);
      expect(service.getHourlyRateForDate(new Date(2026, 2, 1))).toBe(33.50);
      expect(service.getHourlyRateForDate(new Date(2026, 2, 31))).toBe(33.50);
    });

    it('returns new rate for dates from April 2026 onwards', () => {
      expect(service.getHourlyRateForDate(new Date(2026, 3, 1))).toBe(34.41);
      expect(service.getHourlyRateForDate(new Date(2026, 4, 1))).toBe(34.41);
      expect(service.getHourlyRateForDate(new Date(2027, 0, 1))).toBe(34.41);
    });

    it('returns old rate for very old dates', () => {
      expect(service.getHourlyRateForDate(new Date(2000, 0, 1))).toBe(33.50);
      expect(service.getHourlyRateForDate(new Date(2010, 5, 15))).toBe(33.50);
    });

    it('falls back when date is before all records', () => {
      expect(service.getHourlyRateForDate(new Date(1999, 11, 31))).toBe(
        COMPENSATION_RATES.baseHourlySalary
      );
    });
  });

  describe('boundary precision', () => {
    beforeEach(async () => {
      repo.setRecords([oldRecord, newRecord]);
      await service.loadRecords();
    });

    it('March 31 23:59 still gets old rate', () => {
      const marchEnd = new Date(2026, 2, 31, 23, 59, 59, 999);
      expect(service.getHourlyRateForDate(marchEnd)).toBe(33.50);
    });

    it('April 1 00:00 gets new rate', () => {
      const aprilStart = new Date(2026, 3, 1, 0, 0, 0, 0);
      expect(service.getHourlyRateForDate(aprilStart)).toBe(34.41);
    });
  });
});

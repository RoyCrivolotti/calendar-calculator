import { SalaryRecord } from '../entities/SalaryRecord';
import { SalaryRecordRepository } from '../repositories/SalaryRecordRepository';
import { COMPENSATION_RATES } from '../constants/CompensationRates';
import { logger } from '../../../utils/logger';

export class SalaryService {
  private records: SalaryRecord[] = [];
  private loaded = false;

  constructor(private readonly repository: SalaryRecordRepository) {}

  async loadRecords(): Promise<SalaryRecord[]> {
    this.records = await this.repository.getAll();
    this.loaded = true;
    logger.info(`[SalaryService] Loaded ${this.records.length} salary records`);
    return this.records;
  }

  getRecords(): SalaryRecord[] {
    return [...this.records];
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Returns the baseHourlySalary from the record with the latest
   * effectiveDate that is <= the given date.
   * Falls back to COMPENSATION_RATES.baseHourlySalary if no records exist.
   */
  getHourlyRateForDate(date: Date): number {
    if (this.records.length === 0) {
      return COMPENSATION_RATES.baseHourlySalary;
    }

    // Records are already sorted by effectiveDate ascending (from repository)
    let applicableRecord: SalaryRecord | null = null;
    for (const record of this.records) {
      if (record.effectiveDate <= date) {
        applicableRecord = record;
      } else {
        break;
      }
    }

    if (!applicableRecord) {
      return COMPENSATION_RATES.baseHourlySalary;
    }

    return applicableRecord.baseHourlySalary;
  }

  async saveRecord(record: SalaryRecord): Promise<void> {
    await this.repository.save(record);
    await this.loadRecords();
  }

  async deleteRecord(id: string): Promise<void> {
    await this.repository.delete(id);
    await this.loadRecords();
  }
}

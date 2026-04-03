import { SalaryRecord } from '../entities/SalaryRecord';

export interface SalaryRecordRepository {
  getAll(): Promise<SalaryRecord[]>;
  save(record: SalaryRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

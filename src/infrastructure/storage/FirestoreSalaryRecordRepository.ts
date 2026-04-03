import { db, auth } from '../../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { SalaryRecord, SalaryRecordProps } from '../../domain/calendar/entities/SalaryRecord';
import { SalaryRecordRepository } from '../../domain/calendar/repositories/SalaryRecordRepository';
import { logger } from '../../utils/logger';

const getCurrentUserId = (): string | null => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

const salaryRecordConverter = {
  toFirestore: (record: SalaryRecord): Record<string, unknown> => ({
    id: record.id,
    annualSalary: record.annualSalary,
    baseHourlySalary: record.baseHourlySalary,
    effectiveDate: Timestamp.fromDate(record.effectiveDate),
  }),
  fromFirestore: (snapshot: any, options: any): SalaryRecord => {
    const data = snapshot.data(options);
    return new SalaryRecord({
      id: snapshot.id,
      annualSalary: data.annualSalary,
      baseHourlySalary: data.baseHourlySalary,
      effectiveDate: (data.effectiveDate as Timestamp).toDate(),
    });
  },
};

export class FirestoreSalaryRecordRepository implements SalaryRecordRepository {
  private getCollectionPath(): string {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    return `users/${userId}/salaryRecords`;
  }

  async getAll(): Promise<SalaryRecord[]> {
    const colPath = this.getCollectionPath();
    logger.info(`[SalaryRepo] Fetching all salary records from ${colPath}`);
    const snapshot = await getDocs(collection(db, colPath));

    const records: SalaryRecord[] = [];
    snapshot.forEach((docSnap) => {
      records.push(salaryRecordConverter.fromFirestore(docSnap, {}));
    });

    records.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
    logger.info(`[SalaryRepo] Loaded ${records.length} salary records`);
    return records;
  }

  async save(record: SalaryRecord): Promise<void> {
    const colPath = this.getCollectionPath();
    const docRef = doc(db, colPath, record.id);
    await setDoc(docRef, salaryRecordConverter.toFirestore(record));
    logger.info(`[SalaryRepo] Saved salary record ${record.id}`);
  }

  async delete(id: string): Promise<void> {
    const colPath = this.getCollectionPath();
    const docRef = doc(db, colPath, id);
    await deleteDoc(docRef);
    logger.info(`[SalaryRepo] Deleted salary record ${id}`);
  }
}

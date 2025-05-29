import { db, auth } from '../../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { SubEvent, SubEventProps } from '../../domain/calendar/entities/SubEvent';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { logger } from '../../utils/logger';

// Helper to get current user UID
const getCurrentUserId = (): string | null => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

// Firestore data converter for SubEvent
const subEventConverter = {
  toFirestore: (subEvent: SubEvent): any => {
    const jsonData = subEvent.toJSON();
    return {
      ...jsonData,
      start: Timestamp.fromDate(new Date(jsonData.start as string)),
      end: Timestamp.fromDate(new Date(jsonData.end as string)),
    };
  },
  fromFirestore: (
    snapshot: any, // firebase.firestore.QueryDocumentSnapshot
    options: any   // firebase.firestore.SnapshotOptions
  ): SubEvent => {
    const data = snapshot.data(options);
    return new SubEvent({
      id: snapshot.id,
      parentEventId: data.parentEventId,
      type: data.type,
      start: (data.start as Timestamp).toDate(),
      end: (data.end as Timestamp).toDate(),
      isWeekday: data.isWeekday,
      isWeekend: data.isWeekend,
      isHoliday: data.isHoliday,
      isNightShift: data.isNightShift,
      isOfficeHours: data.isOfficeHours,
    });
  },
};

export class FirestoreSubEventRepository implements SubEventRepository {
  private getSubEventsCollection(userId: string) {
    if (!userId) throw new Error('User ID is required to access subEvents collection.');
    return collection(db, `users/${userId}/subEvents`).withConverter(subEventConverter);
  }

  async save(subEvents: SubEvent[]): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreSubRepo] User not authenticated to save subEvents.');
      throw new Error('User not authenticated.');
    }
    if (!subEvents || subEvents.length === 0) return;

    const batch = writeBatch(db);
    
    subEvents.forEach(subEvent => {
      const subEventRef = doc(db, `users/${userId}/subEvents/${subEvent.id}`).withConverter(subEventConverter);
      batch.set(subEventRef, subEvent, { merge: true });
    });

    try {
      await batch.commit();
      logger.info(`[FirestoreSubRepo] Saved ${subEvents.length} subEvents for user ${userId}`);
    } catch (error) {
      logger.error('[FirestoreSubRepo] Error saving subEvents batch:', error);
      throw error;
    }
  }

  async getAll(): Promise<SubEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreSubRepo] User not authenticated to get all subEvents, returning empty.');
      return [];
    }
    const subEventsCollection = this.getSubEventsCollection(userId);

    try {
      const querySnapshot = await getDocs(subEventsCollection);
      const subEvents = querySnapshot.docs.map(docSnap => docSnap.data());
      logger.info(`[FirestoreSubRepo] Fetched ${subEvents.length} subEvents for user ${userId}`);
      return subEvents;
    } catch (error) {
      logger.error('[FirestoreSubRepo] Error fetching all subEvents:', error);
      throw error;
    }
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreSubRepo] User not authenticated, returning empty for getByParentId.');
      return [];
    }
    const subEventsCollection = this.getSubEventsCollection(userId);
    const q = query(subEventsCollection, where('parentEventId', '==', parentId));

    try {
      const querySnapshot = await getDocs(q);
      const subEvents = querySnapshot.docs.map(docSnap => docSnap.data());
      logger.info(`[FirestoreSubRepo] Fetched ${subEvents.length} subEvents for parent ${parentId} for user ${userId}`);
      return subEvents;
    } catch (error) {
      logger.error(`[FirestoreSubRepo] Error fetching subEvents by parentId ${parentId}:`, error);
      throw error;
    }
  }

  async deleteByParentId(parentId: string): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreSubRepo] User not authenticated to delete subEvents by parentId.');
      throw new Error('User not authenticated.');
    }

    // First, fetch all subEvents for the parentId to get their individual IDs
    const subEventsToDelete = await this.getByParentId(parentId);
    if (subEventsToDelete.length === 0) {
      logger.info(`[FirestoreSubRepo] No subEvents found to delete for parent ${parentId} for user ${userId}`);
      return;
    }

    const batch = writeBatch(db);
    const subEventsCollectionPath = `users/${userId}/subEvents`; // Path without converter for generic doc ref

    subEventsToDelete.forEach(subEvent => {
      const subEventRef = doc(db, subEventsCollectionPath, subEvent.id);
      batch.delete(subEventRef);
    });

    try {
      await batch.commit();
      logger.info(`[FirestoreSubRepo] Deleted ${subEventsToDelete.length} subEvents for parent ${parentId} for user ${userId}`);
    } catch (error) {
      logger.error(`[FirestoreSubRepo] Error deleting subEvents by parentId ${parentId}:`, error);
      throw error;
    }
  }
} 
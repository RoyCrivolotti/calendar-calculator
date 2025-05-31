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

const getCurrentUserId = (): string | null => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

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
    snapshot: any,
    options: any
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

    const subEventsToDelete = await this.getByParentId(parentId);
    if (subEventsToDelete.length === 0) {
      logger.info(`[FirestoreSubRepo] No subEvents found to delete for parent ${parentId} for user ${userId}`);
      return;
    }

    const batch = writeBatch(db);
    const subEventsCollectionPath = `users/${userId}/subEvents`;

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

  async deleteMultipleByParentIds(parentIds: string[]): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreSubRepo] User not authenticated to delete multiple subEvents by parentIds.');
      throw new Error('User not authenticated.');
    }
    if (!parentIds || parentIds.length === 0) {
      logger.info('[FirestoreSubRepo] No parent IDs provided for batch subEvent deletion.');
      return;
    }

    const FIRESTORE_IN_QUERY_LIMIT = 30; 
    const FIRESTORE_WRITE_BATCH_LIMIT = 500;

    const subEventsCollection = this.getSubEventsCollection(userId);
    const subEventsCollectionPath = `users/${userId}/subEvents`;
    let allSubEventsToDelete: SubEvent[] = [];

    logger.debug(`[FirestoreSubRepo] Initiating batch deletion for ${parentIds.length} parent IDs. Fetching subEvents in chunks of up to ${FIRESTORE_IN_QUERY_LIMIT} parent IDs. Deleting subEvents in batches of up to ${FIRESTORE_WRITE_BATCH_LIMIT}.`);

    for (let i = 0; i < parentIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
      const parentIdChunk = parentIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
      
      const q = query(subEventsCollection, where('parentEventId', 'in', parentIdChunk));
      try {
        const querySnapshot = await getDocs(q);
        const subEventsInChunk = querySnapshot.docs.map(docSnap => docSnap.data()); 
        allSubEventsToDelete.push(...subEventsInChunk);
        logger.debug(`[FirestoreSubRepo] Fetched ${subEventsInChunk.length} subEvents for parentId chunk ${Math.floor(i / FIRESTORE_IN_QUERY_LIMIT) + 1}/${Math.ceil(parentIds.length / FIRESTORE_IN_QUERY_LIMIT)} (Parent IDs: ${parentIdChunk.join(', ')})`);
      } catch (error) {
        logger.error(`[FirestoreSubRepo] Error fetching subEvents for parentId chunk (Parent IDs: ${parentIdChunk.join(', ')}):`, error);
        throw error;
      }
    }

    if (allSubEventsToDelete.length === 0) {
      logger.info(`[FirestoreSubRepo] No subEvents found to delete for the provided parent IDs: ${parentIds.join(', ')}`);
      return;
    }
    logger.info(`[FirestoreSubRepo] Fetched a total of ${allSubEventsToDelete.length} subEvents across ${parentIds.length} parent event IDs. Proceeding with deletion.`);

    let totalSuccessfullyDeletedCount = 0;
    for (let i = 0; i < allSubEventsToDelete.length; i += FIRESTORE_WRITE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      const subEventChunkToDelete = allSubEventsToDelete.slice(i, i + FIRESTORE_WRITE_BATCH_LIMIT);
      let operationsInCurrentBatch = 0;

      subEventChunkToDelete.forEach(subEvent => {
        if (subEvent && typeof subEvent.id === 'string' && subEvent.id.length > 0) {
          const subEventRef = doc(db, subEventsCollectionPath, subEvent.id);
          batch.delete(subEventRef);
          operationsInCurrentBatch++;
        } else {
          logger.warn('[FirestoreSubRepo] Skipped invalid subEvent (missing or invalid ID) during batch delete. Details:', { subEventData: subEvent });
        }
      });
      
      if (operationsInCurrentBatch > 0) {
        try {
          await batch.commit();
          totalSuccessfullyDeletedCount += operationsInCurrentBatch;
          logger.debug(`[FirestoreSubRepo] Committed delete batch ${Math.floor(i / FIRESTORE_WRITE_BATCH_LIMIT) + 1}/${Math.ceil(allSubEventsToDelete.length / FIRESTORE_WRITE_BATCH_LIMIT)}, deleting ${operationsInCurrentBatch} subEvents.`);
        } catch (error) {
          logger.error(`[FirestoreSubRepo] Error committing delete batch (attempted ${operationsInCurrentBatch} deletions). Batch ${Math.floor(i / FIRESTORE_WRITE_BATCH_LIMIT) + 1}:`, error);
          throw error;
        }
      } else if (subEventChunkToDelete.length > 0) {
          logger.debug(`[FirestoreSubRepo] Delete batch ${Math.floor(i / FIRESTORE_WRITE_BATCH_LIMIT) + 1}/${Math.ceil(allSubEventsToDelete.length / FIRESTORE_WRITE_BATCH_LIMIT)} was skipped as it contained no valid operations (chunk size: ${subEventChunkToDelete.length}).`);
      }
    }

    logger.info(`[FirestoreSubRepo] Batch deletion process completed. Successfully deleted ${totalSuccessfullyDeletedCount} subEvents (out of ${allSubEventsToDelete.length} fetched) related to parent IDs: ${parentIds.join(', ')}.`);
  }
} 
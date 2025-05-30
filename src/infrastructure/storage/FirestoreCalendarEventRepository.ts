import { db, auth } from '../../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { CalendarEvent } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { logger } from '../../utils/logger';

const getCurrentUserId = (): string | null => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

const calendarEventConverter = {
  toFirestore: (event: CalendarEvent): any => {
    const jsonData = event.toJSON();
    const firestoreData: any = {
      id: jsonData.id,
      start: Timestamp.fromDate(new Date(jsonData.start as string)),
      end: Timestamp.fromDate(new Date(jsonData.end as string)),
      type: jsonData.type,
    };
    if (jsonData.title !== undefined) {
      firestoreData.title = jsonData.title;
    } else {
    }

    return firestoreData;
  },
  fromFirestore: (
    snapshot: any,
    options: any
  ): CalendarEvent => {
    const data = snapshot.data(options);
    return new CalendarEvent({
      id: snapshot.id,
      type: data.type,
      title: data.title,
      start: (data.start as Timestamp).toDate(),
      end: (data.end as Timestamp).toDate(),
    });
  },
};

export class FirestoreCalendarEventRepository implements CalendarEventRepository {
  private getEventsCollection(userId: string) {
    if (!userId) throw new Error('User ID is required to access events collection.');
    return collection(db, `users/${userId}/events`).withConverter(calendarEventConverter);
  }

  async save(events: CalendarEvent[]): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreRepo] User not authenticated to save events.');
      throw new Error('User not authenticated.');
    }
    if (!events || events.length === 0) return;

    const batch = writeBatch(db);
    
    events.forEach(event => {
      const eventRef = doc(db, `users/${userId}/events/${event.id}`).withConverter(calendarEventConverter);
      batch.set(eventRef, event, { merge: true }); 
    });

    try {
      await batch.commit();
      logger.info(`[FirestoreRepo] Saved ${events.length} events for user ${userId}`);
    } catch (error) {
      logger.error('[FirestoreRepo] Error saving events batch:', error);
      throw error;
    }
  }

  async getAll(): Promise<CalendarEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreRepo] User not authenticated to get all events, returning empty.');
      return [];
    }
    const eventsCollectionWithConverter = this.getEventsCollection(userId); // This already has the converter

    try {
      const querySnapshot = await getDocs(eventsCollectionWithConverter);
      const events = querySnapshot.docs.map(docSnap => docSnap.data());
      logger.info(`[FirestoreRepo] Fetched ${events.length} events for user ${userId}`);
      return events;
    } catch (error) {
      logger.error('[FirestoreRepo] Error fetching all events:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreRepo] User not authenticated to delete event.');
      throw new Error('User not authenticated.');
    }
    const eventRef = doc(db, `users/${userId}/events/${id}`);
    try {
      await deleteDoc(eventRef);
      logger.info(`[FirestoreRepo] Deleted event ${id} for user ${userId}`);
    } catch (error) {
      logger.error(`[FirestoreRepo] Error deleting event ${id}:`, error);
      throw error;
    }
  }

  async update(event: CalendarEvent): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreRepo] User not authenticated to update event.');
      throw new Error('User not authenticated.');
    }
    const eventRef = doc(db, `users/${userId}/events/${event.id}`).withConverter(calendarEventConverter);
    try {
      await setDoc(eventRef, event, { merge: true }); 
      logger.info(`[FirestoreRepo] Updated event ${event.id} for user ${userId}`);
    } catch (error) {
      logger.error(`[FirestoreRepo] Error updating event ${event.id}:`, error);
      throw error;
    }
  }

  async deleteMultipleByIds(ids: string[]): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.error('[FirestoreRepo] User not authenticated to delete multiple events.');
      throw new Error('User not authenticated.');
    }
    if (!ids || ids.length === 0) {
      logger.info('[FirestoreRepo] No event IDs provided for batch deletion.');
      return;
    }

    const batch = writeBatch(db);
    const eventsCollectionPath = `users/${userId}/events`; // Path for doc refs

    ids.forEach(id => {
      const eventRef = doc(db, eventsCollectionPath, id);
      batch.delete(eventRef);
    });

    try {
      await batch.commit();
      logger.info(`[FirestoreRepo] Batch deleted ${ids.length} events for user ${userId}. IDs: ${ids.join(', ')}`);
    } catch (error) {
      logger.error(`[FirestoreRepo] Error batch deleting events. IDs: ${ids.join(', ')}:`, error);
      throw error;
    }
  }
} 
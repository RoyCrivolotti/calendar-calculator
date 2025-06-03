import { db, auth } from '../../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Timestamp,
  writeBatch,
  query,
  where,
  getDoc
} from 'firebase/firestore';
import { CalendarEvent, EventType } from '../../domain/calendar/entities/CalendarEvent';
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

  async getEventsForDateRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreRepo] User not authenticated for getEventsForDateRange, returning empty.');
      return [];
    }
    const eventsCollectionWithConverter = this.getEventsCollection(userId);
    
    const q = query(
      eventsCollectionWithConverter, 
      where('start', '<=', Timestamp.fromDate(endDate))
    );

    try {
      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(docSnap => docSnap.data());
      
      const overlappingEvents = fetchedEvents.filter(event => {
        // Ensure event.end is a Date object for comparison
        const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
        return eventEnd >= startDate;
      });

      logger.info(`[FirestoreRepo] Fetched ${overlappingEvents.length} events (out of ${fetchedEvents.length} initially queried) for range ${startDate.toISOString()} - ${endDate.toISOString()} for user ${userId}`);
      return overlappingEvents;
    } catch (error) {
      logger.error(`[FirestoreRepo] Error fetching events for date range ${startDate.toISOString()} - ${endDate.toISOString()}:`, error);
      throw error;
    }
  }

  async getHolidayEvents(): Promise<CalendarEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreRepo] User not authenticated to get holiday events, returning empty.');
      return [];
    }
    const eventsCollectionWithConverter = this.getEventsCollection(userId);
    const q = query(eventsCollectionWithConverter, where('type', '==', 'holiday'));

    try {
      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map(docSnap => docSnap.data());
      logger.info(`[FirestoreRepo] Fetched ${events.length} holiday events for user ${userId}`);
      return events;
    } catch (error) {
      logger.error('[FirestoreRepo] Error fetching holiday events:', error);
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

  async getById(id: string): Promise<CalendarEvent | null> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreRepo] User not authenticated for getById, returning null.');
      return null;
    }
    if (!id) {
      logger.warn('[FirestoreRepo] No ID provided to getById, returning null.');
      return null;
    }
    const eventRef = doc(db, `users/${userId}/events/${id}`).withConverter(calendarEventConverter);
    try {
      const docSnap = await getDoc(eventRef);
      if (docSnap.exists()) {
        logger.info(`[FirestoreRepo] Fetched event ${id} for user ${userId}`);
        return docSnap.data();
      } else {
        logger.warn(`[FirestoreRepo] No event found with ID ${id} for user ${userId}`);
        return null;
      }
    } catch (error) {
      logger.error(`[FirestoreRepo] Error fetching event by ID ${id}:`, error);
      throw error;
    }
  }

  async getEventsOverlappingDateRange(
    rangeStart: Date, 
    rangeEnd: Date,
    types?: EventType[]
  ): Promise<CalendarEvent[]> {
    const userId = getCurrentUserId();
    if (!userId) {
      logger.warn('[FirestoreRepo] User not authenticated for getEventsOverlappingDateRange, returning empty.');
      return [];
    }
    const eventsCollectionWithConverter = this.getEventsCollection(userId);

    let q;
    if (types && types.length > 0) {
      q = query(
        eventsCollectionWithConverter,
        where('start', '<=', Timestamp.fromDate(rangeEnd)),
        where('type', 'in', types)
      );
    } else {
      q = query(
        eventsCollectionWithConverter,
        where('start', '<=', Timestamp.fromDate(rangeEnd))
      );
    }

    try {
      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(docSnap => docSnap.data());

      const overlappingEvents = fetchedEvents.filter(event => {
        const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
        return eventEnd >= rangeStart;
      });

      logger.info(`[FirestoreRepo] Fetched ${overlappingEvents.length} overlapping events (out of ${fetchedEvents.length} initially queried based on start date and type) for range ${rangeStart.toISOString()} - ${rangeEnd.toISOString()} and types ${types?.join(', ')} for user ${userId}`);
      return overlappingEvents;
    } catch (error) {
      logger.error(`[FirestoreRepo] Error fetching overlapping events for date range ${rangeStart.toISOString()} - ${rangeEnd.toISOString()} and types ${types?.join(', ')}:`, error);
      if (error instanceof Error && (error as any).code === 'failed-precondition') { // Firestore uses 'failed-precondition' for missing indexes
        logger.error('[FirestoreRepo] This error likely indicates a missing composite index in Firestore. Please check your Firestore console to create the required index for querying `start` and `type`.');
      } else if (error instanceof Error && error.message.includes('INVALID_ARGUMENT')) {
        logger.error('[FirestoreRepo] This error might be due to an empty `types` array passed to an `in` query (ensure `types` has elements if provided), or another invalid argument.');
      }
      throw error;
    }
  }
} 
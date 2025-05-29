import { db, auth } from '../../firebaseConfig'; // Corrected path
import {
  collection,
  doc,
  // addDoc, // addDoc is not used if IDs are predefined from CalendarEvent
  setDoc,
  // getDoc, // getDoc is not used if getAll fetches all and filters client-side, or specific queries are used
  getDocs,
  deleteDoc,
  query,
  // where, // where is not used in the current basic getAll implementation
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { CalendarEvent, CalendarEventProps } from '../../domain/calendar/entities/CalendarEvent';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { logger } from '../../utils/logger'; // Corrected path

// Helper to get current user UID
const getCurrentUserId = (): string | null => {
  return auth.currentUser ? auth.currentUser.uid : null;
};

// Firestore data converters (optional but good practice for complex objects)
const calendarEventConverter = {
  toFirestore: (event: CalendarEvent): any => { // Return type can be more generic for Firestore
    const jsonData = event.toJSON(); // Gets start/end as ISO strings
    return {
      ...jsonData,
      start: Timestamp.fromDate(new Date(jsonData.start as string)), // Convert ISO string to Date, then to Timestamp
      end: Timestamp.fromDate(new Date(jsonData.end as string)),     // Convert ISO string to Date, then to Timestamp
    };
  },
  fromFirestore: (
    snapshot: any, // firebase.firestore.QueryDocumentSnapshot
    options: any   // firebase.firestore.SnapshotOptions
  ): CalendarEvent => {
    const data = snapshot.data(options);
    // Firestore returns Timestamps; CalendarEvent constructor expects Date | string
    // So, convert Timestamps to Date objects
    return new CalendarEvent({
      id: snapshot.id, // Use document ID as event ID
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
    // Apply the converter at the collection level
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
    // No need to get eventsCollection here, doc refs can be created with converter directly
    // const eventsCollection = this.getEventsCollection(userId); 

    events.forEach(event => {
      // Create a doc ref with the specific user's collection path and event ID, applying the converter
      const eventRef = doc(db, `users/${userId}/events/${event.id}`).withConverter(calendarEventConverter);
      // The 'event' object is automatically converted by toFirestore via withConverter
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
      // Data is automatically converted by fromFirestore via withConverter
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
    // Create a doc ref with the specific user's collection path and event ID
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
    // Create a doc ref with the specific user's collection path and event ID, applying the converter
    const eventRef = doc(db, `users/${userId}/events/${event.id}`).withConverter(calendarEventConverter);
    try {
      // The 'event' object is automatically converted by toFirestore via withConverter
      await setDoc(eventRef, event, { merge: true }); 
      logger.info(`[FirestoreRepo] Updated event ${event.id} for user ${userId}`);
    } catch (error) {
      logger.error(`[FirestoreRepo] Error updating event ${event.id}:`, error);
      throw error;
    }
  }
} 
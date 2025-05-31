import { container } from '../config/container';
import { CalendarEventRepository } from '../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../domain/calendar/repositories/SubEventRepository';
import { storageService } from '../presentation/services/storage'; // Assuming this is the correct path to your IndexedDB service
import { auth } from '../firebaseConfig';
import { logger } from './logger';

const MIGRATION_FLAG_KEY = 'firestoreMigrationComplete_v1';

export async function migrateDataToFirestore(): Promise<void> {
  logger.info('[Migration] Checking if data migration to Firestore is needed...');

  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    logger.info('[Migration] Data migration has already been completed. Skipping.');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    logger.warn('[Migration] No authenticated user found. Cannot perform migration.');
    // Optionally, you could try again later or prompt the user to log in.
    return;
  }

  logger.info(`[Migration] Starting data migration for user: ${user.uid}`);

  try {
    const firestoreEventRepo = container.get<CalendarEventRepository>('calendarEventRepository');
    const firestoreSubEventRepo = container.get<SubEventRepository>('subEventRepository');

    // 1. Load data from IndexedDB via storageService
    logger.info('[Migration] Loading events from IndexedDB via storageService...');
    const localEvents = await storageService.loadEvents(); // Public method from storageService
    logger.info(`[Migration] Found ${localEvents.length} events in IndexedDB.`);

    logger.info('[Migration] Loading sub-events from IndexedDB via storageService...');
    const localSubEvents = await storageService.loadSubEvents(); // Public method from storageService
    logger.info(`[Migration] Found ${localSubEvents.length} sub-events in IndexedDB.`);

    // 2. Save CalendarEvents to Firestore
    if (localEvents.length > 0) {
      logger.info(`[Migration] Migrating ${localEvents.length} calendar events to Firestore...`);
      // The save method in FirestoreCalendarEventRepository expects CalendarEvent instances
      // storageService.loadEvents() should already return CalendarEvent instances.
      await firestoreEventRepo.save(localEvents);
      logger.info('[Migration] Calendar events migrated successfully.');
    } else {
      logger.info('[Migration] No calendar events to migrate.');
    }

    // 3. Save SubEvents to Firestore
    if (localSubEvents.length > 0) {
      logger.info(`[Migration] Migrating ${localSubEvents.length} sub-events to Firestore...`);
      // storageService.loadSubEvents() should return SubEvent instances.
      await firestoreSubEventRepo.save(localSubEvents);
      logger.info('[Migration] Sub-events migrated successfully.');
    } else {
      logger.info('[Migration] No sub-events to migrate.');
    }

    // 4. Set migration complete flag
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    logger.info('[Migration] Successfully migrated data to Firestore and set completion flag.');

  } catch (error) {
    logger.error('[Migration] Error during data migration to Firestore:', error);
    // Depending on the error, you might want to clear the flag or implement more robust retry/resume logic.
    // For now, we log the error. If it fails, the flag won't be set, and it can be retried.
  }
} 
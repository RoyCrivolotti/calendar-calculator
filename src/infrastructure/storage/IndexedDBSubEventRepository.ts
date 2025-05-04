import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { storageService } from '../../presentation/services/storage';
import { getLogger } from '../../utils/logger';
import { 
  trackWithRetry, 
  StorageReadError, 
  StorageWriteError, 
  StorageDeleteError 
} from '../../utils/errorHandler';

const logger = getLogger('indexeddb-subevent-repository');

export class IndexedDBSubEventRepository implements SubEventRepository {
  async save(subEvents: SubEvent[]): Promise<void> {
    return trackWithRetry(
      'SaveSubEventsToIndexedDB',
      async () => {
        try {
          logger.info(`Saving ${subEvents.length} sub-events to repository`);
          await storageService.saveSubEvents(subEvents);
        } catch (error) {
          logger.error('Failed to save sub-events to IndexedDB:', error);
          throw new StorageWriteError(
            'Failed to save sub-events to IndexedDB',
            error instanceof Error ? error : new Error(String(error)),
            { subEventCount: subEvents.length }
          );
        }
      },
      {
        context: { 
          subEventCount: subEvents.length,
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }

  async getAll(): Promise<SubEvent[]> {
    return trackWithRetry(
      'GetAllSubEventsFromIndexedDB',
      async () => {
        try {
          logger.info('Loading all sub-events from repository');
          const subEvents = await storageService.loadSubEvents();
          logger.info(`Loaded ${subEvents.length} sub-events from repository`);
          return subEvents;
        } catch (error) {
          logger.error('Failed to load sub-events from IndexedDB:', error);
          throw new StorageReadError(
            'Failed to load sub-events from IndexedDB',
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'getAll' }
          );
        }
      },
      {
        context: { 
          operation: 'getAll',
          storageType: 'indexedDB'
        },
        retries: 3
      }
    );
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    return trackWithRetry(
      `GetSubEventsByParentFromIndexedDB(${parentId})`,
      async () => {
        try {
          logger.info(`Loading sub-events for parent ID: ${parentId}`);
          const allSubEvents = await this.getAll();
          const parentSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId === parentId);
          logger.info(`Found ${parentSubEvents.length} sub-events for parent ID: ${parentId}`);
          return parentSubEvents;
        } catch (error) {
          // Don't wrap StorageReadError from getAll
          if (error instanceof StorageReadError) {
            throw error;
          }
          
          logger.error(`Failed to get sub-events for parent ID ${parentId}:`, error);
          throw new StorageReadError(
            `Failed to get sub-events for parent ID ${parentId} from IndexedDB`,
            error instanceof Error ? error : new Error(String(error)),
            { parentId }
          );
        }
      },
      {
        context: { 
          parentId,
          operation: 'getByParentId',
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }

  async deleteByParentId(parentId: string): Promise<void> {
    return trackWithRetry(
      `DeleteSubEventsByParentFromIndexedDB(${parentId})`,
      async () => {
        try {
          logger.info(`Deleting sub-events for parent ID: ${parentId}`);
          const allSubEvents = await this.getAll();
          const remainingSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId !== parentId);
          
          const deletedCount = allSubEvents.length - remainingSubEvents.length;
          if (deletedCount === 0) {
            logger.info(`No sub-events found for parent ID: ${parentId}, nothing to delete`);
            return;
          }
          
          await this.save(remainingSubEvents);
          logger.info(`Successfully deleted ${deletedCount} sub-events for parent ID: ${parentId}`);
        } catch (error) {
          // Don't wrap StorageReadError or StorageWriteError from previous operations
          if (error instanceof StorageReadError || error instanceof StorageWriteError) {
            throw error;
          }
          
          logger.error(`Failed to delete sub-events for parent ID ${parentId}:`, error);
          throw new StorageDeleteError(
            `Failed to delete sub-events for parent ID ${parentId} from IndexedDB`,
            error instanceof Error ? error : new Error(String(error)),
            { parentId }
          );
        }
      },
      {
        context: { 
          parentId,
          operation: 'deleteByParentId',
          storageType: 'indexedDB'
        },
        retries: 2
      }
    );
  }
} 
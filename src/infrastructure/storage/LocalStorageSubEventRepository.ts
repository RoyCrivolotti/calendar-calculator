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

const logger = getLogger('subevent-repository');

export class LocalStorageSubEventRepository implements SubEventRepository {
  async save(subEvents: SubEvent[]): Promise<void> {
    return trackWithRetry(
      'SaveSubEvents',
      async () => {
        logger.debug(`Saving ${subEvents.length} sub-events to storage`);
        
        try {
          await storageService.saveSubEvents(subEvents);
          logger.debug(`Saved ${subEvents.length} sub-events to storage`);
        } catch (error) {
          logger.error('Failed to save sub-events to storage:', error);
          throw new StorageWriteError(
            'Failed to save sub-events to storage',
            error instanceof Error ? error : new Error(String(error)),
            { subEventCount: subEvents.length }
          );
        }
      },
      {
        context: { 
          subEventCount: subEvents.length,
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }

  async getAll(): Promise<SubEvent[]> {
    return trackWithRetry(
      'GetAllSubEvents',
      async () => {
        try {
          const subEvents = await storageService.loadSubEvents();
          logger.debug(`Loaded ${subEvents.length} sub-events from storage`);
          return subEvents;
        } catch (error) {
          logger.error('Failed to load sub-events from storage:', error);
          throw new StorageReadError(
            'Failed to load sub-events from storage',
            error instanceof Error ? error : new Error(String(error)),
            { operation: 'getAll' }
          );
        }
      },
      {
        context: { 
          operation: 'getAll',
          storageType: 'localStorage'
        },
        retries: 3
      }
    );
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    return trackWithRetry(
      `GetSubEventsByParent(${parentId})`,
      async () => {
        try {
          const allSubEvents = await this.getAll();
          const parentSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId === parentId);
          logger.debug(`Retrieved ${parentSubEvents.length} sub-events for parent ${parentId}`);
          return parentSubEvents;
        } catch (error) {
          // If it's already a specific error from getAll, don't wrap it
          if (error instanceof StorageReadError) {
            throw error;
          }
          
          logger.error(`Failed to get sub-events for parent ${parentId}:`, error);
          throw new StorageReadError(
            `Failed to get sub-events for parent ${parentId}`,
            error instanceof Error ? error : new Error(String(error)),
            { parentId }
          );
        }
      },
      {
        context: { 
          parentId,
          operation: 'getByParentId',
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }

  async deleteByParentId(parentId: string): Promise<void> {
    return trackWithRetry(
      `DeleteSubEventsByParent(${parentId})`,
      async () => {
        try {
          const allSubEvents = await this.getAll();
          const initialCount = allSubEvents.length;
          const filteredSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId !== parentId);
          const deletedCount = initialCount - filteredSubEvents.length;
          
          if (deletedCount === 0) {
            logger.warn(`No sub-events found to delete for parent ${parentId}`);
            return;
          }
          
          await this.save(filteredSubEvents);
          logger.debug(`Deleted ${deletedCount} sub-events for parent ${parentId}`);
        } catch (error) {
          // If it's already a specific error from getAll or save, don't wrap it
          if (error instanceof StorageReadError || error instanceof StorageWriteError) {
            throw error;
          }
          
          logger.error(`Failed to delete sub-events for parent ${parentId}:`, error);
          throw new StorageDeleteError(
            `Failed to delete sub-events for parent ${parentId}`,
            error instanceof Error ? error : new Error(String(error)),
            { parentId }
          );
        }
      },
      {
        context: { 
          parentId,
          operation: 'deleteByParentId',
          storageType: 'localStorage'
        },
        retries: 2
      }
    );
  }
} 
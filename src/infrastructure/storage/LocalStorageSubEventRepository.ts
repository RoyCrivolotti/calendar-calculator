import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { storageService } from '../../presentation/services/storage';
import { getLogger } from '../../utils/logger';

const logger = getLogger('subevent-repository');

export class LocalStorageSubEventRepository implements SubEventRepository {
  async save(subEvents: SubEvent[]): Promise<void> {
    const startTime = performance.now();
    try {
      logger.debug(`Saving ${subEvents.length} sub-events to storage`);
      await storageService.saveSubEvents(subEvents);
      const endTime = performance.now();
      logger.debug(`Saved ${subEvents.length} sub-events to storage (${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
      logger.error('Failed to save sub-events to storage:', error);
      throw new Error('Failed to save sub-events to storage');
    }
  }

  async getAll(): Promise<SubEvent[]> {
    const startTime = performance.now();
    try {
      const subEvents = await storageService.loadSubEvents();
      const endTime = performance.now();
      logger.debug(`Loaded ${subEvents.length} sub-events from storage (${(endTime - startTime).toFixed(2)}ms)`);
      return subEvents;
    } catch (error) {
      logger.error('Failed to load sub-events from storage:', error);
      throw new Error('Failed to load sub-events from storage');
    }
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    const startTime = performance.now();
    try {
      const allSubEvents = await this.getAll();
      const parentSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId === parentId);
      const endTime = performance.now();
      logger.debug(`Retrieved ${parentSubEvents.length} sub-events for parent ${parentId} (${(endTime - startTime).toFixed(2)}ms)`);
      return parentSubEvents;
    } catch (error) {
      logger.error(`Failed to get sub-events for parent ${parentId}:`, error);
      throw new Error('Failed to get sub-events by parent ID from storage');
    }
  }

  async deleteByParentId(parentId: string): Promise<void> {
    const startTime = performance.now();
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
      const endTime = performance.now();
      logger.debug(`Deleted ${deletedCount} sub-events for parent ${parentId} (${(endTime - startTime).toFixed(2)}ms)`);
    } catch (error) {
      logger.error(`Failed to delete sub-events for parent ${parentId}:`, error);
      throw new Error('Failed to delete sub-events by parent ID from storage');
    }
  }
} 
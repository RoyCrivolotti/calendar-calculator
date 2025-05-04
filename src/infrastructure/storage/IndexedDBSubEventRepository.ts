import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { storageService } from '../../presentation/services/storage';
import { logger } from '../../utils/logger';

export class IndexedDBSubEventRepository implements SubEventRepository {
  async save(subEvents: SubEvent[]): Promise<void> {
    try {
      logger.info(`Saving ${subEvents.length} sub-events to repository`);
      await storageService.saveSubEvents(subEvents);
    } catch (error) {
      logger.error('Failed to save sub-events to IndexedDB:', error);
      throw new Error('Failed to save sub-events to IndexedDB');
    }
  }

  async getAll(): Promise<SubEvent[]> {
    try {
      logger.info('Loading all sub-events from repository');
      const subEvents = await storageService.loadSubEvents();
      logger.info(`Loaded ${subEvents.length} sub-events from repository`);
      return subEvents;
    } catch (error) {
      logger.error('Failed to load sub-events from IndexedDB:', error);
      throw new Error('Failed to load sub-events from IndexedDB');
    }
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    try {
      logger.info(`Loading sub-events for parent ID: ${parentId}`);
      const allSubEvents = await this.getAll();
      const parentSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId === parentId);
      logger.info(`Found ${parentSubEvents.length} sub-events for parent ID: ${parentId}`);
      return parentSubEvents;
    } catch (error) {
      logger.error(`Failed to get sub-events for parent ID ${parentId}:`, error);
      throw new Error('Failed to get sub-events by parent ID from IndexedDB');
    }
  }

  async deleteByParentId(parentId: string): Promise<void> {
    try {
      logger.info(`Deleting sub-events for parent ID: ${parentId}`);
      const allSubEvents = await this.getAll();
      const remainingSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId !== parentId);
      await this.save(remainingSubEvents);
      const deletedCount = allSubEvents.length - remainingSubEvents.length;
      logger.info(`Successfully deleted ${deletedCount} sub-events for parent ID: ${parentId}`);
    } catch (error) {
      logger.error(`Failed to delete sub-events for parent ID ${parentId}:`, error);
      throw new Error('Failed to delete sub-events by parent ID from IndexedDB');
    }
  }
} 
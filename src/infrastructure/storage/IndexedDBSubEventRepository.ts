import { SubEvent } from '../../domain/calendar/entities/SubEvent';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { storageService } from '../../presentation/services/storage';

export class IndexedDBSubEventRepository implements SubEventRepository {
  async save(subEvents: SubEvent[]): Promise<void> {
    try {
      await storageService.saveSubEvents(subEvents);
    } catch (error) {
      console.error('Failed to save sub-events:', error);
      throw new Error('Failed to save sub-events to IndexedDB');
    }
  }

  async getAll(): Promise<SubEvent[]> {
    try {
      return await storageService.loadSubEvents();
    } catch (error) {
      console.error('Failed to load sub-events:', error);
      throw new Error('Failed to load sub-events from IndexedDB');
    }
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    try {
      const allSubEvents = await this.getAll();
      return allSubEvents.filter(subEvent => subEvent.parentEventId === parentId);
    } catch (error) {
      console.error('Failed to get sub-events by parent ID:', error);
      throw new Error('Failed to get sub-events by parent ID from IndexedDB');
    }
  }

  async deleteByParentId(parentId: string): Promise<void> {
    try {
      const allSubEvents = await this.getAll();
      const filteredSubEvents = allSubEvents.filter(subEvent => subEvent.parentEventId !== parentId);
      await this.save(filteredSubEvents);
    } catch (error) {
      console.error('Failed to delete sub-events by parent ID:', error);
      throw new Error('Failed to delete sub-events by parent ID from IndexedDB');
    }
  }
} 
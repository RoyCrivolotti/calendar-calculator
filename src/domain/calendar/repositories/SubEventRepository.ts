import { SubEvent } from '../entities/SubEvent';

export interface SubEventRepository {
  save(subEvents: SubEvent[]): Promise<void>;
  getAll(): Promise<SubEvent[]>;
  getByParentId(parentId: string): Promise<SubEvent[]>;
  deleteByParentId(parentId: string): Promise<void>;
} 
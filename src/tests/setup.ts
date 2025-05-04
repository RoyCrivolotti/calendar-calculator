import { vi } from 'vitest';
import { CalendarEvent } from '../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../domain/calendar/entities/SubEvent';
import { CalendarEventRepository } from '../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../domain/calendar/repositories/SubEventRepository';
import { v4 as uuidv4 } from 'uuid';

// Mock implementations
export class MockCalendarEventRepository implements CalendarEventRepository {
  private events: CalendarEvent[] = [];

  async save(events: CalendarEvent[]): Promise<void> {
    this.events = [...events];
  }

  async getAll(): Promise<CalendarEvent[]> {
    return [...this.events];
  }

  async delete(id: string): Promise<void> {
    this.events = this.events.filter(event => event.id !== id);
  }

  async update(event: CalendarEvent): Promise<void> {
    const index = this.events.findIndex(e => e.id === event.id);
    if (index !== -1) {
      this.events[index] = event;
    }
  }
}

export class MockSubEventRepository implements SubEventRepository {
  private subEvents: SubEvent[] = [];

  async save(subEvents: SubEvent[]): Promise<void> {
    this.subEvents = [...subEvents];
  }

  async getAll(): Promise<SubEvent[]> {
    return [...this.subEvents];
  }

  async getByParentId(parentId: string): Promise<SubEvent[]> {
    return this.subEvents.filter(subEvent => subEvent.parentEventId === parentId);
  }

  async deleteByParentId(parentId: string): Promise<void> {
    this.subEvents = this.subEvents.filter(subEvent => subEvent.parentEventId !== parentId);
  }
}

// Mock storage
export const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  })
};

// Mock IndexedDB
export const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

interface TestEventProps {
  id?: string;
  start?: Date;
  end?: Date;
  type?: 'oncall' | 'incident';
}

interface TestSubEventProps extends TestEventProps {
  parentEventId?: string;
  isWeekday?: boolean;
  isWeekend?: boolean;
  isHoliday?: boolean;
  isNightShift?: boolean;
  isOfficeHours?: boolean;
}

export function createTestEvent(props: TestEventProps = {}): CalendarEvent {
  return new CalendarEvent({
    id: props.id || uuidv4(),
    start: props.start || new Date('2024-01-01T09:00:00'),
    end: props.end || new Date('2024-01-01T17:00:00'),
    type: props.type || 'oncall'
  });
}

export function createTestSubEvent(props: TestSubEventProps = {}): SubEvent {
  const isWeekdayEvent = props.isWeekday ?? !props.isWeekend ?? true;
  const isWeekendEvent = props.isWeekend ?? !props.isWeekday ?? false;
  const isHolidayEvent = props.isHoliday ?? false;
  const isNightShiftEvent = props.isNightShift ?? false;
  const isOfficeHoursEvent = props.isOfficeHours ?? !isNightShiftEvent;

  return new SubEvent({
    id: props.id || uuidv4(),
    parentEventId: props.parentEventId || uuidv4(),
    start: props.start || new Date('2024-01-01T09:00:00'),
    end: props.end || new Date('2024-01-01T17:00:00'),
    isWeekday: isWeekdayEvent,
    isWeekend: isWeekendEvent,
    isHoliday: isHolidayEvent,
    isNightShift: isNightShiftEvent,
    isOfficeHours: isOfficeHoursEvent,
    type: props.type || 'oncall'
  });
}

// Test utilities
export function clearAllMocks(): void {
  vi.clearAllMocks();
  mockLocalStorage.clear();
}

export function setupTestEnvironment(): void {
  // Mock window.localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
  });

  // Mock window.indexedDB
  Object.defineProperty(window, 'indexedDB', {
    value: mockIndexedDB
  });

  // Reset all mocks before each test
  beforeEach(() => {
    clearAllMocks();
  });
}

// Custom test matchers
export function toBeValidCalendarEvent(event: CalendarEvent): boolean {
  return (
    event instanceof CalendarEvent &&
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    event.start instanceof Date &&
    event.end instanceof Date &&
    event.end > event.start &&
    (event.type === 'oncall' || event.type === 'incident')
  );
}

export function toBeValidSubEvent(subEvent: SubEvent): boolean {
  return (
    subEvent instanceof SubEvent &&
    typeof subEvent.id === 'string' &&
    subEvent.id.length > 0 &&
    typeof subEvent.parentEventId === 'string' &&
    subEvent.parentEventId.length > 0 &&
    subEvent.start instanceof Date &&
    subEvent.end instanceof Date &&
    subEvent.end > subEvent.start &&
    typeof subEvent.isWeekday === 'boolean' &&
    typeof subEvent.isWeekend === 'boolean' &&
    typeof subEvent.isHoliday === 'boolean' &&
    typeof subEvent.isNightShift === 'boolean' &&
    typeof subEvent.isOfficeHours === 'boolean'
  );
}

// Mock date-fns functions
vi.mock('date-fns', () => ({
  isWeekend: (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  },
  startOfDay: (date: Date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },
  endOfDay: (date: Date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  },
  differenceInHours: (end: Date, start: Date) => {
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  },
  eachDayOfInterval: ({ start, end }: { start: Date; end: Date }) => {
    const days: Date[] = [];
    let current = new Date(start);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  },
  startOfMonth: (date: Date) => {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  }
})); 
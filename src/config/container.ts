import { CalendarEventRepository } from '../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../domain/calendar/repositories/SubEventRepository';
import { LocalStorageCalendarEventRepository } from '../infrastructure/storage/LocalStorageCalendarEventRepository';
import { LocalStorageSubEventRepository } from '../infrastructure/storage/LocalStorageSubEventRepository';
import { CreateEventUseCase } from '../application/calendar/use-cases/CreateEvent';
import { UpdateEventUseCase } from '../application/calendar/use-cases/UpdateEvent';
import { DeleteEventUseCase } from '../application/calendar/use-cases/DeleteEvent';
import { CalculateCompensationUseCase } from '../application/calendar/use-cases/CalculateCompensation';
import { SubEventFactory } from '../domain/calendar/services/SubEventFactory';

class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();

  private constructor() {
    this.registerServices();
  }

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  private registerServices() {
    // Repositories
    this.services.set('calendarEventRepository', new LocalStorageCalendarEventRepository());
    this.services.set('subEventRepository', new LocalStorageSubEventRepository());

    // Services
    this.services.set('subEventFactory', new SubEventFactory());

    // Use cases
    this.services.set(
      'createEventUseCase',
      new CreateEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository')
      )
    );

    this.services.set(
      'updateEventUseCase',
      new UpdateEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository')
      )
    );

    this.services.set(
      'deleteEventUseCase',
      new DeleteEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository')
      )
    );

    this.services.set(
      'calculateCompensationUseCase',
      new CalculateCompensationUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository')
      )
    );
  }

  get<T>(serviceName: string): T {
    if (!this.services.has(serviceName)) {
      throw new Error(`Service ${serviceName} not found`);
    }
    return this.services.get(serviceName) as T;
  }
}

export const container = Container.getInstance(); 
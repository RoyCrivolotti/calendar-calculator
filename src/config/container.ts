import { CalendarEventRepository } from '../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../domain/calendar/repositories/SubEventRepository';
import { SalaryRecordRepository } from '../domain/calendar/repositories/SalaryRecordRepository';
import { FirestoreCalendarEventRepository } from '../infrastructure/storage/FirestoreCalendarEventRepository';
import { FirestoreSubEventRepository } from '../infrastructure/storage/FirestoreSubEventRepository';
import { FirestoreSalaryRecordRepository } from '../infrastructure/storage/FirestoreSalaryRecordRepository';
import { CreateEventUseCase } from '../application/calendar/use-cases/CreateEventUseCase';
import { UpdateEventUseCase } from '../application/calendar/use-cases/UpdateEventUseCase';
import { DeleteEventUseCase } from '../application/calendar/use-cases/DeleteEvent';
import { SubEventFactory } from '../domain/calendar/services/SubEventFactory';
import { CompensationService } from '../domain/calendar/services/CompensationService';
import { SalaryService } from '../domain/calendar/services/SalaryService';

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
    this.services.set('calendarEventRepository', new FirestoreCalendarEventRepository());
    this.services.set('subEventRepository', new FirestoreSubEventRepository());
    this.services.set('salaryRecordRepository', new FirestoreSalaryRecordRepository());

    // Services
    this.services.set('subEventFactory', new SubEventFactory());
    this.services.set('compensationService', new CompensationService());
    this.services.set(
      'salaryService',
      new SalaryService(this.get<SalaryRecordRepository>('salaryRecordRepository'))
    );

    // Use cases
    this.services.set(
      'createEventUseCase',
      new CreateEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository'),
        this.get<SubEventFactory>('subEventFactory')
      )
    );

    this.services.set(
      'updateEventUseCase',
      new UpdateEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository'),
        this.get<SubEventFactory>('subEventFactory')
      )
    );

    this.services.set(
      'deleteEventUseCase',
      new DeleteEventUseCase(
        this.get<CalendarEventRepository>('calendarEventRepository'),
        this.get<SubEventRepository>('subEventRepository'),
        this.get<SubEventFactory>('subEventFactory')
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
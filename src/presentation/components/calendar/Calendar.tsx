import React, { useRef, useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import CompensationSection from './CompensationSection';
import MonthlyCompensationSummary from './MonthlyCompensationSummary';
import CalendarWrapper from './CalendarWrapper';
// Lazy load modals since they are only needed when opened
const EventDetailsModal = lazy(() => import('./EventDetailsModal'));
const HolidayConflictModal = lazy(() => import('./HolidayConflictModal'));
const HolidayDeleteModal = lazy(() => import('./HolidayDeleteModal'));
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { RootState } from '../../store';
import {
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setEvents,
  createEventAsync,
  updateEventAsync,
  deleteEventAsync,
  optimisticallyAddEvent,
  finalizeOptimisticEvent,
  revertOptimisticAdd,
  optimisticallyUpdateEvent,
  finalizeOptimisticUpdate,
  revertOptimisticUpdate,
} from '../../store/slices/calendarSlice';
import { container } from '../../../config/container';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { DEFAULT_EVENT_TIMES } from '../../../config/constants';
import { logger } from '../../../utils/logger';
import { getMonthKey } from '../../../utils/calendarUtils';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { trackOperation } from '../../../utils/errorHandler';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button as SharedButton } from '../common/ui';

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem;
  gap: 1rem;
`;

const ModalLoadingFallback = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  min-height: 200px;
`;

const Calendar: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    events: currentEventsFromStore,
    currentDate,
    selectedEvent,
    showEventModal,
  } = useAppSelector((state: RootState) => state.calendar);
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);
  const [compensationData, setCompensationData] = useState<CompensationBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState<CalendarEventProps[]>([]);
  const [pendingEventSave, setPendingEventSave] = useState<CalendarEvent | null>(null);
  const [pendingEventDelete, setPendingEventDelete] = useState<CalendarEvent | null>(null);
  const [isHolidayConflict, setIsHolidayConflict] = useState(false);
  const [compensationSectionKey, setCompensationSectionKey] = useState(0);

  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const calculatorFacade = useMemo(() => {
    const eventRepo = container.get<CalendarEventRepository>('calendarEventRepository');
    const subEventRepo = container.get<SubEventRepository>('subEventRepository');
    return CompensationCalculatorFacade.getInstance(eventRepo, subEventRepo);
  }, []);
  
  const updateCompensationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestCalculationIdRef = useRef<number>(0);
  const calendarRef = useRef<FullCalendar>(null);
  
  const refreshCalendarEvents = useCallback(async () => {
    if (!currentUser || !currentUser.uid) {
      logger.info('[Calendar] No authenticated user or UID. Skipping Firestore event load.');
      dispatch(setEvents([]));
      return;
    }
    logger.info(`[Calendar] User ${currentUser.uid}. Refreshing events from Firestore...`);
    try {
      const eventRepo = container.get<CalendarEventRepository>('calendarEventRepository');
      const firestoreEvents = await eventRepo.getAll();
      dispatch(setEvents(firestoreEvents.map(event => event.toJSON())));
      logger.info(`[Calendar] Loaded ${firestoreEvents.length} events from Firestore after refresh.`);
    } catch (error) {
      logger.error('[Calendar] Error refreshing events from Firestore:', error);
      dispatch(setEvents([]));
    }
  }, [dispatch, currentUser]);

  useEffect(() => {
    refreshCalendarEvents();
  }, [refreshCalendarEvents]);
  
  const updateCompensationData = useCallback(async (calculationId: number) => {
    logger.info(`updateCompensationData triggered (calcId: ${calculationId})`); 
    
    if (latestCalculationIdRef.current !== calculationId) {
      logger.warn(`Stale compensation calculation (id: ${calculationId}), bailing.`);
      return;
    }

    if (currentEventsFromStore.length === 0) {
      logger.info('No events for compensation calculation.');
      setCompensationData([]);
      return;
    }
    
    setLoading(true);
    
    try {
      const subEventRepo = container.get<SubEventRepository>('subEventRepository');
      const allDomainSubEvents = await subEventRepo.getAll();
      logger.info(`[updateCompensationData] Fetched ${allDomainSubEvents.length} total sub-events for summary calculation.`);

      const months = new Set<string>();
      currentEventsFromStore.forEach(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        let currentIterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const finalMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (currentIterDate <= finalMonthDate) {
          months.add(getMonthKey(currentIterDate));
          // Move to the first day of the next month
          currentIterDate.setMonth(currentIterDate.getMonth() + 1);
        }
      });
      
      logger.info(`[updateCompensationData] Unique months for summary: ${Array.from(months).join(', ')}`);

      const allData: CompensationBreakdown[] = [];
      const calendarEvents = currentEventsFromStore.map(event => new CalendarEvent(event));
      
      for (const monthKey of Array.from(months)) {
        if (latestCalculationIdRef.current !== calculationId) {
          logger.warn(`Stale calculation detected mid-process (id: ${calculationId}), bailing.`);
          setLoading(false);
          return;
        }
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1);
        monthDate.setHours(0, 0, 0, 0);
        
        try {
          const monthData = await calculatorFacade.calculateMonthlyCompensation(monthDate, calendarEvents, allDomainSubEvents);
          
          const hasMeaningfulData = monthData.some(item => item.amount > 0);

          if (hasMeaningfulData) {
            allData.push(...monthData);
          } else if (monthData.length > 0) {
            logger.info(`Month ${monthKey} calculated with no positive compensation amounts. Not including in summary.`);
          }

        } catch (error) {
          logger.error(`Error calculating compensation for month ${monthKey}:`, error);
        }
      }
      
      if (latestCalculationIdRef.current === calculationId) {
        logger.info(`Compensation data updated (calcId: ${calculationId}, ${allData.length} items).`);
        setCompensationData(allData);
      } else {
        logger.warn(`Stale calculation (id: ${calculationId}) before final set state, bailing.`);
      }
      
    } catch (error) {
      logger.error(`Error in updateCompensationData (calcId: ${calculationId}):`, error);
      if (latestCalculationIdRef.current === calculationId) {
        setCompensationData([]);
      }
    } finally {
      if (latestCalculationIdRef.current === calculationId || currentEventsFromStore.length === 0) {
        setLoading(false);
      }
      logger.info(`updateCompensationData finished (calcId: ${calculationId})`); 
    }
  }, [currentEventsFromStore, calculatorFacade, getMonthKey]);
  
  const updateCompensationDataRef = useRef(updateCompensationData);
  useEffect(() => {
    updateCompensationDataRef.current = updateCompensationData;
  }, [updateCompensationData]);

  const debouncedUpdateCompensationData = useCallback(() => {
    if (updateCompensationTimeoutRef.current) {
      clearTimeout(updateCompensationTimeoutRef.current);
    }
    latestCalculationIdRef.current += 1;
    const currentCalculationId = latestCalculationIdRef.current;
    calculatorFacade.clearCaches();
    
    updateCompensationTimeoutRef.current = setTimeout(() => {
      updateCompensationDataRef.current(currentCalculationId);
    }, 300);
  }, [calculatorFacade]);

  // Main useEffect for triggering summary updates
  useEffect(() => {
    logger.debug('[Calendar] useEffect for summary re-calculation. Events count: ' + currentEventsFromStore.length + '. Triggering debounce.');
    debouncedUpdateCompensationData();
  }, [currentEventsFromStore, debouncedUpdateCompensationData]);

  const handleDataRefresh = useCallback(async () => {
    logger.info('[Calendar] Data changed in summary, triggering full refresh.');
    await refreshCalendarEvents();
    debouncedUpdateCompensationData();
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.refetchEvents();
      logger.info('[Calendar] Explicitly refetched FullCalendar events after data refresh.');
    }
  }, [refreshCalendarEvents, debouncedUpdateCompensationData, calendarRef]);

  const handleEventUpdate = useCallback((eventDataFromWrapper: { id: string; start: Date; end: Date | null; viewType: string }) => {
    logger.info(
      `%c[Calendar] handleEventUpdate for [${eventDataFromWrapper.viewType}] view, event ID: ${eventDataFromWrapper.id}`,
      'color: green; font-weight: bold;',
      {
        rawStartDate: eventDataFromWrapper.start,
        rawEndDate: eventDataFromWrapper.end,
        startISO: eventDataFromWrapper.start?.toISOString(),
        endISO: eventDataFromWrapper.end?.toISOString(),
      }
    );

    const eventToUpdate = currentEventsFromStore.find(e => e.id === eventDataFromWrapper.id);
    if (!eventToUpdate) {
      logger.warn(`[Calendar] Event with ID ${eventDataFromWrapper.id} not found for update.`);
      return;
    }

    let newStart = eventDataFromWrapper.start ? new Date(eventDataFromWrapper.start) : null;
    let newEnd = eventDataFromWrapper.end ? new Date(eventDataFromWrapper.end) : null;

    if (!newStart) {
      logger.error('[Calendar] newStart is null. Aborting update.', eventDataFromWrapper);
      return;
    }

    if (!newEnd) {
      const originalStart = new Date(eventToUpdate.start);
      const originalEnd = new Date(eventToUpdate.end);
      const duration = originalEnd.getTime() - originalStart.getTime();
      newEnd = new Date(newStart.getTime() + duration);
      logger.warn('[Calendar] newEnd was null. Calculated based on original duration:', newEnd.toISOString());
    }
    
    logger.info(`[Calendar] Original event type: ${eventToUpdate.type}. Before logic - Parsed newStart: ${newStart.toISOString()}, Parsed newEnd: ${newEnd.toISOString()}`);

    if (eventDataFromWrapper.viewType === 'dayGridMonth') {
      logger.info('[Calendar] Applying DAY_GRID_MONTH logic');
      if (eventToUpdate.type === 'holiday') {
        newStart.setHours(0, 0, 0, 0);
        newEnd = new Date(newEnd.setDate(newEnd.getDate() -1));
        newEnd.setHours(23, 59, 59, 999);
        logger.info(`  Holiday in Month: Set to full days. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      } else if (eventToUpdate.type === 'oncall') {
        const originalEventStart = new Date(eventToUpdate.start);
        const originalEventEnd = new Date(eventToUpdate.end);
        const durationMs = originalEventEnd.getTime() - originalEventStart.getTime();
        
        newStart.setHours(9, 0, 0, 0);
        newEnd = new Date(newStart.getTime() + durationMs);
        logger.info(`  On-Call in Month: Set to 9AM start, maintained duration. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      } else if (eventToUpdate.type === 'incident') {
        const originalEventStart = new Date(eventToUpdate.start);
        const originalEventEnd = new Date(eventToUpdate.end);
        const durationMs = originalEventEnd.getTime() - originalEventStart.getTime();
        const originalStartHour = originalEventStart.getHours();
        const originalStartMinutes = originalEventStart.getMinutes();

        newStart.setHours(originalStartHour, originalStartMinutes, 0, 0);
        newEnd = new Date(newStart.getTime() + durationMs);
        logger.info(`  Incident in Month: Maintained time/duration. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      }
    } else if (eventDataFromWrapper.viewType === 'timeGridWeek') {
      logger.info('[Calendar] Applying TIME_GRID_WEEK logic - using precise times from FC.');
    } else {
      logger.warn(`[Calendar] Unknown viewType: ${eventDataFromWrapper.viewType} - using direct times.`);
    }

    const updatedEventProps: CalendarEventProps = {
      ...eventToUpdate,
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    };

    logger.info(
      `[Calendar] Dispatching updateEventAsync for event ID: ${updatedEventProps.id}`,
      updatedEventProps
    );
    dispatch(updateEventAsync(updatedEventProps));

  }, [dispatch, currentEventsFromStore, logger]);

  useEffect(() => {
    debouncedUpdateCompensationData();
  }, [currentEventsFromStore, currentDate, debouncedUpdateCompensationData]);

  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const event = currentEventsFromStore.find(e => e.id === clickInfo.event.id);
    if (event) {
      logger.info(`User clicked event: ${event.id} (${event.type})`);
      dispatch(setSelectedEvent(event));
      dispatch(setShowEventModal(true));
    }
  }, [currentEventsFromStore, dispatch]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg, type: 'oncall' | 'incident' | 'holiday') => {
    let effectiveStart = new Date(selectInfo.start);
    let effectiveEnd = new Date(selectInfo.end);
    
    if (type === 'holiday') {
      effectiveStart.setHours(0, 0, 0, 0);
      effectiveEnd = new Date(effectiveEnd.getTime() - 1);
      effectiveEnd.setHours(23, 59, 59, 999);
    } else if (type === 'oncall') {
      const calendarApi = calendarRef.current?.getApi();
      const viewType = calendarApi?.view.type;

      if (viewType === 'dayGridMonth' || selectInfo.allDay) { 
      } else {
        effectiveStart.setHours(0, 0, 0, 0);
      
        let inclusiveEndDay = new Date(selectInfo.end);
        if (inclusiveEndDay.getHours() === 0 && inclusiveEndDay.getMinutes() === 0 && inclusiveEndDay.getSeconds() === 0 && inclusiveEndDay.getMilliseconds() === 0) {
            inclusiveEndDay = new Date(inclusiveEndDay.getTime() - 1);
        }
        effectiveEnd = new Date(inclusiveEndDay);
        effectiveEnd.setDate(inclusiveEndDay.getDate() + 1);
        effectiveEnd.setHours(0, 0, 0, 0);
      }
    } else if (type === 'incident') {
      const calendarApi = calendarRef.current?.getApi();
      const viewType = calendarApi?.view.type;

      if (viewType === 'dayGridMonth' || selectInfo.allDay) {
        effectiveStart.setHours(DEFAULT_EVENT_TIMES.START_HOUR, DEFAULT_EVENT_TIMES.START_MINUTE, 0, 0);
      
        let inclusiveEndDay = new Date(selectInfo.end);
        inclusiveEndDay = new Date(inclusiveEndDay.getTime() - 1);

        effectiveEnd = new Date(inclusiveEndDay);
        effectiveEnd.setHours(DEFAULT_EVENT_TIMES.END_HOUR, DEFAULT_EVENT_TIMES.END_MINUTE, 0, 0);

        if (selectInfo.start.toDateString() === inclusiveEndDay.toDateString()) {
          effectiveEnd = new Date(effectiveStart);
          effectiveEnd.setHours(effectiveStart.getHours() + 1);
        }
      } else {
        if (selectInfo.start.getTime() === selectInfo.end.getTime()) {
          effectiveEnd.setHours(effectiveStart.getHours() + 1);
        }
      }
    }

    const newEvent = createCalendarEvent({
      id: `temp-${crypto.randomUUID()}`, 
      start: effectiveStart,
      end: effectiveEnd,  
      type,
      title: type === 'oncall' ? 'On-Call Shift' : type === 'incident' ? 'Incident' : 'Holiday'
    });

    dispatch(setSelectedEvent(newEvent.toJSON()));
    dispatch(setShowEventModal(true));

    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.unselect();
    }
  }, [dispatch, currentEventsFromStore, logger, calendarRef]);

  const handleViewChange = useCallback((info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
    logger.info(`Calendar view changed to: ${info.start.toISOString()} - ${info.end.toISOString()}`);
    dispatch(setCurrentDate(info.start.toISOString()));
  }, [dispatch]);

  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const start1 = new Date(event1.start).getTime();
    const end1 = new Date(event1.end).getTime();
    const start2 = new Date(event2.start).getTime();
    const end2 = new Date(event2.end).getTime();
    
    return (start1 < end2 && end1 > start2);
  };

  const findConflictingEvents = (event: CalendarEvent, allEvents: CalendarEventProps[]): CalendarEventProps[] => {
    return allEvents.filter(existingEvent => 
      existingEvent.id !== event.id && 
      eventsOverlap(event, new CalendarEvent(existingEvent))
    );
  };

  const regenerateConflictingSubEvents = async (
    holidayEvent: CalendarEvent,
    conflictingEventsProps: CalendarEventProps[],
    skipHolidaySave: boolean = false
  ): Promise<void> => {
    if (!currentUser) {
      logger.error('[regenerateConflictingSubEvents] User not authenticated. Aborting.');
      throw new Error('User not authenticated');
    }
    logger.info('[regenerateConflictingSubEvents] Starting regeneration...', { holidayEventId: holidayEvent.id, conflictingCount: conflictingEventsProps.length });

    const eventRepo = container.get<CalendarEventRepository>('calendarEventRepository');
    const subEventRepo = container.get<SubEventRepository>('subEventRepository');
    const subEventFactory = container.get<SubEventFactory>('subEventFactory');

    const allCurrentDomainEvents = currentEventsFromStore.map(props => new CalendarEvent(props));
    const holidayEventIndex = allCurrentDomainEvents.findIndex(e => e.id === holidayEvent.id);
    if (holidayEventIndex !== -1) {
      allCurrentDomainEvents[holidayEventIndex] = holidayEvent;
    } else {
      allCurrentDomainEvents.push(holidayEvent);
    }

    const allModifiedSubEvents: SubEvent[] = [];
    let holidaySubEvents: SubEvent[] = [];

    logger.debug(`[regenerateConflictingSubEvents] Deleting existing sub-events for holiday ${holidayEvent.id}`);
    await subEventRepo.deleteByParentId(holidayEvent.id);
    holidaySubEvents = subEventFactory.generateSubEvents(holidayEvent, allCurrentDomainEvents);
    holidaySubEvents.forEach((sub: SubEvent) => sub.markAsHoliday());
    allModifiedSubEvents.push(...holidaySubEvents);
    logger.debug(`[regenerateConflictingSubEvents] Regenerated ${holidaySubEvents.length} sub-events for holiday ${holidayEvent.id}`);

    for (const conflictingEventProps of conflictingEventsProps) {
      const conflictingEvent = new CalendarEvent(conflictingEventProps);
      logger.debug(`[regenerateConflictingSubEvents] Processing conflicting event ${conflictingEvent.id}`);
      
      await subEventRepo.deleteByParentId(conflictingEvent.id);
      let newSubEvents = subEventFactory.generateSubEvents(conflictingEvent, allCurrentDomainEvents);
      
      newSubEvents.forEach((sub: SubEvent) => {
        if (sub.start < holidayEvent.end && sub.end > holidayEvent.start) {
          if(sub.isWeekday){
            sub.markAsHoliday(); 
            logger.debug(`[regenerateConflictingSubEvents] Sub-event ${sub.id} for event ${conflictingEvent.id} marked as holiday due to overlap.`);
          }
        }
      });
      allModifiedSubEvents.push(...newSubEvents);
      logger.debug(`[regenerateConflictingSubEvents] Regenerated ${newSubEvents.length} sub-events for conflicting event ${conflictingEvent.id}`);
    }

    if (allModifiedSubEvents.length > 0) {
      logger.info(`[regenerateConflictingSubEvents] Saving ${allModifiedSubEvents.length} modified sub-events to Firestore...`);
      await subEventRepo.save(allModifiedSubEvents);
    }

    if (!skipHolidaySave) {
      logger.info(`[regenerateConflictingSubEvents] Saving holiday event ${holidayEvent.id} to Firestore...`);
      await eventRepo.update(holidayEvent);
    }
    logger.info('[regenerateConflictingSubEvents] Regeneration complete.');
  };

  const saveEventWithoutConflictCheck = useCallback(async (eventToSave: CalendarEvent) => {
    const isNewEvent = eventToSave.id.startsWith('temp-');
    const tempId = isNewEvent ? eventToSave.id : null;

    logger.info(`Optimistically saving ${isNewEvent ? 'new' : 'existing'} event: ${eventToSave.id} (${eventToSave.type})`);
    calculatorFacade.clearCaches();

    if (isNewEvent && tempId) {
      dispatch(optimisticallyAddEvent(eventToSave.toJSON()));
    } else { // Existing event
      dispatch(optimisticallyUpdateEvent(eventToSave.toJSON()));
    }
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));

    try {
      let savedEventProps: CalendarEventProps | null = null;
      if (isNewEvent && tempId) {
        const eventDataForCreation = {
          start: eventToSave.start.toISOString(),
          end: eventToSave.end.toISOString(),
          type: eventToSave.type,
          title: eventToSave.title,
        } as CalendarEventProps;
        savedEventProps = await dispatch(createEventAsync(eventDataForCreation)).unwrap();
        if (!savedEventProps) throw new Error("Create operation did not return event properties.");
        dispatch(finalizeOptimisticEvent({ tempId, finalEvent: savedEventProps }));
        logger.info(`Successfully created and finalized event ${savedEventProps.id}.`);
      } else { // Existing event
        savedEventProps = await dispatch(updateEventAsync(eventToSave.toJSON())).unwrap();
        if (!savedEventProps) throw new Error("Update operation did not return event properties.");
        dispatch(finalizeOptimisticUpdate()); 
        logger.info(`Successfully updated event ${savedEventProps.id}.`);
      }

      await refreshCalendarEvents();
      debouncedUpdateCompensationData();

    } catch (error: any) {
      logger.error(`Failed to ${isNewEvent ? 'create' : 'update'} event ${eventToSave.id} in backend:`, error);
      if (isNewEvent && tempId) {
        logger.warn(`Rolling back optimistic add for temp event ${tempId}`);
        dispatch(revertOptimisticAdd(tempId));
      } else if (!isNewEvent) { // Existing event update failed
        logger.warn(`Rolling back optimistic update for event ${eventToSave.id}`);
        dispatch(revertOptimisticUpdate());
      }
      setNotificationTitle('Save Failed');
      setNotificationMessage(
        `Failed to ${isNewEvent ? 'create new' : 'update'} event: ${error.message || 'Please try again.'}.` +
        (error.message?.includes('Quota exceeded') ? ' Firestore quota may be exceeded.' : '')
      );
      setNotificationVisible(true);
    }
  }, [dispatch, calculatorFacade, refreshCalendarEvents, debouncedUpdateCompensationData, currentEventsFromStore, optimisticallyUpdateEvent, finalizeOptimisticUpdate, revertOptimisticUpdate, optimisticallyAddEvent, finalizeOptimisticEvent, revertOptimisticAdd]);

  const handleSaveEvent = useCallback(async (event: CalendarEvent) => {
    logger.info(`Checking conflicts for ${event.type} event: ${event.id}`);
  
    if (event.type === 'holiday') {
      logger.info(`[Calendar] handleSaveEvent - Adjusting holiday ${event.id} to full day.`);
      const startDate = new Date(event.start);
      startDate.setHours(0, 0, 0, 0);
      event.start = startDate;

      const endDate = new Date(event.end);
      endDate.setHours(23, 59, 59, 999);
      event.end = endDate;
      logger.info(`  Adjusted holiday times: Start: ${event.start.toISOString()}, End: ${event.end.toISOString()}`);
    }
  
    const allConflictingEvents = findConflictingEvents(event, currentEventsFromStore);
    logger.info(`Found ${allConflictingEvents.length} total conflicting events`);
    
    if (allConflictingEvents.length > 0) {
      const conflictTypes = allConflictingEvents.map(e => e.type);
      logger.info(`Conflict types: ${conflictTypes.join(', ')}`);
    }
    
    if (event.type === 'holiday') {
      const conflictingEventsExist = allConflictingEvents.length > 0;
      
      if (conflictingEventsExist) {
        logger.info(`Holiday conflicts with ${allConflictingEvents.length} events - showing conflict modal`);
        setPendingEventSave(event);
        setConflictingEvents(allConflictingEvents);
        setIsHolidayConflict(true);
        setShowConflictModal(true);
        return;
      }
    } else {
      const conflictingHolidays = allConflictingEvents.filter(e => e.type === 'holiday');
      const hasHolidayConflicts = conflictingHolidays.length > 0;
      
      if (hasHolidayConflicts) {
        logger.info(`Event conflicts with ${conflictingHolidays.length} holidays - showing conflict modal`);
        setPendingEventSave(event);
        setConflictingEvents(conflictingHolidays);
        setIsHolidayConflict(false);
        setShowConflictModal(true);
        return;
      } else if (allConflictingEvents.length > 0) {
        logger.info(`Event has ${allConflictingEvents.length} non-holiday conflicts - proceeding without showing modal`);
      }
    }

    saveEventWithoutConflictCheck(event);
  }, [currentEventsFromStore, findConflictingEvents, setPendingEventSave, setShowConflictModal, setConflictingEvents, setIsHolidayConflict, saveEventWithoutConflictCheck]);

  const handleConflictModalAdjust = useCallback(async () => {
    if (!pendingEventSave) return;

    try {
      await trackOperation(
        `RegenerateConflictingSubEvents(${pendingEventSave.id})`,
        async () => {
          const isNewEvent = pendingEventSave.id.startsWith('temp-');
          
          let eventToSave = pendingEventSave;
          
          if (isNewEvent) {
            eventToSave = createCalendarEvent({
              ...pendingEventSave.toJSON(),
              id: crypto.randomUUID()
            });
            
            logger.info(`Generated permanent ID for new holiday: ${eventToSave.id}`);
          }
          
          logger.info(`Saving ${isNewEvent ? 'new' : 'existing'} holiday: ${eventToSave.id}`);
          
          if (isNewEvent) {
            await dispatch(createEventAsync(eventToSave.toJSON())).unwrap();
            logger.info(`Holiday ${eventToSave.id} saved to storage via createEventAsync`);
          } else {
            await dispatch(updateEventAsync(eventToSave.toJSON())).unwrap();
            logger.info(`Holiday ${eventToSave.id} updated in storage via updateEventAsync`);
          }
          
          logger.info(`Now regenerating sub-events for events that conflict with holiday ${eventToSave.id}`);
          await regenerateConflictingSubEvents(eventToSave, conflictingEvents, true);
          
          dispatch(setShowEventModal(false));
          dispatch(setSelectedEvent(null));
          
          setShowConflictModal(false);
          setPendingEventSave(null);
          setConflictingEvents([]);
          
          logger.info(`Conflict resolved, updating compensation data`);
          updateCompensationData(latestCalculationIdRef.current);
          
          return { 
            success: true, 
            conflictingEventsCount: conflictingEvents.length,
            eventType: eventToSave.type
          };
        },
        {
          type: pendingEventSave.type,
          conflictingEventsCount: conflictingEvents.length
        }
      );
    } catch (error) {
      logger.error('Failed to regenerate sub-events for conflicting events:', error);
      alert('Failed to update events. Please try again.');
      setShowConflictModal(false);
    }
  }, [
    pendingEventSave, 
    dispatch,
    conflictingEvents, 
    regenerateConflictingSubEvents, 
    setShowConflictModal, 
    setPendingEventSave, 
    setConflictingEvents, 
    calculatorFacade, 
    updateCompensationData,
    logger,
    trackOperation
  ]);

  const handleConflictModalCancel = () => {
    setShowConflictModal(false);
    setPendingEventSave(null);
    setConflictingEvents([]);
  };

  const handleConflictModalContinue = () => {
    handleConflictModalAdjust();
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    logger.info(`Attempting to delete event: ${event.id} (${event.type})`);
    
    if (event.type === 'holiday') {
      const allConflictingEvents = findConflictingEvents(event, currentEventsFromStore);
      
      const affectedEvents = allConflictingEvents.filter(e => e.type !== 'holiday');
      
      if (affectedEvents.length > 0) {
        logger.info(`Found ${affectedEvents.length} events affected by holiday deletion`);
        setPendingEventDelete(event);
        setConflictingEvents(affectedEvents);
        setShowDeleteModal(true);
        return;
      }
    }
    
    deleteEventWithoutConfirmation(event);
  };
  
  const deleteEventWithoutConfirmation = useCallback((event: CalendarEvent) => {
    calculatorFacade.clearCaches();
    const eventIdToDelete = event.id;

    dispatch(deleteEventAsync(eventIdToDelete)).unwrap().then(() => {
      logger.info(`Event ${eventIdToDelete} deleted successfully.`);
      setTimeout(() => {
        if (calendarRef.current) {
          calendarRef.current.getApi().refetchEvents();
          logger.info('[Calendar] Explicitly refetched FullCalendar events post-delete confirmation.');
        }
      }, 100);
    }).catch(error => {
      logger.error(`Failed to delete event ${eventIdToDelete}:`, error);
      setTimeout(() => debouncedUpdateCompensationData(), 100);
    });

    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  }, [dispatch, calculatorFacade, debouncedUpdateCompensationData, calendarRef, logger]);
  
  const handleDeleteWithRegeneration = async (shouldRegenerateEvents: boolean) => {
    if (!pendingEventDelete || !pendingEventDelete.id) return;
    
    const holidayId = pendingEventDelete.id;
    
    console.group(`Deleting holiday: ${holidayId}`);
    logger.info(`Deleting holiday: ${holidayId}`);
    
    const mustRegenerateEvents = conflictingEvents.length > 0;
    if (mustRegenerateEvents) {
      logger.info(`Must regenerate ${conflictingEvents.length} events affected by holiday deletion`);
      shouldRegenerateEvents = true;
    }
    
    logger.debug(`Regeneration enabled: ${shouldRegenerateEvents}`);
    
    calculatorFacade.clearCaches();
    
    await dispatch(deleteEventAsync(pendingEventDelete.id)).unwrap();
    logger.info(`Holiday ${holidayId} deleted successfully`);
    
    let updatedEvents = 0;
    if (shouldRegenerateEvents && conflictingEvents.length > 0) {
      try {
        logger.debug(`Regenerating ${conflictingEvents.length} events affected by holiday deletion`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const updatePromises = [];
        for (const eventProps of conflictingEvents) {
          if (eventProps.type === 'holiday') continue;
          
          logger.debug(`Regenerating sub-events for ${eventProps.type} event ${eventProps.id}`);
          
          const updatePromise = dispatch(updateEventAsync({
            ...eventProps,
            title: eventProps.title || (eventProps.type === 'oncall' ? 'On-Call Shift' : eventProps.type === 'incident' ? 'Incident' : 'Holiday')
          })).unwrap();
          
          updatePromises.push(updatePromise);
          updatedEvents++;
        }
        
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          logger.info(`Successfully updated ${updatedEvents} events after holiday deletion`);
        }
        
        calculatorFacade.clearCaches();
        
        updateCompensationData(latestCalculationIdRef.current);
        logger.info('Compensation data updated after holiday deletion');
        
      } catch (error) {
        logger.error('Error regenerating events after holiday deletion:', error);
        alert('Holiday deleted, but there was an error recalculating affected events. Compensation calculations may be affected.');
        
        updateCompensationData(latestCalculationIdRef.current);
      }
    } else {
      updateCompensationData(latestCalculationIdRef.current);
      logger.info('Compensation data updated after holiday deletion (no regeneration needed)');
    }
    
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
    
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    console.groupEnd();
    
    setTimeout(() => analyzeHolidayDetection(), 1000);
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
  };

  const handleCloseEventDetailsModal = useCallback(() => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    setNotificationVisible(false); 
  }, [dispatch]);

  const analyzeHolidayDetection = (targetDate?: Date) => {
    const dateToAnalyze = targetDate || new Date();
    const dateString = dateToAnalyze.toLocaleDateString();
    
    console.group(`Holiday Detection Analysis: ${dateString}`);
    logger.debug(`Starting holiday detection analysis for ${dateString}`);
    
    const holidayEvents = currentEventsFromStore.filter(event => {
      if (event.type !== 'holiday') return false;
      
      const eventStart = new Date(event.start);
      eventStart.setHours(0, 0, 0, 0);
      
      const eventEnd = new Date(event.end);
      eventEnd.setHours(0, 0, 0, 0);
      
      const targetDateCopy = new Date(dateToAnalyze);
      targetDateCopy.setHours(0, 0, 0, 0);
      
      return targetDateCopy >= eventStart && targetDateCopy <= eventEnd;
    });
    
    if (holidayEvents.length === 0) {
      logger.debug(`No holiday events found for ${dateString}`);
    } else {
      logger.debug(`Found ${holidayEvents.length} holiday events for ${dateString}:`);
      holidayEvents.forEach(holiday => {
        logger.debug(`- Holiday ID: ${holiday.id}, Start: ${new Date(holiday.start).toLocaleDateString()}, End: ${new Date(holiday.end).toLocaleDateString()}`);
      });
    }
    
    logger.warn("Sub-event analysis based on deprecated storageService has been removed from analyzeHolidayDetection.");
    console.groupEnd();
  };

  return (
    <CalendarContainer>
      <CalendarWrapper
        ref={calendarRef}
        events={currentEventsFromStore.map(event => new CalendarEvent(event))}
        onEventClick={handleEventClick}
        onDateSelect={(selectInfo, type) => handleDateSelect(selectInfo, type)}
        onViewChange={handleViewChange}
        currentDate={new Date(currentDate)}
        onEventUpdate={handleEventUpdate}
      />
      <CompensationSection
        key={compensationSectionKey}
        events={currentEventsFromStore.map(e => new CalendarEvent(e))}
        currentDate={new Date(currentDate)}
        onDateChange={(date) => dispatch(setCurrentDate(date.toISOString()))}
        onDataChange={handleDataRefresh}
      />
      {compensationData.length > 0 && (
        <MonthlyCompensationSummary 
          data={compensationData} 
          onDataChange={handleDataRefresh}
        />
      )}
      
      {showEventModal && selectedEvent && (
        <Suspense fallback={<ModalLoadingFallback>Loading...</ModalLoadingFallback>}>
          <EventDetailsModal
            event={new CalendarEvent(selectedEvent)}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onClose={handleCloseEventDetailsModal}
          />
        </Suspense>
      )}
      
      {showConflictModal && pendingEventSave && (
        <Suspense fallback={<ModalLoadingFallback>Loading...</ModalLoadingFallback>}>
          <HolidayConflictModal
            isOpen={showConflictModal}
            isHoliday={isHolidayConflict}
            conflicts={conflictingEvents}
            onAdjust={handleConflictModalAdjust}
            onContinue={handleConflictModalContinue}
            onCancel={handleConflictModalCancel}
          />
        </Suspense>
      )}
      
      {showDeleteModal && pendingEventDelete && (
        <Suspense fallback={<ModalLoadingFallback>Loading...</ModalLoadingFallback>}>
          <HolidayDeleteModal
            isOpen={showDeleteModal}
            holidayDate={pendingEventDelete.start}
            affectedEvents={conflictingEvents}
            onDelete={handleDeleteWithRegeneration}
            onCancel={handleCancelDelete}
          />
        </Suspense>
      )}
      
      {notificationVisible && (
        <Modal isOpen={notificationVisible} onClose={() => {
          setNotificationVisible(false);
          if (showEventModal && selectedEvent && selectedEvent.id.startsWith('temp-')) {
            const wasRolledBack = !currentEventsFromStore.some(e => e.id === selectedEvent.id);
            if (wasRolledBack) {
                handleCloseEventDetailsModal();
            }
          }
        }} preventBackdropClose={true}>
          <ModalHeader><ModalTitle>{notificationTitle}</ModalTitle></ModalHeader>
          <ModalBody><p>{notificationMessage}</p></ModalBody>
          <ModalFooter>
            <SharedButton variant="primary" onClick={() => {
              setNotificationVisible(false);
              if (showEventModal && selectedEvent && selectedEvent.id.startsWith('temp-')) {
                const wasRolledBack = !currentEventsFromStore.some(e => e.id === selectedEvent.id);
                if (wasRolledBack) {
                    handleCloseEventDetailsModal();
                }
              }
            }}>OK</SharedButton>
          </ModalFooter>
        </Modal>
      )}
    </CalendarContainer>
  );
};

export default React.memo(Calendar); 
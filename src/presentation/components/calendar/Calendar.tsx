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
} from '../../store/slices/calendarSlice';
import { User } from '../../store/slices/authSlice';
import { container } from '../../../config/container';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { DEFAULT_EVENT_TIMES } from '../../../config/constants';
import { logger } from '../../../utils/logger';
import { getMonthKey } from '../../../utils/calendarUtils';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { trackOperation } from '../../../utils/errorHandler';
import { SubEventFactory } from '../../../domain/calendar/services/SubEventFactory';

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem;
  gap: 1rem;
`;

// Simple loading fallback for modals
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
  const calculatorFacade = useMemo(() => {
    const subEventRepo = container.get<SubEventRepository>('subEventRepository');
    return CompensationCalculatorFacade.getInstance(subEventRepo);
  }, []);
  
  // Create a ref to store the timeout ID for debouncing
  const updateCompensationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calendarRef = useRef<FullCalendar>(null);

  // Make sure we have a clean, non-stale reference to setCompensationData
  const setCompensationDataRef = useRef(setCompensationData);
  
  // Update the ref when the function changes
  useEffect(() => {
    setCompensationDataRef.current = setCompensationData;
  }, [setCompensationData]);

  // ADD: Extracted function for loading events
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
      dispatch(setEvents([])); // Clear events on error
    }
  }, [dispatch, currentUser]);

  useEffect(() => {
    refreshCalendarEvents(); // Call the extracted function on initial load/user change
  }, [refreshCalendarEvents]); // Dependency on the memoized refresh function
  
  const updateCompensationData = useCallback(async () => {
    logger.info('Events available for compensation calculation:', currentEventsFromStore.length);
    
    if (currentEventsFromStore.length === 0) {
      logger.info('No events available for compensation calculation');
      setCompensationDataRef.current([]);
      return;
    }
    
    setLoading(true);
    
    try {
      // Get unique months from events
      const months = new Set<string>();
      
      // Scan through all events to find all months, including events that span across months
      currentEventsFromStore.forEach(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        // Check if event spans across months
        if (getMonthKey(startDate) !== getMonthKey(endDate)) {
          // For events spanning multiple months, add all months in the range
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const monthKey = getMonthKey(currentDate);
            months.add(monthKey);
            // Move to the next month
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        } else {
          // For single-month events, just add that month
          const monthKey = getMonthKey(startDate);
          months.add(monthKey);
        }
        
        logger.debug(`Found event in month(s): ${Array.from(months).join(', ')}`);
      });
      
      logger.info(`Found ${months.size} unique months with events`);
      
      const allData: CompensationBreakdown[] = [];
      
      // Convert events to CalendarEvent objects for the facade
      const calendarEvents = currentEventsFromStore.map(event => new CalendarEvent(event));
      
      // For each month with events, calculate compensation using the facade
      for (const monthKey of Array.from(months)) {
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date constructor
        monthDate.setHours(0, 0, 0, 0); // Reset time to midnight
        
        logger.info(`Calculating compensation for month: ${year}-${month}`);
        
        // Use the facade for consistent calculation
        try {
          const monthData = await calculatorFacade.calculateMonthlyCompensation(calendarEvents, monthDate);
          if (monthData.length > 0) {
            allData.push(...monthData);
          }
        } catch (error) {
          logger.error(`Error calculating compensation for month ${year}-${month}:`, error);
        }
      }
      
      logger.debug('All compensation data:', allData);
      logger.info(`Generated ${allData.length} compensation data items`);
      
      // Use the ref to avoid closure issues
      setCompensationDataRef.current(allData);
      
    } catch (error) {
      logger.error('Error in compensation calculation:', error);
      setCompensationDataRef.current([]);
    } finally {
      setLoading(false);
    }
  }, [currentEventsFromStore, calculatorFacade, getMonthKey, logger]);
  
  const debouncedUpdateCompensationData = useCallback(() => {
    if (updateCompensationTimeoutRef.current) {
      clearTimeout(updateCompensationTimeoutRef.current);
    }
    calculatorFacade.clearCaches();
    updateCompensationTimeoutRef.current = setTimeout(() => {
      updateCompensationData();
    }, 300);
  }, [calculatorFacade, updateCompensationData]);

  // ADD: Handler for onDataChange from MonthlyCompensationSummary
  const handleDataRefresh = useCallback(async () => {
    logger.info('[Calendar] Data changed in summary, triggering full refresh.');
    await refreshCalendarEvents();
    debouncedUpdateCompensationData();
  }, [refreshCalendarEvents, debouncedUpdateCompensationData]);

  // Add this new simple handler for onEventUpdate
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

    // --- Apply Business Logic based on viewType and eventType ---
    if (eventDataFromWrapper.viewType === 'dayGridMonth') {
      logger.info('[Calendar] Applying DAY_GRID_MONTH logic');
      if (eventToUpdate.type === 'holiday') {
        // Holidays in month view: FullCalendar gives 00:00 on start day to 00:00 on day *after* end day.
        // We want start of first day to end of last day.
        newStart.setHours(0, 0, 0, 0);
        newEnd = new Date(newEnd.setDate(newEnd.getDate() -1)); // Make end inclusive of the last day cell dropped on
        newEnd.setHours(23, 59, 59, 999);
        logger.info(`  Holiday in Month: Set to full days. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      } else if (eventToUpdate.type === 'oncall') {
        // On-Call in Month View: Start at 9 AM on the new start day, maintain original duration.
        const originalEventStart = new Date(eventToUpdate.start);
        const originalEventEnd = new Date(eventToUpdate.end);
        const durationMs = originalEventEnd.getTime() - originalEventStart.getTime();
        
        newStart.setHours(9, 0, 0, 0); // Set to 9 AM on the (FullCalendar-provided) start day
        newEnd = new Date(newStart.getTime() + durationMs);
        logger.info(`  On-Call in Month: Set to 9AM start, maintained duration. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      } else if (eventToUpdate.type === 'incident') {
        // Incident in Month View: Maintain original time of day and duration, shift to new start date.
        const originalEventStart = new Date(eventToUpdate.start);
        const originalEventEnd = new Date(eventToUpdate.end);
        const durationMs = originalEventEnd.getTime() - originalEventStart.getTime();
        const originalStartHour = originalEventStart.getHours();
        const originalStartMinutes = originalEventStart.getMinutes();

        newStart.setHours(originalStartHour, originalStartMinutes, 0, 0); // Apply original time to new date
        newEnd = new Date(newStart.getTime() + durationMs);
        logger.info(`  Incident in Month: Maintained time/duration. Start: ${newStart.toISOString()}, End: ${newEnd.toISOString()}`);
      }
    } else if (eventDataFromWrapper.viewType === 'timeGridWeek') {
      logger.info('[Calendar] Applying TIME_GRID_WEEK logic - using precise times from FC.');
      // For on-call and incidents, we use the precise times from FC (already in newStart, newEnd)
      // No changes needed here as this was the part that worked perfectly.
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

  // Update compensation data when events or current date changes
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
    let effectiveEnd = new Date(selectInfo.end); // This is exclusive from FullCalendar
    
    if (type === 'holiday') {
      effectiveStart.setHours(0, 0, 0, 0);
      // selectInfo.end is exclusive (e.g., start of the day AFTER the selection ends).
      // To make it inclusive (end of the last selected day), we subtract 1 millisecond.
      effectiveEnd = new Date(effectiveEnd.getTime() - 1);
      effectiveEnd.setHours(23, 59, 59, 999); // Ensure it's the very end of that day
    } else if (type === 'oncall') {
      const calendarApi = calendarRef.current?.getApi();
      const viewType = calendarApi?.view.type;

      if (viewType === 'dayGridMonth' || selectInfo.allDay) { 
        effectiveStart.setHours(0, 0, 0, 0);
        // effectiveEnd from selectInfo.end is already exclusive (start of next day),
        // which is correct for an on-call shift that runs 00:00 to 00:00.
        // No change to effectiveEnd needed here if it's already what we want for 00:00 next day.
      } else { // Week view (timed selection) - default to full day(s)
        effectiveStart.setHours(0, 0, 0, 0);
      
        // If it's a single day selection in week view, make it end 00:00 next day
        // FullCalendar's selectInfo.end for a timed selection will be the *exact* end time.
        // If start and end are on different days, FC's selectInfo.end might already be 00:00 of next day if dragged to midnight.
        // Let's make it simpler: if it's a oncall selection, set it to full days selected.
        let inclusiveEndDay = new Date(selectInfo.end);
        // If end is 00:00:00, it means it's the start of that day.
        // If it's something like 03:00, we want the end of *that* day for our inclusive calculation.
        if (inclusiveEndDay.getHours() === 0 && inclusiveEndDay.getMinutes() === 0 && inclusiveEndDay.getSeconds() === 0 && inclusiveEndDay.getMilliseconds() === 0) {
            // If it's exactly midnight, it means it's the *start* of the exclusive end day.
            // So, to get the end of the *previous* (selected) day, subtract 1ms.
            inclusiveEndDay = new Date(inclusiveEndDay.getTime() - 1);
        }
        // Now inclusiveEndDay is definitely within the last selected day.
        effectiveEnd = new Date(inclusiveEndDay);
        effectiveEnd.setDate(inclusiveEndDay.getDate() + 1); // Go to start of next day
        effectiveEnd.setHours(0, 0, 0, 0); // Set to 00:00
      }
    } else if (type === 'incident') {
      const calendarApi = calendarRef.current?.getApi();
      const viewType = calendarApi?.view.type;

      if (viewType === 'dayGridMonth' || selectInfo.allDay) {
        effectiveStart.setHours(DEFAULT_EVENT_TIMES.START_HOUR, DEFAULT_EVENT_TIMES.START_MINUTE, 0, 0);
      
        let inclusiveEndDay = new Date(selectInfo.end);
        inclusiveEndDay = new Date(inclusiveEndDay.getTime() - 1); // Get actual last day of selection

        effectiveEnd = new Date(inclusiveEndDay);
        effectiveEnd.setHours(DEFAULT_EVENT_TIMES.END_HOUR, DEFAULT_EVENT_TIMES.END_MINUTE, 0, 0);

        if (selectInfo.start.toDateString() === inclusiveEndDay.toDateString()) { // Single day selection
          effectiveEnd = new Date(effectiveStart);
          effectiveEnd.setHours(effectiveStart.getHours() + 1); // Default 1 hour duration
        }
      } else { // Week view - use precise times from selection
        if (selectInfo.start.getTime() === selectInfo.end.getTime()) { // Click, not drag
          effectiveEnd.setHours(effectiveStart.getHours() + 1); // Default 1 hour
        }
        // For drag in week view, effectiveStart/End are already the precise times.
      }
    }

    const newEvent = createCalendarEvent({
      id: `temp-${crypto.randomUUID()}`, 
      start: effectiveStart, // Pass Date object
      end: effectiveEnd,   // Pass Date object
      type,
      title: type === 'oncall' ? 'On-Call Shift' : type === 'incident' ? 'Incident' : 'Holiday'
    });

    dispatch(setSelectedEvent(newEvent.toJSON()));
    dispatch(setShowEventModal(true));

    // Unselect the dates on the calendar UI
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.unselect();
    }
  }, [dispatch, currentEventsFromStore, logger, calendarRef]);

  const handleViewChange = useCallback((info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
    logger.info(`Calendar view changed to: ${info.start.toISOString()} - ${info.end.toISOString()}`);
    dispatch(setCurrentDate(info.start.toISOString()));
  }, [dispatch]);

  /**
   * Check if two events overlap in time
   */
  const eventsOverlap = (event1: CalendarEvent, event2: CalendarEvent): boolean => {
    const start1 = new Date(event1.start).getTime();
    const end1 = new Date(event1.end).getTime();
    const start2 = new Date(event2.start).getTime();
    const end2 = new Date(event2.end).getTime();
    
    return (start1 < end2 && end1 > start2);
  };

  /**
   * Find events that conflict with the given event
   */
  const findConflictingEvents = (event: CalendarEvent, allEvents: CalendarEventProps[]): CalendarEventProps[] => {
    // Skip checking against itself if it already exists
    return allEvents.filter(existingEvent => 
      existingEvent.id !== event.id && 
      eventsOverlap(event, new CalendarEvent(existingEvent))
    );
  };

  /**
   * Regenerate sub-events for all events that conflict with a holiday
   * This function ensures all events are properly regenerated with the latest holiday information
   * @param skipHolidaySave if true, assumes the holiday is already saved and doesn't save it again
   */
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

  const saveEventWithoutConflictCheck = useCallback((event: CalendarEvent) => {
    const isNewEvent = event.id.startsWith('temp-');
    logger.info(`Saving ${isNewEvent ? 'new' : 'existing'} event: ${event.id} (${event.type})`);
    logger.debug(`Event times: ${event.start.toISOString()} - ${event.end.toISOString()}`);
    logger.debug(`Event title: ${event.title}`);
    
    // Clear caches before operation
    calculatorFacade.clearCaches();
    
    // Track the async operation being performed
    let savePromise;
    
    // New event with a temporary ID, create a new one
    if (isNewEvent) {
      const permanentId = crypto.randomUUID();
      logger.debug(`Converting temp ID ${event.id} to permanent ID ${permanentId}`);
      
      const eventToCreateJson = event.toJSON();
      
      const eventWithoutTempId = createCalendarEvent({
        ...eventToCreateJson,
        id: permanentId
      });
      
      if (!eventWithoutTempId.title) {
        const defaultTitle = eventWithoutTempId.type === 'oncall' ? 'On-Call Shift' : 
                            eventWithoutTempId.type === 'incident' ? 'Incident' : 'Holiday';
        logger.debug(`Setting default title for event: ${defaultTitle}`);
        eventWithoutTempId.title = defaultTitle;
      }
      
      savePromise = dispatch(createEventAsync(eventWithoutTempId.toJSON())).unwrap();
    } else {
      if (!event.title) {
        const defaultTitle = event.type === 'oncall' ? 'On-Call Shift' : 
                           event.type === 'incident' ? 'Incident' : 'Holiday';
        logger.debug(`Setting default title for event: ${defaultTitle}`);
        event.title = defaultTitle;
      }
      
      const eventToUpdateJson = event.toJSON();
      savePromise = dispatch(updateEventAsync(eventToUpdateJson)).unwrap();
    }
    
    // Clear modals immediately for better UX
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    // After the save completes, ensure compensation data is refreshed
    savePromise.then(() => {
      logger.info(`Event ${event.id} saved successfully, updating compensation data`);
      
      // Force refresh all calculations
      calculatorFacade.clearCaches();
      
      // Ensure we calculate for all affected months
      // This is particularly important for events that span across months
      setTimeout(() => {
        updateCompensationData();
        
        // Also update the current month view to refresh the display
        if (calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          calendarApi.refetchEvents();
        }
      }, 100); // Small delay to ensure state updates have propagated
      
    }).catch(error => {
      logger.error(`Failed to save event ${event.id}:`, error);
      // Try to update compensation data anyway
      setTimeout(updateCompensationData, 100);
    });
  }, [dispatch, calculatorFacade, updateCompensationData, calendarRef, logger]);

  const handleSaveEvent = useCallback(async (event: CalendarEvent) => {
    // Check for conflicts with other events when updating or creating
    const isNewEvent = event.id.startsWith('temp-');
    logger.info(`Checking conflicts for ${isNewEvent ? 'new' : 'existing'} ${event.type} event: ${event.id}`);
  
    // Ensure holidays are always full-day when saved from the modal
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
  
    // Find all conflicting events
    const allConflictingEvents = findConflictingEvents(event, currentEventsFromStore);
    logger.info(`Found ${allConflictingEvents.length} total conflicting events`);
    
    if (allConflictingEvents.length > 0) {
      // Log conflicting event types for debugging
      const conflictTypes = allConflictingEvents.map(e => e.type);
      logger.info(`Conflict types: ${conflictTypes.join(', ')}`);
    }
    
    // If we're adding a holiday, any conflict is important
    if (event.type === 'holiday') {
      const conflictingEventsExist = allConflictingEvents.length > 0;
      
      if (conflictingEventsExist) {
        logger.info(`Holiday conflicts with ${allConflictingEvents.length} events - showing conflict modal`);
        // Show the confirmation dialog for holiday conflicts
        setPendingEventSave(event);
        setConflictingEvents(allConflictingEvents);
        setIsHolidayConflict(true);
        setShowConflictModal(true);
        return;
      }
    } else {
      // For non-holiday events, we only care about conflicts with holidays
      const conflictingHolidays = allConflictingEvents.filter(e => e.type === 'holiday');
      const hasHolidayConflicts = conflictingHolidays.length > 0;
      
      if (hasHolidayConflicts) {
        logger.info(`Event conflicts with ${conflictingHolidays.length} holidays - showing conflict modal`);
        // Show the confirmation dialog for non-holiday events conflicting with holidays
        setPendingEventSave(event);
        setConflictingEvents(conflictingHolidays);
        setIsHolidayConflict(false);
        setShowConflictModal(true);
        return;
      } else if (allConflictingEvents.length > 0) {
        logger.info(`Event has ${allConflictingEvents.length} non-holiday conflicts - proceeding without showing modal`);
      }
    }

    // No relevant conflicts, proceed with save
    saveEventWithoutConflictCheck(event);
  }, [currentEventsFromStore, findConflictingEvents, setPendingEventSave, setShowConflictModal, setConflictingEvents, setIsHolidayConflict, saveEventWithoutConflictCheck]);

  const handleConflictModalAdjust = useCallback(async () => {
    // This function adjusts the conflicting events to accommodate the new event
    if (!pendingEventSave) return;

    try {
      await trackOperation(
        `RegenerateConflictingSubEvents(${pendingEventSave.id})`,
        async () => {
          // First determine if this is a new event (with temp ID) that needs proper saving
          const isNewEvent = pendingEventSave.id.startsWith('temp-');
          
          // If it's a new holiday, we'll need to create it with a permanent ID first
          let eventToSave = pendingEventSave;
          
          if (isNewEvent) {
            // Create a new event with a permanent ID
            eventToSave = createCalendarEvent({
              ...pendingEventSave.toJSON(),
              id: crypto.randomUUID()
            });
            
            logger.info(`Generated permanent ID for new holiday: ${eventToSave.id}`);
          }
          
          // First, save the holiday event to storage
          // This MUST happen before regenerating sub-events 
          // to ensure the holiday exists in the database
          logger.info(`Saving ${isNewEvent ? 'new' : 'existing'} holiday: ${eventToSave.id}`);
          
          if (isNewEvent) {
            // For new events, we need to use createEventAsync to properly create it in storage
            await dispatch(createEventAsync(eventToSave.toJSON())).unwrap();
            logger.info(`Holiday ${eventToSave.id} saved to storage via createEventAsync`);
          } else {
            // For existing events, use updateEventAsync
            await dispatch(updateEventAsync(eventToSave.toJSON())).unwrap();
            logger.info(`Holiday ${eventToSave.id} updated in storage via updateEventAsync`);
          }
          
          // Now regenerate the sub-events with skipHolidaySave=true since we already saved it
          logger.info(`Now regenerating sub-events for events that conflict with holiday ${eventToSave.id}`);
          await regenerateConflictingSubEvents(eventToSave, conflictingEvents, true);
          
          // Clear modals
          dispatch(setShowEventModal(false));
          dispatch(setSelectedEvent(null));
          
          // Close the modal
          setShowConflictModal(false);
          setPendingEventSave(null);
          setConflictingEvents([]);
          
          // Clear caches to ensure fresh calculations
          calculatorFacade.clearCaches();
          
          // Force a complete refresh of all compensation data with a small delay
          // to ensure state updates have propagated
          setTimeout(() => {
            logger.info(`Conflict resolved, updating compensation data`);
            updateCompensationData();
            
            // Also update the calendar display
            if (calendarRef.current) {
              const calendarApi = calendarRef.current.getApi();
              calendarApi.refetchEvents();
            }
          }, 100);
          
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
    calendarRef,
    logger,
    trackOperation
  ]);

  const handleConflictModalCancel = () => {
    // Just close the modal without saving anything
    setShowConflictModal(false);
    setPendingEventSave(null);
    setConflictingEvents([]);
  };

  const handleConflictModalContinue = () => {
    // This function is now deprecated but we keep it for compatibility
    // Redirect to handleConflictModalAdjust since we always want to adjust events
    handleConflictModalAdjust();
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    logger.info(`Attempting to delete event: ${event.id} (${event.type})`);
    
    // Check if it's a holiday that might affect other events
    if (event.type === 'holiday') {
      // Find all events that conflict with this holiday
      const allConflictingEvents = findConflictingEvents(event, currentEventsFromStore);
      
      // For holidays, filter out other holidays as they don't need regeneration
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
    // Clear caches before deleting to ensure fresh calculations
    calculatorFacade.clearCaches();
    
    dispatch(deleteEventAsync(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    // Force immediate recalculation of compensation data with a small delay
    // to ensure state updates have propagated
    setTimeout(() => {
      logger.info(`Event ${event.id} deleted, updating compensation data`);
      updateCompensationData();
      
      // Also update the calendar display
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.refetchEvents();
      }
    }, 100);
  }, [dispatch, calculatorFacade, updateCompensationData, calendarRef, logger]);
  
  const handleDeleteWithRegeneration = async (shouldRegenerateEvents: boolean) => {
    if (!pendingEventDelete || !pendingEventDelete.id) return;
    
    const holidayId = pendingEventDelete.id;
    
    // Group logging for this operation - fallback to console.group
    console.group(`Deleting holiday: ${holidayId}`);
    logger.info(`Deleting holiday: ${holidayId}`);
    
    // If there are conflicting events, we should always regenerate
    const mustRegenerateEvents = conflictingEvents.length > 0;
    if (mustRegenerateEvents) {
      logger.info(`Must regenerate ${conflictingEvents.length} events affected by holiday deletion`);
      shouldRegenerateEvents = true;
    }
    
    logger.debug(`Regeneration enabled: ${shouldRegenerateEvents}`);
    
    // Clear caches immediately to ensure stale data isn't used
    calculatorFacade.clearCaches();
    
    // Delete the holiday first
    await dispatch(deleteEventAsync(pendingEventDelete.id)).unwrap();
    logger.info(`Holiday ${holidayId} deleted successfully`);
    
    // If there are conflicting events, always regenerate them
    let updatedEvents = 0;
    if (shouldRegenerateEvents && conflictingEvents.length > 0) {
      try {
        logger.debug(`Regenerating ${conflictingEvents.length} events affected by holiday deletion`);
        
        // Wait a moment for the deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // For each affected event, we need to "update" it to regenerate sub-events
        const updatePromises = [];
        for (const eventProps of conflictingEvents) {
          // Skip if it's a holiday itself - we don't need to adjust holidays
          if (eventProps.type === 'holiday') continue;
          
          logger.debug(`Regenerating sub-events for ${eventProps.type} event ${eventProps.id}`);
          
          // Update with the same event properties
          // The sub-events will be regenerated without considering the deleted holiday
          const updatePromise = dispatch(updateEventAsync({
            ...eventProps,
            title: eventProps.title || (eventProps.type === 'oncall' ? 'On-Call Shift' : eventProps.type === 'incident' ? 'Incident' : 'Holiday')
          })).unwrap(); // Wait for each update to complete
          
          updatePromises.push(updatePromise);
          updatedEvents++;
        }
        
        // Wait for all updates to complete
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          logger.info(`Successfully updated ${updatedEvents} events after holiday deletion`);
        }
        
        // Clear the cache again to ensure we get fresh calculations
        calculatorFacade.clearCaches();
        
        // Force immediate compensation recalculation
        updateCompensationData();
        logger.info('Compensation data updated after holiday deletion');
        
      } catch (error) {
        logger.error('Error regenerating events after holiday deletion:', error);
        alert('Holiday deleted, but there was an error recalculating affected events. Compensation calculations may be affected.');
        
        // Try to update compensation data anyway
        updateCompensationData();
      }
    } else {
      // Even if we don't regenerate events, we should update compensation data
      updateCompensationData();
      logger.info('Compensation data updated after holiday deletion (no regeneration needed)');
    }
    
    // Reset all modal state
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
    
    // Also close the event details modal
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    console.groupEnd();
    
    // Run diagnostic after a delay
    setTimeout(() => analyzeHolidayDetection(), 1000);
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
  };

  const handleCloseModal = useCallback(() => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  }, [dispatch]);

  /**
   * Diagnostic function to analyze event sub-events and verify holiday detection
   * This is for debugging purposes only and can be removed in production
   */
  const analyzeHolidayDetection = (targetDate?: Date) => {
    // Use current date as default if none provided
    const dateToAnalyze = targetDate || new Date();
    const dateString = dateToAnalyze.toLocaleDateString();
    
    // Start a log group for the analysis - fallback to console.group
    console.group(`Holiday Detection Analysis: ${dateString}`);
    logger.debug(`Starting holiday detection analysis for ${dateString}`);
    
    // 1. Check if any holiday events exist for this date
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
    
    // 2. Find all events with sub-events on this date
    // const allSubEvents = storageService.loadSubEvents(); // DEPRECATED USAGE REMOVED
    
    // Wait for the Promise to resolve
    // allSubEvents.then(subEvents => { // DEPRECATED USAGE REMOVED
      // Filter for sub-events on this date
      // const targetDateCopy = new Date(dateToAnalyze);
      // targetDateCopy.setHours(0, 0, 0, 0);
      
      // const relevantSubEvents = subEvents.filter(subEvent => {
      //   const subEventDate = new Date(subEvent.start);
      //   subEventDate.setHours(0, 0, 0, 0);
      //   return subEventDate.getTime() === targetDateCopy.getTime();
      // });
      
      // if (relevantSubEvents.length === 0) {
      //   logger.debug(`No sub-events found for ${dateString}`);
      //   console.groupEnd();
      //   return;
      // }
      
      // logger.debug(`Found ${relevantSubEvents.length} sub-events for ${dateString}`);
      
      // Group by parent event
      // const subEventsByParent: Record<string, SubEvent[]> = {};
      // relevantSubEvents.forEach(subEvent => {
      //   if (!subEventsByParent[subEvent.parentEventId]) {
      //     subEventsByParent[subEvent.parentEventId] = [];
      //   }
      //   subEventsByParent[subEvent.parentEventId].push(subEvent);
      // });
      
      // Analyze each parent event's sub-events
      // Object.entries(subEventsByParent).forEach(([parentId, subEvents]) => {
      //   const parentEvent = currentEventsFromStore.find(e => e.id === parentId);
      //   if (!parentEvent) {
      //     logger.debug(`Sub-events found for unknown parent: ${parentId}`);
      //     return;
      //   }
        
      //   logger.debug(`Event: ${parentEvent.id} (${parentEvent.type})`);
        
      //   // Count how many sub-events have holiday flag set
      //   const holidaySubEvents = subEvents.filter(se => se.isHoliday);
      //   const weekendSubEvents = subEvents.filter(se => se.isWeekend);
        
      //   logger.debug(`- ${subEvents.length} total sub-events`);
      //   logger.debug(`- ${holidaySubEvents.length} marked as holiday`);
      //   logger.debug(`- ${weekendSubEvents.length} marked as weekend`);
        
      //   if (holidayEvents.length > 0 && holidaySubEvents.length === 0) {
      //     logger.warn(`⚠️ ISSUE DETECTED: Event has no holiday sub-events despite holiday existing on ${dateString}`);
      //   }
      // });
      
      // End the log group
      // console.groupEnd();
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
        events={currentEventsFromStore.map(e => new CalendarEvent(e))}
        currentDate={new Date(currentDate)}
        onDateChange={(date) => dispatch(setCurrentDate(date.toISOString()))}
      />
      {compensationData.length > 0 && (
        <MonthlyCompensationSummary 
          data={compensationData} 
          onDataChange={handleDataRefresh}
        />
      )}
      
      {/* Lazy-loaded modals with Suspense */}
      {showEventModal && selectedEvent && (
        <Suspense fallback={<ModalLoadingFallback>Loading...</ModalLoadingFallback>}>
          <EventDetailsModal
            event={new CalendarEvent(selectedEvent)}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onClose={handleCloseModal}
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
    </CalendarContainer>
  );
};

// Export with React.memo for performance optimization
export default React.memo(Calendar); 
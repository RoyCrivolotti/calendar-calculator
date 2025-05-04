import { useRef, useEffect, useState, useMemo, lazy, Suspense } from 'react';
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
import {
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setEvents,
  createEventAsync,
  updateEventAsync,
  deleteEventAsync
} from '../../store/slices/calendarSlice';
import { container } from '../../../config/container';
import { CalculateCompensationUseCase } from '../../../application/calendar/use-cases/CalculateCompensation';
import { storageService } from '../../services/storage';
import { DEFAULT_EVENT_TIMES } from '../../../config/constants';
import { logger, LogLevel } from '../../../utils/logger';
import { getMonthKey } from '../../../utils/calendarUtils';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { trackOperation } from '../../../utils/errorHandler';

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
    events,
    currentDate,
    selectedEvent,
    showEventModal,
  } = useAppSelector(state => state.calendar);
  const [compensationData, setCompensationData] = useState<CompensationBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState<CalendarEventProps[]>([]);
  const [pendingEventSave, setPendingEventSave] = useState<CalendarEvent | null>(null);
  const [pendingEventDelete, setPendingEventDelete] = useState<CalendarEvent | null>(null);
  const [isHolidayConflict, setIsHolidayConflict] = useState(false);
  const calculatorFacade = useMemo(() => CompensationCalculatorFacade.getInstance(), []);

  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const loadEvents = async () => {
      const loadedEvents = await storageService.loadEvents();
      dispatch(setEvents(loadedEvents.map(event => event.toJSON())));
    };
    loadEvents();
  }, [dispatch]);

  // Update compensation data when events or current date changes
  useEffect(() => {
    updateCompensationData();
  }, [events, currentDate]);

  const updateCompensationData = async () => {
    logger.info('Events available for compensation calculation:', events.length);
    
    if (events.length === 0) {
      logger.info('No events available for compensation calculation');
      setCompensationData([]);
      return;
    }
    
    setLoading(true);
    
    try {
      // Get unique months from events
      const months = new Set<string>();
      events.forEach(event => {
        const date = new Date(event.start);
        const monthKey = getMonthKey(date);
        months.add(monthKey);
        logger.debug(`Found event in month: ${monthKey}`);
      });
      
      logger.info(`Found ${months.size} unique months with events`);
      
      const allData: CompensationBreakdown[] = [];
      
      // Convert events to CalendarEvent objects for the facade
      const calendarEvents = events.map(event => new CalendarEvent(event));
      
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
      setCompensationData(allData);
      
    } catch (error) {
      logger.error('Error in compensation calculation:', error);
      setCompensationData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      logger.info(`User clicked event: ${event.id} (${event.type})`);
      dispatch(setSelectedEvent(event));
      dispatch(setShowEventModal(true));
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg, type: 'oncall' | 'incident' | 'holiday') => {
    logger.info(`User selected date range: ${selectInfo.start.toISOString()} to ${selectInfo.end.toISOString()} for ${type} event`);
    const start = new Date(selectInfo.start);
    let end = new Date(selectInfo.end);
    end.setDate(end.getDate() - 1); // Subtract one day since end is exclusive
    
    if (type === 'holiday') {
      // For holidays, set to full day (00:00 to 23:59)
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'oncall') {
      // For on-call, set to full 24 hours (00:00 to 00:00 next day)
      start.setHours(0, 0, 0, 0);
      
      // If it's a single day event, set end to 00:00 the next day
      if (start.toDateString() === end.toDateString()) {
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
      } else {
        // For multi-day on-call, end at 00:00 of the day after the last selected day
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
      }
    } else if (type === 'incident') {
      // Use default times for incidents, but ensure they span at least 1 hour
      start.setHours(DEFAULT_EVENT_TIMES.START_HOUR, DEFAULT_EVENT_TIMES.START_MINUTE, 0, 0);
      
      // If it's a single day incident, set end to 1 hour after start
      if (start.toDateString() === end.toDateString()) {
        const endTime = new Date(start);
        endTime.setHours(endTime.getHours() + 1);
        end = endTime;
      } else {
        end.setHours(DEFAULT_EVENT_TIMES.END_HOUR, DEFAULT_EVENT_TIMES.END_MINUTE, 0, 0);
      }
    }

    const newEvent = createCalendarEvent({
      id: `temp-${crypto.randomUUID()}`, // Use temp- prefix for new events
      start,
      end,
      type,
      title: type === 'oncall' ? 'On-Call Shift' : type === 'incident' ? 'Incident' : 'Holiday'
    });

    dispatch(setSelectedEvent(newEvent.toJSON()));
    dispatch(setShowEventModal(true));
  };

  const handleViewChange = (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
    logger.info(`Calendar view changed to: ${info.start.toISOString()} - ${info.end.toISOString()}`);
    dispatch(setCurrentDate(info.start.toISOString()));
  };

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
    conflictingEvents: CalendarEventProps[],
    skipHolidaySave: boolean = false
  ): Promise<void> => {
    try {
      logger.info(`Regenerating sub-events for ${conflictingEvents.length} events that conflict with holiday ${holidayEvent.id}`);
      
      // First, ensure the holiday is saved and fully available in the events list
      // This is critical - we need to make sure the holiday event is in the events array
      // before regenerating sub-events that depend on it
      
      const holidayProps = holidayEvent.toJSON();
      const holidayExists = events.some(e => e.id === holidayEvent.id);
      
      if (!holidayExists && !skipHolidaySave) {
        logger.info(`Holiday ${holidayEvent.id} not found in events array, adding it first`);
        
        // We need to add the holiday to the local events array first to ensure
        // the HolidayChecker can find it when regenerating sub-events
        const updatedEvents = [...events, holidayProps];
        
        // Update the Redux store
        dispatch(setEvents(updatedEvents));
        
        // NOTE: We no longer save to storage here - we'll let the caller handle that
        // This prevents duplicate creation of the same holiday
      } else {
        logger.info(`Holiday ${holidayEvent.id} already exists or skipHolidaySave is true, skipping save`);
      }
      
      // Give the system a moment to commit the holiday update
      // This small delay helps ensure the holiday is available in the events array
      // before we attempt to regenerate sub-events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make sure the holiday is in the events array when we regenerate sub-events
      const allCurrentEvents = [...events];
      if (!holidayExists && !allCurrentEvents.some(e => e.id === holidayEvent.id)) {
        allCurrentEvents.push(holidayProps);
        logger.info(`Added holiday to local events array for sub-event regeneration`);
      }
      
      // For each conflicting event, we need to "update" it to regenerate sub-events
      // This will trigger the UpdateEventUseCase which recreates sub-events with the new holiday consideration
      for (const eventProps of conflictingEvents) {
        // Skip if it's a holiday itself - we don't need to adjust holidays
        if (eventProps.type === 'holiday') continue;
        
        logger.info(`Regenerating sub-events for ${eventProps.type} event ${eventProps.id}`);
        
        // Simply dispatch the update action with the same event properties
        // The sub-events will be regenerated considering the new holiday
        dispatch(updateEventAsync({
          ...eventProps,
          title: eventProps.title || (eventProps.type === 'oncall' ? 'On-Call Shift' : eventProps.type === 'incident' ? 'Incident' : 'Holiday')
        }));
      }
      
      // Ensure compensation data is updated after regeneration
      setTimeout(() => {
        logger.info('Updating compensation data after holiday-related changes');
        updateCompensationData();
      }, 500);
      
    } catch (error) {
      logger.error('Error regenerating conflicting sub-events:', error);
      alert('There was an error adjusting events. Compensation calculations may be affected.');
    }
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    // Check for conflicts with other events when updating or creating
    const isNewEvent = event.id.startsWith('temp-');
  
    // If we're creating a new holiday, check for conflicts with existing events
    // We do this to make sure the sub-events will be regenerated properly
    const conflictingEvents = findConflictingEvents(event, events);
    const conflictingEventsExist = conflictingEvents.length > 0;

    if (conflictingEventsExist) {
      // Show the confirmation dialog before proceeding
      setPendingEventSave(event);
      setConflictingEvents(conflictingEvents);
      setIsHolidayConflict(event.type === 'holiday');
      setShowConflictModal(true);
      return;
    }

    saveEventWithoutConflictCheck(event);
  };

  const saveEventWithoutConflictCheck = (event: CalendarEvent) => {
    const isNewEvent = event.id.startsWith('temp-');
    logger.info(`Saving ${isNewEvent ? 'new' : 'existing'} event: ${event.id} (${event.type})`);
    
    // Clear caches before operation
    calculatorFacade.clearCaches();
    
    // Track the async operation being performed
    let savePromise;
    
    // New event with a temporary ID, create a new one
    if (isNewEvent) {
      const eventWithoutTempId = createCalendarEvent({
        ...event.toJSON(),
        id: crypto.randomUUID()
      });
      savePromise = dispatch(createEventAsync(eventWithoutTempId.toJSON())).unwrap();
    } else {
      // Existing event, just update it
      savePromise = dispatch(updateEventAsync(event.toJSON())).unwrap();
    }
    
    // Clear modals immediately for better UX
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    // After the save completes, ensure compensation data is refreshed
    savePromise.then(() => {
      logger.info(`Event ${event.id} saved successfully, updating compensation data`);
      // Clear caches again just to be safe
      calculatorFacade.clearCaches();
      // Update compensation data
      updateCompensationData();
    }).catch(error => {
      logger.error(`Failed to save event ${event.id}:`, error);
      // Try to update compensation data anyway
      updateCompensationData();
    });
  };

  const handleConflictModalAdjust = async () => {
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
  };

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
      const affectedEvents = findConflictingEvents(event, events);
      
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
  
  const deleteEventWithoutConfirmation = (event: CalendarEvent) => {
    // Clear caches before deleting to ensure fresh calculations
    calculatorFacade.clearCaches();
    
    dispatch(deleteEventAsync(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
    
    // Force recalculation of compensation data
    setTimeout(() => {
      updateCompensationData();
    }, 100);
  };
  
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
        await updateCompensationData();
        logger.info('Compensation data updated after holiday deletion');
        
      } catch (error) {
        logger.error('Error regenerating events after holiday deletion:', error);
        alert('Holiday deleted, but there was an error recalculating affected events. Compensation calculations may be affected.');
        
        // Try to update compensation data anyway
        await updateCompensationData();
      }
    } else {
      // Even if we don't regenerate events, we should update compensation data
      await updateCompensationData();
      logger.info('Compensation data updated after holiday deletion (no regeneration needed)');
    }
    
    // Reset state
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
    
    console.groupEnd();
    
    // Run diagnostic after a delay
    setTimeout(() => analyzeHolidayDetection(), 1000);
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
  };

  const handleCloseModal = () => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

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
    const holidayEvents = events.filter(event => {
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
    const allSubEvents = storageService.loadSubEvents();
    
    // Wait for the Promise to resolve
    allSubEvents.then(subEvents => {
      // Filter for sub-events on this date
      const targetDateCopy = new Date(dateToAnalyze);
      targetDateCopy.setHours(0, 0, 0, 0);
      
      const relevantSubEvents = subEvents.filter(subEvent => {
        const subEventDate = new Date(subEvent.start);
        subEventDate.setHours(0, 0, 0, 0);
        return subEventDate.getTime() === targetDateCopy.getTime();
      });
      
      if (relevantSubEvents.length === 0) {
        logger.debug(`No sub-events found for ${dateString}`);
        console.groupEnd();
        return;
      }
      
      logger.debug(`Found ${relevantSubEvents.length} sub-events for ${dateString}`);
      
      // Group by parent event
      const subEventsByParent: Record<string, SubEvent[]> = {};
      relevantSubEvents.forEach(subEvent => {
        if (!subEventsByParent[subEvent.parentEventId]) {
          subEventsByParent[subEvent.parentEventId] = [];
        }
        subEventsByParent[subEvent.parentEventId].push(subEvent);
      });
      
      // Analyze each parent event's sub-events
      Object.entries(subEventsByParent).forEach(([parentId, subEvents]) => {
        const parentEvent = events.find(e => e.id === parentId);
        if (!parentEvent) {
          logger.debug(`Sub-events found for unknown parent: ${parentId}`);
          return;
        }
        
        logger.debug(`Event: ${parentEvent.id} (${parentEvent.type})`);
        
        // Count how many sub-events have holiday flag set
        const holidaySubEvents = subEvents.filter(se => se.isHoliday);
        const weekendSubEvents = subEvents.filter(se => se.isWeekend);
        
        logger.debug(`- ${subEvents.length} total sub-events`);
        logger.debug(`- ${holidaySubEvents.length} marked as holiday`);
        logger.debug(`- ${weekendSubEvents.length} marked as weekend`);
        
        if (holidayEvents.length > 0 && holidaySubEvents.length === 0) {
          logger.warn(`⚠️ ISSUE DETECTED: Event has no holiday sub-events despite holiday existing on ${dateString}`);
        }
      });
      
      // End the log group
      console.groupEnd();
    });
  };

  return (
    <CalendarContainer>
      <CalendarWrapper
        ref={calendarRef}
        events={events.map(event => new CalendarEvent(event))}
        onEventClick={handleEventClick}
        onDateSelect={(selectInfo, type) => handleDateSelect(selectInfo, type)}
        onViewChange={handleViewChange}
        currentDate={new Date(currentDate)}
      />
      <CompensationSection
        events={events.map(event => new CalendarEvent(event))}
        currentDate={new Date(currentDate)}
        onDateChange={(date: Date) => dispatch(setCurrentDate(date.toISOString()))}
      />
      <MonthlyCompensationSummary data={compensationData} />
      
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

export default Calendar; 
import { useRef, useEffect, useState, useMemo } from 'react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import CompensationSection from './CompensationSection';
import EventDetailsModal from './EventDetailsModal';
import CalendarWrapper from './CalendarWrapper';
import MonthlyCompensationSummary from './MonthlyCompensationSummary';
import HolidayConflictModal from './HolidayConflictModal';
import HolidayDeleteModal from './HolidayDeleteModal';
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
import { logger } from '../../../utils/logger';
import { getMonthKey } from '../../../utils/calendarUtils';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem;
  gap: 1rem;
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
      dispatch(setSelectedEvent(event));
      dispatch(setShowEventModal(true));
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg, type: 'oncall' | 'incident' | 'holiday') => {
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
      id: crypto.randomUUID(),
      start,
      end,
      type,
      title: type === 'oncall' ? 'On-Call Shift' : type === 'incident' ? 'Incident' : 'Holiday'
    });

    dispatch(setSelectedEvent(newEvent.toJSON()));
    dispatch(setShowEventModal(true));
  };

  const handleViewChange = (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
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
        
        // Also save it to storage directly
        try {
          dispatch(createEventAsync(holidayProps));
          logger.info(`Holiday ${holidayEvent.id} saved to storage`);
        } catch (error) {
          logger.error(`Error saving holiday ${holidayEvent.id}:`, error);
        }
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
    const eventProps = event.toJSON();
    
    // Check for holiday conflicts if this is a holiday event
    if (event.type === 'holiday') {
      const conflicts = findConflictingEvents(event, events);
      
      if (conflicts.length > 0) {
        // Store the event and conflicts for the modal
        setPendingEventSave(event);
        setConflictingEvents(conflicts);
        setIsHolidayConflict(true);
        setShowConflictModal(true);
        return;
      }
    }
    
    // Check if any existing events conflict with this event if it's not a holiday
    if (event.type !== 'holiday') {
      const holidays = events.filter(e => 
        e.type === 'holiday' && 
        e.id !== event.id // Don't check against itself if updating
      );
      
      const conflictingHolidays = holidays.filter(holiday => 
        eventsOverlap(event, new CalendarEvent(holiday))
      );
      
      if (conflictingHolidays.length > 0) {
        // Store the event and conflicts for the modal
        setPendingEventSave(event);
        setConflictingEvents(conflictingHolidays);
        setIsHolidayConflict(false);
        setShowConflictModal(true);
        return;
      }
    }
    
    // No conflicts, proceed with save
    saveEventWithoutConflictCheck(event);
  };
  
  const saveEventWithoutConflictCheck = (event: CalendarEvent) => {
    const eventProps = event.toJSON();
    
    if (events.find(e => e.id === event.id)) {
      // If event exists, update it
      dispatch(updateEventAsync(eventProps));
    } else {
      // If it's a new event, add it
      dispatch(createEventAsync(eventProps));
    }
    
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };
  
  const handleConflictModalAdjust = async () => {
    if (!pendingEventSave) return;
    
    // Only save the event once, and only here
    // We'll let regenerateConflictingSubEvents use the event without saving it again
    saveEventWithoutConflictCheck(pendingEventSave);
    
    // For holiday conflicts, regenerate sub-events
    // Pass true for skipHolidaySave to prevent duplicate saving
    if (isHolidayConflict) {
      await regenerateConflictingSubEvents(pendingEventSave, conflictingEvents, true);
    }
    
    // Close the modal
    setShowConflictModal(false);
    setPendingEventSave(null);
    setConflictingEvents([]);
    
    // Run diagnostic after a delay
    setTimeout(() => analyzeHolidayDetection(), 1000);
  };
  
  const handleConflictModalContinue = () => {
    if (!pendingEventSave) return;
    
    // Save the event without adjusting conflicting events
    saveEventWithoutConflictCheck(pendingEventSave);
    
    // Close the modal
    setShowConflictModal(false);
    setPendingEventSave(null);
    setConflictingEvents([]);
  };
  
  const handleConflictModalCancel = () => {
    // Just close the modal without saving anything
    setShowConflictModal(false);
    setPendingEventSave(null);
    setConflictingEvents([]);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    // Check if it's a holiday that might affect other events
    if (event.type === 'holiday') {
      const affectedEvents = findConflictingEvents(event, events);
      
      if (affectedEvents.length > 0) {
        // Store the holiday and affected events for the modal
        setPendingEventDelete(event);
        setConflictingEvents(affectedEvents);
        setShowDeleteModal(true);
        return;
      }
    }
    
    // No need for special handling, proceed with delete
    deleteEventWithoutConfirmation(event);
  };
  
  const deleteEventWithoutConfirmation = (event: CalendarEvent) => {
    dispatch(deleteEventAsync(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };
  
  const handleDeleteWithRegeneration = async (shouldRegenerateEvents: boolean) => {
    if (!pendingEventDelete) return;
    
    // Store the holiday info before deleting
    const holidayId = pendingEventDelete.id;
    logger.info(`Deleting holiday ${holidayId}`);
    
    // Delete the holiday first
    deleteEventWithoutConfirmation(pendingEventDelete);
    
    // If user chose to regenerate events, do so
    if (shouldRegenerateEvents && conflictingEvents.length > 0) {
      try {
        logger.info(`Regenerating ${conflictingEvents.length} events affected by holiday deletion`);
        
        // Wait a moment for the deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // For each affected event, we need to "update" it to regenerate sub-events
        for (const eventProps of conflictingEvents) {
          // Skip if it's a holiday itself - we don't need to adjust holidays
          if (eventProps.type === 'holiday') continue;
          
          logger.info(`Regenerating sub-events for ${eventProps.type} event ${eventProps.id}`);
          
          // Update with the same event properties
          // The sub-events will be regenerated without considering the deleted holiday
          dispatch(updateEventAsync({
            ...eventProps,
            title: eventProps.title || (eventProps.type === 'oncall' ? 'On-Call Shift' : eventProps.type === 'incident' ? 'Incident' : 'Holiday')
          }));
        }
        
        // Ensure compensation data is updated after regeneration
        setTimeout(() => {
          logger.info('Updating compensation data after holiday deletion');
          updateCompensationData();
        }, 500);
        
      } catch (error) {
        logger.error('Error regenerating events after holiday deletion:', error);
        alert('Holiday deleted, but there was an error recalculating affected events. Compensation calculations may be affected.');
      }
    }
    
    // Reset state
    setShowDeleteModal(false);
    setPendingEventDelete(null);
    setConflictingEvents([]);
    
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
    
    logger.info(`=== HOLIDAY DETECTION ANALYSIS for ${dateString} ===`);
    
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
      logger.info(`No holiday events found for ${dateString}`);
    } else {
      logger.info(`Found ${holidayEvents.length} holiday events for ${dateString}:`);
      holidayEvents.forEach(holiday => {
        logger.info(`- Holiday ID: ${holiday.id}, Start: ${new Date(holiday.start).toLocaleDateString()}, End: ${new Date(holiday.end).toLocaleDateString()}`);
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
        logger.info(`No sub-events found for ${dateString}`);
        return;
      }
      
      logger.info(`Found ${relevantSubEvents.length} sub-events for ${dateString}`);
      
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
          logger.info(`Sub-events found for unknown parent: ${parentId}`);
          return;
        }
        
        logger.info(`Event: ${parentEvent.id} (${parentEvent.type})`);
        
        // Count how many sub-events have holiday flag set
        const holidaySubEvents = subEvents.filter(se => se.isHoliday);
        const weekendSubEvents = subEvents.filter(se => se.isWeekend);
        
        logger.info(`- ${subEvents.length} total sub-events`);
        logger.info(`- ${holidaySubEvents.length} marked as holiday`);
        logger.info(`- ${weekendSubEvents.length} marked as weekend`);
        
        if (holidayEvents.length > 0 && holidaySubEvents.length === 0) {
          logger.warn(`⚠️ ISSUE DETECTED: Event has no holiday sub-events despite holiday existing on ${dateString}`);
        }
      });
    });
    
    logger.info('=== END ANALYSIS ===');
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
      {showEventModal && selectedEvent && (
        <EventDetailsModal
          event={new CalendarEvent(selectedEvent)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={handleCloseModal}
        />
      )}
      {showConflictModal && pendingEventSave && (
        <HolidayConflictModal
          isHoliday={isHolidayConflict}
          conflicts={conflictingEvents}
          onAdjust={handleConflictModalAdjust}
          onContinue={handleConflictModalContinue}
          onCancel={handleConflictModalCancel}
        />
      )}
      {showDeleteModal && pendingEventDelete && (
        <HolidayDeleteModal
          holidayDate={pendingEventDelete.start}
          affectedEvents={conflictingEvents}
          onDelete={handleDeleteWithRegeneration}
          onCancel={handleCancelDelete}
        />
      )}
    </CalendarContainer>
  );
};

export default Calendar; 
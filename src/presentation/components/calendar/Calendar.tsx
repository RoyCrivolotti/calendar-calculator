import { useRef, useEffect, useState } from 'react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import CompensationSection from './CompensationSection';
import EventDetailsModal from './EventDetailsModal';
import CalendarWrapper from './CalendarWrapper';
import MonthlyCompensationSummary from './MonthlyCompensationSummary';
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
    const calculateCompensationUseCase = container.get<CalculateCompensationUseCase>('calculateCompensationUseCase');
    
    // Get unique months from events
    const months = new Set<string>();
    events.forEach(event => {
      const date = new Date(event.start);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      months.add(monthKey);
    });

    // Calculate compensation for each month with events
    const allData: CompensationBreakdown[] = [];
    for (const monthKey of Array.from(months)) {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1);
      
      // Calculate compensation for this month
      const monthData = await calculateCompensationUseCase.execute(monthDate);
      
      // Add to the breakdown with the month date
      if (monthData.length > 0) {
        allData.push(...monthData.map(d => ({
          ...d,
          month: monthDate
        })));
      }
    }

    setCompensationData(allData);
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

  const handleSaveEvent = async (event: CalendarEvent) => {
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

  const handleDeleteEvent = async (event: CalendarEvent) => {
    dispatch(deleteEventAsync(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const handleCloseModal = () => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
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
    </CalendarContainer>
  );
};

export default Calendar; 
import { useRef, useEffect } from 'react';
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
  addEvent,
  updateEvent,
  deleteEvent,
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setEvents,
} from '../../store/slices/calendarSlice';
import { CompensationCalculator } from '../../../domain/calendar/services/CompensationCalculator';
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

  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const loadEvents = async () => {
      const loadedEvents = await storageService.loadEvents();
      dispatch(setEvents(loadedEvents.map(event => event.toJSON())));
    };
    loadEvents();
  }, [dispatch]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      dispatch(setSelectedEvent(event));
      dispatch(setShowEventModal(true));
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg, type: 'oncall' | 'incident' | 'holiday') => {
    const start = new Date(selectInfo.start);
    const end = new Date(selectInfo.end);
    end.setDate(end.getDate() - 1); // Subtract one day since end is exclusive
    
    if (type === 'holiday') {
      // For holidays, set to full day (00:00 to 23:59)
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      // For on-call and incidents, use default times
      start.setHours(DEFAULT_EVENT_TIMES.START_HOUR, DEFAULT_EVENT_TIMES.START_MINUTE, 0, 0);
      
      // If it's a single day event, set end to start of next day
      if (start.toDateString() === end.toDateString()) {
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
      } else {
        end.setHours(DEFAULT_EVENT_TIMES.END_HOUR, DEFAULT_EVENT_TIMES.END_MINUTE, 0, 0);
      }
    }

    const newEvent = createCalendarEvent({
      id: Date.now().toString(),
      start,
      end,
      type,
      title: type === 'oncall' ? 'On-Call Shift' : type === 'incident' ? 'Incident' : 'Holiday'
    });

    dispatch(setSelectedEvent(newEvent));
    dispatch(setShowEventModal(true));
  };

  const handleViewChange = (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
    dispatch(setCurrentDate(info.start.toISOString()));
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    const eventProps = event.toJSON();
    if (events.find(e => e.id === event.id)) {
      // If event exists, update it
      dispatch(updateEvent(eventProps));
    } else {
      // If it's a new event, add it
      dispatch(addEvent(eventProps));
    }
    
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    dispatch(deleteEvent(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const handleCloseModal = () => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const getCompensationData = (): CompensationBreakdown[] => {
    const calculator = new CompensationCalculator();
    const calendarEvents = events.map(event => new CalendarEvent(event));
    
    // Get unique months from events
    const months = new Set<string>();
    calendarEvents.forEach(event => {
      const monthKey = `${event.start.getFullYear()}-${event.start.getMonth() + 1}`;
      months.add(monthKey);
    });

    // Calculate compensation for each month with events
    const allData: CompensationBreakdown[] = [];
    Array.from(months).forEach(monthKey => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1);
      const monthEvents = calendarEvents.filter(event => {
        const eventMonthKey = `${event.start.getFullYear()}-${event.start.getMonth() + 1}`;
        return eventMonthKey === monthKey;
      });
      const monthData = calculator.calculateMonthlyCompensation(monthEvents, monthDate);
      if (monthData.find(d => d.type === 'total' && d.amount > 0)) {
        allData.push(...monthData.map(d => ({
          ...d,
          month: monthDate
        })));
      }
    });

    return allData;
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
      <MonthlyCompensationSummary data={getCompensationData()} />
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
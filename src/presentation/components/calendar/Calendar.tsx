import { useState, useRef, useEffect } from 'react';
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
      dispatch(setEvents(loadedEvents));
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

  const handleDateSelect = (selectInfo: DateSelectArg, type: 'oncall' | 'incident') => {
    const start = new Date(selectInfo.start);
    const end = new Date(selectInfo.end);
    
    const newEvent = createCalendarEvent({
      id: Date.now().toString(),
      start,
      end,
      type
    });

    dispatch(setSelectedEvent(newEvent));
    dispatch(setShowEventModal(true));
  };

  const handleViewChange = (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => {
    dispatch(setCurrentDate(info.start));
  };

  const handleSaveEvent = (event: CalendarEvent) => {
    if (events.find(e => e.id === event.id)) {
      // If event exists, update it
      dispatch(updateEvent(event));
    } else {
      // If it's a new event, add it
      dispatch(addEvent(event));
    }
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    dispatch(deleteEvent(event.id));
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const handleCloseModal = () => {
    dispatch(setShowEventModal(false));
    dispatch(setSelectedEvent(null));
  };

  const getCompensationData = (date: Date): CompensationBreakdown[] => {
    const calculator = new CompensationCalculator();
    return calculator.calculateMonthlyCompensation(events, date);
  };

  return (
    <CalendarContainer>
      <CalendarWrapper
        ref={calendarRef}
        events={events}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
        onViewChange={handleViewChange}
      />
      <CompensationSection
        events={events}
        currentDate={new Date(currentDate)}
        onDateChange={(date: Date) => dispatch(setCurrentDate(date))}
      />
      <MonthlyCompensationSummary data={getCompensationData(new Date(currentDate))} />
      {showEventModal && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={handleCloseModal}
        />
      )}
    </CalendarContainer>
  );
};

export default Calendar; 
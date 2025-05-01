import { useState, useRef } from 'react';
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
} from '../../store/slices/calendarSlice';
import { CompensationCalculator } from '../../../domain/calendar/services/CompensationCalculator';

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

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      dispatch(setSelectedEvent(event));
      dispatch(setShowEventModal(true));
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = new Date(selectInfo.start);
    const end = new Date(selectInfo.end);

    const newEvent = createCalendarEvent({
      id: Date.now().toString(),
      start,
      end,
      type: 'oncall'
    });

    dispatch(addEvent(newEvent));
    dispatch(setSelectedEvent(newEvent));
    dispatch(setShowEventModal(true));
  };

  const handleSaveEvent = (event: CalendarEvent) => {
    if (event.id) {
      dispatch(updateEvent(event));
    } else {
      dispatch(addEvent(event));
    }
    dispatch(setShowEventModal(false));
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    dispatch(deleteEvent(event.id));
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
      />
      <CompensationSection
        events={events}
        currentDate={currentDate}
        onDateChange={(date: Date) => dispatch(setCurrentDate(date))}
      />
      <MonthlyCompensationSummary data={getCompensationData(currentDate)} />
      {showEventModal && selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => {
            dispatch(setShowEventModal(false));
            dispatch(setSelectedEvent(null));
          }}
        />
      )}
    </CalendarContainer>
  );
};

export default Calendar; 
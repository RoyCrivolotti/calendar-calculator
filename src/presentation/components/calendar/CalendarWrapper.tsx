import { forwardRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import styled from '@emotion/styled';

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick: (clickInfo: EventClickArg) => void;
  onDateSelect: (selectInfo: DateSelectArg) => void;
}

const CalendarContainer = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  height: 600px;

  .fc {
    height: 100%;
  }
`;

const CalendarWrapper = forwardRef<FullCalendar, CalendarWrapperProps>(
  ({ events, onEventClick, onDateSelect }, ref) => {
    return (
      <CalendarContainer>
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={onEventClick}
          selectable={true}
          select={onDateSelect}
          height="100%"
        />
      </CalendarContainer>
    );
  }
);

CalendarWrapper.displayName = 'CalendarWrapper';

export default CalendarWrapper; 
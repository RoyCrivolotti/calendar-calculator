import React, { forwardRef, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import styled from '@emotion/styled';

const CalendarContainer = styled.div`
  width: 100%;
  height: 800px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;

  .fc {
    height: 100%;
  }

  .fc-view-harness {
    height: calc(100% - 50px) !important;
  }

  .fc-scroller {
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }

  .fc-scroller-liquid-absolute {
    position: relative !important;
  }

  .fc-timegrid-body {
    width: 100% !important;
  }

  .fc-timegrid-slot {
    height: 48px !important;
  }

  .fc-daygrid-body {
    width: 100% !important;
  }

  .fc-scroller-canvas {
    overflow-y: auto !important;
  }
`;

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick: (clickInfo: EventClickArg) => void;
  onDateSelect: (selectInfo: DateSelectArg) => void;
}

const CalendarWrapper = forwardRef<FullCalendar, CalendarWrapperProps>(
  ({ events, onEventClick, onDateSelect }, ref) => {
    const scrollAccumulator = useRef(0);
    const SCROLL_THRESHOLD = 20;

    useEffect(() => {
      const handleWheel = (e: Event) => {
        const wheelEvent = e as WheelEvent;
        const target = e.target as HTMLElement;
        
        // Check if the event is within the calendar view area
        const isInCalendarView = target.closest('.fc-view-harness') !== null;
        if (!isInCalendarView) return;

        if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
          // Allow zooming with ctrl/cmd + scroll
          return;
        }

        const calendar = ref as React.RefObject<FullCalendar>;
        if (!calendar.current) return;

        const view = calendar.current.getApi().view;
        const isWeekView = view.type === 'timeGridWeek';
        const isMonthView = view.type === 'dayGridMonth';

        if (isWeekView) {
          // In week view, navigate days horizontally with accumulation
          e.preventDefault();
          scrollAccumulator.current += wheelEvent.deltaX;

          if (Math.abs(scrollAccumulator.current) >= SCROLL_THRESHOLD) {
            const direction = scrollAccumulator.current > 0 ? 1 : -1; // Fixed direction
            calendar.current.getApi().incrementDate({ days: direction });
            scrollAccumulator.current = 0;
          }
        } else if (isMonthView) {
          // In month view, scroll vertically
          const scrollContainer = document.querySelector('.fc-scroller-canvas');
          if (scrollContainer) {
            e.preventDefault();
            // Smooth scrolling with reduced sensitivity
            const scrollAmount = wheelEvent.deltaY * 0.5;
            scrollContainer.scrollTop += scrollAmount;
          }
        }
      };

      const calendarElement = document.querySelector('.fc');
      if (calendarElement) {
        calendarElement.addEventListener('wheel', handleWheel, { passive: false });
      }

      return () => {
        if (calendarElement) {
          calendarElement.removeEventListener('wheel', handleWheel);
        }
      };
    }, [ref]);

    const formatEventTitle = (event: CalendarEvent) => {
      if (event.title) return event.title;
      return event.type === 'oncall' ? 'On-Call Shift' : 'Incident';
    };

    const formatEventColor = (event: CalendarEvent) => {
      if (event.type === 'oncall') {
        return event.isWeekend ? '#f59e0b' : '#3b82f6';
      }
      return event.isWeekend ? '#dc2626' : '#ef4444';
    };

    return (
      <CalendarContainer>
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events.map(event => ({
            id: event.id,
            title: formatEventTitle(event),
            start: event.start,
            end: event.end,
            backgroundColor: formatEventColor(event),
            borderColor: formatEventColor(event),
            textColor: '#ffffff'
          }))}
          eventClick={onEventClick}
          select={onDateSelect}
          height="100%"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={false}
          slotDuration="01:00:00"
          slotLabelInterval="01:00"
          snapDuration="00:15:00"
          scrollTime="00:00:00"
          expandRows={true}
          stickyHeaderDates={true}
          dayHeaderFormat={{ weekday: 'long' }}
          views={{
            timeGridWeek: {
              dayHeaderFormat: { weekday: 'long', day: 'numeric' },
              slotDuration: '01:00:00',
              slotLabelInterval: '01:00',
              snapDuration: '00:15:00',
              scrollTime: '00:00:00',
              expandRows: true,
              stickyHeaderDates: true,
              scrollTimeReset: false,
              scrollTimeSensitivity: 'fixed',
              scrollTimeScroll: '01:00:00',
              height: 'auto',
              contentHeight: 'auto',
              dateIncrement: { days: 1 }
            },
            dayGridMonth: {
              dayHeaderFormat: { weekday: 'long' },
              fixedWeekCount: false,
              showNonCurrentDates: false,
              dayMaxEvents: true,
              height: 'auto',
              contentHeight: 'auto',
              expandRows: true,
              stickyHeaderDates: true
            }
          }}
          handleWindowResize={true}
          windowResizeDelay={100}
          nowIndicator={true}
          nowIndicatorClassNames={['now-indicator']}
          dayMaxEventRows={true}
          moreLinkClick="popover"
          moreLinkContent={(args) => `+${args.num} more`}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false
          }}
        />
      </CalendarContainer>
    );
  }
);

export default CalendarWrapper; 
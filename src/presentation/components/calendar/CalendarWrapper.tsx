import React, { forwardRef, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import styled from '@emotion/styled';

const EventTypeSelector = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: fit-content;
  min-width: 300px;
  max-width: 90vw;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 24px;
  height: 24px;

  &:hover {
    background-color: #f1f5f9;
    color: #0f172a;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EventTypeButton = styled.button`
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: center;

  &.oncall {
    background: #3b82f6;
    color: white;
    &:hover {
      background: #2563eb;
    }
  }

  &.incident {
    background: #ef4444;
    color: white;
    &:hover {
      background: #dc2626;
    }
  }

  &.holiday {
    background: #6b7280;
    color: white;
    &:hover {
      background: #4b5563;
    }
  }
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
`;

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
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .fc-view-harness {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f5f9;
    }

    &::-webkit-scrollbar-thumb {
      background-color: #cbd5e1;
      border-radius: 4px;
      border: 2px solid #f1f5f9;
    }
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
`;

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick: (clickInfo: EventClickArg) => void;
  onDateSelect: (selectInfo: DateSelectArg, type: 'oncall' | 'incident' | 'holiday') => void;
  onViewChange: (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => void;
  currentDate: Date;
}

const CalendarWrapper = forwardRef<FullCalendar, CalendarWrapperProps>(
  ({ events, onEventClick, onDateSelect, onViewChange, currentDate }, ref) => {
    const [showEventTypeSelector, setShowEventTypeSelector] = useState(false);
    const [pendingEventInfo, setPendingEventInfo] = useState<DateSelectArg | null>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    const scrollAccumulator = useRef({ x: 0, y: 0 });
    const SCROLL_THRESHOLD = 50;

    // Update calendar view when currentDate changes
    useEffect(() => {
      const calendar = ref as React.RefObject<FullCalendar>;
      if (calendar.current) {
        calendar.current.getApi().gotoDate(currentDate);
      }
    }, [currentDate, ref]);

    const handleDateSelect = (selectInfo: DateSelectArg) => {
      setPendingEventInfo(selectInfo);
      setShowEventTypeSelector(true);
    };

    const handleEventTypeSelect = (type: 'oncall' | 'incident' | 'holiday') => {
      if (pendingEventInfo) {
        onDateSelect(pendingEventInfo, type);
      }
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
    };

    const handleClose = () => {
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
      const calendar = ref as React.RefObject<FullCalendar>;
      if (calendar.current) {
        calendar.current.getApi().unselect();
      }
    };

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && showEventTypeSelector) {
          handleClose();
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }, [showEventTypeSelector]);

    useEffect(() => {
      const container = calendarContainerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        const calendar = ref as React.RefObject<FullCalendar>;
        if (!calendar.current) return;

        const view = calendar.current.getApi().view;
        const isMonthView = view.type === 'dayGridMonth';
        const isWeekView = view.type === 'timeGridWeek';

        // Get the calendar element
        const calendarEl = container.querySelector('.fc-view-harness');
        if (!calendarEl) return;

        // Handle horizontal scroll for week view
        if (isWeekView && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.preventDefault();
          scrollAccumulator.current.x += e.deltaX;

          if (Math.abs(scrollAccumulator.current.x) >= SCROLL_THRESHOLD) {
            const direction = scrollAccumulator.current.x > 0 ? 1 : -1;
            calendar.current.getApi().incrementDate({ days: direction });
            scrollAccumulator.current.x = 0;
          }
          return;
        }

        // Handle vertical scroll for month view
        if (isMonthView) {
          // Always prevent default for month view to avoid website scroll
          e.preventDefault();
          
          // Only accumulate vertical scroll
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            scrollAccumulator.current.y += e.deltaY;

            if (Math.abs(scrollAccumulator.current.y) >= SCROLL_THRESHOLD) {
              const direction = scrollAccumulator.current.y > 0 ? 1 : -1;
              calendar.current.getApi().incrementDate({ weeks: direction });
              scrollAccumulator.current.y = 0;
            }
          }
          return;
        }

        // Handle vertical scroll for time grid view
        if (calendarEl.scrollHeight > calendarEl.clientHeight) {
          e.preventDefault();
          calendarEl.scrollTop += e.deltaY;
        }
      };

      // Add wheel event listener with passive: false to allow preventDefault
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, [ref]);

    const formatEventTitle = (event: CalendarEvent) => {
      if (event.title) return event.title;
      switch (event.type) {
        case 'oncall':
          return 'On-Call Shift';
        case 'incident':
          return 'Incident';
        case 'holiday':
          return 'Holiday';
        default:
          return event.type;
      }
    };

    const formatEventColor = (event: CalendarEvent) => {
      if (event.type === 'oncall') {
        return event.isWeekend ? '#f59e0b' : '#3b82f6';
      }
      if (event.type === 'incident') {
        return event.isWeekend ? '#dc2626' : '#ef4444';
      }
      return '#6b7280'; // Gray color for holidays
    };

    return (
      <>
        <CalendarContainer ref={calendarContainerRef}>
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
            select={handleDateSelect}
            datesSet={onViewChange}
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
        {showEventTypeSelector && (
          <ModalOverlay onClick={handleClose}>
            <EventTypeSelector onClick={e => e.stopPropagation()}>
              <CloseButton onClick={handleClose}>×</CloseButton>
              <ModalTitle>Select Event Type</ModalTitle>
              <EventTypeButton
                className="oncall"
                onClick={() => handleEventTypeSelect('oncall')}
              >
                On-Call Shift
              </EventTypeButton>
              <EventTypeButton
                className="incident"
                onClick={() => handleEventTypeSelect('incident')}
              >
                Incident
              </EventTypeButton>
              <EventTypeButton
                className="holiday"
                onClick={() => handleEventTypeSelect('holiday')}
              >
                Holiday
              </EventTypeButton>
            </EventTypeSelector>
          </ModalOverlay>
        )}
      </>
    );
  }
);

export default CalendarWrapper; 
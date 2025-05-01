import React, { forwardRef, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarEvent, createCalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
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
`;

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick: (clickInfo: EventClickArg) => void;
  onDateSelect: (selectInfo: DateSelectArg, type: 'oncall' | 'incident') => void;
  onViewChange: (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => void;
}

const CalendarWrapper = forwardRef<FullCalendar, CalendarWrapperProps>(
  ({ events, onEventClick, onDateSelect, onViewChange }, ref) => {
    const scrollAccumulator = useRef(0);
    const SCROLL_THRESHOLD = 15;
    const [showEventTypeSelector, setShowEventTypeSelector] = useState(false);
    const [pendingEventInfo, setPendingEventInfo] = useState<DateSelectArg | null>(null);

    const handleDateSelect = (selectInfo: DateSelectArg) => {
      setPendingEventInfo(selectInfo);
      setShowEventTypeSelector(true);
    };

    const handleEventTypeSelect = (type: 'oncall' | 'incident') => {
      if (pendingEventInfo) {
        onDateSelect(pendingEventInfo, type);
      }
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
    };

    const handleClose = () => {
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
      // Clear the calendar selection
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

        if (isWeekView && Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY)) {
          // In week view, only handle horizontal scrolling
          e.preventDefault();
          scrollAccumulator.current += wheelEvent.deltaX;

          if (Math.abs(scrollAccumulator.current) >= SCROLL_THRESHOLD) {
            const direction = scrollAccumulator.current > 0 ? 1 : -1;
            calendar.current.getApi().incrementDate({ days: direction });
            scrollAccumulator.current = 0;
          }
        } else if (isMonthView && Math.abs(wheelEvent.deltaY) > Math.abs(wheelEvent.deltaX)) {
          // In month view, only handle vertical scrolling
          e.preventDefault();
          scrollAccumulator.current += wheelEvent.deltaY;

          if (Math.abs(scrollAccumulator.current) >= SCROLL_THRESHOLD) {
            const direction = scrollAccumulator.current > 0 ? 1 : -1;
            calendar.current.getApi().incrementDate({ weeks: direction });
            scrollAccumulator.current = 0;
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
      <>
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
            </EventTypeSelector>
          </ModalOverlay>
        )}
      </>
    );
  }
);

export default CalendarWrapper; 
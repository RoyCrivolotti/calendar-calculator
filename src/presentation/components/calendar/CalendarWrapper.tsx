import React, { forwardRef, useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarEvent, EventTypes } from '../../../domain/calendar/entities/CalendarEvent';
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
  min-height: 650px;
  height: auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border: 2px solid #e2e8f0;
  overflow: hidden;
  margin-bottom: 2rem;

  .fc {
    height: 100%;
    min-height: 600px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Month view specific styles - allow natural height */
  .fc-dayGridMonth-view {
    height: auto !important;
    overflow: visible !important;

    .fc-day-sat, .fc-day-sun {
      background-color: #f8fafc; /* Light gray for weekend days */
    }

    .fc-day-today {
      background-color: #e0f2fe !important; /* Light blue for today, distinct from weekend */
      font-weight: bold;
    }
  }

  /* Week view specific styles - maintain scrolling */
  .fc-timeGridWeek-view {
    height: 500px !important;
    overflow: hidden !important;
  }
  
  /* Week view scrolling container */
  .fc-timeGridWeek-view .fc-scroller {
    overflow: hidden !important;
  }
  
  /* Main scrollable container for the week view timeline */
  .fc-timeGridWeek-view .fc-timegrid-body {
    height: 450px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }

  /* Format the time slots */
  .fc-timegrid-slot {
    height: 48px !important;
    border-bottom: 1px solid #e2e8f0;
  }
  
  /* Proper structure for the time slots container */
  .fc-timegrid-slots table {
    min-height: 1200px !important;
  }
  
  /* Ensure events stay in place when scrolling */
  .fc-timegrid-event-harness {
    position: absolute !important;
  }
  
  /* Custom scrollbar styling */
  .fc-timegrid-body::-webkit-scrollbar {
    width: 8px;
  }

  .fc-timegrid-body::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  .fc-timegrid-body::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
    border: 2px solid #f1f5f9;
  }
`;

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick: (clickInfo: EventClickArg) => void;
  onDateSelect: (selectInfo: DateSelectArg, type: EventTypes.ONCALL | EventTypes.INCIDENT | EventTypes.HOLIDAY) => void;
  onViewChange: (info: { start: Date; end: Date; startStr: string; endStr: string; timeZone: string; view: any }) => void;
  currentDate: Date;
  onEventUpdate: (updatedEventData: { id: string; start: Date; end: Date | null; viewType: string; /* FC view type, e.g., 'timeGridWeek', 'dayGridMonth' */ }) => void;
}

const CalendarWrapperComponent = forwardRef<FullCalendar, CalendarWrapperProps>(
  ({ events, onEventClick, onDateSelect, onViewChange, currentDate, onEventUpdate }, ref) => {
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

    const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
      setPendingEventInfo(selectInfo);
      setShowEventTypeSelector(true);
    }, []);

    const handleEventTypeSelect = useCallback((type: EventTypes.ONCALL | EventTypes.INCIDENT | EventTypes.HOLIDAY) => {
      if (pendingEventInfo) {
        onDateSelect(pendingEventInfo, type);
      }
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
    }, [pendingEventInfo, onDateSelect]);

    const handleClose = useCallback(() => {
      setShowEventTypeSelector(false);
      setPendingEventInfo(null);
      const calendar = ref as React.RefObject<FullCalendar>;
      if (calendar.current) {
        calendar.current.getApi().unselect();
      }
    }, [ref]);

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && showEventTypeSelector) {
          handleClose();
        }
      };

      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }, [showEventTypeSelector, handleClose]);

    useEffect(() => {
      const container = calendarContainerRef.current;
      if (!container) return;

      const handleWheel = (e: WheelEvent) => {
        const calendar = ref as React.RefObject<FullCalendar>;
        if (!calendar.current) return;

        const view = calendar.current.getApi().view;
        const isMonthView = view.type === 'dayGridMonth';
        const isWeekView = view.type === 'timeGridWeek';
        const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);

        // Always prevent browser navigation for horizontal scrolling
        if (Math.abs(e.deltaX) > 0) {
          e.preventDefault();
        }

        if (isMonthView && isHorizontalScroll) {
          scrollAccumulator.current.x += e.deltaX;

          if (Math.abs(scrollAccumulator.current.x) >= SCROLL_THRESHOLD) {
            const direction = scrollAccumulator.current.x > 0 ? -1 : 1;
            calendar.current.getApi().incrementDate({ months: direction });
            scrollAccumulator.current.x = 0;
          }
        } else if (isWeekView) {
          if (isHorizontalScroll) {
            scrollAccumulator.current.x += e.deltaX;

            if (Math.abs(scrollAccumulator.current.x) >= SCROLL_THRESHOLD) {
              const direction = scrollAccumulator.current.x > 0 ? -1 : 1;
              const api = calendar.current.getApi();
              const currentDate = api.getDate();
              const newDate = new Date(currentDate);
              newDate.setDate(currentDate.getDate() + direction);
              api.gotoDate(newDate);
              scrollAccumulator.current.x = 0;
            }
          } else if (Math.abs(e.deltaY) > 0) {
            const timeGridBody = container.querySelector('.fc-timegrid-body');
            if (timeGridBody && timeGridBody.scrollHeight > timeGridBody.clientHeight) {
              timeGridBody.scrollTop += e.deltaY;
            }
          }
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, [ref]);

    const formatEventTitle = useCallback((event: CalendarEvent) => {
      if (event.title) return event.title;
      switch (event.type) {
        case EventTypes.ONCALL:
          return 'On-Call Shift';
        case EventTypes.INCIDENT:
          return 'Incident';
        case EventTypes.HOLIDAY:
          return 'Holiday';
        default:
          return event.type;
      }
    }, []);

    const formatEventColor = useCallback((event: CalendarEvent) => {
      if (event.type === EventTypes.ONCALL) {
        return '#e0f2fe'; // Changed from #f0f9ff (sky-100 instead of sky-50)
      }
      if (event.type === EventTypes.INCIDENT) {
        return '#fee2e2'; // Changed from #ef4444 (red-100)
      }
      return '#fef3c7'; // Changed from #f59e0b (amber-100 for holidays)
    }, []);

    const formatEventBorderColor = useCallback((event: CalendarEvent) => {
      if (event.type === EventTypes.ONCALL) {
        return '#e0f2fe'; // Changed from #f0f9ff (sky-100 to match new background)
      }
      if (event.type === EventTypes.INCIDENT) {
        return '#fca5a5'; // Changed from #ef4444 (red-300)
      }
      return '#fde68a'; // Changed from #f59e0b (amber-300 for holidays)
    }, []);

    const formatEventTextColor = useCallback((event: CalendarEvent) => {
      if (event.type === EventTypes.ONCALL) {
        return '#075985'; // sky-800 (consistent)
      }
      // For incident and holiday, we now want specific darker text, not just white
      if (event.type === EventTypes.INCIDENT) {
        return '#991b1b'; // red-800
      }
      if (event.type === EventTypes.HOLIDAY) {
        return '#92400e'; // amber-800
      }
      return '#ffffff'; // Should ideally not be reached if all types handled
    }, []);

    const eventContent = useCallback((eventInfo: any) => {
      const { event, view } = eventInfo;

      const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit', hour12: false });
      };

      const eventType = event.extendedProps.type as CalendarEvent['type'];
      const backgroundColor = formatEventColor(event.extendedProps as CalendarEvent);
      const textColor = formatEventTextColor(event.extendedProps as CalendarEvent);
      const borderColor = formatEventBorderColor(event.extendedProps as CalendarEvent);
      const displayTitle = event.title || '';

      if (view.type === 'dayGridMonth') {
        const originalEventStart = new Date(event.extendedProps.originalStart);
        const overallEventEnd = event.end;
        const segmentStart = event.start;
        let prefixString = '';

        if (eventType === EventTypes.ONCALL && overallEventEnd) {
          const durationMs = overallEventEnd.getTime() - originalEventStart.getTime();
          if (durationMs > 0) {
            const totalHours = Math.round(durationMs / (1000 * 60 * 60));
            if (totalHours > 0) {
              prefixString = `~${totalHours}hr`;
            }
          }
        } else if (eventType === EventTypes.INCIDENT) {
          if (segmentStart.toDateString() === originalEventStart.toDateString()) {
            prefixString = formatTime(event.startStr);
          }
        }

        const monthViewStyles = `
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 0.9em;
          margin: 1px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        `;
        return {
          html: `
            <div
              style="background-color: ${backgroundColor}; color: ${textColor}; border: 1px solid ${borderColor}; ${monthViewStyles}"
              class="${eventType}-event-month"
              title="${displayTitle} ${prefixString ? '(' + prefixString + ')' : ''}">
              <span style="font-weight: 500;">${prefixString}</span>
              ${prefixString ? ' ' : ''}${displayTitle}
            </div>
          `
        };
      } else if (view.type === 'timeGridWeek') {
        const weekViewStyles = `
          padding: 2px 4px;
          font-size: 0.85em;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
          border: none;
        `;
        const timeString = formatTime(event.startStr);

        return {
          html: `
            <div 
              style="background-color: ${backgroundColor}; color: ${textColor}; ${weekViewStyles}"
              class="${eventType}-event-week"
              title="${timeString} ${displayTitle}">
              <div style="font-weight: 500;">${timeString}</div>
              <div>${displayTitle}</div>
            </div>
          `
        };
      }
      return null; 
    }, [formatEventColor, formatEventTextColor, formatEventBorderColor]);

    const handleEventDrop = useCallback((dropInfo: any) => {
      const calendarApi = ref && (ref as React.RefObject<FullCalendar>).current?.getApi();
      const currentViewType = calendarApi?.view.type || 'unknown';
      console.log(
        '%c[CalendarWrapper] handleEventDrop triggered',
        'color: blue; font-weight: bold;',
        {
          eventId: dropInfo.event.id,
          eventType: dropInfo.event.extendedProps.type,
          viewType: currentViewType,
          rawStartDate: dropInfo.event.start,
          rawEndDate: dropInfo.event.end,
          startISO: dropInfo.event.start?.toISOString(),
          endISO: dropInfo.event.end?.toISOString(),
          allDay: dropInfo.event.allDay,
          dropInfoObject: dropInfo
        }
      );
      if (dropInfo.event.start) {
        onEventUpdate({
          id: dropInfo.event.id,
          start: dropInfo.event.start,
          end: dropInfo.event.end,
          viewType: currentViewType,
        });
      } else {
        console.error('[CalendarWrapper] Event drop data missing start time', dropInfo);
      }
    }, [onEventUpdate, ref]);

    const handleEventResize = useCallback((resizeInfo: any) => {
      const calendarApi = ref && (ref as React.RefObject<FullCalendar>).current?.getApi();
      const currentViewType = calendarApi?.view.type || 'unknown';
      console.log(
        '%c[CalendarWrapper] handleEventResize triggered',
        'color: blue; font-weight: bold;',
        {
          eventId: resizeInfo.event.id,
          eventType: resizeInfo.event.extendedProps.type,
          viewType: currentViewType,
          rawStartDate: resizeInfo.event.start,
          rawEndDate: resizeInfo.event.end,
          startISO: resizeInfo.event.start?.toISOString(),
          endISO: resizeInfo.event.end?.toISOString(),
          allDay: resizeInfo.event.allDay,
          resizeInfoObject: resizeInfo
        }
      );
      if (resizeInfo.event.start && resizeInfo.event.end) {
        onEventUpdate({
          id: resizeInfo.event.id,
          start: resizeInfo.event.start,
          end: resizeInfo.event.end,
          viewType: currentViewType,
        });
      } else {
        console.error('[CalendarWrapper] Event resize data missing start or end time', resizeInfo);
      }
    }, [onEventUpdate, ref]);

    return (
      <>
        <CalendarContainer ref={calendarContainerRef}>
          <FullCalendar
            ref={ref}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={currentDate}
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
            events={events.map(calEvent => ({
              id: calEvent.id,
              title: formatEventTitle(calEvent),
              start: calEvent.start,
              end: calEvent.end,
              backgroundColor: formatEventColor(calEvent),
              borderColor: formatEventBorderColor(calEvent),
              textColor: formatEventTextColor(calEvent),
              extendedProps: {
                type: calEvent.type,
                originalStart: calEvent.start // Store the original start date of the event
              }
            }))}
            eventClick={onEventClick}
            select={handleDateSelect}
            datesSet={onViewChange}
            height="auto"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            allDaySlot={false}
            slotDuration="01:00:00"
            slotLabelInterval="01:00"
            snapDuration="00:15:00"
            scrollTime="08:00:00"
            expandRows={true}
            stickyHeaderDates={true}
            dayHeaderFormat={{ weekday: 'long' }}
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
            views={{
              timeGridWeek: {
                dayHeaderFormat: { weekday: 'short', day: 'numeric' },
                slotDuration: '01:00:00',
                slotLabelInterval: '01:00',
                snapDuration: '00:15:00',
                scrollTime: '08:00:00',
                expandRows: true,
                stickyHeaderDates: true,
                eventMaxStack: 3,
                eventOverlap: true,
                nowIndicator: true,
                allDaySlot: false,
                dateIncrement: { days: 1 }
              },
              dayGridMonth: {
                dayHeaderFormat: { weekday: 'short' },
                fixedWeekCount: false,
                showNonCurrentDates: false,
                dayMaxEvents: true,
                dateIncrement: { months: 1 }
              }
            }}
            handleWindowResize={true}
            windowResizeDelay={100}
            nowIndicator={true}
            dayMaxEventRows={true}
            eventContent={eventContent}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
          />
        </CalendarContainer>
        {showEventTypeSelector && (
          <ModalOverlay onClick={handleClose}>
            <EventTypeSelector onClick={e => e.stopPropagation()}>
              <CloseButton onClick={handleClose}>×</CloseButton>
              <ModalTitle>Select Event Type</ModalTitle>
              <EventTypeButton
                className="oncall"
                onClick={() => handleEventTypeSelect(EventTypes.ONCALL)}
              >
                On-Call Shift
              </EventTypeButton>
              <EventTypeButton
                className="incident"
                onClick={() => handleEventTypeSelect(EventTypes.INCIDENT)}
              >
                Incident
              </EventTypeButton>
              <EventTypeButton
                className="holiday"
                onClick={() => handleEventTypeSelect(EventTypes.HOLIDAY)}
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

// Add a custom comparison function for React.memo
const arePropsEqual = (prevProps: CalendarWrapperProps, nextProps: CalendarWrapperProps) => {
  // Check if events array has changed
  if (prevProps.events.length !== nextProps.events.length) {
    return false;
  }
  
  // Deep check of events - compare each event by ID and data
  for (let i = 0; i < prevProps.events.length; i++) {
    const prevEvent = prevProps.events[i];
    const nextEvent = nextProps.events[i];
    
    if (prevEvent.id !== nextEvent.id || 
        prevEvent.type !== nextEvent.type ||
        prevEvent.start.getTime() !== nextEvent.start.getTime() ||
        prevEvent.end.getTime() !== nextEvent.end.getTime()) {
      return false;
    }
  }
  
  // Check if currentDate has changed
  if (prevProps.currentDate.getTime() !== nextProps.currentDate.getTime()) {
    return false;
  }
  
  // For handler functions, we rely on the parent component to memoize them properly
  // Only re-render if the function references have changed
  return prevProps.onEventClick === nextProps.onEventClick &&
    prevProps.onDateSelect === nextProps.onDateSelect &&
    prevProps.onViewChange === nextProps.onViewChange &&
    prevProps.onEventUpdate === nextProps.onEventUpdate;
};

// Export with React.memo for performance optimization
const CalendarWrapper = React.memo(CalendarWrapperComponent, arePropsEqual);
export default CalendarWrapper; 
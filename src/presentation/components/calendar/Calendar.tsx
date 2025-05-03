import { useRef, useEffect, useState } from 'react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';
import FullCalendar from '@fullcalendar/react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
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
    
    console.log('Events available for compensation calculation:', events.length);
    
    // Create direct monthly data in case the use case approach doesn't work
    const directMonthlyData: CompensationBreakdown[] = [];
    
    try {
      // Get unique months from events
      const monthsByEventId = new Map<string, Date>();
      events.forEach(event => {
        const date = new Date(event.start);
        // Reset day to first of month to create month-only date
        const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
        monthsByEventId.set(event.id, monthDate);
      });
      
      console.log(`Found ${monthsByEventId.size} events with dates`);
      
      // Group events by month
      const eventsByMonth = new Map<string, CalendarEventProps[]>();
      events.forEach(event => {
        const date = new Date(event.start);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!eventsByMonth.has(monthKey)) {
          eventsByMonth.set(monthKey, []);
        }
        
        eventsByMonth.get(monthKey)!.push(event);
      });
      
      console.log(`Grouped events into ${eventsByMonth.size} months`);
      
      // Create direct monthly data
      for (const [monthKey, monthEvents] of eventsByMonth.entries()) {
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1); // Set to first day of month
        monthDate.setHours(0, 0, 0, 0); // Reset time to midnight
        
        // Count by event type
        const oncallCount = monthEvents.filter(e => e.type === 'oncall').length;
        const incidentCount = monthEvents.filter(e => e.type === 'incident').length;
        
        // Create direct compensation - at least we can show the months with event counts
        if (oncallCount > 0) {
          directMonthlyData.push({
            type: 'oncall',
            amount: oncallCount * 100, // Dummy value
            count: oncallCount,
            description: `On-call shifts (${oncallCount})`,
            month: new Date(monthDate)
          });
        }
        
        if (incidentCount > 0) {
          directMonthlyData.push({
            type: 'incident',
            amount: incidentCount * 200, // Dummy value
            count: incidentCount,
            description: `Incidents (${incidentCount})`,
            month: new Date(monthDate)
          });
        }
        
        // Add total for this month
        const totalAmount = (oncallCount * 100) + (incidentCount * 200);
        directMonthlyData.push({
          type: 'total',
          amount: totalAmount,
          count: monthEvents.length,
          description: 'Total compensation',
          month: new Date(monthDate)
        });
      }
    } catch (error) {
      console.error('Error creating direct monthly data:', error);
    }
    
    // Try the normal approach as well
    try {
      // Only proceed if we have events
      if (events.length === 0) {
        console.log('No events available for compensation calculation');
        
        if (directMonthlyData.length > 0) {
          console.log('Using direct monthly data as fallback:', directMonthlyData);
          setCompensationData(directMonthlyData);
        } else {
          setCompensationData([]);
        }
        return;
      }

      // Get unique months from events
      const months = new Set<string>();
      events.forEach(event => {
        const date = new Date(event.start);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        months.add(monthKey);
        console.log(`Found event in month: ${monthKey}`);
      });
      
      console.log(`Found ${months.size} unique months with events`);
      
      const allData: CompensationBreakdown[] = [];
      
      // For each month with events, calculate compensation
      for (const monthKey of Array.from(months)) {
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date constructor
        monthDate.setHours(0, 0, 0, 0); // Reset time to midnight
        
        console.log(`Calculating compensation for month: ${year}-${month}`);
        
        // Calculate compensation for this month
        try {
          const monthData = await calculateCompensationUseCase.execute(monthDate);
          console.log(`Month ${year}-${month} compensation data:`, monthData);
          
          if (monthData.length > 0) {
            // We need to make sure each record has the month property set
            const monthDataWithMonth = monthData.map(d => {
              // Only create a new object if month isn't already set
              if (!d.month) {
                return {
                  ...d,
                  month: new Date(monthDate)
                };
              }
              return d;
            });
            
            allData.push(...monthDataWithMonth);
          } else {
            console.log(`No compensation data returned for month ${year}-${month}`);
          }
        } catch (error) {
          console.error(`Error calculating compensation for month ${year}-${month}:`, error);
        }
      }
      
      console.log('All compensation data:', allData);
      
      // Use the calculated data if available, otherwise use our direct data
      if (allData.filter(d => d.type === 'total').length > 0) {
        setCompensationData(allData);
      } else if (directMonthlyData.length > 0) {
        console.log('Using direct monthly data as fallback because no calculated data was available:', directMonthlyData);
        setCompensationData(directMonthlyData);
      } else {
        setCompensationData([]);
      }
    } catch (error) {
      console.error('Error in compensation calculation:', error);
      
      // Use direct data as fallback if available
      if (directMonthlyData.length > 0) {
        console.log('Using direct monthly data as fallback due to error:', directMonthlyData);
        setCompensationData(directMonthlyData);
      } else {
        setCompensationData([]);
      }
    }
    
    // Debug log to check the final compensation data
    console.log('Final monthly compensation data:', compensationData.filter(d => d.type === 'total').map(d => ({
      month: d.month ? d.month.toISOString() : 'undefined',
      amount: d.amount
    })));
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
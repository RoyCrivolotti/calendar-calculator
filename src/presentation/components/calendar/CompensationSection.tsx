import React from 'react';
import styled from '@emotion/styled';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';
import { calculateMonthlyCompensation } from '../../../utils/compensation';
import { format } from 'date-fns';

const CompensationSection = styled.section`
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin: 2rem;
`;

const CompensationContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const CompensationTitle = styled.h2`
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 2rem;
`;

const CompensationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const CompensationItem = styled.div`
  background: #f8fafc;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const CompensationLabel = styled.div`
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const CompensationValue = styled.div`
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
`;

const TotalCompensation = styled.div`
  background: #f1f5f9;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-top: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const DateSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  button {
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #f8fafc;
    }
  }

  span {
    font-weight: 500;
    color: #64748b;
  }
`;

export interface CompensationSectionProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

const getPaymentMonth = (date: Date): Date => {
  // Print the date but in a readable way, saying the day, month and year
  console.log('getPaymentMonth', date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }));
  const paymentDate = new Date(date);
  if (date.getDate() >= 27) {
    paymentDate.setMonth(paymentDate.getMonth() + 1);
  }
  return paymentDate;
};

const groupEventsByMonth = (events: CalendarEvent[]): Map<string, CalendarEvent[]> => {
  const grouped = new Map<string, CalendarEvent[]>();
  
  events.forEach(event => {
    const paymentMonth = getPaymentMonth(event.start);
    const key = `${paymentMonth.getFullYear()}-${paymentMonth.getMonth() + 1}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(event);
  });
  
  return grouped;
};

const CompensationSectionComponent: React.FC<CompensationSectionProps> = ({ 
  events,
  currentDate,
  onDateChange
}) => {
  const currentMonth = getPaymentMonth(currentDate);
  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
  const monthEvents = groupEventsByMonth(events).get(monthKey) || [];

  // Use calculateMonthlyCompensation for all values
  const compensation = calculateMonthlyCompensation(monthEvents);
  const totalCompensation = compensation.totalCompensation;

  // Calculate night shift hours for incidents, split by weekday/weekend
  const nightShiftHours = monthEvents
    .filter(event => event.type === 'incident')
    .reduce((acc, event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const hours = calculateNightShiftHours(start, end);
      
      if (isWeekend(start)) {
        acc.weekend += hours;
      } else {
        acc.weekday += hours;
      }
      return acc;
    }, { weekday: 0, weekend: 0 });

  const handleDateChange = (date: Date) => {
    onDateChange(date);
  };

  return (
    <CompensationSection id="compensation-section">
      <CompensationContainer>
        <CompensationTitle>
          Compensation Breakdown for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </CompensationTitle>

        <DateSelector>
          <button onClick={() => handleDateChange(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
            Previous Month
          </button>
          <span>{format(currentDate, 'MMMM yyyy')}</span>
          <button onClick={() => handleDateChange(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
            Next Month
          </button>
        </DateSelector>

        <CompensationGrid>
          <CompensationItem>
            <CompensationLabel>Weekday On-Call Hours</CompensationLabel>
            <CompensationValue>{compensation.weekdayOnCallHours.toFixed(1)}h</CompensationValue>
          </CompensationItem>
          <CompensationItem>
            <CompensationLabel>Weekend On-Call Hours</CompensationLabel>
            <CompensationValue>{compensation.weekendOnCallHours.toFixed(1)}h</CompensationValue>
          </CompensationItem>
          <CompensationItem>
            <CompensationLabel>Weekday Incident Hours</CompensationLabel>
            <CompensationValue>{compensation.weekdayIncidentHours.toFixed(1)}h</CompensationValue>
          </CompensationItem>
          <CompensationItem>
            <CompensationLabel>Weekend Incident Hours</CompensationLabel>
            <CompensationValue>{compensation.weekendIncidentHours.toFixed(1)}h</CompensationValue>
          </CompensationItem>
          <CompensationItem>
            <CompensationLabel>Weekday Night Shift Hours</CompensationLabel>
            <CompensationValue>{nightShiftHours.weekday.toFixed(1)}h</CompensationValue>
          </CompensationItem>
          <CompensationItem>
            <CompensationLabel>Weekend Night Shift Hours</CompensationLabel>
            <CompensationValue>{nightShiftHours.weekend.toFixed(1)}h</CompensationValue>
          </CompensationItem>
        </CompensationGrid>

        <TotalCompensation>
          <CompensationLabel>Total Compensation</CompensationLabel>
          <CompensationValue>{totalCompensation.toFixed(2)}€</CompensationValue>
        </TotalCompensation>
      </CompensationContainer>
    </CompensationSection>
  );
};

export default CompensationSectionComponent; 
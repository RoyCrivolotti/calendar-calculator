import React, { useEffect, useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CompensationService } from '../../../domain/calendar/services/CompensationService';
import { SubEvent } from '../../../domain/calendar/entities/SubEvent';
import { storageService } from '../../services/storage';

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid #e2e8f0;
`;

const Title = styled.h2`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
`;

const Breakdown = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const BreakdownItem = styled.div`
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;

  h3 {
    margin: 0 0 0.5rem 0;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 500;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .amount {
    color: #0f172a;
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 0.5rem;
  }
`;

const MonthSelector = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const MonthButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #0f172a;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface CompensationSectionProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

const CompensationSection: React.FC<CompensationSectionProps> = ({
  events,
  currentDate,
  onDateChange
}) => {
  const [breakdown, setBreakdown] = useState<CompensationBreakdown[]>([]);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const compensationService = useMemo(() => new CompensationService(), []);

  useEffect(() => {
    // Load sub-events from storage
    const fetchSubEvents = async () => {
      try {
        const loadedSubEvents = await storageService.loadSubEvents();
        setSubEvents(loadedSubEvents);
      } catch (error) {
        console.error('Error loading sub-events:', error);
      }
    };
    
    fetchSubEvents();
  }, []);

  useEffect(() => {
    if (subEvents.length > 0) {
      const newBreakdown = compensationService.calculateMonthlyCompensation(events, subEvents, currentDate);
      setBreakdown(newBreakdown);
    }
  }, [events, subEvents, currentDate, compensationService]);

  const months = useMemo(() => {
    const result = [];
    // Add previous month
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(currentDate.getMonth() - 1);
    result.push(prevMonth);
    
    // Add current month
    result.push(new Date(currentDate));
    
    // Add next month
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(currentDate.getMonth() + 1);
    result.push(nextMonth);
    
    return result;
  }, [currentDate]);

  return (
    <Section>
      <Title>Compensation Breakdown for {format(currentDate, 'MMMM yyyy')}</Title>
      <MonthSelector>
        <MonthButton onClick={() => onDateChange(months[0])}>
          Previous Month
        </MonthButton>
        {months.map(month => (
          <MonthButton
            key={month.toISOString()}
            onClick={() => onDateChange(month)}
            disabled={month.getTime() === currentDate.getTime()}
          >
            {format(month, 'MMMM yyyy')}
          </MonthButton>
        ))}
        <MonthButton onClick={() => onDateChange(months[2])}>
          Next Month
        </MonthButton>
      </MonthSelector>
      <Breakdown>
        {breakdown.map((item, index) => (
          <BreakdownItem key={index}>
            <h3>{item.description}</h3>
            <p>Count: {item.count}</p>
            <div className="amount">€{item.amount.toFixed(2)}</div>
          </BreakdownItem>
        ))}
      </Breakdown>
    </Section>
  );
};

export default CompensationSection; 
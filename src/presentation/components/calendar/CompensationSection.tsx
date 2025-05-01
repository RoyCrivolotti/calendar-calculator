import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';
import { calculateMonthlyCompensation } from '../../../utils/compensation';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CompensationCalculator } from '../../../domain/calendar/services/CompensationCalculator';

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

const MonthList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const MonthTag = styled.button`
  padding: 0.25rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  color: #0f172a;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
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
  const [availableMonths, setAvailableMonths] = useState<Date[]>([]);

  useEffect(() => {
    const calculator = new CompensationCalculator();
    const newBreakdown = calculator.calculateMonthlyCompensation(events, currentDate);
    setBreakdown(newBreakdown);

    // Get unique months from events
    const months = new Set<string>();
    events.forEach(event => {
      const monthKey = `${event.start.getFullYear()}-${event.start.getMonth() + 1}`;
      months.add(monthKey);
    });

    const monthDates = Array.from(months).map(key => {
      const [year, month] = key.split('-').map(Number);
      return new Date(year, month - 1);
    });

    setAvailableMonths(monthDates.sort((a, b) => b.getTime() - a.getTime()));
  }, [events, currentDate]);

  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const handleMonthSelect = (date: Date) => {
    onDateChange(date);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <Section>
      <Title>Compensation Breakdown for {formatMonth(currentDate)}</Title>
      
      <MonthSelector>
        <MonthButton onClick={handlePreviousMonth}>Previous Month</MonthButton>
        <MonthList>
          {availableMonths.map((date) => (
            <MonthTag
              key={date.toISOString()}
              className={date.getMonth() === currentDate.getMonth() && 
                        date.getFullYear() === currentDate.getFullYear() ? 'active' : ''}
              onClick={() => handleMonthSelect(date)}
            >
              {formatMonth(date)}
            </MonthTag>
          ))}
        </MonthList>
        <MonthButton onClick={handleNextMonth}>Next Month</MonthButton>
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
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { logger } from '../../../utils/logger';

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
  min-height: 100px; /* Ensure consistent height */
  position: relative; /* For absolute positioning of loading state */
`;

const BreakdownItem = styled.div`
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: opacity 0.3s ease;

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

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  color: #64748b;
  font-style: italic;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;

  &.active {
    opacity: 1;
    visibility: visible;
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  color: #64748b;
  font-style: italic;
  padding: 2rem;
  grid-column: 1 / -1;
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
  const [loading, setLoading] = useState(false);
  const calculatorFacade = useMemo(() => CompensationCalculatorFacade.getInstance(), []);
  
  // Track calculations in progress
  const pendingCalculation = useRef<boolean>(false);
  const previousData = useRef<string>('');
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced loading setter to prevent flickering
  const setLoadingDebounced = useCallback((isLoading: boolean) => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    
    if (isLoading) {
      // Show loading after a small delay to prevent flicker on fast operations
      loadingTimerRef.current = setTimeout(() => {
        setLoading(true);
      }, 300);
    } else {
      setLoading(false);
    }
  }, []);
  
  // Effect cleanup
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  // Effect to calculate compensation data
  useEffect(() => {
    // Define an async function to calculate compensation
    const calculateData = async () => {
      // Prevent duplicate calculations
      if (pendingCalculation.current) {
        return;
      }
      
      pendingCalculation.current = true;
      setLoadingDebounced(true);
      
      try {
        logger.info(`Calculating compensation for ${format(currentDate, 'MMMM yyyy')}`);
        
        // Calculate compensation data
        const result = await calculatorFacade.calculateMonthlyCompensation(events, currentDate);
        
        // Check if the data has actually changed
        const dataString = JSON.stringify(result);
        if (dataString !== previousData.current) {
          logger.info(`Received ${result.length} compensation items - data changed`);
          setBreakdown(result);
          previousData.current = dataString;
        } else {
          logger.info('Compensation data unchanged, avoiding rerender');
        }
        
      } catch (error) {
        logger.error('Error calculating compensation:', error);
        setBreakdown([]);
      } finally {
        // Ensure loading state is cleared
        logger.info('Compensation calculation complete, hiding loading indicator');
        setLoadingDebounced(false);
        pendingCalculation.current = false;
      }
    };

    // Run the calculation
    calculateData();
    
  }, [events, currentDate, calculatorFacade, setLoadingDebounced]);

  // Generate month options for the selector
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

  // For debugging
  useEffect(() => {
    logger.info(`CompensationSection render - loading: ${loading}, breakdown items: ${breakdown.length}`);
  });

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
        <LoadingOverlay className={loading ? 'active' : ''}>
          Loading compensation data...
        </LoadingOverlay>
        
        {breakdown.length > 0 ? (
          breakdown.map((item, index) => (
            <BreakdownItem key={index}>
              <h3>{item.description}</h3>
              <p>Count: {item.count}</p>
              <div className="amount">€{item.amount.toFixed(2)}</div>
            </BreakdownItem>
          ))
        ) : (
          <EmptyMessage>No compensation data available for this month</EmptyMessage>
        )}
      </Breakdown>
    </Section>
  );
};

export default CompensationSection; 
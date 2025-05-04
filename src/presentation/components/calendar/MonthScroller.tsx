import React, { memo, useRef, useCallback } from 'react';
import styled from '@emotion/styled';
import MonthBox from './MonthBox';

const Container = styled.div`
  position: relative;
  min-height: 120px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border: 2px solid #e2e8f0;
  width: 100%;
`;

const ScrollContainer = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 1rem 0.75rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ScrollButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: white;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  padding: 0;
  color: #64748b;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    transition: transform 0.2s;
  }

  &:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    color: #3b82f6;
    
    svg {
      transform: scale(1.1);
    }
  }

  &.left {
    left: -16px;
  }

  &.right {
    right: -16px;
  }
`;

interface MonthData {
  date: Date;
  totalAmount: number;
  data: any[];
}

interface MonthScrollerProps {
  months: MonthData[];
  selectedMonth: Date | null;
  onMonthClick: (date: Date) => void;
}

const MonthScrollerComponent: React.FC<MonthScrollerProps> = ({
  months,
  selectedMonth,
  onMonthClick
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Memoize scroll functions to prevent unnecessary re-renders
  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  return (
    <Container>
      <ScrollButton 
        className="left" 
        onClick={scrollLeft}
        aria-label="Scroll left"
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </ScrollButton>
      
      <ScrollContainer ref={scrollContainerRef}>
        {months.map((month) => (
          <MonthBox
            key={month.date.toISOString()}
            date={month.date}
            amount={month.totalAmount}
            isSelected={selectedMonth ? selectedMonth.getTime() === month.date.getTime() : false}
            onClick={onMonthClick}
          />
        ))}
      </ScrollContainer>
      
      <ScrollButton 
        className="right" 
        onClick={scrollRight}
        aria-label="Scroll right"
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
        </svg>
      </ScrollButton>
    </Container>
  );
};

// Use memo to prevent unnecessary re-renders
export const MonthScroller = memo(MonthScrollerComponent, (prevProps, nextProps) => {
  // Check if months array changed
  if (prevProps.months.length !== nextProps.months.length) {
    return false;
  }
  
  // Check if any month data changed
  for (let i = 0; i < prevProps.months.length; i++) {
    const prevMonth = prevProps.months[i];
    const nextMonth = nextProps.months[i];
    
    if (
      prevMonth.date.getTime() !== nextMonth.date.getTime() ||
      prevMonth.totalAmount !== nextMonth.totalAmount
    ) {
      return false;
    }
  }
  
  // Check if selected month changed
  const prevSelectedTime = prevProps.selectedMonth ? prevProps.selectedMonth.getTime() : null;
  const nextSelectedTime = nextProps.selectedMonth ? nextProps.selectedMonth.getTime() : null;
  
  if (prevSelectedTime !== nextSelectedTime) {
    return false;
  }
  
  // If we got here, no important props changed
  return true;
});

export default MonthScroller; 
import React, { useRef } from 'react';
import styled from '@emotion/styled';
import { formatMonthYear } from '../../../../utils/formatting/formatters'; // Corrected import path

// Styled components moved from MonthlyCompensationSummary.tsx
export const ScrollContainer = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 1rem 2.5rem;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const MonthBox = styled.button<{ isSelected: boolean }>`
  min-width: 120px;
  height: 80px;
  border: 2px solid ${props => props.isSelected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem; // This was on MonthValue, moving to container for simplicity or adjust as needed
  font-weight: 500;   // This was on MonthBox itself
  color: ${props => props.isSelected ? '#3b82f6' : '#1e293b'};
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 0.5rem;

  &:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
`;

export const MonthTitle = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

export const MonthValueDisplay = styled.div` // Renamed from MonthValue to avoid conflict
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a; // Fallback, actual color driven by MonthBox isSelected
`;

export const ScrollButton = styled.button`
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

  // &.left and &.right will be applied via className in the component
`;

// Interface for individual month item data
export interface MonthScrollerItem {
  date: Date;
  displayValue: string; // e.g., "€123.45"
  id: string; // Typically date.toISOString()
}

interface MonthScrollerProps {
  items: MonthScrollerItem[];
  selectedItemId: string | null;
  onItemSelect: (id: string, date: Date) => void;
  // Optional: if scroll buttons are part of this component, add onScrollLeft/Right
  // For now, assuming parent handles scroll buttons if they need to interact with this component's ref
}

const MonthScroller: React.FC<MonthScrollerProps> = ({
  items,
  selectedItemId,
  onItemSelect,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll functions can be exposed via a ref if parent needs to trigger them,
  // or kept internal if ScrollButtons are part of this component.
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };
  
  // If ScrollButtons are part of this component, they would be rendered here
  // For simplicity, this example assumes they are external and MonthlyCompensationSummary
  // will continue to render its own ScrollButtons, perhaps passing the ref or callbacks.
  // For a fully encapsulated component, ScrollButtons would be included here.

  return (
    <div style={{ position: 'relative' }}> {/* Wrapper to position scroll buttons */}
      <ScrollButton 
        className="left" 
        onClick={scrollLeft} 
        style={{ left: '-16px' }} // Position explicitly if not handled by className alone
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </ScrollButton>
      <ScrollContainer ref={scrollContainerRef}>
        {items.map((item) => (
          <MonthBox
            key={item.id}
            isSelected={selectedItemId === item.id}
            onClick={() => onItemSelect(item.id, item.date)}
          >
            <MonthTitle>{formatMonthYear(item.date)}</MonthTitle>
            <MonthValueDisplay>{item.displayValue}</MonthValueDisplay>
          </MonthBox>
        ))}
      </ScrollContainer>
      <ScrollButton 
        className="right" 
        onClick={scrollRight} 
        style={{ right: '-16px' }} // Position explicitly
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </ScrollButton>
    </div>
  );
};

export default MonthScroller; 
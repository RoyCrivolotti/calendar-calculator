import React, { memo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';

const StyledMonthBox = styled.button<{ isSelected: boolean }>`
  min-width: 120px;
  height: 80px;
  border: 2px solid ${props => props.isSelected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 500;
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

const MonthTitle = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

const MonthValue = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
`;

interface MonthBoxProps {
  date: Date;
  amount: number;
  isSelected: boolean;
  onClick: (date: Date) => void;
}

const MonthBoxComponent: React.FC<MonthBoxProps> = ({ 
  date, 
  amount, 
  isSelected, 
  onClick 
}) => {
  // Format the date to display month and year
  const formattedMonth = format(date, 'MMM yyyy');
  
  // Handle click event
  const handleClick = () => {
    onClick(date);
  };
  
  return (
    <StyledMonthBox 
      isSelected={isSelected} 
      onClick={handleClick}
      aria-label={`View details for ${formattedMonth}`}
    >
      <MonthTitle>{formattedMonth}</MonthTitle>
      <MonthValue>€{amount.toFixed(2)}</MonthValue>
    </StyledMonthBox>
  );
};

// Use React.memo with a custom comparison function to avoid unnecessary re-renders
export const MonthBox = memo(MonthBoxComponent, (prevProps, nextProps) => {
  // Only re-render if one of these props changed
  return (
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.amount === nextProps.amount &&
    prevProps.isSelected === nextProps.isSelected
    // We don't compare onClick function as it should be stable
  );
});

export default MonthBox; 
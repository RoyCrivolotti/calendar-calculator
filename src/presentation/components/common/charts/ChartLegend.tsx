import React from 'react';
import styled from '@emotion/styled';

export interface LegendItemProps {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: LegendItemProps[];
}

// Styled components moved from MonthlyCompensationSummary.tsx
export const LegendContainer = styled.div` // Renamed from Legend
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: center;
  
  &:empty {
    display: none;
  }
`;

export const LegendItemDisplay = styled.div` // Renamed from LegendItem
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
`;

export const LegendColorIndicator = styled.div<{ color: string }>` // Renamed from LegendColor
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
`;

const ChartLegend: React.FC<ChartLegendProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <LegendContainer>
      {items.map((item, index) => (
        <LegendItemDisplay key={`${item.label}-${index}`}>
          <LegendColorIndicator color={item.color} />
          <span>{item.label}</span>
        </LegendItemDisplay>
      ))}
    </LegendContainer>
  );
};

export default ChartLegend; 
import React from 'react';
import styled from '@emotion/styled';

// Define the structure for a single bar item
export interface BarChartItem {
  key: string;
  value: number;
  label: string; // For tooltip title and potentially x-axis label if implemented
  color: string;
  totalForPercentage?: number; // Optional: if provided, tooltip will show percentage
}

// Define props for the BarChart component
interface BarChartProps {
  data: BarChartItem[];
  maxBarHeight?: number; // Max height for a bar, defaults to 180px
  isVisible: boolean; // For entry animation
  title?: string; // Optional title for the chart section
  // Tooltip functions passed from useTooltip hook
  showTooltip: (event: React.MouseEvent, title: string, value: string, extra?: string) => void;
  hideTooltip: () => void;
  updateTooltipPosition: (event: React.MouseEvent) => void;
}

// Styled components moved from MonthlyCompensationSummary.tsx
const BarChartWrapper = styled.div` // Renamed from ChartContainer if this is a more generic wrapper
  // Styles for the main chart container can be added if needed, 
  // or it can be a simple div if styled by parent
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  
  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ChartTitle = styled.h3`
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #334155;
  text-align: center;
`;

const StyledBarChartContainer = styled.div` // Renamed from BarChartContainer to avoid confusion
  height: 200px; // This might need to be dynamic or a prop
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 0;
  margin-bottom: 40px; // Consider making this configurable or part of wrapper
  flex: 1;
  
  @media (max-width: 768px) {
    margin-bottom: 60px;
    gap: 0.5rem;
  }
  
  @media (max-width: 480px) {
    gap: 0.25rem;
  }
`;

const StyledBar = styled.div<{ height: string, color: string }>`
  flex: 1;
  height: 0; // Initial height for animation
  background: ${props => props.color};
  border-radius: 6px 6px 0 0;
  position: relative;
  min-width: 30px;
  transition: height 0.5s ease;
  
  &.mounted {
    height: ${props => props.height};
  }
  
  &:hover {
    opacity: 0.9;
  }
  
  &:before { // For displaying value above the bar
    content: attr(data-value);
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    color: #334155;
    font-weight: 600;
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &.mounted:before {
    opacity: 1;
  }
`;

const BarChart: React.FC<BarChartProps> = ({
  data,
  maxBarHeight = 180,
  isVisible,
  title,
  showTooltip,
  hideTooltip,
  updateTooltipPosition
}) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(item => item.value));
  if (maxValue === 0) return null; // Don't render if all values are 0

  const calculateHeight = (value: number) => `${Math.max((value / maxValue) * maxBarHeight, 10)}px`;

  return (
    <BarChartWrapper className={isVisible ? 'visible' : ''}>
      {title && <ChartTitle>{title}</ChartTitle>}
      <StyledBarChartContainer>
        {data.map(item => {
          const percentageString = item.totalForPercentage 
            ? `${Math.round((item.value / item.totalForPercentage) * 100)}% of total` 
            : undefined;
          return (
            <StyledBar 
              key={item.key}
              height={calculateHeight(item.value)} 
              color={item.color}
              data-value={`${item.value}h`} // Assuming value is in hours for now
              className={isVisible ? 'mounted' : ''}
              onMouseEnter={(e) => showTooltip(e, item.label, `${item.value} hours`, percentageString)}
              onMouseMove={updateTooltipPosition}
              onMouseLeave={hideTooltip}
            />
          );
        })}
      </StyledBarChartContainer>
    </BarChartWrapper>
  );
};

export default BarChart; 
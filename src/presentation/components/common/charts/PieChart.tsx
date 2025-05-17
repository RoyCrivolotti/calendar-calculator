import React from 'react';
import styled from '@emotion/styled';

// Define the structure for a single pie slice item
export interface PieChartItem {
  key: string; // For React key
  value: number; // The value this slice represents (e.g., amount)
  label: string; // For tooltip and potentially legend
  color: string;
}

interface PieChartProps {
  data: PieChartItem[];
  isVisible: boolean; // For entry animation
  title?: string;      // Optional title for the chart section
  size?: number;       // Diameter of the pie chart, defaults to 200
  strokeWidth?: number; // Stroke width for slice separation, defaults to 1
  // Tooltip functions
  showTooltip: (event: React.MouseEvent, title: string, value: string, extra?: string) => void;
  hideTooltip: () => void;
  updateTooltipPosition: (event: React.MouseEvent) => void;
}

const PieChartWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
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

const SvgContainer = styled.div<{ size: number }>`
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  position: relative;
  margin: 0 auto; // Center the SVG container
`;

const TotalAmountDisplay = styled.div<{ isVisible: boolean }>`
  text-align: center;
  margin-top: 1rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  transition: opacity 0.3s ease;
  opacity: ${props => props.isVisible ? 1 : 0};
`;

const PieChart: React.FC<PieChartProps> = ({
  data,
  isVisible,
  title,
  size = 200,
  strokeWidth = 1,
  showTooltip,
  hideTooltip,
  updateTooltipPosition
}) => {
  if (!data || data.length === 0) return null;

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return null;

  let currentAngle = 0;
  const radius = size / 2 - strokeWidth; // Adjust radius for stroke
  const center = size / 2;

  const slices = data.map((item) => {
    const percentage = (item.value / totalValue) * 100;
    const degrees = (percentage / 100) * 360;
    
    const startAngle = currentAngle;
    const endAngle = currentAngle + degrees;
    currentAngle = endAngle;
    
    // Convert angles to radians for Math.cos/sin
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate coordinates for the arc
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    
    const largeArcFlag = degrees > 180 ? 1 : 0;
    
    // SVG path definition for a pie slice
    const path = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `Z`
    ].join(' ');
    
    return (
      <path 
        key={item.key}
        d={path}
        fill={item.color}
        stroke="white" // Or a prop for stroke color
        strokeWidth={strokeWidth}
        onMouseEnter={(e) => {
          // Directly call the passed showTooltip with item details
          const percentageString = `${((item.value / totalValue) * 100).toFixed(0)}% of total`;
          showTooltip(e, item.label, `€${item.value.toFixed(2)}`, percentageString);
        }}
        onMouseLeave={hideTooltip}
        onMouseMove={updateTooltipPosition} // Pass the event directly for position update
        style={{
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transformOrigin: 'center center', // Ensure scaling from center of the SVG
          opacity: isVisible ? 1 : 0,
          transform: `scale(${isVisible ? 1 : 0.8})`,
          cursor: 'pointer'
        }}
      />
    );
  });

  return (
    <PieChartWrapper className={isVisible ? 'visible' : ''}>
      {title && <ChartTitle>{title}</ChartTitle>}
      <SvgContainer size={size}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`translate(0,0)`}> {/* Optional: use for rotation if pie starts at 12 o'clock */}
            {slices}
          </g>
        </svg>
      </SvgContainer>
      <TotalAmountDisplay isVisible={isVisible}>
        Total: €{totalValue.toFixed(2)}
      </TotalAmountDisplay>
    </PieChartWrapper>
  );
};

export default PieChart; 
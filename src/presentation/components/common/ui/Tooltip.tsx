import React from 'react';
import styled from '@emotion/styled';

// Styled component for the tooltip
const TooltipContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  background: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  font-size: 14px;
  color: #000000;
  z-index: 99999;
  pointer-events: none;
  max-width: 200px;
  visibility: hidden; /* Start hidden */
  opacity: 0;
  transition: opacity 0.2s;
  
  &.visible {
    visibility: visible;
    opacity: 1;
  }
`;

// Title style for tooltip
const TooltipTitle = styled.div`
  font-weight: bold;
  margin-bottom: 4px;
`;

// Tooltip props interface
export interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  value?: string;
  extra?: string;
  content?: React.ReactNode;
}

/**
 * Shared Tooltip component for displaying tooltips throughout the application
 */
const Tooltip: React.FC<TooltipProps> = ({ 
  visible, 
  x, 
  y, 
  title, 
  value, 
  extra,
  content 
}) => {
  return (
    <TooltipContainer 
      className={visible ? 'visible' : ''}
      style={{ 
        left: `${x}px`, 
        top: `${y}px` 
      }}
    >
      {content ? (
        content
      ) : (
        <>
          {title && <TooltipTitle>{title}</TooltipTitle>}
          {value && <div>{value}</div>}
          {extra && <div>{extra}</div>}
        </>
      )}
    </TooltipContainer>
  );
};

export default Tooltip; 
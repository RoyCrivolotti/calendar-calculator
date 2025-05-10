import React, { ReactNode } from 'react';
import styled from '@emotion/styled';
import { XIcon } from '../../../../assets/icons';
// import { CloseButton } from './Modal'; // Will use its own SidePanelCloseButton

// Shared Side Panel Components

export const SidePanelOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1005;
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

export const SidePanel = styled.div<{ isOpen: boolean }>` // Renamed from SidePanelContainer
  position: fixed;
  top: 0;
  right: 0;
  width: 400px; // Default width, can be overridden by specific instances like RatesSidePanel
  max-width: 90vw;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
  z-index: 1010;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    width: 100%;
    max-width: 100%;
  }
`;

export const SidePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

export const SidePanelTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
`;

export const SidePanelCloseButton = styled.button` // Added definition
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #0f172a;
  padding: 0;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
  }
  
  svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 2px;
  }
`;

export const SidePanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
`;

export const SidePanelFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
`;

export const SidePanelTabs = styled.div` // Added definition
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem; // Matches CompensationSection use
`;

export const SidePanelTab = styled.button<{ isActive: boolean }>` // Added definition
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid ${props => props.isActive ? '#3b82f6' : 'transparent'};
  color: ${props => props.isActive ? '#0f172a' : '#64748b'};
  font-weight: ${props => props.isActive ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    color: ${props => props.isActive ? '#0f172a' : '#334155'};
  }
`;

// SidePanel component props
export interface SidePanelFCProps { // Renamed interface
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  preventBackdropClose?: boolean;
}

/**
 * SidePanelFC functional component for displaying a sliding panel from the side of the screen
 */
export const SidePanelFC: React.FC<SidePanelFCProps> = ({ // Renamed functional component and using its own SidePanelCloseButton
  isOpen,
  onClose,
  title,
  children,
  footer,
  preventBackdropClose = false
}) => {
  const handleOverlayClick = () => {
    if (!preventBackdropClose) {
      onClose();
    }
  };

  return (
    <>
      <SidePanelOverlay isOpen={isOpen} onClick={handleOverlayClick} />
      <SidePanel isOpen={isOpen}> {/* Uses the exported styled component SidePanel */}
        <SidePanelHeader>
          <SidePanelTitle>{title}</SidePanelTitle>
          <SidePanelCloseButton onClick={onClose}>
            <XIcon /> { /* Using XIcon */ }
          </SidePanelCloseButton>
        </SidePanelHeader>
        <SidePanelBody>
          {children}
        </SidePanelBody>
        {footer && (
          <SidePanelFooter>
            {footer}
          </SidePanelFooter>
        )}
      </SidePanel>
    </>
  );
};

// Removed default export, all exports are named now.
// export { SidePanelHeader, SidePanelTitle, SidePanelBody, SidePanelFooter }; // These are already exported individually 
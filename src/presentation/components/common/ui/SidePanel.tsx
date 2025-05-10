import React, { ReactNode } from 'react';
import styled from '@emotion/styled';
import { XIcon } from '../../../../assets/icons';
import { CloseButton } from './Modal';

// SidePanel Overlay
const SidePanelOverlay = styled.div<{ isOpen: boolean }>`
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

// SidePanel Container
const SidePanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
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

// SidePanel Header
const SidePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

// SidePanel Title
const SidePanelTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
`;

// SidePanel Body
const SidePanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
`;

// SidePanel Footer
const SidePanelFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
`;

// SidePanel component props
export interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  preventBackdropClose?: boolean;
}

/**
 * SidePanel component for displaying a sliding panel from the side of the screen
 */
const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  preventBackdropClose = false
}) => {
  // Handler for overlay click to close panel
  const handleOverlayClick = () => {
    if (!preventBackdropClose) {
      onClose();
    }
  };

  return (
    <>
      <SidePanelOverlay isOpen={isOpen} onClick={handleOverlayClick} />
      <SidePanelContainer isOpen={isOpen}>
        <SidePanelHeader>
          <SidePanelTitle>{title}</SidePanelTitle>
          <CloseButton onClose={onClose} />
        </SidePanelHeader>
        <SidePanelBody>
          {children}
        </SidePanelBody>
        {footer && (
          <SidePanelFooter>
            {footer}
          </SidePanelFooter>
        )}
      </SidePanelContainer>
    </>
  );
};

export { SidePanelHeader, SidePanelTitle, SidePanelBody, SidePanelFooter };
export default SidePanel; 
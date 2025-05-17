import React, { ReactNode } from 'react';
import styled from '@emotion/styled';

// Modal Overlay (Background)
const StyledModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

// Modal Container
const StyledModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  color: #1e293b;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
`;

// Close Button
const StyledCloseButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
  z-index: 1001;
  padding: 0;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
    transform: scale(1.05);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

// Modal Header
const StyledModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
`;

// Modal Title
const StyledModalTitle = styled.h2`
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
`;

// Modal Body
const StyledModalBody = styled.div`
  margin-bottom: 1.5rem;
`;

// Modal Footer
const StyledModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
`;

// Component interfaces
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  preventBackdropClose?: boolean;
}

interface ModalHeaderProps {
  children: ReactNode;
}

interface ModalTitleProps {
  children: ReactNode;
}

interface ModalBodyProps {
  children: ReactNode;
}

interface ModalFooterProps {
  children: ReactNode;
}

interface CloseButtonProps {
  onClose: () => void;
}

// Modal subcomponents
export const ModalHeader: React.FC<ModalHeaderProps> = ({ children }) => {
  return <StyledModalHeader>{children}</StyledModalHeader>;
};

export const ModalTitle: React.FC<ModalTitleProps> = ({ children }) => {
  return <StyledModalTitle>{children}</StyledModalTitle>;
};

export const ModalBody: React.FC<ModalBodyProps> = ({ children }) => {
  return <StyledModalBody>{children}</StyledModalBody>;
};

export const ModalFooter: React.FC<ModalFooterProps> = ({ children }) => {
  return <StyledModalFooter>{children}</StyledModalFooter>;
};

export const CloseButton: React.FC<CloseButtonProps> = ({ onClose }) => {
  return (
    <StyledCloseButton onClick={onClose} aria-label="Close modal">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </StyledCloseButton>
  );
};

// Main Modal component
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, preventBackdropClose = false }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!preventBackdropClose) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <StyledModalOverlay onClick={handleOverlayClick}>
      <StyledModalContent onClick={handleContentClick}>
        {children}
      </StyledModalContent>
    </StyledModalOverlay>
  );
};

export default Modal; 
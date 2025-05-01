import React from 'react';
import styled from '@emotion/styled';

const EventTypeSelector = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 300px;
  background-color: white;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  width: 24px;
  height: 24px;

  &:hover {
    background-color: #f1f5f9;
    color: #0f172a;
  }
`;

const EventTypeButton = styled.button`
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: center;

  &.oncall {
    background: #4CAF50;
    color: white;
    &:hover {
      background: #45a049;
    }
  }

  &.incident {
    background: #f44336;
    color: white;
    &:hover {
      background: #da190b;
    }
  }
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
`;

interface EventTypeSelectorProps {
  onClose: () => void;
  onSelect: (type: 'oncall' | 'incident') => void;
}

export const EventTypeSelectorComponent: React.FC<EventTypeSelectorProps> = ({ onClose, onSelect }) => {
  return (
    <ModalOverlay>
      <EventTypeSelector>
        <CloseButton onClick={onClose}>×</CloseButton>
        <ModalTitle>Select Event Type</ModalTitle>
        <EventTypeButton
          className="oncall"
          onClick={() => onSelect('oncall')}
        >
          Create On-Call Shift
        </EventTypeButton>
        <EventTypeButton
          className="incident"
          onClick={() => onSelect('incident')}
        >
          Create Incident
        </EventTypeButton>
      </EventTypeSelector>
    </ModalOverlay>
  );
};

export default EventTypeSelectorComponent; 
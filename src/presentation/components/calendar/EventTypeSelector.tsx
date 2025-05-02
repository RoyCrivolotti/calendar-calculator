import React from 'react';
import styled from '@emotion/styled';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 300px;
`;

const Title = styled.h2`
  margin: 0;
  color: #333;
  font-size: 1.5rem;
`;

type EventType = 'oncall' | 'incident' | 'holiday';

interface ButtonProps {
  eventType: EventType;
}

const Button = styled.button<ButtonProps>`
  padding: 1rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  color: white;
  background-color: ${props => {
    switch (props.eventType) {
      case 'oncall':
        return '#4a90e2';
      case 'incident':
        return '#e25c4a';
      case 'holiday':
        return '#4ae25c';
    }
  }};

  &:hover {
    opacity: 0.9;
  }
`;

interface EventTypeSelectorProps {
  onSelect: (type: EventType) => void;
  onClose: () => void;
}

const EventTypeSelector: React.FC<EventTypeSelectorProps> = ({ onSelect, onClose }) => {
  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <Title>Select Event Type</Title>
        <Button eventType="oncall" onClick={() => onSelect('oncall')}>
          On-Call Shift
        </Button>
        <Button eventType="incident" onClick={() => onSelect('incident')}>
          Incident
        </Button>
        <Button eventType="holiday" onClick={() => onSelect('holiday')}>
          Holiday
        </Button>
      </ModalContent>
    </ModalOverlay>
  );
};

export default EventTypeSelector; 
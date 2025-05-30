import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { CompensationSummary } from '../../../domain/calendar/types/CompensationSummary';
import CompensationSummarySection from './CompensationSummarySection';
import { logger } from '../../../utils/logger';
import { Modal, ModalHeader, ModalTitle, ModalBody, CloseButton, Button } from '../common/ui';
import { container } from '../../../config/container';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
import { 
  PhoneIcon, 
  AlertIcon, 
  ClockIcon, 
  CalendarIcon, 
  ClipboardListIcon
} from '../../../assets/icons';

const EventTypeBadge = styled.span<{ eventType: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 9999px;
  margin-left: 0.75rem;
  line-height: 1.2;
  border: 1px solid ${props => {
    switch(props.eventType) {
      case 'oncall': return '#e0f2fe';
      case 'incident': return '#fca5a5';
      case 'holiday': return '#fde68a';
      default: return '#d1fae5';
    }
  }};
  background: ${props => {
    switch(props.eventType) {
      case 'oncall': return '#e0f2fe';
      case 'incident': return '#fee2e2';
      case 'holiday': return '#fef3c7';
      default: return '#f0fdf4';
    }
  }};
  color: ${props => {
    switch(props.eventType) {
      case 'oncall': return '#075985';
      case 'incident': return '#991b1b';
      case 'holiday': return '#92400e';
      default: return '#16a34a';
    }
  }};
`;

const ContentSection = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  background-color: #f8fafc;
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #334155;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
`;

const TimeInputGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const TimeInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const InputLabel = styled.label`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const TimeInput = styled.input`
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.95rem;
  color: #0f172a;
  width: 100%;
  background-color: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
  
  &:disabled {
    background-color: #f8fafc;
    cursor: not-allowed;
  }
`;

const ValidationError = styled.p`
  color: #e53e3e;
  margin: 0.5rem 0;
  font-size: 0.875rem;
`;

const ActionButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 2rem;
  gap: 1rem;
`;

export interface EventDetailsModalProps {
  event: CalendarEvent;
  onSave: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onClose: () => void;
}

// Helper functions defined outside of component to avoid dependency issues
const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const EventDetailsModalComponent: React.FC<EventDetailsModalProps> = ({ 
  event, 
  onSave, 
  onDelete,
  onClose 
}) => {
  const [title, setTitle] = useState<string>(event.title || '');
  const [startTime, setStartTime] = useState<string>(formatDateForInput(event.start));
  const [endTime, setEndTime] = useState<string>(formatDateForInput(event.end));
  const [isTimeValid, setIsTimeValid] = useState<boolean>(true);
  const [hasChanges, setHasChanges] = useState<boolean>(event.id.startsWith('temp-'));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [compensationSummary, setCompensationSummary] = useState<CompensationSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const calculatorFacade = useMemo(() => {
    const subEventRepo = container.get<SubEventRepository>('subEventRepository');
    return CompensationCalculatorFacade.getInstance(subEventRepo);
  }, []);

  // Set up event listener for escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Calculate compensation preview when event time changes
  useEffect(() => {
    const calculatePreview = async () => {
      if (!isTimeValid) return;
      
      try {
        setIsCalculating(true);
        
        // Create a temporary event with the current times
        const updatedEvent = createCalendarEvent({
          ...event.toJSON(),
          start: new Date(startTime),
          end: new Date(endTime)
        });
        
        // Calculate compensation for this event
        const summary = await calculatorFacade.calculateEventCompensation(updatedEvent);
        setCompensationSummary(summary);
      } catch (error) {
        logger.error('Error calculating compensation preview:', error);
        setCompensationSummary(null);
      } finally {
        setIsCalculating(false);
      }
    };
    
    calculatePreview();
  }, [startTime, endTime, isTimeValid, event, calculatorFacade]);

  const validateTimes = useCallback((start: string, end: string): boolean => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setValidationError('Invalid date format');
      return false;
    }
    
    if (startDate >= endDate) {
      setValidationError('End time must be after start time');
      return false;
    }
    
    setValidationError(null);
    return true;
  }, []);

  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = e.target.value;
    setStartTime(newStartTime);
    const valid = validateTimes(newStartTime, endTime);
    setIsTimeValid(valid);
    setHasChanges(true);
  }, [endTime, validateTimes]);

  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndTime = e.target.value;
    setEndTime(newEndTime);
    const valid = validateTimes(startTime, newEndTime);
    setIsTimeValid(valid);
    setHasChanges(true);
  }, [startTime, validateTimes]);

  const handleSave = useCallback(async () => {
    if (!isTimeValid) return;
    
    try {
      // Create updated event with new times
      const updatedEvent = createCalendarEvent({
        ...event.toJSON(),
        title,
        start: new Date(startTime),
        end: new Date(endTime)
      });
      
      // Pass to parent for saving
      onSave(updatedEvent);
    } catch (error) {
      logger.error('Error saving event:', error);
    }
  }, [event, title, startTime, endTime, isTimeValid, onSave]);

  const handleDelete = useCallback(async () => {
    try {
      onDelete(event);
    } catch (error) {
      logger.error('Error deleting event:', error);
    }
  }, [event, onDelete]);

  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '0.5rem', color: '#64748b', display: 'inline-flex', alignItems: 'center' }}><CalendarIcon /></span>
          <ModalTitle>{event.id.startsWith('temp-') ? 'Add Event' : 'Edit Event'}</ModalTitle>
          <EventTypeBadge eventType={event.type}>
            {event.type === 'oncall' && <PhoneIcon />}
            {event.type === 'incident' && <AlertIcon />}
            {event.type === 'oncall' ? 'On-Call Shift' : 
             event.type === 'incident' ? 'Incident Response' :
             event.type === 'holiday' ? 'Holiday' : event.title}
          </EventTypeBadge>
        </div>
        <CloseButton onClose={onClose} />
      </ModalHeader>
      
      <ModalBody>
        <ContentSection>
          <SectionTitle>
            <ClockIcon /> 
            Date & Time
          </SectionTitle>
          <TimeInputGrid>
            <TimeInputGroup>
              <InputLabel htmlFor="start-time">Start Time</InputLabel>
              <TimeInput 
                id="start-time"
                type="datetime-local" 
                value={startTime}
                onChange={handleStartTimeChange}
                required
              />
            </TimeInputGroup>
            <TimeInputGroup>
              <InputLabel htmlFor="end-time">End Time</InputLabel>
              <TimeInput 
                id="end-time"
                type="datetime-local" 
                value={endTime}
                onChange={handleEndTimeChange}
                required
              />
            </TimeInputGroup>
          </TimeInputGrid>
          
          {!isTimeValid && (
            <ValidationError>
              End time must be after start time
            </ValidationError>
          )}
        </ContentSection>
        
        {isCalculating ? (
          <ContentSection>
            <p>Calculating compensation preview...</p>
          </ContentSection>
        ) : compensationSummary && (
          <ContentSection>
            <SectionTitle>
              <ClipboardListIcon />
              Details
            </SectionTitle>
            <CompensationSummarySection summary={compensationSummary} />
          </ContentSection>
        )}
        
        <ActionButtonContainer>
          <Button 
            variant="primary" 
            onClick={handleSave}
            disabled={!isTimeValid}
          >
            Save Changes
          </Button>
          {!event.id.startsWith('temp-') && (
            <Button 
              variant="danger" 
              onClick={handleDelete}
            >
              Delete Event
            </Button>
          )}
        </ActionButtonContainer>
      </ModalBody>
    </Modal>
  );
};

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: EventDetailsModalProps, nextProps: EventDetailsModalProps) => {
  // Check if the event has changed
  const prevEvent = prevProps.event;
  const nextEvent = nextProps.event;
  
  if (prevEvent.id !== nextEvent.id ||
      prevEvent.type !== nextEvent.type ||
      prevEvent.title !== nextEvent.title ||
      prevEvent.start.getTime() !== nextEvent.start.getTime() ||
      prevEvent.end.getTime() !== nextEvent.end.getTime()) {
    return false;
  }
  
  // For handler functions, we rely on the parent component to memoize them properly
  return prevProps.onSave === nextProps.onSave &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onClose === nextProps.onClose;
};

// Apply memo with custom comparison
const EventDetailsModal = React.memo(EventDetailsModalComponent, arePropsEqual);

export default EventDetailsModal; 
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { CompensationSummary } from '../../../domain/calendar/types/CompensationSummary';
import CompensationSummarySection from './CompensationSummarySection';
import { logger } from '../../../utils/logger';
import { trackOperation } from '../../../utils/errorHandler';

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

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  color: #1e293b;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
`;

const ModalTitle = styled.h2`
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
`;

const EventTypeIndicator = styled.div<{ eventType: string }>`
  font-size: 1rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid ${props => {
    switch(props.eventType) {
      case 'oncall': return '#bae6fd';
      case 'incident': return '#fecaca';
      default: return '#d1fae5';
    }
  }};
  background: ${props => {
    switch(props.eventType) {
      case 'oncall': return '#f0f9ff';
      case 'incident': return '#fef2f2';
      default: return '#f0fdf4';
    }
  }};
  color: ${props => {
    switch(props.eventType) {
      case 'oncall': return '#0369a1';
      case 'incident': return '#dc2626';
      default: return '#16a34a';
    }
  }};
`;

const CloseButton = styled.button`
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
  
  svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }
`;

const ContentSection = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  background-color: #f8fafc;
`;

const SectionTitle = styled.h3`
  color: #334155;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
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

const EventInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 0.5rem 1rem;
  align-items: center;
  margin-top: 1rem;
`;

const InfoLabel = styled.span`
  color: #64748b;
  font-weight: 500;
  font-size: 0.9rem;
`;

const InfoValue = styled.span`
  color: #0f172a;
  font-weight: 500;
  font-size: 0.95rem;
`;

const ValidationError = styled.p`
  color: #e53e3e;
  margin: 0.5rem 0;
  font-size: 0.875rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #f1f5f9;
`;

const ActionButton = styled.button<{ variant: 'primary' | 'delete' }>`
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  
  background: ${props => props.variant === 'primary' ? '#3b82f6' : '#fff'};
  color: ${props => props.variant === 'primary' ? '#fff' : '#dc2626'};
  box-shadow: ${props => props.variant === 'primary' 
    ? '0 4px 6px rgba(59, 130, 246, 0.2)' 
    : '0 0 0 1px #fecaca'};
  
  &:hover {
    background: ${props => props.variant === 'primary' ? '#2563eb' : '#fef2f2'};
    transform: translateY(-1px);
    box-shadow: ${props => props.variant === 'primary' 
      ? '0 6px 8px rgba(59, 130, 246, 0.25)' 
      : '0 0 0 1px #fca5a5'};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: #64748b;
  font-style: italic;
  background-color: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
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
  const calculatorFacade = useMemo(() => CompensationCalculatorFacade.getInstance(), []);

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

  const formatDuration = useCallback((start: Date, end: Date): string => {
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }, []);

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

  const getEventTypeLabel = useCallback(() => {
    switch(event.type) {
      case 'oncall': return 'On-Call Shift';
      case 'incident': return 'Incident';
      default: return 'Holiday';
    }
  }, [event.type]);

  // Calculate simple duration in hours
  const durationHours = ((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60)).toFixed(1);

  // Handle modal overlay click with stopPropagation
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // Only close if directly clicking the overlay (not its children)
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent>
        <CloseButton onClick={onClose} aria-label="Close modal">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </CloseButton>
        
        <ModalHeader>
          <ModalTitle>{getEventTypeLabel()}</ModalTitle>
          <EventTypeIndicator eventType={event.type}>
            {getEventTypeLabel()}
          </EventTypeIndicator>
        </ModalHeader>
        
        <ContentSection>
          <SectionTitle>Event Details</SectionTitle>
          <TimeInputGrid>
            <TimeInputGroup>
              <InputLabel htmlFor="startTime">Start Time</InputLabel>
              <TimeInput
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={handleStartTimeChange}
              />
            </TimeInputGroup>
            <TimeInputGroup>
              <InputLabel htmlFor="endTime">End Time</InputLabel>
              <TimeInput
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={handleEndTimeChange}
              />
            </TimeInputGroup>
          </TimeInputGrid>
          
          {validationError && (
            <ValidationError>{validationError}</ValidationError>
          )}
          
          <EventInfoGrid>
            <InfoLabel>Type:</InfoLabel>
            <InfoValue>{getEventTypeLabel()}</InfoValue>
            
            <InfoLabel>Duration:</InfoLabel>
            <InfoValue>{durationHours} hours</InfoValue>
            
            {event.type === 'holiday' && (
              <>
                <InfoLabel>Note:</InfoLabel>
                <InfoValue style={{ gridColumn: '2', color: '#64748b', fontStyle: 'italic' }}>
                  Holiday events span the entire day and cannot be modified
                </InfoValue>
              </>
            )}
          </EventInfoGrid>
        </ContentSection>
        
        {/* Compensation Details Section */}
        {isCalculating ? (
          <LoadingIndicator>
            Calculating compensation...
          </LoadingIndicator>
        ) : (
          compensationSummary && <CompensationSummarySection summary={compensationSummary} />
        )}
        
        <ButtonGroup>
          <ActionButton 
            variant="primary" 
            onClick={handleSave}
            disabled={!isTimeValid}
          >
            Save Changes
          </ActionButton>
          {!event.id.startsWith('temp-') && (
            <ActionButton 
              variant="delete" 
              onClick={handleDelete}
            >
              Delete Event
            </ActionButton>
          )}
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
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
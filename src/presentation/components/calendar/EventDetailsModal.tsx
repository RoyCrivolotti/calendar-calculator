import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent, createCalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { CompensationSummary } from '../../../domain/calendar/types/CompensationSummary';
import CompensationSummarySection from './CompensationSummarySection';

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
  width: fit-content;
  min-width: 600px;
  max-width: 90vw;
  background-color: white;
  max-height: 90vh;
  overflow-y: auto;
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

  &.incident {
    background: #f44336;
    color: white;
    &:hover {
      background: #da190b;
    }
  }

  &.save {
    background: #4CAF50;
    color: white;
    &:hover {
      background: #45a049;
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

const EventDetails = styled.div`
  margin-bottom: 1rem;
  color: #0f172a;
`;

const TimeInputGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const TimeInput = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
  }

  input {
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 1rem;
    color: #0f172a;
    width: 100%;
    background-color: white;
    cursor: pointer;
    min-width: 280px;

    &::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.6;
      &:hover {
        opacity: 1;
      }
    }

    &::-webkit-datetime-edit {
      color: #0f172a;
      padding: 0 0.2em;
    }

    &::-webkit-datetime-edit-fields-wrapper {
      color: #0f172a;
      padding: 0 0.2em;
    }

    &::-webkit-datetime-edit-text {
      color: #0f172a;
      padding: 0 0.2em;
    }

    &::-webkit-datetime-edit-hour-field,
    &::-webkit-datetime-edit-minute-field,
    &::-webkit-datetime-edit-day-field,
    &::-webkit-datetime-edit-month-field,
    &::-webkit-datetime-edit-year-field {
      color: #0f172a;
      padding: 0 0.2em;
    }

    &:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 1rem;
  color: #64748b;
  font-style: italic;
`;

const BasicInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  
  p {
    margin: 0;
    display: flex;
    justify-content: space-between;
  }
  
  .label {
    color: #64748b;
    font-weight: 500;
  }
  
  .value {
    color: #0f172a;
  }
`;

export interface EventDetailsModalProps {
  event: CalendarEvent;
  onSave: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onClose: () => void;
}

export const EventDetailsModalComponent: React.FC<EventDetailsModalProps> = ({ 
  event, 
  onSave, 
  onDelete,
  onClose 
}) => {
  const [compensationSummary, setCompensationSummary] = useState<CompensationSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const calculatorFacade = CompensationCalculatorFacade.getInstance();
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  // Load compensation summary on mount
  useEffect(() => {
    const loadCompensationSummary = async () => {
      if (event.type === 'holiday') return; // Don't calculate for holidays
      
      setIsLoading(true);
      try {
        const summary = await calculatorFacade.calculateEventCompensation(event);
        setCompensationSummary(summary);
      } catch (error) {
        console.error('Error loading compensation summary:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCompensationSummary();
  }, [event, calculatorFacade]);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [startTime, setStartTime] = useState(formatDateForInput(event.start));
  const [endTime, setEndTime] = useState(formatDateForInput(event.end));
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateTimes = (start: string, end: string): boolean => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (startDate >= endDate) {
      setValidationError('End time must be after start time');
      return false;
    }
    
    setValidationError(null);
    return true;
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = e.target.value;
    setStartTime(newStartTime);
    
    // If new start time is after end time, adjust end time
    const newStart = new Date(newStartTime);
    const currentEnd = new Date(endTime);
    
    if (newStart >= currentEnd) {
      // Set end time to start time + 1 hour
      const adjustedEnd = new Date(newStart);
      adjustedEnd.setHours(adjustedEnd.getHours() + 1);
      setEndTime(formatDateForInput(adjustedEnd));
    } else {
      validateTimes(newStartTime, endTime);
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndTime = e.target.value;
    setEndTime(newEndTime);
    validateTimes(startTime, newEndTime);
  };

  const handleSave = () => {
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (newStart >= newEnd) {
      setValidationError('End time must be after start time');
      return;
    }

    const updatedEvent = createCalendarEvent({
      ...event,
      start: newStart,
      end: newEnd,
      type: event.type
    });

    onSave(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    onClose();
    onDelete(event);
  };
  
  // Calculate simple duration in hours
  const durationHours = ((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60)).toFixed(1);

  return (
    <ModalOverlay>
      <EventTypeSelector>
        <CloseButton onClick={onClose}>×</CloseButton>
        <ModalTitle>Event Details</ModalTitle>
        <EventDetails>
          <BasicInfo>
            <p>
              <span className="label">Type:</span>
              <span className="value">{event.type === 'oncall' ? 'On-Call Shift' : event.type === 'incident' ? 'Incident' : 'Holiday'}</span>
            </p>
          </BasicInfo>
          
          <TimeInputGroup>
            <TimeInput>
              <label>Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={handleStartTimeChange}
                disabled={event.type === 'holiday'}
              />
            </TimeInput>
            <TimeInput>
              <label>End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={handleEndTimeChange}
                disabled={event.type === 'holiday'}
              />
            </TimeInput>
          </TimeInputGroup>
          {validationError && <p style={{ color: '#e53e3e', marginTop: '-0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>{validationError}</p>}
          
          <BasicInfo>
            <p>
              <span className="label">Duration:</span>
              <span className="value">{durationHours} hours</span>
            </p>
            {event.type === 'holiday' && <p><em>Holiday events span the entire day and cannot be modified</em></p>}
          </BasicInfo>
          
          {isLoading ? (
            <LoadingIndicator>Loading compensation details...</LoadingIndicator>
          ) : (
            compensationSummary && <CompensationSummarySection summary={compensationSummary} />
          )}
        </EventDetails>
        <ButtonGroup>
          <EventTypeButton
            className="save"
            onClick={handleSave}
          >
            Save Changes
          </EventTypeButton>
          <EventTypeButton
            className="incident"
            onClick={handleDelete}
          >
            Delete Event
          </EventTypeButton>
        </ButtonGroup>
      </EventTypeSelector>
    </ModalOverlay>
  );
};

export default EventDetailsModalComponent; 
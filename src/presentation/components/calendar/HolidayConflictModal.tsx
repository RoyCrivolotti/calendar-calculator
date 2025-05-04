import React from 'react';
import styled from '@emotion/styled';
import { CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalContainer = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
`;

const ModalContent = styled.div`
  color: #334155;
  font-size: 1rem;
  line-height: 1.5;
`;

const ConflictList = styled.ul`
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style-type: disc;
`;

const ConflictItem = styled.li`
  margin-bottom: 0.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

const Button = styled.button<{ primary?: boolean }>`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  background: ${props => props.primary ? '#3b82f6' : '#f1f5f9'};
  color: ${props => props.primary ? 'white' : '#334155'};
  
  &:hover {
    background: ${props => props.primary ? '#2563eb' : '#e2e8f0'};
  }
`;

interface HolidayConflictModalProps {
  isHoliday: boolean;
  conflicts: CalendarEventProps[];
  onAdjust: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

const HolidayConflictModal: React.FC<HolidayConflictModalProps> = ({
  isHoliday,
  conflicts,
  onAdjust,
  onContinue,
  onCancel
}) => {
  // Get event types for a more informative display
  const conflictTypes = conflicts.map(e => 
    e.type === 'oncall' ? 'on-call shift' : e.type
  );
  const uniqueTypes = [...new Set(conflictTypes)];
  
  // Group conflicts by type for better display
  const conflictsByType: Record<string, CalendarEventProps[]> = {};
  conflicts.forEach(conflict => {
    const type = conflict.type === 'oncall' ? 'on-call shift' : conflict.type;
    if (!conflictsByType[type]) {
      conflictsByType[type] = [];
    }
    conflictsByType[type].push(conflict);
  });

  return (
    <ModalOverlay>
      <ModalContainer>
        <ModalTitle>
          {isHoliday 
            ? 'Holiday Overlaps with Existing Events' 
            : 'Event Overlaps with Holidays'}
        </ModalTitle>
        <ModalContent>
          {isHoliday ? (
            <>
              <p>
                This holiday overlaps with {conflicts.length} existing {uniqueTypes.join(', ')} {conflicts.length === 1 ? 'event' : 'events'}.
              </p>
              <ConflictList>
                {Object.entries(conflictsByType).map(([type, events]) => (
                  <ConflictItem key={type}>
                    {events.length} {type}{events.length > 1 ? 's' : ''} 
                    {events.length <= 3 && (
                      <ul>
                        {events.map(event => (
                          <li key={event.id}>
                            {new Date(event.start).toLocaleDateString()} {new Date(event.start).toLocaleTimeString()} - {new Date(event.end).toLocaleTimeString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </ConflictItem>
                ))}
              </ConflictList>
              <p>
                These events' sub-events will be automatically updated to account for the holiday.
                This ensures accurate compensation calculations that reflect the holiday status.
              </p>
            </>
          ) : (
            <>
              <p>
                This event overlaps with holidays on the following dates:
              </p>
              <ConflictList>
                {conflicts.map(holiday => (
                  <ConflictItem key={holiday.id}>
                    {new Date(holiday.start).toLocaleDateString()}
                  </ConflictItem>
                ))}
              </ConflictList>
              <p>
                Sub-events will be automatically adjusted to account for these holidays.
                This ensures compensation calculations reflect the holiday status.
              </p>
            </>
          )}
        </ModalContent>
        <ButtonGroup>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          {isHoliday ? (
            <>
              <Button primary onClick={onAdjust}>
                Save Holiday & Adjust Events
              </Button>
            </>
          ) : (
            <Button primary onClick={onContinue}>
              Continue
            </Button>
          )}
        </ButtonGroup>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default HolidayConflictModal; 
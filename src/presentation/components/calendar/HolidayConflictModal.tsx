import React from 'react';
import styled from '@emotion/styled';
import { CalendarEventProps, EventTypes } from '../../../domain/calendar/entities/CalendarEvent';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button } from '../common/ui';

const ConflictList = styled.ul`
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style-type: disc;
`;

const ConflictItem = styled.li`
  margin-bottom: 0.5rem;
`;

interface HolidayConflictModalProps {
  isHoliday: boolean;
  conflicts: CalendarEventProps[];
  onAdjust: () => void;
  onContinue: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const HolidayConflictModal: React.FC<HolidayConflictModalProps> = ({
  isHoliday,
  conflicts,
  onAdjust,
  onContinue,
  onCancel,
  isOpen
}) => {
  // Get event types for a more informative display
  const conflictTypes = conflicts.map(e => 
    e.type === EventTypes.ONCALL ? 'on-call shift' : e.type
  );
  const uniqueTypes = [...new Set(conflictTypes)];
  
  // Group conflicts by type for better display
  const conflictsByType: Record<string, CalendarEventProps[]> = {};
  conflicts.forEach(conflict => {
    const type = conflict.type === EventTypes.ONCALL ? 'on-call shift' : conflict.type;
    if (!conflictsByType[type]) {
      conflictsByType[type] = [];
    }
    conflictsByType[type].push(conflict);
  });

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <ModalHeader>
        <ModalTitle>
          {isHoliday 
            ? 'Holiday Overlaps with Existing Events' 
            : 'Event Overlaps with Holidays'}
        </ModalTitle>
      </ModalHeader>
      
      <ModalBody>
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
      </ModalBody>
      
      <ModalFooter>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          
            {isHoliday ? (
            <Button variant="primary" onClick={onAdjust}>
                Save Holiday & Adjust Events
              </Button>
            ) : (
            <Button variant="primary" onClick={onContinue}>
                Continue
              </Button>
            )}
          </div>
      </ModalFooter>
    </Modal>
  );
};

export default HolidayConflictModal; 
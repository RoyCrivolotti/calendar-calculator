import React from 'react';
import styled from '@emotion/styled';
import { CalendarEventProps, EventTypes } from '../../../domain/calendar/entities/CalendarEvent';
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, Button } from '../common/ui';

const EventList = styled.ul`
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style-type: disc;
`;

const EventItem = styled.li`
  margin-bottom: 0.5rem;
`;

interface HolidayDeleteModalProps {
  holidayDate: Date;
  affectedEvents: CalendarEventProps[];
  onDelete: (shouldRegenerateEvents: boolean) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const HolidayDeleteModal: React.FC<HolidayDeleteModalProps> = ({
  holidayDate,
  affectedEvents,
  onDelete,
  onCancel,
  isOpen
}) => {
  // Group affected events by type for better display
  const eventsByType: Record<string, CalendarEventProps[]> = {};
  
  affectedEvents.forEach(event => {
    const type = event.type === EventTypes.ONCALL ? 'on-call shift' : event.type;
    if (!eventsByType[type]) {
      eventsByType[type] = [];
    }
    eventsByType[type].push(event);
  });

  const formattedDate = holidayDate.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <ModalHeader>
        <ModalTitle>Delete Holiday</ModalTitle>
      </ModalHeader>
      
      <ModalBody>
        <p>
          Are you sure you want to delete the holiday on <strong>{formattedDate}</strong>?
        </p>
        
        {affectedEvents.length > 0 && (
          <>
            <p>
              This holiday affects {affectedEvents.length} existing {affectedEvents.length === 1 ? 'event' : 'events'}:
            </p>
            <EventList>
              {Object.entries(eventsByType).map(([type, events]) => (
                <EventItem key={type}>
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
                </EventItem>
              ))}
            </EventList>
            <p>
              When this holiday is deleted, these events' sub-events will be recalculated to reflect that this day is no longer a holiday.
              This will ensure compensation calculations are correctly updated.
            </p>
          </>
        )}
      </ModalBody>
      
      <ModalFooter>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          
          {affectedEvents.length > 0 ? (
            <Button variant="primary" onClick={() => onDelete(true)}>
              Delete Holiday & Recalculate Events
            </Button>
          ) : (
            <Button variant="danger" onClick={() => onDelete(false)}>
              Delete Holiday
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default HolidayDeleteModal; 
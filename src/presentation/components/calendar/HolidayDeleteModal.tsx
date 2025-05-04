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

const EventList = styled.ul`
  margin: 1rem 0;
  padding-left: 1.5rem;
  list-style-type: disc;
`;

const EventItem = styled.li`
  margin-bottom: 0.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

const Button = styled.button<{ primary?: boolean; danger?: boolean }>`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  background: ${props => {
    if (props.danger) return '#ef4444';
    if (props.primary) return '#3b82f6';
    return '#f1f5f9';
  }};
  
  color: ${props => (props.primary || props.danger) ? 'white' : '#334155'};
  
  &:hover {
    background: ${props => {
      if (props.danger) return '#dc2626';
      if (props.primary) return '#2563eb';
      return '#e2e8f0';
    }};
  }
`;

interface HolidayDeleteModalProps {
  holidayDate: Date;
  affectedEvents: CalendarEventProps[];
  onDelete: (shouldRegenerateEvents: boolean) => void;
  onCancel: () => void;
}

const HolidayDeleteModal: React.FC<HolidayDeleteModalProps> = ({
  holidayDate,
  affectedEvents,
  onDelete,
  onCancel
}) => {
  // Group affected events by type for better display
  const eventsByType: Record<string, CalendarEventProps[]> = {};
  
  affectedEvents.forEach(event => {
    const type = event.type === 'oncall' ? 'on-call shift' : event.type;
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
    <ModalOverlay>
      <ModalContainer>
        <ModalTitle>Delete Holiday</ModalTitle>
        <ModalContent>
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
        </ModalContent>
        <ButtonGroup>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          
          {affectedEvents.length > 0 ? (
            <>
              <Button primary onClick={() => onDelete(true)}>
                Delete Holiday & Recalculate Events
              </Button>
            </>
          ) : (
            <Button danger onClick={() => onDelete(false)}>
              Delete Holiday
            </Button>
          )}
        </ButtonGroup>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default HolidayDeleteModal; 
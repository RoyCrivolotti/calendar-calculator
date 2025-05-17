import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CalendarIcon, ClockIcon } from '../../../assets/icons'; // Adjust path as necessary
import { formatDuration } from '../../../utils/formatting/formatters'; // Adjust path as necessary
import {
  SharedEventItem,
  SharedEventTimeContainer,
  SharedEventTime,
  SharedEventMetadata,
  SharedHolidayIndicator,
  SharedEventDuration,
  SharedEventBadge,
  PaginationControls as SharedPaginationControls,
} from './ui'; // Assuming this path is correct and ui/index.ts exports these

// Define the Event type as it's used in CompensationSection and MonthlyCompensationSummary
export interface Event {
  id: string;
  type: 'oncall' | 'incident';
  start: Date;
  end: Date;
  isHoliday?: boolean;
  // Add any other properties that might be on the event objects passed from parents
  description?: string; // Example, if events can have descriptions
}

const NoEventsMessage = styled.div`
  text-align: center;
  color: #64748b;
  padding: 1rem;
  font-style: italic;
`;

interface SharedEventsPanelContentProps {
  oncallEvents: Event[];
  incidentEvents: Event[];
  activeTab: 'all' | 'oncall' | 'incident';
  eventsPerPage?: number;
}

const SharedEventsPanelContent: React.FC<SharedEventsPanelContentProps> = ({
  oncallEvents,
  incidentEvents,
  activeTab,
  eventsPerPage = 10,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1); // Reset page when tab changes or events change
  }, [activeTab, oncallEvents, incidentEvents]);

  const getEventsForTab = () => {
    switch (activeTab) {
      case 'oncall':
        return oncallEvents;
      case 'incident':
        return incidentEvents;
      case 'all':
      default:
        return [...oncallEvents, ...incidentEvents].sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
        );
    }
  };

  const eventsToDisplay = getEventsForTab();

  const totalEvents = eventsToDisplay.length;
  const totalPages = Math.ceil(totalEvents / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const paginatedEvents = eventsToDisplay.slice(startIndex, startIndex + eventsPerPage);

  if (totalEvents === 0) {
    return <NoEventsMessage>No events found for this selection.</NoEventsMessage>;
  }

  return (
    <div>
      {paginatedEvents.map(event => (
        <SharedEventItem key={event.id}>
          <SharedEventTimeContainer>
            <SharedEventTime>
              <CalendarIcon />
              {format(new Date(event.start), 'MMM d, HH:mm')} - 
              {/* Adjust end time format based on type if necessary, similar to CompensationSection */}
              {event.type === 'incident' && new Date(event.start).toDateString() === new Date(event.end).toDateString()
                ? format(new Date(event.end), 'HH:mm') 
                : format(new Date(event.end), 'MMM d, HH:mm')}
            </SharedEventTime>
            {event.type === 'oncall' && (
              <SharedEventBadge color="#3b82f6">On-Call</SharedEventBadge>
            )}
            {event.type === 'incident' && (
              <SharedEventBadge color="#f43f5e">Incident</SharedEventBadge>
            )}
          </SharedEventTimeContainer>
          <SharedEventMetadata>
            <SharedEventDuration>
              <ClockIcon />
              Duration: {formatDuration(new Date(event.start), new Date(event.end))}
            </SharedEventDuration>
            {event.isHoliday && <SharedHolidayIndicator>Holiday</SharedHolidayIndicator>}
          </SharedEventMetadata>
          {/* Add SharedEventInfo if it was used or needed, for now sticking to common elements */}
        </SharedEventItem>
      ))}

      {totalPages > 1 && (
        <SharedPaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalEvents}
          itemsPerPage={eventsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default SharedEventsPanelContent; 
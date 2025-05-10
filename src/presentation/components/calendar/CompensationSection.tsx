import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { CompensationCalculatorFacade } from '../../../domain/calendar/services/CompensationCalculatorFacade';
import { logger } from '../../../utils/logger';
import { 
  PhoneIcon, 
  AlertIcon, 
  ClockIcon, 
  CalendarIcon, 
  ChevronRightIcon, 
  ListIcon, 
  XIcon, 
  DollarIcon 
} from '../../../assets/icons';
import { extractHoursData } from '../../../utils/compensation/compensationUtils';
import { formatDuration } from '../../../utils/formatting/formatters';
import { 
  PaginationControls as SharedPaginationControls,
  Button as SharedButton,
  SharedEventItem,
  SharedEventTimeContainer,
  SharedEventTime,
  SharedEventMetadata,
  SharedHolidayIndicator,
  SharedEventDuration,
  SharedEventBadge,
  SharedEventInfo,
  SharedCompensationTable,
  SharedMobileRatesContainer,
  SidePanel,
  SidePanelOverlay,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelCloseButton,
  SidePanelBody,
  SidePanelTabs,
  SidePanelTab,
  SharedEventsPanelContent,
  type SharedPanelEvent,
  RatesSidePanel,
  Tooltip,
  SharedCompensationDisplay
} from '../common/ui';
import SharedRatesPanelContent from '../common/SharedRatesPanelContent';
import { useSidePanel, useTooltip } from '../../hooks';

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid #e2e8f0;
`;

const Title = styled.h2`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 600;
`;

const Breakdown = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  min-height: 100px; /* Ensure consistent height */
  position: relative; /* For absolute positioning of loading state */
`;

const BreakdownItem = styled.div`
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: opacity 0.3s ease;

  h3 {
    margin: 0 0 0.5rem 0;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 500;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .amount {
    color: #0f172a;
    font-size: 1.25rem;
    font-weight: 600;
    margin-top: 0.5rem;
  }
`;

const MonthSelector = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
`;

const MonthButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #0f172a;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  color: #64748b;
  font-style: italic;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;

  &.active {
    opacity: 1;
    visibility: visible;
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  color: #64748b;
  font-style: italic;
  padding: 2rem;
  grid-column: 1 / -1;
`;

// New styled components for the horizontal compensation bar
const CompensationBar = styled.div`
  width: 100%;
  margin: 1.5rem 0;
  border-radius: 8px;
  overflow: hidden;
  height: 24px;
  display: flex;
`;

const CompensationBarSegment = styled.div<{ width: string; color: string }>`
  height: 100%;
  width: ${props => props.width};
  background-color: ${props => props.color};
  transition: width 0.3s ease;
  position: relative;
  
  &:hover {
    opacity: 0.9;
  }
`;

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  
  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

// New Delete Events Button
const DeleteEventsContainer = styled.div`
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const DeleteEventsButton = styled.button`
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 400px;
  
  &:hover {
    background-color: #dc2626;
  }
`;

const DeleteWarningText = styled.p`
  color: #64748b;
  font-size: 0.75rem;
  text-align: center;
  margin: 0.5rem 0 0 0;
  font-style: italic;
`;

// Delete Confirmation Modal
const DeleteModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const DeleteModalContent = styled.div`
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  padding: 1.5rem;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const DeleteModalTitle = styled.h3`
  color: #ef4444;
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
`;

const DeleteModalMessage = styled.p`
  color: #334155;
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const DeleteModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
`;

const CancelDeleteButton = styled.button`
  background: #f1f5f9;
  color: #0f172a;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #e2e8f0;
  }
`;

const ConfirmDeleteButton = styled.button`
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #dc2626;
  }
`;

interface CompensationSectionProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

// Type for compensation data breakdown
interface CompensationData {
  type: string;
  amount: number;
  color: string;
  percentage?: number;
}

const CompensationSection: React.FC<CompensationSectionProps> = ({
  events,
  currentDate,
  onDateChange
}) => {
  // Pagination settings for event lists
  const EVENTS_PER_PAGE = 10;

  const [breakdown, setBreakdown] = useState<CompensationBreakdown[]>([]);
  const [loading, setLoading] = useState(false);
  const calculatorFacade = useMemo(() => CompensationCalculatorFacade.getInstance(), []);
  
  // Use useSidePanel hook
  const { 
    isOpen: isSidePanelOpen,
    contentType: sidePanelContentType, 
    openPanel: openSidePanelHook,
    closePanel: closeSidePanelHook,
    setContent: setSidePanelContentForHook
  } = useSidePanel({ defaultContent: 'events' });
  
  // Retain sidePanelTab state if it's specific to this component's tab implementation within the panel
  const [sidePanelTab, setSidePanelTab] = useState<'all' | 'incident' | 'oncall'>('all');
  
  // Use useTooltip hook
  const {
    tooltipState,
    showTooltip: showTooltipHook,
    hideTooltip: hideTooltipHook,
    updateTooltipPosition
  } = useTooltip();
  
  // Track calculations in progress
  const pendingCalculation = useRef<boolean>(false);
  const previousData = useRef<string>('');
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced loading setter to prevent flickering
  const setLoadingDebounced = useCallback((isLoading: boolean) => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    
    if (isLoading) {
      // Show loading after a small delay to prevent flicker on fast operations
      loadingTimerRef.current = setTimeout(() => {
        setLoading(true);
      }, 300);
    } else {
      setLoading(false);
    }
  }, []);
  
  // Handle ESC key to close side panel
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidePanelOpen) {
        closeSidePanelHook();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isSidePanelOpen, closeSidePanelHook]);
  
  // Effect to calculate compensation data
  useEffect(() => {
    // Define an async function to calculate compensation
    const calculateData = async () => {
      // Prevent duplicate calculations
      if (pendingCalculation.current) {
        return;
      }
      
      pendingCalculation.current = true;
      setLoadingDebounced(true);
      
      try {
        logger.info(`Calculating compensation for ${format(currentDate, 'MMMM yyyy')}`);
        
        // Calculate compensation data
        const result = await calculatorFacade.calculateMonthlyCompensation(events, currentDate);
        
        // Check if the data has actually changed
        const dataString = JSON.stringify(result);
        if (dataString !== previousData.current) {
          logger.info(`Received ${result.length} compensation items - data changed`);
          setBreakdown(result);
          previousData.current = dataString;
        } else {
          logger.info('Compensation data unchanged, avoiding rerender');
        }
        
      } catch (error) {
        logger.error('Error calculating compensation:', error);
        setBreakdown([]);
      } finally {
        // Ensure loading state is cleared
        logger.info('Compensation calculation complete, hiding loading indicator');
        setLoadingDebounced(false);
        pendingCalculation.current = false;
      }
    };

    // Run the calculation
    calculateData();
    
  }, [events, currentDate, calculatorFacade, setLoadingDebounced]);

  // Extract breakdown data for the visualization
  const getCompensationData = useCallback((): CompensationData[] => {
    const oncallData = breakdown.find(item => item.type === 'oncall');
    const incidentData = breakdown.find(item => item.type === 'incident');
    const result: CompensationData[] = [];
    
    if (!oncallData && !incidentData) return [];
    
    if (oncallData) {
      // Check if there's description to extract details
      if (oncallData.description) {
        const oncallHours = extractHoursData(oncallData.description);
        const totalOncallHours = oncallHours.weekday + oncallHours.weekend;
        
        // Weekday on-call
        if (oncallHours.weekday > 0 && totalOncallHours > 0) {
          const weekdayProportion = oncallHours.weekday / totalOncallHours;
          const amount = oncallData.amount * weekdayProportion;
          result.push({
            type: 'Weekday On-Call',
            amount,
            color: '#3b82f6'
          });
        }
        
        // Weekend on-call
        if (oncallHours.weekend > 0 && totalOncallHours > 0) {
          const weekendProportion = oncallHours.weekend / totalOncallHours;
          const amount = oncallData.amount * weekendProportion;
          result.push({
            type: 'Weekend On-Call',
            amount,
            color: '#93c5fd'
          });
        }
      } else {
        // If no description, add the whole thing
        result.push({
          type: 'On-Call',
          amount: oncallData.amount,
          color: '#3b82f6'
        });
      }
    }
    
    if (incidentData) {
      // Check if there's description to extract details
      if (incidentData.description) {
        const hours = extractHoursData(incidentData.description);
        const totalIncidentHours = 
          hours.weekday + 
          hours.weekend + 
          hours.nightShift + 
          hours.weekendNight;
        
        // Only proceed with distribution if we have hours
        if (totalIncidentHours > 0) {
          // Weekday incidents
          if (hours.weekday > 0) {
            const proportion = hours.weekday / totalIncidentHours;
            const amount = incidentData.amount * proportion;
            result.push({
              type: 'Weekday Incident',
              amount,
              color: '#dc2626'
            });
          }
          
          // Weekend incidents
          if (hours.weekend > 0) {
            const proportion = hours.weekend / totalIncidentHours;
            const amount = incidentData.amount * proportion;
            result.push({
              type: 'Weekend Incident',
              amount,
              color: '#fca5a5'
            });
          }
          
          // Night shift incidents
          if (hours.nightShift > 0) {
            const proportion = hours.nightShift / totalIncidentHours;
            const amount = incidentData.amount * proportion;
            result.push({
              type: 'Night Shift Incident',
              amount,
              color: '#9f1239'
            });
          }
          
          // Weekend night incidents
          if (hours.weekendNight > 0) {
            const proportion = hours.weekendNight / totalIncidentHours;
            const amount = incidentData.amount * proportion;
            result.push({
              type: 'Weekend Night Incident',
              amount,
              color: '#f43f5e'
            });
          }
        }
      } else {
        // If no description, add the whole thing
        result.push({
          type: 'Incidents',
          amount: incidentData.amount,
          color: '#dc2626'
        });
      }
    }
    
    // Calculate percentages once we have all the data
    const totalAmount = result.reduce((sum, item) => sum + item.amount, 0);
    return result.map(item => ({
      ...item,
      percentage: (item.amount / totalAmount) * 100
    }));
  }, [breakdown]);
  
  // Generate month options for the selector
  const months = useMemo(() => {
    const result = [];
    // Add previous month
    const prevMonth = new Date(currentDate);
    prevMonth.setMonth(currentDate.getMonth() - 1);
    result.push(prevMonth);
    
    // Add current month
    result.push(new Date(currentDate));
    
    // Add next month
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(currentDate.getMonth() + 1);
    result.push(nextMonth);
    
    return result;
  }, [currentDate]);

  // For debugging
  useEffect(() => {
    logger.info(`CompensationSection render - loading: ${loading}, breakdown items: ${breakdown.length}`);
  });

  // Function to render the horizontal compensation bar
  const renderCompensationBar = () => {
    const compensationData = getCompensationData();
    
    if (compensationData.length === 0) return null;
    
    const totalAmount = compensationData.reduce((sum, item) => sum + item.amount, 0);
    
    return (
      <div>
        <CompensationBar>
          {compensationData.map((segment, index) => (
            <CompensationBarSegment
              key={`segment-${index}`}
              width={`${segment.percentage}%`}
              color={segment.color}
              onMouseEnter={(e) => showTooltipHook(
                e, 
                segment.type, 
                `€${segment.amount.toFixed(2)}`, 
                `${segment.percentage?.toFixed(1)}% of total`
              )}
              onMouseMove={updateTooltipPosition}
              onMouseLeave={hideTooltipHook}
            />
          ))}
        </CompensationBar>
        
        {/* Use SharedCompensationDisplay component */}
        <SharedCompensationDisplay 
          title="Compensation Breakdown by Category:"
          data={compensationData} 
        />
        
        <ActionButtonsContainer>
          <SharedButton 
            variant="secondary" 
            onClick={() => {
              setSidePanelContentForHook('events');
              setSidePanelTab('all');
              openSidePanelHook();
            }}
            fullWidth
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ListIcon />
              View all events
              <ChevronRightIcon />
            </div>
          </SharedButton>
          <SharedButton 
            variant="secondary" 
            onClick={() => {
              setSidePanelContentForHook('rates');
              openSidePanelHook();
            }}
            fullWidth
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarIcon />
              View compensation rates
              <ChevronRightIcon />
            </div>
          </SharedButton>
        </ActionButtonsContainer>
      </div>
    );
  };

  // Add new state for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Add handlers for delete confirmation
  const handleOpenDeleteModal = () => {
    setShowDeleteModal(true);
  };
  
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
  };
  
  const handleDeleteAllEvents = async () => {
    try {
      // You'll need to implement this based on your application's data structure
      // This is a placeholder assuming you have a service that can handle this
      logger.info(`Deleting all events for ${format(currentDate, 'MMMM yyyy')}`);
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Calculate start of month and end of month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      // Find all events that overlap with this month
      const eventsToDelete = events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        // Check if event overlaps with month
        return (
          (eventStart >= startOfMonth && eventStart <= endOfMonth) ||
          (eventEnd >= startOfMonth && eventEnd <= endOfMonth) ||
          (eventStart <= startOfMonth && eventEnd >= endOfMonth)
        );
      });
      
      // If using a storage service like localStorage or a database, you'd delete events here
      // For this example, I'll just log the number of events to delete
      logger.info(`Found ${eventsToDelete.length} events to delete`);
      
      // Then update the UI (this would typically be handled by your state management)
      // For example, you might dispatch an action to redux or use a context
      // setBreakdown([]);
      
      // Close the modal
      setShowDeleteModal(false);
      
      // Optional: Show success message
      alert(`Successfully removed ${eventsToDelete.length} events for ${format(currentDate, 'MMMM yyyy')}`);
      
    } catch (error) {
      logger.error('Error deleting events:', error);
      alert('An error occurred while trying to delete events');
    }
  };

  return (
    <>
      {/* Use shared Tooltip component */}
      <Tooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.content.title}
        value={tooltipState.content.value}
        extra={tooltipState.content.extra}
      />
      
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteModal onClick={handleCloseDeleteModal}>
          <DeleteModalContent onClick={e => e.stopPropagation()}>
            <DeleteModalTitle>Remove All Events for {format(currentDate, 'MMMM yyyy')}?</DeleteModalTitle>
            <DeleteModalMessage>
              This will permanently remove all events that overlap with {format(currentDate, 'MMMM yyyy')}. 
              This includes events that start in previous months or end in future months.
              This action cannot be undone.
            </DeleteModalMessage>
            <DeleteModalButtons>
              <CancelDeleteButton onClick={handleCloseDeleteModal}>
                Cancel
              </CancelDeleteButton>
              <ConfirmDeleteButton onClick={handleDeleteAllEvents}>
                Remove Events
              </ConfirmDeleteButton>
            </DeleteModalButtons>
          </DeleteModalContent>
        </DeleteModal>
      )}
      
      {/* Side panel for events and rates */}
      {isSidePanelOpen && (
        <>
          <SidePanelOverlay isOpen={isSidePanelOpen} onClick={closeSidePanelHook} />
          {sidePanelContentType === 'events' ? (
            <SidePanel isOpen={isSidePanelOpen}>
              <SidePanelHeader>
                <SidePanelTitle>Events</SidePanelTitle>
                <SidePanelCloseButton onClick={closeSidePanelHook}><XIcon /></SidePanelCloseButton>
              </SidePanelHeader>
              <SidePanelBody>
                <SidePanelTabs>
                  <SidePanelTab isActive={sidePanelTab === 'all'} onClick={() => setSidePanelTab('all')}>All Events</SidePanelTab>
                  <SidePanelTab isActive={sidePanelTab === 'oncall'} onClick={() => setSidePanelTab('oncall')}>On-Call</SidePanelTab>
                  <SidePanelTab isActive={sidePanelTab === 'incident'} onClick={() => setSidePanelTab('incident')}>Incidents</SidePanelTab>
                </SidePanelTabs>
                {(() => {
                  const oncallDataForPanel = breakdown.find(item => item.type === 'oncall');
                  const incidentDataForPanel = breakdown.find(item => item.type === 'incident');

                  const oncallEventsForPanel: SharedPanelEvent[] = (oncallDataForPanel?.events || []).map(e => ({ ...e, type: 'oncall', start: new Date(e.start), end: new Date(e.end) }));
                  const incidentEventsForPanel: SharedPanelEvent[] = (incidentDataForPanel?.events || []).map(e => ({ ...e, type: 'incident', start: new Date(e.start), end: new Date(e.end) }));
                  
                  return (
                    <SharedEventsPanelContent 
                      oncallEvents={oncallEventsForPanel}
                      incidentEvents={incidentEventsForPanel}
                      activeTab={sidePanelTab}
                    />
                  );
                })()}
                <DeleteEventsContainer>
                  <DeleteEventsButton onClick={handleOpenDeleteModal}>Remove All Events for {format(currentDate, 'MMMM yyyy')}</DeleteEventsButton>
                  <DeleteWarningText>Warning: This will permanently delete all events for this month.</DeleteWarningText>
                </DeleteEventsContainer>
              </SidePanelBody>
            </SidePanel>
          ) : (
            <RatesSidePanel isOpen={isSidePanelOpen}>
              <SidePanelHeader>
                <SidePanelTitle>Compensation Rates</SidePanelTitle>
                <SidePanelCloseButton onClick={closeSidePanelHook}><XIcon /></SidePanelCloseButton>
              </SidePanelHeader>
              <SidePanelBody>
                <SharedRatesPanelContent displayMode="full" />
              </SidePanelBody>
            </RatesSidePanel>
          )}
        </>
      )}
      
      <Section>
        <Title>Compensation Breakdown for {format(currentDate, 'MMMM yyyy')}</Title>
        <MonthSelector>
          <MonthButton onClick={() => onDateChange(months[0])}>
            Previous Month
          </MonthButton>
          {months.map(month => (
            <MonthButton
              key={month.toISOString()}
              onClick={() => onDateChange(month)}
              disabled={month.getTime() === currentDate.getTime()}
            >
              {format(month, 'MMMM yyyy')}
            </MonthButton>
          ))}
          <MonthButton onClick={() => onDateChange(months[2])}>
            Next Month
          </MonthButton>
        </MonthSelector>
        
        <Breakdown>
          <LoadingOverlay className={loading ? 'active' : ''}>
            Loading compensation data...
          </LoadingOverlay>
          
          {breakdown.length > 0 ? (
            breakdown.map((item, index) => (
              <BreakdownItem key={index}>
                <h3>{item.description}</h3>
                <p>Count: {item.count}</p>
                <div className="amount">€{item.amount.toFixed(2)}</div>
              </BreakdownItem>
            ))
          ) : (
            <EmptyMessage>No compensation data available for this month</EmptyMessage>
          )}
        </Breakdown>
        
        {/* Add the compensation visualization bar */}
        {breakdown.length > 0 && renderCompensationBar()}
      </Section>
    </>
  );
};

export default CompensationSection; 
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { CalendarEvent, EventTypes } from '../../../domain/calendar/entities/CalendarEvent';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { logger } from '../../../utils/logger';
import { 
  ChevronRightIcon, 
  ListIcon, 
  XIcon, 
  DollarIcon 
} from '../../../assets/icons';
import { 
  Button as SharedButton,
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
  SharedCompensationDisplay,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter
} from '../common/ui';
import SharedRatesPanelContent from '../common/SharedRatesPanelContent';
import SalaryManagement from './SalaryManagement';
import { useSidePanel, useTooltip } from '../../hooks';
import { useMonthDeletionHandler } from '../../hooks/useMonthDeletionHandler';

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

interface CompensationSectionProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onDataChange?: () => void;
  compensationData: CompensationBreakdown[];
  /** Bump after salary records load/change so the rates table re-reads hourly pay. */
  salaryRefreshKey?: number;
}

interface CompensationData {
  type: string;
  amount: number;
  color: string;
  percentage?: number;
}

const CompensationSection: React.FC<CompensationSectionProps> = ({
  events,
  currentDate,
  onDateChange,
  onDataChange,
  compensationData,
  salaryRefreshKey = 0,
}) => {
  
  // Filter compensationData for the currently viewed month
  const breakdown = useMemo(() => {
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();
    return compensationData.filter(item => {
      if (!item.month) return false;
      const itemMonth = item.month instanceof Date ? item.month : new Date(item.month);
      return itemMonth.getFullYear() === targetYear && itemMonth.getMonth() === targetMonth;
    });
  }, [compensationData, currentDate]);

  const { 
    isOpen: isSidePanelOpen,
    contentType: sidePanelContentType, 
    openPanel: openSidePanelHook,
    closePanel: closeSidePanelHook,
    setContent: setSidePanelContentForHook
  } = useSidePanel({ defaultContent: 'events' });
  
  const [sidePanelTab, setSidePanelTab] = useState<'all' | EventTypes.INCIDENT | EventTypes.ONCALL>('all');
  
  const {
    tooltipState,
    showTooltip: showTooltipHook,
    hideTooltip: hideTooltipHook,
    updateTooltipPosition
  } = useTooltip();
  
  const {
    isDeletingMonth,
    showConfirmDeleteMonthModal,
    monthPendingDeletion,
    initiateDeleteMonth,
    confirmDeleteMonth,
    cancelDeleteMonth,
    getNotificationProps,
  } = useMonthDeletionHandler({ 
    onDeletionSuccess: onDataChange,
    onBeforeSuccessNotification: closeSidePanelHook
  });

  const monthDeletionNotification = getNotificationProps();

  // Extract breakdown data for the visualization
  const getCompensationData = useCallback((): CompensationData[] => {
    const oncallData = breakdown.find(item => item.type === EventTypes.ONCALL);
    const incidentData = breakdown.find(item => item.type === EventTypes.INCIDENT);
    const result: CompensationData[] = [];
    
    if (!oncallData && !incidentData) return [];
    
    if (oncallData) {
      const hours = oncallData.hours;
      if (hours) {
        const totalOncallHours = hours.weekday + hours.weekend;
        
        if (hours.weekday > 0 && totalOncallHours > 0) {
          result.push({
            type: 'Weekday On-Call',
            amount: oncallData.amount * (hours.weekday / totalOncallHours),
            color: '#3b82f6'
          });
        }
        
        if (hours.weekend > 0 && totalOncallHours > 0) {
          result.push({
            type: 'Weekend On-Call',
            amount: oncallData.amount * (hours.weekend / totalOncallHours),
            color: '#93c5fd'
          });
        }
      } else {
        result.push({
          type: 'On-Call',
          amount: oncallData.amount,
          color: '#3b82f6'
        });
      }
    }
    
    if (incidentData) {
      const hours = incidentData.hours;
      if (hours) {
        const totalIncidentHours = hours.weekday + hours.weekend + hours.nightShift + hours.weekendNight;
        
        if (totalIncidentHours > 0) {
          if (hours.weekday > 0) {
            result.push({
              type: 'Weekday Incident',
              amount: incidentData.amount * (hours.weekday / totalIncidentHours),
              color: '#dc2626'
            });
          }
          
          if (hours.weekend > 0) {
            result.push({
              type: 'Weekend Incident',
              amount: incidentData.amount * (hours.weekend / totalIncidentHours),
              color: '#fca5a5'
            });
          }
          
          if (hours.nightShift > 0) {
            result.push({
              type: 'Night Shift Incident',
              amount: incidentData.amount * (hours.nightShift / totalIncidentHours),
              color: '#9f1239'
            });
          }
          
          if (hours.weekendNight > 0) {
            result.push({
              type: 'Weekend Night Incident',
              amount: incidentData.amount * (hours.weekendNight / totalIncidentHours),
              color: '#f43f5e'
            });
          }
        }
      } else {
        result.push({
          type: 'Incidents',
          amount: incidentData.amount,
          color: '#dc2626'
        });
      }
    }
    
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

  const handleInitiateDeleteMonthForPanel = useCallback(() => {
    initiateDeleteMonth(currentDate);
  }, [currentDate, initiateDeleteMonth]);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidePanelOpen) {
          closeSidePanelHook();
        } else if (showConfirmDeleteMonthModal) {
          cancelDeleteMonth();
        } else if (monthDeletionNotification?.visible) {
          monthDeletionNotification.onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isSidePanelOpen, closeSidePanelHook, showConfirmDeleteMonthModal, cancelDeleteMonth, monthDeletionNotification]);

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
      
      {/* Panel's Delete confirmation modal (driven by hook) */}
      {showConfirmDeleteMonthModal && monthPendingDeletion && (
        <Modal isOpen={showConfirmDeleteMonthModal} onClose={cancelDeleteMonth}>
          <ModalHeader>
            <ModalTitle>Remove All Events for {format(monthPendingDeletion, 'MMMM yyyy' )}?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p>
              This will permanently remove all events that overlap with {format(monthPendingDeletion, 'MMMM yyyy' )}. 
              This includes events that start in previous months or end in future months.
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <SharedButton variant="secondary" onClick={cancelDeleteMonth} disabled={isDeletingMonth}>
              Cancel
            </SharedButton>
            <SharedButton variant="danger" onClick={confirmDeleteMonth} disabled={isDeletingMonth}>
              Remove Events
            </SharedButton>
          </ModalFooter>
        </Modal>
      )}

      {/* Notification Modal for month deletion from hook */}
      {monthDeletionNotification && (
        <Modal isOpen={monthDeletionNotification.visible} onClose={monthDeletionNotification.onClose}>
          <ModalHeader><ModalTitle>{monthDeletionNotification.title}</ModalTitle></ModalHeader>
          <ModalBody><p>{monthDeletionNotification.message}</p></ModalBody>
          <ModalFooter><SharedButton variant="primary" onClick={monthDeletionNotification.onClose}>OK</SharedButton></ModalFooter>
        </Modal>
      )}
      
      {/* Side panel for events and rates - Restructured for persistent panel instances */}
      <>
        <SidePanelOverlay isOpen={isSidePanelOpen} onClick={closeSidePanelHook} />

        {/* Events Panel */}
        <SidePanel isOpen={isSidePanelOpen && sidePanelContentType === 'events'}>
          <SidePanelHeader>
            <SidePanelTitle>Events</SidePanelTitle>
            <SidePanelCloseButton onClick={closeSidePanelHook}><XIcon /></SidePanelCloseButton>
          </SidePanelHeader>
          <SidePanelBody>
            <SidePanelTabs>
              <SidePanelTab isActive={sidePanelTab === 'all'} onClick={() => setSidePanelTab('all')}>All Events</SidePanelTab>
              <SidePanelTab isActive={sidePanelTab === EventTypes.ONCALL} onClick={() => setSidePanelTab(EventTypes.ONCALL)}>On-Call</SidePanelTab>
              <SidePanelTab isActive={sidePanelTab === EventTypes.INCIDENT} onClick={() => setSidePanelTab(EventTypes.INCIDENT)}>Incidents</SidePanelTab>
            </SidePanelTabs>
            {(() => {
              const oncallDataForPanel = breakdown.find(item => item.type === EventTypes.ONCALL);
              const incidentDataForPanel = breakdown.find(item => item.type === EventTypes.INCIDENT);

              const oncallEventsForPanel: SharedPanelEvent[] = (oncallDataForPanel?.events || []).map(e => ({ ...e, type: EventTypes.ONCALL as const, start: new Date(e.start), end: new Date(e.end) }));
              const incidentEventsForPanel: SharedPanelEvent[] = (incidentDataForPanel?.events || []).map(e => ({ ...e, type: EventTypes.INCIDENT as const, start: new Date(e.start), end: new Date(e.end) }));
              
              return (
                <SharedEventsPanelContent 
                  oncallEvents={oncallEventsForPanel}
                  incidentEvents={incidentEventsForPanel}
                  activeTab={sidePanelTab}
                />
              );
            })()}
            <DeleteEventsContainer>
              <DeleteEventsButton onClick={handleInitiateDeleteMonthForPanel} disabled={isDeletingMonth}>
                Remove All Events for {format(currentDate, 'MMMM yyyy')}
              </DeleteEventsButton>
              <DeleteWarningText>Warning: This will permanently delete all events for this month.</DeleteWarningText>
            </DeleteEventsContainer>
          </SidePanelBody>
        </SidePanel>

        {/* Rates Panel */}
        <RatesSidePanel isOpen={isSidePanelOpen && sidePanelContentType === 'rates'}>
          <SidePanelHeader>
            <SidePanelTitle>Compensation Rates</SidePanelTitle>
            <SidePanelCloseButton onClick={closeSidePanelHook}><XIcon /></SidePanelCloseButton>
          </SidePanelHeader>
          <SidePanelBody>
            <SharedRatesPanelContent
              displayMode="full"
              referenceDate={currentDate}
              refreshKey={salaryRefreshKey}
            />
            <SalaryManagement onSalaryChange={onDataChange} />
          </SidePanelBody>
        </RatesSidePanel>
      </>
      
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

export default React.memo(CompensationSection); 
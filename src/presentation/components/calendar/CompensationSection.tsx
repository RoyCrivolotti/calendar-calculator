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
import { PaginationControls as SharedPaginationControls, Button as SharedButton } from '../common/ui';

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

const CompensationBreakdownSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0;
`;

const CompensationCategory = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  flex: 1;
  min-width: 180px;
`;

// Fix to remove title from props interface
const CategoryColor = styled.div<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
  flex-shrink: 0;
  margin-right: 0.25rem;
  position: relative;
`;

const CategoryAmount = styled.div`
  font-weight: 600;
  color: #0f172a;
  font-size: 1rem;
`;

const CategoryPercentage = styled.div`
  font-size: 0.75rem;
  color: #64748b;
`;

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  
  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

// Side panel styled components
const SidePanel = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 450px;
  max-width: 95vw;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
  z-index: 1010;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  @media (max-width: 768px) {
    width: 100%;
    max-width: 100%;
  }
`;

const SidePanelOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1005;
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const SidePanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SidePanelTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
`;

const SidePanelCloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #0f172a;
  padding: 0;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
  }
  
  svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 2px;
  }
`;

const SidePanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.25rem;
`;

const SidePanelTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem;
`;

const SidePanelTab = styled.button<{ isActive: boolean }>`
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid ${props => props.isActive ? '#3b82f6' : 'transparent'};
  color: ${props => props.isActive ? '#0f172a' : '#64748b'};
  font-weight: ${props => props.isActive ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    color: ${props => props.isActive ? '#0f172a' : '#334155'};
  }
`;

const EventItem = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const EventTimeContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const EventTime = styled.div`
  color: #334155;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EventMetadata = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
  justify-content: space-between;
`;

const HolidayIndicator = styled.span`
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 500;
`;

const EventDuration = styled.span`
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

// Update the EventBadge styled component to use soft colors
const EventBadge = styled.span<{ color: string }>`
  color: ${props => 
    props.color === '#3b82f6' ? '#0369a1' :  // Blue (On-Call) -> Darker blue text
    props.color === '#f43f5e' ? '#b91c1c' :  // Red (Incident) -> Darker red text
    '#0f172a'};
  background-color: ${props => 
    props.color === '#3b82f6' ? '#e0f2fe' :  // Blue (On-Call) -> Soft blue background
    props.color === '#f43f5e' ? '#fee2e2' :  // Red (Incident) -> Soft red background
    '#f1f5f9'};
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 0.5rem;
`;

const EventInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
`;

// Global tooltip
const GlobalTooltip = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  background: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  font-size: 14px;
  color: #000000;
  z-index: 99999;
  pointer-events: none;
  max-width: 200px;
  visibility: hidden; /* Start hidden */
  opacity: 0;
  transition: opacity 0.2s;
  
  &.visible {
    visibility: visible;
    opacity: 1;
  }
`;

const CompensationTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  table-layout: fixed;
  
  th, td {
    padding: 0.75rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    font-size: 0.875rem;
    vertical-align: top;
  }
  
  th {
    color: #64748b;
    font-weight: 500;
    background: #f8fafc;
    white-space: nowrap;
  }
  
  td {
    color: #334155;
  }
  
  /* Column widths */
  th:nth-of-type(1), td:nth-of-type(1) { width: 40%; }
  th:nth-of-type(2), td:nth-of-type(2) { width: 20%; }
  th:nth-of-type(3), td:nth-of-type(3) { width: 15%; }
  th:nth-of-type(4), td:nth-of-type(4) { width: 25%; }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background: #f8fafc;
  }
  
  @media (max-width: 768px) {
    th, td {
      padding: 0.5rem;
      font-size: 0.75rem;
    }
  }
`;

const MobileRatesContainer = styled.div`
  display: none;
  
  @media (max-width: 480px) {
    display: block;
  }
`;

const RatesSidePanel = styled(SidePanel)`
  width: 520px;
  
  @media (max-width: 768px) {
    width: 100%;
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

interface Event {
  id: string;
  type: 'oncall' | 'incident';
  start: Date;
  end: Date;
  isHoliday?: boolean;
}

// Type for compensation data breakdown
interface CompensationData {
  type: string;
  amount: number;
  color: string;
  percentage?: number;
}

// Add an interface for the custom event
interface OpenPanelEvent extends CustomEvent {
  detail: {
    type: 'events' | 'rates';
    date: Date;
  }
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
  
  // New side panel states
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelContent, setSidePanelContent] = useState<'events' | 'rates'>('events');
  const [sidePanelTab, setSidePanelTab] = useState<'all' | 'oncall' | 'incident'>('all');
  
  // Pagination states
  const [oncallPage, setOncallPage] = useState(1);
  const [incidentPage, setIncidentPage] = useState(1);
  const [allEventsPage, setAllEventsPage] = useState(1);
  
  // Global tooltip state
  const [globalTooltip, setGlobalTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: {
      title: '',
      value: '',
      extra: ''
    }
  });
  
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
  
  // Side panel handlers
  const openSidePanel = useCallback((content: 'events' | 'rates') => {
    setSidePanelContent(content);
    setSidePanelOpen(true);
    // Reset the tab to 'all' when opening
    setSidePanelTab('all');
    // Reset pagination
    setOncallPage(1);
    setIncidentPage(1);
    setAllEventsPage(1);
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
  }, []);
  
  // Handle ESC key to close side panel
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidePanelOpen) {
        closeSidePanel();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [sidePanelOpen, closeSidePanel]);
  
  // Tooltip handlers
  const showTooltip = useCallback((e: React.MouseEvent, title: string, value: string, extra: string) => {
    setGlobalTooltip({
      visible: true,
      x: e.clientX + 15,
      y: e.clientY + 15,
      content: {
        title,
        value,
        extra
      }
    });
  }, []);
  
  const hideTooltip = useCallback(() => {
    setGlobalTooltip(prev => ({
      ...prev,
      visible: false
    }));
  }, []);
  
  // Effect cleanup
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);
  
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
              onMouseEnter={(e) => showTooltip(
                e, 
                segment.type, 
                `€${segment.amount.toFixed(2)}`, 
                `${segment.percentage?.toFixed(1)}% of total`
              )}
              onMouseMove={(e) => setGlobalTooltip(prev => ({ 
                ...prev, 
                x: e.clientX + 15, 
                y: e.clientY + 15 
              }))}
              onMouseLeave={hideTooltip}
            />
          ))}
        </CompensationBar>
        
        <div style={{ marginTop: '0.75rem', marginBottom: '0.5rem', fontWeight: 500, color: '#64748b', fontSize: '0.9rem' }}>
          Compensation Breakdown by Category:
        </div>
        
        <CompensationBreakdownSection>
          {compensationData.map((segment, index) => (
            <CompensationCategory key={`category-${index}`}>
              <CategoryColor 
                color={segment.color}
                title={`Color indicator for ${segment.type}`}
              />
              <div>
                <div>
                  <span style={{ 
                    verticalAlign: 'middle', 
                    color: '#0f172a',
                    fontWeight: 500
                  }}>
                    {segment.type}
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    marginLeft: '0.5rem', 
                    padding: '0.1rem 0.3rem', 
                    background: segment.color, 
                    color: '#fff', 
                    borderRadius: '3px', 
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    fontWeight: 'bold'
                  }}>
                    {segment.type.includes('Weekend') ? 'WEEKEND' : 
                     segment.type.includes('Night') ? 'NIGHT SHIFT' : 'STANDARD'}
                  </span>
                </div>
                <CategoryAmount>€{segment.amount.toFixed(2)}</CategoryAmount>
                <CategoryPercentage>{segment.percentage?.toFixed(1)}% of total</CategoryPercentage>
              </div>
            </CompensationCategory>
          ))}
        </CompensationBreakdownSection>
        
        <ActionButtonsContainer>
          <SharedButton 
            variant="secondary" 
            onClick={() => openSidePanel('events')}
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
            onClick={() => openSidePanel('rates')}
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

  // Function to render events for the side panel
  const renderEventsList = () => {
    const oncallData = breakdown.find(item => item.type === 'oncall');
    const incidentData = breakdown.find(item => item.type === 'incident');
    
    if (!oncallData && !incidentData) {
      return (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
          No events found for this month
        </div>
      );
    }
    
    const events: Event[] = [];
    
    // Extract events from oncallData
    if (oncallData && oncallData.events) {
      const oncallEvents = oncallData.events;
      events.push(...oncallEvents.map(event => ({
        id: event.id,
        type: 'oncall' as const,
        start: event.start,
        end: event.end,
        isHoliday: event.isHoliday
      })));
    }
    
    // Extract events from incidentData
    if (incidentData && incidentData.events) {
      const incidentEvents = incidentData.events;
      events.push(...incidentEvents.map(event => ({
        id: event.id,
        type: 'incident' as const,
        start: event.start,
        end: event.end,
        isHoliday: event.isHoliday
      })));
    }
    
    // Sort all events chronologically by start date
    const sortedEvents = [...events].sort((a, b) => {
      const dateA = new Date(a.start).getTime();
      const dateB = new Date(b.start).getTime();
      return dateA - dateB;
    });
    
    // Group events by type
    const groupedEvents = {
      oncall: sortedEvents.filter(e => e.type === 'oncall'),
      incident: sortedEvents.filter(e => e.type === 'incident')
    };
    
    // Filter events based on the active tab
    const filteredOncallEvents = sidePanelTab !== 'all' 
      ? groupedEvents.oncall.filter(() => sidePanelTab === 'oncall')
      : groupedEvents.oncall;
    
    const filteredIncidentEvents = sidePanelTab !== 'all'
      ? groupedEvents.incident.filter(() => sidePanelTab === 'incident')
      : groupedEvents.incident;
    
    // Calculate pagination for on-call events
    const totalOncallPages = Math.ceil(filteredOncallEvents.length / EVENTS_PER_PAGE);
    const oncallStartIndex = (oncallPage - 1) * EVENTS_PER_PAGE;
    const oncallEndIndex = Math.min(oncallStartIndex + EVENTS_PER_PAGE, filteredOncallEvents.length);
    const paginatedOncallEvents = filteredOncallEvents.slice(oncallStartIndex, oncallEndIndex);
    
    // Calculate pagination for incident events
    const totalIncidentPages = Math.ceil(filteredIncidentEvents.length / EVENTS_PER_PAGE);
    const incidentStartIndex = (incidentPage - 1) * EVENTS_PER_PAGE;
    const incidentEndIndex = Math.min(incidentStartIndex + EVENTS_PER_PAGE, filteredIncidentEvents.length);
    const paginatedIncidentEvents = filteredIncidentEvents.slice(incidentStartIndex, incidentEndIndex);
    
    // Determine which events to show based on the active tab
    const showTab = (tab: 'all' | 'oncall' | 'incident') => sidePanelTab === tab || sidePanelTab === 'all';
    
    // Combined sorted list for the "All" tab
    const allEvents = sidePanelTab === 'all' 
      ? [...filteredOncallEvents, ...filteredIncidentEvents].sort((a, b) => {
          const dateA = new Date(a.start).getTime();
          const dateB = new Date(b.start).getTime();
          return dateA - dateB;
        })
      : [];
    
    // Pagination for all events
    const totalAllEventsPages = Math.ceil(allEvents.length / EVENTS_PER_PAGE);
    const allEventsStartIndex = (allEventsPage - 1) * EVENTS_PER_PAGE;
    const allEventsEndIndex = Math.min(allEventsStartIndex + EVENTS_PER_PAGE, allEvents.length);
    const paginatedAllEvents = allEvents.slice(allEventsStartIndex, allEventsEndIndex);
    
    return (
      <div>
        {/* When 'all' tab is active, show combined sorted list */}
        {sidePanelTab === 'all' && allEvents.length > 0 && (
          <div>
            {paginatedAllEvents.map(event => (
              <EventItem key={event.id}>
                <EventTimeContainer>
                  <EventTime>
                    <CalendarIcon />
                    {format(new Date(event.start), 'MMM d, HH:mm')} - 
                    {event.type === 'incident' 
                      ? format(new Date(event.end), 'HH:mm')
                      : format(new Date(event.end), 'MMM d, HH:mm')
                    }
                  </EventTime>
                  {event.type === 'oncall' && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.15rem 0.4rem', 
                      background: '#e0f2fe', 
                      color: '#0369a1',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      On-Call
                    </span>
                  )}
                  {event.type === 'incident' && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '0.15rem 0.4rem', 
                      background: '#fee2e2', 
                      color: '#b91c1c',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      Incident
                    </span>
                  )}
                </EventTimeContainer>
                <EventMetadata>
                  <EventDuration>
                    <ClockIcon />
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </EventDuration>
                  {event.isHoliday && <HolidayIndicator>Holiday</HolidayIndicator>}
                </EventMetadata>
              </EventItem>
            ))}
            
            {/* Use the shared pagination controls component */}
            {totalAllEventsPages > 1 && (
              <SharedPaginationControls
                currentPage={allEventsPage}
                totalPages={totalAllEventsPages}
                totalItems={allEvents.length}
                itemsPerPage={EVENTS_PER_PAGE}
                onPageChange={setAllEventsPage}
              />
            )}
          </div>
        )}
        
        {/* When 'oncall' tab is active, show oncall events */}
        {showTab('oncall') && paginatedOncallEvents.length > 0 && (
          <div>
            {paginatedOncallEvents.map(event => (
              <EventItem key={event.id}>
                <EventTimeContainer>
                  <EventTime>
                    <CalendarIcon />
                    {format(new Date(event.start), 'MMM d, HH:mm')} - 
                    {format(new Date(event.end), 'MMM d, HH:mm')}
                  </EventTime>
                  <EventBadge color="#3b82f6">On-Call</EventBadge>
                </EventTimeContainer>
                <EventInfo>
                  <EventDuration>
                    <ClockIcon />
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </EventDuration>
                </EventInfo>
              </EventItem>
            ))}
            
            {/* Use shared pagination controls for oncall events */}
            {filteredOncallEvents.length > EVENTS_PER_PAGE && (
              <SharedPaginationControls
                currentPage={oncallPage}
                totalPages={totalOncallPages}
                totalItems={filteredOncallEvents.length}
                itemsPerPage={EVENTS_PER_PAGE}
                onPageChange={setOncallPage}
              />
            )}
          </div>
        )}
        
        {/* When 'incident' tab is active, show incident events */}
        {showTab('incident') && paginatedIncidentEvents.length > 0 && (
          <div>
            {paginatedIncidentEvents.map(event => (
              <EventItem key={event.id}>
                <EventTimeContainer>
                  <EventTime>
                    <CalendarIcon />
                    {format(new Date(event.start), 'MMM d, HH:mm')} - 
                    {format(new Date(event.end), 'HH:mm')}
                  </EventTime>
                  <EventBadge color="#f43f5e">Incident</EventBadge>
                </EventTimeContainer>
                <EventInfo>
                  <EventDuration>
                    <ClockIcon />
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </EventDuration>
                </EventInfo>
              </EventItem>
            ))}
            
            {/* Use shared pagination controls for incident events */}
            {filteredIncidentEvents.length > EVENTS_PER_PAGE && (
              <SharedPaginationControls
                currentPage={incidentPage}
                totalPages={totalIncidentPages}
                totalItems={filteredIncidentEvents.length}
                itemsPerPage={EVENTS_PER_PAGE}
                onPageChange={setIncidentPage}
              />
            )}
          </div>
        )}
        
        {/* No events message */}
        {((sidePanelTab === 'all' && allEvents.length === 0) ||
          (sidePanelTab === 'oncall' && filteredOncallEvents.length === 0) ||
          (sidePanelTab === 'incident' && filteredIncidentEvents.length === 0)) && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
            No events found for this month
          </div>
        )}
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

  // Add event listener for opening panels from MonthlyCompensationSummary
  useEffect(() => {
    const handleOpenPanel = (e: CustomEvent) => {
      const { type, date } = (e as OpenPanelEvent).detail;
      
      // If we need to change the date first
      if (date && date.getTime() !== currentDate.getTime()) {
        onDateChange(date);
      }
      
      // Open the side panel with the requested content
      setSidePanelContent(type as 'events' | 'rates');
      setSidePanelOpen(true);
      
      // If events panel, reset to 'all' tab
      if (type === 'events') {
        setSidePanelTab('all');
      }
    };
    
    window.addEventListener('openCompensationPanel', handleOpenPanel as EventListener);
    
    return () => {
      window.removeEventListener('openCompensationPanel', handleOpenPanel as EventListener);
    };
  }, [currentDate, onDateChange]);

  return (
    <>
      {/* Global tooltip */}
      <GlobalTooltip 
        className={globalTooltip.visible ? 'visible' : ''}
        style={{ 
          top: `${globalTooltip.y}px`, 
          left: `${globalTooltip.x}px` 
        }}
      >
        <div style={{ fontWeight: 'bold' }}>{globalTooltip.content.title}</div>
        <div>{globalTooltip.content.value}</div>
        <div>{globalTooltip.content.extra}</div>
      </GlobalTooltip>
      
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
      <SidePanelOverlay isOpen={sidePanelOpen} onClick={closeSidePanel} />
      
      {sidePanelContent === 'rates' ? (
        <RatesSidePanel isOpen={sidePanelOpen}>
          <SidePanelHeader>
            <SidePanelTitle>
              Compensation Rates
            </SidePanelTitle>
            <SidePanelCloseButton onClick={closeSidePanel}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </SidePanelCloseButton>
          </SidePanelHeader>
          
          <SidePanelBody>
            <div>
              <div className="desktop-table" style={{ display: 'block' }}>
                <CompensationTable>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Rate</th>
                      <th>Multiplier</th>
                      <th>Effective</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Weekday On-Call (non-office hours)</td>
                      <td>€3.90/hour</td>
                      <td>-</td>
                      <td>€3.90/hour</td>
                    </tr>
                    <tr>
                      <td>Weekend On-Call</td>
                      <td>€7.34/hour</td>
                      <td>-</td>
                      <td>€7.34/hour</td>
                    </tr>
                    <tr>
                      <td>Weekday Incident</td>
                      <td>€33.50/hour</td>
                      <td>1.8×</td>
                      <td>€60.30/hour</td>
                    </tr>
                    <tr>
                      <td>Weekend Incident</td>
                      <td>€33.50/hour</td>
                      <td>2.0×</td>
                      <td>€67.00/hour</td>
                    </tr>
                    <tr>
                      <td>Night Shift (additional)</td>
                      <td>-</td>
                      <td>1.4×</td>
                      <td>+40% bonus</td>
                    </tr>
                  </tbody>
                </CompensationTable>
              </div>
              
              {/* Mobile-friendly version that only shows on smaller screens */}
              <MobileRatesContainer>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekday On-Call (non-office hours)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Rate: €3.90/hour</span>
                    <span>Effective: €3.90/hour</span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekend On-Call</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Rate: €7.34/hour</span>
                    <span>Effective: €7.34/hour</span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekday Incident</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base: €33.50/hour</span>
                    <span>Mult: 1.8×</span>
                  </div>
                  <div>Effective: €60.30/hour</div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekend Incident</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Base: €33.50/hour</span>
                    <span>Mult: 2.0×</span>
                  </div>
                  <div>Effective: €67.00/hour</div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Night Shift (additional)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Multiplier: 1.4×</span>
                    <span>Effect: +40%</span>
                  </div>
                </div>
              </MobileRatesContainer>
            </div>
          </SidePanelBody>
        </RatesSidePanel>
      ) : (
        <SidePanel isOpen={sidePanelOpen}>
          <SidePanelHeader>
            <SidePanelTitle>
              Events for {format(currentDate, 'MMMM yyyy')}
            </SidePanelTitle>
            <SidePanelCloseButton onClick={closeSidePanel}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </SidePanelCloseButton>
          </SidePanelHeader>
          
          <SidePanelBody>
            <SidePanelTabs>
              <SidePanelTab 
                isActive={sidePanelTab === 'all'} 
                onClick={() => setSidePanelTab('all')}
              >
                All Events
              </SidePanelTab>
              <SidePanelTab 
                isActive={sidePanelTab === 'oncall'} 
                onClick={() => setSidePanelTab('oncall')}
              >
                On-Call
              </SidePanelTab>
              <SidePanelTab 
                isActive={sidePanelTab === 'incident'} 
                onClick={() => setSidePanelTab('incident')}
              >
                Incidents
              </SidePanelTab>
            </SidePanelTabs>
            
            {renderEventsList()}
            
            {/* Add Delete Events button to the bottom of the panel */}
            <DeleteEventsContainer>
              <DeleteEventsButton onClick={handleOpenDeleteModal}>
                Remove All Events for {format(currentDate, 'MMMM yyyy')}
              </DeleteEventsButton>
              <DeleteWarningText>
                Warning: This will permanently delete all events for this month.
              </DeleteWarningText>
            </DeleteEventsContainer>
          </SidePanelBody>
        </SidePanel>
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
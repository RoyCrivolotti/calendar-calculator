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

const CategoryColor = styled.div<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
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

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: white;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  svg {
    color: #3b82f6;
  }
`;

// Side panel styled components
const SidePanel = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  max-width: 90vw;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
  z-index: 1010;
  display: flex;
  flex-direction: column;
  
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
  color: #64748b;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
  }
`;

const SidePanelBody = styled.div`
  flex: 1;
  overflow-y: auto;
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

// Event list styled components for side panel
const EventSection = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const EventTypeName = styled.h4`
  color: #475569;
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EventCount = styled.span`
  font-size: 0.8rem;
  font-weight: 400;
  color: #64748b;
  margin-left: 0.5rem;
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
  gap: 0.75rem;
`;

const EventTime = styled.span`
  color: #334155;
  font-size: 0.875rem;
  display: block;
`;

const EventMetadata = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
`;

const EventDuration = styled.span`
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const HolidayIndicator = styled.span`
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const PageInfo = styled.div`
  font-size: 0.8rem;
  color: #64748b;
`;

const PageButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PageButton = styled.button<{ disabled?: boolean }>`
  padding: 0.25rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: ${props => props.disabled ? '#f8fafc' : 'white'};
  color: ${props => props.disabled ? '#cbd5e1' : '#0f172a'};
  font-size: 0.8rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.disabled ? '#f8fafc' : '#f1f5f9'};
    border-color: ${props => props.disabled ? '#e2e8f0' : '#cbd5e1'};
  }
`;

const PageNumber = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  padding: 0 0.25rem;
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
  
  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  
  th {
    color: #64748b;
    font-weight: 500;
    font-size: 0.875rem;
    background: #f8fafc;
  }
  
  td {
    color: #334155;
    font-size: 0.9rem;
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background: #f8fafc;
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
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
  }, []);
  
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
  
  // Helper function to extract hours from the description
  const extractHoursData = (description: string): { weekday: number, weekend: number, nightShift: number, weekendNight: number } => {
    try {
      const match = description.match(/\((.+?)\)/);
      if (!match) return { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
      
      const parts = match[1].split(',').map(s => s.trim());
      
      const result = { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
      
      parts.forEach(part => {
        const [hoursStr, ...typeParts] = part.split(' ');
        const type = typeParts.join(' '); // Rejoin in case there are spaces in the type
        const hours = parseFloat(hoursStr);
        
        if (type.includes('weekday') && !type.includes('night')) {
          result.weekday = hours;
        } else if (type.includes('weekend') && !type.includes('night')) {
          result.weekend = hours;
        } else if (type.includes('weekday') && type.includes('night')) {
          result.nightShift = hours;
        } else if (type.includes('weekend') && type.includes('night')) {
          result.weekendNight = hours;
        }
      });
      
      return result;
    } catch (error) {
      logger.error('Error parsing hours:', error);
      return { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    }
  };
  
  // Function to format duration
  const formatDuration = (start: Date, end: Date) => {
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

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
        
        <CompensationBreakdownSection>
          {compensationData.map((segment, index) => (
            <CompensationCategory key={`category-${index}`}>
              <CategoryColor color={segment.color} />
              <div>
                <div>{segment.type}</div>
                <CategoryAmount>€{segment.amount.toFixed(2)}</CategoryAmount>
                <CategoryPercentage>{segment.percentage?.toFixed(1)}% of total</CategoryPercentage>
              </div>
            </CompensationCategory>
          ))}
        </CompensationBreakdownSection>
        
        <ActionButtonsContainer>
          <ActionButton onClick={() => openSidePanel('events')}>
            <ListIcon />
            View all events
            <ChevronRightIcon />
          </ActionButton>
          <ActionButton onClick={() => openSidePanel('rates')}>
            <DollarIcon />
            View compensation rates
            <ChevronRightIcon />
          </ActionButton>
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
    
    // Group events by type
    const groupedEvents = {
      oncall: events.filter(e => e.type === 'oncall'),
      incident: events.filter(e => e.type === 'incident')
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
    
    const showTab = (tab: 'all' | 'oncall' | 'incident') => sidePanelTab === tab || sidePanelTab === 'all';
    
    return (
      <div>
        {/* On-Call Shifts */}
        {showTab('oncall') && filteredOncallEvents.length > 0 && (
          <EventSection>
            <EventTypeName>
              <PhoneIcon /> 
              On-Call Shifts
              <EventCount>{filteredOncallEvents.length} events</EventCount>
            </EventTypeName>
            
            {paginatedOncallEvents.map(event => (
              <EventItem key={event.id}>
                <EventTimeContainer>
                  <CalendarIcon />
                  <EventTime>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'MMM d, HH:mm')}
                  </EventTime>
                </EventTimeContainer>
                <EventMetadata>
                  {event.isHoliday && <HolidayIndicator>Holiday</HolidayIndicator>}
                  <EventDuration>
                    <ClockIcon />
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </EventDuration>
                </EventMetadata>
              </EventItem>
            ))}
            
            {/* Pagination controls for on-call events */}
            {totalOncallPages > 1 && (
              <PaginationControls>
                <PageInfo>
                  Showing {oncallStartIndex + 1}-{oncallEndIndex} of {filteredOncallEvents.length}
                </PageInfo>
                <PageButtons>
                  <PageButton 
                    disabled={oncallPage === 1}
                    onClick={() => setOncallPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </PageButton>
                  <PageNumber>{oncallPage} / {totalOncallPages}</PageNumber>
                  <PageButton 
                    disabled={oncallPage === totalOncallPages}
                    onClick={() => setOncallPage(prev => Math.min(prev + 1, totalOncallPages))}
                  >
                    Next
                  </PageButton>
                </PageButtons>
              </PaginationControls>
            )}
          </EventSection>
        )}
        
        {/* Incidents */}
        {showTab('incident') && filteredIncidentEvents.length > 0 && (
          <EventSection>
            <EventTypeName>
              <AlertIcon />
              Incidents
              <EventCount>{filteredIncidentEvents.length} events</EventCount>
            </EventTypeName>
            
            {paginatedIncidentEvents.map(event => (
              <EventItem key={event.id}>
                <EventTimeContainer>
                  <CalendarIcon />
                  <EventTime>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                  </EventTime>
                </EventTimeContainer>
                <EventMetadata>
                  {event.isHoliday && <HolidayIndicator>Holiday</HolidayIndicator>}
                  <EventDuration>
                    <ClockIcon />
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </EventDuration>
                </EventMetadata>
              </EventItem>
            ))}
            
            {/* Pagination controls for incident events */}
            {totalIncidentPages > 1 && (
              <PaginationControls>
                <PageInfo>
                  Showing {incidentStartIndex + 1}-{incidentEndIndex} of {filteredIncidentEvents.length}
                </PageInfo>
                <PageButtons>
                  <PageButton 
                    disabled={incidentPage === 1}
                    onClick={() => setIncidentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </PageButton>
                  <PageNumber>{incidentPage} / {totalIncidentPages}</PageNumber>
                  <PageButton 
                    disabled={incidentPage === totalIncidentPages}
                    onClick={() => setIncidentPage(prev => Math.min(prev + 1, totalIncidentPages))}
                  >
                    Next
                  </PageButton>
                </PageButtons>
              </PaginationControls>
            )}
          </EventSection>
        )}
        
        {filteredOncallEvents.length === 0 && filteredIncidentEvents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
            No events found for this month
          </div>
        )}
      </div>
    );
  };

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
      
      {/* Side panel for events and rates */}
      <SidePanelOverlay isOpen={sidePanelOpen} onClick={closeSidePanel} />
      <SidePanel isOpen={sidePanelOpen}>
        <SidePanelHeader>
          <SidePanelTitle>
            {sidePanelContent === 'events' 
              ? `Events for ${format(currentDate, 'MMMM yyyy')}` 
              : 'Compensation Rates'}
          </SidePanelTitle>
          <SidePanelCloseButton onClick={closeSidePanel}>
            <XIcon />
          </SidePanelCloseButton>
        </SidePanelHeader>
        
        <SidePanelBody>
          {sidePanelContent === 'events' && (
            <>
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
            </>
          )}
          
          {sidePanelContent === 'rates' && (
            <div>
              <h3 style={{ 
                color: '#334155', 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                margin: '0 0 1rem 0',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #e2e8f0'
              }}>
                Compensation Rates
              </h3>
              
              <CompensationTable>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Rate</th>
                    <th>Multiplier</th>
                    <th>Effective Rate</th>
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
          )}
        </SidePanelBody>
      </SidePanel>
      
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
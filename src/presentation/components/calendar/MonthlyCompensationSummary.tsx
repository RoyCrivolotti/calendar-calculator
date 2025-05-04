import React, { useState, useRef, useMemo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { storageService } from '../../services/storage';
import { logger } from '../../../utils/logger';
import { createMonthDate } from '../../../utils/calendarUtils';

const Container = styled.div`
  width: 93%;
  margin: 2rem auto;
  position: relative;
  min-height: 120px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border: 2px solid #e2e8f0;
`;

const ScrollContainer = styled.div`
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 1rem 0;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const MonthBox = styled.button<{ isSelected: boolean }>`
  min-width: 120px;
  height: 80px;
  border: 2px solid ${props => props.isSelected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.isSelected ? '#3b82f6' : '#1e293b'};
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 0.5rem;

  &:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
`;

const MonthTitle = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

const MonthValue = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
`;

const ScrollButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    border-color: #3b82f6;
  }

  &.left {
    left: -20px;
  }

  &.right {
    right: -20px;
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  color: #1e293b;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
`;

const ModalTitle = styled.h2`
  color: #0f172a;
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
`;

const MonthAmount = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
  background: #f0f9ff;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #bae6fd;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.25rem;
  color: #64748b;

  &:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
`;

const SummarySection = styled.div`
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const SummaryCard = styled.div`
  flex: 1;
  background: #f8fafc;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SummaryTitle = styled.h3`
  color: #334155;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SummaryLabel = styled.span`
  color: #64748b;
  font-size: 0.9rem;
`;

const SummaryValue = styled.span`
  color: #0f172a;
  font-weight: 500;
  font-size: 1rem;
`;

const TotalRow = styled(SummaryRow)`
  font-weight: 600;
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
  
  ${SummaryValue} {
    font-size: 1.1rem;
    color: #0369a1;
  }
`;

const DetailSection = styled.div`
  margin-top: 2rem;
`;

const DetailTitle = styled.h3`
  color: #334155;
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #f1f5f9;
`;

const EventTypeTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const EventTypeTab = styled.button<{ isActive: boolean }>`
  padding: 0.75rem 1.25rem;
  border: none;
  background: ${props => props.isActive ? '#e0f2fe' : 'transparent'};
  color: ${props => props.isActive ? '#0369a1' : '#64748b'};
  font-weight: ${props => props.isActive ? '600' : '500'};
  font-size: 0.9rem;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid ${props => props.isActive ? '#0369a1' : 'transparent'};
  
  &:hover {
    color: ${props => props.isActive ? '#0369a1' : '#0f172a'};
    background: ${props => props.isActive ? '#e0f2fe' : '#f8fafc'};
  }
`;

const BreakdownCard = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const StatLabel = styled.div`
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const StatValue = styled.div`
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
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

const ChartContainer = styled.div`
  margin: 2rem 0;
  padding: 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const BarChartContainer = styled.div`
  height: 200px;
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 0;
`;

const Bar = styled.div<{ height: string, color: string }>`
  flex: 1;
  height: ${props => props.height};
  background: ${props => props.color};
  border-radius: 6px 6px 0 0;
  position: relative;
  min-width: 30px;
  transition: height 0.3s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:before {
    content: attr(data-value);
    position: absolute;
    top: -24px;
    left: 50%;
    transform: translateX(-50%);
    color: #334155;
    font-weight: 600;
    font-size: 0.8rem;
  }
  
  &:after {
    content: attr(data-label);
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    color: #64748b;
    font-size: 0.8rem;
    white-space: nowrap;
  }
`;

const ClearDataSection = styled.div`
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ClearDataButton = styled.button`
  background-color: #d9534f;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #c9302c;
  }
`;

const ClearDataWarning = styled.p`
  color: #d9534f;
  font-size: 12px;
  margin-top: 8px;
`;

// Updated modal content for confirmation dialog
const ConfirmModalContent = styled(ModalContent)`
  max-width: 450px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ConfirmTitle = styled.h3`
  color: #d9534f;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  font-weight: bold;
`;

const ConfirmMessage = styled.p`
  margin-bottom: 2rem;
  font-size: 1rem;
  line-height: 1.5;
`;

const ConfirmButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;

const CancelButton = styled.button`
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #5a6268;
  }
`;

const ConfirmButton = styled.button`
  background-color: #d9534f;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #c9302c;
  }
`;

const Legend = styled.div`
  display: flex;
  gap: 1.5rem;
  margin-top: 2rem;
  justify-content: center;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
`;

const LegendColor = styled.div<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
`;

interface MonthData {
  date: Date;
  data: CompensationBreakdown[];
}

interface MonthlyCompensationSummaryProps {
  data: CompensationBreakdown[];
}

const MonthlyCompensationSummary: React.FC<MonthlyCompensationSummaryProps> = ({ data }) => {
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate list of months (last 12 months)
  const monthsWithData = useMemo(() => {
    const result: MonthData[] = [];
    
    logger.debug('Monthly Summary Data:', data);
    
    // Get unique months from data
    const months = new Set<string>();
    data.forEach(d => {
      if (d.type === 'total' && d.month) {
        try {
          // Ensure month is treated as a Date object
          const monthDate = d.month instanceof Date ? d.month : new Date(d.month);
          const monthKey = monthDate.toISOString();
          months.add(monthKey);
          logger.debug(`Found month: ${monthDate.toLocaleString()} from ${d.type} with amount ${d.amount}`);
        } catch (error) {
          logger.error('Error processing month:', d.month, error);
        }
      }
    });

    logger.info(`Found ${months.size} unique months`);

    // Add months with data
    Array.from(months).forEach(monthKey => {
      const monthData = data.filter(d => {
        if (d.month) {
          try {
            const monthDate = d.month instanceof Date ? d.month : new Date(d.month);
            return monthDate.toISOString() === monthKey;
          } catch (error) {
            return false;
          }
        }
        return false;
      });
      
      if (monthData.length > 0) {
        const monthDate = new Date(monthKey);
        logger.debug(`Adding month ${monthDate.toLocaleDateString()} with ${monthData.length} records`);
        result.push({
          date: monthDate,
          data: monthData
        });
      }
    });

    // Sort by date, most recent first
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const handleMonthClick = (month: Date) => {
    setSelectedMonth(month);
    setActiveTab('all');
  };

  const handleCloseModal = () => {
    setSelectedMonth(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const handleClearAllData = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmClear = async () => {
    try {
      await storageService.clearAllData();
      // Reload the page to reflect the cleared data
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. See console for details.');
    } finally {
      setShowConfirmModal(false);
    }
  };

  const handleCancelClear = () => {
    setShowConfirmModal(false);
  };

  // Filter data for the selected month
  const selectedMonthData = useMemo(() => {
    if (!selectedMonth) return [];
    
    return data.filter(comp => {
      if (!comp.month) return false;
      const compMonth = comp.month instanceof Date ? comp.month : new Date(comp.month);
      return (
        compMonth.getFullYear() === selectedMonth.getFullYear() && 
        compMonth.getMonth() === selectedMonth.getMonth()
      );
    });
  }, [selectedMonth, data]);

  // Separate data by type
  const oncallData = useMemo(() => 
    selectedMonthData.filter(item => item.type === 'oncall'), 
    [selectedMonthData]
  );

  const incidentData = useMemo(() => 
    selectedMonthData.filter(item => item.type === 'incident'), 
    [selectedMonthData]
  );

  const totalData = useMemo(() => 
    selectedMonthData.filter(item => item.type === 'total'), 
    [selectedMonthData]
  );

  // Extract hours from description for visualization
  const extractHoursData = (description: string): { weekday: number, weekend: number, nightShift?: number, weekendNight?: number } => {
    try {
      const match = description.match(/\((.+?)\)/);
      if (!match) return { weekday: 0, weekend: 0 };
      
      const parts = match[1].split(',').map(s => s.trim());
      
      const result = { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
      
      parts.forEach(part => {
        const [hoursStr, type] = part.split(' ');
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
      console.error('Error parsing hours:', error);
      return { weekday: 0, weekend: 0 };
    }
  };

  // Get the total amount for the selected month
  const monthTotal = totalData.length > 0 ? totalData[0].amount : 0;

  // Calculate percentage for each category
  const getPercentage = (amount: number): string => {
    if (!monthTotal) return '0%';
    return `${Math.round((amount / monthTotal) * 100)}%`;
  };

  // Render the bar chart for hours breakdown
  const renderHoursChart = () => {
    const oncallHours = oncallData.length > 0 ? extractHoursData(oncallData[0].description) : { weekday: 0, weekend: 0 };
    const incidentHours = incidentData.length > 0 ? extractHoursData(incidentData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    const maxHours = Math.max(
      oncallHours.weekday,
      oncallHours.weekend,
      incidentHours.weekday,
      incidentHours.weekend,
      incidentHours.nightShift || 0,
      incidentHours.weekendNight || 0
    );
    
    if (maxHours === 0) return null;
    
    const calculateHeight = (hours: number) => `${Math.max((hours / maxHours) * 180, 10)}px`;
    
    return (
      <ChartContainer>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>Hours Breakdown</h3>
        <BarChartContainer>
          {oncallHours.weekday > 0 && (
            <Bar 
              height={calculateHeight(oncallHours.weekday)} 
              color="#60a5fa" 
              data-value={`${oncallHours.weekday}h`} 
              data-label="Weekday On-Call"
            />
          )}
          {oncallHours.weekend > 0 && (
            <Bar 
              height={calculateHeight(oncallHours.weekend)} 
              color="#93c5fd" 
              data-value={`${oncallHours.weekend}h`} 
              data-label="Weekend On-Call"
            />
          )}
          {incidentHours.weekday > 0 && (
            <Bar 
              height={calculateHeight(incidentHours.weekday)} 
              color="#f87171" 
              data-value={`${incidentHours.weekday}h`} 
              data-label="Weekday Incident"
            />
          )}
          {incidentHours.weekend > 0 && (
            <Bar 
              height={calculateHeight(incidentHours.weekend)} 
              color="#fca5a5" 
              data-value={`${incidentHours.weekend}h`} 
              data-label="Weekend Incident"
            />
          )}
          {incidentHours.nightShift && incidentHours.nightShift > 0 && (
            <Bar 
              height={calculateHeight(incidentHours.nightShift)} 
              color="#fb7185" 
              data-value={`${incidentHours.nightShift}h`} 
              data-label="Night Shift Incident"
            />
          )}
          {incidentHours.weekendNight && incidentHours.weekendNight > 0 && (
            <Bar 
              height={calculateHeight(incidentHours.weekendNight)} 
              color="#f43f5e" 
              data-value={`${incidentHours.weekendNight}h`} 
              data-label="Weekend Night Incident"
            />
          )}
        </BarChartContainer>
        <Legend>
          <LegendItem>
            <LegendColor color="#60a5fa" />
            <span>Weekday On-Call</span>
          </LegendItem>
          <LegendItem>
            <LegendColor color="#93c5fd" />
            <span>Weekend On-Call</span>
          </LegendItem>
          <LegendItem>
            <LegendColor color="#f87171" />
            <span>Weekday Incident</span>
          </LegendItem>
          <LegendItem>
            <LegendColor color="#fca5a5" />
            <span>Weekend Incident</span>
          </LegendItem>
        </Legend>
      </ChartContainer>
    );
  };

  return (
    <Container>
      <ScrollButton className="left" onClick={scrollLeft}>←</ScrollButton>
      <ScrollContainer ref={scrollContainerRef}>
        {monthsWithData.map(({ date, data }) => (
          <MonthBox
            key={date.toISOString()}
            isSelected={selectedMonth?.getTime() === date.getTime()}
            onClick={() => handleMonthClick(date)}
          >
            <MonthTitle>{format(date, 'MMMM yyyy')}</MonthTitle>
            <MonthValue>
              {data.find(d => d.type === 'total')?.amount.toFixed(2)}€
            </MonthValue>
          </MonthBox>
        ))}
      </ScrollContainer>
      <ScrollButton className="right" onClick={scrollRight}>→</ScrollButton>

      {selectedMonth && (
        <Modal onClick={handleCloseModal}>
          <ModalContent onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
            <CloseButton onClick={handleCloseModal}>×</CloseButton>
            
            <ModalHeader>
              <ModalTitle>{format(selectedMonth, 'MMMM yyyy')}</ModalTitle>
              <MonthAmount>€{monthTotal.toFixed(2)}</MonthAmount>
            </ModalHeader>
            
            <SummarySection>
              {oncallData.length > 0 && (
                <SummaryCard>
                  <SummaryTitle>On-Call Summary</SummaryTitle>
                  <SummaryRow>
                    <SummaryLabel>Number of Shifts</SummaryLabel>
                    <SummaryValue>{oncallData[0].count}</SummaryValue>
                  </SummaryRow>
                  <SummaryRow>
                    <SummaryLabel>Weekday Hours</SummaryLabel>
                    <SummaryValue>{extractHoursData(oncallData[0].description).weekday}h</SummaryValue>
                  </SummaryRow>
                  <SummaryRow>
                    <SummaryLabel>Weekend Hours</SummaryLabel>
                    <SummaryValue>{extractHoursData(oncallData[0].description).weekend}h</SummaryValue>
                  </SummaryRow>
                  <TotalRow>
                    <SummaryLabel>Total Compensation</SummaryLabel>
                    <SummaryValue>€{oncallData[0].amount.toFixed(2)}</SummaryValue>
                  </TotalRow>
                  <SummaryRow>
                    <SummaryLabel>Percentage of Total</SummaryLabel>
                    <SummaryValue>{getPercentage(oncallData[0].amount)}</SummaryValue>
                  </SummaryRow>
                </SummaryCard>
              )}
              
              {incidentData.length > 0 && (
                <SummaryCard>
                  <SummaryTitle>Incident Summary</SummaryTitle>
                  <SummaryRow>
                    <SummaryLabel>Number of Incidents</SummaryLabel>
                    <SummaryValue>{incidentData[0].count}</SummaryValue>
                  </SummaryRow>
                  <SummaryRow>
                    <SummaryLabel>Weekday Hours</SummaryLabel>
                    <SummaryValue>{extractHoursData(incidentData[0].description).weekday}h</SummaryValue>
                  </SummaryRow>
                  <SummaryRow>
                    <SummaryLabel>Weekend Hours</SummaryLabel>
                    <SummaryValue>{extractHoursData(incidentData[0].description).weekend}h</SummaryValue>
                  </SummaryRow>
                  {extractHoursData(incidentData[0].description).nightShift && (
                    <SummaryRow>
                      <SummaryLabel>Night Shift Hours</SummaryLabel>
                      <SummaryValue>{extractHoursData(incidentData[0].description).nightShift}h</SummaryValue>
                    </SummaryRow>
                  )}
                  <TotalRow>
                    <SummaryLabel>Total Compensation</SummaryLabel>
                    <SummaryValue>€{incidentData[0].amount.toFixed(2)}</SummaryValue>
                  </TotalRow>
                  <SummaryRow>
                    <SummaryLabel>Percentage of Total</SummaryLabel>
                    <SummaryValue>{getPercentage(incidentData[0].amount)}</SummaryValue>
                  </SummaryRow>
                </SummaryCard>
              )}
            </SummarySection>
            
            {/* Hours Visualization */}
            {renderHoursChart()}
            
            {/* Compensation Rate Information */}
            <DetailSection>
              <DetailTitle>Compensation Rates</DetailTitle>
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
            </DetailSection>
            
            {/* Month to Month Comparison - if we have previous month data */}
            {monthsWithData.length > 1 && (
              <DetailSection>
                <DetailTitle>Comparison with Previous Months</DetailTitle>
                <BreakdownCard>
                  {monthsWithData.slice(-3).map(({ date, data }) => {
                    const total = data.find(d => d.type === 'total')?.amount || 0;
                    const oncall = data.find(d => d.type === 'oncall')?.amount || 0;
                    const incident = data.find(d => d.type === 'incident')?.amount || 0;
                    
                    return (
                      <StatCard key={date.toISOString()}>
                        <StatLabel>{format(date, 'MMM yyyy')}</StatLabel>
                        <StatValue>€{total.toFixed(2)}</StatValue>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                          On-Call: €{oncall.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Incidents: €{incident.toFixed(2)}
                        </div>
                      </StatCard>
                    );
                  })}
                </BreakdownCard>
              </DetailSection>
            )}
          </ModalContent>
        </Modal>
      )}

      {showConfirmModal && (
        <Modal onClick={handleCancelClear}>
          <ConfirmModalContent onClick={e => e.stopPropagation()}>
            <CloseButton onClick={handleCancelClear}>×</CloseButton>
            <ConfirmTitle>Clear All Data</ConfirmTitle>
            <ConfirmMessage>
              Are you sure you want to clear all calendar data? <br />
              This action cannot be undone and will remove all events and compensation data.
            </ConfirmMessage>
            <ConfirmButtonContainer>
              <CancelButton onClick={handleCancelClear}>Cancel</CancelButton>
              <ConfirmButton onClick={handleConfirmClear}>Delete All Data</ConfirmButton>
            </ConfirmButtonContainer>
          </ConfirmModalContent>
        </Modal>
      )}

      <ClearDataSection>
        <ClearDataButton onClick={handleClearAllData}>
          Clear All Calendar Data
        </ClearDataButton>
        <ClearDataWarning>Warning: This will permanently delete all events and compensation data.</ClearDataWarning>
      </ClearDataSection>
    </Container>
  );
};

export default MonthlyCompensationSummary; 
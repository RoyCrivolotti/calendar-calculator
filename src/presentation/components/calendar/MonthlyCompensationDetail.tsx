import React, { useState, memo, useEffect } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';

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
  top: 0.5rem;
  right: 0.5rem;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
  z-index: 1001;
  padding: 0;
  
  &:hover {
    background: #f8fafc;
    color: #0f172a;
    transform: scale(1.05);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
`;

const Tab = styled.button<{ isActive: boolean }>`
  padding: 0.75rem 1.5rem;
  background: ${props => props.isActive ? '#f0f9ff' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.isActive ? '#3b82f6' : 'transparent'};
  color: ${props => props.isActive ? '#3b82f6' : '#64748b'};
  font-weight: ${props => props.isActive ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  
  &:hover {
    background: ${props => props.isActive ? '#f0f9ff' : '#f8fafc'};
    color: ${props => props.isActive ? '#3b82f6' : '#0f172a'};
  }
`;

const ContentContainer = styled.div`
  animation: fadeIn 0.3s ease-in-out;
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const SummaryCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
`;

const SummaryTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.1rem;
  font-weight: 600;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  
  &:last-of-type {
    margin-bottom: 0;
  }
`;

const SummaryLabel = styled.span`
  color: #64748b;
`;

const SummaryValue = styled.span`
  color: #0f172a;
  font-weight: 500;
`;

const TotalRow = styled(SummaryRow)`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;
  font-weight: 600;
  color: #0f172a;
`;

// Extract hours from description (e.g., "20h weekday, 10h weekend")
const extractHoursData = (description: string): { weekday: number, weekend: number } => {
  const weekdayMatch = description.match(/(\d+)h weekday/);
  const weekendMatch = description.match(/(\d+)h weekend/);
  
  return {
    weekday: weekdayMatch ? parseInt(weekdayMatch[1], 10) : 0,
    weekend: weekendMatch ? parseInt(weekendMatch[1], 10) : 0
  };
};

interface MonthlyCompensationDetailProps {
  selectedMonth: Date;
  monthData: CompensationBreakdown[];
  onClose: () => void;
}

const MonthlyCompensationDetailComponent: React.FC<MonthlyCompensationDetailProps> = ({
  selectedMonth,
  monthData,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'oncall' | 'incident'>('all');
  const [isVisible, setIsVisible] = useState(false);
  
  // Effect to fade in content when the modal opens
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  // Format the date for display
  const monthTitle = format(selectedMonth, 'MMMM yyyy');
  
  // Calculate total compensation amount
  const totalCompensation = monthData
    .filter(comp => comp.type === 'total')
    .reduce((sum, comp) => sum + comp.amount, 0);
  
  // Filter data based on active tab
  const filteredData = activeTab === 'all' 
    ? monthData 
    : monthData.filter(comp => comp.type === activeTab);
  
  // Extract on-call and incident data
  const oncallData = monthData.filter(comp => comp.type === 'oncall');
  const incidentData = monthData.filter(comp => comp.type === 'incident');
  
  // Calculate percentage of total
  const getPercentage = (amount: number): string => {
    if (totalCompensation <= 0) return '0%';
    return `${Math.round((amount / totalCompensation) * 100)}%`;
  };
  
  return (
    <ModalContent>
      <CloseButton onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </CloseButton>

      <ModalHeader>
        <ModalTitle>{monthTitle}</ModalTitle>
        <MonthAmount>€{totalCompensation.toFixed(2)}</MonthAmount>
      </ModalHeader>

      <TabsContainer>
        <Tab
          isActive={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
        >
          All Compensation
        </Tab>
        <Tab
          isActive={activeTab === 'oncall'}
          onClick={() => setActiveTab('oncall')}
        >
          On-Call
        </Tab>
        <Tab
          isActive={activeTab === 'incident'}
          onClick={() => setActiveTab('incident')}
        >
          Incidents
        </Tab>
      </TabsContainer>

      <ContentContainer style={{ opacity: isVisible ? 1 : 0 }}>
        {activeTab === 'all' && (
          <>
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
          </>
        )}

        {activeTab === 'oncall' && oncallData.length > 0 && (
          <SummaryCard>
            <SummaryTitle>On-Call Detail</SummaryTitle>
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
          </SummaryCard>
        )}

        {activeTab === 'incident' && incidentData.length > 0 && (
          <SummaryCard>
            <SummaryTitle>Incident Detail</SummaryTitle>
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
            <TotalRow>
              <SummaryLabel>Total Compensation</SummaryLabel>
              <SummaryValue>€{incidentData[0].amount.toFixed(2)}</SummaryValue>
            </TotalRow>
          </SummaryCard>
        )}
      </ContentContainer>
    </ModalContent>
  );
};

// Use React.memo with custom comparison to avoid unnecessary re-renders
export const MonthlyCompensationDetail = memo(MonthlyCompensationDetailComponent, 
  (prevProps, nextProps) => {
    // Check if the selected month changed
    if (prevProps.selectedMonth.getTime() !== nextProps.selectedMonth.getTime()) {
      return false;
    }
    
    // Check if month data length changed
    if (prevProps.monthData.length !== nextProps.monthData.length) {
      return false;
    }
    
    // Check if any data changed
    for (let i = 0; i < prevProps.monthData.length; i++) {
      const prevData = prevProps.monthData[i];
      const nextData = nextProps.monthData[i];
      
      if (
        prevData.type !== nextData.type ||
        prevData.amount !== nextData.amount ||
        prevData.count !== nextData.count
      ) {
        return false;
      }
    }
    
    // If we got here, no important props changed
    return true;
  }
);

export default MonthlyCompensationDetail; 
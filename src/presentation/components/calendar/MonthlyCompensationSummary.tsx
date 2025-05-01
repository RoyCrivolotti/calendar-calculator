import React, { useState, useRef, useMemo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { isWeekend, calculateNightShiftHours } from '../../../utils/calendarUtils';

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
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  color: #1e293b;

  h2 {
    color: #0f172a;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }

  h3 {
    color: #334155;
    font-size: 1.1rem;
    font-weight: 500;
    margin: 1rem 0 0.5rem;
  }

  p {
    color: #475569;
    font-size: 1rem;
    margin: 0.5rem 0;
  }
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

  &:hover {
    background: #e2e8f0;
  }
`;

interface MonthData {
  date: Date;
  data: CompensationBreakdown;
}

interface MonthlyCompensationSummaryProps {
  data: CompensationBreakdown[];
}

const MonthlyCompensationSummary: React.FC<MonthlyCompensationSummaryProps> = ({ data }) => {
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate list of months (last 12 months)
  const monthsWithData = useMemo(() => {
    const result: MonthData[] = [];
    
    // Get all unique months from the compensation data
    const uniqueMonths = new Set(
      data.map(data => {
        const date = new Date(data.date);
        return `${date.getFullYear()}-${date.getMonth()}`;
      })
    );

    // Convert unique months to Date objects and sort them
    const months = Array.from(uniqueMonths).map(monthStr => {
      const [year, month] = monthStr.split('-').map(Number);
      return new Date(year, month, 1);
    }).sort((a, b) => a.getTime() - b.getTime());

    // Add each month to the result
    months.forEach(date => {
      const monthData = data.find(
        data => {
          const dataDate = new Date(data.date);
          return dataDate.getMonth() === date.getMonth() && 
                 dataDate.getFullYear() === date.getFullYear();
        }
      );
      if (monthData) {
        result.push({
          date,
          data: monthData
        });
      }
    });

    return result;
  }, [data]);

  const handleMonthClick = (month: Date) => {
    setSelectedMonth(month);
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
            <MonthValue>{data.totalCompensation.toFixed(2)}€</MonthValue>
          </MonthBox>
        ))}
      </ScrollContainer>
      <ScrollButton className="right" onClick={scrollRight}>→</ScrollButton>

      {selectedMonth && (
        <Modal onClick={handleCloseModal}>
          <ModalContent onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
            <CloseButton onClick={handleCloseModal}>×</CloseButton>
            <h2>{format(selectedMonth, 'MMMM yyyy')}</h2>
            {data
              .filter(data => {
                const dataDate = new Date(data.date);
                return dataDate.getMonth() === selectedMonth.getMonth() && 
                       dataDate.getFullYear() === selectedMonth.getFullYear();
              })
              .map((comp, index) => (
                <div key={index} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <h3>On-Call Shifts</h3>
                  {comp.onCallShifts?.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
                      {comp.onCallShifts.map((shift, i) => (
                        <li key={i} style={{ marginBottom: '0.5rem' }}>
                          {format(new Date(shift.start), 'MMM dd')}: {format(new Date(shift.start), 'HH:mm')} - {format(new Date(shift.end), 'MMM dd HH:mm')}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No on-call shifts this month</p>
                  )}

                  <h3>Incidents</h3>
                  {comp.incidents?.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
                      {comp.incidents.map((incident, i) => (
                        <li key={i} style={{ marginBottom: '0.5rem' }}>
                          {format(new Date(incident.start), 'MMM dd')}: {format(new Date(incident.start), 'HH:mm')} - {format(new Date(incident.end), 'HH:mm')}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No incidents this month</p>
                  )}

                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                    <h4>Hours Summary</h4>
                    <p>Weekday On-Call Hours: {comp.weekdayOnCallHours.toFixed(1)}</p>
                    <p>Weekend On-Call Hours: {comp.weekendOnCallHours.toFixed(1)}</p>
                    <p>Weekday Incident Hours: {comp.weekdayIncidentHours.toFixed(1)}</p>
                    <p>Weekend Incident Hours: {comp.weekendIncidentHours.toFixed(1)}</p>
                    {comp.nightShiftHours > 0 && (
                      <>
                        <p style={{ color: '#dc2626', marginTop: '0.5rem' }}>
                          Night Shift Hours (Incidents Only):
                        </p>
                        <p style={{ color: '#dc2626', marginLeft: '1rem' }}>
                          Weekday: {comp.incidents
                            .filter(inc => !isWeekend(new Date(inc.start)))
                            .reduce((acc, inc) => acc + calculateNightShiftHours(new Date(inc.start), new Date(inc.end)), 0)
                            .toFixed(1)}h
                        </p>
                        <p style={{ color: '#dc2626', marginLeft: '1rem' }}>
                          Weekend: {comp.incidents
                            .filter(inc => isWeekend(new Date(inc.start)))
                            .reduce((acc, inc) => acc + calculateNightShiftHours(new Date(inc.start), new Date(inc.end)), 0)
                            .toFixed(1)}h
                        </p>
                      </>
                    )}
                  </div>

                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                    <h4>Compensation Breakdown</h4>
                    <p>Weekday On-Call: €{comp.breakdown?.weekdayOnCallCompensation?.toFixed(2) || '0.00'}</p>
                    <p>Weekend On-Call: €{comp.breakdown?.weekendOnCallCompensation?.toFixed(2) || '0.00'}</p>
                    <p>Weekday Incidents: €{comp.breakdown?.weekdayIncidentCompensation?.toFixed(2) || '0.00'}</p>
                    <p>Weekend Incidents: €{comp.breakdown?.weekendIncidentCompensation?.toFixed(2) || '0.00'}</p>
                    {comp.breakdown?.nightShiftIncidentBonus > 0 && (
                      <p style={{ color: '#dc2626' }}>
                        Night Shift Bonus (Incidents Only): €{comp.breakdown.nightShiftIncidentBonus.toFixed(2)}
                      </p>
                    )}
                    <p style={{ fontWeight: '600', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      Total Compensation: €{comp.totalCompensation?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              ))}
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default MonthlyCompensationSummary; 
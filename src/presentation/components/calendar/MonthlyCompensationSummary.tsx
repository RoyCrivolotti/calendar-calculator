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
        if (d.type === 'total' && d.month) {
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

  // Updated to show modal instead of browser confirm
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
              {data.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}€
            </MonthValue>
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
              .filter(comp => {
                // Only show data for the selected month
                if (!comp.month) return false;
                const compMonth = comp.month instanceof Date ? comp.month : new Date(comp.month);
                return (
                  compMonth.getFullYear() === selectedMonth.getFullYear() && 
                  compMonth.getMonth() === selectedMonth.getMonth()
                );
              })
              .map((comp, index) => (
                <div key={index} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <h3>{comp.description}</h3>
                  <p>Count: {comp.count}</p>
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                    <h4>Compensation Breakdown</h4>
                    <p style={{ fontWeight: '600', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      Total Compensation: €{comp.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
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
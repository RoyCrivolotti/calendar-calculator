import React, { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { storageService } from '../../services/storage';
import { logger } from '../../../utils/logger';
import { createMonthDate } from '../../../utils/calendarUtils';
import { trackOperation } from '../../../utils/errorHandler';
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
  padding: 1rem 0.75rem;
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: white;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  padding: 0;
  color: #64748b;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    transition: transform 0.2s;
  }

  &:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    color: #3b82f6;
    
    svg {
      transform: scale(1.1);
    }
  }

  &.left {
    left: -16px;
  }

  &.right {
    right: -16px;
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
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
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
  width: 100%;
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
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-color: #bae6fd;
  }
  
  &.active {
    border-color: #3b82f6;
    background-color: #f0f9ff;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
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
  opacity: 1;
  transition: opacity 0.3s ease;
  
  h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: #334155;
  }
`;

const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  min-height: 300px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
  
  & > div {
    min-height: 250px;
    display: flex;
    flex-direction: column;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
    
    &.visible {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const PieChartContainer = styled.div`
  position: relative;
  margin: 0 auto;
  width: 220px;
  height: 220px;
`;

const PieChartLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
  
  .amount {
    font-size: 1rem;
    color: #475569;
    display: block;
    margin-top: 0.25rem;
  }
`;

const TotalLabel = styled.div`
  margin-top: 1rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
`;

const PieChartTooltip = styled.div`
  position: absolute;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  font-size: 0.875rem;
  color: #334155;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.2s;
  
  .type {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .amount, .percentage {
    display: block;
  }
`;

const BarChartContainer = styled.div`
  height: 200px;
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 0;
  margin-bottom: 40px;
  flex: 1;
  
  @media (max-width: 768px) {
    margin-bottom: 60px;
    gap: 0.5rem;
  }
  
  @media (max-width: 480px) {
    gap: 0.25rem;
  }
`;

const Bar = styled.div<{ height: string, color: string }>`
  flex: 1;
  height: 0;
  background: ${props => props.color};
  border-radius: 6px 6px 0 0;
  position: relative;
  min-width: 30px;
  transition: height 0.5s ease;
  
  &.mounted {
    height: ${props => props.height};
  }
  
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
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &.mounted:before {
    opacity: 1;
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
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: center;
  
  &:empty {
    display: none;
  }
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

const ComparisonSection = styled(DetailSection)`
  position: relative;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
`;

const ComparisonContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0;
  margin: 0.5rem 0;
`;

const ComparisonScrollButton = styled.button`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: white;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  margin: 0 -6px;
  padding: 0;
  line-height: 1;
  font-size: 1rem;
  color: #64748b;
  position: relative;
  overflow: hidden;

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    transition: transform 0.2s;
  }

  &:hover {
    background: #f8fafc;
    border-color: #3b82f6;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: #3b82f6;
    
    svg {
      transform: scale(1.2);
    }
    
    &::after {
      transform: scaleX(1);
    }
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: 4px;
    left: 6px;
    right: 6px;
    height: 2px;
    background-color: #3b82f6;
    border-radius: 1px;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.2s ease-out;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      background: white;
      border-color: #e2e8f0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      color: #64748b;
      
      svg {
        transform: none;
      }
      
      &::after {
        transform: scaleX(0);
      }
    }
  }
`;

const CardsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  margin: 0;
  padding: 0;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

// Add new styled component for the title
const SectionTitle = styled.h2`
  color: #0f172a;
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f5f9;
`;

const EventListSection = styled.div`
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const EventListTitle = styled.h3`
  color: #334155;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const EventTypeSection = styled.div`
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
`;

const EventItem = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
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
`;

const EventMetadata = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const EventDuration = styled.span`
  color: #64748b;
  font-size: 0.875rem;
`;

const HolidayIndicator = styled.span`
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
`;

const DeleteMonthButton = styled.button`
  background-color: #ef4444;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;

  &:hover {
    background-color: #dc2626;
  }

  &:focus {
    outline: none;
    ring: 2px;
    ring-color: #ef4444;
    ring-offset: 2px;
  }
`;

const DeleteMonthModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const DeleteMonthContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  text-align: center;
`;

const DeleteMonthTitle = styled.h3`
  color: #ef4444;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
`;

const DeleteSectionText = styled.p`
  color: #64748b;
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
`;

const DeleteMonthButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
`;

const DeleteConfirmButton = styled.button`
  background-color: #ef4444;
  color: white;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #dc2626;
  }
`;

const DeleteCancelButton = styled.button`
  background-color: #e5e7eb;
  color: #374151;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #d1d5db;
  }
`;

const DeleteMonthSection = styled.div`
  margin: 2rem 0;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
`;

const EventCount = styled.span`
  font-size: 0.8rem;
  font-weight: 400;
  color: #64748b;
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

interface MonthData {
  date: Date;
  data: CompensationBreakdown[];
}

interface MonthlyCompensationSummaryProps {
  data: CompensationBreakdown[];
}

interface Event {
  id: string;
  type: 'oncall' | 'incident';
  start: Date;
  end: Date;
  isHoliday?: boolean;
}

// Simple global tooltip
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
  justify-content: center;
  
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
const SidePanelEventSection = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SidePanelEventTypeName = styled.h4`
  color: #475569;
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SidePanelEventCount = styled.span`
  font-size: 0.8rem;
  font-weight: 400;
  color: #64748b;
  margin-left: 0.5rem;
`;

const SidePanelEventItem = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SidePanelEventTimeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SidePanelEventTime = styled.span`
  color: #334155;
  font-size: 0.875rem;
  display: block;
`;

const SidePanelEventMetadata = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
`;

const SidePanelEventDuration = styled.span`
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const SidePanelHolidayIndicator = styled.span`
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
`;

const SidePanelPaginationControls = styled.div`
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

const SidePanelPageInfo = styled.div`
  font-size: 0.8rem;
  color: #64748b;
`;

const SidePanelPageButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SidePanelPageButton = styled.button<{ disabled?: boolean }>`
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

const SidePanelPageNumber = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  padding: 0 0.25rem;
`;

// ... rest of the existing code ...

// After the component declaration, add logging to trace data flow
const MonthlyCompensationSummary: React.FC<MonthlyCompensationSummaryProps> = ({ data }) => {
  // Add logging to debug data
  useEffect(() => {
    logger.debug(`MonthlyCompensationSummary received data with ${data.length} items`);
    if (data.length > 0) {
      logger.debug(`Sample data: ${JSON.stringify(data[0])}`);
    }
  }, [data]);

  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteMonthModal, setShowDeleteMonthModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'oncall' | 'incident'>('all');
  const [isVisible, setIsVisible] = useState(false);
  
  // Side panel states
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelContent, setSidePanelContent] = useState<'events' | 'rates'>('events');
  const [sidePanelTab, setSidePanelTab] = useState<'all' | 'oncall' | 'incident'>('all');
  
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
  
  // Keep tooltip state for pie chart
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: string;
    amount: string;
    percentage: string;
  } | null>(null);
  
  // Pagination settings for event lists
  const EVENTS_PER_PAGE = 10;
  const [oncallPage, setOncallPage] = useState(1);
  const [incidentPage, setIncidentPage] = useState(1);

  // Reset pagination when month changes
  useEffect(() => {
    setOncallPage(1);
    setIncidentPage(1);
  }, [selectedMonth]);
  
  // Function to update global tooltip
  const showTooltip = (e: React.MouseEvent, title: string, value: string, extra: string) => {
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
  };
  
  const hideTooltip = () => {
    setGlobalTooltip(prev => ({
      ...prev,
      visible: false
    }));
  };

  // Side panel handlers
  const openSidePanel = useCallback((content: 'events' | 'rates') => {
    setSidePanelContent(content);
    setSidePanelOpen(true);
    // Reset the tab to 'all' when opening
    setSidePanelTab('all');
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
  }, []);

  // ... rest of the existing code ...
  
  // Handle ESC key for closing side panel as well
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sidePanelOpen) {
          setSidePanelOpen(false);
        } else if (showConfirmModal) {
          setShowConfirmModal(false);
        } else if (showDeleteMonthModal) {
          setShowDeleteMonthModal(false);
        } else if (selectedMonth) {
          setSelectedMonth(null);
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedMonth, showConfirmModal, showDeleteMonthModal, sidePanelOpen]);

  // Generate list of months (last 12 months)
  const monthsWithData = useMemo(() => {
    const result: MonthData[] = [];
    
    logger.debug('Monthly Summary Data:', data.length);
    
    // Get unique months from data
    const months = new Map<string, Date>();
    data.forEach(d => {
      if (d.month) {
        try {
          // Ensure month is treated as a Date object
          const monthDate = d.month instanceof Date ? d.month : new Date(d.month);
          const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
          
          // Only add if not already in the map
          if (!months.has(monthKey)) {
            months.set(monthKey, monthDate);
            logger.debug(`Found month: ${monthKey} from ${d.type} with amount ${d.amount}`);
          }
        } catch (error) {
          logger.error('Error processing month:', d.month, error);
        }
      }
    });

    logger.info(`Found ${months.size} unique months`);

    // Add months with data
    months.forEach((monthDate, monthKey) => {
      const monthData = data.filter(d => {
        if (d.month) {
          try {
            const compMonthDate = d.month instanceof Date ? d.month : new Date(d.month);
            const compMonthKey = `${compMonthDate.getFullYear()}-${compMonthDate.getMonth() + 1}`;
            return compMonthKey === monthKey;
          } catch (error) {
            return false;
          }
        }
        return false;
      });
      
      if (monthData.length > 0) {
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

  const handleMonthClick = useCallback((month: Date) => {
    setIsVisible(false);
    setSelectedMonth(month);
    setActiveTab('all');
    
    // Single timeout to show the new charts
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedMonth(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  }, [handleCloseModal]);

  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }, []);

  const handleClearAllData = useCallback(async () => {
    logger.info('User initiated clearing of all calendar data');
    setShowConfirmModal(true);
  }, []);

  const handleConfirmClear = useCallback(async () => {
    try {
      await trackOperation(
        'ClearAllData',
        async () => {
          logger.info('Starting to clear all data');
      await storageService.clearAllData();
          logger.info('Successfully cleared all calendar data');
          return { success: true };
        },
        { 
          operation: 'data_clearing',
          userTriggered: true 
        }
      );
      
      // Reload the page to reflect the cleared data
      window.location.reload();
    } catch (error) {
      logger.error('Failed to clear calendar data:', error);
      alert('Failed to clear data. See console for details.');
    } finally {
      setShowConfirmModal(false);
    }
  }, []);

  const handleCancelClear = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

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
  
  // Helper function to get combined billable hours for incidents
  const getIncidentBillableWeekdayHours = (description: string): number => {
    const hours = extractHoursData(description);
    // For incident charts, weekday hours should include both regular weekday and night shift hours
    return hours.weekday + hours.nightShift;
  };

  // Helper function to get combined weekend hours for incidents
  const getIncidentWeekendHours = (description: string): number => {
    const hours = extractHoursData(description);
    // Combine regular weekend hours and weekend night hours
    return hours.weekend + hours.weekendNight;
  };

  // Get the total amount for the selected month
  const monthTotal = totalData.length > 0 ? totalData[0].amount : 0;

  // Calculate percentage for each category
  const getPercentage = (amount: number): string => {
    if (!monthTotal) return '0%';
    return `${Math.round((amount / monthTotal) * 100)}%`;
  };

  // Update chart rendering to use the new transition approach
  const renderHoursChart = () => {
    const oncallHours = oncallData.length > 0 ? extractHoursData(oncallData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    const incidentHours = incidentData.length > 0 ? extractHoursData(incidentData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    // Calculate total hours across all categories
    const totalHours = (
      oncallHours.weekday + 
      oncallHours.weekend + 
      incidentHours.weekday + 
      incidentHours.weekend + 
      incidentHours.nightShift + 
      incidentHours.weekendNight
    );
    
    const maxHours = Math.max(
      oncallHours.weekday,
      oncallHours.weekend,
      incidentHours.weekday,
      incidentHours.weekend,
      incidentHours.nightShift,
      incidentHours.weekendNight
    );
    
    // Return null if there are no hours to show
    if (maxHours === 0) return null;
    
    const calculateHeight = (hours: number) => `${Math.max((hours / maxHours) * 180, 10)}px`;
    
    const bars = [];
    
    if (oncallHours.weekday > 0) {
     bars.push(
       <Bar 
         key="weekday-oncall"
         height={calculateHeight(oncallHours.weekday)} 
         color="#3b82f6"
         data-value={`${oncallHours.weekday}h`} 
         data-label="Weekday On-Call"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Weekday On-Call", `${oncallHours.weekday} hours`, `${Math.round((oncallHours.weekday / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    if (oncallHours.weekend > 0) {
     bars.push(
       <Bar 
         key="weekend-oncall"
         height={calculateHeight(oncallHours.weekend)} 
         color="#93c5fd"
         data-value={`${oncallHours.weekend}h`} 
         data-label="Weekend On-Call"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Weekend On-Call", `${oncallHours.weekend} hours`, `${Math.round((oncallHours.weekend / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    if (incidentHours.weekday > 0) {
     bars.push(
       <Bar 
         key="weekday-incident"
         height={calculateHeight(incidentHours.weekday)} 
         color="#dc2626"
         data-value={`${incidentHours.weekday}h`} 
         data-label="Weekday Incident"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Weekday Incident", `${incidentHours.weekday} hours`, `${Math.round((incidentHours.weekday / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    if (incidentHours.weekend > 0) {
     bars.push(
       <Bar 
         key="weekend-incident"
         height={calculateHeight(incidentHours.weekend)} 
         color="#fca5a5"
         data-value={`${incidentHours.weekend}h`} 
         data-label="Weekend Incident"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Weekend Incident", `${incidentHours.weekend} hours`, `${Math.round((incidentHours.weekend / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    if (incidentHours.nightShift > 0) {
     bars.push(
       <Bar 
         key="night-incident"
         height={calculateHeight(incidentHours.nightShift)} 
         color="#9f1239"
         data-value={`${incidentHours.nightShift}h`} 
         data-label="Night Shift Incident"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Night Shift Incident", `${incidentHours.nightShift} hours`, `${Math.round((incidentHours.nightShift / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    if (incidentHours.weekendNight > 0) {
     bars.push(
       <Bar 
         key="weekend-night"
         height={calculateHeight(incidentHours.weekendNight)} 
         color="#f43f5e"
         data-value={`${incidentHours.weekendNight}h`} 
         data-label="Weekend Night"
         className={isVisible ? 'mounted' : ''}
         onMouseEnter={(e) => showTooltip(e, "Weekend Night", `${incidentHours.weekendNight} hours`, `${Math.round((incidentHours.weekendNight / totalHours) * 100)}% of total hours`)}
         onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
         onMouseLeave={hideTooltip}
       />
     );
    }
    
    // Only return content if we have bars to show
    if (bars.length === 0) return null;
    
    return (
      <div className={isVisible ? 'visible' : ''}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155', textAlign: 'center' }}>Hours Breakdown</h3>
        <BarChartContainer>
          {bars}
        </BarChartContainer>
      </div>
    );
  };

  // Extract compensation data for visualization
  const getCompensationData = () => {
    const result = [];
    
    // Use the actual precalculated oncall amount if available
    if (oncallData.length > 0) {
      const oncallHours = extractHoursData(oncallData[0].description);
      const totalOncallAmount = oncallData[0].amount;
      
      // Calculate the proportion of weekday vs weekend for distribution
      const totalOncallHours = oncallHours.weekday + oncallHours.weekend;
      
      // Weekday on-call - distribute the actual amount proportionally
      if (oncallHours.weekday > 0 && totalOncallHours > 0) {
        const weekdayProportion = oncallHours.weekday / totalOncallHours;
        const amount = totalOncallAmount * weekdayProportion;
        result.push({
          type: 'Weekday On-Call',
          amount,
          color: '#3b82f6' // Updated color
        });
      }
      
      // Weekend on-call - distribute the actual amount proportionally
      if (oncallHours.weekend > 0 && totalOncallHours > 0) {
        const weekendProportion = oncallHours.weekend / totalOncallHours;
        const amount = totalOncallAmount * weekendProportion;
        result.push({
          type: 'Weekend On-Call',
          amount,
          color: '#93c5fd'
        });
      }
    }
    
    // Use the actual precalculated incident amount if available
    if (incidentData.length > 0) {
      const hours = extractHoursData(incidentData[0].description);
      const totalIncidentAmount = incidentData[0].amount;
      
      // Calculate total incident hours for proportion
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
          const amount = totalIncidentAmount * proportion;
          result.push({
            type: 'Weekday Incident',
            amount,
            color: '#dc2626' // Updated color
          });
        }
        
        // Weekend incidents
        if (hours.weekend > 0) {
          const proportion = hours.weekend / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            type: 'Weekend Incident',
            amount,
            color: '#fca5a5'
          });
        }
        
        // Night shift incidents
        if (hours.nightShift > 0) {
          const proportion = hours.nightShift / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            type: 'Night Shift Incident',
            amount,
            color: '#9f1239' // Updated color
          });
        }
        
        // Weekend night incidents
        if (hours.weekendNight > 0) {
          const proportion = hours.weekendNight / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            type: 'Weekend Night',
            amount,
            color: '#f43f5e'
          });
        }
      }
    }
    
    return result;
  };

  // Update chart rendering to use the new transition approach
  const renderCompensationPieChart = () => {
    const compensationData = getCompensationData();
    
    if (compensationData.length === 0) return null;
    
    const totalAmount = compensationData.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate SVG pie slices
    let currentAngle = 0;
    const svgSlices = compensationData.map((item, index) => {
      const percentage = (item.amount / totalAmount) * 100;
      const degrees = (percentage / 100) * 360;
      
      // Calculate SVG arc parameters
      const startAngle = currentAngle;
      const endAngle = currentAngle + degrees;
      currentAngle = endAngle;
      
      // Convert angles to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      // SVG arc coordinates
      const x1 = 100 + 80 * Math.cos(startRad);
      const y1 = 100 + 80 * Math.sin(startRad);
      const x2 = 100 + 80 * Math.cos(endRad);
      const y2 = 100 + 80 * Math.sin(endRad);
      
      // Determine if the arc should take the large-arc-flag (1 if > 180 degrees)
      const largeArcFlag = degrees > 180 ? 1 : 0;
      
      // SVG path commands
      const path = [
        `M 100 100`, // Move to center
        `L ${x1} ${y1}`, // Line to start point
        `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`, // Arc to end point
        `Z` // Close path
      ].join(' ');
      
      return (
        <path 
          key={`slice-${index}`}
          d={path}
          fill={item.color}
          stroke="white"
          strokeWidth="1"
          data-type={item.type}
          data-amount={item.amount.toFixed(2)}
          data-percentage={percentage.toFixed(0)}
          onMouseEnter={handlePieSliceHover}
          onMouseLeave={hideTooltip}
          onMouseMove={handleTooltipMove}
          style={{
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            transformOrigin: 'center',
            opacity: isVisible ? 1 : 0,
            transform: `scale(${isVisible ? 1 : 0.8})`,
            cursor: 'pointer'
          }}
        />
      );
    });
    
    return (
      <div className={isVisible ? 'visible' : ''}>
        {/* Chart section wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 600, color: '#334155', width: '220px', textAlign: 'center' }}>Compensation Breakdown</h3>
          
          {/* Chart wrapper to control exact dimensions */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Pie chart */}
            <div style={{ width: '220px', height: '220px', position: 'relative' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: 'block', margin: '0 auto' }}>
                <g transform="translate(0, 0)">
                  {svgSlices}
                </g>
              </svg>
              {tooltip && tooltip.visible && (
                <PieChartTooltip
                  style={{
                    left: `${tooltip.x + 10}px`,
                    top: `${tooltip.y + 10}px`,
                    position: 'fixed'
                  }}
                >
                  <div className="type">{tooltip.type}</div>
                  <div className="amount">€{tooltip.amount}</div>
                  <div className="percentage">{tooltip.percentage}% of total</div>
                </PieChartTooltip>
              )}
            </div>
            
            {/* Total label (same exact width as chart container) */}
            <div style={{
              width: '220px',
              textAlign: 'center',
              marginTop: '1rem',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#0f172a',
              transition: 'opacity 0.3s ease',
              opacity: isVisible ? 1 : 0
            }}>
              Total: €{totalAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to format duration
  const formatDuration = (start: Date, end: Date) => {
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  // Function to render the events list with pagination
  const renderEventsList = (isSidePanel = false) => {
    if (!selectedMonth || !oncallData.length && !incidentData.length) return null;

    const events: Event[] = [];

    // Extract events
    if (oncallData.length > 0 && oncallData[0].events) {
      const oncallEvents = oncallData[0].events;
      events.push(...oncallEvents.map(event => ({
        id: event.id,
        type: 'oncall' as const,
        start: event.start,
        end: event.end,
        isHoliday: event.isHoliday
      })));
    }

    // Extract events from incidentData
    if (incidentData.length > 0 && incidentData[0].events) {
      const incidentEvents = incidentData[0].events;
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

    // Filter events based on the active tab (for side panel)
    const filteredOncallEvents = isSidePanel && sidePanelTab !== 'all' 
      ? groupedEvents.oncall.filter(() => sidePanelTab === 'oncall')
      : groupedEvents.oncall;
    
    const filteredIncidentEvents = isSidePanel && sidePanelTab !== 'all'
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

    // Choose the appropriate styled components based on whether this is for the side panel or modal
    const EventSection = isSidePanel ? SidePanelEventSection : EventTypeSection;
    const EventName = isSidePanel ? SidePanelEventTypeName : EventTypeName;
    const CountBadge = isSidePanel ? SidePanelEventCount : EventCount;
    const EventRow = isSidePanel ? SidePanelEventItem : EventItem;
    const EventTimeWrapper = isSidePanel ? SidePanelEventTimeContainer : EventTimeContainer;
    const TimeText = isSidePanel ? SidePanelEventTime : EventTime;
    const MetadataWrapper = isSidePanel ? SidePanelEventMetadata : EventMetadata;
    const DurationText = isSidePanel ? SidePanelEventDuration : EventDuration;
    const HolidayBadge = isSidePanel ? SidePanelHolidayIndicator : HolidayIndicator;
    const PaginationWrapper = isSidePanel ? SidePanelPaginationControls : PaginationControls;
    const PageInfoText = isSidePanel ? SidePanelPageInfo : PageInfo;
    const ButtonsContainer = isSidePanel ? SidePanelPageButtons : PageButtons;
    const PaginationButton = isSidePanel ? SidePanelPageButton : PageButton;
    const PageText = isSidePanel ? SidePanelPageNumber : PageNumber;

    const showTab = isSidePanel 
      ? (tab: 'all' | 'oncall' | 'incident') => sidePanelTab === tab || sidePanelTab === 'all'
      : (tab: 'all' | 'oncall' | 'incident') => activeTab === tab || activeTab === 'all';

    return (
      <div style={{ marginTop: isSidePanel ? 0 : '2rem' }}>
        {!isSidePanel && <EventListTitle>Events This Month</EventListTitle>}
        
        {/* On-Call Shifts */}
        {showTab('oncall') && filteredOncallEvents.length > 0 && (
          <EventSection>
            <EventName>
              {isSidePanel && <PhoneIcon />} 
              On-Call Shifts
              <CountBadge>{filteredOncallEvents.length} events</CountBadge>
            </EventName>
            
            {paginatedOncallEvents.map(event => (
              <EventRow key={event.id}>
                <EventTimeWrapper>
                  {isSidePanel && <CalendarIcon />}
                  <TimeText>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'MMM d, HH:mm')}
                  </TimeText>
                </EventTimeWrapper>
                <MetadataWrapper>
                  {event.isHoliday && <HolidayBadge>Holiday</HolidayBadge>}
                  <DurationText>
                    {isSidePanel && <ClockIcon />}
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </DurationText>
                </MetadataWrapper>
              </EventRow>
            ))}
            
            {/* Pagination controls for on-call events */}
            {totalOncallPages > 1 && (
              <PaginationWrapper>
                <PageInfoText>
                  Showing {oncallStartIndex + 1}-{oncallEndIndex} of {filteredOncallEvents.length}
                </PageInfoText>
                <ButtonsContainer>
                  <PaginationButton 
                    disabled={oncallPage === 1}
                    onClick={() => setOncallPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </PaginationButton>
                  <PageText>{oncallPage} / {totalOncallPages}</PageText>
                  <PaginationButton 
                    disabled={oncallPage === totalOncallPages}
                    onClick={() => setOncallPage(prev => Math.min(prev + 1, totalOncallPages))}
                  >
                    Next
                  </PaginationButton>
                </ButtonsContainer>
              </PaginationWrapper>
            )}
          </EventSection>
        )}
        
        {/* Incidents */}
        {showTab('incident') && filteredIncidentEvents.length > 0 && (
          <EventSection>
            <EventName>
              {isSidePanel && <AlertIcon />}
              Incidents
              <CountBadge>{filteredIncidentEvents.length} events</CountBadge>
            </EventName>
            
            {paginatedIncidentEvents.map(event => (
              <EventRow key={event.id}>
                <EventTimeWrapper>
                  {isSidePanel && <CalendarIcon />}
                  <TimeText>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                  </TimeText>
                </EventTimeWrapper>
                <MetadataWrapper>
                  {event.isHoliday && <HolidayBadge>Holiday</HolidayBadge>}
                  <DurationText>
                    {isSidePanel && <ClockIcon />}
                    Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                  </DurationText>
                </MetadataWrapper>
              </EventRow>
            ))}
            
            {/* Pagination controls for incident events */}
            {totalIncidentPages > 1 && (
              <PaginationWrapper>
                <PageInfoText>
                  Showing {incidentStartIndex + 1}-{incidentEndIndex} of {filteredIncidentEvents.length}
                </PageInfoText>
                <ButtonsContainer>
                  <PaginationButton 
                    disabled={incidentPage === 1}
                    onClick={() => setIncidentPage(prev => Math.max(prev - 1, 1))}
                  >
                    Previous
                  </PaginationButton>
                  <PageText>{incidentPage} / {totalIncidentPages}</PageText>
                  <PaginationButton 
                    disabled={incidentPage === totalIncidentPages}
                    onClick={() => setIncidentPage(prev => Math.min(prev + 1, totalIncidentPages))}
                  >
                    Next
                  </PaginationButton>
                </ButtonsContainer>
              </PaginationWrapper>
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

  const handlePreviousMonth = useCallback(() => {
    if (!selectedMonth) return;
    
    const currentIndex = monthsWithData.findIndex(
      m => m.date.getTime() === selectedMonth.getTime()
    );
    
    if (currentIndex > 0) {
      setSelectedMonth(monthsWithData[currentIndex - 1].date);
    }
  }, [selectedMonth, monthsWithData]);

  const handleNextMonth = useCallback(() => {
    if (!selectedMonth) return;
    
    const currentIndex = monthsWithData.findIndex(
      m => m.date.getTime() === selectedMonth.getTime()
    );
    
    if (currentIndex < monthsWithData.length - 1) {
      setSelectedMonth(monthsWithData[currentIndex + 1].date);
    }
  }, [selectedMonth, monthsWithData]);

  // Get the selected month index for navigation disabling
  const selectedMonthIndex = useMemo(() => {
    if (!selectedMonth) return -1;
    return monthsWithData.findIndex(m => m.date.getTime() === selectedMonth.getTime());
  }, [selectedMonth, monthsWithData]);

  // Add ESC key event listener
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmModal) {
    setShowConfirmModal(false);
        } else if (selectedMonth) {
          setSelectedMonth(null);
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedMonth, showConfirmModal]);

  // Add function to handle month deletion
  const handleDeleteMonth = useCallback(async () => {
    if (!selectedMonth) return;
    
    const monthName = format(selectedMonth, 'MMMM yyyy');
    logger.info(`Attempting to delete all events for month: ${monthName}`);
    
    try {
      await trackOperation(
        `DeleteMonth(${monthName})`,
        async () => {
          // Get all events from storage
          const allEvents = await storageService.loadEvents();
          const allSubEvents = await storageService.loadSubEvents();
          
          // Filter events for the selected month
          const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
          const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59);
          
          // Find events that fall within the selected month
          const eventsToDelete = allEvents.filter(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            return (
              (eventStart >= startOfMonth && eventStart <= endOfMonth) ||
              (eventEnd >= startOfMonth && eventEnd <= endOfMonth) ||
              (eventStart <= startOfMonth && eventEnd >= endOfMonth)
            );
          });
          
          const deletedEventIds = eventsToDelete.map(event => event.id);
          logger.debug(`Found ${deletedEventIds.length} events to delete for month ${monthName}`);
          
          // Delete all events by creating a filtered set of remaining events
          const remainingEvents = allEvents.filter(event => !deletedEventIds.includes(event.id));
          await storageService.saveEvents(remainingEvents);
          
          // Delete associated sub-events
          const subEventsToDelete = allSubEvents.filter(subEvent => 
            deletedEventIds.includes(subEvent.parentEventId)
          );
          
          const deletedSubEventsCount = subEventsToDelete.length;
          logger.debug(`Found ${deletedSubEventsCount} sub-events to delete`);
          
          // Update sub-events
          const remainingSubEvents = allSubEvents.filter(subEvent => 
            !deletedEventIds.includes(subEvent.parentEventId)
          );
          await storageService.saveSubEvents(remainingSubEvents);
          
          return { deletedEvents: deletedEventIds.length, deletedSubEvents: deletedSubEventsCount };
        },
        {
          monthName,
          monthDate: selectedMonth.toISOString(),
          operation: 'month_deletion'
        }
      );
      
      // Close the modal and reload
      setShowDeleteMonthModal(false);
      window.location.reload();
    } catch (error) {
      logger.error('Failed to delete month events:', error);
      alert(`Failed to delete events for ${monthName}. See console for details.`);
      setShowDeleteMonthModal(false);
    }
  }, [selectedMonth]);

  // Add handlers for delete month modal
  const handleOpenDeleteMonthModal = useCallback(() => {
    if (!selectedMonth) return;
    logger.info(`Opening delete confirmation modal for month: ${format(selectedMonth, 'MMMM yyyy')}`);
    setShowDeleteMonthModal(true);
  }, [selectedMonth]);

  const handleCloseDeleteMonthModal = useCallback(() => {
    logger.info('User cancelled month deletion');
    setShowDeleteMonthModal(false);
  }, []);

  // Hide tooltip when selectedMonth changes or component unmounts
  useEffect(() => {
    return () => {
      // Hide tooltip when unmounting
      setGlobalTooltip(prev => ({
        ...prev,
        visible: false
      }));
      setTooltip(null);
    };
  }, [selectedMonth]);

  // Modify the renderCompensationBar function to not include the ActionButtons
  const renderCompensationBar = () => {
    const compensationData = getCompensationData();
    
    if (compensationData.length === 0) return null;
    
    const totalAmount = compensationData.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate percentages for each category
    const segments = compensationData.map(item => ({
      ...item,
      percentage: (item.amount / totalAmount) * 100
    }));
    
    return (
      <div>
        <CompensationBar>
          {segments.map((segment, index) => (
            <CompensationBarSegment
              key={`segment-${index}`}
              width={`${segment.percentage}%`}
              color={segment.color}
              onMouseEnter={(e) => showTooltip(
                e, 
                segment.type, 
                `€${segment.amount.toFixed(2)}`, 
                `${segment.percentage.toFixed(1)}% of total`
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
          {segments.map((segment, index) => (
            <CompensationCategory key={`category-${index}`}>
              <CategoryColor color={segment.color} />
              <div>
                <div>{segment.type}</div>
                <CategoryAmount>€{segment.amount.toFixed(2)}</CategoryAmount>
                <CategoryPercentage>{segment.percentage.toFixed(1)}% of total</CategoryPercentage>
              </div>
            </CompensationCategory>
          ))}
        </CompensationBreakdownSection>
      </div>
    );
  };

  // Update the tooltip handlers that were accidentally removed
  
  // Original tooltip handlers can remain for backward compatibility
  const handlePieSliceHover = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    if (e.currentTarget) {
      const target = e.currentTarget;
      const type = target.getAttribute('data-type') || '';
      const amount = target.getAttribute('data-amount') || '';
      const percentage = target.getAttribute('data-percentage') || '';
      
      // Update global tooltip instead
      showTooltip(e, type, `€${amount}`, `${percentage}% of total`);
      
      // Original code can stay for backward compatibility
      setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type,
        amount,
        percentage
      });
    }
  }, []);
  
  const handleTooltipMove = useCallback((e: React.MouseEvent) => {
    // Update global tooltip position
    setGlobalTooltip(prev => ({
      ...prev,
      x: e.clientX + 15,
      y: e.clientY + 15
    }));
    
    // Original code can stay for backward compatibility
    if (tooltip) {
      setTooltip({
        ...tooltip,
        x: e.clientX,
        y: e.clientY
      });
    }
  }, [tooltip]);

  // Add new function for opening the side panels in CompensationSection
  const openCompensationSectionPanel = (panelType: 'events' | 'rates') => {
    // Create a custom event to communicate with CompensationSection
    const event = new CustomEvent('openCompensationPanel', { 
      detail: { 
        type: panelType,
        date: selectedMonth
      } 
    });
    window.dispatchEvent(event);
    
    // Close the current modal
    handleCloseModal();
  };

  return (
    <Container>
      {/* Global tooltip rendered at the top level */}
      <GlobalTooltip 
        className={globalTooltip.visible ? 'visible' : ''}
        style={{ 
          left: `${globalTooltip.x}px`, 
          top: `${globalTooltip.y}px`
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          {globalTooltip.content.title}
        </div>
        <div>{globalTooltip.content.value}</div>
        <div>{globalTooltip.content.extra}</div>
      </GlobalTooltip>
      
      {/* Side panel for events and rates */}
      <SidePanelOverlay isOpen={sidePanelOpen} onClick={closeSidePanel} />
      <SidePanel isOpen={sidePanelOpen}>
        <SidePanelHeader>
          <SidePanelTitle>
            {sidePanelContent === 'events' 
              ? `Events for ${selectedMonth ? format(selectedMonth, 'MMMM yyyy') : ''}` 
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
              
              {renderEventsList(true)}
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
      
      <SectionTitle>Monthly Compensation Summary</SectionTitle>
      <ScrollButton className="left" onClick={scrollLeft}>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </ScrollButton>
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
      <ScrollButton className="right" onClick={scrollRight}>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </ScrollButton>

      {selectedMonth && (
        <Modal onClick={handleCloseModal}>
          <ModalContent onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
            <CloseButton onClick={handleCloseModal} aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </CloseButton>
            
            <ModalHeader>
              <ModalTitle>{format(selectedMonth, 'MMMM yyyy')}</ModalTitle>
              <MonthAmount>€{monthTotal.toFixed(2)}</MonthAmount>
            </ModalHeader>
            
            {/* Compensation Bar */}
            {renderCompensationBar()}
            
            {/* NEW ORDER: 1. Events Summary first */}
            <div style={{ margin: '2rem 0 1.5rem 0', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '1rem', fontWeight: 600 }}>
                Events Summary
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ 
                  background: '#f1f5f9', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  minWidth: '120px',
                  flex: '1'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>On-Call Events</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155' }}>
                    {oncallData.length > 0 && oncallData[0].events ? oncallData[0].events.length : 0}
                  </div>
                </div>
                
                <div style={{ 
                  background: '#f1f5f9', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  minWidth: '120px',
                  flex: '1'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Incidents</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155' }}>
                    {incidentData.length > 0 && incidentData[0].events ? incidentData[0].events.length : 0}
                  </div>
                </div>
                
                {/* Add new box showing total on-call hours */}
                <div style={{ 
                  background: '#f1f5f9', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  minWidth: '120px',
                  flex: '1'
                }}>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total On-Call Hours</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155' }}>
                    {oncallData.length > 0 && oncallData[0].description ? 
                      // Calculate total hours from description
                      (() => {
                        const hours = extractHoursData(oncallData[0].description);
                        return (hours.weekday + hours.weekend).toFixed(1);
                      })() : 0}
                  </div>
                </div>
              </div>
            </div>
            
            {/* NEW ORDER: 2. Action buttons below Events Summary */}
            <ActionButtonsContainer>
              <ActionButton onClick={() => openCompensationSectionPanel('events')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View All Events
              </ActionButton>
              <ActionButton onClick={() => openCompensationSectionPanel('rates')}>
                <DollarIcon />
                View Compensation Rates
                <ChevronRightIcon />
              </ActionButton>
            </ActionButtonsContainer>
            
            {/* NEW ORDER: 3. Hours and Compensation charts */}
            <ChartContainer>
              <ChartGrid>
                {renderHoursChart()}
                {renderCompensationPieChart()}
              </ChartGrid>
              
              {/* Only show legend when we actually have chart data */}
              {(!!renderHoursChart() || !!renderCompensationPieChart()) && (
                <Legend>
                  {/* Only include legend items for data that actually exists */}
                  {oncallData.length > 0 && extractHoursData(oncallData[0].description).weekday > 0 && (
                    <LegendItem>
                      <LegendColor color="#3b82f6" />
                      <span>Weekday On-Call</span>
                    </LegendItem>
                  )}
                  
                  {oncallData.length > 0 && extractHoursData(oncallData[0].description).weekend > 0 && (
                    <LegendItem>
                      <LegendColor color="#93c5fd" />
                      <span>Weekend On-Call</span>
                    </LegendItem>
                  )}
                  
                  {incidentData.length > 0 && extractHoursData(incidentData[0].description).weekday > 0 && (
                    <LegendItem>
                      <LegendColor color="#dc2626" />
                      <span>Weekday Incident</span>
                    </LegendItem>
                  )}
                  
                  {incidentData.length > 0 && extractHoursData(incidentData[0].description).weekend > 0 && (
                    <LegendItem>
                      <LegendColor color="#fca5a5" />
                      <span>Weekend Incident</span>
                    </LegendItem>
                  )}
                  
                  {incidentData.length > 0 && 
                    extractHoursData(incidentData[0].description).nightShift !== undefined && 
                    extractHoursData(incidentData[0].description).nightShift! > 0 && (
                    <LegendItem>
                      <LegendColor color="#9f1239" />
                      <span>Night Shift Incident</span>
                    </LegendItem>
                  )}
                  
                  {incidentData.length > 0 && 
                    extractHoursData(incidentData[0].description).weekendNight !== undefined && 
                    extractHoursData(incidentData[0].description).weekendNight! > 0 && (
                    <LegendItem>
                      <LegendColor color="#f43f5e" />
                      <span>Weekend Night</span>
                    </LegendItem>
                  )}
                </Legend>
              )}
            </ChartContainer>
            
            {/* Delete Month Section - KEEP AT THE BOTTOM */}
            <DeleteMonthSection>
              <DeleteSectionText>
                Remove all events for this month, including events that overlap with other months.
              </DeleteSectionText>
              <DeleteMonthButton onClick={handleOpenDeleteMonthModal}>
                Remove All Events for {format(selectedMonth, 'MMMM yyyy')}
              </DeleteMonthButton>
            </DeleteMonthSection>
          </ModalContent>
        </Modal>
      )}

      {showConfirmModal && (
        <Modal onClick={handleCancelClear}>
          <ConfirmModalContent onClick={e => e.stopPropagation()}>
            <CloseButton onClick={handleCancelClear} aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </CloseButton>
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

      {/* Add Delete Month Confirmation Modal */}
      {showDeleteMonthModal && selectedMonth && (
        <DeleteMonthModal onClick={handleCloseDeleteMonthModal}>
          <DeleteMonthContent onClick={e => e.stopPropagation()}>
            <DeleteMonthTitle>Remove All Events for {format(selectedMonth, 'MMMM yyyy')}?</DeleteMonthTitle>
            <DeleteSectionText>
              This will permanently remove all events that overlap with {format(selectedMonth, 'MMMM yyyy')}. 
              This includes events that start in previous months or end in future months.
              This action cannot be undone.
            </DeleteSectionText>
            <DeleteMonthButtons>
              <DeleteCancelButton onClick={handleCloseDeleteMonthModal}>
                Cancel
              </DeleteCancelButton>
              <DeleteConfirmButton onClick={handleDeleteMonth}>
                Remove Events
              </DeleteConfirmButton>
            </DeleteMonthButtons>
          </DeleteMonthContent>
        </DeleteMonthModal>
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

// Wrap the component with memo to prevent unnecessary re-renders
export default memo(MonthlyCompensationSummary, (prevProps, nextProps) => {
  // Only re-render if data length has changed
  if (prevProps.data.length !== nextProps.data.length) {
    return false;
  }
  
  // Check if any important data fields have changed
  for (let i = 0; i < prevProps.data.length; i++) {
    const prevItem = prevProps.data[i];
    const nextItem = nextProps.data[i];
    
    if (
      prevItem.type !== nextItem.type ||
      prevItem.amount !== nextItem.amount ||
      prevItem.count !== nextItem.count ||
      // Compare month dates if they exist
      (prevItem.month && nextItem.month && 
       new Date(prevItem.month).getTime() !== new Date(nextItem.month).getTime())
    ) {
      return false;
    }
  }
  
  // If we get here, no important props changed, so don't re-render
  return true;
}); 
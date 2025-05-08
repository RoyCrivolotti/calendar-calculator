import React, { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { storageService } from '../../services/storage';
import { logger } from '../../../utils/logger';
import { createMonthDate } from '../../../utils/calendarUtils';
import { trackOperation } from '../../../utils/errorHandler';

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

// New dashboard components
const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const DashboardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const DashboardTitle = styled.h2`
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
`;

const DashboardActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const MainMetricCard = styled.div`
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const MainMetricValue = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #0369a1;
  margin-bottom: 0.5rem;
`;

const MainMetricLabel = styled.div`
  font-size: 0.875rem;
  color: #64748b;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetricCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
`;

const MetricTitle = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MetricValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
`;

const MetricTrend = styled.div<{ isPositive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: ${props => props.isPositive ? '#10b981' : '#ef4444'};
  margin-top: 0.5rem;
`;

const DetailsSectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const DetailsSectionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ViewMoreButton = styled.button`
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
  
  &:hover {
    background: #f0f9ff;
  }
`;

const ChartSection = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const TrendChart = styled.div`
  height: 80px;
  margin: 1rem 0;
  display: flex;
  align-items: flex-end;
`;

const TrendPoint = styled.div<{ height: string, isSelected?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  
  &:hover .point {
    background-color: #3b82f6;
    transform: scale(1.2);
  }
  
  &:hover .line {
    background-color: #3b82f6;
  }
  
  &:hover .label {
    color: #3b82f6;
    font-weight: 500;
  }
`;

const TrendLine = styled.div<{ height: string, isSelected?: boolean }>`
  width: 2px;
  height: ${props => props.height};
  background-color: ${props => props.isSelected ? '#3b82f6' : '#cbd5e1'};
  margin-bottom: 0.25rem;
  transition: height 0.3s, background-color 0.2s;
  border-radius: 1px;
  
  &.animate {
    animation: grow 1s ease-out;
  }
  
  @keyframes grow {
    from { height: 0; }
    to { height: ${props => props.height}; }
  }
`;

const TrendDot = styled.div<{ isSelected?: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${props => props.isSelected ? '#3b82f6' : '#cbd5e1'};
  transition: transform 0.2s, background-color 0.2s;
`;

const TrendLabel = styled.div<{ isSelected?: boolean }>`
  font-size: 0.75rem;
  color: ${props => props.isSelected ? '#3b82f6' : '#64748b'};
  margin-top: 0.5rem;
  text-align: center;
  transition: color 0.2s;
`;

const StackedBarChart = styled.div`
  height: 30px;
  margin: 2rem 0;
  display: flex;
  border-radius: 6px;
  overflow: hidden;
`;

const StackedBarSegment = styled.div<{ width: string, color: string }>`
  height: 100%;
  width: ${props => props.width};
  background-color: ${props => props.color};
  transition: width 0.5s ease-out;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    opacity: 0.9;
  }
`;

const StackedBarLabel = styled.div`
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
`;

const DetailPanel = styled.div<{ isOpen: boolean }>`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: ${props => props.isOpen ? '1.25rem' : '0'};
  margin-top: 1rem;
  overflow: hidden;
  max-height: ${props => props.isOpen ? '1000px' : '0'};
  opacity: ${props => props.isOpen ? '1' : '0'};
  transition: all 0.3s ease-in-out;
`;

const ExpandButton = styled.button<{ isExpanded: boolean }>`
  background: none;
  border: none;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  border-radius: 4px;
  transition: background 0.2s;
  
  svg {
    transition: transform 0.3s;
    transform: ${props => props.isExpanded ? 'rotate(180deg)' : 'rotate(0)'};
  }
  
  &:hover {
    background: #f1f5f9;
    color: #334155;
  }
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem;
`;

const TabButton = styled.button<{ isActive: boolean }>`
  background: ${props => props.isActive ? '#f0f9ff' : 'transparent'};
  border: none;
  padding: 0.75rem 1rem;
  cursor: pointer;
  color: ${props => props.isActive ? '#0369a1' : '#64748b'};
  font-weight: ${props => props.isActive ? '600' : '500'};
  border-bottom: 2px solid ${props => props.isActive ? '#0369a1' : 'transparent'};
  transition: all 0.2s;
  
  &:hover {
    color: ${props => props.isActive ? '#0369a1' : '#334155'};
    background: ${props => props.isActive ? '#f0f9ff' : '#f8fafc'};
  }
`;

const SlidePanel = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 90%;
  max-width: 450px;
  height: 100vh;
  background: white;
  z-index: 1000;
  box-shadow: -4px 0 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s ease-in-out;
  overflow-y: auto;
`;

const SlidePanelBackdrop = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: ${props => props.isOpen ? '1' : '0'};
  pointer-events: ${props => props.isOpen ? 'auto' : 'none'};
  transition: opacity 0.3s ease;
`;

const SlidePanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SlidePanelTitle = styled.h2`
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
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

// Detail level for progressive disclosure
type DetailLevel = 'overview' | 'detailed' | 'full';

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

// Function to format duration
const formatDuration = (start: Date, end: Date) => {
  const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

// Render slide panel content based on the selected type
const renderSlidePanelContent = () => {
  switch (slidePanelContent) {
    case 'rates':
      return (
        <>
          <SlidePanelHeader>
            <SlidePanelTitle>Compensation Rates</SlidePanelTitle>
          </SlidePanelHeader>
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
        </>
      );
    
    case 'events':
      // Extract events from current month
      const events: Event[] = [];
      
      // Extract events from oncallData
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
      
      // Calculate pagination for on-call events
      const totalOncallPages = Math.ceil(groupedEvents.oncall.length / EVENTS_PER_PAGE);
      const oncallStartIndex = (oncallPage - 1) * EVENTS_PER_PAGE;
      const oncallEndIndex = Math.min(oncallStartIndex + EVENTS_PER_PAGE, groupedEvents.oncall.length);
      const paginatedOncallEvents = groupedEvents.oncall.slice(oncallStartIndex, oncallEndIndex);
      
      // Calculate pagination for incident events
      const totalIncidentPages = Math.ceil(groupedEvents.incident.length / EVENTS_PER_PAGE);
      const incidentStartIndex = (incidentPage - 1) * EVENTS_PER_PAGE;
      const incidentEndIndex = Math.min(incidentStartIndex + EVENTS_PER_PAGE, groupedEvents.incident.length);
      const paginatedIncidentEvents = groupedEvents.incident.slice(incidentStartIndex, incidentEndIndex);
      
      return (
        <>
          <SlidePanelHeader>
            <SlidePanelTitle>Events for {format(currentMonth, 'MMMM yyyy')}</SlidePanelTitle>
          </SlidePanelHeader>
          
          <TabContainer>
            <TabButton 
              isActive={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
            >
              All
            </TabButton>
            <TabButton 
              isActive={activeTab === 'oncall'}
              onClick={() => setActiveTab('oncall')}
            >
              On-Call ({groupedEvents.oncall.length})
            </TabButton>
            <TabButton 
              isActive={activeTab === 'incident'}
              onClick={() => setActiveTab('incident')}
            >
              Incidents ({groupedEvents.incident.length})
            </TabButton>
          </TabContainer>
          
          {/* On-Call Shifts */}
          {(activeTab === 'all' || activeTab === 'oncall') && groupedEvents.oncall.length > 0 && (
            <EventTypeSection>
              <EventTypeName>
                On-Call Shifts
                <EventCount>{groupedEvents.oncall.length} events</EventCount>
              </EventTypeName>
              
              {paginatedOncallEvents.map(event => (
                <EventItem key={event.id}>
                  <EventTime>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'MMM d, HH:mm')}
                  </EventTime>
                  <EventMetadata>
                    {event.isHoliday && <HolidayIndicator>Holiday</HolidayIndicator>}
                    <EventDuration>
                      Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                    </EventDuration>
                  </EventMetadata>
                </EventItem>
              ))}
              
              {/* Pagination controls for on-call events */}
              {totalOncallPages > 1 && (
                <PaginationControls>
                  <PageInfo>
                    Showing {oncallStartIndex + 1}-{oncallEndIndex} of {groupedEvents.oncall.length}
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
            </EventTypeSection>
          )}
          
          {/* Incidents */}
          {(activeTab === 'all' || activeTab === 'incident') && groupedEvents.incident.length > 0 && (
            <EventTypeSection>
              <EventTypeName>
                Incidents
                <EventCount>{groupedEvents.incident.length} events</EventCount>
              </EventTypeName>
              
              {paginatedIncidentEvents.map(event => (
                <EventItem key={event.id}>
                  <EventTime>
                    {format(new Date(event.start), 'MMM d, HH:mm')} - {format(new Date(event.end), 'HH:mm')}
                  </EventTime>
                  <EventMetadata>
                    {event.isHoliday && <HolidayIndicator>Holiday</HolidayIndicator>}
                    <EventDuration>
                      Duration: {formatDuration(new Date(event.start), new Date(event.end))}
                    </EventDuration>
                  </EventMetadata>
                </EventItem>
              ))}
              
              {/* Pagination controls for incident events */}
              {totalIncidentPages > 1 && (
                <PaginationControls>
                  <PageInfo>
                    Showing {incidentStartIndex + 1}-{incidentEndIndex} of {groupedEvents.incident.length}
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
            </EventTypeSection>
          )}
          
          {/* Delete month section */}
          <DeleteMonthSection>
            <DeleteSectionText>
              Remove all events for this month, including events that overlap with other months.
            </DeleteSectionText>
            <DeleteMonthButton onClick={handleOpenDeleteMonthModal}>
              Remove All Events for {format(currentMonth, 'MMMM yyyy')}
            </DeleteMonthButton>
          </DeleteMonthSection>
        </>
      );
    
    case 'details':
      return (
        <>
          <SlidePanelHeader>
            <SlidePanelTitle>Monthly History</SlidePanelTitle>
          </SlidePanelHeader>
          
          {monthsWithData.map(({ date, data }) => {
            const total = data.find(d => d.type === 'total')?.amount || 0;
            const oncall = data.find(d => d.type === 'oncall')?.amount || 0;
            const incident = data.find(d => d.type === 'incident')?.amount || 0;
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth() && 
                                 date.getFullYear() === currentMonth.getFullYear();
            
            return (
              <div 
                key={date.toISOString()}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '0.75rem',
                  border: isCurrentMonth ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  backgroundColor: isCurrentMonth ? '#f0f9ff' : 'white'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: isCurrentMonth ? '#0369a1' : '#334155'
                  }}>
                    {format(date, 'MMMM yyyy')}
                    {isCurrentMonth && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#3b82f6' }}>Current</span>}
                  </h3>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
                    {formatCurrency(total)}
                  </div>
                </div>
                
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>On-Call:</span>
                    <span style={{ fontSize: '0.9rem', color: '#334155' }}>{formatCurrency(oncall)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Incidents:</span>
                    <span style={{ fontSize: '0.9rem', color: '#334155' }}>{formatCurrency(incident)}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => {
                      handleMonthClick(date);
                      closeSlidePanel();
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </>
      );
    
    default:
      return null;
  }
};

// Main render function for the component
const MonthlyCompensationSummary: React.FC<MonthlyCompensationSummaryProps> = ({ data }) => {
  // Add logging to debug data
  useEffect(() => {
    logger.debug(`MonthlyCompensationSummary received data with ${data.length} items`);
    if (data.length > 0) {
      logger.debug(`Sample data: ${JSON.stringify(data[0])}`);
    }
  }, [data]);

  // State for selected month and UI display
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('overview');
  const [showDeleteMonthModal, setShowDeleteMonthModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'oncall' | 'incident'>('all');
  const [isVisible, setIsVisible] = useState(false);
  const [slidePanelOpen, setSlidePanelOpen] = useState(false);
  const [slidePanelContent, setSlidePanelContent] = useState<'rates' | 'events' | 'details'>('details');
  
  // Animation state
  const [chartAnimationStarted, setChartAnimationStarted] = useState(false);
  
  // State for pagination
  const EVENTS_PER_PAGE = 10;
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
  
  // Keep tooltip state for pie chart (for backward compatibility)
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: string;
    amount: string;
    percentage: string;
  } | null>(null);
  
  // References
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);

  // Generate list of months (from all data)
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
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);
  
  // Get current month if available, otherwise use most recent
  const currentMonth = useMemo(() => {
    if (selectedMonth) return selectedMonth;
    
    // If no month is selected, use most recent month
    if (monthsWithData.length > 0) {
      return monthsWithData[0].date;
    }
    
    // Fall back to current month
    return new Date();
  }, [selectedMonth, monthsWithData]);

  // Separate data by type
  const oncallData = useMemo(() => 
    data.filter(item => item.type === 'oncall'), 
    [data]
  );

  const incidentData = useMemo(() => 
    data.filter(item => item.type === 'incident'), 
    [data]
  );

  const totalData = useMemo(() => 
    data.filter(item => item.type === 'total'), 
    [data]
  );

  // Get the total amount for the current month
  const monthTotal = useMemo(() => 
    totalData.length > 0 ? totalData[0].amount : 0,
    [totalData]
  );

  // Calculate previous month total if available
  const previousMonthTotal = useMemo(() => {
    if (monthsWithData.length < 2) return null;
    
    const currentIndex = monthsWithData.findIndex(item => 
      item.date.getFullYear() === currentMonth.getFullYear() && 
      item.date.getMonth() === currentMonth.getMonth()
    );
    
    if (currentIndex === -1 || currentIndex >= monthsWithData.length - 1) return null;
    
    const prevMonth = monthsWithData[currentIndex + 1];
    const prevTotal = prevMonth.data.find(item => item.type === 'total');
    
    return prevTotal ? prevTotal.amount : null;
  }, [monthsWithData, currentMonth]);

  // Calculate month-over-month change
  const monthOverMonthChange = useMemo(() => {
    if (!previousMonthTotal || previousMonthTotal === 0) return null;
    
    const change = ((monthTotal - previousMonthTotal) / previousMonthTotal) * 100;
    return {
      percentage: change.toFixed(1),
      isPositive: change >= 0
    };
  }, [monthTotal, previousMonthTotal]);

  // Extract hours from description for visualization
  const extractHoursData = (description: string): { weekday: number, weekend: number, nightShift: number, weekendNight: number } => {
    if (!description) {
      return { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    }
    
    const result = {
      weekday: 0,
      weekend: 0,
      nightShift: 0,
      weekendNight: 0
    };
    
    try {
      // Extract hours from description
      const weekdayMatch = description.match(/Weekday: (\d+) hours?/);
      const weekendMatch = description.match(/Weekend: (\d+) hours?/);
      const nightShiftMatch = description.match(/Night shift: (\d+) hours?/);
      const weekendNightMatch = description.match(/Weekend night: (\d+) hours?/);
      
      if (weekdayMatch && weekdayMatch[1]) {
        result.weekday = parseInt(weekdayMatch[1], 10);
      }
      
      if (weekendMatch && weekendMatch[1]) {
        result.weekend = parseInt(weekendMatch[1], 10);
      }
      
      if (nightShiftMatch && nightShiftMatch[1]) {
        result.nightShift = parseInt(nightShiftMatch[1], 10);
      }
      
      if (weekendNightMatch && weekendNightMatch[1]) {
        result.weekendNight = parseInt(weekendNightMatch[1], 10);
      }
    } catch (error) {
      logger.error('Error parsing hours from description:', error);
    }
    
    return result;
  };
  
  // Calculate total hours
  const totalHours = useMemo(() => {
    let oncallHours = { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    let incidentHours = { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    if (oncallData.length > 0) {
      oncallHours = extractHoursData(oncallData[0].description);
    }
    
    if (incidentData.length > 0) {
      incidentHours = extractHoursData(incidentData[0].description);
    }
    
    return (
      oncallHours.weekday + 
      oncallHours.weekend + 
      incidentHours.weekday + 
      incidentHours.weekend + 
      incidentHours.nightShift + 
      incidentHours.weekendNight
    );
  }, [oncallData, incidentData]);
  
  // Get total events count
  const totalEventsCount = useMemo(() => {
    let count = 0;
    
    if (oncallData.length > 0 && oncallData[0].count) {
      count += oncallData[0].count;
    }
    
    if (incidentData.length > 0 && incidentData[0].count) {
      count += incidentData[0].count;
    }
    
    return count;
  }, [oncallData, incidentData]);

  // Handler for month selection
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
  
  // Show slide panel with specific content
  const openSlidePanel = useCallback((content: 'rates' | 'events' | 'details') => {
    setSlidePanelContent(content);
    setSlidePanelOpen(true);
  }, []);
  
  // Close slide panel
  const closeSlidePanel = useCallback(() => {
    setSlidePanelOpen(false);
  }, []);
  
  // Calculate percentage for each category
  const getPercentage = (amount: number): string => {
    if (!monthTotal) return '0%';
    return `${Math.round((amount / monthTotal) * 100)}%`;
  };
  
  // Format currency value
  const formatCurrency = (amount: number): string => {
    return `€${amount.toFixed(2)}`;
  };
  
  // Function to get trend data for the chart
  const getTrendData = () => {
    const months = [...monthsWithData];
    let maxTotal = 0;
    
    // Find max total for scaling
    months.forEach(month => {
      const total = month.data.find(d => d.type === 'total');
      if (total && total.amount > maxTotal) {
        maxTotal = total.amount;
      }
    });
    
    return { months, maxTotal };
  };
  
  // Handler for clear all data confirmation
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
  
  // Handler for delete month
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

  // Handlers for delete month modal
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

  // New dashboard trend chart
  const renderTrendChart = () => {
    const { months, maxTotal } = getTrendData();
    
    if (months.length === 0) return null;
    
    return (
      <TrendChart ref={trendChartRef}>
        {months.map((month, index) => {
          const total = month.data.find(d => d.type === 'total');
          const amount = total ? total.amount : 0;
          const height = maxTotal > 0 ? `${(amount / maxTotal) * 70}px` : '0px';
          const isSelected = selectedMonth ? 
            month.date.getMonth() === selectedMonth.getMonth() && 
            month.date.getFullYear() === selectedMonth.getFullYear() : 
            index === 0;
          
          return (
            <TrendPoint 
              key={month.date.toISOString()}
              onClick={() => handleMonthClick(month.date)}
              title={`${format(month.date, 'MMMM yyyy')}: €${amount.toFixed(2)}`}
              height={height}
            >
              <TrendLine 
                height={height} 
                isSelected={isSelected} 
                className={chartAnimationStarted ? 'animate' : ''}
                style={{ animationDelay: `${index * 150}ms` }}
              />
              <TrendDot isSelected={isSelected} className="point" />
              <TrendLabel isSelected={isSelected} className="label">
                {format(month.date, 'MMM')}
              </TrendLabel>
            </TrendPoint>
          );
        })}
      </TrendChart>
    );
  };
  
  // New stacked bar chart for hours breakdown
  const renderStackedHoursChart = () => {
    if (oncallData.length === 0 && incidentData.length === 0) return null;
    
    const oncallHours = oncallData.length > 0 ? extractHoursData(oncallData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    const incidentHours = incidentData.length > 0 ? extractHoursData(incidentData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    const totalHrs = (
      oncallHours.weekday + 
      oncallHours.weekend + 
      incidentHours.weekday + 
      incidentHours.weekend + 
      incidentHours.nightShift + 
      incidentHours.weekendNight
    );
    
    if (totalHrs === 0) return null;
    
    const segments = [];
    
    // Only add segments for hours that exist
    if (oncallHours.weekday > 0) {
      const percentage = (oncallHours.weekday / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="weekday-oncall" 
          width={`${percentage}%`} 
          color="#3b82f6"
          onMouseEnter={(e) => showTooltip(e, "Weekday On-Call", `${oncallHours.weekday} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {oncallHours.weekday}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (oncallHours.weekend > 0) {
      const percentage = (oncallHours.weekend / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="weekend-oncall" 
          width={`${percentage}%`} 
          color="#93c5fd"
          onMouseEnter={(e) => showTooltip(e, "Weekend On-Call", `${oncallHours.weekend} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {oncallHours.weekend}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (incidentHours.weekday > 0) {
      const percentage = (incidentHours.weekday / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="weekday-incident" 
          width={`${percentage}%`} 
          color="#dc2626"
          onMouseEnter={(e) => showTooltip(e, "Weekday Incident", `${incidentHours.weekday} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {incidentHours.weekday}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (incidentHours.weekend > 0) {
      const percentage = (incidentHours.weekend / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="weekend-incident" 
          width={`${percentage}%`} 
          color="#fca5a5"
          onMouseEnter={(e) => showTooltip(e, "Weekend Incident", `${incidentHours.weekend} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {incidentHours.weekend}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (incidentHours.nightShift > 0) {
      const percentage = (incidentHours.nightShift / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="night-incident" 
          width={`${percentage}%`} 
          color="#9f1239"
          onMouseEnter={(e) => showTooltip(e, "Night Shift Incident", `${incidentHours.nightShift} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {incidentHours.nightShift}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (incidentHours.weekendNight > 0) {
      const percentage = (incidentHours.weekendNight / totalHrs) * 100;
      segments.push(
        <StackedBarSegment 
          key="weekend-night" 
          width={`${percentage}%`} 
          color="#f43f5e"
          onMouseEnter={(e) => showTooltip(e, "Weekend Night", `${incidentHours.weekendNight} hours`, `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {incidentHours.weekendNight}h
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    return (
      <>
        <DetailsSectionHeader>
          <DetailsSectionTitle>Hours Breakdown</DetailsSectionTitle>
        </DetailsSectionHeader>
        <StackedBarChart>
          {segments}
        </StackedBarChart>
        <Legend>
          {oncallHours.weekday > 0 && (
            <LegendItem>
              <LegendColor color="#3b82f6" />
              <span>Weekday On-Call</span>
            </LegendItem>
          )}
          {oncallHours.weekend > 0 && (
            <LegendItem>
              <LegendColor color="#93c5fd" />
              <span>Weekend On-Call</span>
            </LegendItem>
          )}
          {incidentHours.weekday > 0 && (
            <LegendItem>
              <LegendColor color="#dc2626" />
              <span>Weekday Incident</span>
            </LegendItem>
          )}
          {incidentHours.weekend > 0 && (
            <LegendItem>
              <LegendColor color="#fca5a5" />
              <span>Weekend Incident</span>
            </LegendItem>
          )}
          {incidentHours.nightShift > 0 && (
            <LegendItem>
              <LegendColor color="#9f1239" />
              <span>Night Shift Incident</span>
            </LegendItem>
          )}
          {incidentHours.weekendNight > 0 && (
            <LegendItem>
              <LegendColor color="#f43f5e" />
              <span>Weekend Night</span>
            </LegendItem>
          )}
        </Legend>
      </>
    );
  };
  
  // New stacked bar chart for compensation breakdown
  const renderStackedCompensationChart = () => {
    if (oncallData.length === 0 && incidentData.length === 0) return null;
    
    const segments = [];
    
    if (oncallData.length > 0) {
      const oncallAmount = oncallData[0].amount;
      const percentage = (oncallAmount / monthTotal) * 100;
      
      segments.push(
        <StackedBarSegment 
          key="oncall-compensation" 
          width={`${percentage}%`} 
          color="#3b82f6"
          onMouseEnter={(e) => showTooltip(e, "On-Call Compensation", formatCurrency(oncallAmount), `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {percentage > 10 ? `${formatCurrency(oncallAmount)}` : ''}
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    if (incidentData.length > 0) {
      const incidentAmount = incidentData[0].amount;
      const percentage = (incidentAmount / monthTotal) * 100;
      
      segments.push(
        <StackedBarSegment 
          key="incident-compensation" 
          width={`${percentage}%`} 
          color="#dc2626"
          onMouseEnter={(e) => showTooltip(e, "Incident Compensation", formatCurrency(incidentAmount), `${percentage.toFixed(1)}% of total`)}
          onMouseMove={(e) => setGlobalTooltip(prev => ({ ...prev, x: e.clientX + 15, y: e.clientY + 15 }))}
          onMouseLeave={hideTooltip}
        >
          <StackedBarLabel>
            {percentage > 10 ? `${formatCurrency(incidentAmount)}` : ''}
          </StackedBarLabel>
        </StackedBarSegment>
      );
    }
    
    return (
      <>
        <DetailsSectionHeader>
          <DetailsSectionTitle>Compensation Breakdown</DetailsSectionTitle>
        </DetailsSectionHeader>
        <StackedBarChart>
          {segments}
        </StackedBarChart>
        <Legend>
          {oncallData.length > 0 && (
            <LegendItem>
              <LegendColor color="#3b82f6" />
              <span>On-Call: {formatCurrency(oncallData[0].amount)} ({getPercentage(oncallData[0].amount)})</span>
            </LegendItem>
          )}
          {incidentData.length > 0 && (
            <LegendItem>
              <LegendColor color="#dc2626" />
              <span>Incidents: {formatCurrency(incidentData[0].amount)} ({getPercentage(incidentData[0].amount)})</span>
            </LegendItem>
          )}
        </Legend>
      </>
    );
  };

  // Dashboard overview section
  const renderDashboardOverview = () => {
    return (
      <DashboardContainer>
        <DashboardHeader>
          <DashboardTitle>Monthly Compensation Summary</DashboardTitle>
          <DashboardActions>
            {/* Actions menu could go here */}
          </DashboardActions>
        </DashboardHeader>
        
        {/* Main metric - Total compensation */}
        <MainMetricCard>
          <MainMetricValue>{formatCurrency(monthTotal)}</MainMetricValue>
          <MainMetricLabel>Total Compensation for {format(currentMonth, 'MMMM yyyy')}</MainMetricLabel>
          
          {/* Show month-over-month change if available */}
          {monthOverMonthChange && (
            <MetricTrend isPositive={monthOverMonthChange.isPositive === true}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d={monthOverMonthChange.isPositive ? 
                    "M7 14l5-5 5 5" : 
                    "M7 10l5 5 5-5"} 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                {monthOverMonthChange.isPositive ? '+' : ''}{monthOverMonthChange.percentage}% from last month
              </span>
            </MetricTrend>
          )}
        </MainMetricCard>
        
        {/* Month trend chart */}
        <ChartSection>
          <DetailsSectionHeader>
            <DetailsSectionTitle>Monthly Trend</DetailsSectionTitle>
            <ViewMoreButton onClick={() => openSlidePanel('details')}>
              View History
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </ViewMoreButton>
          </DetailsSectionHeader>
          {renderTrendChart()}
        </ChartSection>
        
        {/* Key metrics */}
        <MetricsGrid>
          {/* On-Call metric */}
          {oncallData.length > 0 && (
            <MetricCard onClick={() => setSelectedMonth(currentMonth)}>
              <MetricTitle>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                On-Call Compensation
              </MetricTitle>
              <MetricValue>{formatCurrency(oncallData[0].amount)}</MetricValue>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                {oncallData[0].count} shifts
              </div>
            </MetricCard>
          )}
          
          {/* Incident metric */}
          {incidentData.length > 0 && (
            <MetricCard onClick={() => setSelectedMonth(currentMonth)}>
              <MetricTitle>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 9v4" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 17h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Incident Compensation
              </MetricTitle>
              <MetricValue>{formatCurrency(incidentData[0].amount)}</MetricValue>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                {incidentData[0].count} incidents
              </div>
            </MetricCard>
          )}
          
          {/* Total hours metric */}
          <MetricCard onClick={() => setSelectedMonth(currentMonth)}>
            <MetricTitle>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6v6l4 2" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Total Hours
            </MetricTitle>
            <MetricValue>{totalHours}h</MetricValue>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              {totalEventsCount} events
            </div>
          </MetricCard>
        </MetricsGrid>
        
        {/* Expandable details section */}
        <ChartSection>
          <DetailsSectionHeader>
            <DetailsSectionTitle>
              Monthly Details
            </DetailsSectionTitle>
            <ExpandButton 
              isExpanded={isDetailPanelOpen} 
              onClick={() => setIsDetailPanelOpen(prev => !prev)}
              aria-label={isDetailPanelOpen ? "Collapse details" : "Expand details"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </ExpandButton>
          </DetailsSectionHeader>
          
          <DetailPanel isOpen={isDetailPanelOpen}>
            {renderStackedHoursChart()}
            {renderStackedCompensationChart()}
            
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <ViewMoreButton onClick={() => openSlidePanel('events')}>
                View All Events
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </ViewMoreButton>
              
              <ViewMoreButton onClick={() => openSlidePanel('rates')} style={{ marginLeft: '1rem' }}>
                View Compensation Rates
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </ViewMoreButton>
            </div>
          </DetailPanel>
        </ChartSection>
        
        {/* Data management section - Only visible on expanded view */}
        {isDetailPanelOpen && (
          <ClearDataSection>
            <ClearDataButton onClick={handleClearAllData}>
              Clear All Calendar Data
            </ClearDataButton>
            <ClearDataWarning>Warning: This will permanently delete all events and compensation data.</ClearDataWarning>
          </ClearDataSection>
        )}
      </DashboardContainer>
    );
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
      
      {/* Main dashboard */}
      {renderDashboardOverview()}
      
      {/* Slide-in panel for detailed views */}
      <SlidePanelBackdrop isOpen={slidePanelOpen} onClick={closeSlidePanel} />
      <SlidePanel isOpen={slidePanelOpen}>
        <CloseButton onClick={closeSlidePanel} aria-label="Close panel">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </CloseButton>
        
        {renderSlidePanelContent()}
      </SlidePanel>
      
      {/* Confirmation modal for data clearing */}
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
      
      {/* Delete month confirmation modal */}
      {showDeleteMonthModal && (
        <DeleteMonthModal onClick={handleCloseDeleteMonthModal}>
          <DeleteMonthContent onClick={e => e.stopPropagation()}>
            <DeleteMonthTitle>Remove All Events for {format(currentMonth, 'MMMM yyyy')}?</DeleteMonthTitle>
            <DeleteSectionText>
              This will permanently remove all events that overlap with {format(currentMonth, 'MMMM yyyy')}. 
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
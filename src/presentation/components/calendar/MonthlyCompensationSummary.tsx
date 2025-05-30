import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import styled from '@emotion/styled';
import { CompensationBreakdown } from '../../../domain/calendar/types/CompensationBreakdown';
import { logger } from '../../../utils/logger';
import { trackOperation } from '../../../utils/errorHandler';
import { container } from '../../../config/container';
import { CalendarEventRepository } from '../../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../../domain/calendar/repositories/SubEventRepository';
// ADD: Import for Redux state to get current user (optional, as repos handle it, but good for consistency)
import { useAppSelector } from '../../store/hooks'; // Assuming standard hook setup
import { RootState } from '../../store'; // Assuming RootState is exported from store
import { 
  ChevronRightIcon, 
  DollarIcon,
  XIcon
} from '../../../assets/icons';
import { extractHoursData } from '../../../utils/compensation/compensationUtils';
import { formatMonthYear } from '../../../utils/formatting/formatters';
// Import UI components
import { 
  Button, 
  Modal, 
  ModalHeader, 
  ModalTitle, 
  ModalBody, 
  ModalFooter, 
  Tooltip,
  SidePanel,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelBody,
  SidePanelCloseButton,
  SidePanelTabs,
  SidePanelTab,
  SharedEventsPanelContent,
  type SharedPanelEvent,
  BarChart,
  type BarChartItem,
  PieChart,
  type PieChartItem,
  MonthScroller,
  type MonthScrollerItem,
  ChartLegend,
  type LegendItemProps,
  SharedPageSection,
  SharedSectionTitle,
  SharedButtonRow,
  SharedWarningText
} from '../common/ui';
import SharedRatesPanelContent from '../common/SharedRatesPanelContent';
// Import custom hooks
import { useTooltip, useSidePanel } from '../../hooks';

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

const ClearDataSection = styled.div`
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const DeleteMonthSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 2rem 0;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
`;

interface MonthData {
  date: Date;
  data: CompensationBreakdown[];
}

interface MonthlyCompensationSummaryProps {
  data: CompensationBreakdown[];
  onDataChange?: () => void; // ADD: Callback for data refresh
}

const MonthlyCompensationSummary: React.FC<MonthlyCompensationSummaryProps> = ({ data, onDataChange }) => { // ADD: onDataChange to destructuring
  useEffect(() => {
    logger.debug(`MonthlyCompensationSummary received data with ${data.length} items`);
    if (data.length > 0) {
      logger.debug(`Sample data: ${JSON.stringify(data[0])}`);
    }
  }, [data]);

  // ADD: Get repositories and current user
  const calendarEventRepository = useMemo(() => container.get<CalendarEventRepository>('calendarEventRepository'), []);
  const subEventRepository = useMemo(() => container.get<SubEventRepository>('subEventRepository'), []);
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser); // Get currentUser from Redux

  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteMonthModal, setShowDeleteMonthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'oncall' | 'incident'>('all');
  const [isVisible, setIsVisible] = useState(false);
  
  const { tooltipState, showTooltip, hideTooltip, updateTooltipPosition } = useTooltip();
  
  const { 
    isOpen: sidePanelOpen, 
    contentType: sidePanelContent, 
    openPanel,
    closePanel: closeSidePanel,
    setContent: setSidePanelContentForHook
  } = useSidePanel({
    defaultContent: 'events'
  });

  const [sidePanelTab, setSidePanelTab] = useState<'all' | 'oncall' | 'incident'>('all');
  
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConfirmModal) {
          setShowConfirmModal(false);
        } else if (showDeleteMonthModal) {
          setShowDeleteMonthModal(false);
        } else if (selectedMonth) {
          setSelectedMonth(null);
          closeSidePanel();
          hideTooltip();
        }
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedMonth, showConfirmModal, showDeleteMonthModal, closeSidePanel, hideTooltip]);

  const monthsWithData = useMemo(() => {
    const result: MonthData[] = [];
    
    logger.debug('Monthly Summary Data:', data.length);
    
    const months = new Map<string, Date>();
    data.forEach(d => {
      if (d.month) {
        try {
          const monthDate = d.month instanceof Date ? d.month : new Date(d.month);
          const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
          
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

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const handleMonthClick = useCallback((month: Date) => {
    setIsVisible(false);
    setSelectedMonth(month);
    setActiveTab('all');
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedMonth(null);
    closeSidePanel();
    hideTooltip();
  }, [closeSidePanel, hideTooltip]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  }, [handleCloseModal]);

  const handleClearAllData = useCallback(async () => {
    logger.info('User initiated clearing of all calendar data');
    setShowConfirmModal(true);
  }, []);

  const handleConfirmClear = useCallback(async () => {
    if (!currentUser?.uid) {
      logger.error('[MonthlySummary] Cannot clear data: User not authenticated.');
      alert('Error: You must be logged in to clear data.');
      setShowConfirmModal(false);
      return;
    }

    logger.info(`[MonthlySummary] User ${currentUser.uid} initiated clearing of ALL calendar data.`);
    // ADD: Loading state if this operation is long
    // setLoading(true); 

    try {
      await trackOperation(
        'ClearAllUserData',
        async () => {
          const allEvents = await calendarEventRepository.getAll(); // Fetches for current user due to repo design
          logger.info(`[MonthlySummary] Found ${allEvents.length} events to delete for user ${currentUser.uid}.`);

          if (allEvents.length === 0) {
            logger.info('[MonthlySummary] No events to delete.');
            return { success: true, itemsCleared: 0 };
          }

          // Consider batching these deletes in the repository for performance if many events
          for (const event of allEvents) {
            await subEventRepository.deleteByParentId(event.id); // Delete associated sub-events
            await calendarEventRepository.delete(event.id);     // Delete the main event
            logger.debug(`[MonthlySummary] Deleted event ${event.id} and its sub-events.`);
          }
          
          logger.info(`[MonthlySummary] Successfully cleared ${allEvents.length} events and their sub-events for user ${currentUser.uid}.`);
          if (onDataChange) {
            onDataChange(); // Notify parent to refresh data
          }
          return { success: true, itemsCleared: allEvents.length };
        },
        {
          source: 'MonthlyCompensationSummary.ClearAll',
          userId: currentUser.uid
        }
      );
      alert('All your calendar data has been successfully cleared.');
    } catch (error) {
      logger.error('[MonthlySummary] Error clearing all user data:', error);
      alert('An error occurred while clearing your data. Please try again.');
    } finally {
      // setLoading(false);
      setShowConfirmModal(false);
      setSelectedMonth(null); // Reset selected month as data context has changed
    }
  }, [currentUser, calendarEventRepository, subEventRepository, onDataChange, trackOperation]);

  const handleCancelClear = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

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

  const monthTotal = totalData.length > 0 ? totalData[0].amount : 0;

  const getPercentage = (amount: number): string => {
    if (!monthTotal) return '0%';
    return `${Math.round((amount / monthTotal) * 100)}%`;
  };

  const renderHoursChart = () => {
    const oncallHours = oncallData.length > 0 ? extractHoursData(oncallData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    const incidentHours = incidentData.length > 0 ? extractHoursData(incidentData[0].description) : { weekday: 0, weekend: 0, nightShift: 0, weekendNight: 0 };
    
    const chartItems: BarChartItem[] = [];
    const allHoursValues = [
      oncallHours.weekday,
      oncallHours.weekend,
      incidentHours.weekday,
      incidentHours.weekend,
      incidentHours.nightShift,
      incidentHours.weekendNight
    ];
    const totalHoursForAllBars = allHoursValues.reduce((sum, h) => sum + h, 0);

    if (totalHoursForAllBars === 0) return null;
    
    if (oncallHours.weekday > 0) {
      chartItems.push({
        key: "weekday-oncall",
        value: oncallHours.weekday,
        label: "Weekday On-Call",
        color: "#3b82f6",
        totalForPercentage: totalHoursForAllBars
      });
    }
    if (oncallHours.weekend > 0) {
      chartItems.push({
        key: "weekend-oncall",
        value: oncallHours.weekend,
        label: "Weekend On-Call",
        color: "#93c5fd",
        totalForPercentage: totalHoursForAllBars
      });
    }
    if (incidentHours.weekday > 0) {
      chartItems.push({
        key: "weekday-incident",
        value: incidentHours.weekday,
        label: "Weekday Incident",
        color: "#dc2626",
        totalForPercentage: totalHoursForAllBars
      });
    }
    if (incidentHours.weekend > 0) {
      chartItems.push({
        key: "weekend-incident",
        value: incidentHours.weekend,
        label: "Weekend Incident",
        color: "#fca5a5",
        totalForPercentage: totalHoursForAllBars
      });
    }
    if (incidentHours.nightShift > 0) {
      chartItems.push({
        key: "night-incident",
        value: incidentHours.nightShift,
        label: "Night Shift Incident",
        color: "#9f1239",
        totalForPercentage: totalHoursForAllBars
      });
    }
    if (incidentHours.weekendNight > 0) {
      chartItems.push({
        key: "weekend-night",
        value: incidentHours.weekendNight,
        label: "Weekend Night",
        color: "#f43f5e",
        totalForPercentage: totalHoursForAllBars
      });
    }

    if (chartItems.length === 0) return null;
    
    return (
      <BarChart 
        data={chartItems}
        isVisible={isVisible}
        title="Hours Breakdown"
        showTooltip={showTooltip}
        hideTooltip={hideTooltip}
        updateTooltipPosition={updateTooltipPosition}
      />
    );
  };

  const getCompensationData = (): PieChartItem[] => {
    const result: PieChartItem[] = [];
    
    if (oncallData.length > 0) {
      const oncallHours = extractHoursData(oncallData[0].description);
      const totalOncallAmount = oncallData[0].amount;
      const totalOncallHours = oncallHours.weekday + oncallHours.weekend;
      
      if (oncallHours.weekday > 0 && totalOncallHours > 0) {
        const weekdayProportion = oncallHours.weekday / totalOncallHours;
        const amount = totalOncallAmount * weekdayProportion;
        result.push({
          key: 'weekday-oncall-pie',
          label: 'Weekday On-Call',
          value: amount,
          color: '#3b82f6'
        });
      }
      
      if (oncallHours.weekend > 0 && totalOncallHours > 0) {
        const weekendProportion = oncallHours.weekend / totalOncallHours;
        const amount = totalOncallAmount * weekendProportion;
        result.push({
          key: 'weekend-oncall-pie',
          label: 'Weekend On-Call',
          value: amount,
          color: '#93c5fd'
        });
      }
    }
    
    if (incidentData.length > 0) {
      const hours = extractHoursData(incidentData[0].description);
      const totalIncidentAmount = incidentData[0].amount;
      const totalIncidentHours = 
        hours.weekday + 
        hours.weekend + 
        hours.nightShift + 
        hours.weekendNight;
      
      if (totalIncidentHours > 0) {
        if (hours.weekday > 0) {
          const proportion = hours.weekday / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            key: 'weekday-incident-pie',
            label: 'Weekday Incident',
            value: amount,
            color: '#dc2626'
          });
        }
        if (hours.weekend > 0) {
          const proportion = hours.weekend / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            key: 'weekend-incident-pie',
            label: 'Weekend Incident',
            value: amount,
            color: '#fca5a5'
          });
        }
        if (hours.nightShift > 0) {
          const proportion = hours.nightShift / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            key: 'night-shift-incident-pie',
            label: 'Night Shift Incident',
            value: amount,
            color: '#9f1239'
          });
        }
        if (hours.weekendNight > 0) {
          const proportion = hours.weekendNight / totalIncidentHours;
          const amount = totalIncidentAmount * proportion;
          result.push({
            key: 'weekend-night-pie',
            label: 'Weekend Night',
            value: amount,
            color: '#f43f5e'
          });
        }
      }
    }
    
    return result;
  };

  const renderCompensationPieChart = () => {
    const compensationPieData = getCompensationData();
    
    if (compensationPieData.length === 0) return null;
      
      return (
      <PieChart
        data={compensationPieData}
        isVisible={isVisible}
        title="Compensation Breakdown"
        showTooltip={showTooltip}
        hideTooltip={hideTooltip}
        updateTooltipPosition={updateTooltipPosition}
        size={220}
      />
    );
  };

  const openCompensationSectionPanel = (panelType: 'events' | 'rates') => {
    setSidePanelContentForHook(panelType);
    if (panelType === 'events') setSidePanelTab('all');
    openPanel(); 
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

  const selectedMonthIndex = useMemo(() => {
    if (!selectedMonth) return -1;
    return monthsWithData.findIndex(m => m.date.getTime() === selectedMonth.getTime());
  }, [selectedMonth, monthsWithData]);

  const handleDeleteMonthData = useCallback(async () => {
    if (!selectedMonth) {
      logger.warn('No month selected for deletion attempt.');
      return;
    }
    setShowDeleteMonthModal(true);
  }, [selectedMonth]);

  const handleConfirmDeleteMonth = useCallback(async () => {
    if (!selectedMonth) {
      logger.error('[MonthlySummary] Confirmation to delete month data, but no month is selected.');
      setShowDeleteMonthModal(false);
      return;
    }
    if (!currentUser?.uid) {
      logger.error('[MonthlySummary] Cannot delete month data: User not authenticated.');
      alert('Error: You must be logged in to delete data.');
      setShowDeleteMonthModal(false);
      return;
    }

    const monthToClear = new Date(selectedMonth);
    logger.info(`[MonthlySummary] User ${currentUser.uid} initiated deletion of data for month: ${formatMonthYear(monthToClear)}.`);
    // ADD: Loading state if this operation is long
    // setLoading(true);

    try {
      await trackOperation(
        'DeleteMonthUserData',
        async () => {
          const allUserEvents = await calendarEventRepository.getAll(); // Fetches for current user

          const monthStart = new Date(monthToClear.getFullYear(), monthToClear.getMonth(), 1, 0, 0, 0, 0);
          const monthEnd = new Date(monthToClear.getFullYear(), monthToClear.getMonth() + 1, 0, 23, 59, 59, 999);

          const eventsToDelete = allUserEvents.filter(event => {
            const eventStart = event.start; // Already Date objects from Firestore repository
            const eventEnd = event.end;     // Already Date objects
            // Check if event overlaps with the selected month
            return eventStart <= monthEnd && eventEnd >= monthStart;
          });

          logger.info(`[MonthlySummary] Found ${eventsToDelete.length} events in ${formatMonthYear(monthToClear)} to delete for user ${currentUser.uid}.`);

          if (eventsToDelete.length === 0) {
            logger.info(`[MonthlySummary] No events to delete in ${formatMonthYear(monthToClear)}.`);
            return { success: true, itemsCleared: 0 };
          }

          for (const event of eventsToDelete) {
            await subEventRepository.deleteByParentId(event.id);
            await calendarEventRepository.delete(event.id);
            logger.debug(`[MonthlySummary] Deleted event ${event.id} (month: ${formatMonthYear(monthToClear)}) and its sub-events.`);
          }

          logger.info(`[MonthlySummary] Successfully cleared ${eventsToDelete.length} events for month ${formatMonthYear(monthToClear)} for user ${currentUser.uid}.`);
          if (onDataChange) {
            onDataChange(); // Notify parent to refresh data
          }
          return { success: true, itemsCleared: eventsToDelete.length };
        },
        {
          source: 'MonthlyCompensationSummary.DeleteMonth',
          userId: currentUser.uid,
          month: formatMonthYear(monthToClear)
        }
      );
      alert(`Successfully deleted all events for ${formatMonthYear(monthToClear)}.`);
    } catch (error) {
      logger.error(`[MonthlySummary] Error deleting data for month ${formatMonthYear(monthToClear)}:`, error);
      alert(`An error occurred while deleting data for ${formatMonthYear(monthToClear)}. Please try again.`);
    } finally {
      // setLoading(false);
      setShowDeleteMonthModal(false);
      setSelectedMonth(null); // Reset selected month as data context has changed
    }
  }, [selectedMonth, currentUser, calendarEventRepository, subEventRepository, onDataChange, trackOperation]);

  const handleCancelDeleteMonth = useCallback(() => {
    setShowDeleteMonthModal(false);
  }, []);

  const monthScrollerItems = useMemo((): MonthScrollerItem[] => {
    return monthsWithData.map(monthData => ({
      id: monthData.date.toISOString(),
      date: monthData.date,
      displayValue: `${monthData.data.find(d => d.type === 'total')?.amount.toFixed(2)}€`
    }));
  }, [monthsWithData]);

  const handleMonthScrollerSelect = useCallback((id: string, date: Date) => {
    handleMonthClick(date);
  }, [handleMonthClick]);

  const renderChartLegend = () => {
    const legendItems: LegendItemProps[] = [];
    if (oncallData.length > 0) {
      const hours = extractHoursData(oncallData[0].description);
      if (hours.weekday > 0) legendItems.push({ label: "Weekday On-Call", color: "#3b82f6" });
      if (hours.weekend > 0) legendItems.push({ label: "Weekend On-Call", color: "#93c5fd" });
    }
    if (incidentData.length > 0) {
      const hours = extractHoursData(incidentData[0].description);
      if (hours.weekday > 0) legendItems.push({ label: "Weekday Incident", color: "#dc2626" });
      if (hours.weekend > 0) legendItems.push({ label: "Weekend Incident", color: "#fca5a5" });
      if (hours.nightShift && hours.nightShift > 0) legendItems.push({ label: "Night Shift Incident", color: "#9f1239" });
      if (hours.weekendNight && hours.weekendNight > 0) legendItems.push({ label: "Weekend Night", color: "#f43f5e" });
    }

    if (legendItems.length === 0 || (!renderHoursChart() && !renderCompensationPieChart())) {
      return null;
    }
    return <ChartLegend items={legendItems} />;
  };

  return (
    <SharedPageSection>
      <Tooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        title={tooltipState.content.title}
        value={tooltipState.content.value}
        extra={tooltipState.content.extra}
      />
      
      <SidePanel isOpen={sidePanelOpen} baseZIndex={10050}>
        <SidePanelHeader>
          <SidePanelTitle>
            {sidePanelContent === 'events' 
              ? `Events for ${selectedMonth ? formatMonthYear(selectedMonth) : ''}` 
              : 'Compensation Rates'}
          </SidePanelTitle>
          <SidePanelCloseButton onClick={closeSidePanel}>
            <XIcon />
          </SidePanelCloseButton>
        </SidePanelHeader>
        <SidePanelBody>
          {sidePanelContent === 'events' ? (
            <>
              <SidePanelTabs>
                <SidePanelTab isActive={sidePanelTab === 'all'} onClick={() => setSidePanelTab('all')}>All</SidePanelTab>
                <SidePanelTab isActive={sidePanelTab === 'oncall'} onClick={() => setSidePanelTab('oncall')}>On-call</SidePanelTab>
                <SidePanelTab isActive={sidePanelTab === 'incident'} onClick={() => setSidePanelTab('incident')}>Incidents</SidePanelTab>
              </SidePanelTabs>
              {(() => {
                const oncallSource = oncallData.length > 0 && oncallData[0].events ? oncallData[0].events : [];
                const incidentSource = incidentData.length > 0 && incidentData[0].events ? incidentData[0].events : [];

                const currentOncallEvents: SharedPanelEvent[] = oncallSource.map(e => ({ 
                  ...e,
                  type: 'oncall' as const, 
                  start: new Date(e.start), 
                  end: new Date(e.end) 
                }));
                const currentIncidentEvents: SharedPanelEvent[] = incidentSource.map(e => ({ 
                  ...e,
                  type: 'incident' as const, 
                  start: new Date(e.start), 
                  end: new Date(e.end) 
                }));

                return (
                  <SharedEventsPanelContent 
                    oncallEvents={currentOncallEvents}
                    incidentEvents={currentIncidentEvents}
                    activeTab={sidePanelTab}
                  />
                );
              })()}
            </>
          ) : (
            <SharedRatesPanelContent displayMode="compact" />
          )}
        </SidePanelBody>
      </SidePanel>
      
      <SharedSectionTitle>Monthly Compensation Summary</SharedSectionTitle>
      
      <MonthScroller 
        items={monthScrollerItems}
        selectedItemId={selectedMonth ? selectedMonth.toISOString() : null}
        onItemSelect={handleMonthScrollerSelect}
      />

      {selectedMonth && (
        <Modal isOpen={!!selectedMonth} onClose={handleCloseModal}>
            <ModalHeader>
            <ModalTitle>{formatMonthYear(selectedMonth)}</ModalTitle>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: 600,
              color: '#0f172a',
              background: '#f0f9ff',
              padding: '0.5rem 0.5rem',
              marginLeft: '12px',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              €{monthTotal.toFixed(2)}
            </div>
            </ModalHeader>
            
          <ModalBody>
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
                      (() => {
                        const hours = extractHoursData(oncallData[0].description);
                        return (hours.weekday + hours.weekend).toFixed(1);
                      })() : 0}
                  </div>
                </div>
              </div>
            </div>
            
            <SharedButtonRow>
              <Button 
                variant="secondary" 
                onClick={() => openCompensationSectionPanel('events')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                View All Events
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => openCompensationSectionPanel('rates')}
              >
                <DollarIcon />
                View Compensation Rates
                <ChevronRightIcon />
              </Button>
            </SharedButtonRow>
            
            <ChartContainer>
              <ChartGrid>
                {renderHoursChart()}
                {renderCompensationPieChart()}
              </ChartGrid>
              
              {renderChartLegend()}
            </ChartContainer>
            
            <DeleteMonthSection>
              <p style={{ color: '#64748b', margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
                Remove all events for this month, including events that overlap with other months.
              </p>
              <Button style={{ width: 'fit-content' }} variant="danger" onClick={handleDeleteMonthData}>
                Remove All Events for {formatMonthYear(selectedMonth)}
              </Button>
            </DeleteMonthSection>
          </ModalBody>
        </Modal>
      )}

      {showConfirmModal && (
        <Modal isOpen={showConfirmModal} onClose={handleCancelClear}>
          <ModalHeader>
            <ModalTitle>Clear All Data</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to clear all calendar data? <br />
              This action cannot be undone and will remove all events and compensation data.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={handleCancelClear}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmClear}>Delete All Data</Button>
          </ModalFooter>
        </Modal>
      )}

      {showDeleteMonthModal && selectedMonth && (
        <Modal isOpen={showDeleteMonthModal} onClose={handleCancelDeleteMonth}>
          <ModalHeader>
            <ModalTitle>Remove All Events for {formatMonthYear(selectedMonth)}?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p>
              This will permanently remove all events that overlap with {formatMonthYear(selectedMonth)}. 
              This includes events that start in previous months or end in future months.
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={handleCancelDeleteMonth}>
                Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteMonth}>
                Remove Events
            </Button>
          </ModalFooter>
        </Modal>
      )}

      <ClearDataSection>
        <Button variant="danger" onClick={handleClearAllData}>
          Clear All Calendar Data
        </Button>
        <SharedWarningText>Warning: This will permanently delete all events and compensation data.</SharedWarningText>
      </ClearDataSection>
    </SharedPageSection>
  );
};

export default memo(MonthlyCompensationSummary, (prevProps, nextProps) => {
  if (prevProps.data.length !== nextProps.data.length) {
    return false;
  }
  
  for (let i = 0; i < prevProps.data.length; i++) {
    const prevItem = prevProps.data[i];
    const nextItem = nextProps.data[i];
    
    if (
      prevItem.type !== nextItem.type ||
      prevItem.amount !== nextItem.amount ||
      prevItem.count !== nextItem.count ||
      (prevItem.month && nextItem.month && 
       new Date(prevItem.month).getTime() !== new Date(nextItem.month).getTime())
    ) {
      return false;
    }
  }
  
  return true;
}); 
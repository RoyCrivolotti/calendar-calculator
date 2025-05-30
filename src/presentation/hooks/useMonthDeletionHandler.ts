import { useState, useCallback, useMemo } from 'react';
import { container } from '../../config/container';
import { CalendarEventRepository } from '../../domain/calendar/repositories/CalendarEventRepository';
import { SubEventRepository } from '../../domain/calendar/repositories/SubEventRepository';
import { logger } from '../../utils/logger';
import { formatMonthYear } from '../../utils/formatting/formatters';
import { trackOperation } from '../../utils/errorHandler';
import { useAppSelector } from '../store/hooks';
import { RootState } from '../store';

interface UseMonthDeletionHandlerProps {
  onDeletionSuccess?: () => void;
}

interface UseMonthDeletionHandlerReturn {
  isDeletingMonth: boolean;
  showConfirmDeleteMonthModal: boolean;
  monthPendingDeletion: Date | null;
  initiateDeleteMonth: (month: Date) => void;
  confirmDeleteMonth: () => Promise<void>;
  cancelDeleteMonth: () => void;
  getNotificationProps: () => {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
  } | null;
}

export const useMonthDeletionHandler = ({
  onDeletionSuccess,
}: UseMonthDeletionHandlerProps = {}): UseMonthDeletionHandlerReturn => {
  const calendarEventRepository = useMemo(() => container.get<CalendarEventRepository>('calendarEventRepository'), []);
  const subEventRepository = useMemo(() => container.get<SubEventRepository>('subEventRepository'), []);
  const currentUser = useAppSelector((state: RootState) => state.auth.currentUser);

  const [monthPendingDeletion, setMonthPendingDeletion] = useState<Date | null>(null);
  const [showConfirmDeleteMonthModal, setShowConfirmDeleteMonthModal] = useState(false);
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);

  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const initiateDeleteMonth = useCallback((month: Date) => {
    if (!month) {
      logger.warn('[useMonthDeletionHandler] Attempted to initiate deletion with no month.');
      return;
    }
    setMonthPendingDeletion(month);
    setShowConfirmDeleteMonthModal(true);
    setNotificationVisible(false); // Clear previous notifications
  }, []);

  const cancelDeleteMonth = useCallback(() => {
    setShowConfirmDeleteMonthModal(false);
    setMonthPendingDeletion(null);
  }, []);

  const confirmDeleteMonth = useCallback(async () => {
    if (!monthPendingDeletion) {
      logger.error('[useMonthDeletionHandler] Confirmation to delete month data, but no month is pending.');
      setShowConfirmDeleteMonthModal(false);
      return;
    }
    if (!currentUser?.uid) {
      logger.error('[useMonthDeletionHandler] Cannot delete month data: User not authenticated.');
      setNotificationTitle('Authentication Error');
      setNotificationMessage('You must be logged in to delete data.');
      setNotificationVisible(true);
      setShowConfirmDeleteMonthModal(false);
      return;
    }

    const monthToClear = new Date(monthPendingDeletion);
    logger.info(`[useMonthDeletionHandler] User ${currentUser.uid} confirmed deletion of data for month: ${formatMonthYear(monthToClear)}.`);
    setIsDeletingMonth(true);

    try {
      await trackOperation(
        'DeleteMonthUserDataBatchHook',
        async () => {
          const allUserEvents = await calendarEventRepository.getAll();
          const monthStart = new Date(monthToClear.getFullYear(), monthToClear.getMonth(), 1, 0, 0, 0, 0);
          const monthEnd = new Date(monthToClear.getFullYear(), monthToClear.getMonth() + 1, 0, 23, 59, 59, 999);
          const eventsToDelete = allUserEvents.filter(event => {
            const eventStart = event.start;
            const eventEnd = event.end;
            return eventStart <= monthEnd && eventEnd >= monthStart;
          });

          if (eventsToDelete.length === 0) {
            logger.info(`[useMonthDeletionHandler] No events to delete in ${formatMonthYear(monthToClear)}.`);
            setNotificationTitle('No Data');
            setNotificationMessage(`No events found to delete for ${formatMonthYear(monthToClear)}.`);
            setNotificationVisible(true);
            return { success: true, itemsCleared: 0 };
          }
          const eventIdsToDelete = eventsToDelete.map(event => event.id);

          logger.info(`[useMonthDeletionHandler] Batch deleting ${eventIdsToDelete.length} events in ${formatMonthYear(monthToClear)}.`);
          await subEventRepository.deleteMultipleByParentIds(eventIdsToDelete);
          await calendarEventRepository.deleteMultipleByIds(eventIdsToDelete);
          
          logger.info(`[useMonthDeletionHandler] Successfully batch cleared data for month ${formatMonthYear(monthToClear)}.`);
          setNotificationTitle('Success');
          setNotificationMessage(`Successfully deleted all events for ${formatMonthYear(monthToClear)}.`);
          setNotificationVisible(true);
          if (onDeletionSuccess) {
            onDeletionSuccess();
          }
          return { success: true, itemsCleared: eventIdsToDelete.length };
        },
        {
          source: 'useMonthDeletionHandler.confirmDeleteMonth',
          userId: currentUser.uid,
          month: formatMonthYear(monthToClear)
        }
      );
    } catch (error) {
      logger.error(`[useMonthDeletionHandler] Error deleting data for month ${formatMonthYear(monthToClear)}:`, error);
      setNotificationTitle('Error');
      setNotificationMessage(`An error occurred while deleting data for ${formatMonthYear(monthToClear)}. Please try again.`);
      setNotificationVisible(true);
    } finally {
      setIsDeletingMonth(false);
      setShowConfirmDeleteMonthModal(false);
      // Do not reset monthPendingDeletion here, allow UI to use it for modal title if needed until cancel/close
    }
  }, [monthPendingDeletion, currentUser, calendarEventRepository, subEventRepository, onDeletionSuccess, trackOperation]);

  const getNotificationProps = useCallback(() => {
    if (!notificationVisible) return null;
    return {
      visible: notificationVisible,
      title: notificationTitle,
      message: notificationMessage,
      onClose: () => setNotificationVisible(false),
    };
  }, [notificationVisible, notificationTitle, notificationMessage]);

  return {
    isDeletingMonth,
    showConfirmDeleteMonthModal,
    monthPendingDeletion,
    initiateDeleteMonth,
    confirmDeleteMonth,
    cancelDeleteMonth,
    getNotificationProps,
  };
}; 
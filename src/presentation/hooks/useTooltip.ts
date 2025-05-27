import { useState, useCallback } from 'react';

interface TooltipContent {
  title: string;
  value: string;
  extra: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: TooltipContent;
}

/**
 * Custom hook for managing tooltip state and interactions
 * @returns Tooltip state and functions to show/hide the tooltip
 */
export function useTooltip() {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: {
      title: '',
      value: '',
      extra: ''
    }
  });

  /**
   * Show tooltip at the specified position with content
   */
  const showTooltip = useCallback((
    e: React.MouseEvent, 
    title: string, 
    value: string, 
    extra: string = ''
  ) => {
    setTooltipState({
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

  /**
   * Update tooltip position without changing content
   */
  const updateTooltipPosition = useCallback((e: React.MouseEvent) => {
    setTooltipState(prev => ({
      ...prev,
      x: e.clientX + 15,
      y: e.clientY + 15
    }));
  }, []);

  /**
   * Hide the tooltip
   */
  const hideTooltip = useCallback(() => {
    setTooltipState(prev => ({
      ...prev,
      visible: false
    }));
  }, []);

  return {
    tooltipState,
    showTooltip,
    hideTooltip,
    updateTooltipPosition
  };
}

export default useTooltip; 

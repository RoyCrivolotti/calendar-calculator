import { useState, useCallback, useEffect } from 'react';

export type SidePanelContentType = 'events' | 'rates' | string;

interface SidePanelOptions {
  /**
   * Reset tabs when opening the panel
   */
  resetTabsOnOpen?: boolean;
  
  /**
   * Close the panel when ESC key is pressed
   */
  closeOnEsc?: boolean;
  
  /**
   * Default content type to show in the panel
   */
  defaultContent?: SidePanelContentType;
}

/**
 * Custom hook for managing side panel state and interactions
 * @param options Configuration options for the side panel
 * @returns State and handlers for the side panel
 */
export function useSidePanel(options: SidePanelOptions = {}) {
  const { 
    resetTabsOnOpen = true, 
    closeOnEsc = true,
    defaultContent = 'default'
  } = options;
  
  // Side panel state
  const [isOpen, setIsOpen] = useState(false);
  const [contentType, setContentType] = useState<SidePanelContentType>(defaultContent);
  
  /**
   * Open the side panel with specified content
   */
  const openPanel = useCallback((content?: SidePanelContentType) => {
    if (content) {
      setContentType(content);
    }
    setIsOpen(true);
  }, []);
  
  /**
   * Close the side panel
   */
  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  /**
   * Toggle the side panel open state
   */
  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);
  
  /**
   * Change the content type of the side panel
   */
  const setContent = useCallback((content: SidePanelContentType) => {
    setContentType(content);
  }, []);
  
  // Add ESC key handler if enabled
  useEffect(() => {
    if (!closeOnEsc) return;
    
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    
    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, closePanel, closeOnEsc]);
  
  return {
    isOpen,
    contentType,
    openPanel,
    closePanel,
    togglePanel,
    setContent
  };
}

export default useSidePanel; 
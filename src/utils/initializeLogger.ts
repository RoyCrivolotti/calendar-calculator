/**
 * Logger Initialization
 * 
 * This module initializes the logger with the appropriate configuration based on the environment.
 * It should be imported and executed early in the application lifecycle.
 */

import { logger, getLogger } from './logger';
import { getLoggerConfig, ENV } from '../config/environment';
import { env } from './env';

/**
 * Initializes the default logger with environment-specific configurations
 */
export function initializeLogger(): void {
  // Configure the main logger based on environment
  logger.setConfig(getLoggerConfig());
  
  // Set up global context
  logger.setContext({
    appName: 'CalendarApp',
    appVersion: env.APP_VERSION,
    environment: ENV.ENVIRONMENT
  });
  
  // Log startup information
  logger.info(`Application starting in ${ENV.ENVIRONMENT} environment`);
  
  // In non-production environments, log more details
  if (!ENV.PRODUCTION) {
    logger.debug('Logger initialized with configuration:', getLoggerConfig());
  }
  
  // Set up domain-specific loggers with additional context
  setupDomainLoggers();
}

/**
 * Sets up domain-specific loggers with appropriate context
 */
function setupDomainLoggers(): void {
  // Calendar domain logger
  const calendarLogger = getLogger('calendar');
  calendarLogger.setContext({ domain: 'calendar' });
  
  // Storage logger
  const storageLogger = getLogger('storage');
  storageLogger.setContext({ domain: 'storage' });
  
  // API logger
  const apiLogger = getLogger('api');
  apiLogger.setContext({ domain: 'api' });
  
  // UI logger
  const uiLogger = getLogger('ui');
  uiLogger.setContext({ domain: 'ui' });
}

/**
 * Sets up global error catching for unhandled errors and rejections
 */
export function setupGlobalErrorHandlers(): void {
  const errorLogger = getLogger('global-errors');
  
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    errorLogger.error('Uncaught error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
    
    // Don't prevent default behavior
    return false;
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.error('Unhandled promise rejection:', {
      reason: event.reason
    });
    
    // Don't prevent default behavior
    return false;
  });
  
  errorLogger.info('Global error handlers initialized');
}

// Export domain-specific logger getters
export const getCalendarLogger = () => getLogger('calendar');
export const getStorageLogger = () => getLogger('storage');
export const getApiLogger = () => getLogger('api');
export const getUiLogger = () => getLogger('ui'); 
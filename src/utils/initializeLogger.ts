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
 * Standard logger domains for consistency across the application
 */
export const LoggerDomains = {
  STORAGE: 'storage',
  REPOSITORY: 'repository',
  USE_CASE: 'use-case',
  SERVICE: 'service',
  PRESENTATION: 'presentation',
  DOMAIN: 'domain',
  INFRASTRUCTURE: 'infrastructure',
  APPLICATION: 'application'
};

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
 * Creates a standardized repository logger with consistent naming and context
 * @param repositoryName The specific repository name
 * @param storageType The storage type (e.g., 'indexedDB', 'localStorage')
 * @returns Logger instance with standardized context
 */
export function createRepositoryLogger(repositoryName: string, storageType: string): ReturnType<typeof getLogger> {
  const loggerName = `${LoggerDomains.REPOSITORY}.${repositoryName}`;
  const repositoryLogger = getLogger(loggerName);
  
  repositoryLogger.setContext({
    domain: LoggerDomains.REPOSITORY,
    repository: repositoryName,
    storageType
  });
  
  return repositoryLogger;
}

/**
 * Creates a standardized use case logger with consistent naming and context
 * @param useCaseName The specific use case name
 * @returns Logger instance with standardized context
 */
export function createUseCaseLogger(useCaseName: string): ReturnType<typeof getLogger> {
  const loggerName = `${LoggerDomains.USE_CASE}.${useCaseName}`;
  const useCaseLogger = getLogger(loggerName);
  
  useCaseLogger.setContext({
    domain: LoggerDomains.USE_CASE,
    useCase: useCaseName
  });
  
  return useCaseLogger;
}

/**
 * Creates a standardized service logger with consistent naming and context
 * @param serviceName The specific service name
 * @returns Logger instance with standardized context
 */
export function createServiceLogger(serviceName: string): ReturnType<typeof getLogger> {
  const loggerName = `${LoggerDomains.SERVICE}.${serviceName}`;
  const serviceLogger = getLogger(loggerName);
  
  serviceLogger.setContext({
    domain: LoggerDomains.SERVICE,
    service: serviceName
  });
  
  return serviceLogger;
}

/**
 * Set up domain-specific loggers with appropriate context
 * This is called during logger initialization
 */
function setupDomainLoggers(): void {
  // Setup can be extended as needed
  logger.debug('Domain loggers initialized');
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
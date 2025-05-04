/**
 * Storage Service Logger
 * 
 * A specialized logger for the storage service that provides additional
 * context and formatting specific to database operations.
 */

import { Logger } from '../../utils/logger';
import { APP_CONFIG } from '../../config/environment';
import { BaseError, DatabaseError } from '../../utils/errorHandler';
import { createServiceLogger, LoggerDomains } from '../../utils/initializeLogger';

// Constants for storage operations, useful for categorization
export const STORAGE_OPERATIONS = {
  READ: 'READ',
  WRITE: 'WRITE',
  DELETE: 'DELETE',
  INIT: 'INIT',
  SYNC: 'SYNC',
  MIGRATE: 'MIGRATE',
  BACKUP: 'BACKUP',
  RESTORE: 'RESTORE',
  CLEAR: 'CLEAR'
};

// Create a dedicated logger instance for storage operations using the standardized approach
const storageLogger: Logger = createServiceLogger('storage');

// Additional storage-specific context
storageLogger.setContext({
  dbName: APP_CONFIG.DB_VERSION ? `calendarDB_v${APP_CONFIG.DB_VERSION}` : 'calendarDB',
  storageType: 'indexedDB+localStorage',
});

/**
 * Log a storage initialization event
 * @param dbName Database name
 * @param dbVersion Database version
 * @param details Additional details about the initialization
 */
export function logStorageInit(
  dbName: string,
  dbVersion: number,
  details?: Record<string, any>
): void {
  storageLogger.info(`Initializing storage: ${dbName} v${dbVersion}`, {
    operation: STORAGE_OPERATIONS.INIT,
    dbName,
    dbVersion,
    ...details
  });
}

/**
 * Log a successful storage operation
 * @param operation The operation that was performed (use STORAGE_OPERATIONS constants)
 * @param message A descriptive message about the operation
 * @param details Additional details about the operation
 */
export function logStorageSuccess(
  operation: string,
  message: string,
  details?: Record<string, any>
): void {
  storageLogger.info(`[${operation}] ${message}`, {
    operation,
    ...details
  });
}

/**
 * Log a storage warning event
 * @param operation The operation being performed
 * @param message Warning message
 * @param details Additional details
 */
export function logStorageWarning(
  operation: string,
  message: string,
  details?: Record<string, any>
): void {
  storageLogger.warn(`[${operation}] ${message}`, {
    operation,
    ...details
  });
}

/**
 * Log a storage error with appropriate contextual information
 * @param error The error that occurred
 * @param operation The operation that was being performed
 * @param details Additional details about the context of the error
 */
export function logStorageError(
  error: Error | BaseError,
  operation: string,
  details?: Record<string, any>
): void {
  // Convert to a DatabaseError if it's not already a BaseError
  if (!(error instanceof BaseError)) {
    error = new DatabaseError(
      error.message || 'Unknown storage error',
      'STORAGE_ERROR',
      500,
      error,
      { operation, ...details }
    );
  }
  
  storageLogger.error(`[${operation}] Storage error: ${error.message}`, error);
}

// Export the logger instance for direct use
export { storageLogger }; 
/**
 * Storage Service Logger
 * 
 * A specialized logger for the storage service that provides additional
 * context and formatting specific to database operations.
 */

import { getLogger, Logger } from '../../utils/logger';
import { APP_CONFIG } from '../../config/environment';
import { BaseError, DatabaseError } from '../../utils/errorHandler';

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

// Create a dedicated logger instance for storage operations
const storageLogger: Logger = getLogger('storage');

// Set up storage-specific context
storageLogger.setContext({
  domain: 'storage',
  dbName: APP_CONFIG.DB_VERSION ? `calendarDB_v${APP_CONFIG.DB_VERSION}` : 'calendarDB',
  storageType: 'indexedDB+localStorage',
});

/**
 * Log a storage operation
 * @param operation The type of operation being performed
 * @param message The log message
 * @param details Optional additional details about the operation
 */
export function logStorageOperation(
  operation: string,
  message: string,
  details?: Record<string, any>
): void {
  storageLogger.info(`[${operation}] ${message}`, details);
}

/**
 * Log a storage query operation
 * @param storeName The object store being queried
 * @param query Query details (e.g., index, range)
 * @param resultCount Number of results returned (if available)
 */
export function logStorageQuery(
  storeName: string,
  query: Record<string, any>,
  resultCount?: number
): void {
  storageLogger.debug(`[QUERY] ${storeName}`, {
    ...query,
    resultCount: resultCount !== undefined ? resultCount : 'unknown'
  });
}

/**
 * Log storage performance metrics
 * @param operation The operation being measured
 * @param startTime The start time of the operation
 * @param itemCount Number of items processed
 */
export function logStoragePerformance(
  operation: string,
  startTime: number,
  itemCount: number
): void {
  const endTime = performance.now();
  const durationMs = endTime - startTime;
  
  storageLogger.debug(`[PERF] ${operation} completed`, {
    durationMs: Math.round(durationMs),
    itemCount,
    msPerItem: itemCount > 0 ? Math.round(durationMs / itemCount) : 0
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

/**
 * Create a performance tracking wrapper for storage operations
 * @param operation The name of the operation being performed
 * @param fn The async function to measure
 */
export async function trackStorageOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    return await fn();
  } catch (error) {
    logStorageError(error instanceof Error ? error : new Error(String(error)), operation);
    throw error;
  } finally {
    const endTime = performance.now();
    storageLogger.debug(`[PERF] ${operation} completed in ${Math.round(endTime - startTime)}ms`);
  }
}

// Export the logger instance for direct use
export default storageLogger; 
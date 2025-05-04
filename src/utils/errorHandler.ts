/**
 * Error Handling Utilities
 * 
 * This module contains error handling utilities, including:
 * - Custom error classes for different types of errors
 * - Centralized error handling functions
 * - Error logging integration
 */

import { logger, getLogger } from './logger';

// Create a dedicated logger for errors
const errorLogger = getLogger('errors');

/**
 * Base error class for application errors
 */
export class BaseError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly originalError?: Error;
  readonly context?: Record<string, any>;
  readonly timestamp: Date;

  constructor(
    message: string, 
    code: string = 'INTERNAL_ERROR', 
    statusCode: number = 500, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a JSON representation of the error for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends BaseError {
  constructor(
    message: string, 
    code: string = 'VALIDATION_ERROR', 
    statusCode: number = 400, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, originalError, context);
  }
}

/**
 * Base class for database-related errors
 */
export class DatabaseError extends BaseError {
  constructor(
    message: string, 
    code: string = 'DATABASE_ERROR', 
    statusCode: number = 500, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, originalError, context);
  }
}

/**
 * Error for storage read operations
 */
export class StorageReadError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'STORAGE_READ_ERROR',
      500,
      originalError,
      context
    );
  }
}

/**
 * Error for storage write operations
 */
export class StorageWriteError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'STORAGE_WRITE_ERROR',
      500,
      originalError,
      context
    );
  }
}

/**
 * Error for storage delete operations
 */
export class StorageDeleteError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'STORAGE_DELETE_ERROR',
      500,
      originalError,
      context
    );
  }
}

/**
 * Error for when storage initialization fails
 */
export class StorageInitError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'STORAGE_INIT_ERROR',
      500,
      originalError,
      context
    );
  }
}

/**
 * Error for quota exceeded in storage operations
 */
export class StorageQuotaError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'STORAGE_QUOTA_ERROR',
      507, // HTTP 507 Insufficient Storage
      originalError,
      context
    );
  }
}

/**
 * Error for transient storage issues that may resolve with retries
 */
export class TransientStorageError extends DatabaseError {
  constructor(
    message: string,
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      'TRANSIENT_STORAGE_ERROR',
      503, // HTTP 503 Service Unavailable
      originalError,
      context
    );
  }
}

/**
 * Error for application logic issues
 */
export class ApplicationError extends BaseError {
  constructor(
    message: string, 
    code: string = 'APPLICATION_ERROR', 
    statusCode: number = 500, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, originalError, context);
  }
}

/**
 * Error for not found resources
 */
export class NotFoundError extends BaseError {
  constructor(
    message: string, 
    code: string = 'NOT_FOUND', 
    statusCode: number = 404, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, originalError, context);
  }
}

/**
 * Error for external service issues
 */
export class ExternalServiceError extends BaseError {
  constructor(
    message: string, 
    code: string = 'EXTERNAL_SERVICE_ERROR', 
    statusCode: number = 502, 
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, code, statusCode, originalError, context);
  }
}

/**
 * Handles an error by logging it appropriately and performing 
 * any necessary side effects like analytics logging
 */
export function handleError(error: Error | BaseError, context?: Record<string, any>): void {
  if (error instanceof BaseError) {
    // Log with additional context from the error
    errorLogger.error(
      `[${error.code}] ${error.message}`, 
      { 
        ...error.toJSON(),
        ...context 
      }
    );
  } else {
    // Convert to BaseError and log
    const baseError = new BaseError(
      error.message || 'An unknown error occurred',
      'UNKNOWN_ERROR',
      500,
      error,
      context
    );
    
    errorLogger.error(
      `[UNKNOWN_ERROR] ${error.message || 'An unknown error occurred'}`, 
      baseError.toJSON()
    );
  }
  
  // Add additional error handling as needed
  // For example, sending to an error monitoring service
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>, 
  errorMessage: string = 'Operation failed', 
  context?: Record<string, any>
): Promise<T> {
  return fn().catch(error => {
    handleError(error, { ...context, errorMessage });
    throw error; // Re-throw the error after handling
  });
}

/**
 * Track an operation with performance monitoring and error handling
 * @param operationName Name of the operation being performed
 * @param fn The async function to execute
 * @param context Additional context to include in logging
 * @returns Promise with the operation result
 */
export async function trackOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  context: Record<string, any> = {}
): Promise<T> {
  const startTime = performance.now();
  
  try {
    // Log operation start
    logger.debug(`[${operationName}] Starting operation`, context);
    
    // Execute the operation
    const result = await fn();
    
    // Calculate and log performance metrics
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    
    logger.debug(`[${operationName}] Completed successfully in ${durationMs.toFixed(2)}ms`, {
      ...context,
      durationMs
    });
    
    return result;
  } catch (error: unknown) {
    // Calculate duration even for failed operations
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    
    // Enhanced context with timing information
    const errorContext = {
      ...context,
      durationMs,
      operationName,
      failedAt: new Date().toISOString()
    };
    
    // Convert to appropriate error type if needed
    let typedError: BaseError | Error;
    if (error instanceof BaseError) {
      typedError = error;
    } else if (error instanceof Error) {
      typedError = new ApplicationError(
        `Operation '${operationName}' failed: ${error.message}`,
        'OPERATION_FAILED',
        500,
        error,
        errorContext
      );
    } else {
      typedError = new ApplicationError(
        `Operation '${operationName}' failed: ${String(error)}`,
        'OPERATION_FAILED',
        500,
        new Error(String(error)),
        errorContext
      );
    }
    
    // Handle the error with our centralized handler
    handleError(typedError, errorContext);
    
    // Re-throw for caller to handle
    throw typedError;
  }
}

/**
 * Format and standardize error responses
 */
export function formatErrorResponse(error: Error | BaseError): Record<string, any> {
  if (error instanceof BaseError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode
      }
    };
  }
  
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unknown error occurred',
      statusCode: 500
    }
  };
}

/**
 * Determines if an error is considered transient and can be retried
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TransientStorageError) {
    return true;
  }
  
  if (error instanceof StorageQuotaError) {
    // Quota errors could be resolved if other data is cleared
    return true;
  }
  
  if (error instanceof Error) {
    // Check for network-related issues
    const errorMessage = error.message.toLowerCase();
    const isNetworkError = errorMessage.includes('network') || 
                         errorMessage.includes('connection') ||
                         errorMessage.includes('offline') ||
                         errorMessage.includes('timeout');
                         
    if (isNetworkError) {
      return true;
    }
    
    // Check for localStorage/IndexedDB specific transient errors
    const isStorageTransient = errorMessage.includes('quota') ||
                             errorMessage.includes('full') ||
                             errorMessage.includes('available') ||
                             errorMessage.includes('temporary');
    
    if (isStorageTransient) {
      return true;
    }
  }
  
  return false;
}

/**
 * Retry an operation with exponential backoff
 * @param operation Function to retry
 * @param options Retry options
 * @returns Promise with the operation result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number,
    initialDelay?: number,
    maxDelay?: number,
    factor?: number,
    operationName?: string,
    onRetry?: (error: unknown, attempt: number, delay: number) => void
  } = {}
): Promise<T> {
  const {
    retries = 3,
    initialDelay = 300,
    maxDelay = 5000,
    factor = 2,
    operationName = 'operation',
    onRetry = (error, attempt, delay) => {
      logger.warn(`Retrying ${operationName} (attempt ${attempt}/${retries}) after ${delay}ms due to error:`, 
        error instanceof Error ? error.message : String(error));
    }
  } = options;
  
  let attempt = 0;
  let lastError: unknown;
  
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;
      
      // If we've used all retries or it's not a transient error, throw
      if (attempt > retries || !isTransientError(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);
      
      // Add some jitter to prevent all retries happening at exactly the same time
      const jitteredDelay = delay * (0.8 + Math.random() * 0.4);
      
      // Call the retry callback
      onRetry(error, attempt, Math.round(jitteredDelay));
      
      // Wait before the next attempt
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }
  
  // This should never happen due to the throw above, but TypeScript needs it
  throw lastError;
}

/**
 * Combines trackOperation and withRetry to provide a complete solution for 
 * operations that need both tracking and retry capabilities
 */
export async function trackWithRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: {
    context?: Record<string, any>,
    retries?: number,
    initialDelay?: number,
    maxDelay?: number,
    factor?: number,
    onRetry?: (error: unknown, attempt: number, delay: number) => void
  } = {}
): Promise<T> {
  const { context = {}, ...retryOptions } = options;
  
  return trackOperation(
    operationName,
    () => withRetry(operation, { ...retryOptions, operationName }),
    context
  );
} 
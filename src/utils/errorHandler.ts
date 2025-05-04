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
 * Error for database-related issues
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
 * Tracks performance and handles errors for async operations in components
 * This method combines performance tracking and error handling in a single convenient method
 */
export async function trackOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  context?: Record<string, any>,
  logger = errorLogger
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Log success with performance data
    if (duration > 1000) {
      // Only log slow operations at INFO level
      logger.info(
        `Operation '${operationName}' completed successfully in ${duration.toFixed(2)}ms`,
        { ...context, duration, performanceAlert: duration > 1000 ? 'slow' : 'normal' }
      );
    } else {
      // Log normal operations at DEBUG level
      logger.debug(
        `Operation '${operationName}' completed in ${duration.toFixed(2)}ms`,
        { ...context, duration }
      );
    }
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Convert unknown error to an Error object if needed
    const errorObj = error instanceof Error 
      ? error 
      : new Error(typeof error === 'string' ? error : 'Unknown error');
    
    // Handle the error
    handleError(errorObj, { 
      operation: operationName, 
      duration: `${duration.toFixed(2)}ms`,
      ...context
    });
    
    // Re-throw the error after logging
    throw error;
  }
} 
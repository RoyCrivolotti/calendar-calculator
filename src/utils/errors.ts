import { logger } from './logger';

export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DB_ERROR', context);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', context);
  }
}

export class StorageError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', context);
  }
}

export class BusinessLogicError extends BaseError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BUSINESS_LOGIC_ERROR', context);
  }
}

export function handleError(error: unknown): never {
  if (error instanceof BaseError) {
    logger.error(error.message, {
      code: error.code,
      context: error.context,
      stack: error.stack
    });
    throw error;
  }

  if (error instanceof Error) {
    logger.error(error.message, {
      stack: error.stack
    });
    throw new BaseError(error.message, 'UNKNOWN_ERROR', {
      originalError: error.name,
      stack: error.stack
    });
  }

  // Handle non-Error objects
  const errorMessage = error instanceof Object ? JSON.stringify(error) : String(error);
  logger.error('An unknown error occurred', {
    error: errorMessage
  });
  throw new BaseError('An unknown error occurred', 'UNKNOWN_ERROR', {
    originalError: errorMessage
  });
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    // Add any error codes that are considered operational
    const operationalCodes = ['VALIDATION_ERROR', 'NOT_FOUND'];
    return operationalCodes.includes(error.code);
  }
  return false;
}

// Global error handler setup
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack
    });
    
    if (!isOperationalError(error)) {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason)
    });
  });

  // Handle browser-specific errors
  if (typeof window !== 'undefined') {
    window.onerror = (message, source, lineno, colno, error) => {
      logger.error('Browser Error:', {
        message,
        source,
        lineno,
        colno,
        error: error?.stack
      });
      return false; // Let default handler run
    };

    window.onunhandledrejection = (event) => {
      logger.error('Unhandled Promise Rejection:', {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason)
      });
    };
  }
} 
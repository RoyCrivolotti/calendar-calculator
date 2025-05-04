/**
 * Enhanced Logging System
 * 
 * Features:
 * - Environment-based log levels
 * - Formatted timestamps
 * - Structured logging
 * - Better error handling
 * - Request ID tracking
 * - Customizable output formats
 */

import { env } from './env';

export enum LogLevel {
  NONE = -1,   // No logging
  ERROR = 0,   // Only errors
  WARN = 1,    // Errors and warnings
  INFO = 2,    // Normal operational messages
  DEBUG = 3,    // Detailed debugging information
  TRACE = 4    // Very verbose tracing information
}

export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  timestampFormat: 'ISO' | 'LOCALE' | 'CUSTOM';
  customTimestampFormat?: (date: Date) => string;
  includeLevel: boolean;
  enableConsoleColors: boolean;
  structured: boolean;
  context?: Record<string, any>;
}

// Constants for ANSI color codes
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m'
};

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: env.isProduction() ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
  timestampFormat: 'ISO',
  includeLevel: true,
  enableConsoleColors: !env.isProduction(),
  structured: false,
  context: {}
};

/**
 * Determines if the current environment is a production environment
 */
export const isProduction = (): boolean => {
  return env.isProduction();
};

/**
 * Determines if the current environment is a test environment
 */
export const isTest = (): boolean => {
  return env.isTest();
};

/**
 * Generates a timestamp string based on configuration
 */
const formatTimestamp = (date: Date, config: LoggerConfig): string => {
  if (!config.includeTimestamp) return '';

  switch (config.timestampFormat) {
    case 'ISO':
      return `[${date.toISOString()}]`;
    case 'LOCALE':
      return `[${date.toLocaleString()}]`;
    case 'CUSTOM':
      return config.customTimestampFormat ? `[${config.customTimestampFormat(date)}]` : `[${date.toISOString()}]`;
    default:
      return `[${date.toISOString()}]`;
  }
};

/**
 * Formats the level label with optional color
 */
const formatLevel = (level: LogLevel, config: LoggerConfig): string => {
  if (!config.includeLevel) return '';
  
  let levelStr: string;
  let color: string = '';
  let resetColor: string = '';
  
  switch (level) {
    case LogLevel.ERROR:
      levelStr = 'ERROR';
      color = config.enableConsoleColors ? COLORS.RED : '';
      break;
    case LogLevel.WARN:
      levelStr = 'WARN';
      color = config.enableConsoleColors ? COLORS.YELLOW : '';
      break;
    case LogLevel.INFO:
      levelStr = 'INFO';
      color = config.enableConsoleColors ? COLORS.GREEN : '';
      break;
    case LogLevel.DEBUG:
      levelStr = 'DEBUG';
      color = config.enableConsoleColors ? COLORS.BLUE : '';
      break;
    case LogLevel.TRACE:
      levelStr = 'TRACE';
      color = config.enableConsoleColors ? COLORS.GRAY : '';
      break;
    default:
      levelStr = 'UNKNOWN';
      color = '';
  }
  
  resetColor = config.enableConsoleColors ? COLORS.RESET : '';
  return `${color}[${levelStr}]${resetColor}`;
};

/**
 * Formats error objects for better readability in logs
 */
const formatError = (error: Error | any): any => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any)
    };
  }
  return error;
};

/**
 * Creates a structured log entry combining message, context, and args
 */
const createStructuredLog = (
  level: LogLevel,
  message: string,
  config: LoggerConfig,
  args: any[]
): any => {
  const timestamp = new Date();
  
  // Format any Error objects in args
  const formattedArgs = args.map(arg => 
    arg instanceof Error ? formatError(arg) : arg
  );

  return {
    timestamp: timestamp.toISOString(),
    level: LogLevel[level],
    message,
    context: config.context || {},
    data: formattedArgs.length > 0 ? formattedArgs : undefined
  };
};

/**
 * Main Logger class that implements the logging functionality
 */
export class Logger {
  private config: LoggerConfig;
  private requestId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update the logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Sets the current request ID for correlation
   */
  setRequestId(id: string): void {
    this.requestId = id;
    this.setContext({ requestId: id });
  }
  
  /**
   * Clear the current request ID
   */
  clearRequestId(): void {
    this.requestId = undefined;
    const context = { ...this.config.context };
    if (context.requestId) {
      delete context.requestId;
      this.setContext(context);
    }
  }
  
  /**
   * Set or update context data to be included in all logs
   */
  setContext(context: Record<string, any>): void {
    this.config.context = { ...this.config.context, ...context };
  }
  
  /**
   * Clear all context data
   */
  clearContext(): void {
    this.config.context = {};
    if (this.requestId) {
      this.config.context.requestId = this.requestId;
    }
  }

  /**
   * Log a message at ERROR level
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, args);
  }

  /**
   * Log a message at WARN level
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, args);
  }

  /**
   * Log a message at INFO level
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, args);
  }

  /**
   * Log a message at DEBUG level
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, args);
  }

  /**
   * Log a message at TRACE level
   */
  trace(message: string, ...args: any[]): void {
    this.log(LogLevel.TRACE, message, args);
  }

  /**
   * Core logging method that handles actual output based on level and config
   */
  private log(level: LogLevel, message: string, args: any[]): void {
    if (level > this.config.level) return;

    const timestamp = new Date();
    const timestampStr = formatTimestamp(timestamp, this.config);
    const levelStr = formatLevel(level, this.config);
    
    if (this.config.structured) {
      const structuredLog = createStructuredLog(level, message, this.config, args);
      
      // Choose appropriate console method based on level
      switch (level) {
        case LogLevel.ERROR:
          console.error(JSON.stringify(structuredLog));
          break;
        case LogLevel.WARN:
          console.warn(JSON.stringify(structuredLog));
          break;
        case LogLevel.INFO:
          console.log(JSON.stringify(structuredLog));
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.debug(JSON.stringify(structuredLog));
          break;
      }
    } else {
      // Format prefix with timestamp and level
      let prefix = '';
      if (timestampStr) prefix += `${timestampStr} `;
      if (levelStr) prefix += `${levelStr} `;
      
      // Add request ID if available
      if (this.requestId) {
        prefix += `[${this.requestId}] `;
      }

      // Choose appropriate console method based on level
      switch (level) {
        case LogLevel.ERROR:
          console.error(prefix, message, ...args);
          break;
        case LogLevel.WARN:
          console.warn(prefix, message, ...args);
          break;
        case LogLevel.INFO:
          console.log(prefix, message, ...args);
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.debug(prefix, message, ...args);
          break;
      }
    }
  }

  /**
   * Create a child logger with inherited config plus additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({
      ...this.config.context,
      ...context
    });
    if (this.requestId) {
      childLogger.setRequestId(this.requestId);
    }
    return childLogger;
  }
}

// Create the default logger instance
export const logger = new Logger();

// Export a function to get named logger instances
export function getLogger(name: string): Logger {
  return logger.child({ loggerName: name });
} 
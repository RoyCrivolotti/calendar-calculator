/**
 * Environment Configuration
 * 
 * This file provides centralized configuration for the application's environment settings,
 * including logging configuration that varies by environment.
 */

import { LoggerConfig, LogLevel } from '../utils/logger';
import { env } from '../utils/env';

// Environment detection
export const ENV = {
  PRODUCTION: env.isProduction(),
  DEVELOPMENT: env.isDevelopment(),
  TEST: env.isTest(),
  ENVIRONMENT: env.NODE_ENV,
};

// Application settings that vary by environment
export const APP_CONFIG = {
  API_BASE_URL: ENV.PRODUCTION 
    ? 'https://api.example.com/v1' 
    : 'http://localhost:3000/api',
    
  CACHE_DURATION: ENV.PRODUCTION 
    ? 3600000  // 1 hour in production
    : 60000,   // 1 minute in development
    
  ENABLE_ANALYTICS: ENV.PRODUCTION,
  
  STORAGE_PREFIX: ENV.TEST 
    ? 'test_calendar_app_' 
    : 'calendar_app_',
    
  DB_VERSION: 1,
  
  ENABLE_SERVICE_WORKER: ENV.PRODUCTION,
};

// Logger configuration by environment
export const getLoggerConfig = (): LoggerConfig => {
  // Production settings
  if (ENV.PRODUCTION) {
    return {
      level: LogLevel.INFO,
      includeTimestamp: true,
      timestampFormat: 'ISO',
      includeLevel: true,
      enableConsoleColors: false,
      structured: true,  // Use structured JSON format in production for easier parsing
      context: {
        environment: 'production',
        appVersion: env.APP_VERSION
      }
    };
  }
  
  // Test settings
  if (ENV.TEST) {
    return {
      level: LogLevel.NONE, // Disable logging during tests by default
      includeTimestamp: false,
      timestampFormat: 'ISO',
      includeLevel: true,
      enableConsoleColors: false,
      structured: false,
      context: {
        environment: 'test'
      }
    };
  }
  
  // Development settings (default)
  return {
    level: LogLevel.DEBUG,
    includeTimestamp: true,
    timestampFormat: 'LOCALE',  // More human-readable timestamps in development
    includeLevel: true,
    enableConsoleColors: true,  // Use colors in development
    structured: false,          // Plain text format in development for better readability
    context: {
      environment: 'development'
    }
  };
}; 
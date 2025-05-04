/**
 * Environment Variables Utility
 * 
 * This file provides a browser-compatible way to access environment variables.
 * It abstracts the implementation details from the rest of the application.
 */

// For Vite applications, use import.meta.env
// For applications using create-react-app, use process.env

/**
 * Safe way to access environment variables in any environment
 */
export const env = {
  /**
   * Current environment: 'development', 'test', or 'production'
   */
  NODE_ENV: import.meta.env?.MODE || import.meta.env?.NODE_ENV || 'development',
  
  /**
   * Application version from environment
   */
  APP_VERSION: import.meta.env?.VITE_APP_VERSION || '1.0.0',
  
  /**
   * Checks if the current environment is production
   */
  isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },
  
  /**
   * Checks if the current environment is development
   */
  isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },
  
  /**
   * Checks if the current environment is test
   */
  isTest(): boolean {
    return this.NODE_ENV === 'test';
  }
};

// Fallback for backward compatibility
export const processEnv = {
  NODE_ENV: env.NODE_ENV,
  APP_VERSION: env.APP_VERSION
}; 
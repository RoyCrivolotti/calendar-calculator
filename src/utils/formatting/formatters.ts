/**
 * Utility functions for formatting various data types
 */
import { format } from 'date-fns';

/**
 * Formats a date range as a string
 * @param start Start date
 * @param end End date
 * @param includeEndDate Whether to include the end date in the output (default: false)
 * @returns Formatted date range string
 */
export const formatDateRange = (start: Date, end: Date, includeEndDate: boolean = false): string => {
  if (start.toDateString() === end.toDateString()) {
    // Same day
    if (includeEndDate) {
      return `${format(start, 'MMM d, HH:mm')} - ${format(end, 'HH:mm')}`;
    }
    return format(start, 'MMM d, HH:mm');
  }
  
  // Different days
  return `${format(start, 'MMM d, HH:mm')} - ${format(end, 'MMM d, HH:mm')}`;
};

/**
 * Formats a duration between two dates
 * @param start Start date
 * @param end End date
 * @returns Formatted duration string
 */
export const formatDuration = (start: Date, end: Date): string => {
  const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
};

/**
 * Formats a month and year as a string
 * @param date Date object
 * @returns Formatted month and year string
 */
export const formatMonthYear = (date: Date): string => {
  return format(date, 'MMMM yyyy');
};

/**
 * Formats a date as a full date string including day of week
 * @param date Date object
 * @returns Formatted full date string
 */
export const formatFullDate = (date: Date): string => {
  return format(date, 'EEEE, MMMM d, yyyy');
};

/**
 * Formats a number as currency (EUR)
 * @param amount Amount to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return `€${amount.toFixed(decimals)}`;
};

/**
 * Formats a percentage
 * @param value Value to format as percentage
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return `${value.toFixed(decimals)}%`;
}; 
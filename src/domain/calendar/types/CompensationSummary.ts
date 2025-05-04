/**
 * Detailed breakdown of compensation for a specific time period
 */
export interface CompensationDetail {
  hours: number;          // Number of hours
  rate: number;           // Rate per hour in EUR
  multiplier?: number;    // Optional multiplier (for incidents)
  nightShiftMultiplier?: number; // Optional night shift multiplier
  amount: number;         // Total compensation amount in EUR
  description: string;    // Description of this compensation item
}

/**
 * Summary of hours by type for a specific time period
 */
export interface HoursSummary {
  total: number;          // Total hours in the event
  billable: number;       // Total billable hours (outside office hours)
  weekday: number;        // Weekday hours
  weekend: number;        // Weekend/holiday hours
  nightShift: number;     // Night shift hours
  officeHours: number;    // Office hours (typically not billable)
}

/**
 * Monthly compensation breakdown
 */
export interface MonthlyCompensation {
  month: string;          // Month identifier (YYYY-MM)
  amount: number;         // Total compensation for this month
  details: CompensationDetail[]; // Detailed breakdown for this month
}

/**
 * Complete compensation summary for an event
 */
export interface CompensationSummary {
  eventId: string;        // ID of the event
  total: number;          // Total compensation amount
  hours: HoursSummary;    // Summary of hours
  details: CompensationDetail[]; // Detailed breakdown
  // Only included if the event spans multiple months
  monthlyBreakdown?: MonthlyCompensation[]; 
} 
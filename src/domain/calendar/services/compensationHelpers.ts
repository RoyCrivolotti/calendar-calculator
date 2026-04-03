import { SubEvent } from '../entities/SubEvent';
import { EventTypes } from '../entities/CalendarEvent';

/**
 * Calculates billable hours for a single sub-event with consistent rounding.
 * Returns 0 for non-billable periods (e.g. office hours for on-call, office hours for incidents).
 */
export function calculateBillableHours(subEvent: SubEvent): number {
  const start = new Date(subEvent.start);
  const end = new Date(subEvent.end);
  const rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  if (subEvent.type === EventTypes.INCIDENT) {
    if (subEvent.isWeekend || subEvent.isNightShift || !subEvent.isOfficeHours) {
      return Math.ceil(rawHours);
    }
    return 0;
  }

  if (subEvent.type === EventTypes.ONCALL) {
    if (!subEvent.isOfficeHours || subEvent.isNightShift) {
      return Math.ceil(rawHours);
    }
    return 0;
  }

  return rawHours;
}

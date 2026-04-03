import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  SharedCompensationTable,
  SharedMobileRatesContainer
} from './ui';
import { COMPENSATION_RATES } from '../../../domain/calendar/constants/CompensationRates';
import { SalaryService } from '../../../domain/calendar/services/SalaryService';
import { container } from '../../../config/container';

interface SharedRatesPanelContentProps {
  displayMode?: 'compact' | 'full';
  /** Which date to use for salary lookup (e.g. calendar month). Defaults to today. */
  referenceDate?: Date;
  /** Increment after salary records load or change so rates re-read from SalaryService. */
  refreshKey?: number;
}

const SharedRatesPanelContent: React.FC<SharedRatesPanelContentProps> = ({
  displayMode: _displayMode = 'full',
  referenceDate,
  refreshKey = 0,
}) => {
  const [currentHourlyRate, setCurrentHourlyRate] = useState(COMPENSATION_RATES.baseHourlySalary);
  const referenceTime = referenceDate?.getTime() ?? null;

  useEffect(() => {
    try {
      const salaryService = container.get<SalaryService>('salaryService');
      const d = referenceTime != null ? new Date(referenceTime) : new Date();
      setCurrentHourlyRate(salaryService.getHourlyRateForDate(d));
    } catch {
      setCurrentHourlyRate(COMPENSATION_RATES.baseHourlySalary);
    }
  }, [referenceTime, refreshKey]);

  const weekdayEffective = (currentHourlyRate * COMPENSATION_RATES.weekdayIncidentMultiplier).toFixed(2);
  const weekendEffective = (currentHourlyRate * COMPENSATION_RATES.weekendIncidentMultiplier).toFixed(2);

  return (
    <SharedCompensationTable>
      <thead>
        <tr>
          <th>Type</th>
          <th>Rate (hourly)</th>
          <th>Multiplier</th>
          <th>Effective</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Weekday On-Call (non-office hours)</td>
          <td>€{COMPENSATION_RATES.weekdayOnCallRate.toFixed(2)}</td>
          <td>-</td>
          <td>€{COMPENSATION_RATES.weekdayOnCallRate.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Weekend On-Call</td>
          <td>€{COMPENSATION_RATES.weekendOnCallRate.toFixed(2)}</td>
          <td>-</td>
          <td>€{COMPENSATION_RATES.weekendOnCallRate.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Weekday Incident</td>
          <td>€{currentHourlyRate.toFixed(2)}</td>
          <td>{COMPENSATION_RATES.weekdayIncidentMultiplier}×</td>
          <td>€{weekdayEffective}</td>
        </tr>
        <tr>
          <td>Weekend Incident</td>
          <td>€{currentHourlyRate.toFixed(2)}</td>
          <td>{COMPENSATION_RATES.weekendIncidentMultiplier}×</td>
          <td>€{weekendEffective}</td>
        </tr>
        <tr>
          <td>Night Shift (additional)</td>
          <td>-</td>
          <td>{COMPENSATION_RATES.nightShiftBonusMultiplier}×</td>
          <td>+{((COMPENSATION_RATES.nightShiftBonusMultiplier - 1) * 100).toFixed(0)}% bonus</td>
        </tr>
      </tbody>
    </SharedCompensationTable>
  );
};

export default SharedRatesPanelContent; 
import React from 'react';
import styled from '@emotion/styled';
import {
  SharedCompensationTable,
  SharedMobileRatesContainer
} from './ui';

interface SharedRatesPanelContentProps {
  displayMode?: 'compact' | 'full';
}

const SharedRatesPanelContent: React.FC<SharedRatesPanelContentProps> = ({ displayMode = 'full' }) => {
  return (
    <SharedCompensationTable>
      <thead>
        <tr>
          <th>Type</th>
          <th>Rate</th>
          <th>Multiplier</th>
          <th>Effective</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Weekday On-Call (non-office hours)</td>
          <td>€3.90/hr</td>
          <td>-</td>
          <td>€3.90/hr</td>
        </tr>
        <tr>
          <td>Weekend On-Call</td>
          <td>€7.34/hr</td>
          <td>-</td>
          <td>€7.34/hr</td>
        </tr>
        <tr>
          <td>Weekday Incident</td>
          <td>€33.50/hr</td>
          <td>1.8×</td>
          <td>€60.30/hr</td>
        </tr>
        <tr>
          <td>Weekend Incident</td>
          <td>€33.50/hr</td>
          <td>2.0×</td>
          <td>€67.00/hr</td>
        </tr>
        <tr>
          <td>Night Shift (additional)</td>
          <td>-</td>
          <td>1.4×</td>
          <td>+40% bonus</td>
        </tr>
      </tbody>
    </SharedCompensationTable>
  );
};

export default SharedRatesPanelContent; 
import React from 'react';
import styled from '@emotion/styled'; // Import styled for any minor local styles if needed, or just for consistency
import {
  SharedCompensationTable,
  SharedMobileRatesContainer
} from './ui'; // Assuming ui/index.ts exports these

// Define a wrapper for mobile styles activation if SharedMobileRatesContainer needs it
// Or, we can adjust SharedMobileRatesContainer to be always 'display: block' under its media query.
// For now, let's assume SharedMobileRatesContainer handles its own visibility via its media query.

const DesktopTableContainer = styled.div`
  // This class was used in CompensationSection, let's see if it's needed
  // or if SharedCompensationTable can be used directly.
  // For now, keeping it to match original structure, can be refactored.
  display: block; // Default to block, or use media queries if it should hide on mobile

  @media (max-width: 480px) { // Hide desktop table on very small screens where mobile rates show
    display: none;
  }
`;

const MobileRatesView = styled(SharedMobileRatesContainer)`
  display: none; // Initially hidden
  @media (max-width: 480px) {
    display: block; // Shown only on small screens
  }
`;

const SharedRatesPanelContent: React.FC = () => {
  return (
    <div>
      <DesktopTableContainer>
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
              <td>€3.90/hour</td>
              <td>-</td>
              <td>€3.90/hour</td>
            </tr>
            <tr>
              <td>Weekend On-Call</td>
              <td>€7.34/hour</td>
              <td>-</td>
              <td>€7.34/hour</td>
            </tr>
            <tr>
              <td>Weekday Incident</td>
              <td>€33.50/hour</td>
              <td>1.8×</td>
              <td>€60.30/hour</td>
            </tr>
            <tr>
              <td>Weekend Incident</td>
              <td>€33.50/hour</td>
              <td>2.0×</td>
              <td>€67.00/hour</td>
            </tr>
            <tr>
              <td>Night Shift (additional)</td>
              <td>-</td>
              <td>1.4×</td>
              <td>+40% bonus</td>
            </tr>
          </tbody>
        </SharedCompensationTable>
      </DesktopTableContainer>
      
      <MobileRatesView>
        {/* Structure for mobile rates, similar to CompensationSection */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekday On-Call (non-office hours)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Rate: €3.90/hour</span>
            <span>Effective: €3.90/hour</span>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekend On-Call</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Rate: €7.34/hour</span>
            <span>Effective: €7.34/hour</span>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekday Incident</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Base: €33.50/hour</span>
            <span>Mult: 1.8×</span>
          </div>
          <div style={{marginTop: '0.25rem'}}>Effective: €60.30/hour</div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Weekend Incident</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Base: €33.50/hour</span>
            <span>Mult: 2.0×</span>
          </div>
          <div style={{marginTop: '0.25rem'}}>Effective: €67.00/hour</div>
        </div>
        <div style={{ marginBottom: '0' }}>{/* Last item, no margin-bottom */}
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Night Shift (additional)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Multiplier: 1.4×</span>
            <span>Effect: +40%</span>
          </div>
        </div>
      </MobileRatesView>
    </div>
  );
};

export default SharedRatesPanelContent; 
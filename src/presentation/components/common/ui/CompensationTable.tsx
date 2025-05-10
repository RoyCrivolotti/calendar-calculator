import styled from '@emotion/styled';

export const SharedCompensationTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  table-layout: fixed; // From CompensationSection for better control
  
  th, td {
    padding: 0.75rem 1rem; // A common padding, can be adjusted
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    word-wrap: break-word; // From CompensationSection
    overflow-wrap: break-word; // From CompensationSection
    vertical-align: top; // From CompensationSection
  }
  
  th {
    color: #64748b;
    font-weight: 500;
    font-size: 0.875rem;
    background: #f8fafc;
    white-space: nowrap; // From CompensationSection
  }
  
  td {
    color: #334155;
    font-size: 0.9rem; // Slightly larger default from MonthlyCompSummary
  }
  
  // Column widths from CompensationSection - can be fine-tuned or made props if variability is needed
  // th:nth-of-type(1), td:nth-of-type(1) { width: 40%; }
  // th:nth-of-type(2), td:nth-of-type(2) { width: 20%; }
  // th:nth-of-type(3), td:nth-of-type(3) { width: 15%; }
  // th:nth-of-type(4), td:nth-of-type(4) { width: 25%; }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background: #f8fafc;
  }
  
  @media (max-width: 768px) { // From CompensationSection for mobile adjustments
    th, td {
      padding: 0.5rem;
      font-size: 0.75rem;
    }
  }
`;

export const SharedMobileRatesContainer = styled.div`
  display: none; // Default to hidden, consuming component logic will show it
  
  // Styles from CompensationSection, for when it is made visible
  @media (max-width: 480px) {
    // display: block; // Consuming component will control this via className or style prop
    div[style*="font-weight: 600"] { // Target title-like divs
      margin-bottom: 0.25rem;
    }
    div[style*="display: flex"] { // Target rows
      justify-content: space-between;
    }
    & > div { // Target each rate entry block
       margin-bottom: 1rem;
       padding-bottom: 0.5rem;
       border-bottom: 1px solid #e9ecef;
       &:last-child {
        border-bottom: none;
        margin-bottom: 0;
       }
    }
  }
`; 
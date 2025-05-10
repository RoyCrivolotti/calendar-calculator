import styled from '@emotion/styled';

export const SharedCompensationTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  table-layout: fixed;
  
  th, td {
    padding: 0.6rem 0.8rem; // Reduced padding
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    vertical-align: top;
  }
  
  th {
    color: #64748b;
    font-weight: 500;
    font-size: 0.8rem; // Slightly reduced th font size for consistency
    background: #f8fafc;
    white-space: nowrap; // Added back to prevent header text wrapping
  }
  
  td {
    color: #334155;
    font-size: 0.85rem;
  }
  
  // Adjusted column widths and Multiplier header alignment
  th:nth-of-type(1), td:nth-of-type(1) { width: 35%; } // Type
  th:nth-of-type(2), td:nth-of-type(2) { width: 25%; } // Rate
  th:nth-of-type(3) { width: 18%; text-align: center; } // Multiplier header (centered)
  td:nth-of-type(3) { width: 18%; }                      // Multiplier data cells
  th:nth-of-type(4), td:nth-of-type(4) { width: 22%; } // Effective
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background: #f8fafc;
  }
  
  // Keep existing media query for very small screens, though it might be less critical now
  @media (max-width: 768px) { 
    // This media query might conflict or be redundant if the defaults are small enough.
    // For now, let's keep it but be aware its effect might change.
    // Consider if these specific mobile styles are still desired on top of new defaults.
    // th, td {
    //   padding: 0.5rem; // This is smaller than new default
    //   font-size: 0.75rem; // This is smaller than new default
    // }
  }
`;

export const SharedMobileRatesContainer = styled.div`
  color: #333; // Added default dark text color for visibility
  // Styles for a compact, vertical layout of rates.
  // display: none; // REMOVED - visibility will be controlled by parent component logic.
  
  // @media (max-width: 480px) { // REMOVED - no longer viewport dependent for display:block
    // display: block;
  // }

  // Retain styling for children when this container IS displayed
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
`; 
import styled from '@emotion/styled';
import { CalendarIcon, ClockIcon } from '../../../../assets/icons'; // Assuming icon path

export const SharedEventItem = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const SharedEventTimeContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

export const SharedEventTime = styled.div`
  color: #334155;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const SharedEventMetadata = styled.div`
  display: flex;
  align-items: center;
  margin-top: 0.5rem;
  justify-content: space-between;
`;

export const SharedHolidayIndicator = styled.span`
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-weight: 500;
`;

export const SharedEventDuration = styled.span`
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

// Using soft colors as per the improved version in CompensationSection
export const SharedEventBadge = styled.span<{ color: string }>`
  color: ${props => 
    props.color === '#3b82f6' ? '#0369a1' :  // Blue (On-Call) -> Darker blue text
    props.color === '#f43f5e' ? '#b91c1c' :  // Red (Incident) -> Darker red text
    '#0f172a'};
  background-color: ${props => 
    props.color === '#3b82f6' ? '#e0f2fe' :  // Blue (On-Call) -> Soft blue background
    props.color === '#f43f5e' ? '#fee2e2' :  // Red (Incident) -> Soft red background
    '#f1f5f9'};
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 0.5rem;
`;

export const SharedEventInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
`;

// Example of how icons could be used if needed directly in these components,
// though typically they'd be passed in or used by the consuming component.
// export const StyledCalendarIcon = styled(CalendarIcon)`
//   width: 16px;
//   height: 16px;
//   color: currentColor;
// `;

// export const StyledClockIcon = styled(ClockIcon)`
//   width: 16px;
//   height: 16px;
//   color: currentColor;
// `; 
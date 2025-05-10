import React from 'react';
import styled from '@emotion/styled';
import { CompensationSummary } from '../../../domain/calendar/types/CompensationSummary';

const SummaryContainer = styled.div`
  /* margin-top: 1.5rem; */
  /* border-top: 1px solid #e2e8f0; */
  /* padding-top: 1rem; */
`;


const SummarySection = styled.div`
  margin-bottom: 1.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  background-color: #f8fafc;
`;

const SummaryRow = styled.div`
  display: grid;
  grid-template-columns: 180px 1fr;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  
  &:last-of-type {
    margin-bottom: 0;
  }
`;

const Label = styled.span`
  color: #64748b;
`;

const Value = styled.span`
  color: #0f172a;
  font-weight: 500;
  text-align: right;
`;

const NightShiftBadge = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  background-color: #fef9c3;
  color: #854d0e;
  margin-left: 0.5rem;
`;

const TotalRow = styled(SummaryRow)`
  font-weight: 600;
  font-size: 1rem;
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  border-top: 1px dashed #e2e8f0;
  color: #0f172a;
`;

const DetailSection = styled.div`
  background: white;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border: 1px solid #e2e8f0;
  
  &:last-of-type {
    margin-bottom: 0;
  }
`;

const DetailTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #0f172a;
  font-size: 0.875rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
`;

const MonthTitle = styled.div`
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
`;

interface CompensationSummarySectionProps {
  summary: CompensationSummary;
}

const CompensationSummarySection: React.FC<CompensationSummarySectionProps> = ({ summary }) => {
  if (!summary) return null;
  
  const { hours, details, total, monthlyBreakdown } = summary;
  
  const isIncident = details.length > 0 && details[0].description.toLowerCase().includes('incident');

  let compensatedWeekdayOnCallHours = 0;
  let calculatedNonBillableWeekdayHours = 0;

  if (!isIncident) {
    const weekdayOnCallDetails = details.filter(
      d => d.description.toLowerCase() === 'weekday on-call'
    );
    compensatedWeekdayOnCallHours = weekdayOnCallDetails.reduce((sum, d) => sum + d.hours, 0);

    // Ensure hours.weekday is a valid number before subtraction
    const totalWeekdayHours = typeof hours.weekday === 'number' ? hours.weekday : 0;
    calculatedNonBillableWeekdayHours = totalWeekdayHours - compensatedWeekdayOnCallHours;
  } else {
    // For incidents, we don't explicitly show "Office Hours (Non-billable)" in the top summary,
    // and "Weekday Hours" shows total weekday hours. 
    // So, we can stick to the original hours.officeHours if needed elsewhere, or set to 0 if not applicable here.
    // For now, this specific calculation is only for the non-incident path.
  }
  
  return (
    <SummaryContainer>
      {/* <SummaryTitle>Compensation Details</SummaryTitle> */}
      
      <SummarySection>
        <DetailTitle>Hours Breakdown</DetailTitle>
        <SummaryRow>
          <Label>Total Event Duration</Label>
          <Value>{hours.total.toFixed(1)}h</Value>
        </SummaryRow>
        
        {/* For ON-CALL events (i.e., !isIncident) */}
        {!isIncident && compensatedWeekdayOnCallHours > 0 && (
          <SummaryRow>
            <Label>Billable Weekday Hours</Label>
            <Value>{compensatedWeekdayOnCallHours.toFixed(1)}h</Value>
          </SummaryRow>
        )}
        
        {/* For INCIDENT events */}
        {isIncident && typeof hours.weekday === 'number' && hours.weekday > 0 && (
          <SummaryRow>
            <Label>Weekday Hours</Label>
            <Value>
              {hours.weekday.toFixed(1)}h
              {typeof hours.nightShift === 'number' && hours.nightShift > 0 && hours.weekday === hours.nightShift && (
                <NightShiftBadge>NS</NightShiftBadge>
              )}
            </Value>
          </SummaryRow>
        )}
        
        {/* Weekend hours for ALL event types */}
        {typeof hours.weekend === 'number' && hours.weekend > 0 && (
          <SummaryRow>
            <Label>Weekend/Holiday Hours</Label>
            <Value>
              {hours.weekend.toFixed(1)}h
              {isIncident && typeof hours.nightShift === 'number' && hours.nightShift > 0 && hours.nightShift > (typeof hours.weekday === 'number' ? hours.weekday : 0) && (
                <NightShiftBadge>NS</NightShiftBadge>
              )}
            </Value>
          </SummaryRow>
        )}
        
        {/* Office hours for ON-CALL events only, derived from the remainder */}
        {!isIncident && calculatedNonBillableWeekdayHours > 0 && (
          <SummaryRow>
            <Label>Office Hours (Non-billable)</Label>
            <Value>{calculatedNonBillableWeekdayHours.toFixed(1)}h</Value>
          </SummaryRow>
        )}
      </SummarySection>
      
      {/* Compensation breakdown */}
      {details && details.length > 0 && (
        <SummarySection>
          <DetailTitle>Compensation Breakdown</DetailTitle>
          {details.map((detail, index) => (
            <DetailSection key={index}>
              <DetailTitle>{detail.description}</DetailTitle>
              <SummaryRow>
                <Label>Hours</Label>
                <Value>{detail.hours.toFixed(1)}h</Value>
              </SummaryRow>
              <SummaryRow>
                <Label>Base Rate</Label>
                <Value>€{detail.rate.toFixed(2)}/h</Value>
              </SummaryRow>
              {detail.multiplier && (
                <SummaryRow>
                  <Label>Multiplier</Label>
                  <Value>×{detail.multiplier.toFixed(1)}</Value>
                </SummaryRow>
              )}
              {detail.nightShiftMultiplier && (
                <SummaryRow>
                  <Label>Night Shift Bonus</Label>
                  <Value>×{detail.nightShiftMultiplier.toFixed(1)}</Value>
                </SummaryRow>
              )}
              <TotalRow>
                <span>Subtotal</span>
                <span>€{detail.amount.toFixed(2)}</span>
              </TotalRow>
            </DetailSection>
          ))}
        </SummarySection>
      )}
      
      {/* Monthly breakdown */}
      {monthlyBreakdown && monthlyBreakdown.length > 1 && (
        <SummarySection>
          <DetailTitle>Monthly Breakdown</DetailTitle>
          {monthlyBreakdown.map((month, index) => (
            <DetailSection key={index}>
              <MonthTitle>{month.month}</MonthTitle>
              {month.details.map((detail, detailIndex) => (
                <SummaryRow key={detailIndex}>
                  <Label>{detail.description}</Label>
                  <Value>€{detail.amount.toFixed(2)}</Value>
                </SummaryRow>
              ))}
              <TotalRow>
                <span>Month Total</span>
                <span>€{month.amount.toFixed(2)}</span>
              </TotalRow>
            </DetailSection>
          ))}
        </SummarySection>
      )}
      
      <TotalRow>
        <span>Total Compensation</span>
        <span>€{total.toFixed(2)}</span>
      </TotalRow>
    </SummaryContainer>
  );
};

export default CompensationSummarySection; 
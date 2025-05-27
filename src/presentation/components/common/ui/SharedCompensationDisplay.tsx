import React from 'react';
import styled from '@emotion/styled';

interface CompensationDataItem {
  type: string;
  amount: number;
  color: string;
  percentage?: number;
  // Add any other properties that might be on the items in compensationData
}

interface SharedCompensationDisplayProps {
  data: CompensationDataItem[];
  title?: string; // Optional title for the section
}

export const SharedCompensationBreakdownSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1rem 0;
`;

export const SharedCompensationCategory = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  flex: 1;
  min-width: 180px;
`;

export const SharedCategoryColor = styled.div<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
  flex-shrink: 0;
  margin-right: 0.25rem;
`;

export const SharedCategoryAmount = styled.div`
  font-weight: 600;
  color: #0f172a;
  font-size: 1rem;
`;

export const SharedCategoryPercentage = styled.div`
  font-size: 0.75rem;
  color: #64748b;
`;

const DefaultTitle = styled.div`
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #64748b;
  font-size: 0.9rem;
`;

const SharedCompensationDisplay: React.FC<SharedCompensationDisplayProps> = ({ data, title }) => {
  if (!data || data.length === 0) {
    return null; // Or some empty state message
  }

  return (
    <>
      {title && <DefaultTitle>{title}</DefaultTitle>}
      <SharedCompensationBreakdownSection>
        {data.map((item, index) => (
          <SharedCompensationCategory key={`category-display-${index}`}>
            <SharedCategoryColor 
              color={item.color}
              title={`Color indicator for ${item.type}`} // Accessibility: provide a title for the color
            />
            <div>
              <div style={{ color: '#0f172a', fontWeight: 500 }}>
                {item.type}
              </div>
              <SharedCategoryAmount>€{item.amount.toFixed(2)}</SharedCategoryAmount>
              {item.percentage !== undefined && (
                <SharedCategoryPercentage>{item.percentage.toFixed(1)}% of total</SharedCategoryPercentage>
              )}
            </div>
          </SharedCompensationCategory>
        ))}
      </SharedCompensationBreakdownSection>
    </>
  );
};

export default SharedCompensationDisplay; 
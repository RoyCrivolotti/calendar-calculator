import React from 'react';
import styled from '@emotion/styled';
import PageButton from './PageButton';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const PageInfo = styled.div`
  font-size: 0.8rem;
  color: #64748b;
`;

const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PageNumber = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  padding: 0 0.25rem;
`;

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}) => {
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(startIndex + itemsPerPage - 1, totalItems);

  return (
    <PaginationContainer>
      <PageInfo>
        Showing {totalItems > 0 ? startIndex : 0}-{endIndex} of {totalItems}
      </PageInfo>
      
      <ButtonsContainer>
        <PageButton
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        >
          Previous
        </PageButton>
        
        <PageNumber>{currentPage} / {totalPages}</PageNumber>
        
        <PageButton
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        >
          Next
        </PageButton>
      </ButtonsContainer>
    </PaginationContainer>
  );
};

export default PaginationControls; 
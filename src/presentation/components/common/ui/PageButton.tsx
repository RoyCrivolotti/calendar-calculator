import React, { ButtonHTMLAttributes } from 'react';
import styled from '@emotion/styled';

interface PageButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  disabled?: boolean;
}

const StyledPageButton = styled.button<{ disabled?: boolean }>`
  padding: 0.25rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: ${props => props.disabled ? '#f8fafc' : 'white'};
  color: ${props => props.disabled ? '#cbd5e1' : '#0f172a'};
  font-size: 0.8rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }
`;

const PageButton: React.FC<PageButtonProps> = ({ children, disabled = false, ...props }) => {
  return (
    <StyledPageButton disabled={disabled} {...props}>
      {children}
    </StyledPageButton>
  );
};

export default PageButton; 
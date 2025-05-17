import React, { ReactNode, ButtonHTMLAttributes } from 'react';
import styled from '@emotion/styled';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
}

interface StyledButtonProps {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth?: boolean;
}

const getVariantStyles = (variant: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return `
        background-color: #3b82f6;
        color: white;
        &:hover:not(:disabled) {
          background-color: #2563eb;
        }
      `;
    case 'secondary':
      return `
        background-color: #f1f5f9;
        color: #334155;
        &:hover:not(:disabled) {
          background-color: #e2e8f0;
          color: #1e293b;
        }
      `;
    case 'danger':
      return `
        background-color: #ef4444;
        color: white;
        &:hover:not(:disabled) {
          background-color: #dc2626;
        }
      `;
    case 'text':
      return `
        background-color: transparent;
        color: #334155;
        &:hover:not(:disabled) {
          background-color: #f8fafc;
          color: #1e293b;
        }
      `;
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'small':
      return `
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
      `;
    case 'medium':
      return `
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      `;
    case 'large':
      return `
        padding: 1rem 2rem;
        font-size: 1.125rem;
      `;
  }
};

const StyledButton = styled.button<StyledButtonProps>`
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: ${(props) => (props.fullWidth ? '100%' : 'auto')};
  
  ${(props) => getVariantStyles(props.variant)}
  ${(props) => getSizeStyles(props.size)}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  }
`;

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  fullWidth = false,
  disabled = false,
  ...props
}) => {
  return (
    <StyledButton
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      {...props}
    >
      {children}
    </StyledButton>
  );
};

export default Button; 
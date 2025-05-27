import styled from '@emotion/styled';

interface SharedButtonRowProps {
  justify?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around';
  marginTop?: string;
  marginBottom?: string;
}

const SharedButtonRow = styled.div<SharedButtonRowProps>`
  display: flex;
  gap: 1rem; // Default gap, could be a prop
  margin-top: ${props => props.marginTop || '1.5rem'}; 
  margin-bottom: ${props => props.marginBottom || '0'}; // Default to 0 if only used once like in current modal
  justify-content: ${props => props.justify || 'center'};
  
  @media (max-width: 640px) { // Could make this breakpoint a prop
    flex-direction: column;
  }
`;

export default SharedButtonRow; 
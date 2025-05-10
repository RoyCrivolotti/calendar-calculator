import styled from '@emotion/styled';

// Could add props for tag (h1, h2, etc.), alignment, or other variations if needed
const SharedSectionTitle = styled.h2` 
  color: #0f172a;
  font-size: 1.75rem; // Consider making font-size a prop or theme variable
  font-weight: 700;
  margin: 0 0 1.5rem; // Consider making margin a prop
  padding-bottom: 1rem; // Consider making padding a prop
  border-bottom: 2px solid #f1f5f9; // Consider making border a prop
`;

export default SharedSectionTitle; 
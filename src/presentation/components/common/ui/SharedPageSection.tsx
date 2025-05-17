import styled from '@emotion/styled';

const SharedPageSection = styled.div`
  width: 93%; // Or make this a prop if it needs to vary
  margin: 2rem auto;
  position: relative; // If children need absolute positioning relative to this
  min-height: 120px; // Or remove if content dictates height
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1rem; // Or make this a prop
  border: 2px solid #e2e8f0;
`;

export default SharedPageSection; 
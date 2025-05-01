import styled from '@emotion/styled';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-width: 400px;
  width: 90%;
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #0f172a;
  font-size: 1.25rem;
  font-weight: 600;
`;

const ModalText = styled.p`
  margin: 0 0 1.5rem 0;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.5;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'danger' | 'secondary' }>`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => props.variant === 'danger' ? `
    background-color: #ef4444;
    color: white;
    &:hover {
      background-color: #dc2626;
    }
  ` : `
    background-color: #f1f5f9;
    color: #0f172a;
    &:hover {
      background-color: #e2e8f0;
    }
  `}
`;

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm }: DeleteConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalTitle>Delete On-Call Shift</ModalTitle>
        <ModalText>
          Are you sure you want to delete this on-call shift? This action cannot be undone.
        </ModalText>
        <ButtonGroup>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
  );
};

export default DeleteConfirmationModal; 
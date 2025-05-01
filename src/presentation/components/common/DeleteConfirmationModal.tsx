import React from 'react';
import styled from '@emotion/styled';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventTitle: string;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
`;

const Title = styled.h2`
  margin: 0 0 1rem;
  color: #333;
`;

const Message = styled.p`
  margin: 0 0 1.5rem;
  color: #666;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
`;

const Button = styled.button<{ variant?: 'danger' }>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  background-color: ${props => props.variant === 'danger' ? '#dc3545' : '#6c757d'};
  color: white;

  &:hover {
    background-color: ${props => props.variant === 'danger' ? '#c82333' : '#5a6268'};
  }
`;

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
}) => {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <Title>Delete Event</Title>
        <Message>
          Are you sure you want to delete the event "{eventTitle}"? This action cannot be undone.
        </Message>
        <ButtonGroup>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete
          </Button>
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
  );
};

export default DeleteConfirmationModal; 
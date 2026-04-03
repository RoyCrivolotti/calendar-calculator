import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { SalaryRecord, SalaryRecordProps, deriveHourlyRate, HOURS_PER_YEAR } from '../../../domain/calendar/entities/SalaryRecord';
import { SalaryService } from '../../../domain/calendar/services/SalaryService';
import { container } from '../../../config/container';
import { logger } from '../../../utils/logger';
import { Button as SharedButton, Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '../common/ui';
import { format } from 'date-fns';

const Container = styled.div`
  margin-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  padding-top: 1.5rem;
`;

const SectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
`;

const RecordList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const RecordRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
`;

const RecordInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const RecordLabel = styled.span`
  color: #64748b;
  font-size: 0.75rem;
`;

const RecordValue = styled.span`
  color: #0f172a;
  font-weight: 500;
`;

const RecordActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SmallButton = styled.button<{ variant?: 'danger' | 'secondary' }>`
  padding: 0.25rem 0.5rem;
  border: 1px solid ${p => p.variant === 'danger' ? '#fca5a5' : '#e2e8f0'};
  border-radius: 4px;
  background: ${p => p.variant === 'danger' ? '#fef2f2' : 'white'};
  color: ${p => p.variant === 'danger' ? '#dc2626' : '#475569'};
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${p => p.variant === 'danger' ? '#fee2e2' : '#f1f5f9'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #0f172a;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }
`;

const DerivedRate = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.25rem;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
  padding: 1rem;
  font-style: italic;
`;

interface SalaryManagementProps {
  onSalaryChange?: () => void;
}

const SalaryManagement: React.FC<SalaryManagementProps> = ({ onSalaryChange }) => {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [annualSalary, setAnnualSalary] = useState('');
  const [hourlyOverride, setHourlyOverride] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const salaryService = container.get<SalaryService>('salaryService');

  const loadRecords = useCallback(async () => {
    try {
      const loaded = await salaryService.loadRecords();
      setRecords(loaded);
    } catch (err) {
      logger.error('[SalaryManagement] Failed to load salary records:', err);
    }
  }, [salaryService]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const derivedRate = annualSalary ? deriveHourlyRate(parseFloat(annualSalary)) : 0;
  const effectiveRate = hourlyOverride ? parseFloat(hourlyOverride) : derivedRate;

  const handleOpenAdd = () => {
    setEditingId(null);
    setAnnualSalary('');
    setHourlyOverride('');
    setEffectiveDate('');
    setShowForm(true);
  };

  const handleEdit = (record: SalaryRecord) => {
    setEditingId(record.id);
    setAnnualSalary(record.annualSalary.toString());
    setHourlyOverride(record.baseHourlySalary.toString());
    setEffectiveDate(format(record.effectiveDate, 'yyyy-MM-dd'));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!annualSalary || !effectiveDate) return;
    setSaving(true);

    try {
      const id = editingId || crypto.randomUUID();
      const record = new SalaryRecord({
        id,
        annualSalary: parseFloat(annualSalary),
        baseHourlySalary: effectiveRate,
        effectiveDate: new Date(effectiveDate + 'T00:00:00'),
      });

      await salaryService.saveRecord(record);
      await loadRecords();
      setShowForm(false);
      onSalaryChange?.();
    } catch (err) {
      logger.error('[SalaryManagement] Failed to save salary record:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await salaryService.deleteRecord(id);
      await loadRecords();
      setConfirmDeleteId(null);
      onSalaryChange?.();
    } catch (err) {
      logger.error('[SalaryManagement] Failed to delete salary record:', err);
    }
  };

  return (
    <Container>
      <SectionTitle>Salary History</SectionTitle>

      {records.length === 0 ? (
        <EmptyState>No salary records configured. Add one to enable date-aware compensation.</EmptyState>
      ) : (
        <RecordList>
          {records.map(record => (
            <RecordRow key={record.id}>
              <RecordInfo>
                <RecordValue>€{record.annualSalary.toLocaleString('de-DE', { minimumFractionDigits: 2 })}/yr</RecordValue>
                <RecordLabel>
                  €{record.baseHourlySalary.toFixed(2)}/hr &middot; from {format(record.effectiveDate, 'MMM d, yyyy')}
                </RecordLabel>
              </RecordInfo>
              <RecordActions>
                <SmallButton onClick={() => handleEdit(record)}>Edit</SmallButton>
                <SmallButton variant="danger" onClick={() => setConfirmDeleteId(record.id)}>Delete</SmallButton>
              </RecordActions>
            </RecordRow>
          ))}
        </RecordList>
      )}

      <SharedButton variant="secondary" onClick={handleOpenAdd} fullWidth>
        + Add Salary Record
      </SharedButton>

      {showForm && (
        <Modal isOpen={showForm} onClose={() => setShowForm(false)}>
          <ModalHeader>
            <ModalTitle>{editingId ? 'Edit Salary Record' : 'Add Salary Record'}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label>Annual Salary (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={annualSalary}
                onChange={e => setAnnualSalary(e.target.value)}
                placeholder="e.g. 75960.00"
              />
              {annualSalary && (
                <DerivedRate>
                  Auto-derived hourly rate: €{derivedRate.toFixed(2)} (÷ {HOURS_PER_YEAR} hrs/yr)
                </DerivedRate>
              )}
            </FormGroup>
            <FormGroup>
              <Label>Hourly Rate Override (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={hourlyOverride}
                onChange={e => setHourlyOverride(e.target.value)}
                placeholder={derivedRate ? derivedRate.toFixed(2) : 'Leave blank to auto-derive'}
              />
              {hourlyOverride && derivedRate > 0 && Math.abs(parseFloat(hourlyOverride) - derivedRate) > 0.01 && (
                <DerivedRate style={{ color: '#b45309' }}>
                  Overriding auto-derived rate (€{derivedRate.toFixed(2)})
                </DerivedRate>
              )}
            </FormGroup>
            <FormGroup>
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <SharedButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</SharedButton>
            <SharedButton
              variant="primary"
              onClick={handleSave}
              disabled={saving || !annualSalary || !effectiveDate}
            >
              {saving ? 'Saving...' : 'Save'}
            </SharedButton>
          </ModalFooter>
        </Modal>
      )}

      {confirmDeleteId && (
        <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
          <ModalHeader><ModalTitle>Confirm Deletion</ModalTitle></ModalHeader>
          <ModalBody><p>Are you sure you want to delete this salary record? Historical compensations may be affected.</p></ModalBody>
          <ModalFooter>
            <SharedButton variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</SharedButton>
            <SharedButton variant="danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</SharedButton>
          </ModalFooter>
        </Modal>
      )}
    </Container>
  );
};

export default React.memo(SalaryManagement);

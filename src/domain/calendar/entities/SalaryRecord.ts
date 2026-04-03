export interface SalaryRecordProps {
  id: string;
  annualSalary: number;
  baseHourlySalary: number;
  effectiveDate: Date | string;
}

export const HOURS_PER_YEAR = 2208;

export function deriveHourlyRate(annualSalary: number): number {
  return Math.round((annualSalary / HOURS_PER_YEAR) * 100) / 100;
}

export class SalaryRecord {
  readonly id: string;
  readonly annualSalary: number;
  readonly baseHourlySalary: number;
  readonly effectiveDate: Date;

  constructor(props: SalaryRecordProps) {
    this.id = props.id;
    this.annualSalary = props.annualSalary;
    this.baseHourlySalary = props.baseHourlySalary;
    this.effectiveDate = props.effectiveDate instanceof Date
      ? props.effectiveDate
      : new Date(props.effectiveDate);
  }

  toJSON(): SalaryRecordProps {
    return {
      id: this.id,
      annualSalary: this.annualSalary,
      baseHourlySalary: this.baseHourlySalary,
      effectiveDate: this.effectiveDate.toISOString(),
    };
  }
}

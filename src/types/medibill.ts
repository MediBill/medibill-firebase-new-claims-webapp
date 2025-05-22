export interface AuthToken {
  token: string;
  expiresAt: number; // Timestamp for expiration
}

export interface Doctor {
  id: string;
  name: string;
  practiceName: string;
  specialty: string;
}

export type CaseStatus = 'NEW' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Case {
  id: string;
  patientName: string;
  caseNumber: string;
  submittedDate: string; // ISO string date
  status: CaseStatus;
  insuranceProvider: string;
  amount: number;
  doctorId: string;
  doctorName?: string; // Optional: denormalized for display convenience
}

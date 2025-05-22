
import type { AuthToken, Doctor, Case, CaseStatus } from '@/types/medibill';

const DEFAULT_PASSWORD = 'password123';
const MOCK_TOKEN = 'mock-api-token-12345';

let mockDoctors: Doctor[] = [
  { id: 'doc1', name: 'Dr. Alice Smith', practiceName: 'Sunshine Pediatrics', specialty: 'Pediatrics' },
  { id: 'doc2', name: 'Dr. Bob Johnson', practiceName: 'General Care Clinic', specialty: 'General Medicine' },
  { id: 'doc3', name: 'Dr. Carol White', practiceName: 'Advanced Cardiology', specialty: 'Cardiology' },
  { id: 'doc4', name: 'Dr. David Brown', practiceName: 'TEST Practice Wellness', specialty: 'Wellness' },
  { id: 'doc5', name: 'Dr. Eve Davis', practiceName: 'Metro Orthopedics', specialty: 'Orthopedics' },
];

let mockCases: Case[] = [
  { id: 'case1', doctorId: 'doc1', patientName: 'Liam Green', caseNumber: 'PN001', submittedDate: '2024-05-01T10:00:00Z', status: 'NEW', insuranceProvider: 'MediCare Plus', amount: 150.00, doctorName: 'Dr. Alice Smith' },
  { id: 'case2', doctorId: 'doc1', patientName: 'Olivia Blue', caseNumber: 'PN002', submittedDate: '2024-05-02T11:30:00Z', status: 'PROCESSED', insuranceProvider: 'HealthFirst', amount: 220.50, doctorName: 'Dr. Alice Smith' }, // Was PENDING
  { id: 'case3', doctorId: 'doc2', patientName: 'Noah Grey', caseNumber: 'GN001', submittedDate: '2024-05-03T09:15:00Z', status: 'PROCESSED', insuranceProvider: 'UnitedHealth', amount: 95.75, doctorName: 'Dr. Bob Johnson' }, // Was APPROVED
  { id: 'case4', doctorId: 'doc2', patientName: 'Emma Black', caseNumber: 'GN002', submittedDate: '2024-05-04T14:00:00Z', status: 'NEW', insuranceProvider: 'MediCare Plus', amount: 300.00, doctorName: 'Dr. Bob Johnson' },
  { id: 'case5', doctorId: 'doc3', patientName: 'Ava Purple', caseNumber: 'CN001', submittedDate: '2024-05-05T16:45:00Z', status: 'PROCESSED', insuranceProvider: 'Aetna', amount: 500.20, doctorName: 'Dr. Carol White' }, // Was REJECTED
  { id: 'case6', doctorId: 'doc5', patientName: 'James Gold', caseNumber: 'ON001', submittedDate: '2024-05-06T08:00:00Z', status: 'NEW', insuranceProvider: 'Cigna', amount: 1200.00, doctorName: 'Dr. Eve Davis' },
  { id: 'case7', doctorId: 'doc5', patientName: 'Sophia Silver', caseNumber: 'ON002', submittedDate: '2024-05-07T13:20:00Z', status: 'PROCESSED', insuranceProvider: 'HealthFirst', amount: 750.00, doctorName: 'Dr. Eve Davis' }, // Was PENDING
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const login = async (password: string): Promise<AuthToken> => {
  await delay(500);
  if (password === DEFAULT_PASSWORD) {
    return {
      token: MOCK_TOKEN,
      expiresAt: Date.now() + 3600 * 1000, // Token expires in 1 hour
    };
  }
  throw new Error('Invalid credentials');
};

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  await delay(800);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  // Filter out practices with 'TEST' in their name
  return mockDoctors.filter(doc => !doc.practiceName.toUpperCase().includes('TEST'));
};

export const getDoctorCases = async (token: string, doctorId: string): Promise<Case[]> => {
  await delay(600);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  return mockCases.filter(c => c.doctorId === doctorId);
};

export const getAllCasesForDoctors = async (token: string, doctorIds: string[]): Promise<Case[]> => {
  await delay(1000);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  const allCases: Case[] = [];
  for (const doctorId of doctorIds) {
    const doctor = mockDoctors.find(d => d.id === doctorId);
    const cases = mockCases.filter(c => c.doctorId === doctorId).map(c => ({...c, doctorName: doctor?.name}));
    allCases.push(...cases);
  }
  return allCases;
};


export const updateCaseStatus = async (token: string, caseId: string, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  await delay(400);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  const caseIndex = mockCases.findIndex(c => c.id === caseId);
  if (caseIndex > -1) {
    mockCases[caseIndex].status = newStatus;
    return { success: true, updatedCase: mockCases[caseIndex] };
  }
  return { success: false };
};

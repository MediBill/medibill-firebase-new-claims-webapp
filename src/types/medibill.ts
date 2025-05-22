
export interface AuthToken {
  token: string;
  expiresAt: number; // Timestamp for expiration
}

export interface Doctor {
  id: string; // Corresponds to doctor_acc_no in some contexts if that's the identifier from API
  name: string;
  practiceName: string;
  specialty: string;
}

export type CaseStatus = 'NEW' | 'PROCESSED';

// Raw structure from the API
export interface ApiCase {
  id: number; // Matches the provided JSON structure
  doctor_acc_no: string;
  patient_name: string;
  treating_surgeon: string;
  weight?: number | null;
  height?: number | null;
  service_date: string; // "YYYY-MM-DD"
  start_time?: string | null; // "HH:MM"
  end_time?: string | null; // "HH:MM"
  icd10_codes?: string[] | null;
  procedure_codes?: string[] | null;
  consultations?: string[] | null;
  ortho_modifiers?: string[] | null;
  procedures?: string[] | null;
  modifiers?: string[] | null;
  bp_start_time?: string | null;
  bp_end_time?: string | null;
  hospital_sticker_image_url?: string | null;
  admission_form_image_url?: string | null;
  notes?: string | null;
  birth_weight?: number | null;
  primary_assistant?: string | null;
  secondary_assistant?: string | null;
  referring_service_provider?: string | null;
  referred_by_icd10?: string[] | null;
  asa_level?: number | null;
  case_status: string; // Can be "", "NEW", "PROCESSED" from API
}

// Processed Case structure for frontend use
export interface Case extends Omit<ApiCase, 'case_status'> {
  status: CaseStatus; // Derived from case_status, always 'NEW' or 'PROCESSED'
  submittedDateTime: string; // Combined service_date and start_time as ISO string
  // Retain original case_status if needed for other logic, though status is primary for UI
  original_case_status: string; 
}

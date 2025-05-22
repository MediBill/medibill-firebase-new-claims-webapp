
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

const DEFAULT_PASSWORD = 'password123';
const MOCK_TOKEN = 'mock-api-token-12345';

// Mock doctors list (remains structurally similar)
let mockDoctors: Doctor[] = [
  { id: 'DOE', name: 'Dr. John Doe', practiceName: 'General Care Clinic', specialty: 'General Medicine' },
  { id: 'SMI', name: 'Dr. Alice Smith', practiceName: 'Sunshine Pediatrics', specialty: 'Pediatrics' },
  { id: 'BRO', name: 'Dr. David Brown', practiceName: 'TEST Practice Wellness', specialty: 'Wellness' },
  { id: 'MAC', name: 'DR MACMILLIAN', practiceName: 'Advanced Cardiology', specialty: 'Cardiology'},
];

// Updated mock cases based on the new structure and user-provided example
let mockApiCases: ApiCase[] = [
  {
    id: 1,
    doctor_acc_no: "DOE",
    patient_name: "William Cornelly",
    treating_surgeon: "DOE J DR",
    weight: 98,
    height: 170,
    service_date: "2024-03-07",
    start_time: "10:00",
    end_time: "12:30",
    icd10_codes: ["A00", "A00.0", "A00.1"],
    procedure_codes: ["0718", "1083", "1084"],
    consultations: ["0151 [pre-op (10-20mins)]", "0173 [first hospital consult (< 15mins)]", "0145 [away non-emergency consult]"],
    ortho_modifiers: ["5441 [any other bones]", "5444 [shaft of femur]", "5448 [sternum and/or ribs]"],
    procedures: ["0026 [one lung ventilation]", "1141 [intercostal drain]", "1780 [gastric intubation]"],
    modifiers: ["0032 [position]", "0043 [age > 70yrs or age <1 year]", "0044 [neonates < 28d]"],
    bp_start_time: "11:00",
    bp_end_time: "14:00",
    hospital_sticker_image_url: "https://placehold.co/300x200.png", // Added placeholder
    admission_form_image_url: "https://placehold.co/300x220.png", // Added placeholder
    notes: "Patient reported feeling unwell post-op. This is an extended note to test wrapping and display within the detail sheet. It might contain multiple lines.",
    birth_weight: 5, // Updated as per user example
    primary_assistant: "DR MACMILLIAN",
    secondary_assistant: "",
    referring_service_provider: "General practitioners INC",
    referred_by_icd10: ["A00", "A00.0", "A00.1"],
    asa_level: 3,
    case_status: "NEW"
  },
  {
    id: 2,
    doctor_acc_no: "DOE",
    patient_name: "Cathrine Macconel",
    treating_surgeon: "DOE J DR",
    weight: 68,
    height: 165,
    service_date: "2024-03-09",
    start_time: "11:00",
    end_time: "14:30",
    icd10_codes: ["B01", "B01.0"], // Kept some variety from previous
    procedure_codes: ["0822"], // Kept some variety
    consultations: ["0151 [pre-op (10-20mins)]", "0173 [first hospital consult (< 15mins)]"], // Updated
    ortho_modifiers: ["5441 [any other bones]"], // Updated
    procedures: ["0026 [one lung ventilation]", "1141 [intercostal drain]"], // Updated
    modifiers: ["0032 [position]", "0043 [age > 70yrs or age <1 year]"], // Updated
    bp_start_time: "14:00",
    bp_end_time: "16:00",
    hospital_sticker_image_url: "https://placehold.co/350x250.png", // Changed placeholder
    admission_form_image_url: "", // Example of one empty URL
    notes: "Routine procedure, no complications noted. Patient recovering well.",
    birth_weight: 5, // Updated as per user example
    primary_assistant: "DR MACMILLIAN",
    secondary_assistant: "DR SMITH", // Kept variety
    referring_service_provider: "City Hospital Referrals",
    referred_by_icd10: ["B01"], // Kept variety
    asa_level: 2,
    case_status: "PROCESSED"
  },
  {
    id: 3,
    doctor_acc_no: "SMI", // Dr. Alice Smith
    patient_name: "Junior Mint",
    treating_surgeon: "Dr. Alice Smith",
    weight: 10,
    height: 70,
    service_date: "2024-04-01",
    start_time: "09:00",
    end_time: "09:30",
    icd10_codes: ["P07.3"], // Preterm infant
    procedure_codes: ["99221"], // Initial hospital care
    consultations: [],
    ortho_modifiers: [],
    procedures: [],
    modifiers: ["0044 [neonates < 28d]"],
    bp_start_time: "09:05",
    bp_end_time: "09:25",
    hospital_sticker_image_url: null, // Explicitly null
    admission_form_image_url: "https://placehold.co/200x150.png",
    notes: "Checkup for premature infant.",
    birth_weight: 2.5,
    primary_assistant: "",
    secondary_assistant: "",
    referring_service_provider: "NICU",
    referred_by_icd10: ["P07"],
    asa_level: 3,
    case_status: "" // Empty, should default to NEW
  },
   {
    id: 4,
    doctor_acc_no: "DOE",
    patient_name: "Another Patient",
    treating_surgeon: "DOE J DR",
    weight: 75,
    height: 175,
    service_date: "2024-04-15",
    start_time: "13:00",
    end_time: "15:00",
    icd10_codes: ["S52.501A"],
    procedure_codes: ["23630"],
    consultations: ["0160 [pre-op assessment]"],
    ortho_modifiers: ["5441 [any other bones]"],
    procedures: ["0019 [anaesthesia for procedure on forearm, wrist, or hand]"],
    modifiers: [],
    bp_start_time: "13:30",
    bp_end_time: "14:30",
    hospital_sticker_image_url: "",
    admission_form_image_url: "",
    notes: "Fracture treatment.",
    birth_weight: null,
    primary_assistant: "DR JONES",
    secondary_assistant: "",
    referring_service_provider: "ER Department",
    referred_by_icd10: ["S52"],
    asa_level: 1,
    case_status: "NEW"
  }
];

const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW'; // Default for empty or unrecognized case_status
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW') {
    status = 'NEW';
  }

  const validStartTime = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/) ? apiCase.start_time + ':00' : '00:00:00';
  const submittedDateTime = `${apiCase.service_date}T${validStartTime}Z`;

  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status,
  };
};

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
  return mockDoctors.filter(doc => !doc.practiceName.toUpperCase().includes('TEST'));
};

export const getDoctorCases = async (token: string, doctorAccNo: string): Promise<Case[]> => {
  await delay(600);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  const filteredApiCases = mockApiCases.filter(c => c.doctor_acc_no === doctorAccNo);
  return filteredApiCases.map(processApiCase);
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  await delay(1000);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  
  const relevantApiCases = mockApiCases.filter(apiCase => doctorAccNos.includes(apiCase.doctor_acc_no));
  return relevantApiCases.map(processApiCase);
};


export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  await delay(400);
  if (token !== MOCK_TOKEN) throw new Error('Unauthorized');
  const caseIndex = mockApiCases.findIndex(c => c.id === caseId);
  if (caseIndex > -1) {
    mockApiCases[caseIndex].case_status = newStatus; 
    const updatedProcessedCase = processApiCase(mockApiCases[caseIndex]);
    return { success: true, updatedCase: updatedProcessedCase };
  }
  return { success: false };
};

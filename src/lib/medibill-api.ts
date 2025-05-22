
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// --- IMPORTANT ---
// The following are placeholders for your actual API endpoints.
// You will need to replace these with your live API URLs.
const API_BASE_URL = 'https://your-api-domain.com/api'; // Replace with your actual API base URL
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;
const DOCTORS_ENDPOINT = `${API_BASE_URL}/doctors`;
const CASES_ENDPOINT = `${API_BASE_URL}/cases`; // This might need /doctors/{id}/cases or similar
const UPDATE_CASE_ENDPOINT = `${API_BASE_URL}/cases/{caseId}/status`; // Or similar for updating

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
    hospital_sticker_image_url: "https://placehold.co/300x200.png",
    admission_form_image_url: "https://placehold.co/300x220.png",
    notes: "Patient reported feeling unwell post-op. This is an extended note to test wrapping and display within the detail sheet. It might contain multiple lines.",
    birth_weight: 5,
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
    icd10_codes: ["B01", "B01.0"],
    procedure_codes: ["0822"],
    consultations: ["0151 [pre-op (10-20mins)]", "0173 [first hospital consult (< 15mins)]"],
    ortho_modifiers: ["5441 [any other bones]"],
    procedures: ["0026 [one lung ventilation]", "1141 [intercostal drain]"],
    modifiers: ["0032 [position]", "0043 [age > 70yrs or age <1 year]"],
    bp_start_time: "14:00",
    bp_end_time: "16:00",
    hospital_sticker_image_url: "https://placehold.co/350x250.png",
    admission_form_image_url: "",
    notes: "Routine procedure, no complications noted. Patient recovering well.",
    birth_weight: 5, // Assuming birth_weight was intended here as per prior examples
    primary_assistant: "DR MACMILLIAN",
    secondary_assistant: "DR SMITH",
    referring_service_provider: "City Hospital Referrals",
    referred_by_icd10: ["B01"],
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
    hospital_sticker_image_url: null,
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

export const login = async (email: string, password: string): Promise<AuthToken> => {
  await delay(500); // Simulate network delay

  // --- REPLACE THIS MOCK LOGIC WITH ACTUAL API CALL ---
  // This is a placeholder for calling your actual login API endpoint.
  // The provided credentials are used here for the mock check.
  const MOCK_API_TOKEN = 'live-api-token-from-server'; // This would come from the API response

  if (email === 'medibill.developer@gmail.com' && password === 'apt@123!') {
    console.log('Mock login successful with provided developer credentials.');
    return {
      token: MOCK_API_TOKEN, // In a real scenario, this token comes from the API response
      expiresAt: Date.now() + 3600 * 1000, // Token expires in 1 hour
    };
  } else {
    console.error('Mock login failed: Invalid credentials provided to mock.');
    throw new Error('Invalid credentials');
  }

  /*
  // --- EXAMPLE ACTUAL API CALL (Commented out) ---
  try {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Handle non-2xx responses (e.g., 401 Unauthorized, 400 Bad Request)
      const errorData = await response.json().catch(() => ({ message: 'Login failed with status: ' + response.status }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: AuthToken = await response.json(); // Ensure AuthToken matches API response
    return data;
  } catch (error) {
    console.error('API Login Error:', error);
    throw error; // Re-throw to be caught by the AuthForm
  }
  */
};

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  await delay(800);
  // --- REPLACE THIS MOCK LOGIC WITH ACTUAL API CALL ---
  // You'll need to pass the token in an Authorization header (e.g., Bearer token)
  // And ensure the Doctor type matches the API response structure.
  console.log('getDoctors called with token (mock):', token);
  if (token !== 'live-api-token-from-server') { // Check against the mock token from login
      // In a real app, the API would return 401 if token is invalid
      console.warn('getDoctors: Unauthorized access attempt with mock token.');
      // throw new Error('Unauthorized'); // Keep this for real API
  }
  return mockDoctors.filter(doc => !doc.practiceName.toUpperCase().includes('TEST'));
  /*
  // --- EXAMPLE ACTUAL API CALL (Commented out) ---
  try {
    const response = await fetch(DOCTORS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data: Doctor[] = await response.json(); // Ensure Doctor[] matches API
    return data.filter(doc => !doc.practiceName.toUpperCase().includes('TEST')); // Apply existing filter
  } catch (error) {
    console.error('API getDoctors Error:', error);
    throw error;
  }
  */
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  await delay(1000);
  // --- REPLACE THIS MOCK LOGIC WITH ACTUAL API CALL ---
  // This will likely involve passing doctorAccNos as query parameters or in the request body
  // And ensure the ApiCase type matches the API response structure.
  console.log('getAllCasesForDoctors called for (mock):', doctorAccNos);
   if (token !== 'live-api-token-from-server') {
      console.warn('getAllCasesForDoctors: Unauthorized access attempt with mock token.');
      // throw new Error('Unauthorized');
  }
  const relevantApiCases = mockApiCases.filter(apiCase => doctorAccNos.includes(apiCase.doctor_acc_no));
  return relevantApiCases.map(processApiCase);
  /*
  // --- EXAMPLE ACTUAL API CALL (Commented out) ---
  // Example: Assuming API takes doctor IDs as a comma-separated query param
  // const doctorIdsQuery = doctorAccNos.join(',');
  // const url = `${CASES_ENDPOINT}?doctor_ids=${doctorIdsQuery}`; // Adjust endpoint as needed
  try {
    const response = await fetch(url, { // Replace 'url' with your actual endpoint construction
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const apiCases: ApiCase[] = await response.json(); // Ensure ApiCase[] matches API
    return apiCases.map(processApiCase);
  } catch (error) {
    console.error('API getAllCasesForDoctors Error:', error);
    throw error;
  }
  */
};


export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  await delay(400);
  // --- REPLACE THIS MOCK LOGIC WITH ACTUAL API CALL ---
  // This will involve a PUT or POST request to update the case.
  console.log(`updateCaseStatus called for caseId ${caseId} to ${newStatus} (mock)`);
   if (token !== 'live-api-token-from-server') {
      console.warn('updateCaseStatus: Unauthorized access attempt with mock token.');
      // throw new Error('Unauthorized');
       return { success: false };
  }
  const caseIndex = mockApiCases.findIndex(c => c.id === caseId);
  if (caseIndex > -1) {
    mockApiCases[caseIndex].case_status = newStatus; 
    const updatedProcessedCase = processApiCase(mockApiCases[caseIndex]);
    return { success: true, updatedCase: updatedProcessedCase };
  }
  return { success: false };
  /*
  // --- EXAMPLE ACTUAL API CALL (Commented out) ---
  // const url = UPDATE_CASE_ENDPOINT.replace('{caseId}', caseId.toString());
  try {
    const response = await fetch(url, { // Replace 'url'
      method: 'PUT', // Or 'POST', depending on your API
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }), // Adjust body as per API spec
    });
    if (!response.ok) {
       const errorData = await response.json().catch(() => ({ message: 'Update failed with status: ' + response.status }));
       throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const updatedApiCase: ApiCase = await response.json(); // Ensure ApiCase matches API
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error('API updateCaseStatus Error:', error);
    // throw error; // Or return { success: false } based on how you want to handle UI
    return { success: false };
  }
  */
};

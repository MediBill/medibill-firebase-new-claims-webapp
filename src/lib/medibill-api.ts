
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// API Endpoints configuration using environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL as string;
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;
const DOCTORS_ENDPOINT = `${API_BASE_URL}/doctors`;
const CASES_ENDPOINT = `${API_BASE_URL}/cases`;
const UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE = `${CASES_ENDPOINT}/{caseId}/status`;

// Hardcoded email for the login process
const APP_EMAIL = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL as string;
// Hardcoded password for the API authentication, as per requirement
const API_PASSWORD = process.env.MEDIBILL_API_PASSWORD as string;

const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW'; // Default for empty or unrecognized case_status
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || !apiCase.case_status) { // Treat empty as NEW
    status = 'NEW';
  }

  const validStartTimeString = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/)
    ? apiCase.start_time
    : '00:00';

  const fullStartTime = validStartTimeString.length === 5 ? `${validStartTimeString}:00` : validStartTimeString;
  const submittedDateTime = `${apiCase.service_date}T${fullStartTime}Z`;

  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status || '',
  };
};

// Authenticates the user with the API using hardcoded credentials (as per current requirement)
export const login = async (passwordFromForm: string): Promise<AuthToken> => {
  try {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Use the hardcoded API_PASSWORD for the API call, email is also hardcoded
      body: JSON.stringify({ email: APP_EMAIL, password: API_PASSWORD }),
    });

    if (!response.ok) {
      const errorText = await response.text(); // Read body as text once
      let errorMessage = `Login failed with status: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.detail || errorData.error || errorText || errorMessage;
      } catch (e) { // JSON parsing failed, use raw text
        errorMessage += ` - ${errorText}`;
      }
      throw new Error(errorMessage);
    }
    const responseData = await response.json();

    // Specifically handle the expected success response structure
    if (responseData.status === 'success' && responseData.token) {
      const tokenData: AuthToken = {
        token: responseData.token,
        // API does not provide expiration, so set a default (e.g., 1 hour)
        expiresAt: Date.now() + 3600 * 1000,
      };
      return tokenData;
    } else {
      // Handle other successful (HTTP 200) but unexpected JSON structures
      console.error("Unexpected successful login response structure:", responseData);
      const message = responseData.message || "Login successful, but token data is missing or in an unexpected format.";
      throw new Error(message);
    }

  } catch (error) {
    let detailedErrorMessage = 'An unknown error occurred during login.';
    // Check if it's a network error (e.g., failed to fetch)
    if (error instanceof Error) {
      detailedErrorMessage = error.message;
    }
    console.error('API Login Error:', detailedErrorMessage, error);
    // Re-throw a new Error with a clearer message if it was a network issue, otherwise re-throw the original error message.
    throw new Error(detailedErrorMessage);
  }
};

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  try {
    const response = await fetch(DOCTORS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text(); // Read body as text once
      let errorMessage = `Failed to fetch doctors: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.detail || errorText || errorMessage;
      } catch (e) { errorMessage += ` - ${errorText}`; } // JSON parsing failed, use raw text
      throw new Error(errorMessage || `Failed to fetch doctors with status: ${response.status}`);
    }
    const data: Doctor[] = await response.json();
    return data.filter(doc => doc.practiceName && !doc.practiceName.toUpperCase().includes('TEST'));
  } catch (error) {
    console.error('API getDoctors Error:', error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching doctors.');
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  try {
    const response = await fetch(CASES_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text(); // Read body as text once
      let errorMessage = `Failed to fetch cases: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.detail || errorText || errorMessage;
      } catch (e) { errorMessage += ` - ${errorText}`; } // JSON parsing failed, use raw text
      throw new Error(errorMessage || `Failed to fetch cases with status: ${response.status}`);
    }
    const apiCases: ApiCase[] = await response.json();
    const relevantApiCases = apiCases.filter(apiCase =>
        apiCase.doctor_acc_no &&
        doctorAccNos.length > 0 &&
        doctorAccNos.includes(apiCase.doctor_acc_no)
    );
    return relevantApiCases.map(processApiCase);
  } catch (error) {
    console.error('API getAllCasesForDoctors Error:', error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching cases.');
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  const url = UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE.replace('{caseId}', caseId.toString());
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }),
    });
    if (!response.ok) {
       const errorText = await response.text(); // Read body as text once
       let errorMessage = `Failed to update case status for case ID ${caseId} to ${newStatus}: ${response.status}`;
       try {
         const errorData = JSON.parse(errorText);
         errorMessage = errorData.message || errorData.detail || errorText || errorMessage;
       } catch (e) { errorMessage += ` - ${errorText}`; } // JSON parsing failed, use raw text
       throw new Error(errorMessage || `Failed to update case status for case ID ${caseId} with status: ${response.status}`);
    }
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error('API updateCaseStatus Error:', error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case status for case ID ${caseId}.`;
    throw new Error(message);
  }
};

export const updateCase = async (token: string, caseId: number, updatedCaseData: Partial<ApiCase>): Promise<Case> => {
  const url = `${API_BASE_URL}/cases/submissions/update/${caseId}`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedCaseData),
    });
    if (!response.ok) {
      const errorText = await response.text(); // Read body as text once
      let errorMessage = `Failed to update case ${caseId}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.detail || errorText || errorMessage;
      } catch (e) { errorMessage += ` - ${errorText}`; } // JSON parsing failed, use raw text
      throw new Error(errorMessage || `Failed to update case ${caseId} with status: ${response.status}`);
    }
    const updatedApiCase: ApiCase = await response.json();
    return processApiCase(updatedApiCase);
  } catch (error) {
    console.error(`API updateCase Error for case ID ${caseId}:`, error);
    throw error instanceof Error ? error : new Error(`An unknown error occurred while updating case ${caseId}.`);
  }
};

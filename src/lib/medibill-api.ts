
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

const API_BASE_URL = 'https://api.medibill.co.za/api';
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;
const DOCTORS_ENDPOINT = `${API_BASE_URL}/doctors`;
const CASES_ENDPOINT = `${API_BASE_URL}/cases`;
const UPDATE_CASE_ENDPOINT_TEMPLATE = `${API_BASE_URL}/cases/{caseId}/status`;

// Hardcoded email for the login process
const APP_EMAIL = 'medibill.developer@gmail.com';
// Hardcoded password for the API authentication, as per requirement
const API_PASSWORD = 'apt@123!';

const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW'; // Default for empty or unrecognized case_status
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || !apiCase.case_status) { // Treat empty as NEW
    status = 'NEW';
  }

  const validStartTimeString = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/) ? apiCase.start_time : '00:00';
  const fullStartTime = validStartTimeString.length === 5 ? `${validStartTimeString}:00` : validStartTimeString;
  
  const submittedDateTime = `${apiCase.service_date}T${fullStartTime}Z`;

  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status || '', // Ensure original_case_status is a string
  };
};

// The 'password' parameter from AuthForm is received but API_PASSWORD is used for the actual API call.
export const login = async (passwordFromForm: string): Promise<AuthToken> => {
  try {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Use the hardcoded API_PASSWORD for the API call
      body: JSON.stringify({ email: APP_EMAIL, password: API_PASSWORD }),
    });

    if (!response.ok) {
      let errorMessage = `Login failed with status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorData.error || errorMessage;
      } catch (e) {
        // Failed to parse JSON body or no specific message
      }
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    let tokenData: AuthToken;

    if (responseData.access_token && responseData.expires_in) {
        tokenData = {
            token: responseData.access_token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    } else if (responseData.token && responseData.expiresAt) {
        tokenData = {
            token: responseData.token,
            expiresAt: responseData.expiresAt,
        };
    } else if (responseData.token && responseData.expires_in) {
         tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    } else if (responseData.token) {
        tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + 3600 * 1000, // Default to 1 hour if not specified
        };
    } else {
        console.error("Unexpected login response structure:", responseData);
        throw new Error("Login successful, but token data is missing or in an unexpected format.");
    }
    return tokenData;

  } catch (error) {
    console.error('API Login Error:', error);
    // Re-throw to be caught by the calling component, which will then show it in the UI or toast
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred during login.');
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
      let errorMessage = `Failed to fetch doctors: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
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
      let errorMessage = `Failed to fetch cases: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
    }
    const apiCases: ApiCase[] = await response.json();
    const relevantApiCases = apiCases.filter(apiCase => apiCase.doctor_acc_no && doctorAccNos.includes(apiCase.doctor_acc_no));
    return relevantApiCases.map(processApiCase);
  } catch (error) {
    console.error('API getAllCasesForDoctors Error:', error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching cases.');
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  const url = UPDATE_CASE_ENDPOINT_TEMPLATE.replace('{caseId}', caseId.toString());
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
       let errorMessage = `Failed to update case status: ${response.status}`;
       try {
         const errorData = await response.json();
         errorMessage = errorData.message || errorData.detail || errorMessage;
       } catch (e) { /* ignore */ }
       throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error('API updateCaseStatus Error:', error);
    // Return the error message to be displayed in a toast
    const message = error instanceof Error ? error.message : 'An unknown error occurred while updating case status.';
    return { success: false, updatedCase: undefined };
  }
};


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

  // Ensure start_time is a valid "HH:MM" string before appending seconds
  const validStartTimeString = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/) 
    ? apiCase.start_time 
    : '00:00'; // Default to "00:00" if invalid or null/undefined
  
  // Append ":00" for seconds if start_time is just "HH:MM"
  const fullStartTime = validStartTimeString.length === 5 ? `${validStartTimeString}:00` : validStartTimeString;

  // Construct submittedDateTime. API returns service_date as "YYYY-MM-DD"
  // and start_time as "HH:MM" (or potentially "HH:MM:SS").
  // We need "YYYY-MM-DDTHH:MM:SSZ" for ISO string.
  const submittedDateTime = `${apiCase.service_date}T${fullStartTime}Z`; // Assuming UTC

  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status || '', // Ensure original_case_status is a string
  };
};

// The 'passwordFromForm' parameter is received but API_PASSWORD is used for the actual API call.
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
      let errorMessage = `Login failed with status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorData.error || errorMessage;
      } catch (e) {
        // Failed to parse JSON body or no specific message
        errorMessage += ` - ${await response.text()}`; // Include raw text if JSON parsing fails
      }
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    let tokenData: AuthToken;

    // Handle various possible token response structures
    if (responseData.access_token && responseData.expires_in !== undefined) {
        tokenData = {
            token: responseData.access_token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    } else if (responseData.token && responseData.expiresAt) { // expiresAt is already a timestamp
        tokenData = {
            token: responseData.token,
            expiresAt: responseData.expiresAt,
        };
    } else if (responseData.token && responseData.expires_in !== undefined) { // expires_in is seconds
         tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    } else if (responseData.token) { // Only token provided, default expiry
        tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + 3600 * 1000, // Default to 1 hour
        };
    } else {
        console.error("Unexpected login response structure:", responseData);
        throw new Error("Login successful, but token data is missing or in an unexpected format.");
    }
    return tokenData;

  } catch (error) {
    let detailedErrorMessage = 'An unknown error occurred during login.';
    if (error instanceof Error) {
      detailedErrorMessage = error.message; // Original error message, e.g., "Failed to fetch"
      if (error.message.toLowerCase().includes('failed to fetch')) {
        detailedErrorMessage = `Failed to fetch from ${LOGIN_ENDPOINT}. This can be due to network issues, an incorrect API endpoint, or CORS policy restrictions on the server. Please check your network connection, the API endpoint, and ensure the server at ${API_BASE_URL} allows requests from your current domain.`;
      }
    }
    console.error('API Login Error:', detailedErrorMessage, error);
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
      let errorMessage = `Failed to fetch doctors: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch (e) { errorMessage += ` - ${await response.text()}`; }
      throw new Error(errorMessage);
    }
    const data: Doctor[] = await response.json();
    // Filter out doctors with 'TEST' in their practiceName, case-insensitively
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
      } catch (e) { errorMessage += ` - ${await response.text()}`; }
      throw new Error(errorMessage);
    }
    const apiCases: ApiCase[] = await response.json();
    // Ensure doctorAccNos is not empty before filtering, and that apiCase.doctor_acc_no exists
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
  const url = UPDATE_CASE_ENDPOINT_TEMPLATE.replace('{caseId}', caseId.toString());
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }), // API expects 'case_status'
    });
    if (!response.ok) {
       let errorMessage = `Failed to update case status for case ID ${caseId} to ${newStatus}: ${response.status}`;
       try {
         const errorData = await response.json();
         errorMessage = errorData.message || errorData.detail || errorMessage;
       } catch (e) { errorMessage += ` - ${await response.text()}`; }
       throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error('API updateCaseStatus Error:', error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case status for case ID ${caseId}.`;
    // To ensure the toast displays the error, we return a structure that implies failure but can still be handled.
    // The calling component (DoctorCaseTable) expects a promise that resolves.
    // It will check result.success.
    // We throw here so the toast in DoctorCaseTable shows this specific error message.
    throw new Error(message); 
  }
};

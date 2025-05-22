
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

const API_BASE_URL = 'https://api.medibill.co.za/api';
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;
const DOCTORS_ENDPOINT = `${API_BASE_URL}/doctors`;
const CASES_ENDPOINT = `${API_BASE_URL}/cases`; // Endpoint to get all cases for the authenticated user
const UPDATE_CASE_ENDPOINT_TEMPLATE = `${API_BASE_URL}/cases/{caseId}/status`;

// Hardcoded email for the login process
const APP_EMAIL = 'medibill.developer@gmail.com';

const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW'; // Default for empty or unrecognized case_status
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW') {
    status = 'NEW';
  }

  // Ensure start_time is valid HH:MM, default to 00:00 if not
  const validStartTimeString = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/) ? apiCase.start_time : '00:00';
  // Append seconds if missing for ISO compatibility
  const fullStartTime = validStartTimeString.length === 5 ? `${validStartTimeString}:00` : validStartTimeString;
  
  const submittedDateTime = `${apiCase.service_date}T${fullStartTime}Z`;


  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status,
  };
};

export const login = async (password: string): Promise<AuthToken> => {
  try {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: APP_EMAIL, password }),
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

    // Assuming the API returns a structure compatible with AuthToken
    // e.g., { token: "some_token", expires_in: 3600 } or { token: "some_token", expires_at: timestamp }
    const responseData = await response.json();

    // Adapt this based on your API's actual response structure for token and expiration
    let tokenData: AuthToken;
    if (responseData.access_token && responseData.expires_in) { // Example: OAuth like response
        tokenData = {
            token: responseData.access_token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    } else if (responseData.token && responseData.expiresAt) { // Direct match
        tokenData = {
            token: responseData.token,
            expiresAt: responseData.expiresAt,
        };
    } else if (responseData.token && responseData.expires_in) { // Common variation
         tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + responseData.expires_in * 1000,
        };
    }
     else if (responseData.token) { // If only token is returned, handle expiration as needed
        tokenData = {
            token: responseData.token,
            expiresAt: Date.now() + 3600 * 1000, // Default to 1 hour if not specified
        };
    }
    else {
        // If the structure is unknown or token is missing
        console.error("Unexpected login response structure:", responseData);
        throw new Error("Login successful, but token data is missing or in an unexpected format.");
    }
    return tokenData;

  } catch (error) {
    console.error('API Login Error:', error);
    throw error; // Re-throw to be caught by the calling component
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
    return data.filter(doc => !doc.practiceName?.toUpperCase().includes('TEST'));
  } catch (error) {
    console.error('API getDoctors Error:', error);
    throw error;
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  try {
    const response = await fetch(CASES_ENDPOINT, { // Fetches all cases for the authenticated user
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
    // Filter client-side if the API returns all cases for the user
    const relevantApiCases = apiCases.filter(apiCase => doctorAccNos.includes(apiCase.doctor_acc_no));
    return relevantApiCases.map(processApiCase);
  } catch (error) {
    console.error('API getAllCasesForDoctors Error:', error);
    throw error;
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  const url = UPDATE_CASE_ENDPOINT_TEMPLATE.replace('{caseId}', caseId.toString());
  try {
    const response = await fetch(url, {
      method: 'PUT', // Or 'PATCH' or 'POST', depending on your API
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }), // API might expect 'status' or other field name
    });
    if (!response.ok) {
       let errorMessage = `Failed to update case status: ${response.status}`;
       try {
         const errorData = await response.json();
         errorMessage = errorData.message || errorData.detail || errorMessage;
       } catch (e) { /* ignore */ }
       throw new Error(errorMessage);
    }
    // Assuming API returns the updated case upon successful update
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error('API updateCaseStatus Error:', error);
    return { success: false }; // Indicate failure
  }
};


import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// API Endpoints configuration using environment variables
const API_BASE_URL_FROM_ENV = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
const APP_EMAIL = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL;
// MEDIBILL_API_PASSWORD is a build-time env var.
// It's captured here in the module scope. If this module is bundled for the client,
// its value will be what was available at build time.
const API_PASSWORD = process.env.NEXT_PUBLIC_MEDIBILL_API_PASSWORD;

// Initial check for critical configuration
if (!API_BASE_URL_FROM_ENV || typeof API_BASE_URL_FROM_ENV !== 'string' || !API_BASE_URL_FROM_ENV.startsWith('http')) {
  const errorMsg = `CRITICAL CONFIGURATION ERROR in medibill-api.ts: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${API_BASE_URL_FROM_ENV}'. Please ensure this environment variable is set correctly for your runtime environment.`;
  console.error(errorMsg);
  // Intentionally not throwing here to allow the app to load and show component-level errors if possible,
  // but API calls will fail.
}
if (!APP_EMAIL) {
  console.error("CRITICAL CONFIGURATION ERROR: NEXT_PUBLIC_MEDIBILL_APP_EMAIL is not set.");
}
if (!API_PASSWORD) {
  console.error("CRITICAL CONFIGURATION ERROR: MEDIBILL_API_PASSWORD is not set (this is a build-time variable). Login will likely fail if it's not available to the API call logic.");
}

const API_BASE_URL = API_BASE_URL_FROM_ENV as string; // Use the validated (or potentially problematic) base URL

const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;
const DOCTORS_ENDPOINT = `${API_BASE_URL}/doctors`;
const CASES_ENDPOINT = `${API_BASE_URL}/cases`;
const UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE = `${CASES_ENDPOINT}/{caseId}/status`;


const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW';
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || !apiCase.case_status) {
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

export const login = async (passwordFromForm: string): Promise<AuthToken> => {
  // Explicit check before attempting the fetch
  if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) {
    const errorMsg = `API Call Pre-check Error: API_BASE_URL is not a valid absolute URL: "${API_BASE_URL}". Cannot make API calls. Check NEXT_PUBLIC_MEDIBILL_API_BASE_URL.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
   if (!APP_EMAIL) {
    const errorMsg = "API Call Pre-check Error: APP_EMAIL is not configured. Check NEXT_PUBLIC_MEDIBILL_APP_EMAIL.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  if (!API_PASSWORD) {
     const errorMsg = "API Call Pre-check Error: API_PASSWORD is not configured (build-time variable). Login will fail.";
    console.error(errorMsg);
     // Do NOT log API_PASSWORD
     console.log(`[MediBill API] Login Request Body (excluding password): ${JSON.stringify({ email: APP_EMAIL})}`);
    throw new Error(errorMsg);
  }

  console.log(`[MediBill API] Attempting login to: ${LOGIN_ENDPOINT}`);
  console.log(`[MediBill API] Using email: ${APP_EMAIL}`);
  // Do NOT log API_PASSWORD

  try {
    const response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      mode: 'cors', // Explicitly set mode
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: APP_EMAIL, password: API_PASSWORD }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errMsg = `Request to ${LOGIN_ENDPOINT} failed with status ${response.status}.`;
      try {
        // Try to parse a JSON error from the API first
        const errorData = JSON.parse(errorText);
        errMsg += ` Server message: ${errorData.message || errorData.detail || errorData.error || JSON.stringify(errorData)}`;
      } catch (e) {
        // If response is not JSON (e.g., HTML 404 page from Next.js)
        const preview = errorText.length > 300 ? errorText.substring(0, 300) + "..." : errorText;
        errMsg += ` Response body (preview): ${preview}`;
        if (errorText.includes("<title>404: This page could not be found.</title>")) {
            errMsg += " This looks like a Next.js 404 page, meaning the request might have gone to the local server instead of the external API. Check if NEXT_PUBLIC_MEDIBILL_API_BASE_URL is correctly set to an absolute URL and accessible in your runtime environment.";
        }
      }
      throw new Error(errMsg);
    }

    const responseData = await response.json();

    if (responseData.status === 'success' && responseData.token) {
      const tokenData: AuthToken = {
        token: responseData.token,
        expiresAt: Date.now() + 3600 * 1000, // Default 1 hour expiry if not provided
      };
      return tokenData;
    } else {
      const message = responseData.message || `Login successful (HTTP ${response.status}), but token data is missing or in an unexpected format. Response: ${JSON.stringify(responseData).substring(0,200)}...`;
      console.error("Unexpected successful login response structure:", responseData);
      throw new Error(message);
    }

  } catch (error) {
    let detailedErrorMessage = `API Login Error for ${LOGIN_ENDPOINT}.`;
    if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
      detailedErrorMessage = `API Login Error: "Failed to fetch from ${LOGIN_ENDPOINT}. This can be due to network issues (e.g., no internet, DNS problem), an incorrect API endpoint, or CORS policy restrictions on the server. Please check your network connection, the API endpoint URL, and ensure the server at ${API_BASE_URL} allows requests from your current domain." Original error: ${error.toString()}`;
    } else if (error instanceof Error) {
      detailedErrorMessage = error.message; // Use the message from specific errors thrown above
    }
    console.error('API Login Error:', detailedErrorMessage, error);
    throw new Error(detailedErrorMessage);
  }
};

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) { throw new Error("API_BASE_URL not configured for getDoctors"); }
  console.log(`[MediBill API] Fetching doctors from: ${DOCTORS_ENDPOINT}`);
  try {
    const response = await fetch(DOCTORS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch doctors from ${DOCTORS_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      throw new Error(errorMessage);
    }
    const data: Doctor[] = await response.json();
    return data.filter(doc => doc.practiceName && !doc.practiceName.toUpperCase().includes('TEST'));
  } catch (error) {
    console.error(`API getDoctors Error from ${DOCTORS_ENDPOINT}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching doctors.');
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) { throw new Error("API_BASE_URL not configured for getAllCasesForDoctors"); }
  console.log(`[MediBill API] Fetching cases from: ${CASES_ENDPOINT}`);
  try {
    const response = await fetch(CASES_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch cases from ${CASES_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      throw new Error(errorMessage);
    }
    const apiCases: ApiCase[] = await response.json();
    const relevantApiCases = apiCases.filter(apiCase =>
        apiCase.doctor_acc_no &&
        doctorAccNos.length > 0 && // Only filter if doctorAccNos is provided and not empty
        doctorAccNos.includes(apiCase.doctor_acc_no)
    );
    return relevantApiCases.map(processApiCase);
  } catch (error) {
    console.error(`API getAllCasesForDoctors Error from ${CASES_ENDPOINT}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching cases.');
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) { throw new Error("API_BASE_URL not configured for updateCaseStatus"); }
  const url = UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE.replace('{caseId}', caseId.toString());
  console.log(`[MediBill API] Updating case status for ID ${caseId} to ${newStatus} at: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }), // API expects "case_status"
    });
    if (!response.ok) {
       const errorText = await response.text();
       let errorMessage = `Failed to update case status for case ID ${caseId} to ${newStatus} at ${url}: ${response.status}`;
       try {
         const errorData = JSON.parse(errorText);
         errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
       } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
       throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json(); // Expecting the updated case object back
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error(`API updateCaseStatus Error for ${url}:`, error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case status for case ID ${caseId}.`;
    throw new Error(message);
  }
};

// Placeholder for potential future use if general case updates are needed
export const updateCase = async (token: string, caseId: number, updatedCaseData: Partial<ApiCase>): Promise<Case> => {
  if (!API_BASE_URL || !API_BASE_URL.startsWith('http')) { throw new Error("API_BASE_URL not configured for updateCase"); }
  const url = `${API_BASE_URL}/cases/submissions/update/${caseId}`; // Assuming this endpoint exists
  console.log(`[MediBill API] Updating case ID ${caseId} at: ${url}`);
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
      const errorText = await response.text();
      let errorMessage = `Failed to update case ${caseId} at ${url}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return processApiCase(updatedApiCase);
  } catch (error) {
    console.error(`API updateCase Error for ${url}:`, error);
    throw error instanceof Error ? error : new Error(`An unknown error occurred while updating case ${caseId}.`);
  }
};

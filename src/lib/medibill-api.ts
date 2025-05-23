
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// Internal Next.js API route for login (this is now the primary way to login)
const INTERNAL_LOGIN_ENDPOINT = '/api/auth/login';

// Environment variables - will be checked within functions that use them directly.
// const APP_EMAIL = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL; // Used in the /api/auth/login route
// const API_PASSWORD = process.env.NEXT_PUBLIC_MEDIBILL_API_PASSWORD; // Used in the /api/auth/login route


const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW';
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || !apiCase.case_status) {
    status = 'NEW';
  }

  // Ensure service_date is valid and start_time is in HH:MM format
  const validServiceDate = apiCase.service_date && apiCase.service_date.match(/^\d{4}-\d{2}-\d{2}$/) ? apiCase.service_date : '1970-01-01';
  const validStartTimeString = apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}$/)
    ? apiCase.start_time
    : '00:00';
  const fullStartTime = validStartTimeString.length === 5 ? `${validStartTimeString}:00` : validStartTimeString; // Ensure seconds part

  const submittedDateTime = `${validServiceDate}T${fullStartTime}Z`;


  return {
    ...apiCase,
    status,
    submittedDateTime,
    original_case_status: apiCase.case_status || '',
  };
};

export const login = async (passwordFromForm: string): Promise<AuthToken> => {
  console.log(`[MediBill API Client] Calling internal login proxy: ${INTERNAL_LOGIN_ENDPOINT}`);
  try {
    const response = await fetch(INTERNAL_LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: passwordFromForm }), // Server-side route uses configured credentials
    });

    const responseData = await response.json();

    if (!response.ok) {
      let errMsg = `Internal API login request to ${INTERNAL_LOGIN_ENDPOINT} failed with status ${response.status}.`;
      errMsg += ` Server message: ${responseData.message || responseData.detail || JSON.stringify(responseData)}`;
      console.error(errMsg, responseData);
      if (response.status === 404 && typeof responseData === 'string' && responseData.includes("This page could not be found")) {
        errMsg += " This might indicate the internal API route itself is not found.";
      }
      throw new Error(errMsg);
    }

    if (responseData.token && responseData.expiresAt) {
       console.log('[MediBill API Client] Login via internal proxy successful.');
      return responseData as AuthToken;
    } else {
      const message = `Login successful (HTTP ${response.status}), but token data from internal proxy is missing or in an unexpected format. Response: ${JSON.stringify(responseData).substring(0,200)}...`;
      console.error("Unexpected successful login response structure from internal proxy:", responseData);
      throw new Error(message);
    }

  } catch (error) {
    let detailedErrorMessage = `Client-side error during login via internal proxy ${INTERNAL_LOGIN_ENDPOINT}.`;
     if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
      detailedErrorMessage = `Client-side API Login Error: "Failed to fetch from internal endpoint ${INTERNAL_LOGIN_ENDPOINT}. This usually means the Next.js server itself is not reachable, the API route is misconfigured, or there's a network issue." Original error: ${error.toString()}`;
    } else if (error instanceof Error) {
      detailedErrorMessage = error.message;
    }
    console.error('Client-side API Login Error:', detailedErrorMessage, error);
    throw new Error(detailedErrorMessage);
  }
};


// --- NOTE: The following functions (getDoctors, getAllCasesForDoctors, updateCaseStatus) ---
// --- still make DIRECT calls to the EXTERNAL API. They will be subject to CORS if the ---
// --- external API server (api.medibill.co.za) is not configured to allow requests ---
// --- from this application's origin for these specific endpoints and methods. ---
// --- If CORS issues persist for these, they would also need to be proxied. ---

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `Configuration error for getDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const DOCTORS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/doctors`;
  console.log(`[MediBill API Client] Fetching doctors directly from: ${DOCTORS_ENDPOINT_EXTERNAL}`);

  try {
    const response = await fetch(DOCTORS_ENDPOINT_EXTERNAL, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch doctors from ${DOCTORS_ENDPOINT_EXTERNAL}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      throw new Error(errorMessage);
    }
    const data: Doctor[] = await response.json();
    return data.filter(doc => doc.practiceName && !doc.practiceName.toUpperCase().includes('TEST'));
  } catch (error) {
    console.error(`API getDoctors Error from ${DOCTORS_ENDPOINT_EXTERNAL}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching doctors.');
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `Configuration error for getAllCasesForDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const CASES_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases`;
  console.log(`[MediBill API Client] Fetching cases directly from: ${CASES_ENDPOINT_EXTERNAL}`);

  try {
    const response = await fetch(CASES_ENDPOINT_EXTERNAL, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch cases from ${CASES_ENDPOINT_EXTERNAL}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      throw new Error(errorMessage);
    }
    const apiCases: ApiCase[] = await response.json();
    const relevantApiCases = apiCases.filter(apiCase =>
        apiCase.doctor_acc_no &&
        doctorAccNos.length > 0 &&
        doctorAccNos.includes(apiCase.doctor_acc_no)
    );
    return relevantApiCases.map(processApiCase);
  } catch (error) {
    console.error(`API getAllCasesForDoctors Error from ${CASES_ENDPOINT_EXTERNAL}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching cases.');
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `Configuration error for updateCaseStatus: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/{caseId}/status`;
  const url = UPDATE_CASE_STATUS_ENDPOINT_TEMPLATE_EXTERNAL.replace('{caseId}', caseId.toString());
  console.log(`[MediBill API Client] Updating case status directly for ID ${caseId} to ${newStatus} at: ${url}`);

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
       const errorText = await response.text();
       let errorMessage = `Failed to update case status for case ID ${caseId} to ${newStatus} at ${url}: ${response.status}`;
       try {
         const errorData = JSON.parse(errorText);
         errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
       } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
       throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error(`API updateCaseStatus Error for ${url}:`, error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case status for case ID ${caseId}.`;
    throw new Error(message);
  }
};


export const updateCase = async (token: string, caseId: number, updatedCaseData: Partial<ApiCase>): Promise<Case> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `Configuration error for updateCase: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Assuming an endpoint like this for general updates. This would also be a direct external call.
  const url = `${EXTERNAL_API_BASE_URL}/cases/submissions/update/${caseId}`;
  console.log(`[MediBill API Client] Updating case ID ${caseId} directly at: ${url}`);

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

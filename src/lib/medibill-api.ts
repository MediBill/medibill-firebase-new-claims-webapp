
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// Internal Next.js API route for login
const INTERNAL_LOGIN_ENDPOINT = '/api/auth/login';

// Internal Next.js API routes for other operations
const INTERNAL_DOCTORS_ENDPOINT = '/api/doctors';
const INTERNAL_CASES_ENDPOINT = '/api/cases'; // Will be a POST to send doctorAccNos
const INTERNAL_CASE_STATUS_UPDATE_ENDPOINT_TEMPLATE = '/api/cases/[caseId]/status';
const INTERNAL_CASE_GENERAL_UPDATE_ENDPOINT_TEMPLATE = '/api/cases/[caseId]/update';


// Hardcoded credentials for the API call made by the server-side proxy
const APP_EMAIL_FOR_PROXY = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL; // Used by /api/auth/login route
const API_PASSWORD_FOR_PROXY = process.env.NEXT_PUBLIC_MEDIBILL_API_PASSWORD; // Used by /api/auth/login route

const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW';
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || apiCase.case_status === '' || !apiCase.case_status) {
    status = 'NEW';
  }

  const validServiceDate = apiCase.service_date && apiCase.service_date.match(/^\d{4}-\d{2}-\d{2}$/) ? apiCase.service_date : '1970-01-01';
  
  let validStartTimeString = '00:00:00';
  if (apiCase.start_time && apiCase.start_time.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
    validStartTimeString = apiCase.start_time.length === 5 ? `${apiCase.start_time}:00` : apiCase.start_time;
  }
  
  const submittedDateTime = `${validServiceDate}T${validStartTimeString}Z`;

  return {
    ...apiCase,
    id: Number(apiCase.id),
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
      body: JSON.stringify({ password: passwordFromForm }),
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

    if (responseData.status === 'success' && responseData.token) {
      console.log('[MediBill API Client] Login via internal proxy successful.');
      return {
        token: responseData.token,
        expiresAt: responseData.expires_in ? Date.now() + responseData.expires_in * 1000 : Date.now() + 3600 * 1000, // Default 1 hour expiry if not provided
      };
    } else {
      const message = `Login successful (HTTP ${response.status}), but token data from internal proxy is missing or in an unexpected format. Response: ${JSON.stringify(responseData).substring(0,500)}...`;
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

export const getDoctors = async (token: string): Promise<Doctor[]> => {
  console.log(`[MediBill API Client] Fetching doctors via internal proxy: ${INTERNAL_DOCTORS_ENDPOINT} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`);
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for getDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const response = await fetch(INTERNAL_DOCTORS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch doctors via proxy ${INTERNAL_DOCTORS_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    console.log(`[MediBill API Client] Raw response from ${INTERNAL_DOCTORS_ENDPOINT}:`, JSON.stringify(responseData, null, 2).substring(0, 500) + '...');


    if (Array.isArray(responseData)) {
      const doctors: Doctor[] = responseData;
      const filteredDoctors = doctors.filter(doc => doc.practiceName && !doc.practiceName.toUpperCase().includes('TEST'));
      console.log(`[MediBill API Client] Doctors received: ${doctors.length}, Doctors after 'TEST' filter: ${filteredDoctors.length}`);
      return filteredDoctors;
    } else {
      console.warn(`[MediBill API Client] getDoctors (via proxy) received non-array data from ${INTERNAL_DOCTORS_ENDPOINT}:`, responseData);
      return [];
    }

  } catch (error) {
    console.error(`API getDoctors (via proxy) Error from ${INTERNAL_DOCTORS_ENDPOINT}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching doctors via proxy.');
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  console.log(`[MediBill API Client] Fetching cases via internal proxy: ${INTERNAL_CASES_ENDPOINT} for doctors: ${JSON.stringify(doctorAccNos)} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`);
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
     const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for getAllCasesForDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const response = await fetch(INTERNAL_CASES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doctorAccNos }), // doctorAccNos here should be the practice_no or equivalent ID
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch cases via proxy ${INTERNAL_CASES_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    console.log(`[MediBill API Client] Raw response from ${INTERNAL_CASES_ENDPOINT}:`, JSON.stringify(responseData, null, 2).substring(0, 500) + '...');
    
    if (Array.isArray(responseData)) {
        const apiCases: ApiCase[] = responseData;
        const processedCases = apiCases.map(processApiCase);
        console.log(`[MediBill API Client] Cases received: ${apiCases.length}, Processed cases: ${processedCases.length}`);
        return processedCases;
    } else {
        console.warn(`[MediBill API Client] getAllCasesForDoctors (via proxy) received non-array data from ${INTERNAL_CASES_ENDPOINT}:`, responseData);
        return [];
    }

  } catch (error) {
    console.error(`API getAllCasesForDoctors (via proxy) Error from ${INTERNAL_CASES_ENDPOINT}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching cases via proxy.');
  }
};

export const updateCaseStatus = async (token: string, caseId: number, newStatus: CaseStatus): Promise<{ success: boolean; updatedCase?: Case }> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
   if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
     const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for updateCaseStatus: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const url = INTERNAL_CASE_STATUS_UPDATE_ENDPOINT_TEMPLATE.replace('[caseId]', caseId.toString());
  console.log(`[MediBill API Client] Updating case status via internal proxy for ID ${caseId} to ${newStatus} at: ${url}`);

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
       let errorMessage = `Failed to update case status via proxy for case ID ${caseId} to ${newStatus} at ${url}: ${response.status}`;
       try {
         const errorData = JSON.parse(errorText);
         errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
       } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
       console.error(errorMessage);
       throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error(`API updateCaseStatus (via proxy) Error for ${url}:`, error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case status via proxy for case ID ${caseId}.`;
    throw new Error(message);
  }
};

export const updateCase = async (token: string, caseId: number, updatedCaseData: Partial<ApiCase>): Promise<Case> => {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
     const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for updateCase: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const url = INTERNAL_CASE_GENERAL_UPDATE_ENDPOINT_TEMPLATE.replace('[caseId]', caseId.toString());
  console.log(`[MediBill API Client] Updating case ID ${caseId} via internal proxy at: ${url}`);

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
      let errorMessage = `Failed to update case ${caseId} via proxy at ${url}: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || errorText}`;
      } catch (e) { errorMessage += ` - Body: ${errorText.substring(0,200)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    const updatedApiCase: ApiCase = await response.json();
    return processApiCase(updatedApiCase);
  } catch (error) {
    console.error(`API updateCase (via proxy) Error for ${url}:`, error);
    throw error instanceof Error ? error : new Error(`An unknown error occurred while updating case ${caseId} via proxy.`);
  }
};

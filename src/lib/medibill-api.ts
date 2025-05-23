
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// Internal Next.js API route for login
const INTERNAL_LOGIN_ENDPOINT = '/api/auth/login';

// Internal Next.js API routes for other operations
const INTERNAL_DOCTORS_ENDPOINT = '/api/doctors';
const INTERNAL_CASES_ENDPOINT = '/api/cases';
const INTERNAL_CASE_STATUS_UPDATE_ENDPOINT_TEMPLATE = '/api/cases/[caseId]/status';
const INTERNAL_CASE_GENERAL_UPDATE_ENDPOINT_TEMPLATE = '/api/cases/[caseId]/update';


const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW';
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW') {
    status = 'NEW';
  }

  const validServiceDate = apiCase.service_date && apiCase.service_date.match(/^\d{4}-\d{2}-\d{2}$/)
    ? apiCase.service_date
    : '1970-01-01';

  let validStartTimeString = '00:00:00';
  if (apiCase.start_time && typeof apiCase.start_time === 'string') {
    if (apiCase.start_time.match(/^\d{2}:\d{2}:\d{2}$/)) {
      validStartTimeString = apiCase.start_time;
    } else if (apiCase.start_time.match(/^\d{2}:\d{2}$/)) {
      validStartTimeString = `${apiCase.start_time}:00`;
    }
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

    // The internal proxy /api/auth/login directly returns an AuthToken object { token: string, expiresAt: number }
    if (responseData && typeof responseData.token === 'string' && typeof responseData.expiresAt === 'number') {
      console.log('[MediBill API Client] Login via internal proxy successful. Token and expiresAt received.');
      return {
        token: responseData.token,
        expiresAt: responseData.expiresAt,
      };
    } else {
      const message = `Login successful (HTTP ${response.status}), but token data from internal proxy is missing or in an unexpected format. Expected { token: string, expiresAt: number }. Response: ${JSON.stringify(responseData).substring(0,500)}...`;
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
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for getDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[MediBill API Client] Fetching doctors via internal proxy: ${INTERNAL_DOCTORS_ENDPOINT} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`);
  try {
    const response = await fetch(INTERNAL_DOCTORS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const responseDataText = await response.text(); 

    if (!response.ok) {
      let errorMessage = `Failed to fetch doctors via proxy ${INTERNAL_DOCTORS_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(responseDataText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || responseDataText}`;
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,200)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    let responseData;
    try {
        responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${INTERNAL_DOCTORS_ENDPOINT}. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
        throw new Error(`Malformed JSON response from internal doctors proxy.`);
    }
    
    console.log(`[MediBill API Client] Raw response from ${INTERNAL_DOCTORS_ENDPOINT}:`, JSON.stringify(responseData).substring(0, 500) + '...');

    if (Array.isArray(responseData)) {
      const doctors: Doctor[] = responseData;
      console.log(`[MediBill API Client] Doctors received from proxy: ${doctors.length}`);
      return doctors;
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
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  if (!EXTERNAL_API_BASE_URL || typeof EXTERNAL_API_BASE_URL !== 'string' || !EXTERNAL_API_BASE_URL.startsWith('http')) {
     const errorMsg = `CRITICAL CLIENT-SIDE CONFIGURATION ERROR for getAllCasesForDoctors: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL. Current value: '${EXTERNAL_API_BASE_URL}'. Cannot proceed.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[MediBill API Client] Fetching cases via internal proxy: ${INTERNAL_CASES_ENDPOINT} for doctors: ${JSON.stringify(doctorAccNos)} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`);
  try {
    const response = await fetch(INTERNAL_CASES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doctorAccNos }), 
    });

    const responseDataText = await response.text(); 

    if (!response.ok) {
      let errorMessage = `Failed to fetch cases via proxy ${INTERNAL_CASES_ENDPOINT}: ${response.status}`;
      try {
        const errorData = JSON.parse(responseDataText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || responseDataText}`;
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,200)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    let responseData;
    try {
        responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${INTERNAL_CASES_ENDPOINT}. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
        throw new Error(`Malformed JSON response from internal cases proxy.`);
    }

    console.log(`[MediBill API Client] Raw response from ${INTERNAL_CASES_ENDPOINT}:`, JSON.stringify(responseData).substring(0, 500) + '...');
    
    if (Array.isArray(responseData)) {
        const apiCases: ApiCase[] = responseData;
        const processedCases = apiCases.map(processApiCase);
        console.log(`[MediBill API Client] Cases received from proxy: ${apiCases.length}, Processed cases: ${processedCases.length}`);
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

    const responseDataText = await response.text(); 

    if (!response.ok) {
       let errorMessage = `Failed to update case status via proxy for case ID ${caseId} to ${newStatus} at ${url}: ${response.status}`;
       try {
         const errorData = JSON.parse(responseDataText);
         errorMessage += ` - Server: ${errorData.message || errorData.detail || responseDataText}`;
       } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,200)}...`; }
       console.error(errorMessage);
       throw new Error(errorMessage);
    }

    let updatedApiCase: ApiCase;
    try {
        updatedApiCase = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${url} after status update. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
        throw new Error(`Malformed JSON response from internal case status update proxy.`);
    }
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

    const responseDataText = await response.text(); 

    if (!response.ok) {
      let errorMessage = `Failed to update case ${caseId} via proxy at ${url}: ${response.status}`;
      try {
        const errorData = JSON.parse(responseDataText);
        errorMessage += ` - Server: ${errorData.message || errorData.detail || responseDataText}`;
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,200)}...`; } // Changed errorText to responseDataText
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    let updatedApiCase: ApiCase;
     try {
        updatedApiCase = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${url} after general case update. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
        throw new Error(`Malformed JSON response from internal general case update proxy.`);
    }
    return processApiCase(updatedApiCase);
  } catch (error) {
    console.error(`API updateCase (via proxy) Error for ${url}:`, error);
    throw error instanceof Error ? error : new Error(`An unknown error occurred while updating case ${caseId} via proxy.`);
  }
};

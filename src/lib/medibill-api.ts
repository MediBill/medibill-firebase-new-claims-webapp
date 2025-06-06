
import type { AuthToken, Doctor, Case, CaseStatus, ApiCase } from '@/types/medibill';

// --- Internal Next.js API Routes ---
const INTERNAL_LOGIN_ENDPOINT = '/api/auth/login';
const INTERNAL_DOCTORS_ENDPOINT = '/api/doctors';
const INTERNAL_CASES_ENDPOINT = '/api/cases';
const INTERNAL_CASE_GENERAL_UPDATE_ENDPOINT_TEMPLATE = '/api/cases/[caseId]/update';


// Client-side processing for an API case into a frontend Case
const processApiCase = (apiCase: ApiCase): Case => {
  let status: CaseStatus = 'NEW';
  if (apiCase.case_status === 'PROCESSED') {
    status = 'PROCESSED';
  } else if (apiCase.case_status === 'NEW' || !apiCase.case_status) {
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
  // console.log(`[MediBill API Client] Calling internal login proxy: ${INTERNAL_LOGIN_ENDPOINT}`); // Removed for prod
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

    if (responseData && typeof responseData.token === 'string' && typeof responseData.expiresAt === 'number') {
      // console.log('[MediBill API Client] Login via internal proxy successful. Token and expiresAt received.'); // Removed for prod
      return {
        token: responseData.token,
        expiresAt: responseData.expiresAt,
      };
    } else {
      const message = `Login successful (HTTP ${response.status}), but token data from internal proxy is missing or in an unexpected format. Expected { token: string, expiresAt: number }. Response: ${JSON.stringify(responseData).substring(0,200)}...`;
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
  // console.log(`[MediBill API Client] Fetching doctors via internal proxy: ${INTERNAL_DOCTORS_ENDPOINT} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`); // Removed for prod
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
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,100)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    let rawDoctorsFromProxy;
    try {
        rawDoctorsFromProxy = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${INTERNAL_DOCTORS_ENDPOINT}. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 200)}...`);
        throw new Error(`Malformed JSON response from internal doctors proxy.`);
    }

    // console.log(`[MediBill API Client] Raw data from internal doctors proxy (${INTERNAL_DOCTORS_ENDPOINT}):`, JSON.stringify(rawDoctorsFromProxy).substring(0, 200) + '...'); // Removed for prod

    if (!Array.isArray(rawDoctorsFromProxy)) {
        console.warn(`[MediBill API Client] getDoctors (via proxy) expected an array but received type: ${typeof rawDoctorsFromProxy}. Data:`, rawDoctorsFromProxy);
        return [];
    }

    // console.log(`[MediBill API Client] Raw doctors list from proxy (before mapping/filtering): ${rawDoctorsFromProxy.length} doctors`); // Removed for prod
    // rawDoctorsFromProxy.slice(0,1).forEach(doc => console.log('[MediBill API Client] Sample raw doctor from proxy:', doc)); // Removed for prod


    const mappedDoctors: Doctor[] = rawDoctorsFromProxy.map(apiDoc => ({
        id: apiDoc.user_id,
        name: apiDoc.doctor_name,
        practiceName: apiDoc.practice_name,
        specialty: apiDoc.speciality,
    }));
    // console.log(`[MediBill API Client] Mapped doctors (before filtering 'TEST'): ${mappedDoctors.length} doctors`); // Removed for prod
    // mappedDoctors.slice(0,1).forEach(doc => console.log('[MediBill API Client] Sample mapped doctor:', doc)); // Removed for prod

    const doctors: Doctor[] = mappedDoctors.filter(
      doctor => doctor.practiceName && typeof doctor.practiceName === 'string' && !doctor.practiceName.toUpperCase().includes('TEST')
    );
    // console.log(`[MediBill API Client] Filtered doctors (after removing 'TEST'): ${doctors.length} doctors`); // Removed for prod
    // doctors.slice(0,1).forEach(doc => console.log('[MediBill API Client] Sample filtered doctor:', doc)); // Removed for prod

    // console.log(`[MediBill API Client] Doctors to be returned by getDoctors: ${doctors.length}`); // Removed for prod
    return doctors;

  } catch (error) {
    console.error(`API getDoctors (via proxy) Error from ${INTERNAL_DOCTORS_ENDPOINT}:`, error);
    if (error instanceof Error) throw error;
    throw new Error('An unknown error occurred while fetching doctors via proxy.');
  }
};

export const getAllCasesForDoctors = async (token: string, doctorAccNos: string[]): Promise<Case[]> => {
  // console.log(`[MediBill API Client] Fetching cases via internal proxy: ${INTERNAL_CASES_ENDPOINT} for doctors: ${JSON.stringify(doctorAccNos)} with token: ${token ? token.substring(0, 10) + '...' : 'null'}`); // Removed for prod
  if (doctorAccNos.length === 0) {
    // console.log("[MediBill API Client] No doctor account numbers provided, skipping case fetch."); // Removed for prod
    return [];
  }
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
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,100)}...`; }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    let responseData;
    try {
        responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${INTERNAL_CASES_ENDPOINT}. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 200)}...`);
        throw new Error(`Malformed JSON response from internal cases proxy.`);
    }

    // console.log(`[MediBill API Client] Raw response from internal cases proxy (${INTERNAL_CASES_ENDPOINT}):`, JSON.stringify(responseData).substring(0, 200) + '...'); // Removed for prod
    
    if (Array.isArray(responseData)) {
        const apiCases: ApiCase[] = responseData;
        const processedCases = apiCases.map(processApiCase);
        // console.log(`[MediBill API Client] Cases received from proxy: ${apiCases.length}, Processed cases: ${processedCases.length}`); // Removed for prod
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

export const updateCase = async (token: string, caseId: number, updatedCaseData: Partial<ApiCase>): Promise<{ success: boolean; updatedCase?: Case }> => {
  const url = INTERNAL_CASE_GENERAL_UPDATE_ENDPOINT_TEMPLATE.replace('[caseId]', caseId.toString());
  // console.log(`[MediBill API Client] updateCase: Internal proxy URL: ${url}`); // Removed for prod
  // console.log(`[MediBill API Client] updateCase: Auth token being sent in header: ${token ? token.substring(0,10) + '...' : 'null'}`); // Removed for prod
  // console.log(`[MediBill API Client] updateCase: Case ID from param: ${caseId}`); // Removed for prod
  // console.log(`[MediBill API Client] updateCase: Payload:`, updatedCaseData); // Removed for prod


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
      } catch (e) { errorMessage += ` - Body: ${responseDataText.substring(0,100)}...`; }
      console.error(errorMessage);
      return { success: false };
    }

    let updatedApiCase: ApiCase;
     try {
        const responseJson = JSON.parse(responseDataText);
        if (responseJson.status === 'success' && responseJson.case_submission && typeof responseJson.case_submission === 'object') {
          updatedApiCase = responseJson.case_submission;
        } else if (typeof responseJson.id !== 'undefined') { // Fallback if structure is just the case object directly
          updatedApiCase = responseJson;
        }
         else {
          console.error(`[MediBill API Client] Unexpected response structure from ${url} after general case update. Status: ${response.status}. Response Text: ${responseDataText.substring(0, 200)}...`);
          return { success: false };
        }
    } catch (jsonError: any) {
        console.error(`[MediBill API Client] Failed to parse JSON response from ${url} after general case update. Status: ${response.status}. Error: ${jsonError.message}. Response Text: ${responseDataText.substring(0, 200)}...`);
        return { success: false };
    }
    // console.log(`[MediBill API Client] Case update response from proxy (parsed):`, updatedApiCase); // Removed for prod
    return { success: true, updatedCase: processApiCase(updatedApiCase) };
  } catch (error) {
    console.error(`API updateCase (via proxy) Error for ${url}:`, error);
    const message = error instanceof Error ? error.message : `An unknown error occurred while updating case ${caseId} via proxy.`;
    console.error(message);
    return { success: false };
  }
};

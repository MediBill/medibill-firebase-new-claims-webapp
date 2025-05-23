
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ApiCase } from '@/types/medibill';

// Hardcoded value for testing
const EXTERNAL_API_BASE_URL = "https://api.medibill.co.za/api/v1";

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    console.warn('[API Cases Route] Authorization token is missing from request headers.');
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }
  console.log(`[API Cases Route] Token received: ${token ? token.substring(0, 10) + '...' : 'null'}`);

  let doctorAccNos: string[] = [];
  try {
    const body = await request.json();
    if (body.doctorAccNos && Array.isArray(body.doctorAccNos)) {
      doctorAccNos = body.doctorAccNos;
    } else {
      console.error('[API Cases Route] doctorAccNos not provided in request body or not an array.');
      return NextResponse.json({ message: 'doctorAccNos (array of strings) is required in the request body.' }, { status: 400 });
    }
    if (doctorAccNos.length === 0) {
      console.log('[API Cases Route] doctorAccNos array is empty, returning no cases.');
      return NextResponse.json([], { status: 200 });
    }
    console.log(`[API Cases Route] Received doctorAccNos for case fetching: ${JSON.stringify(doctorAccNos)}`);
  } catch (e) {
    console.error('[API Cases Route] Could not parse doctorAccNos from request body or body is not JSON:', e);
    return NextResponse.json({ message: 'Invalid request body. Expected JSON with doctorAccNos (array of strings).' }, { status: 400 });
  }

  const allCaseSubmissions: ApiCase[] = [];

  for (const accNo of doctorAccNos) {
    const CASE_SUBMISSION_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/submissions/doctors/${accNo}`;
    console.log(`[API Cases Route] Fetching case submission for doctor ${accNo} from: ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}`);

    try {
      const externalApiResponse = await fetch(CASE_SUBMISSION_ENDPOINT_EXTERNAL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          // No 'Content-Type' for GET
        },
      });

      const responseDataText = await externalApiResponse.text();

      if (!externalApiResponse.ok) {
        console.error(`[API Cases Route] External API error for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL} - Status: ${externalApiResponse.status}. Response: ${responseDataText.substring(0, 300)}...`);
        continue;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseDataText);
      } catch (jsonError) {
        console.error(`[API Cases Route] Failed to parse JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}. Status: ${externalApiResponse.status}. Response Text: ${responseDataText.substring(0, 300)}...`);
        continue;
      }
      
      console.log(`[API Cases Route] Raw JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}: Status ${externalApiResponse.status}, Parsed Body: ${JSON.stringify(responseData).substring(0, 500)}...`);

      // Enhanced logging for why a case might not be added:
      if (responseData.status === 'success') {
        if (responseData.case_submission && typeof responseData.case_submission === 'object' && !Array.isArray(responseData.case_submission)) {
          console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, adding case_submission with ID: ${responseData.case_submission.id}`);
          allCaseSubmissions.push(responseData.case_submission as ApiCase);
        } else if (Array.isArray(responseData.case_submission)) {
          // This case might be relevant if a single doctor ID could return multiple cases
          console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, case_submission is an array with ${responseData.case_submission.length} items. Adding them.`);
          allCaseSubmissions.push(...(responseData.case_submission as ApiCase[]));
        } else if (!responseData.case_submission) {
          console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, but 'case_submission' field is missing, null, or undefined.`);
        } else {
           console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, but 'case_submission' field is not a non-array object. Type: ${typeof responseData.case_submission}, Value: ${JSON.stringify(responseData.case_submission).substring(0,100)}...`);
        }
      } else {
        console.warn(`[API Cases Route] Doctor ${accNo}: Data fetched but API status was not 'success'. Actual status: '${responseData.status}'. Full response: ${JSON.stringify(responseData).substring(0,300)}...`);
      }

    } catch (error) {
      console.error(`[API Cases Route] Internal error fetching case for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}:`, error);
    }
  }

  console.log(`[API Cases Route] Total case submissions fetched and aggregated: ${allCaseSubmissions.length}`);
  return NextResponse.json(allCaseSubmissions, { status: 200 });
}

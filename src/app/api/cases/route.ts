
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
        // Log specific error for this doctor but continue to try others
        console.error(`[API Cases Route] External API error for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL} - Status: ${externalApiResponse.status}. Response: ${responseDataText.substring(0, 300)}...`);
        // Optionally, if a 404 means "no case for this doctor", you might just continue without error.
        // For other errors, you might want to collect them and report.
        // For now, we'll just skip this doctor's case if there's an error.
        continue;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseDataText);
      } catch (jsonError) {
        console.error(`[API Cases Route] Failed to parse JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}. Status: ${externalApiResponse.status}. Response: ${responseDataText.substring(0, 300)}...`);
        continue; // Skip if response is not valid JSON
      }
      
      console.log(`[API Cases Route] Raw JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}: Status ${externalApiResponse.status}, Parsed Body: ${JSON.stringify(responseData).substring(0, 300)}...`);

      if (responseData.status === 'success' && responseData.case_submission && typeof responseData.case_submission === 'object') {
        // Assuming case_submission is a single object as per your example
        allCaseSubmissions.push(responseData.case_submission as ApiCase);
      } else if (responseData.status === 'success' && Array.isArray(responseData.case_submission)) {
        // If case_submission could be an array of cases for one doctor
        allCaseSubmissions.push(...(responseData.case_submission as ApiCase[]));
      } else if (responseData.status === 'success' && !responseData.case_submission) {
        console.log(`[API Cases Route] Successfully fetched for doctor ${accNo}, but no 'case_submission' field found or it's empty.`);
      }
      else {
        console.warn(`[API Cases Route] Fetched data for doctor ${accNo}, but status was not 'success' or case_submission was missing/malformed. Status: ${responseData.status}`);
      }

    } catch (error) {
      console.error(`[API Cases Route] Internal error fetching case for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}:`, error);
      // Continue to next doctor even if one fails
    }
  }

  console.log(`[API Cases Route] Total case submissions fetched: ${allCaseSubmissions.length}`);
  return NextResponse.json(allCaseSubmissions, { status: 200 });
}

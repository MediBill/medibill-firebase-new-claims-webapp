
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ApiCase } from '@/types/medibill';

export async function POST(request: NextRequest) {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Cases Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set.' }, { status: 500 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    console.warn('[API Cases Route] Authorization token is missing from request headers.');
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }
  // console.log(`[API Cases Route] Token received: ${token ? token.substring(0, 10) + '...' : 'null'}`); // Removed for prod

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
      // console.log('[API Cases Route] doctorAccNos array is empty, returning no cases.'); // Removed for prod
      return NextResponse.json([], { status: 200 });
    }
    // console.log(`[API Cases Route] Received doctorAccNos for case fetching: ${JSON.stringify(doctorAccNos)}`); // Removed for prod
  } catch (e) {
    console.error('[API Cases Route] Could not parse doctorAccNos from request body or body is not JSON:', e);
    return NextResponse.json({ message: 'Invalid request body. Expected JSON with doctorAccNos (array of strings).' }, { status: 400 });
  }

  const allCaseSubmissions: ApiCase[] = [];

  for (const accNo of doctorAccNos) {
    const CASE_SUBMISSION_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL.replace(/\/$/, '')}/cases/submissions/doctors/${accNo}`;
    // console.log(`[API Cases Route] Fetching case submission for doctor ${accNo} from: ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}`); // Removed for prod

    try {
      const externalApiResponse = await fetch(CASE_SUBMISSION_ENDPOINT_EXTERNAL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const responseDataText = await externalApiResponse.text();

      if (!externalApiResponse.ok) {
        console.error(`[API Cases Route] External API error for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL} - Status: ${externalApiResponse.status}. Response: ${responseDataText.substring(0, 100)}...`);
        continue;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseDataText);
      } catch (jsonError) {
        console.error(`[API Cases Route] Failed to parse JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}. Status: ${externalApiResponse.status}. Response Text: ${responseDataText.substring(0, 100)}...`);
        continue;
      }
      
      // console.log(`[API Cases Route] Raw JSON response for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}: Status ${externalApiResponse.status}, Parsed Body: ${JSON.stringify(responseData).substring(0, 200)}...`); // Removed for prod

      if (responseData.status === 'success') {
        if (responseData.case_submissions && Array.isArray(responseData.case_submissions)) {
          // console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, 'case_submissions' (plural) is an array with ${responseData.case_submissions.length} items. Adding them.`); // Removed for prod
          allCaseSubmissions.push(...(responseData.case_submissions as ApiCase[]));
        } else if (responseData.case_submissions === null || responseData.case_submissions === undefined) {
          // console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, but 'case_submissions' (plural) field is missing, null, or undefined.`); // Removed for prod
        } else {
           // console.log(`[API Cases Route] Doctor ${accNo}: SUCCESS, but 'case_submissions' (plural) field is not an array. Type: ${typeof responseData.case_submissions}, Value: ${JSON.stringify(responseData.case_submissions).substring(0,50)}...`); // Removed for prod
        }
      } else {
        console.warn(`[API Cases Route] Doctor ${accNo}: Data fetched but API status was not 'success'. Actual status: '${responseData.status}'. Full response: ${JSON.stringify(responseData).substring(0,100)}...`);
      }

    } catch (error) {
      console.error(`[API Cases Route] Internal error fetching case for doctor ${accNo} from ${CASE_SUBMISSION_ENDPOINT_EXTERNAL}:`, error);
    }
  }

  // console.log(`[API Cases Route] Total case submissions fetched and aggregated: ${allCaseSubmissions.length}`); // Potentially keep for ops
  return NextResponse.json(allCaseSubmissions, { status: 200 });
}

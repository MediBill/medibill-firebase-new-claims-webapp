
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
      console.warn('[API Cases Route] doctorAccNos not provided in request body or not an array. Will fetch all cases for the user from external API.');
    }
    console.log(`[API Cases Route] Received doctorAccNos for filtering: ${JSON.stringify(doctorAccNos)}`);
  } catch (e) {
    console.warn('[API Cases Route] Could not parse doctorAccNos from request body or body is not JSON. Fetching all cases for the user.');
  }

  // Updated to use /cases/submissions/ (with a trailing slash)
  const CASES_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/submissions/`;
  console.log(`[API Cases Route] Proxied GET request to external API: ${CASES_ENDPOINT_EXTERNAL}`);

  try {
    // The external API for cases is a GET request.
    const externalApiResponse = await fetch(CASES_ENDPOINT_EXTERNAL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const responseDataText = await externalApiResponse.text();

    if (!externalApiResponse.ok) {
      console.error(`[API Cases Route] External API error from ${CASES_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}. Response Body: ${responseDataText.substring(0, 500)}...`);
      let errorData;
      try {
        errorData = JSON.parse(responseDataText);
      } catch (e) {
        // If parsing fails, use the raw text
        return NextResponse.json(
            { message: `External API error: ${externalApiResponse.status} - ${responseDataText.substring(0,200)}...` },
            { status: externalApiResponse.status }
        );
      }
      return NextResponse.json(
        { message: errorData.message || errorData.detail || `External API error: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }

    let responseData: ApiCase[];
    try {
      responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
      console.error(`[API Cases Route] Failed to parse JSON response from external API (${CASES_ENDPOINT_EXTERNAL}). Status: ${externalApiResponse.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
      return NextResponse.json({ message: 'Malformed response from external case data provider.' }, { status: 502 });
    }

    console.log(`[API Cases Route] Raw JSON response from external API (${CASES_ENDPOINT_EXTERNAL}): Status ${externalApiResponse.status}, Parsed Body: ${JSON.stringify(responseData).substring(0, 500)}...`);

    if (!Array.isArray(responseData)) {
      console.error(`[API Cases Route] External API at ${CASES_ENDPOINT_EXTERNAL} did not return an array for cases:`, responseData);
      return NextResponse.json({ message: 'Received malformed case data (expected an array) from external API.' }, { status: 502 });
    }

    let filteredCases = responseData;
    if (doctorAccNos.length > 0) {
      console.log(`[API Cases Route] Filtering ${responseData.length} cases based on ${doctorAccNos.length} doctorAccNos.`);
      filteredCases = responseData.filter(apiCase =>
        apiCase.doctor_acc_no && doctorAccNos.includes(apiCase.doctor_acc_no)
      );
      console.log(`[API Cases Route] Found ${filteredCases.length} cases after filtering.`);
    } else {
      console.log(`[API Cases Route] No doctorAccNos provided for filtering, returning all ${responseData.length} cases received from external API.`);
    }

    return NextResponse.json(filteredCases, { status: 200 });

  } catch (error) {
    console.error('[API Cases Route] Internal error during cases proxy:', error);
    let message = 'Internal server error during cases proxy.';
    if (error instanceof Error) {
      message = error.message.includes('fetch') ? `Network error or external API unreachable for cases at ${CASES_ENDPOINT_EXTERNAL}.` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

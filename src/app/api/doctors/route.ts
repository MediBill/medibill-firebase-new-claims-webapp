
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Doctors Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set.' }, { status: 500 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (!token) {
    console.warn('[API Doctors Route] Authorization token is missing from request headers.');
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }
  // console.log(`[API Doctors Route] Token received: ${token ? token.substring(0, 10) + '...' : 'null'}`); // Removed for prod

  const DOCTORS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL.replace(/\/$/, '')}/doctors`;
  // console.log(`[API Doctors Route] Proxied GET request to external API: ${DOCTORS_ENDPOINT_EXTERNAL}`); // Removed for prod

  try {
    const externalApiResponse = await fetch(DOCTORS_ENDPOINT_EXTERNAL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const responseDataText = await externalApiResponse.text();

    if (!externalApiResponse.ok) {
      console.error(`[API Doctors Route] External API error from ${DOCTORS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}: Response Text: ${responseDataText.substring(0, 200)}...`);
      let message = `External API error for doctors: ${externalApiResponse.status}`;
      try {
        const errorJson = JSON.parse(responseDataText);
        message = errorJson.message || errorJson.detail || message;
      } catch (e) {
        // Keep message as is or use short part of responseDataText if not too long
        message = responseDataText.length < 100 ? responseDataText : message;
      }
      return NextResponse.json({ message }, { status: externalApiResponse.status });
    }

    let responseData;
    try {
      responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
      console.error(`[API Doctors Route] Failed to parse JSON response from ${DOCTORS_ENDPOINT_EXTERNAL}. Status: ${externalApiResponse.status}. Response Text: ${responseDataText.substring(0, 200)}...`);
      return NextResponse.json({ message: 'Malformed JSON response from external doctors API.' }, { status: 502 });
    }

    // console.log(`[API Doctors Route] Raw response from external API (${DOCTORS_ENDPOINT_EXTERNAL}): Status ${externalApiResponse.status}, Body: ${JSON.stringify(responseData).substring(0, 200)}...`); // Removed for prod

    if (responseData && typeof responseData === 'object' && responseData.status === 'success' && Array.isArray(responseData.doctors)) {
      // console.log(`[API Doctors Route] Successfully fetched. Returning ${responseData.doctors.length} doctors from 'doctors' property.`); // Removed for prod
      return NextResponse.json(responseData.doctors, { status: 200 });
    } else {
      console.error(`[API Doctors Route] External API at ${DOCTORS_ENDPOINT_EXTERNAL} did not return the expected {status: "success", doctors: [...]} structure:`, responseData);
      return NextResponse.json({ message: 'Received malformed doctor data structure from external API.' }, { status: 502 });
    }
  } catch (error) {
    console.error('[API Doctors Route] Internal error during doctors proxy:', error);
    let message = 'Internal server error during doctors proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for doctors at ${DOCTORS_ENDPOINT_EXTERNAL}.` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

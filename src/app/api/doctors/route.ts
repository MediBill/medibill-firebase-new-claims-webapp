
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// import type { Doctor } from '@/types/medibill'; // Raw Doctor type not directly used here anymore

// Hardcoded value for testing
const EXTERNAL_API_BASE_URL = "https://api.medibill.co.za/api/v1";

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (!token) {
    console.warn('[API Doctors Route] Authorization token is missing from request headers.');
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }
  console.log(`[API Doctors Route] Token received: ${token ? token.substring(0, 10) + '...' : 'null'}`);

  const DOCTORS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/doctors`;
  console.log(`[API Doctors Route] Proxied GET request to external API: ${DOCTORS_ENDPOINT_EXTERNAL}`);

  try {
    const externalApiResponse = await fetch(DOCTORS_ENDPOINT_EXTERNAL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        // 'Content-Type': 'application/json', // Content-Type not typically needed for GET
      },
    });

    const responseDataText = await externalApiResponse.text(); // Get text first for better error diagnosis

    if (!externalApiResponse.ok) {
      console.error(`[API Doctors Route] External API error from ${DOCTORS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}: Response Text: ${responseDataText.substring(0, 500)}...`);
      let message = `External API error for doctors: ${externalApiResponse.status}`;
      try {
        const errorJson = JSON.parse(responseDataText);
        message = errorJson.message || errorJson.detail || message;
      } catch (e) {
        // If parsing fails, use the raw text if it's short, or a generic message
        message = responseDataText.length < 300 ? responseDataText : message;
      }
      return NextResponse.json({ message }, { status: externalApiResponse.status });
    }

    let responseData;
    try {
      responseData = JSON.parse(responseDataText);
    } catch (jsonError) {
      console.error(`[API Doctors Route] Failed to parse JSON response from ${DOCTORS_ENDPOINT_EXTERNAL}. Status: ${externalApiResponse.status}. Response Text: ${responseDataText.substring(0, 500)}...`);
      return NextResponse.json({ message: 'Malformed JSON response from external doctors API.' }, { status: 502 });
    }
    
    console.log(`[API Doctors Route] Raw response from external API (${DOCTORS_ENDPOINT_EXTERNAL}): Status ${externalApiResponse.status}, Body: ${JSON.stringify(responseData).substring(0, 500)}...`);

    if (responseData && typeof responseData === 'object' && responseData.status === 'success' && Array.isArray(responseData.doctors)) {
      console.log(`[API Doctors Route] Successfully fetched. Returning ${responseData.doctors.length} doctors from 'doctors' property.`);
      return NextResponse.json(responseData.doctors, { status: 200 }); // Return the array of doctor objects
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

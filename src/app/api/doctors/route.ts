
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Doctor } from '@/types/medibill';

const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

export async function GET(request: NextRequest) {
  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Doctors Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set for doctors proxy.' }, { status: 500 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (!token) {
    console.warn('[API Doctors Route] Authorization token is missing from request headers.');
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }
  console.log(`[API Doctors Route] Token received: ${token ? token.substring(0, 10) + '...' : 'null'}`);

  const DOCTORS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/doctors`;
  console.log(`[API Doctors Route] Proxied request to external API: ${DOCTORS_ENDPOINT_EXTERNAL}`);

  try {
    const externalApiResponse = await fetch(DOCTORS_ENDPOINT_EXTERNAL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await externalApiResponse.json();
    console.log(`[API Doctors Route] Raw response from external API (${DOCTORS_ENDPOINT_EXTERNAL}): Status ${externalApiResponse.status}, Body: ${JSON.stringify(responseData).substring(0, 500)}...`);


    if (!externalApiResponse.ok) {
      console.error(`[API Doctors Route] External API error from ${DOCTORS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, responseData);
      return NextResponse.json(
        { message: responseData.message || responseData.detail || `External API error for doctors: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }

    if (!Array.isArray(responseData)) {
      console.error(`[API Doctors Route] External API at ${DOCTORS_ENDPOINT_EXTERNAL} did not return an array for doctors:`, responseData);
      if (responseData && typeof responseData === 'object' && Array.isArray((responseData as any).doctors)) {
         console.log('[API Doctors Route] Found doctors in a "doctors" property, returning that array.');
        return NextResponse.json((responseData as any).doctors, { status: 200 });
      }
      return NextResponse.json({ message: 'Received malformed doctor data from external API (expected an array).' }, { status: 502 }); // Bad Gateway
    }
    
    console.log(`[API Doctors Route] Successfully fetched and returning ${responseData.length} doctors.`);
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('[API Doctors Route] Internal error during doctors proxy:', error);
    let message = 'Internal server error during doctors proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for doctors at ${DOCTORS_ENDPOINT_EXTERNAL}.` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

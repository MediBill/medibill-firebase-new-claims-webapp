
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

export async function GET(request: NextRequest) {
  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Doctors Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set for doctors proxy.' }, { status: 500 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }

  const DOCTORS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/doctors`;

  try {
    console.log(`[API Doctors Route] Proxied request to: ${DOCTORS_ENDPOINT_EXTERNAL}`);
    const externalApiResponse = await fetch(DOCTORS_ENDPOINT_EXTERNAL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok) {
      console.error(`[API Doctors Route] External API error from ${DOCTORS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, responseData);
      return NextResponse.json(
        { message: responseData.message || responseData.detail || `External API error for doctors: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('[API Doctors Route] Internal error during doctors proxy:', error);
    let message = 'Internal server error during doctors proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? 'Network error or external API unreachable for doctors.' : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

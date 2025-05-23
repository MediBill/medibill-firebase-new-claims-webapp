
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AuthToken } from '@/types/medibill';

export async function POST(request: NextRequest) {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
  const APP_EMAIL = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL;
  const API_PASSWORD = process.env.NEXT_PUBLIC_MEDIBILL_API_PASSWORD;

  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Route Error] Login: NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set.' }, { status: 500 });
  }
  if (!APP_EMAIL) {
    console.error('[API Route Error] Login: NEXT_PUBLIC_MEDIBILL_APP_EMAIL is not set.');
    return NextResponse.json({ message: 'Server configuration error: App email not set.' }, { status: 500 });
  }
  if (!API_PASSWORD) {
    console.error('[API Route Error] Login: NEXT_PUBLIC_MEDIBILL_API_PASSWORD is not set.');
    return NextResponse.json({ message: 'Server configuration error: API password not set.' }, { status: 500 });
  }

  // Construct login endpoint without trailing slash on 'login'
  const LOGIN_ENDPOINT = `${EXTERNAL_API_BASE_URL.replace(/\/$/, '')}/auth/login`;
  console.log(`[API Route] Attempting login to external API: ${LOGIN_ENDPOINT} with email: ${APP_EMAIL}`);

  try {
    const externalApiResponse = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: APP_EMAIL, password: API_PASSWORD }),
    });

    const responseText = await externalApiResponse.text();
    // Log the raw response text for debugging, especially for non-OK responses
    if (!externalApiResponse.ok) {
        console.warn(`[API Route] External API login response text (Status: ${externalApiResponse.status}): ${responseText.substring(0, 500)}`);
    }


    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[API Route] Failed to parse JSON response from external API at ${LOGIN_ENDPOINT}. Status: ${externalApiResponse.status}. Error:`, parseError);
      console.error(`[API Route] Raw response text was: ${responseText}`);
      return NextResponse.json(
        { message: `Authentication failed: Malformed or non-JSON response from authentication server. Status: ${externalApiResponse.status}` },
        { status: 502 } // Bad Gateway, as proxy received invalid response
      );
    }

    if (!externalApiResponse.ok) {
      console.error(`[API Route] External API login failed with status ${externalApiResponse.status}:`, responseData);
      // Attempt to use error message from external API if available, otherwise use status
      const message = responseData?.message || responseData?.detail || `External API error: ${externalApiResponse.status}`;
      return NextResponse.json(
        { message },
        { status: externalApiResponse.status } 
      );
    }

    // Expecting { "status": "success", "token": "...", "expires_in": ... (optional) } from external API
    if (responseData.status === 'success' && responseData.token) {
      const tokenData: AuthToken = {
        token: responseData.token,
        expiresAt: responseData.expires_in ? Date.now() + responseData.expires_in * 1000 : Date.now() + 3600 * 1000,
      };
      console.log('[API Route] External API login successful.');
      return NextResponse.json(tokenData, { status: 200 });
    } else {
      console.error('[API Route] External API login response malformed (expected status: "success" and token):', responseData);
      return NextResponse.json({ message: 'Authentication failed: Malformed response from authentication server.' }, { status: 500 });
    }
  } catch (error) {
    console.error('[API Route] Internal error during login proxy:', error);
    let message = 'Internal server error during login.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable at ${LOGIN_ENDPOINT}.` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

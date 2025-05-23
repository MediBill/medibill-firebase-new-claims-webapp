
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AuthToken } from '@/types/medibill';

const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;
const APP_EMAIL = process.env.NEXT_PUBLIC_MEDIBILL_APP_EMAIL;
const API_PASSWORD = process.env.NEXT_PUBLIC_MEDIBILL_API_PASSWORD;

export async function POST(request: NextRequest) {
  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set.' }, { status: 500 });
  }
  if (!APP_EMAIL) {
    console.error('[API Route Error] NEXT_PUBLIC_MEDIBILL_APP_EMAIL is not set.');
    return NextResponse.json({ message: 'Server configuration error: App email not set.' }, { status: 500 });
  }
  if (!API_PASSWORD) {
    console.error('[API Route Error] NEXT_PUBLIC_MEDIBILL_API_PASSWORD is not set.');
    return NextResponse.json({ message: 'Server configuration error: API password not set.' }, { status: 500 });
  }

  const LOGIN_ENDPOINT = `${EXTERNAL_API_BASE_URL}auth/login`;

  try {
    // const { password: passwordFromClient } = await request.json();
    // Although the client sends a password, we are instructed to use the hardcoded API_PASSWORD for the external call.
    // The passwordFromClient could be used for an initial check if needed, but for now, it's ignored for the external API auth.

    console.log(`[API Route] Attempting login to external API: ${LOGIN_ENDPOINT} with email: ${APP_EMAIL}`);

    const externalApiResponse = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: APP_EMAIL, password: API_PASSWORD }),
    });

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok) {
      console.error(`[API Route] External API login failed with status ${externalApiResponse.status}:`, responseData);
      return NextResponse.json(
        { message: responseData.message || responseData.detail || `External API error: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }

    if (responseData.status === 'success' && responseData.token) {
      const tokenData: AuthToken = {
        token: responseData.token,
        // If the external API provides an expiry, use it, otherwise default
        expiresAt: responseData.expires_in ? Date.now() + responseData.expires_in * 1000 : Date.now() + 3600 * 1000,
      };
      console.log('[API Route] External API login successful.');
      return NextResponse.json(tokenData, { status: 200 });
    } else {
      console.error('[API Route] External API login response malformed:', responseData);
      return NextResponse.json({ message: 'Authentication failed: Malformed response from authentication server.' }, { status: 500 });
    }
  } catch (error) {
    console.error('[API Route] Internal error during login proxy:', error);
    let message = 'Internal server error during login.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? 'Network error or external API unreachable.' : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

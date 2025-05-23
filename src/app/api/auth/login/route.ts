
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AuthToken } from '@/types/medibill';

// Hardcoded values for testing
const EXTERNAL_API_BASE_URL = "https://api.medibill.co.za/api/v1";
const APP_EMAIL = "medibill.developer@gmail.com";
const API_PASSWORD = "apt@123!";

export async function POST(request: NextRequest) {
  // Environment variable checks are removed as values are hardcoded above

  const LOGIN_ENDPOINT = `${EXTERNAL_API_BASE_URL}/auth/login`;

  try {
    // const { password: passwordFromClient } = await request.json();
    // The passwordFromClient is passed from the client AuthForm.
    // For this specific API call, we are instructed to use the hardcoded API_PASSWORD.

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

    // Assuming the external API response structure for success is { "status": "success", "token": "...", "expires_in": ... }
    // Or simply { "token": "...", ... } if status field is not always present on success
    if (responseData.token) {
      const tokenData: AuthToken = {
        token: responseData.token,
        // If the external API provides an expiry (e.g., expires_in in seconds), use it, otherwise default to 1 hour
        expiresAt: responseData.expires_in ? Date.now() + responseData.expires_in * 1000 : Date.now() + 3600 * 1000,
      };
      console.log('[API Route] External API login successful.');
      return NextResponse.json(tokenData, { status: 200 });
    } else {
      console.error('[API Route] External API login response malformed (token missing):', responseData);
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

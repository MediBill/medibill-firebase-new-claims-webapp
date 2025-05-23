
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ApiCase } from '@/types/medibill';

const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

// This route will handle POST to fetch cases and filter them
export async function POST(request: NextRequest) {
  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Cases Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set for cases proxy.' }, { status: 500 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }

  let doctorAccNos: string[] = [];
  try {
    const body = await request.json();
    if (body.doctorAccNos && Array.isArray(body.doctorAccNos)) {
      doctorAccNos = body.doctorAccNos;
    } else {
        // If doctorAccNos is not provided or not an array, proceed to fetch all cases for the user (as per original external API behavior)
        // The client-side logic used to filter, so here we might return all or enforce this field.
        // For now, if not provided, we'll fetch all and the client-side logic used to handle it.
        // However, the request now requires doctorAccNos to be meaningful for this proxy.
        // Let's assume if it's not present or empty, we still fetch all and let the client handle if needed,
        // or the client should always send it for filtering.
        // For consistency with the original request, if no doctorAccNos, it means fetch all for the user.
    }
  } catch (e) {
    console.warn('[API Cases Route] Could not parse doctorAccNos from request body or body is not JSON. Fetching all cases for the user.');
    // Proceed to fetch all cases if body is not as expected or parsing fails
  }


  const CASES_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases`;

  try {
    console.log(`[API Cases Route] Proxied request to: ${CASES_ENDPOINT_EXTERNAL}`);
    const externalApiResponse = await fetch(CASES_ENDPOINT_EXTERNAL, {
      method: 'GET', // External API is GET
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData: ApiCase[] = await externalApiResponse.json();

    if (!externalApiResponse.ok) {
      console.error(`[API Cases Route] External API error from ${CASES_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, responseData);
      const errorBody = responseData as any;
      return NextResponse.json(
        { message: errorBody.message || errorBody.detail || `External API error for cases: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }

    // Filter cases on the server if doctorAccNos were provided and are not empty
    let filteredCases = responseData;
    if (doctorAccNos.length > 0) {
        filteredCases = responseData.filter(apiCase =>
            apiCase.doctor_acc_no && doctorAccNos.includes(apiCase.doctor_acc_no)
        );
    }
    
    return NextResponse.json(filteredCases, { status: 200 });

  } catch (error) {
    console.error('[API Cases Route] Internal error during cases proxy:', error);
    let message = 'Internal server error during cases proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? 'Network error or external API unreachable for cases.' : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

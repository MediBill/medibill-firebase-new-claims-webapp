
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ApiCase } from '@/types/medibill';

interface CaseUpdateParams {
  params: { caseId: string };
}

export async function PUT(request: NextRequest, { params }: CaseUpdateParams) {
  const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Case Update Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set.' }, { status: 500 });
  }

  const { caseId } = params;
  if (!caseId) {
    return NextResponse.json({ message: 'Case ID is missing from the path.' }, { status: 400 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }

  let updatedCaseData: Partial<ApiCase>;
  try {
    updatedCaseData = await request.json();
  } catch (e) {
    return NextResponse.json({ message: 'Invalid request body. Expected JSON with case data.' }, { status: 400 });
  }

  const UPDATE_CASE_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/submissions/update/${caseId}`;

  try {
    console.log(`[API Case Update Route] Proxied PUT request for case ${caseId} to: ${UPDATE_CASE_ENDPOINT_EXTERNAL}`);
    const externalApiResponse = await fetch(UPDATE_CASE_ENDPOINT_EXTERNAL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedCaseData),
    });

    // Get response as text first for better error diagnosis if it's not JSON
    const responseDataText = await externalApiResponse.text();

    if (!externalApiResponse.ok) {
      console.error(`[API Case Update Route] External API error from ${UPDATE_CASE_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}: ${responseDataText.substring(0, 500)}`);
      // Try to parse as JSON for a structured error message, otherwise use text
      let errorDetail = responseDataText;
      try {
        const errorJson = JSON.parse(responseDataText);
        errorDetail = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
      } catch (e) { /* Keep responseDataText as errorDetail */ }
      return NextResponse.json(
        { message: `External API error updating case: ${externalApiResponse.status}`, error: errorDetail },
        { status: externalApiResponse.status }
      );
    }

    try {
      const responseData = JSON.parse(responseDataText);
      console.log(`[API Case Update Route] Successfully updated case ${caseId} via external API. Response:`, responseData);
      return NextResponse.json(responseData, { status: 200 });
    } catch (jsonError) {
        // This case might happen if the external API returns 200 OK but with non-JSON or empty body
        console.warn(`[API Case Update Route] Case ${caseId} updated successfully (status ${externalApiResponse.status}), but response body was not valid JSON: ${responseDataText.substring(0,500)}`);
        // Depending on API contract, you might return a generic success or the raw text
        return NextResponse.json({ message: "Case updated successfully, but confirmation response was not valid JSON.", rawResponse: responseDataText }, { status: 200 });
    }

  } catch (error) {
    console.error(`[API Case Update Route] Internal error during case update proxy for case ${caseId}:`, error);
    let message = 'Internal server error during case update proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for case update (case ${caseId}).` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

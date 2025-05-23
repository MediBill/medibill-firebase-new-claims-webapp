
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { CaseStatus, ApiCase } from '@/types/medibill';

// Hardcoded value for testing
const EXTERNAL_API_BASE_URL = "https://api.medibill.co.za/api/v1";

interface StatusUpdateParams {
  params: { caseId: string };
}

export async function PUT(request: NextRequest, { params }: StatusUpdateParams) {
  const { caseId } = params;
  if (!caseId) {
    return NextResponse.json({ message: 'Case ID is missing from the path.' }, { status: 400 });
  }

  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ message: 'Authorization token is missing.' }, { status: 401 });
  }

  let newStatus: CaseStatus;
  try {
    const body = await request.json();
    newStatus = body.case_status;
    if (!newStatus || (newStatus !== 'NEW' && newStatus !== 'PROCESSED')) {
      return NextResponse.json({ message: 'Invalid case_status provided in request body. Must be NEW or PROCESSED.' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ message: 'Invalid request body. Expected JSON with case_status.' }, { status: 400 });
  }

  // Updated endpoint to include /submissions/
  const UPDATE_STATUS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/submissions/${caseId}/status`;

  try {
    console.log(`[API Case Status Route] Proxied PUT request for case ${caseId} to: ${UPDATE_STATUS_ENDPOINT_EXTERNAL} with status ${newStatus}`);
    const externalApiResponse = await fetch(UPDATE_STATUS_ENDPOINT_EXTERNAL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }),
    });

    const responseDataText = await externalApiResponse.text();
    console.log(`[API Case Status Route] External API response text for case ${caseId} update: Status ${externalApiResponse.status}, Body: ${responseDataText.substring(0, 500)}...`);

    if (!externalApiResponse.ok) {
      let message = `External API error updating case status: ${externalApiResponse.status}`;
      try {
        // Try to parse error response if it's JSON
        const errorJson = JSON.parse(responseDataText);
        message = errorJson.message || errorJson.detail || message;
      } catch (e) {
        // If parsing fails, use the raw text if it's short, or a generic message
        message += ` - Response: ${responseDataText.substring(0, 200)}...`;
      }
      console.error(`[API Case Status Route] External API error from ${UPDATE_STATUS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, message);
      return NextResponse.json({ message }, { status: externalApiResponse.status });
    }

    // If response is OK, try to parse the text as JSON (expecting the updated case)
    try {
      const updatedCase: ApiCase = JSON.parse(responseDataText);
      // The external API for status update might return the full updated case object.
      // If it only returns a success message or empty body, this parsing will fail.
      // For now, we assume it returns the updated case object.
      return NextResponse.json(updatedCase, { status: 200 });
    } catch (jsonError) {
      console.warn(`[API Case Status Route] Failed to parse JSON response from external API after successful status update for case ${caseId}. Text: ${responseDataText.substring(0,100)}... This might be okay if the API returns empty body on success.`);
      // If the external API returns 200 OK but not valid JSON (e.g., empty or plain text "Success")
      // This could be an acceptable success state for some APIs.
      // For now, we'll return a success message, but the client might need to re-fetch or assume success.
      // Or, if the API is supposed to return the updated object, this is still an issue.
      return NextResponse.json({ message: 'Status updated successfully with external API, but response was not the expected case object.' }, { status: 200 });
    }

  } catch (error)
 {
    console.error(`[API Case Status Route] Internal error during case status update proxy for case ${caseId}:`, error);
    let message = 'Internal server error during case status update proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for case status update (case ${caseId}).` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

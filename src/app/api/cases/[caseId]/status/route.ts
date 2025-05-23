
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

  // This proxy calls the general update endpoint as per user instruction.
  // However, it only sends {case_status: newStatus}, while the external API
  // expects the full case object for this endpoint. This is a likely source of errors
  // from the external API.
  const UPDATE_STATUS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/submissions/update/${caseId}`;

  try {
    console.log(`[API Case Status Route] Proxied PUT request for case ${caseId} to: ${UPDATE_STATUS_ENDPOINT_EXTERNAL} with new status ${newStatus}. Body sent: ${JSON.stringify({ case_status: newStatus })}`);
    const externalApiResponse = await fetch(UPDATE_STATUS_ENDPOINT_EXTERNAL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ case_status: newStatus }), // THIS IS LIKELY INCOMPLETE FOR THE EXTERNAL API
    });

    const responseDataText = await externalApiResponse.text();
    console.log(`[API Case Status Route] External API response text for case ${caseId} update: Status ${externalApiResponse.status}, Body (first 500 chars): ${responseDataText.substring(0, 500)}`);

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

    // If response is OK, try to parse the text as JSON (expecting the updated case wrapper)
    try {
      const responseJson = JSON.parse(responseDataText);
      if (responseJson.status === 'success' && responseJson.case_submission && typeof responseJson.case_submission === 'object') {
        const updatedCase: ApiCase = responseJson.case_submission;
        console.log(`[API Case Status Route] Successfully updated case ${caseId}. External API returned 'success' with case_submission.`);
        return NextResponse.json(updatedCase, { status: 200 });
      } else {
        console.warn(`[API Case Status Route] External API for case ${caseId} returned 200 OK, but the response structure was not the expected {"status": "success", "case_submission": {...}}. Received:`, responseJson);
        return NextResponse.json({ message: 'Status updated successfully with external API, but response was not the expected structure.' }, { status: 200 });
      }
    } catch (jsonError: any) {
      console.error(`[API Case Status Route] Failed to parse JSON response from external API for case ${caseId} after successful status update. Error: ${jsonError.message}. Text: ${responseDataText.substring(0,500)}...`);
      // This indicates the external API returned 200 OK but with non-JSON or malformed JSON content.
      return NextResponse.json({ message: `Status updated successfully with external API, but confirmation response was not valid JSON: ${jsonError.message}` }, { status: 200 });
    }

  } catch (error: any) {
    console.error(`[API Case Status Route] Internal error during case status update proxy for case ${caseId}:`, error);
    let message = 'Internal server error during case status update proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for case status update (case ${caseId}).` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

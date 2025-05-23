
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ApiCase } from '@/types/medibill';

// Hardcoded value for testing
const EXTERNAL_API_BASE_URL = "https://api.medibill.co.za/api/v1";

interface CaseUpdateParams {
  params: { caseId: string };
}

export async function PUT(request: NextRequest, { params }: CaseUpdateParams) {
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

  // Corrected endpoint
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

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok) {
      console.error(`[API Case Update Route] External API error from ${UPDATE_CASE_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, responseData);
      return NextResponse.json(
        { message: responseData.message || responseData.detail || `External API error updating case: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error(`[API Case Update Route] Internal error during case update proxy for case ${caseId}:`, error);
    let message = 'Internal server error during case update proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for case update (case ${caseId}).` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

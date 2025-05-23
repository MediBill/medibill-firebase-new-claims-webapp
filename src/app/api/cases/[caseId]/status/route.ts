
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { CaseStatus } from '@/types/medibill';

const EXTERNAL_API_BASE_URL = process.env.NEXT_PUBLIC_MEDIBILL_API_BASE_URL;

interface StatusUpdateParams {
  params: { caseId: string };
}

export async function PUT(request: NextRequest, { params }: StatusUpdateParams) {
  if (!EXTERNAL_API_BASE_URL || !EXTERNAL_API_BASE_URL.startsWith('http')) {
    console.error('[API Case Status Route Error] NEXT_PUBLIC_MEDIBILL_API_BASE_URL is not a valid absolute URL:', EXTERNAL_API_BASE_URL);
    return NextResponse.json({ message: 'Server configuration error: API base URL not set for case status proxy.' }, { status: 500 });
  }
  
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

  const UPDATE_STATUS_ENDPOINT_EXTERNAL = `${EXTERNAL_API_BASE_URL}/cases/${caseId}/status`;

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

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok) {
      console.error(`[API Case Status Route] External API error from ${UPDATE_STATUS_ENDPOINT_EXTERNAL} with status ${externalApiResponse.status}:`, responseData);
      return NextResponse.json(
        { message: responseData.message || responseData.detail || `External API error updating case status: ${externalApiResponse.status}` },
        { status: externalApiResponse.status }
      );
    }
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error(`[API Case Status Route] Internal error during case status update proxy for case ${caseId}:`, error);
    let message = 'Internal server error during case status update proxy.';
    if (error instanceof Error) {
        message = error.message.includes('fetch') ? `Network error or external API unreachable for case status update (case ${caseId}).` : error.message;
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}

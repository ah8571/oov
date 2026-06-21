import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
      return NextResponse.json({ error: 'Support service is not configured' }, { status: 500 });
    }

    const response = await fetch(`${backendUrl}/api/support/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const backendPayload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ error: backendPayload?.error || 'Failed to submit support request' }, { status: response.status });
    }

    return NextResponse.json({ message: 'Support request submitted' }, { status: 201 });
  } catch (error) {
    console.error('Support route error:', error);
    return NextResponse.json({ error: 'Failed to submit support request' }, { status: 500 });
  }
}
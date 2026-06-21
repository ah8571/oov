import { NextRequest, NextResponse } from 'next/server';

import legalContent from '../../../../../shared/legalContent.json';

/**
 * Newsletter subscription endpoint
 * Stores emails in backend database for the waitlist
 */
export async function POST(req: NextRequest) {
  try {
    const { email, source, consentSource, policyVersion } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Forward to backend API to store the email
    const backendUrl = process.env.BACKEND_URL;

    if (!backendUrl) {
      console.error('Missing BACKEND_URL for website API route');
      return NextResponse.json(
        { error: 'Waitlist service is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${backendUrl}/api/newsletter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        source,
        marketingConsent: true,
        consentSource: consentSource || source || 'landing-page',
        policyVersion: policyVersion || legalContent.policyVersion,
        consentTimestamp: new Date().toISOString(),
        userAgent: req.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      })
    });

    const backendPayload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const backendError = backendPayload?.error || 'Waitlist signup failed';
      return NextResponse.json({ error: backendError }, { status: response.status });
    }

    if (backendPayload?.persisted === false) {
      return NextResponse.json(
        { error: 'Waitlist signup was accepted but not persisted. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { message: 'Successfully joined the waitlist' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const TIERS = {
  weekly: { label: 'Weekly', price: '$7.99', credits: 100, period: 'week' },
  monthly: { label: 'Monthly', price: '$19.99', credits: 500, period: 'month' }
} as const;

type TierKey = keyof typeof TIERS;

function SubscribeRedirect() {
  const searchParams = useSearchParams();
  const tier: TierKey = searchParams.get('tier') === 'monthly' ? 'monthly' : 'weekly';
  const code = searchParams.get('code') || '';
  const error = searchParams.get('error') || '';

  useEffect(() => {
    if (error) return; // Don't redirect if there's an error to display

    const params = new URLSearchParams({ tier });
    if (code) params.set('code', code);
    window.location.href = `https://api.oov.digital/api/subscribe/subscribe?${params.toString()}`;
  }, [tier, code, error]);

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold mb-4">Checkout unavailable</h1>
        <p className="text-white/50 mb-2 text-center max-w-md">
          {error === 'invalid_tier' ? 'Invalid subscription tier selected.' :
           error === 'checkout_failed' ? 'Unable to start checkout. Please try again.' :
           error === 'unavailable' ? 'Stripe is not configured on the server.' :
           `Error: ${error}`}
        </p>
        <p className="text-white/30 text-xs mb-6 font-mono">code: {error}</p>
        <a href="/subscribe" className="text-white underline">Try again</a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="animate-pulse text-white/50 text-lg">Redirecting to checkout…</div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <SubscribeRedirect />
    </Suspense>
  );
}

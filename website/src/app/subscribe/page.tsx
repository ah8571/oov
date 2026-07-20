'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const TIERS = {
  weekly: { label: 'Weekly', price: '$X.99', credits: 100, period: 'week' },
  monthly: { label: 'Monthly', price: '$X.99', credits: 500, period: 'month' }
} as const;

type TierKey = keyof typeof TIERS;

function SubscribeForm() {
  const searchParams = useSearchParams();
  const defaultTier: TierKey = searchParams.get('tier') === 'monthly' ? 'monthly' : 'weekly';
  const [tier, setTier] = useState<TierKey>(defaultTier);
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');

  const selected = TIERS[tier];

  const handleSubscribe = () => {
    setError('');

    if (!promoCode.trim()) {
      setError('Enter a promo code to continue.');
      return;
    }

    // Redirect through backend to Stripe checkout with promo code
    const params = new URLSearchParams({ tier, code: promoCode.trim() });
    window.location.href = `https://api.alihelp.tech/api/subscribe/subscribe?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold mb-2">Subscribe to ali</h1>
        <p className="text-white/50 mb-10">Enter your promo code to get started.</p>

        {/* Tier toggle */}
        <div className="flex gap-3 mb-8 justify-center">
          {Object.entries(TIERS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTier(key as TierKey)}
              className={`px-6 py-3 rounded-xl border text-sm font-medium transition ${
                tier === key
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 bg-white/5 text-white/70 hover:border-white/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Plan card */}
        <div className={`bg-white/5 border rounded-xl p-8 mb-6 text-left ${
          tier === 'monthly' ? 'border-white/40' : 'border-white/10'
        }`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm uppercase tracking-wider text-white/50 mb-1">{selected.label}</p>
              <p className="text-4xl font-bold">{selected.price}<span className="text-lg font-normal text-white/50">/{selected.period}</span></p>
            </div>
            {tier === 'monthly' && (
              <span className="bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full">Best value</span>
            )}
          </div>
          <ul className="space-y-2 mb-6">
            <li className="text-white/70 text-sm">• {selected.credits} credits/{selected.period}</li>
            <li className="text-white/70 text-sm">• Unused credits roll over</li>
            <li className="text-white/70 text-sm">• Cancel anytime</li>
          </ul>

          {/* Promo code */}
          <div className="mb-4">
            <label className="block text-sm text-white/50 mb-2">Promo code</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-center text-lg tracking-widest placeholder:text-white/20"
              placeholder="ENTER CODE"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setError(''); }}
              maxLength={30}
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            <p className="text-white/30 text-xs mt-2 text-center">
              Your first {selected.period} is free with a valid promo code
            </p>
          </div>

          <button
            onClick={handleSubscribe}
            className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-white/90 transition"
          >
            Subscribe with promo code
          </button>
        </div>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>}>
      <SubscribeForm />
    </Suspense>
  );
}

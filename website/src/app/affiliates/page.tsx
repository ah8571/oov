'use client';

import { useState } from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.oov.digital';

export default function AffiliatesPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', email: '', agreed: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.agreed) {
      setError('You must agree to the influencer terms.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/promo/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.code, name: form.name, email: form.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />

      {/* Hero */}
      <section className="text-center px-6 py-24 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">oov Affiliate Program</h1>
        <p className="text-white/50 text-lg mb-4">
          Share oov with your audience. They get a free trial, you earn 20% on every renewal.
        </p>
        <p className="text-white/30 text-sm">
          FTC-compliant · Monthly Wise payouts · Your own promo code
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { step: '1', title: 'Pick your code', desc: 'Choose a unique promo code below. We review and activate it within 48 hours.' },
            { step: '2', title: 'Share', desc: 'Tell your audience to use your code at checkout on oov.digital/subscribe.' },
            { step: '3', title: 'Earn 20%', desc: 'You earn 20% of every renewal payment from users who signed up with your code — for as long as they stay subscribed.' }
          ].map((item) => (
            <div key={item.step} className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                {item.step}
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Apply form */}
        <div id="apply" className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center">Apply</h2>
          <p className="text-white/40 text-sm text-center mb-8">
            Pick a promo code, fill out your info, and we'll activate it within 48 hours.
          </p>

          {submitted ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-green-400 text-lg font-semibold mb-2">Application submitted!</p>
              <p className="text-white/50 mb-4">
                We'll review your application and email you when your promo code is active — usually within 48 hours.
              </p>
              <p className="text-white/30 text-sm">
                In the meantime, set up your Wise account at wise.com for payments.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1">Your promo code</label>
                <input
                  required
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30 uppercase"
                  placeholder="e.g. JANEDOE20"
                  maxLength={20}
                  pattern="[A-Z0-9]+"
                  title="Letters and numbers only"
                />
                <p className="text-white/30 text-xs mt-1">Letters and numbers only. You'll be notified when it's active.</p>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Your name / handle</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30"
                  placeholder="Your name or social handle"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Wise email for payments</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30"
                  placeholder="you@example.com"
                />
                <p className="text-white/30 text-xs mt-1">
                  Create a free Wise account at wise.com. Payments are sent within 30 days of receiving consumer purchases.
                </p>
              </div>
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={form.agreed}
                  onChange={e => setForm({ ...form, agreed: e.target.checked })}
                  className="mt-1"
                />
                <label htmlFor="terms" className="text-white/50 text-sm">
                  I agree to the{' '}
                  <a href="/creator" target="_blank" className="text-white underline hover:text-white/80">
                    Influencer & Affiliate Agreement
                  </a>
                  , including FTC disclosure requirements and the 20% commission rate on net subscription revenue.
                </label>
              </div>
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-white/90 transition disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Apply'}
              </button>
            </form>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

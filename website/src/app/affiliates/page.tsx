'use client';

import { useState } from 'react';

export default function AffiliatesPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="text-center px-6 py-24 max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold mb-4">Ali Affiliate Program</h1>
        <p className="text-white/50 text-lg mb-10">
          Share Ali with your audience. They get a free trial, you earn when they stay.
        </p>
        <a href="#apply" className="inline-block bg-white text-black font-semibold rounded-xl px-8 py-4 hover:bg-white/90 transition">
          Apply Now
        </a>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { step: '1', title: 'Apply', desc: 'Fill out the form below. We review applications within 48 hours and send you a unique promo code.' },
            { step: '2', title: 'Share', desc: 'Share your link — alihelp.tech/subscribe — and tell your audience to use your promo code.' },
            { step: '3', title: 'Earn', desc: 'When someone subscribes using your code, they get a free trial and you earn a commission.' }
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

        {/* Benefits */}
        <div className="grid md:grid-cols-2 gap-6 mb-20">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-2">For your audience</h3>
            <ul className="text-white/50 text-sm space-y-2">
              <li>• Free trial week with full access</li>
              <li>• Bonus starter credits</li>
              <li>• Natural voice conversations & bilingual tutor</li>
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-2">For you</h3>
            <ul className="text-white/50 text-sm space-y-2">
              <li>• Commission on every paid subscription</li>
              <li>• Unique promo code to track conversions</li>
              <li>• Dashboard coming soon</li>
            </ul>
          </div>
        </div>

        {/* Apply form */}
        <div id="apply" className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Apply to the program</h2>

          {submitted ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-green-400 text-lg font-semibold mb-2">Thanks! We'll be in touch.</p>
              <p className="text-white/50">We review applications within 48 hours and email your unique promo code.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-8 space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1">Name</label>
                <input required className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Email</label>
                <input required type="email" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30" placeholder="you@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Platform</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30" placeholder="YouTube, TikTok, etc." />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Audience size</label>
                  <input className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30" placeholder="e.g. 5,000" />
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black font-semibold rounded-lg py-3 hover:bg-white/90 transition">
                Apply
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

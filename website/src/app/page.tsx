'use client';

import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />

      <div className="relative z-10 w-full">
        <SiteHeader ctaLabel="Ali" />
      </div>

      {/* Content */}
      <div className="content w-full px-4 pb-20 pt-16 md:pt-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Brand */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Ali — Voice AI for Real Conversations
            </h1>
            <p className="text-white/60 text-lg md:text-xl">
              A voice-first assistant for asking questions, practicing languages, and thinking out loud naturally.
            </p>
          </div>

          {/* Hero */}
          <div className="space-y-4">
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed max-w-2xl mx-auto">
              Talk, learn, and stay organized. Ali listens in real time, responds in natural voices, and captures notes hands-free.
            </p>
            <p className="text-white/60 md:text-lg">
              Bilingual tutor · Voice conversations · Notes & transcription
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 max-w-2xl mx-auto">
            <div className="space-y-2">
              <p className="font-semibold">Live Voice</p>
              <p className="text-white/60 text-sm">Real-time conversations powered by Inworld AI</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Bilingual Tutor</p>
              <p className="text-white/60 text-sm">Practice languages with native-accent switching</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Voice Notes</p>
              <p className="text-white/60 text-sm">Capture thoughts and create notes hands-free</p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3 my-12">
            <p className="text-white/60 text-sm">Get started</p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <a
                href="/subscribe"
                className="inline-block bg-white text-black font-semibold rounded-xl px-8 py-4 hover:bg-white/90 transition"
              >
                Subscribe
              </a>
              <a
                href="/affiliates"
                className="inline-block border border-white/20 text-white font-semibold rounded-xl px-8 py-4 hover:bg-white/5 transition"
              >
                Affiliate Program
              </a>
            </div>
          </div>
                className="px-6 py-2 border border-white/30 rounded-lg text-white/50 cursor-not-allowed disabled:opacity-50"
              >
                App Store
              </button>
              <button 
                disabled
                className="px-6 py-2 border border-white/30 rounded-lg text-white/50 cursor-not-allowed disabled:opacity-50"
              >
                Google Play
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 my-12 text-white/60 text-sm">
            <p>Coming soon</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-20 w-full">
        <SiteFooter />
      </div>
    </main>
  );
}

'use client';

import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />

      <div className="relative z-10 w-full">
        <SiteHeader />
      </div>

      {/* Content */}
      <div className="content w-full px-4 pb-20 pt-16 md:pt-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Brand */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              ali — Voice AI for Real Conversations
            </h1>
            <p className="text-white/60 text-lg md:text-xl">
              A voice-first assistant for asking questions, practicing languages, and thinking out loud naturally.
            </p>
          </div>

          {/* Hero */}
          <div className="space-y-4">
            <p className="text-white/60 md:text-lg">
              Bilingual tutor · Voice conversations · Voice notes · Transcriber · Natural reader
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 max-w-3xl mx-auto">
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
            <div className="space-y-2">
              <p className="font-semibold">Transcriber</p>
              <p className="text-white/60 text-sm">Automatic speech-to-text for any conversation</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Natural Reader</p>
              <p className="text-white/60 text-sm">Listen to articles, notes, and content aloud</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">AI Summary</p>
              <p className="text-white/60 text-sm">Smart summaries of your calls and notes</p>
            </div>
          </div>

          </div>
      </div>

      <div className="relative z-10 mt-20 w-full">
        <SiteFooter />
      </div>
    </main>
  );
}

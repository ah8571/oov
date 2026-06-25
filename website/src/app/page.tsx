'use client';

import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import Waitlist from '../components/Waitlist';

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Video Background (optional - uncomment when you have a video) */}
      {/* <video 
        className="video-background" 
        autoPlay 
        muted 
        loop 
        playsInline
        src="/demo.mp4"
      /> */}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />

      <div className="relative z-10 w-full">
        <SiteHeader ctaHref="#waitlist" ctaLabel="Download" />
      </div>

      {/* Content */}
      <div className="content w-full px-4 pb-20 pt-16 md:pt-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Logo/Brand */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Voice Assistant For Real Conversations
            </h1>
            <p className="text-white/60 text-lg md:text-xl">
              A voice-first assistant for asking questions, practicing conversations, and thinking out loud naturally.
            </p>
          </div>

          {/* Hero Description */}
          <div className="space-y-4">
            <p className="text-xl md:text-2xl text-white/90 leading-relaxed max-w-2xl mx-auto">
              Get instant answers, rehearse important conversations, or talk with an AI assistant that actually listens.
            </p>
            <p className="text-white/60 md:text-lg">
              Built for voice-first help now, with room to grow into calling and texting capabilities over time.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 max-w-2xl mx-auto">
            <div className="space-y-2">
              <p className="font-semibold">AI Powered</p>
              <p className="text-white/60 text-sm">Smart conversations powered by advanced AI</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Voice First</p>
              <p className="text-white/60 text-sm">Natural conversations, no typing required</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Private</p>
              <p className="text-white/60 text-sm">Your conversations stay private & secure</p>
            </div>
          </div>

          {/* Waitlist Signup */}
          <div id="waitlist" className="space-y-4 my-12 scroll-mt-24">
            <div>
              <h2 className="text-2xl font-bold mb-2">Join the Waitlist</h2>
              <p className="text-white/60">Be the first to know when we launch</p>
            </div>
            <Waitlist />
          </div>

          {/* App Download Links (when ready) */}
          <div className="space-y-3 my-12">
            <p className="text-white/60 text-sm">Available Soon</p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button 
                disabled
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

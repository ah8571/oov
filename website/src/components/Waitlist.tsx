'use client';

import { useState } from 'react';
import axios from 'axios';

import legalContent from '../../../shared/legalContent.json';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage('Please enter your email');
      setStatus('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/newsletter', {
        email,
        source: 'landing-page',
        consentSource: 'landing-page',
        policyVersion: legalContent.policyVersion
      });

      setMessage('✓ Thanks for signing up! Check your email for updates.');
      setStatus('success');
      setEmail('');
    } catch (error) {
      const errorMsg = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to join waitlist. Please try again.'
        : 'Failed to join waitlist. Please try again.';
      setMessage(errorMsg);
      setStatus('error');
      console.error('Waitlist signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/15 transition"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Signing up...' : 'Join Waitlist'}
        </button>
        {message && (
          <p className={`text-sm text-center ${status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
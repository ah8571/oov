'use client';

import { useState } from 'react';

type FormStatus = 'idle' | 'success' | 'error';

export default function SupportForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !subject.trim() || !message.trim()) {
      setStatus('error');
      setFeedback('Email, subject, and message are required.');
      return;
    }

    setLoading(true);
    setFeedback('');

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          source: 'website_support'
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setFeedback(payload?.error || 'Unable to send your request right now.');
        return;
      }

      setStatus('success');
      setFeedback('Your message has been sent to support@emmaline.app.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setFeedback('Unable to send your request right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/65">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-white/40"
            placeholder="Your name"
            disabled={loading}
          />
        </label>
        <label className="space-y-2 text-sm text-white/65">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-white/40"
            placeholder="you@example.com"
            disabled={loading}
          />
        </label>
      </div>
      <label className="space-y-2 text-sm text-white/65">
        <span>Subject</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-white/40"
          placeholder="What can we help with?"
          disabled={loading}
        />
      </label>
      <label className="space-y-2 text-sm text-white/65">
        <span>Message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-[180px] w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-white/40"
          placeholder="Describe your issue, deletion request, export request, or policy question."
          disabled={loading}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Sending...' : 'Send support request'}
      </button>

      {feedback ? (
        <p className={`text-sm ${status === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
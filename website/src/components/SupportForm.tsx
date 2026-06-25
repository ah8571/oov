'use client';

import { useState } from 'react';

type FormStatus = 'idle' | 'success' | 'error';

type SupportResponse = {
  emailDelivery?: {
    supportInbox?: { sent?: boolean; reason?: string | null };
    requesterConfirmation?: { sent?: boolean; reason?: string | null };
  };
};

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

      const payload: SupportResponse & { error?: string } = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setFeedback(payload?.error || 'Unable to send your request right now.');
        return;
      }

      setStatus('success');
      setFeedback(
        payload?.emailDelivery?.requesterConfirmation?.sent
          ? 'Support request submitted, please check your email for updates.'
          : 'Support request submitted. We saved your message, but confirmation email is not available right now.'
      );
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
    <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 pb-10 md:p-8 md:pb-12">
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

      <div className="space-y-4 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Sending...' : 'Send support request'}
        </button>

        {feedback ? (
          <div
            className={
              status === 'success'
                ? 'flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100'
                : 'rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200'
            }
          >
            {status === 'success' ? (
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-200">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0L4.29 10.21a1 1 0 011.414-1.414l3.043 3.043 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            ) : null}
            <p>{feedback}</p>
          </div>
        ) : null}
      </div>
    </form>
  );
}
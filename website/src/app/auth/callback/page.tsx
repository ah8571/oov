'use client';

import { useEffect, useState } from 'react';

const APP_CALLBACK_URL = 'oov://auth/callback';

const buildAppRedirectUrl = () => {
  const nextUrl = new URL(APP_CALLBACK_URL);
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  params.forEach((value, key) => {
    nextUrl.searchParams.set(key, value);
  });

  if (hash) {
    const hashParams = new URLSearchParams(hash);

    hashParams.forEach((value, key) => {
      nextUrl.searchParams.set(key, value);
    });
  }

  return nextUrl.toString();
};

export default function AuthCallbackPage() {
  const [appRedirectUrl, setAppRedirectUrl] = useState(APP_CALLBACK_URL);
  const [shouldShowManualButton, setShouldShowManualButton] = useState(false);

  useEffect(() => {
    const nextRedirectUrl = buildAppRedirectUrl();

    setAppRedirectUrl(nextRedirectUrl);
    window.location.replace(nextRedirectUrl);

    const timerId = window.setTimeout(() => {
      setShouldShowManualButton(true);
    }, 1500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-white/40 text-sm">Signing in…</p>
        {shouldShowManualButton ? (
          <a
            href={appRedirectUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
          >
            Open the app
          </a>
        ) : null}
      </div>
    </main>
  );
}
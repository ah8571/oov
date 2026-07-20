'use client';

import { useEffect, useState } from 'react';

const APP_CALLBACK_URL = 'emmaline://auth/callback';

const buildAppRedirectUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const nextUrl = new URL(APP_CALLBACK_URL);

  params.forEach((value, key) => {
    nextUrl.searchParams.set(key, value);
  });

  return nextUrl.toString();
};

export default function AuthCallbackPage() {
  const [appRedirectUrl, setAppRedirectUrl] = useState('');

  useEffect(() => {
    setAppRedirectUrl(buildAppRedirectUrl());
  }, []);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <script
        dangerouslySetInnerHTML={{
          __html: `
            var nextUrl = ${JSON.stringify(appRedirectUrl)};
            if (window.location.hash) {
              nextUrl += window.location.hash;
            }
            var manualOpen = document.getElementById('manual-open');
            if (manualOpen) {
              manualOpen.setAttribute('href', nextUrl);
            }
            window.location.replace(nextUrl);
            window.setTimeout(function () {
              if (manualOpen) {
                manualOpen.style.display = 'inline-flex';
              }
            }, 1500);
          `,
        }}
      />
      <a
        id="manual-open"
        href={appRedirectUrl}
        className="hidden min-h-11 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
      >
        Open ali
      </a>
      <noscript>
        <a href={appRedirectUrl}>Open ali</a>
      </noscript>
    </main>
  );
}
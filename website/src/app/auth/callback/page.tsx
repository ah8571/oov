'use client';

const APP_CALLBACK_URL = 'oov://auth/callback';

const callbackScript = `
  (function () {
    var appUrl = new URL(${JSON.stringify(APP_CALLBACK_URL)});
    var queryParams = new URLSearchParams(window.location.search);
    var hash = window.location.hash && window.location.hash.charAt(0) === '#'
      ? window.location.hash.slice(1)
      : window.location.hash;

    queryParams.forEach(function (value, key) {
      appUrl.searchParams.set(key, value);
    });

    if (hash) {
      var hashParams = new URLSearchParams(hash);

      hashParams.forEach(function (value, key) {
        appUrl.searchParams.set(key, value);
      });
    }

    var nextUrl = appUrl.toString();
    var manualOpen = document.getElementById('manual-open');

    if (manualOpen) {
      manualOpen.setAttribute('href', nextUrl);
    }

    window.location.replace(nextUrl);

    window.setTimeout(function () {
      if (manualOpen) {
        manualOpen.classList.remove('hidden');
        manualOpen.classList.add('inline-flex');
      }
    }, 1500);
  })();
`;

export default function AuthCallbackPage() {

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <script
        dangerouslySetInnerHTML={{
          __html: callbackScript,
        }}
      />
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-white/40 text-sm">Signing in…</p>
        <a
          id="manual-open"
          href={APP_CALLBACK_URL}
          className="hidden min-h-11 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
        >
          Open the app
        </a>
      </div>
    </main>
  );
}
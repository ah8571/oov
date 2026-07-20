import Link from 'next/link';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-[0.16em] text-white uppercase">
          ali
        </Link>

        <div className="flex items-center gap-6 text-sm text-white/65">
          <Link href="/best-ai-phone-assistant" className="hidden transition hover:text-white md:inline-flex">
            Blog
          </Link>
        </div>
      </div>
    </header>
  );
}
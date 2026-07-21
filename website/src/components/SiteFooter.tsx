import Link from 'next/link';

import SocialLinks from './SocialLinks';

const blogLinks = [
  {
    href: '/best-ai-phone-assistant',
    label: 'Best AI Phone Assistants',
  },
  {
    href: '/compare/chatgpt-voice-vs-oov',
    label: 'ChatGPT Voice vs oov',
  },
  {
    href: '/compare/gemini-live-vs-oov',
    label: 'Gemini Live vs oov',
  },
  {
    href: '/compare/call-annie-vs-oov',
    label: 'Call Annie vs oov',
  },
];

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-white/10">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 md:grid-cols-[1.1fr,1fr,0.9fr]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-white/45">oov</p>
          <p className="max-w-md text-sm leading-7 text-white/60">
            A voice-first assistant designed for real conversations, everyday help, and a more expansive calling and texting experience over time.
          </p>
          <SocialLinks />
        </div>

        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-white/45">Blog</p>
          <div className="grid gap-3 text-sm text-white/60">
            {blogLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-white/45">Company</p>
          <div className="grid gap-3 text-sm text-white/60">
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/eula" className="transition hover:text-white">
              EULA
            </Link>
            <Link href="/support" className="transition hover:text-white">
              Support
            </Link>
            <Link href="/affiliates" className="transition hover:text-white">
              Affiliates
            </Link>
          </div>
          <p className="text-sm text-white/35">© 2026 oov. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import SupportForm from '../../components/SupportForm';

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader ctaHref="/#waitlist" ctaLabel="Join Waitlist" />
      <div className="mx-auto max-w-5xl px-4 py-16 pb-28 md:py-24 md:pb-32">
        <div className="grid gap-10 md:grid-cols-[0.95fr,1.05fr] md:items-start">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Support</p>
            <h1 className="text-4xl font-semibold md:text-5xl">Help, privacy, and account requests</h1>
            <p className="text-base leading-8 text-white/70 md:text-lg">
              Use this form to contact ali support about bugs, billing questions, privacy requests, account deletion, or data access requests.
            </p>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-7 text-white/65">
              <p>Support email: support@emmaline.app</p>
              <p>For privacy and account requests, include the email address tied to your Emmaline account.</p>
              <p>For export or access requests, describe the data you need and the account involved.</p>
            </div>
          </div>

          <SupportForm />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
import SiteFooter from '../../../components/SiteFooter';
import SiteHeader from '../../../components/SiteHeader';

type CreatorPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return [{ slug: 'placeholder' }];
}

const formatCreatorName = (slug: string) => {
  const normalizedSlug = String(slug || '').trim();

  if (!normalizedSlug) {
    return 'Your Creator';
  }

  return normalizedSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildPromoCode = (slug: string) => {
  const normalizedCode = String(slug || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

  return normalizedCode || 'CREATOR';
};

export default function CreatorLandingPage({ params }: CreatorPageProps) {
  const creatorName = formatCreatorName(params.slug);
  const promoCode = buildPromoCode(params.slug);

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_32%),linear-gradient(180deg,#050505_0%,#000000_55%,#060606_100%)]" />

      <div className="relative z-10">
        <SiteHeader />

        <section className="px-4 pt-16 pb-10 md:pt-24">
          <div className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-start">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-[0.35em] text-white/55">Creator Invite</p>
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                  Try ali through {creatorName}
                </h1>
                <p className="text-lg md:text-xl text-white/72 max-w-2xl leading-relaxed">
                  A rough draft creator page for voice-first help, conversation practice, and AI support that feels natural on mobile.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/12 bg-white/6 p-5">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Use case</p>
                  <p className="mt-3 text-white/86">Ask questions out loud, think through decisions, and rehearse important conversations.</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/6 p-5">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Creator edit</p>
                  <p className="mt-3 text-white/86">Swap this copy for the creator's audience angle, quote, or short personal recommendation.</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/6 p-5">
                  <p className="text-sm uppercase tracking-[0.25em] text-white/45">Promo placeholder</p>
                  <p className="mt-3 text-white/86">Sample code: <span className="font-semibold text-white">{promoCode}</span></p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/12 bg-white/[0.04] p-6 md:p-8">
                <p className="text-sm uppercase tracking-[0.25em] text-white/45">Template notes</p>
                <div className="mt-4 space-y-3 text-white/72 leading-relaxed">
                  <p>Use this route as the reusable affiliate shell: replace the headline, add creator proof, and later attach the real promo-code system.</p>
                  <p>Source tracking already tags submissions by creator slug, so you can start testing creator-specific pages before deeper affiliate automation exists.</p>
                </div>
              </div>
            </div>

            <div id="early-access" className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 md:p-8 backdrop-blur-sm scroll-mt-24">
              <div className="space-y-3 text-center">
                <p className="text-sm uppercase tracking-[0.25em] text-white/45">Early Access</p>
                <h2 className="text-2xl md:text-3xl font-semibold">Get on the list</h2>
                <p className="text-white/65">
                  This capture form is already wired to mark signups from {creatorName}.
                </p>
              </div>

              <div className="mt-6 text-center">
                <p className="text-white/80">Signup form coming soon.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
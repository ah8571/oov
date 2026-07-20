import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import InlineSources from '@/components/InlineSources';
import SeoArticleLayout from '@/components/SeoArticleLayout';
import {
  consumerCompetitors,
  consumerCompetitorSlugs,
  getConsumerCompetitor,
} from '@/lib/consumerCompetitors';

type ComparisonPageProps = {
  params: {
    slug: string;
  };
};

function getBaseSlug(slug: string) {
  return slug.endsWith('-vs-emmaline') ? slug.slice(0, -'-vs-emmaline'.length) : slug;
}

export function generateStaticParams() {
  return consumerCompetitorSlugs.map((slug) => ({
    slug: `${slug}-vs-emmaline`,
  }));
}

export function generateMetadata({ params }: ComparisonPageProps): Metadata {
  const competitor = getConsumerCompetitor(getBaseSlug(params.slug));

  if (!competitor) {
    return {};
  }

  return {
    title: `${competitor.name} vs ali | AI Phone Assistant Comparison`,
    description: `Compare ${competitor.name} and ali across voice-first experience, assistant identity, and everyday AI phone assistant use cases.`,
    alternates: {
      canonical: `/compare/${params.slug}`,
    },
  };
}

export default function ComparisonPage({ params }: ComparisonPageProps) {
  const competitor = getConsumerCompetitor(getBaseSlug(params.slug));

  if (!competitor) {
    notFound();
  }

  const relatedComparisons = consumerCompetitors
    .filter((entry) => entry.slug !== competitor.slug)
    .slice(0, 3);
  const isCallAnnie = competitor.slug === 'call-annie';

  const toc = [
    { id: 'bottom-line', label: 'Bottom line' },
    { id: 'official-positioning', label: 'Official positioning' },
    ...(isCallAnnie ? [{ id: 'current-status', label: 'Current status' }] : []),
    { id: 'pricing-and-access', label: 'Pricing and access' },
    { id: 'review-signal', label: 'Review signal' },
    { id: 'reddit-signal', label: 'Reddit signal' },
    { id: 'emmaline-difference', label: 'Where ali is different' },
    { id: 'best-fit', label: 'Best fit by user type' },
    { id: 'related-reads', label: 'Related reads' },
  ];

  return (
    <SeoArticleLayout
      eyebrow="Consumer Comparison"
      title={`${competitor.name} vs ali`}
      intro={`This comparison looks at ${competitor.name} through ali's intended lane: a practical AI phone assistant for real conversations, everyday help, and note-friendly voice workflows instead of a generic chatbot experience.`}
      toc={toc}
    >
      <section id="bottom-line" className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">Bottom line</h2>
        <p className="leading-8 text-white/70">
          {competitor.verdict}
          <InlineSources
            sources={[
              ...competitor.officialSources,
              ...competitor.pricingSources,
              ...competitor.reviewSources,
            ]}
          />
        </p>
        <p className="leading-8 text-white/60">{competitor.summary}</p>
      </section>

      <section id="official-positioning" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Official positioning</h2>
        <p className="leading-8 text-white/70">
          {competitor.officialPositioning}
          <InlineSources sources={competitor.officialSources} />
        </p>
      </section>

      {isCallAnnie ? (
        <section id="current-status" className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <h2 className="text-2xl font-semibold md:text-3xl">Current status</h2>
          <p className="leading-8 text-white/70">
            The important thing to keep tight here is what we can actually verify. Call Annie's own site says the AI language-learning app has been discontinued, and the public iOS and Android store links exposed on that homepage did not resolve during this review pass.
            <InlineSources sources={competitor.reviewSources} />
          </p>
          <p className="leading-8 text-white/60">
            That is enough to say the old app is no longer live in the normal consumer-download sense. It is not enough to say why the product was discontinued, so this comparison should stay focused on the clearer question: if someone liked the original call-an-AI idea, why might ali be a better current alternative?
          </p>
        </section>
      ) : null}

      <section id="pricing-and-access" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Pricing and access</h2>
        <p className="leading-8 text-white/70">
          {competitor.pricingSnapshot}
          <InlineSources sources={competitor.pricingSources} />
        </p>
      </section>

      <section id="review-signal" className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">Review signal</h2>
        <p className="leading-8 text-white/70">
          {competitor.reviewSignal}
          <InlineSources sources={competitor.reviewSources} />
        </p>
      </section>

      <section id="reddit-signal" className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">Reddit signal</h2>
        <p className="leading-8 text-white/60">
          {competitor.redditSignal}
          <InlineSources sources={competitor.redditSources} />
        </p>
      </section>

      <section id="emmaline-difference" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Where ali is different</h2>
        <p className="leading-8 text-white/70">{competitor.emmalineAngle}</p>
        <p className="leading-8 text-white/60">
          {isCallAnnie
            ? 'The strongest alternative angle is not that ali recreates a discontinued app one-for-one. It is that ali can keep the low-friction call-first mental model while adding a note-friendly workflow: call in, think out loud, brainstorm in real time, and keep the useful parts through transcripts, call detail, and notes.'
            : 'The part the generic voice products usually skip is the note-friendly workflow. ali can be judged on a tighter loop: call in, think out loud, brainstorm in real time, and keep the useful parts through transcripts, call detail, and notes. That pushes it closer to a practical phone assistant than a broad voice demo or companion chat.'}
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Where {competitor.name} is strong</h2>
          <ul className="mt-4 space-y-3 text-white/70">
            {competitor.strengths.map((strength) => (
              <li key={strength} className="leading-8">
                {strength}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-white/10 p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Why users might still want ali</h2>
          <ul className="mt-4 space-y-3 text-white/70">
            {competitor.limits.map((limit) => (
              <li key={limit} className="leading-8">
                {limit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="best-fit" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Best fit by user type</h2>
        <p className="leading-8 text-white/70">
          {competitor.name} is a stronger fit for {competitor.audience.toLowerCase()} ali is a stronger fit for users who want a more focused AI phone assistant feel, direct phone-style interaction, and note-taking around conversations instead of a broad chat surface or companion product.
        </p>
      </section>

      <section id="related-reads" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">Related reads</h2>
        <p className="mt-4 leading-8 text-white/70">
          If you are comparing consumer AI voice tools, it helps to read the hub page first and then contrast this page against adjacent products in the same search cluster.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/best-ai-phone-assistant" className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white hover:bg-white hover:text-black">
            View all consumer comparisons
          </Link>
          <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white hover:bg-white hover:text-black">
            Visit the homepage
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {relatedComparisons.map((entry) => (
            <Link
              key={entry.slug}
              href={`/compare/${entry.slug}-vs-emmaline`}
              className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]"
            >
              <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
              <p className="mt-2 text-lg font-semibold text-white">{entry.name} vs ali</p>
              <p className="mt-2 text-sm leading-7 text-white/60">{entry.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </SeoArticleLayout>
  );
}
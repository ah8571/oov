import type { Metadata } from 'next';
import Link from 'next/link';

import InlineSources from '@/components/InlineSources';
import SeoArticleLayout from '@/components/SeoArticleLayout';
import { consumerCompetitors } from '@/lib/consumerCompetitors';

export const metadata: Metadata = {
  title: 'Best AI Phone Assistant For Everyday Tasks And Note Taking | ali',
  description:
    'Compare consumer AI phone assistant alternatives for everyday help, voice conversations, and note taking, including ali, ChatGPT Voice, Gemini Live, Replika, Pi, Character.AI, and Call Annie.',
  alternates: {
    canonical: '/best-ai-phone-assistant',
  },
};

const comparisonSlugs = new Set([
  'chatgpt-voice',
  'gemini-live',
  'replika',
  'pi',
  'character-ai',
  'call-annie',
]);

export default function BestAiPhoneAssistantPage() {
  const toc = [
    { id: 'methodology', label: 'What this guide compares' },
    { id: 'platforms', label: 'Platforms compared in this guide' },
    { id: 'why-emmaline', label: 'Why ali can still stand out' },
    { id: 'cluster', label: 'Continue this cluster' },
  ];

  return (
    <SeoArticleLayout
      eyebrow="Consumer AI Phone Assistant Guide"
      title="Best AI Phone Assistant For Everyday Tasks And Note Taking"
      intro="This guide compares consumer-facing AI voice products through the lens ali cares about most: natural conversations, everyday assistance, and whether the product actually feels like a phone assistant instead of a chatbot with a microphone icon."
      toc={toc}
    >
      <section id="methodology" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">What this page is comparing</h2>
        <p className="text-base leading-8 text-white/70 md:text-lg">
          Many products in this category are really general voice assistants, AI companions, or entertainment experiences. This guide tries to separate those lanes instead of flattening them into one giant list.
        </p>
        <p className="text-base leading-8 text-white/60 md:text-lg">
          The review pass behind this page used live landing pages, pricing pages where available, Trustpilot footprints, and Reddit search/review threads. That matters because a lot of the older AI comparison content in this space is already stale.
        </p>
      </section>

      <section id="platforms" className="space-y-6">
        <h2 className="text-2xl font-semibold md:text-3xl">Platforms compared in this guide</h2>
        <div className="grid gap-6">
          {consumerCompetitors.map((competitor) => {
            const comparisonHref = comparisonSlugs.has(competitor.slug)
              ? `/compare/${competitor.slug}-vs-emmaline`
              : undefined;

            return (
              <article key={competitor.slug} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-white/45">{competitor.category}</p>
                    <h3 className="mt-2 text-2xl font-semibold">{competitor.name}</h3>
                  </div>

                  <p className="leading-8 text-white/70">{competitor.summary}</p>
                  <p className="leading-8 text-white/60">
                    {competitor.officialPositioning}
                    <InlineSources sources={competitor.officialSources} />
                  </p>
                  <p className="leading-8 text-white/60">
                    {competitor.pricingSnapshot}
                    <InlineSources sources={competitor.pricingSources} />
                  </p>
                  <p className="leading-8 text-white/60">
                    Review signal: {competitor.reviewSignal}
                    <InlineSources sources={competitor.reviewSources} />
                  </p>
                  <p className="leading-8 text-white/60">
                    Reddit signal: {competitor.redditSignal}
                    <InlineSources sources={competitor.redditSources} />
                  </p>
                  <p className="leading-8 text-white/60">Best fit: {competitor.audience}</p>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {comparisonHref ? (
                      <Link href={comparisonHref} className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white hover:bg-white hover:text-black">
                        Read {competitor.name} vs ali
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="why-emmaline" className="space-y-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Why ali can still be differentiated</h2>
        <p className="text-base leading-8 text-white/70 md:text-lg">
          The opportunity is not to out-generalize ChatGPT or out-ecosystem Google. The opportunity is to feel more dedicated: a voice-first assistant with a phone-native experience, a clearer identity, and note-friendly workflows that turn spoken thought into something usable.
        </p>
        <p className="text-base leading-8 text-white/60 md:text-lg">
          That is why the comparison angle matters. A lot of the current market is optimized for breadth, companionship, or entertainment. ali can still occupy a sharper position around calling, brainstorming, transcripts, and conversation-driven note capture.
        </p>
      </section>

      <section id="cluster" className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">Continue this cluster</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/compare/chatgpt-voice-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">ChatGPT Voice vs ali</p>
          </Link>
          <Link href="/compare/gemini-live-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">Gemini Live vs ali</p>
          </Link>
          <Link href="/compare/replika-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">Replika vs ali</p>
          </Link>
          <Link href="/compare/pi-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">Pi vs ali</p>
          </Link>
          <Link href="/compare/character-ai-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">Character.AI Voice vs ali</p>
          </Link>
          <Link href="/compare/call-annie-vs-emmaline" className="rounded-2xl border border-white/10 p-4 transition hover:border-white/30 hover:bg-white/[0.04]">
            <p className="text-sm uppercase tracking-[0.16em] text-white/45">Comparison</p>
            <p className="mt-2 text-lg font-semibold text-white">Call Annie vs ali</p>
          </Link>
        </div>
      </section>
    </SeoArticleLayout>
  );
}
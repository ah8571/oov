import legalContent from '../../../shared/legalContent.json';

type DocumentKey = 'privacyPolicy' | 'termsOfService';

type LegalPageProps = {
  documentKey: DocumentKey;
};

export default function LegalPage({ documentKey }: LegalPageProps) {
  const document = legalContent[documentKey];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Emmaline legal</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-5xl">{document.title}</h1>
          <p className="mt-4 text-sm text-white/45">Last updated {document.lastUpdated}</p>
        </div>

        <div className="mt-10 space-y-6">
          {document.intro.map((paragraph) => (
            <p key={paragraph} className="text-base leading-8 text-white/80 md:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-12 space-y-10">
          {document.sections.map((section) => (
            <section key={section.title} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              {(section.body || []).map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-white/70 md:text-base">
                  {paragraph}
                </p>
              ))}
              {(section.bullets || []).length ? (
                <div className="space-y-3">
                  {(section.bullets || []).map((bullet) => (
                    <div key={bullet} className="flex gap-3 text-sm leading-7 text-white/70 md:text-base">
                      <span className="text-white">•</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
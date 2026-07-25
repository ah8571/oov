export default function CreatorAgreementPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold mb-2">Influencer & Affiliate Agreement</h1>
        <p className="text-white/40 text-sm mb-10">
          Planting Moon LLC (DBA Oov) · Casper, Wyoming · support@oov.digital
        </p>

        <div className="space-y-10 text-white/70 leading-relaxed text-sm">

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">1. FTC Disclosure Requirements</h2>
            <p className="mb-3">You must comply with FTC Endorsement Guidelines (16 CFR Part 255). These rules exist to prevent consumer deception.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use "Sponsored", "Ad", "Paid partnership", or "Ambassador" — the clearest labels.</li>
              <li>Disclosures must be visible without clicking "more" — not buried in hashtags or after a fold.</li>
              <li>Audio/video endorsements: state the relationship verbally at the beginning and in writing at the beginning of the description.</li>
              <li>Use platform-native paid partnership labels (TikTok, Instagram, YouTube) plus disclosure in your caption.</li>
              <li>Affiliate links require disclosure near the link: "paid link" or "I earn a commission."</li>
              <li>You must have actually used the product. Honest reviews only. Use your own words — we cannot script your endorsement.</li>
              <li>Claims must be accurate and substantiated.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">2. Commission Terms</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Commission rate: 20% of net subscription revenue from referred users.</li>
              <li>Payouts monthly via Wise (USD). You are responsible for transfer fees.</li>
              <li>Commission earned only on paid renewals — free trials and cancellations generate nothing.</li>
              <li>You earn on all renewals from users who first subscribed with your code.</li>
              <li>Company may discontinue a promo code with 3 days' notice. Good-faith, FTC-compliant affiliates keep existing commissions.</li>
              <li>FTC violations: Company may cancel future commissions from all users of the code.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">3. Termination</h2>
            <p>
              FTC disclosure violations constitute material breach. Company may terminate immediately, deactivate codes, and withhold pending commissions as liquidated damages.
            </p>
          </section>

          <section>
            <h2 className="text-white text-lg font-semibold mb-3">4. General</h2>
            <p>You are an independent contractor. Wyoming law governs. Agreement active upon your signature. Notice of termination via email, DM, letter, or otherwise.</p>
          </section>

        </div>

        <p className="text-white/30 text-xs mt-12">
          Full guidelines:{' '}
          <a href="https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers" className="underline hover:text-white/50">
            FTC Disclosures 101 for Social Media Influencers
          </a>
        </p>
      </section>
    </main>
  );
}

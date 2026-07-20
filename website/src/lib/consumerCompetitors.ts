export type ConsumerCompetitor = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  audience: string;
  officialPositioning: string;
  officialSources: Array<{
    label: string;
    href: string;
  }>;
  pricingSnapshot: string;
  pricingSources: Array<{
    label: string;
    href: string;
  }>;
  reviewSignal: string;
  reviewSources: Array<{
    label: string;
    href: string;
  }>;
  redditSignal: string;
  redditSources: Array<{
    label: string;
    href: string;
  }>;
  verdict: string;
  strengths: string[];
  limits: string[];
  emmalineAngle: string;
  reviewTitle?: string;
  reviewSummary?: string;
};

export const consumerCompetitors: ConsumerCompetitor[] = [
  {
    slug: 'chatgpt-voice',
    name: 'ChatGPT Voice',
    category: 'General-purpose voice AI assistant',
    summary:
      'A broad mainstream voice AI that combines real-time conversation with search, files, brainstorming, and general-purpose productivity features.',
    audience:
      'People who want a flexible, general assistant that can handle many question types in one interface.',
    officialPositioning:
      'OpenAI positions ChatGPT as a place to write, brainstorm, summarize meetings, explore ideas, and start a real-time voice conversation from the mobile app.',
    officialSources: [
      {
        label: 'ChatGPT overview',
        href: 'https://chatgpt.com/overview',
      },
      {
        label: 'ChatGPT pricing',
        href: 'https://chatgpt.com/pricing',
      },
    ],
    pricingSnapshot:
      'ChatGPT currently spans a wide consumer pricing ladder: Free at $0 per month, Go at $8 per month, Plus at $20 per month, and Pro at $200 per month. Voice is available on every consumer tier, while voice with video starts above Free.',
    pricingSources: [
      {
        label: 'ChatGPT pricing',
        href: 'https://chatgpt.com/pricing',
      },
    ],
    reviewSignal:
      'Third-party consumer reviews around OpenAI skew negative and frequently focus on subscription expectations, billing friction, and dissatisfaction with product behavior. That is noisy evidence, but it still matters if you are comparison-shopping for a dependable everyday voice tool.',
    reviewSources: [
      {
        label: 'Trustpilot',
        href: 'https://www.trustpilot.com/review/openai.com',
      },
    ],
    redditSignal:
      'Reddit discussion around ChatGPT Voice is usually strongest on speech recognition, brainstorming, and convenience. The recurring complaints are interruptions, generic replies, and a feeling that the conversation can flatten out once users want a more persistent assistant relationship.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=ChatGPT%20Voice%20review',
      },
    ],
    verdict:
      'ChatGPT Voice is the safest pick if you want the broadest all-purpose AI surface area. It is less compelling if what you actually want is a phone-native assistant identity instead of a very large general AI product.',
    strengths: [
      'Strong breadth across voice, search, files, and general Q&A',
      'Good for brainstorming and quick spoken problem solving',
      'Clear plan structure and broad consumer familiarity',
    ],
    limits: [
      'Not built around a dedicated phone-number or call-first workflow',
      'Breadth can make it feel less purpose-built for recurring phone-style routines',
      'More like a universal AI app than a durable assistant identity',
    ],
    emmalineAngle:
      'ali can differentiate by narrowing the workflow: call the assistant, think out loud, capture useful notes, and make the interaction feel closer to a dedicated phone assistant than a general AI app.',
  },
  {
    slug: 'gemini-live',
    name: 'Gemini Live',
    category: 'Voice AI assistant tied to the Google ecosystem',
    summary:
      'A live multimodal assistant for users who want voice conversation tied closely to Google services and device-level context.',
    audience:
      'People already comfortable with Google products who want a voice interface for everyday help.',
    officialPositioning:
      'Google frames Gemini Live as a spoken assistant for brainstorming, organizing thoughts, and getting real-time spoken responses, with support for camera sharing and screen sharing.',
    officialSources: [
      {
        label: 'Gemini Live overview',
        href: 'https://gemini.google/overview/gemini-live/',
      },
      {
        label: 'Google AI plans',
        href: 'https://one.google.com/about/ai-premium/',
      },
    ],
    pricingSnapshot:
      'Google AI plans currently list AI Plus at $7.99 per month, AI Pro at $19.99 per month, and AI Ultra at $249.99 per month. Google also says Gemini Live is available to mobile users in more than 45 languages and 150 countries.',
    pricingSources: [
      {
        label: 'Google AI plans',
        href: 'https://one.google.com/about/ai-premium/',
      },
      {
        label: 'Gemini Live overview',
        href: 'https://gemini.google/overview/gemini-live/',
      },
    ],
    reviewSignal:
      'Trustpilot sentiment is heavily negative, with many reviews focusing on hallucinations, missed instructions, interruptions, and frustration with paid-plan value. That does not erase Gemini Live\'s strengths, but it is a real signal for consumers comparing day-to-day reliability.',
    reviewSources: [
      {
        label: 'Trustpilot',
        href: 'https://www.trustpilot.com/review/gemini.google.com',
      },
    ],
    redditSignal:
      'Reddit discussion is more mixed than the Trustpilot picture. Users often praise Gemini Live\'s natural voice flow and multimodal context, but the complaints still cluster around interruptions, uneven quality, and hype outrunning the actual experience.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=Gemini%20Live%20review',
      },
    ],
    verdict:
      'Gemini Live is strongest if you already live in Google\'s ecosystem and want multimodal help. It is weaker if you want a simpler assistant identity built around calling, note capture, and a less sprawling product surface.',
    strengths: [
      'Strong ecosystem fit for Google-heavy users',
      'Live voice plus screen and camera context',
      'Large consumer reach and global availability',
    ],
    limits: [
      'Less room for a standalone assistant identity outside Google\'s stack',
      'Not positioned around a dedicated AI phone number or call ritual',
      'Still feels closer to an ecosystem layer than a focused phone companion',
    ],
    emmalineAngle:
      'ali can position itself as a cleaner, call-first alternative for users who want conversation capture and a dedicated assistant relationship instead of another broad platform surface.',
  },
  {
    slug: 'replika',
    name: 'Replika',
    category: 'AI companion with voice chat',
    summary:
      'A companion-oriented product centered on emotional connection, recurring chat, and relationship-style interaction rather than assistant utility.',
    audience:
      'Users looking for companionship and a more relational AI experience.',
    officialPositioning:
      'Replika explicitly sells itself as "the AI companion who cares" and highlights relationship exploration, video calls, AR experiences, coaching, memory, and diary features.',
    officialSources: [
      {
        label: 'Replika official site',
        href: 'https://replika.com/',
      },
    ],
    pricingSnapshot:
      'I did not find a clear public pricing page during this pass. From a comparison perspective, that means Replika is easier to understand emotionally than financially unless you go deeper into signup or app-store flows.',
    pricingSources: [
      {
        label: 'Replika official site',
        href: 'https://replika.com/',
      },
    ],
    reviewSignal:
      'Trustpilot lands in a more mixed zone than most of the other consumer AI products reviewed here. The recurring positives are companionship and emotional support; the recurring negatives are memory issues, repetitive conversations, billing complaints, and support frustration.',
    reviewSources: [
      {
        label: 'Trustpilot',
        href: 'https://www.trustpilot.com/review/replika.com',
      },
    ],
    redditSignal:
      'Reddit discussion usually treats Replika as a companion first. Users praise personalization and emotional support, but long-running complaints still circle around memory quality, update volatility, and privacy or safety boundaries.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=Replika%20review',
      },
    ],
    verdict:
      'Replika is compelling if you want a digital companion. It is a weaker fit if you want a practical phone assistant for thinking out loud, capturing notes, and handling everyday voice workflows.',
    strengths: [
      'Clear companion identity and emotional use case',
      'Designed for recurring personal conversation',
      'Voice, AR, and video features support ongoing interaction',
    ],
    limits: [
      'Less focused on note-taking or phone-assistant workflows',
      'Utility is secondary to relationship framing',
      'Companion positioning will not fit users seeking a lighter executive-assistant feel',
    ],
    emmalineAngle:
      'ali can stay grounded in practical voice work: call in, rehearse, brainstorm, capture notes, and leave with something useful instead of only nurturing the relationship itself.',
  },
  {
    slug: 'pi',
    name: 'Pi',
    category: 'Conversational AI companion',
    summary:
      'A warm, conversational AI companion that leans into emotional tone, reflection, and low-friction support instead of heavy-duty assistant workflows.',
    audience:
      'Users who want thoughtful conversation and a friendly, accessible assistant tone.',
    officialPositioning:
      'Pi calls itself "the first emotionally intelligent AI" and "your personal AI," with example prompts around talking things out, reflection, curiosity, and lightweight decision support.',
    officialSources: [
      {
        label: 'Pi official site',
        href: 'https://pi.ai/',
      },
      {
        label: 'Pi discover',
        href: 'https://pi.ai/discover',
      },
    ],
    pricingSnapshot:
      'I did not see public consumer pricing on the landing pages reviewed here. That makes Pi feel more like a product you try first and compare later, not a transparently priced assistant you can evaluate side by side from the outside.',
    pricingSources: [
      {
        label: 'Pi official site',
        href: 'https://pi.ai/',
      },
    ],
    reviewSignal:
      'Pi\'s review footprint is smaller than Replika\'s or ChatGPT\'s, but the pattern is still visible: users like the supportive tone, while negative reviews point to shallow analysis, support or billing issues, and an overly reassuring style that can feel artificial.',
    reviewSources: [
      {
        label: 'Trustpilot',
        href: 'https://www.trustpilot.com/review/pi.ai',
      },
    ],
    redditSignal:
      'Reddit conversation usually likes Pi for calmness and a friend-like tone. The tradeoff is that many users stop trusting it once the conversation needs depth, sharper reasoning, or something that behaves like a real assistant instead of an encouraging companion.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=Pi%20AI%20review',
      },
    ],
    verdict:
      'Pi is attractive if you want a gentle conversational companion. It is less persuasive for users who need a durable phone workflow with transcripts, notes, and more task-oriented follow-through.',
    strengths: [
      'Approachable tone and low-friction conversation',
      'Strong emotional positioning for casual check-ins',
      'Easy to understand from a consumer point of view',
    ],
    limits: [
      'Not clearly built around call workflows or note capture',
      'Less associated with a dedicated phone-number model',
      'Can feel emotionally fluent before it feels operationally useful',
    ],
    emmalineAngle:
      'ali can compete by treating the phone call as the product center: real-time conversation in, structured notes and assistant continuity out.',
  },
  {
    slug: 'character-ai',
    name: 'Character.AI Voice',
    category: 'Voice conversation built around AI characters',
    summary:
      'A character-driven voice experience built more for entertainment, roleplay, and expressive personalities than for grounded assistant utility.',
    audience:
      'Users looking for playful, expressive, or character-based AI conversations.',
    officialPositioning:
      'Character.AI\'s public landing page is heavily sign-up gated and leads with access to "10M+ Characters," which makes the entertainment and character layer more visible than any assistant framing.',
    officialSources: [
      {
        label: 'Character.AI official site',
        href: 'https://character.ai/',
      },
    ],
    pricingSnapshot:
      'I did not find a stable public pricing page during this pass. The public site is mostly a sign-up gate, which makes plan comparison harder before you create an account.',
    pricingSources: [
      {
        label: 'Character.AI official site',
        href: 'https://character.ai/',
      },
    ],
    reviewSignal:
      'Trustpilot sentiment is sharply negative, with recurring complaints around age verification, ads or paywalls, limits, filters, and a sense that product quality has degraded over time.',
    reviewSources: [
      {
        label: 'Trustpilot',
        href: 'https://www.trustpilot.com/review/character.ai',
      },
    ],
    redditSignal:
      'Reddit commentary around voice is mixed to negative. Some users like the immersion, but many complaints focus on robotic delivery, narration quirks, and restrictions that make it feel less natural than the entertainment promise suggests.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=Character.AI%20voice%20review',
      },
    ],
    verdict:
      'Character.AI Voice is a fit if you want expressive characters and entertainment. It is not the strongest lane if you want an AI phone assistant for grounded daily conversations and useful post-call notes.',
    strengths: [
      'Strong personality and entertainment angle',
      'Easy to understand as a character-based product',
      'Good fit for playful or roleplay-heavy consumer use cases',
    ],
    limits: [
      'Less practical for grounded assistant tasks',
      'Not naturally positioned as a phone assistant',
      'Entertainment framing weakens its fit for real-world conversation help',
    ],
    emmalineAngle:
      'ali can own the grounded lane: real conversations, note capture, and everyday help without turning the assistant into a character marketplace.',
  },
  {
    slug: 'call-annie',
    name: 'Call Annie',
    category: 'Phone-style AI conversation experience',
    summary:
      'A historically relevant reference point for people who wanted to call an AI, but the current official product story is much narrower and less current than many people assume.',
    audience:
      'Users who want an AI phone-call experience rather than a standard chat app.',
    officialPositioning:
      'The current Call Annie site frames the product as a language-learning app with video-call AI tutors, pronunciation checks, and vocabulary growth, and it explicitly says the app has been discontinued.',
    officialSources: [
      {
        label: 'Call Annie official site',
        href: 'https://callannie.ai/',
      },
    ],
    pricingSnapshot:
      'I did not see an active consumer pricing flow on the current site. The homepage still exposes App Store and Google Play download links, but the linked App Store and Play pages returned 404 during this review pass, which is consistent with the idea that the old app distribution is no longer live.',
    pricingSources: [
      {
        label: 'Call Annie official site',
        href: 'https://callannie.ai/',
      },
      {
        label: 'App Store link',
        href: 'https://apps.apple.com/app/id6447928709',
      },
      {
        label: 'Google Play link',
        href: 'https://play.google.com/store/apps/details?id=ai.animato.callannie',
      },
    ],
    reviewSignal:
      'The strongest current signal is not a review score. It is the official-site change itself plus the broken store trail: what many users remember as a call-an-AI reference point now appears as a discontinued language-learning product, and the public iOS and Android store links no longer resolved in this review pass.',
    reviewSources: [
      {
        label: 'Call Annie official site',
        href: 'https://callannie.ai/',
      },
      {
        label: 'App Store link',
        href: 'https://apps.apple.com/app/id6447928709',
      },
      {
        label: 'Google Play link',
        href: 'https://play.google.com/store/apps/details?id=ai.animato.callannie',
      },
    ],
    redditSignal:
      'Reddit signal is sparse and mostly historical. The most relevant discussions still treat Call Annie as an older example of voice-to-voice AI rather than a current mainstream consumer assistant you would build around today.',
    redditSources: [
      {
        label: 'Reddit search',
        href: 'https://www.reddit.com/search/?q=Call%20Annie%20review',
      },
    ],
    verdict:
      'Call Annie still matters because it clarified the category for searchers. But as a current recommendation, it now looks more like a historical reference point than the best active consumer option.',
    strengths: [
      'Strong relevance to AI phone-call search intent',
      'Simple mental model: call an AI and talk',
      'Historically closer to ali\'s category than most chat-first products',
    ],
    limits: [
      'The current official positioning is narrower and discontinuity is explicit',
      'Category awareness is now stronger than product continuity',
      'Hard to recommend as a long-term assistant foundation today',
    ],
    emmalineAngle:
      'ali can position itself as the modern follow-on for users who still want the simple call-an-AI feeling, but need a product that is current, note-friendly, and built to grow.',
    reviewTitle: 'Call Annie Review: What To Look For In An AI Phone Assistant Alternative',
    reviewSummary:
      'A review page for people who remember Call Annie and need a current read on what the official product looks like now.',
  },
];

export const consumerCompetitorSlugs = consumerCompetitors.map(
  (competitor) => competitor.slug,
);

export function getConsumerCompetitor(slug: string) {
  return consumerCompetitors.find((competitor) => competitor.slug === slug);
}
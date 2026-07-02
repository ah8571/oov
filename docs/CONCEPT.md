# Emmaline Concept

## Overview

App Name: Emmaline: Your AI Assistant

Emmaline can transcribe, take notes, read document, teach you a language

Emmaline is a hands-free, voice-first AI assistant for real-time conversations, instant answers, note taking, transcriptions, reading documents out loud with more features to come. The first version centers on the in-app voice experience, with future room to expand into calling and texting capabilities when those channels are ready to be productized.




---

## Roadmap & Development Phases


### Table of Contents
1. [Current Status Snapshot](#current-status-snapshot)
2. [Phase 1: Publishable MVP with Cloud Infrastructure](#phase-1-publishable-mvp-with-cloud-infrastructure)
2. [Phase 2: OpenClaw Integration + Enhanced Privacy](#phase-2-openclaw-integration--enhanced-privacy)
3. [Phase 3: Completely Local & Private](#phase-3-completely-local--private)

---


### The Value Proposition
- **Hands-free interaction**: No need to text or type—just call and talk
- **True multitasking**: Engage with AI while fully focused on other tasks
- **Persistent knowledge**: Transcripts and summaries are stored and retrievable
- **Minimal friction**: Simple, clean interface for organizing thoughts
- **Skill capabilities, a kind of accessible business assistant layer**: 
- transcriptions
- conversations with AI
- read documents -> create summaries, perhaps even for discussion or flash cards of the material
- study skill (ex. coconote production capabilities with take a source material (say a video but perhaps could be several types), creating a "transcript, summary, flashcards, quizzes" [yuma on medium])
- set a timer [can hover over the screen] / set an alarm
- language teacher 
- receptionist set up (ie an AI voice assistant for small businesses - but how would we set up infrastructure for this if people are also texting... could receive messages like 2nd number)
- document creator like with genspark
- perhaps extensions with openclaw

---

## Phase 1: Publishable MVP with Cloud Infrastructure

**before submitting to app store verify different users accounts only have access to their own in app notes


- Teach you flow, perhaps first screens for new users teach them some of the benefits of the app
- add education as an app category for the app

The cleaner product framing:

In the app: Live Call or Talk Live
Also in the app or on the website: Call or text Emmaline at <number>

## Privacy labeling

Apple App Store (Privacy Nutrition Labels): You must declare "Purchase History" or "Financial Info" under your data collection list. If that event is tied to an advertiser ID (like IDFA) to tie the purchase back to an ad campaign, Apple explicitly defines this as "Data Used to Track You". This requires explicit user opt-in via the App Tracking Transparency (ATT) prompt."

### Information tracked in a conversion
Device and Network Identifiers (The "Who")To match the subscription event back to the user who clicked an ad on TikTok or Meta, the payload must include unique hardware or software fingerprints:Ad IDs: Apple’s IDFA (Identifier for Advertisers) or Google’s GAID (Google Advertising ID).Vendor ID (IDFV): An identifier unique to your app's developer account.IP Address: Used to approximate location and determine the cellular carrier.Customer User ID: The internal database ID you assigned to that user in your app.
Contextual Device Metadata (The "How")Ad networks use these details for deep optimization, behavioral profiling, and fraud prevention:Device Model & OS: e.g., iPhone 15 Pro, iOS 17.4.App Version & SDK Version: Tracks the exact build of your app and the AppsFlyer SDK.Timestamp: Accurate down to the millisecond to match against ad click logs.Language & Locale: e.g., en_US.

## Tracking implementation

On iOS: You must show the App Tracking Transparency (ATT) prompt. If the user clicks "Ask App Not to Track," Apple blocks the IDFA, forcing AppsFlyer and Meta to rely on aggregated, less-accurate tracking methods (like Apple's SKAdNetwork).Privacy Policies: Your privacy policy must explicitly state that you share device identifiers and commercial data with third-party advertising and analytics networks for measurement purposes.

### Phase 1 Publish Blockers


1. Product mode clarity
- [ ] Lock the Phase 1 product into two explicit user-facing modes:
  - Call mode: talk with the AI assistant / note-taking
  - Listen mode: silent transcript / note-taking / summary capture
- [ ] Add a listening / transcription mode as a first-class option in the app
- [ ] Make sure summaries and notes are generated cleanly from both modes

2. Reliability and responsiveness
- [ ] Improve response speed and perceived responsiveness during live calls
- [ ] Tighten transcript streaming reliability and end-of-call save behavior
- [ ] Reduce the number of visible "processing" gaps that make the product feel unfinished
- [ ] Validate a Phase 1 multilingual speech path for basic language-learning use cases:
  - compare Google STT against providers like Deepgram for mixed-language real-time transcription
  - compare current TTS against multilingual-capable options like ElevenLabs for more natural bilingual output

3. Billing and monetization
- [ ] Turn the upgrade / paywall foundation into a real purchasable flow
- [ ] Decide whether RevenueCat, Superwall, or a simpler first-party gating approach is the Phase 1 path
- [ ] Make usage limits understandable to users
- [ ] Track LLM API token usage per call / summary / user so we know when a user needs to pay more
- [ ] Track provider cost vs. billed revenue so we can verify margins are positive

4. Tracking, monitoring, and launch instrumentation
- [ ] Connect the standard launch tooling stack: Resend, PostHog, Sentry
- [ ] Implement attribution and campaign tracking correctly:
  - GTM / UTM on the website
  - app analytics and install attribution in the app itself
- [ ] Track the key funnel events: signup, trial/upgrade intent, call started, call completed, note created
- [ ] Map the model and speech providers we want to test and compare quality vs. cost
  - STT / realtime speech candidates for multilingual handling:
    - Google
    - Deepgram
    - OpenAI Realtime where it simplifies the stack
  - TTS candidates for multilingual output:
    - Google
    - ElevenLabs multilingual models
    - OpenAI audio / realtime voice options where quality or latency is competitive
  - LLM candidates:
    - OpenAI
    - DeepSeek
    - Kimi
    - other low-cost / open-source-compatible providers we connect over time
- [ ] Add a simple quality review loop for model outputs so we can test whether cheaper providers are good enough before routing real users onto them

5. Legal and trust requirements
- [ ] Publish Privacy Policy and Terms of Use
- [ ] Add first-run consent for data processing
- [ ] Implement minimum account-level deletion / export planning for privacy compliance
- [ ] Finish the launch-safe subset of GDPR work before broad distribution

6. Important Phase 1 improvements after the core blockers
- [ ] Text chat with the AI assistant
- [ ] Twilio text registration or SMS-based assistant flow
- [ ] Dedicated personal phone number per user
- [ ] Affiliate link / promo code creation


### Phase 1 Dedicated Personal Number Architecture

- [ ] Define the subscription rule for number ownership:
  - who is eligible for a personal number
  - whether the number is included in plan pricing or billed as an add-on
  - what happens to the number if payment fails or a subscription is cancelled
- [ ] Design the provisioning flow for assigning a number to a user:
  - purchase or assign from Twilio inventory
  - store the number, capability flags, and ownership state on the user account
  - avoid orphaned or duplicate number assignments
- [ ] Define inbound routing behavior for calls and texts to the user's Emmaline number:
  - route into the correct assistant context
  - preserve conversation history and transcript ownership per user
  - support both voice calls and future SMS-based assistant flows
- [ ] Decide the first trust and abuse controls:
  - rate limits
  - who can call or text the number
  - whether unknown callers are allowed, blocked, or filtered
- [ ] Plan the basic lifecycle operations needed for MVP stability:
  - number assignment
  - number release or reassignment
  - temporary suspension
  - support/admin recovery for failed provisioning
- [ ] Decide what minimal in-app UI is needed once the architecture exists:
  - show the user's assigned number
  - explain what the number can be used for
  - provide lightweight status messaging if the number is pending, active, or unavailable



---
## Later concepts

changing interior to 'voice mode' rather than an actual phone so that interior can be used internationally without being an expense

multilingual versions depending on country

Viral design (ex. Coconote) ie building interesting features that are interesting visibly in potential demonstrations

For the emails to fully work after deploy, the backend still needs these env vars:

RESEND_API_KEY
RESEND_FROM_EMAIL
SUPPORT_EMAIL_TO

- API breakdowns (costs / experiences / api key listing)

Potential outlets
- A kind of flexible virtual assistant
- real time interpretor: can be with headphones or speaker
- a text reader
- reading on what are the different gumloop skills available

Learning about: Elsa Speak, Speak and babbel for speech learning; the quantity of talk based language learning apps

Speciality applications
receptionist: could be molded into a receptionist that handles bookings/ sends problems to managers
Lawyer specialization
Ex. Eve - handling a lot of review work, document drafting and intake
Slides/ documentation creation:
Ex. Genspark

perhaps can expand to allow people under 18 to use once privacy policy is updated re COPA compliance

## Phase 2: OpenClaw Integration + Enhanced Privacy

### Phase 2 Goal

Extend the MVP into a more capable assistant without losing the core voice-and-notes workflow.

### Phase 2 Product Expansion

- Dedicated phone number and trusted-caller security model
- Text chat interface alongside calling
- Better conversation memory, topic organization, and search
- Better summarization: action items, sentiment, context, structured outputs
- OpenClaw ecosystem integration
- Email sorting and summarization via voice
- Developer-focused assistant tasks such as code project initiation on the go
- Language-support experiments, including translation or language-teacher flows where speech tooling makes sense


## Phase 3: Completely Local & Private

### Phase 3 Goal

Turn Emmaline from a focused phone companion into a broader assistant platform with local/privacy-first deployment options and specialized product tracks.

### Development Features

- Full on-device AI conversation (no external API calls)
- Local speech-to-text (using open-source models like Whisper)
- Local text-to-speech (using Piper or similar)
- Local LLM for responses (using models like Llama 2, Mistral)
- Entirely self-contained system
- Offline-capable (no internet required after initial setup)

### Phase 3 Product Outlets

These are interesting longer-term assistant directions, but they should be treated as extensions of the core product rather than launch promises.

- Flexible virtual assistant layer for everyday coordination
- Real-time translation workflows
- Receptionist / front-desk mode
  - handle bookings
  - route problems to managers
  - escalate based on business rules
- Specialist assistant tracks built on the same voice / transcript / notes core:
  - Lawyer specialization: review work, document drafting, intake
  - Coder specialization: developer execution and project support
  - Customer support agent: triage, response suggestions, escalation
- Privacy Model: Tier 3 - Completely Local & Private
  - Zero external API calls during conversation
  - All processing happens on user's device or self-hosted backend  
  - No data ever leaves the user's infrastructure
  - Cryptographic verification of model integrity



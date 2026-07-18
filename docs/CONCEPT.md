# Emmaline Concept

## Overview

App Name: Emmaline: Your AI Assistant -> Multitask with AI -> Your AI Workspace

Emmaline can transcribe, take notes, read document, teach you a language

Emphasizing / focusing on open source LLM provider capabilities

Emmaline is a hands-free, voice-first AI assistant for real-time conversations, instant answers, note taking, transcriptions, reading documents out loud with more features to come. The first version centers on the in-app voice experience, with future room to expand into calling and texting capabilities when those channels are ready to be productized.


### Features [with potential extensions]
- **multitasking**: Engage with AI while fully focused on other tasks
- **Persistent knowledge**: Transcripts and summaries are stored
- **Skill capabilities, a kind of accessible business assistant layer**: 
- transcriptions
- conversations with AI
- note taking
- read documents 
### Later
- elevenlabs voice
- set a timer [can hover over the screen] / set an alarm
- text or call your AI assistant from your phone
- study skills: flash card creator, quizzes (ex. coconote production capabilities with take a source material (say a video but perhaps could be several types), creating a "transcript, summary, flashcards, quizzes" [yuma on medium])
- networking skills: start doing more than reading documents or providing transcripts, but can also parse it into different things like flashcards, quizzes, an audio file to listen to, summaries; have the AI assistant 'teach' the person from those materials
- language or general tutor; ex. Elsa Speak, Speak and babbel for speech learning; the quantity of talk based language learning apps
- real time interpretor: can be with headphones or speaker
- document translation
- draft documents
- document creator like with genspark
- background coding agent: speak to AI as it codes in a sandbox
- perhaps extensions with openclaw
- perhaps could be a 'workspace' infused with AI skills, 
- Lawyer specialization; Ex. Eve - handling a lot of review work, document drafting and intake
- Slides/ documentation creation: Ex. Genspark
- research more skills; studying what other ai skills are out there (ex. in openclaw, gumloop etc)
### Separate apps / though potentially all together
- perhaps the app could be customizable which functions you want represented for your use case: perhaps mainly as an AI receptionist + customer support representative
- AI 2nd number - probably a separate app...; like AI receptionist phone; receptionist set up (ie an AI voice assistant for small businesses - but how would we set up infrastructure for this if people are also texting... could receive messages like 2nd number) - most likely a quo alternative;
though TECHNICALLY we could have a seperate tab devoted to inbound calls to a number that AI could answer, though probably worthwhile to create a separate app to carry the functionality because it could get cumbersome
- Customer support integration, perhaps with websites



---

## Roadmap & Development Phases


### Table of Contents

1. [Phase 1: Publishable MVP with Cloud Infrastructure](#phase-1-publishable-mvp)
2. [Phase 2: OpenClaw Integration + Enhanced Privacy](#phase-2-openclaw-integration--enhanced-privacy)
3. [Phase 3: Completely Local & Private](#phase-3-completely-local--private)


---

## Phase 1: Publishable MVP

consider a 'silent text' option in the speaker section but designed with this kind of voice mode screen (ie a kind of transparent overlay screen), where you can type in to chat and the ai responds, so you can see (but we would need to go through the process of integrating the providers )

- perhaps first screens for new users teach them some of the benefits of the app

- confirmation email set up eventually

cleaner product framing:
Also in the app or on the website: Call or text Emmaline at <number>

### Input
Cookieless tracking: Fathom, Plausible or Matomo for inbound tracking
Sentry in app/backend
PostHog for privacy oriented user analytics

### Privacy labeling

By pairing your in-app promo codes (for influencers and affiliates) with SKAN + AppsFlyer (for paid Facebook/TikTok ads), your privacy posture is completely secure.

check to allow people 16 and over and any related privacy policy notice


### Phase 1 Publish Blockers


Design: add sign up flow / consider 'drawing' a kind of icon figure that is the kind of 'app avatar' of an ali that orients users through the app

Verify email architecture works:
the backend still needs these env vars:

RESEND_API_KEY
RESEND_FROM_EMAIL
SUPPORT_EMAIL_TO


2. Reliability and responsiveness
- [ ] Improve response speed and perceived responsiveness during live calls
- [ ] Reduce the number of visible "processing" gaps that make the product feel unfinished
- [ ] Validate a Phase 1 multilingual speech path for basic 

2. language-learning use cases
  - compare Google STT against providers like Deepgram for mixed-language real-time transcription
  - compare current TTS against multilingual-capable options like ElevenLabs for more natural bilingual output
  - perhaps just defer to one language at a time, since it is better for language learning

3. Billing and monetization
- [ ] Make usage limits understandable to users
- [ ] Track LLM API token usage per call / summary / user so we know when a user needs to pay more
- [ ] Track provider cost vs. billed revenue so we can verify margins are positive

4. Tracking, monitoring, and launch instrumentation
- [ ] Connect the standard launch tooling stack: Resend, PostHog; continue to isolate other errors for Sentry
- [ ] Implement attribution and campaign tracking correctly:
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
- [ ] Add quality review loop for model outputs so we can test whether cheaper providers are good enough before routing real users onto them

5. Legal and trust requirements
- [ ] Update Privacy Policy and Terms of Use re things we track

## Phase 2: OpenClaw Integration + Enhanced Privacy

### Phase 2 Goal

Easier than hermes or openclaw: you just sign in to the providers when you want to route things to them

Extend the MVP into a more capable assistant without losing the core voice-and-notes workflow.

### Phase 2 Product Expansion

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
- [ ] Texting capability 
  - Text with the AI assistant
  - Twilio text registration or SMS-based assistant flow
  - Dedicated personal phone number per user
  - Affiliate link / promo code creation


- Dedicated phone number and trusted-caller security model
- Text chat interface alongside calling
- Better conversation memory, topic organization, and search
- Better summarization: action items
- OpenClaw ecosystem integration
- Developer-focused assistant tasks such as code work
- Language-support experiments, including translation or language-teacher


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
- Receptionist / front-desk mode
  - handle bookings
  - route problems to managers
  - escalate based on business rules
- Specialist assistant tracks built on the same voice / transcript / notes core:
  - Lawyer specialization: review work, document drafting, intake
  - Coder specialization: developer execution and project support
  - Customer support agent: triage, response suggestions, escalation




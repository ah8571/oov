# Emmaline Concept

## Overview

App Name: oov -> Reader Transcriber Tutor -> AI Voice Assistant -> Your AI Assistant -> Multitask with AI -> Your AI Workspace

oov can transcribe, take notes, read document, teach you a language

Emphasizing / focusing on open source LLM provider capabilities

oov is a hands-free, voice-first AI assistant for real-time conversations, instant answers, note taking, transcriptions, reading documents out loud with more features to come. a kind of accessible business assistant layer; 


### Features [with potential extensions]
- **multitasking**: Engage with AI while fully focused on other tasks
- **Skill capabilities**: 
- transcriptions
- conversations with AI
- note taking
- read documents 
### Later
- set a timer [perhaps set an alarm]
- text or call your AI assistant from your phone
- study skills: flash card creator, quizzes (ex. coconote / turbo ai) production capabilities with take a source material (say a video but perhaps could be several types), creating a "transcript, summary, flashcards, quizzes" [yuma on medium]
- interlaying skills: start doing more than reading documents or providing transcripts, but can also parse it into different things like flashcards, quizzes, an audio file to listen to, translation, summaries; have the AI assistant 'teach' the person from those materials
- language or general tutor; ex. Elsa Speak, Speak
- perhaps extensions with openclaw: - background coding agent: speak to AI as it codes in a sandbox
### Sub apps:
- real time interpretor: can be with text-based or speaker/ headphones; document translation; could still develop the skill but also direct to another app for ASO
- AI receptionist
- Free 2nd number / w/ AI intake - probably a separate app...; like AI receptionist phone; receptionist set up (ie an AI voice assistant for small businesses - but how would we set up infrastructure for this if people are also texting... could receive messages like 2nd number) - most likely a quo alternative;
### Workspace later
- perhaps could be a 'workspace' infused with AI skills, 
- Lawyer specialization / like an AI legal assistant or legal workstation [could be adapted to other work environments]; Ex. Eve - handling a lot of review work, document drafting and intake
- Slides/ documentation creation: Ex. Genspark



---

## Roadmap & Development Phases


### Table of Contents

1. [Phase 1: Publishable MVP with Cloud Infrastructure](#phase-1-publishable-mvp)
2. [Phase 2: OpenClaw Integration + Enhanced Privacy](#phase-2-openclaw-integration--enhanced-privacy)
3. [Phase 3: Completely Local & Private](#phase-3-completely-local--private)


---

## Phase 1: Publishable MVP

- IAP debugging: 
Added debug_production profile. It builds an APK with the production bundle ID (com.emmaline.app), so RevenueCat and IAP both work. Install it via adb install for local testing. For logcat specifically on this build: since it's a release APK, you won't get full app-level logs. But you can work around that: 
Toast/Alert debugging: add temporary Alert.alert() calls in the IAP flow
RevenueCat dashboard: shows all test purchases in real-time
Google Play Console → Orders: shows test order status
For full adb logcat with app logs, the only option is the development profile, but that has the wrong bundle ID. It's a Google/Android limitation — store-signed builds can't be fully debuggable.
- "Launch" someone into a new note as a new customer
- lightweight / saving directly to device [not seeing this as a turbo ai competitor but just a lightweight skill dashboard] -> make logging in optional / later for syncing if there is a web based version
- recording w/ transcripts, so if someone is trying to do a transcript, it would be nice if someone can record it as well as create a transcript out of it. what do you think that would involve
- Coconote / turbo.ai features: transcribe video links, flash cards, quizzes
- take photos to OCR
- consider a 'silent texting' option as a opposed to voice assistance but still as a transparent overlay so you can minimize the convo and work on other things
- name change migration
[ ] unsubscribe from emmaline.app 
[ ] logins - several apps use support@emmaline.app, need to document [resemble.ai, expo]

### Tracking
Cookieless tracking: Fathom, Plausible or Matomo for inbound tracking
Developing more sentry logs in app/backend
PostHog for privacy oriented user analytics
Ad tracking
- [ ] SKAN + AppsFlyer
- [ ] Implement attribution and campaign tracking correctly:
- [ ] Track key funnel events: signup, trial/upgrade intent, call started, call completed, note created

### API costs
- [ ] Track LLM API token usage per call / summary / user so we know when a user needs to pay more
- [ ] Track provider cost vs. billed revenue so we can verify margins are positive


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



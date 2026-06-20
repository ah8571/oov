# Emmaline Architecture

Phone Integration – Twilio handles millions of calls daily
Real-time Speech-to-Text – Google Cloud, Azure, AssemblyAI all have production-grade APIs
AI Response – OpenAI's API is designed for this (streaming responses work great)
Text-to-Speech – Google Cloud TTS is robust and natural-sounding
Transcription Storage – Supabase/PostgreSQL handles this at scale easily
Mobile Timeline UI – React Native is perfect for this use case

## System Overview

```
                    EXTERNAL SERVICES
                    ┌─────────────────┐
                    │  Twilio Voice   │
                    │  (Phone Calls)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   BACKEND       │
                    │  (Node.js)      │
                    ├─────────────────┤
                    │ • Call Handler  │
                    │ • Orchestration │
                    │ • API Routes    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐         ┌─────▼─────┐         ┌───▼────┐
    │OpenAI  │         │  Google   │         │Supabase│
    │(AI)    │         │Cloud (STT)│         │(DB)    │
    │        │         │(TTS)      │         │        │
    └────────┘         └───────────┘         └────┬───┘
                                                  │
                                         ┌────────▼────────┐
                                         │  MOBILE APP     │
                                         │ (React Native)  │
                                         ├─────────────────┤
                                         │ • Timeline View │
                                         │ • Notes Page    │
                                         │ • Call History  │
                                         └─────────────────┘
```

## Component Architecture

### Backend (Node.js + Express)

**Responsibilities:**
- Handle incoming Twilio calls
- Orchestrate call flow (STT → AI → TTS)
- Manage transcripts and summaries
- Provide REST API to mobile app

**Key Modules:**
- `routes/` – API endpoints (REST)
- `controllers/` – Business logic
- `services/` – External integrations
- `middleware/` – Auth, validation, error handling

**Data Flow on Inbound Call:**
```
Twilio Call Webhook
        ↓
Call Handler (accept/stream)
        ↓
Speech-to-Text (Google Cloud)
        ↓
AI Response (OpenAI)
        ↓
Text-to-Speech (Google Cloud)
        ↓
Stream audio back to caller
        ↓
Save transcript (Supabase)
        ↓
Trigger summarization
        ↓
Save summary (Supabase)
```

### Services (Shared Logic)

Extracted business logic used by both backend and mobile:
- **Transcription Service** – Call transcript formatting
- **Summarization Service** – AI-powered key point extraction
- **AI Service** – Prompt handling and response generation

### Database (Supabase/PostgreSQL)

**Core Tables:**
- `calls` – Call metadata (id, user_id, date, duration, etc.)
- `transcripts` – Full call transcripts
- `summaries` – AI-generated key points
- `notes` – User-created notes from calls

### Mobile (React Native)

**Screens:**
- **Timeline** – All calls, chronological view with one-line summaries
- **Call Detail** – Full transcript and summary for a specific call
- **Notes** – User-organized notes (could be linked to calls)

**Features:**
- View call history
- Search/filter calls
- Create notes from summaries
- Organize notes

---

## Technology Details

### Backend Stack
- **Framework**: Express.js
- **Twilio Integration**: twilio npm package
- **Speech-to-Text**: Google Cloud Speech-to-Text API
- **Text-to-Speech**: Google Cloud Text-to-Speech API
- **AI**: OpenAI API
- **Database**: Supabase (PostgreSQL)
- **Real-time Communication**: Twilio Streams (WebSocket)

### Mobile Stack
- **Framework**: React Native (Expo recommended for MVP)
- **Navigation**: React Navigation
- **State**: Context API or Redux
- **HTTP Client**: Axios or Fetch
- **Database**: SQLite for local caching

### Shared Stack
- **Type Safety**: JSDoc or TypeScript types
- **Utilities**: Common formatters, validators
- **Constants**: App-wide configuration


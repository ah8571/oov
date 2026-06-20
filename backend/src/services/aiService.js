/**
 * AI service for responses and summarization
 */

import { OpenAI } from 'openai';

const SYSTEM_PROMPT = [
  'You are Emmaline, a concise voice-first AI phone assistant.',
  'You help users think out loud, organize ideas, and capture actionable notes.',
  'Respond naturally for spoken conversation, keep replies brief, and ask one focused follow-up when useful.',
  'Use plain conversational text only. Never use markdown, asterisks, bullet symbols, numbered lists, or code fences.'
].join(' ');

let openaiClient = null;

const getOpenAIClient = () => {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
};

const getChatModel = () => process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const getSummaryModel = () => process.env.OPENAI_SUMMARY_MODEL || getChatModel();

const isTeacherLanguagePreference = (languagePreference) => {
  return String(languagePreference || '').toLowerCase().includes('teacher');
};

const getLanguageInstruction = (languagePreference) => {
  if (isTeacherLanguagePreference(languagePreference)) {
    return [
      'You are in English-Spanish teacher mode for beginners.',
      'Default to English for explanations and structure, but provide Spanish examples naturally when asked.',
      'When the user asks how to say something in Spanish, say the Spanish phrase first, then give a short English explanation or translation.',
      'Keep bilingual replies short, clear, and easy to repeat out loud.',
      'Prefer simple Spanish phrasing and gentle coaching over long grammar lectures.'
    ].join(' ');
  }

  return String(languagePreference || '').toLowerCase().startsWith('es')
    ? 'Respond in Spanish.'
    : 'Respond in English.';
};

const getNoteCapabilityInstruction = (options = {}) => {
  if (options.noteAccessEnabled === false) {
    return '';
  }

  const noteContextSummary = String(options.noteContextSummary || '').trim();

  return [
    'You can access the caller\'s saved notes when they ask about notes.',
    'Do not say that you cannot access notes, files, or the notes section if the request is specifically about saved notes.',
    'Be precise: you cannot browse the caller\'s phone UI generally, but you can list saved note titles, read saved notes, and update notes when asked.',
    noteContextSummary ? `Current saved note context: ${noteContextSummary}` : 'Current saved note context: no saved notes are known right now.'
  ].join(' ');
};

const getNoteLanguageInstruction = (languagePreference) => {
  if (isTeacherLanguagePreference(languagePreference)) {
    return 'Write note content in English by default, but preserve short Spanish examples or vocabulary when they are important to the lesson.';
  }

  return String(languagePreference || '').toLowerCase().startsWith('es')
    ? 'Write note content in Spanish.'
    : 'Write note content in English.';
};

const serializeConversationHistory = (conversationHistory = []) => {
  return conversationHistory
    .slice(-12)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : entry.role === 'system' ? 'System' : 'User'}: ${String(entry.content || '').trim()}`)
    .join('\n')
    .trim();
};

export const sanitizeSpokenResponse = (value) => {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[\*_~]/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const extractJsonObject = (content) => {
  const text = String(content || '').trim();

  if (!text) {
    throw new Error('Summary response was empty');
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

  if (!candidate || !candidate.trim().startsWith('{')) {
    throw new Error('Summary response did not contain a JSON object');
  }

  return JSON.parse(candidate);
};

export const generateResponse = async (conversationHistory, options = {}) => {
  const response = await getOpenAIClient().chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT} ${getLanguageInstruction(options.languagePreference)} ${getNoteCapabilityInstruction(options)}`.trim()
      },
      ...conversationHistory
    ],
    temperature: 0.7
  });

  return {
    text: sanitizeSpokenResponse(response.choices[0].message.content?.trim() || ''),
    usage: {
      model: response.model || getChatModel(),
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    }
  };
};

export const summarizeTranscript = async (fullTranscript, options = {}) => {
  const summaryLanguageInstruction = isTeacherLanguagePreference(options.languagePreference)
    ? 'Return the summary, key points, and action items in English by default, while preserving useful Spanish phrases or vocabulary examples from the lesson.'
    : String(options.languagePreference || '').toLowerCase().startsWith('es')
      ? 'Return the summary, key points, and action items in Spanish. Preserve the participant\'s Spanish phrasing where it is natural to do so.'
      : 'Return the summary, key points, and action items in English.';

  const summaryPrompt = `
Please analyze the following conversation and provide:
1. A concise summary (2-3 sentences)
2. Key points (as bullet points)
3. Any action items mentioned
4. Overall sentiment (positive/neutral/negative)

${summaryLanguageInstruction}

Conversation:
${fullTranscript}

Return strict JSON only with keys: summary, keyPoints, actionItems, sentiment. Do not wrap the JSON in markdown or code fences.
`;

  const response = await getOpenAIClient().chat.completions.create({
    model: getSummaryModel(),
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that summarizes conversations. ${summaryLanguageInstruction}`
      },
      {
        role: 'user',
        content: summaryPrompt
      }
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' }
  });

  return {
    ...extractJsonObject(response.choices[0].message.content),
    usage: {
      model: response.model || getSummaryModel(),
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    }
  };
};

export const detectNoteAction = async (conversationHistory, options = {}) => {
  const noteTitles = Array.isArray(options.noteTitles) && options.noteTitles.length > 0
    ? options.noteTitles.join(', ')
    : 'None';
  const prompt = `
You are classifying the latest user utterance in a live voice call.

Only return a note action when the latest user request is explicitly about notes or saving information for later.
Examples that SHOULD trigger: "create a note of that", "add that to my app ideas note", "what notes do I have", "read my startup ideas note", "organize that note".
Questions about whether you can see or access saved notes should also trigger.
Examples: "can you see my notes", "look in the notes section", "do you see the test note", "what are my two notes".
Examples that SHOULD NOT trigger: general brainstorming, planning, summarizing, or any request that does not explicitly mention a note or saving something.

Available existing note titles:
${noteTitles}

Recent conversation:
${serializeConversationHistory(conversationHistory) || 'None'}

Return strict JSON with keys:
- action: one of none, create, update, list, read
- targetNoteTitle: string or null
- newNoteTitle: string or null
- instruction: string or null
- useRecentConversation: boolean
- confidence: number from 0 to 1
`;

  const response = await getOpenAIClient().chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: 'system',
        content: 'You detect explicit note-management requests in a live voice conversation and return strict JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const parsed = extractJsonObject(response.choices[0].message.content);

  return {
    action: parsed.action || 'none',
    targetNoteTitle: parsed.targetNoteTitle || null,
    newNoteTitle: parsed.newNoteTitle || null,
    instruction: parsed.instruction || null,
    useRecentConversation: parsed.useRecentConversation !== false,
    confidence: Number(parsed.confidence || 0),
    usage: {
      model: response.model || getChatModel(),
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    }
  };
};

export const generateStructuredNoteDocument = async (options = {}) => {
  const prompt = `
You are writing a durable working note for Emmaline.

House style for notes:
- Use HTML for storage, not markdown.
- Use semantic tags like <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, and <u>.
- Start with one H1 title line in the content when appropriate.
- Use clear sections.
- If the content contains multiple ideas, use numbered H2 sections.
- Use optional H3 subsections like Details, Audience, and Next Steps when helpful.
- Prefer concise but meaningful paragraphs over long walls of text.
- Do not use markdown markers, tables, or code fences.
- Preserve useful existing information when updating a note.
- Ignore purely procedural commands like "make a note of that" when drafting the note body.

${getNoteLanguageInstruction(options.languagePreference)}

Mode: ${options.mode || 'create'}
Requested title: ${options.preferredTitle || 'Infer an appropriate title'}
Instruction: ${options.userInstruction || 'Create a useful structured note from the discussion.'}

Existing note title:
${options.existingNote?.title || 'None'}

Existing note content:
${options.existingNote?.content || 'None'}

Recent conversation:
${serializeConversationHistory(options.conversationHistory || []) || 'None'}

Return strict JSON only with keys: title, content.
`;

  const response = await getOpenAIClient().chat.completions.create({
    model: getChatModel(),
    messages: [
      {
        role: 'system',
        content: 'You write structured markdown notes for storage and return strict JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const parsed = extractJsonObject(response.choices[0].message.content);

  return {
    title: String(parsed.title || options.preferredTitle || options.existingNote?.title || 'Untitled Note').trim().slice(0, 255),
    content: String(parsed.content || '').trim(),
    usage: {
      model: response.model || getChatModel(),
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    }
  };
};

export default {
  generateResponse,
  summarizeTranscript,
  sanitizeSpokenResponse,
  detectNoteAction,
  generateStructuredNoteDocument
};

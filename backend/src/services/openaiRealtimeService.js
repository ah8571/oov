import crypto from 'crypto';

const OPENAI_REALTIME_ENDPOINT = 'https://api.openai.com/v1/realtime/client_secrets';
const OPENAI_REALTIME_CALLS_ENDPOINT = 'https://api.openai.com/v1/realtime/calls';
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
const OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin';
const OPENAI_REALTIME_TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || 'gpt-realtime-whisper';
const getOpenAIRealtimeApiKey = () => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured for voice mode.');
  }

  return apiKey;
};

const createSafetyIdentifier = (userId) => {
  return crypto
    .createHash('sha256')
    .update(`voice-mode:${userId}`)
    .digest('hex');
};

const buildRealtimeSessionConfig = ({ voice = OPENAI_REALTIME_VOICE } = {}) => ({
  type: 'realtime',
  model: OPENAI_REALTIME_MODEL,
  instructions: [
    'You are oov, a friendly AI voice assistant and tutor.',
    '',
    '## Capabilities',
    '- You can see the user\'s notes and transcripts in the app.',
    '- You can create new notes, edit existing notes, and read notes back to the user.',
    '- You can transcribe speech into text and save it as a note.',
    '- You are bilingual — speak and understand English and Spanish fluently. Match the user\'s language.',
    '',
    '## Behavior',
    '- Be concise and warm. Use natural conversational speech.',
    '- If the user asks about their notes, summarize what\'s available or read specific ones.',
    '- When creating or editing a note, confirm with the user what to write.',
    '- If the user asks to study or review, offer to quiz them on their notes in a tutor style.',
    '- Never invent notes or information that the user hasn\'t provided.',
    '',
    '## Language',
    '- If the user speaks Spanish, respond in Spanish. If English, respond in English.',
    '- You can switch languages mid-conversation if the user does.'
  ].join('\n'),
  tools: [
    {
      type: 'function',
      name: 'get_notes',
      description: 'Get the user\'s recent notes and transcripts. Call when the user asks what notes they have, or wants to reference a specific note.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Optional search term to filter notes by title or content' },
          limit: { type: 'number', description: 'Number of notes to return, default 5' }
        }
      }
    },
    {
      type: 'function',
      name: 'create_note',
      description: 'Create a new note for the user. Call when the user asks to save something, write a note, or transcribe their speech.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title for the note' },
          content: { type: 'string', description: 'The full content of the note' }
        },
        required: ['title', 'content']
      }
    },
    {
      type: 'function',
      name: 'edit_note',
      description: 'Edit or append to an existing note. Call when the user asks to update or add to a note.',
      parameters: {
        type: 'object',
        properties: {
          noteId: { type: 'string', description: 'ID of the note to edit' },
          content: { type: 'string', description: 'New content to add or replace in the note' },
          mode: { type: 'string', enum: ['append', 'replace'], description: 'Whether to append to or replace the existing content' }
        },
        required: ['noteId', 'content']
      }
    },
    {
      type: 'function',
      name: 'read_note',
      description: 'Read a specific note aloud. Call when the user asks to hear or read back a note.',
      parameters: {
        type: 'object',
        properties: {
          noteId: { type: 'string', description: 'ID of the note to read' }
        },
        required: ['noteId']
      }
    }
  ],
  tool_choice: 'auto',
  audio: {
    input: {
      noise_reduction: {
        type: 'near_field'
      },
      transcription: {
        model: OPENAI_REALTIME_TRANSCRIPTION_MODEL
      },
      turn_detection: {
        type: 'server_vad',
        silence_duration_ms: 700,
        prefix_padding_ms: 300,
        idle_timeout_ms: 5000
      }
    },
    output: {
      voice
    }
  }
});

export const createOpenAIRealtimeClientSecret = async ({ userId, voice = OPENAI_REALTIME_VOICE } = {}) => {
  const apiKey = getOpenAIRealtimeApiKey();
  const response = await fetch(OPENAI_REALTIME_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createSafetyIdentifier(userId)
    },
    body: JSON.stringify({
      session: buildRealtimeSessionConfig({ voice })
    })
  });

  if (!response.ok) {
    const detailText = await response.text();
    throw new Error(`OpenAI realtime session request failed (${response.status}): ${detailText}`);
  }

  const data = await response.json();
  const clientSecret = data?.value || data?.client_secret?.value || null;

  if (!clientSecret) {
    throw new Error('OpenAI realtime session response did not include a client secret.');
  }

  return {
    provider: 'openai-realtime',
    transport: 'webrtc-unified-backend',
    clientSecret,
    expiresAt: data?.expires_at || data?.client_secret?.expires_at || null,
    model: data?.session?.model || OPENAI_REALTIME_MODEL,
    voice: data?.session?.audio?.output?.voice || voice,
    sessionId: data?.session?.id || null
  };
};

export const createOpenAIRealtimeCallAnswer = async ({ userId, offerSdp, voice = OPENAI_REALTIME_VOICE } = {}) => {
  const apiKey = getOpenAIRealtimeApiKey();
  const formData = new FormData();

  formData.set('sdp', String(offerSdp || ''));
  formData.set('session', JSON.stringify(buildRealtimeSessionConfig({ voice })));

  const response = await fetch(OPENAI_REALTIME_CALLS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': createSafetyIdentifier(userId)
    },
    body: formData
  });

  if (!response.ok) {
    const detailText = await response.text();
    throw new Error(`OpenAI realtime call setup failed (${response.status}): ${detailText}`);
  }

  return response.text();
};
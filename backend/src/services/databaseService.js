/**
 * Supabase database service
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (value) => {
  const url = String(value || '').trim();

  if (!url) {
    return '';
  }

  return url.replace(/\/rest\/v1\/?$/, '');
};

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const getSupabaseHost = () => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).host : 'missing';
  } catch {
    return 'invalid';
  }
};

let supabase = null;
let supabaseAuth = null;

// Initialize Supabase only if credentials are provided
if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    if (process.env.SUPABASE_URL !== supabaseUrl) {
      console.warn('SUPABASE_URL included /rest/v1; normalizing to project root URL for Supabase client');
    }

    supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    console.log('✓ Supabase client initialized');
  } catch (error) {
    console.error('Failed to initialize Supabase:', error.message);
    supabase = null;
  }
} else {
  console.warn('⚠ Supabase not configured - database features disabled');
}

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    console.log('✓ Supabase auth client initialized');
  } catch (error) {
    console.error('Failed to initialize Supabase auth client:', error.message);
    supabaseAuth = null;
  }
} else {
  console.warn('⚠ Supabase auth client not configured - missing SUPABASE_URL and/or SUPABASE_ANON_KEY (or legacy SUPABASE_KEY)');
}

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return supabase;
};

export const getSupabaseAuthClient = () => {
  if (!supabaseAuth) {
    throw new Error('Supabase auth client not initialized. Missing SUPABASE_URL and/or SUPABASE_ANON_KEY (or legacy SUPABASE_KEY)');
  }
  return supabaseAuth;
};

export const getSupabaseDebugInfo = () => ({
  configured: Boolean(supabaseUrl && supabaseServiceRoleKey),
  authConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  originalUrl: String(process.env.SUPABASE_URL || ''),
  authKeySource: process.env.SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : (process.env.SUPABASE_KEY ? 'SUPABASE_KEY' : 'missing'),
  normalizedUrl: supabaseUrl,
  host: getSupabaseHost(),
  normalizedRestSuffix: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_URL !== supabaseUrl)
});

const normalizePhoneNumberForStorage = (rawValue) => {
  const value = String(rawValue || '').trim();

  if (!value) {
    return 'unknown';
  }

  if (/^\+?[0-9]{1,20}$/.test(value)) {
    return value;
  }

  if (value.startsWith('client:') || value.startsWith('user_')) {
    return 'in-app-voip';
  }

  return value.slice(0, 20);
};

const isMissingCallModeColumnError = (error) => {
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return message.includes('call_mode') && (message.includes('schema cache') || message.includes('column'));
};

export const saveCall = async (userId, callData) => {
  const basePayload = {
    user_id: userId,
    phone_number: normalizePhoneNumberForStorage(callData.phoneNumber),
    call_duration_seconds: callData.duration,
    started_at: callData.startedAt,
    ended_at: callData.endedAt,
    call_status: callData.status,
    twilio_call_sid: callData.twilioCallSid
  };

  let { data, error } = await supabase
    .from('calls')
    .insert({
      ...basePayload,
      call_mode: callData.callMode || 'live_call'
    })
    .select();

  if (error && isMissingCallModeColumnError(error)) {
    console.warn('calls.call_mode is missing from the live schema cache; retrying saveCall without call_mode');
    ({ data, error } = await supabase
      .from('calls')
      .insert(basePayload)
      .select());
  }

  if (error) {
    console.error('Error saving call:', error);
    throw error;
  }

  return data[0];
};

export const saveTranscript = async (callId, userId, fullText) => {
  const { data, error } = await supabase
    .from('transcripts')
    .insert({
      call_id: callId,
      user_id: userId,
      full_text: fullText
    })
    .select();

  if (error) {
    console.error('Error saving transcript:', error);
    throw error;
  }

  return data[0];
};

export const saveCallMessages = async (callId, userId, messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('call_messages')
    .insert(
      messages.map((message, index) => ({
        call_id: callId,
        user_id: userId,
        sequence_number: index + 1,
        speaker: message.speaker,
        content: message.text,
        created_at: message.createdAt || new Date().toISOString()
      }))
    )
    .select();

  if (error) {
    console.error('Error saving call messages:', error);
    throw error;
  }

  return data;
};

export const saveCallCosts = async (callId, userId, costEntries = []) => {
  if (!Array.isArray(costEntries) || costEntries.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('call_costs')
    .insert(
      costEntries.map((entry) => ({
        call_id: callId,
        user_id: userId,
        pricing_tier: entry.pricingTier,
        provider: entry.provider,
        service: entry.service,
        quantity: entry.quantity,
        unit: entry.unit,
        vendor_cost_usd: entry.vendorCostUsd,
        billable_cost_usd: entry.billableCostUsd,
        measurement_source: entry.measurementSource,
        cost_source: entry.costSource,
        metadata: entry.metadata || {}
      }))
    )
    .select();

  if (error) {
    console.error('Error saving call costs:', error);
    throw error;
  }

  return data;
};

export const saveSummary = async (callId, userId, summaryData) => {
  const { data, error } = await supabase
    .from('summaries')
    .insert({
      call_id: callId,
      user_id: userId,
      summary_text: summaryData.text,
      key_points: summaryData.keyPoints,
      sentiment: summaryData.sentiment,
      action_items: summaryData.actionItems
    })
    .select();

  if (error) {
    console.error('Error saving summary:', error);
    throw error;
  }

  return data[0];
};

export const saveReaderAudio = async (userId, readerAudio) => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('reader_saved_audio')
    .insert({
      user_id: userId,
      title: readerAudio.title,
      source_text: readerAudio.sourceText,
      file_name: readerAudio.fileName,
      content_type: readerAudio.contentType,
      audio_base64: readerAudio.audioBase64,
      character_count: readerAudio.characterCount,
      chunk_count: readerAudio.chunkCount,
      language_code: readerAudio.languageCode,
      metadata: readerAudio.metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving reader audio:', error);
    throw error;
  }

  return data;
};

// intentionally omits audio_base64 — those blobs are multi-MB and kill list performance
export const listReaderAudio = async (userId) => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('reader_saved_audio')
    .select('id, title, file_name, content_type, character_count, chunk_count, language_code, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing reader audio:', error);
    throw error;
  }

  return data || [];
};

export const getReaderAudio = async (userId, savedAudioId) => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('reader_saved_audio')
    .select('id, title, file_name, content_type, audio_base64, character_count, chunk_count, language_code, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .eq('id', savedAudioId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching reader audio:', error);
    throw error;
  }

  return data || null;
};

export const deleteReaderAudio = async (userId, savedAudioId) => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('reader_saved_audio')
    .delete()
    .eq('user_id', userId)
    .eq('id', savedAudioId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error deleting reader audio:', error);
    throw error;
  }

  return data || null;
};

export const updateReaderAudio = async (userId, savedAudioId, updates = {}) => {
  const client = getSupabaseClient();
  const payload = {};

  if (updates.title) {
    payload.title = updates.title;
  }

  if (updates.fileName) {
    payload.file_name = updates.fileName;
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No reader audio updates were provided');
  }

  const { data, error } = await client
    .from('reader_saved_audio')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', savedAudioId)
    .select('id, title, file_name, updated_at')
    .maybeSingle();

  if (error) {
    console.error('Error updating reader audio:', error);
    throw error;
  }

  return data || null;
};

const attachRelatedCallRows = async (calls = [], options = {}) => {
  if (!Array.isArray(calls) || calls.length === 0) {
    return calls;
  }

  const callIds = calls.map((call) => call.id).filter(Boolean);

  if (callIds.length === 0) {
    return calls;
  }

  const includeMessages = options.includeMessages === true;

  const [costsResult, messagesResult] = await Promise.all([
    supabase
      .from('call_costs')
      .select('*')
      .in('call_id', callIds)
      .order('created_at', { ascending: true }),
    includeMessages
      ? supabase
          .from('call_messages')
          .select('*')
          .in('call_id', callIds)
          .order('sequence_number', { ascending: true })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (costsResult.error) {
    console.error('Error fetching call costs:', costsResult.error);
    throw costsResult.error;
  }

  if (messagesResult.error) {
    console.error('Error fetching call messages:', messagesResult.error);
    throw messagesResult.error;
  }

  const costsByCallId = new Map();
  for (const cost of costsResult.data || []) {
    const rows = costsByCallId.get(cost.call_id) || [];
    rows.push(cost);
    costsByCallId.set(cost.call_id, rows);
  }

  const messagesByCallId = new Map();
  for (const message of messagesResult.data || []) {
    const rows = messagesByCallId.get(message.call_id) || [];
    rows.push(message);
    messagesByCallId.set(message.call_id, rows);
  }

  return calls.map((call) => ({
    ...call,
    call_costs: costsByCallId.get(call.id) || [],
    call_messages: messagesByCallId.get(call.id) || []
  }));
};

export const getCallsForUser = async (userId) => {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      transcripts(*),
      summaries(*)
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching calls:', error);
    throw error;
  }

  return attachRelatedCallRows(data, { includeMessages: false });
};

export const getCallById = async (userId, callId) => {
  const { data, error } = await supabase
    .from('calls')
    .select(`
      *,
      transcripts(*),
      summaries(*)
    `)
    .eq('user_id', userId)
    .eq('id', callId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching call by ID:', error);
    throw error;
  }

  if (!data) {
    return data;
  }

  const [call] = await attachRelatedCallRows([data], { includeMessages: true });
  return call;
};

export const deleteCallForUser = async (userId, callId) => {
  const { error, count } = await supabase
    .from('calls')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('id', callId);

  if (error) {
    console.error('Error deleting call:', error);
    throw error;
  }

  return Number(count || 0) > 0;
};

const persistNoteRevision = async (noteId, userId, revisionData = {}) => {
  if (!noteId || !userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('note_revisions')
      .insert({
        note_id: noteId,
        user_id: userId,
        call_id: revisionData.callId || null,
        edit_type: revisionData.editType || 'update',
        edit_summary: revisionData.editSummary || null,
        previous_title: revisionData.previousTitle || null,
        previous_content: revisionData.previousContent || null,
        new_title: revisionData.newTitle || null,
        new_content: revisionData.newContent || null,
        source: revisionData.source || 'app',
        metadata: revisionData.metadata || {}
      })
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.warn('Unable to persist note revision:', error.message);
    return null;
  }
};

export const getNotesForUser = async (userId, options = {}) => {
  const topicId = options.topicId || null;
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 50;
  const offset = Number.isFinite(Number(options.offset)) ? Math.max(0, Number(options.offset)) : 0;

  let query = supabase
    .from('notes')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }

  return {
    notes: data || [],
    total: count ?? (data || []).length
  };
};

export const getTopicsForUser = async (userId) => {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching topics:', error);
    throw error;
  }

  return data || [];
};

export const getNoteById = async (userId, noteId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', noteId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching note by ID:', error);
    throw error;
  }

  return data;
};

export const createNote = async (userId, noteData, options = {}) => {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      call_id: noteData.callId || null,
      topic_id: noteData.topicId || null,
      title: String(noteData.title || '').trim(),
      content: String(noteData.content || '').trim(),
      is_archived: Boolean(noteData.isArchived)
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    throw error;
  }

  await persistNoteRevision(data.id, userId, {
    callId: noteData.callId || options.callId,
    editType: options.editType || 'create',
    editSummary: options.editSummary || 'Created note',
    previousTitle: null,
    previousContent: null,
    newTitle: data.title,
    newContent: data.content,
    source: options.source || 'app',
    metadata: options.metadata || {}
  });

  return data;
};

export const updateNote = async (userId, noteId, noteData, options = {}) => {
  const existingNote = await getNoteById(userId, noteId);

  if (!existingNote) {
    return null;
  }

  const payload = {
    title: noteData.title !== undefined ? String(noteData.title || '').trim() : existingNote.title,
    content: noteData.content !== undefined ? String(noteData.content || '').trim() : existingNote.content,
    topic_id: noteData.topicId !== undefined ? noteData.topicId || null : existingNote.topic_id,
    call_id: noteData.callId !== undefined ? noteData.callId || null : existingNote.call_id,
    is_archived: noteData.isArchived !== undefined ? Boolean(noteData.isArchived) : existingNote.is_archived
  };

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('user_id', userId)
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }

  await persistNoteRevision(noteId, userId, {
    callId: payload.call_id || options.callId,
    editType: options.editType || 'update',
    editSummary: options.editSummary || 'Updated note',
    previousTitle: existingNote.title,
    previousContent: existingNote.content,
    newTitle: data.title,
    newContent: data.content,
    source: options.source || 'app',
    metadata: options.metadata || {}
  });

  return data;
};

export const deleteNote = async (userId, noteId, options = {}) => {
  const existingNote = await getNoteById(userId, noteId);

  if (!existingNote) {
    return null;
  }

  await persistNoteRevision(noteId, userId, {
    callId: existingNote.call_id || options.callId,
    editType: options.editType || 'delete',
    editSummary: options.editSummary || 'Deleted note',
    previousTitle: existingNote.title,
    previousContent: existingNote.content,
    newTitle: null,
    newContent: null,
    source: options.source || 'app',
    metadata: options.metadata || {}
  });

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .eq('id', noteId);

  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }

  return existingNote;
};

export const linkNotesToCall = async (userId, noteIds = [], callId) => {
  const uniqueNoteIds = [...new Set((noteIds || []).filter(Boolean))];

  if (!callId || uniqueNoteIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('notes')
    .update({ call_id: callId })
    .eq('user_id', userId)
    .in('id', uniqueNoteIds)
    .select();

  if (error) {
    console.error('Error linking notes to call:', error);
    throw error;
  }

  return data || [];
};

export const getUserPricingTier = async (userId) => {
  return 'tier1';
};

export const getUserBillingProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, billing_state, credit_balance, free_credits_granted, monthly_credit_allocation')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user billing profile:', error);
    throw error;
  }

  return data || null;
};

export const getUserPhoneNumber = async (userId) => {
  const { data, error } = await supabase
    .from('user_phone_numbers')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user phone number:', error);
    throw error;
  }

  return data;
};

export const getUserIdByAssignedPhoneNumber = async (phoneNumber) => {
  const { data, error } = await supabase
    .from('user_phone_numbers')
    .select('user_id')
    .eq('phone_number', phoneNumber)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching user by assigned phone number:', error);
    throw error;
  }

  return data?.user_id || null;
};

export const saveUserPhoneNumber = async (userId, phoneNumberData) => {
  const { data, error } = await supabase
    .from('user_phone_numbers')
    .upsert(
      {
        user_id: userId,
        twilio_phone_sid: phoneNumberData.twilioPhoneSid,
        phone_number: phoneNumberData.phoneNumber,
        friendly_name: phoneNumberData.friendlyName,
        status: phoneNumberData.status || 'active',
        provisioned_at: phoneNumberData.provisionedAt || new Date().toISOString(),
        released_at: phoneNumberData.releasedAt || null
      },
      {
        onConflict: 'user_id'
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving user phone number:', error);
    throw error;
  }

  return data;
};

export const ensureCreditEntitlement = async (userId, creditsToAdd, reason) => {
  const supabase = getSupabaseClient();
  const amount = Math.max(0, Math.round(Number(creditsToAdd || 0)));

  if (!amount) {
    console.warn('[CreditEntitlement] No credits to add for', userId, reason);
    return { updatedBalance: null };
  }

  // Fetch current balance
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error('[CreditEntitlement] Fetch error:', fetchError.message);
    throw fetchError;
  }

  const currentBalance = Number(user?.credit_balance || 0);
  const newBalance = currentBalance + amount;

  // Update balance
  const { error: updateError } = await supabase
    .from('users')
    .update({
      credit_balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[CreditEntitlement] Update error:', updateError.message);
    throw updateError;
  }

  // Record transaction
  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'adjustment',
      credits: amount,
      balance_after: newBalance,
      source: 'purchase',
      metadata: { reason: reason || 'entitlement_grant' },
      created_at: new Date().toISOString()
    })
    .catch((err) => {
      console.error('[CreditEntitlement] Transaction record error:', err.message);
    });

  console.log(`[CreditEntitlement] Granted ${amount} credits to ${userId} (${reason}) — new balance: ${newBalance}`);

  return { updatedBalance: newBalance };
};

export const markUserPhoneNumberReleased = async (userId) => {
  const { data, error } = await supabase
    .from('user_phone_numbers')
    .update({
      status: 'released',
      released_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error releasing user phone number:', error);
    throw error;
  }

  return data;
};

export default {
  getSupabaseClient,
  ensureCreditEntitlement,
  saveCall,
  saveTranscript,
  saveCallMessages,
  saveCallCosts,
  saveSummary,
  getCallsForUser,
  getCallById,
  deleteCallForUser,
  getNotesForUser,
  getTopicsForUser,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  linkNotesToCall,
  getUserPricingTier,
  getUserBillingProfile,
  getUserPhoneNumber,
  getUserIdByAssignedPhoneNumber,
  saveUserPhoneNumber,
  markUserPhoneNumberReleased
};

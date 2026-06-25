/**
 * Supabase database service
 */

import { createClient } from '@supabase/supabase-js';

const normalizeSupabaseUrl = (value) => {
  const url = String(value || '').trim();

  if (!url) {
    return '';
  }

  return url.replace(/\/rest\/v1\/?$/, '');
};

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getSupabaseHost = () => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).host : 'missing';
  } catch {
    return 'invalid';
  }
};

let supabase = null;

// Initialize Supabase only if credentials are provided
if (supabaseUrl && supabaseKey) {
  try {
    if (process.env.SUPABASE_URL !== supabaseUrl) {
      console.warn('SUPABASE_URL included /rest/v1; normalizing to project root URL for Supabase client');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Supabase client initialized');
  } catch (error) {
    console.error('Failed to initialize Supabase:', error.message);
    supabase = null;
  }
} else {
  console.warn('⚠ Supabase not configured - database features disabled');
}

export const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return supabase;
};

export const getSupabaseDebugInfo = () => ({
  configured: Boolean(supabaseUrl && supabaseKey),
  originalUrl: String(process.env.SUPABASE_URL || ''),
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
    .select('id, billing_state, free_trial_seconds_granted, prepaid_seconds_balance, auto_recharge_enabled, auto_recharge_threshold_seconds, auto_recharge_amount_seconds')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user billing profile:', error);
    throw error;
  }

  return data || null;
};

export const getUserConsumedCallSeconds = async (userId) => {
  const { data, error } = await supabase
    .from('calls')
    .select('call_duration_seconds')
    .eq('user_id', userId)
    .not('call_duration_seconds', 'is', null);

  if (error) {
    console.error('Error fetching consumed call seconds:', error);
    throw error;
  }

  return (data || []).reduce((total, call) => total + Number(call.call_duration_seconds || 0), 0);
};

export const addUserPrepaidSeconds = async (userId, secondsToAdd) => {
  const currentProfile = await getUserBillingProfile(userId);
  const nextBalance = Math.max(0, Number(currentProfile?.prepaid_seconds_balance || 0) + Number(secondsToAdd || 0));

  const { data, error } = await supabase
    .from('users')
    .update({
      prepaid_seconds_balance: nextBalance,
      billing_state: nextBalance > 0 ? 'active' : currentProfile?.billing_state || 'trial',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select('id, billing_state, free_trial_seconds_granted, prepaid_seconds_balance, auto_recharge_enabled, auto_recharge_threshold_seconds, auto_recharge_amount_seconds')
    .single();

  if (error) {
    console.error('Error updating user prepaid seconds:', error);
    throw error;
  }

  return data;
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
  saveCall,
  saveTranscript,
  saveCallMessages,
  saveCallCosts,
  saveSummary,
  getCallsForUser,
  getCallById,
  getNotesForUser,
  getTopicsForUser,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  linkNotesToCall,
  getUserPricingTier,
  getUserBillingProfile,
  getUserConsumedCallSeconds,
  addUserPrepaidSeconds,
  getUserPhoneNumber,
  getUserIdByAssignedPhoneNumber,
  saveUserPhoneNumber,
  markUserPhoneNumberReleased
};

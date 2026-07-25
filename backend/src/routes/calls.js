import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { deleteCallForUser, getCallById, getCallsForUser } from '../services/databaseService.js';
import { summarizeEstimatedCallCosts } from '../services/costTrackingService.js';

const router = express.Router();

const mapCallRecord = (call) => {
  const transcript = Array.isArray(call.transcripts) ? call.transcripts[0] : call.transcripts;
  const summary = Array.isArray(call.summaries) ? call.summaries[0] : call.summaries;

  return {
    id: call.id,
    phoneNumber: call.phone_number,
    callMode: call.call_mode || 'live_call',
    callType: call.call_mode || 'live_call',
    mode: call.call_mode || 'live_call',
    callDurationSeconds: call.call_duration_seconds,
    startedAt: call.started_at,
    endedAt: call.ended_at,
    callStatus: call.call_status,
    twilioCallSid: call.twilio_call_sid,
    createdAt: call.created_at,
    updatedAt: call.updated_at,
    fullTranscript: transcript?.full_text || '',
    summary: summary?.summary_text || transcript?.summary_text || '',
    keyPoints: summary?.key_points || transcript?.key_points || [],
    actionItems: summary?.action_items || transcript?.action_items || [],
    sentiment: summary?.sentiment || transcript?.sentiment || 'neutral',
    messages: [],
    costs: [],
    totalVendorCostUsd: 0,
    totalBillableCostUsd: 0,
    providerCostBreakdown: {}
  };
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const calls = await getCallsForUser(req.user.userId);

    return res.status(200).json({
      calls: calls.map(mapCallRecord),
      total: calls.length
    });
  } catch (error) {
    console.error('Error fetching calls:', error.message);
    return res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

router.get('/:callId', authMiddleware, async (req, res) => {
  try {
    const call = await getCallById(req.user.userId, req.params.callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    return res.status(200).json({ call: mapCallRecord(call) });
  } catch (error) {
    console.error('Error fetching call detail:', error.message);
    return res.status(500).json({ error: 'Failed to fetch call detail' });
  }
});

router.delete('/:callId', authMiddleware, async (req, res) => {
  try {
    const deleted = await deleteCallForUser(req.user.userId, req.params.callId);

    if (!deleted) {
      return res.status(404).json({ error: 'Call not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting call:', error.message);
    return res.status(500).json({ error: 'Failed to delete call' });
  }
});

export default router;

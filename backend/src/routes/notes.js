import express from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  createNote,
  deleteNote,
  getCallById,
  getNoteById,
  getNotesForUser,
  getTopicsForUser,
  updateNote
} from '../services/databaseService.js';

const router = express.Router();

const mapNoteRecord = (note) => ({
  id: note.id,
  userId: note.user_id,
  callId: note.call_id,
  topicId: note.topic_id,
  title: note.title,
  content: note.content,
  isArchived: Boolean(note.is_archived),
  createdAt: note.created_at,
  updatedAt: note.updated_at
});

const mapTopicRecord = (topic) => ({
  id: topic.id,
  userId: topic.user_id,
  name: topic.name,
  description: topic.description,
  color: topic.color,
  createdAt: topic.created_at,
  updatedAt: topic.updated_at
});

const buildNoteFromCallContent = (call, fallbackTitle = null) => {
  const transcript = Array.isArray(call.transcripts) ? call.transcripts[0] : call.transcripts;
  const summary = Array.isArray(call.summaries) ? call.summaries[0] : call.summaries;
  const title = String(fallbackTitle || summary?.summary_text || `Call note ${new Date(call.started_at).toLocaleDateString('en-US')}`)
    .trim()
    .slice(0, 255);

  const sections = [];

  if (summary?.summary_text) {
    sections.push(`<h2>Summary</h2><p>${summary.summary_text.trim()}</p>`);
  }

  if (Array.isArray(summary?.key_points) && summary.key_points.length > 0) {
    sections.push(`<h2>Key Points</h2><ul>${summary.key_points.map((point) => `<li>${point}</li>`).join('')}</ul>`);
  }

  if (Array.isArray(summary?.action_items) && summary.action_items.length > 0) {
    sections.push(`<h2>Action Items</h2><ul>${summary.action_items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  if (transcript?.full_text) {
    sections.push(`<h2>Transcript</h2><p>${transcript.full_text.trim().replace(/\n+/g, '<br />')}</p>`);
  }

  return {
    title,
    content: sections.filter(Boolean).join('\n\n')
  };
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { topic = null, limit = 50, offset = 0 } = req.query;
    const result = await getNotesForUser(req.user.userId, {
      topicId: topic,
      limit,
      offset
    });

    return res.status(200).json({
      notes: result.notes.map(mapNoteRecord),
      total: result.total
    });
  } catch (error) {
    console.error('Error fetching notes:', error.message);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.get('/topics', authMiddleware, async (_req, res) => {
  return res.status(200).json({ topics: [] });
});

router.get('/:noteId', authMiddleware, async (req, res) => {
  try {
    const note = await getNoteById(req.user.userId, req.params.noteId);

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.status(200).json({ note: mapNoteRecord(note) });
  } catch (error) {
    console.error('Error fetching note detail:', error.message);
    return res.status(500).json({ error: 'Failed to fetch note detail' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const note = await createNote(
      req.user.userId,
      {
        title,
        content,
        topicId: req.body?.topic || req.body?.topicId || null,
        callId: req.body?.callId || null
      },
      {
        source: 'mobile_manual',
        editSummary: 'Created note from app'
      }
    );

    return res.status(201).json({ note: mapNoteRecord(note) });
  } catch (error) {
    console.error('Error creating note:', error.message);
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/:noteId', authMiddleware, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const note = await updateNote(
      req.user.userId,
      req.params.noteId,
      {
        title,
        content,
        topicId: req.body?.topic || req.body?.topicId || null
      },
      {
        source: 'mobile_manual',
        editSummary: 'Updated note from app'
      }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.status(200).json({ note: mapNoteRecord(note) });
  } catch (error) {
    console.error('Error updating note:', error.message);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:noteId', authMiddleware, async (req, res) => {
  try {
    const note = await deleteNote(req.user.userId, req.params.noteId, {
      source: 'mobile_manual',
      editSummary: 'Deleted note from app'
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.status(200).json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error.message);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.post('/from-call/:callId', authMiddleware, async (req, res) => {
  try {
    const call = await getCallById(req.user.userId, req.params.callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const noteDraft = buildNoteFromCallContent(call, req.body?.title || null);
    const note = await createNote(
      req.user.userId,
      {
        title: noteDraft.title,
        content: noteDraft.content,
        callId: call.id
      },
      {
        source: 'call_extract',
        callId: call.id,
        editSummary: 'Created note from call'
      }
    );

    return res.status(201).json({ note: mapNoteRecord(note) });
  } catch (error) {
    console.error('Error creating note from call:', error.message);
    return res.status(500).json({ error: 'Failed to create note from call' });
  }
});

export default router;

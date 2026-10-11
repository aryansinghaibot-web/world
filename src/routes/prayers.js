const express = require('express');
const router = express.Router();
const { getDatabase, runTransaction } = require('../db/database');
const { requireAdmin, csrfProtection, logAuditEvent } = require('../security/middleware');
const engine = require('../simulation/engine');

// Require admin authentication for all prayer endpoints
router.use(requireAdmin);

// List prayers and mannats with filtering and pagination
router.get('/', (req, res) => {
  const db = getDatabase();
  const {
    category = '', // 'Mannat', 'Personal Prayer', 'Gratitude', 'Reflection', 'Needs Review'
    status = '',   // 'pending', 'fulfilled', 'unfulfilled', 'postponed', 'resolved'
    search = '',
    agentId = '',
    page = 1,
    limit = 20
  } = req.query;

  const conditions = [];
  const params = [];

  if (category.trim()) {
    conditions.push('p.category = ?');
    params.push(category.trim());
  }

  if (status.trim()) {
    conditions.push('p.status = ?');
    params.push(status.trim());
  }

  if (agentId.trim()) {
    conditions.push('p.agent_id = ?');
    params.push(parseInt(agentId.trim(), 10));
  }

  if (search.trim()) {
    conditions.push('(p.request_ref LIKE ? OR p.request_summary LIKE ? OR p.original_words LIKE ? OR a.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalSql = `
    SELECT COUNT(*) as total
    FROM prayers_and_mannats p
    JOIN agents a ON p.agent_id = a.id
    ${whereClause}
  `;
  const total = db.prepare(totalSql).get(...params).total;

  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const listSql = `
    SELECT 
      p.*,
      p.explicit_promise as explicit_vow,
      p.request_summary as summary,
      p.original_words as original_text,
      p.trigger_context as context_trigger,
      p.emotional_state as emotion_state,
      a.name as agent_name,
      a.avatar as agent_avatar,
      a.photo_url as photo_url,
      a.photo_url as agent_photo_url,
      a.age as age,
      a.age as agent_age,
      a.occupation as agent_occupation,
      a.location as agent_location,
      a.emotion as agent_emotion,
      b.belief_status as agent_belief
    FROM prayers_and_mannats p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    ${whereClause}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(listSql).all(...params, parsedLimit, offset);

  // Summary stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as fulfilled,
      SUM(CASE WHEN status = 'unfulfilled' OR status = 'declined' THEN 1 ELSE 0 END) as unfulfilled,
      SUM(CASE WHEN status = 'postponed' THEN 1 ELSE 0 END) as postponed,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN category = 'Mannat' THEN 1 ELSE 0 END) as mannats
    FROM prayers_and_mannats
  `).get();

  res.json({
    data: rows,
    counts: {
      total: stats.total || 0,
      pending: stats.pending || 0,
      fulfilled: stats.fulfilled || 0,
      declined: stats.unfulfilled || 0,
      unfulfilled: stats.unfulfilled || 0,
      postponed: stats.postponed || 0,
      resolved: stats.resolved || 0,
      mannats: stats.mannats || 0
    },
    summary: {
      total: stats.total || 0,
      pending: stats.pending || 0,
      fulfilled: stats.fulfilled || 0,
      unfulfilled: stats.unfulfilled || 0,
      postponed: stats.postponed || 0,
      resolved: stats.resolved || 0,
      mannats: stats.mannats || 0
    },
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  });
});

// Single prayer details with full agent context and conversation history
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const prayer = db.prepare(`
    SELECT 
      p.*,
      p.explicit_promise as explicit_vow,
      p.request_summary as summary,
      p.original_words as original_text,
      p.trigger_context as context_trigger,
      p.emotional_state as emotion_state,
      a.name as agent_name,
      a.avatar as agent_avatar,
      a.photo_url as photo_url,
      a.photo_url as agent_photo_url,
      a.age as age,
      a.age as agent_age,
      a.occupation as agent_occupation,
      a.location as agent_location,
      a.emotion as agent_emotion,
      a.virtual_balance as agent_balance,
      a.health as agent_health,
      a.personality as agent_personality,
      a.family_background as agent_family_background,
      b.belief_status as agent_belief
    FROM prayers_and_mannats p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!prayer) {
    return res.status(404).json({ error: 'Prayer or mannat request not found.' });
  }

  // Fetch recent memories and life events of this agent
  const memories = db.prepare('SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY id DESC LIMIT 10').all(prayer.agent_id);
  const lifeEvents = db.prepare('SELECT * FROM life_events WHERE agent_id = ? ORDER BY id DESC LIMIT 10').all(prayer.agent_id);

  res.json({
    prayer,
    data: prayer,
    memories,
    lifeEvents
  });
});

// FULFILL PRAYER OR MANNAT
// Executes a valid world event, updates the agent's circumstances/needs, records in life history and audit logs
router.post('/:id/fulfill', csrfProtection, (req, res) => {
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const notes = body.notes || (typeof req.body === 'string' ? req.body : '');
  const grantRewardPoints = body.grantRewardPoints || 0;
  const balanceBonus = body.balanceBonus || 0;
  const adminUser = req.admin ? req.admin.username : 'admin';

  try {
    const result = runTransaction((db) => {
      const prayer = db.prepare('SELECT * FROM prayers_and_mannats WHERE id = ?').get(req.params.id);
      if (!prayer) throw new Error('Prayer request not found.');
      if (prayer.status === 'fulfilled') throw new Error('Prayer request has already been fulfilled.');

      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(prayer.agent_id);
      if (!agent) throw new Error('Target agent does not exist.');

      const now = new Date().toISOString();

      // 1. Update prayer record
      db.prepare(`
        UPDATE prayers_and_mannats
        SET status = 'fulfilled',
            admin_notes = ?,
            decision_by = ?,
            decision_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(notes || 'Approved through administrative simulation intervention.', `Admin (${adminUser})`, now, now, prayer.id);

      // 2. Update agent happiness, emotion, and optional balance/health
      const newHappiness = Math.min(100.0, agent.happiness + 20.0);
      const newStress = Math.max(0.0, (agent.stress || 20.0) - 25.0);
      const newBalance = agent.virtual_balance + (parseFloat(balanceBonus) || 0.0);
      const newHealth = Math.min(100.0, (agent.health || 95.0) + 10.0);
      const newEmotion = 'grateful';

      db.prepare(`
        UPDATE agents
        SET happiness = ?, stress = ?, virtual_balance = ?, health = ?, emotion = ?, updated_at = ?
        WHERE id = ?
      `).run(newHappiness, newStress, newBalance, newHealth, newEmotion, now, agent.id);

      // 3. Register consequence in life_events
      db.prepare(`
        INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
        VALUES (?, 'PRAYER_FULFILLED', 'Spiritual Request Realized', ?, 'major', ?)
      `).run(
        agent.id,
        `Circumstances favorably aligned for ${agent.name}: "${prayer.desired_outcome}". ${prayer.explicit_promise ? `Promise committed: ${prayer.explicit_promise}` : ''}`,
        now
      );

      // 4. Record grateful memory
      db.prepare(`
        INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
        VALUES (?, ?, 0.9, 'private', ?)
      `).run(
        agent.id,
        `Felt deep spiritual peace and gratitude after personal prayer was answered ("${prayer.desired_outcome}"). ${prayer.explicit_promise ? `I vowed to: ${prayer.explicit_promise}` : ''}`,
        now
      );

      // 5. Broadcast world event
      engine.addEvent('PRAYER_FULFILLED', `🕊️ Prayer Answered: Favorable circumstances blessed ${agent.name} (${prayer.desired_outcome}).`);

      // 6. Log audit event
      logAuditEvent({
        actor: `Admin (${adminUser})`,
        action: 'PRAYER_FULFILLED',
        targetType: 'Prayer',
        targetId: String(prayer.id),
        targetName: prayer.request_ref,
        details: {
          agentId: agent.id,
          agentName: agent.name,
          category: prayer.category,
          desiredOutcome: prayer.desired_outcome,
          explicitPromise: prayer.explicit_promise,
          notes
        },
        ip: req.ip
      });

      return {
        message: `Prayer request ${prayer.request_ref} for ${agent.name} has been successfully fulfilled.`,
        prayerId: prayer.id,
        prayer: { ...prayer, status: 'fulfilled' },
        event: { type: 'PRAYER_FULFILLED', agentId: agent.id },
        status: 'fulfilled'
      };
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DECLINE PRAYER ("Do Not Fulfill")
// Allows world to continue naturally through ordinary simulation mechanics without backdoor granting
router.post('/:id/decline', csrfProtection, (req, res) => {
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const notes = body.notes || (typeof req.body === 'string' ? req.body : 'Declined divine intervention; world circumstances will continue naturally.');
  const adminUser = req.admin ? req.admin.username : 'admin';

  try {
    const db = getDatabase();
    const prayer = db.prepare('SELECT * FROM prayers_and_mannats WHERE id = ?').get(req.params.id);
    if (!prayer) return res.status(404).json({ error: 'Prayer request not found.' });

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(prayer.agent_id);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE prayers_and_mannats
      SET status = 'declined',
          admin_notes = ?,
          decision_by = ?,
          decision_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(notes, `Admin (${adminUser})`, now, now, prayer.id);

    // Agent memory of persevering through uncertainty
    if (agent) {
      db.prepare(`
        INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
        VALUES (?, ?, -0.1, 'private', ?)
      `).run(
        agent.id,
        `Reflected on unfulfilled prayer ("${prayer.desired_outcome}"). Resolving to take practical steps forward.`,
        now
      );
    }

    logAuditEvent({
      actor: `Admin (${adminUser})`,
      action: 'PRAYER_DECLINED',
      targetType: 'Prayer',
      targetId: String(prayer.id),
      targetName: prayer.request_ref,
      details: {
        agentId: prayer.agent_id,
        category: prayer.category,
        notes
      },
      ip: req.ip
    });

    res.json({
      message: `Request ${prayer.request_ref} marked as declined. Natural simulation rules continue.`,
      prayerId: prayer.id,
      prayer: { ...prayer, status: 'declined' },
      status: 'declined'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POSTPONE PRAYER DECISION
router.post('/:id/postpone', csrfProtection, (req, res) => {
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const notes = body.notes || (typeof req.body === 'string' ? req.body : 'Decision postponed pending further town developments.');
  const adminUser = req.admin ? req.admin.username : 'admin';

  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE prayers_and_mannats
      SET status = 'postponed',
          admin_notes = ?,
          decision_by = ?,
          decision_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(notes, `Admin (${adminUser})`, now, now, req.params.id);

    logAuditEvent({
      actor: `Admin (${adminUser})`,
      action: 'PRAYER_POSTPONED',
      targetType: 'Prayer',
      targetId: String(req.params.id),
      targetName: `Prayer #${req.params.id}`,
      details: { notes },
      ip: req.ip
    });

    res.json({ message: 'Prayer request decision postponed.', status: 'postponed' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// RESOLVE PRAYER DECISION
router.post('/:id/resolve', csrfProtection, (req, res) => {
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const notes = body.notes || (typeof req.body === 'string' ? req.body : 'Closed and resolved naturally.');
  const adminUser = req.admin ? req.admin.username : 'admin';

  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE prayers_and_mannats
      SET status = 'resolved',
          admin_notes = ?,
          decision_by = ?,
          decision_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(notes, `Admin (${adminUser})`, now, now, req.params.id);

    logAuditEvent({
      actor: `Admin (${adminUser})`,
      action: 'PRAYER_RESOLVED',
      targetType: 'Prayer',
      targetId: String(req.params.id),
      targetName: `Prayer #${req.params.id}`,
      details: { notes },
      ip: req.ip
    });

    res.json({ message: 'Prayer request resolved and closed.', status: 'resolved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

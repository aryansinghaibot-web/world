const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin, csrfProtection, logAuditEvent } = require('../security/middleware');

router.use(requireAdmin);

const VALID_BELIEFS = [
  'Trusts in God',
  'Does not trust in God',
  'Unsure or undecided',
  'Belief not specified'
];

// Aggregate statistics and distribution
router.get('/stats', (req, res) => {
  const db = getDatabase();

  const totalAgents = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;

  // Aggregate counts by belief status
  const counts = db.prepare(`
    SELECT b.belief_status, COUNT(a.id) as count
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    GROUP BY b.belief_status
  `).all();

  const distribution = {};
  for (const b of VALID_BELIEFS) {
    distribution[b] = 0;
  }

  for (const row of counts) {
    const key = row.belief_status || 'Belief not specified';
    distribution[key] = (distribution[key] || 0) + row.count;
  }

  // Declared sources breakdown
  const sources = db.prepare(`
    SELECT declared_source, COUNT(*) as count
    FROM agent_belief_profiles
    GROUP BY declared_source
    ORDER BY count DESC
  `).all();

  // Recent autonomous updates
  const recentUpdates = db.prepare(`
    SELECT a.id as agent_id, a.name, a.avatar, b.belief_status, b.declared_source, b.updated_at
    FROM agent_belief_profiles b
    JOIN agents a ON b.agent_id = a.id
    ORDER BY b.updated_at DESC
    LIMIT 10
  `).all();

  res.json({
    totalAgents,
    distribution,
    sources,
    recentUpdates,
    allowedValues: VALID_BELIEFS
  });
});

// Update an agent's belief profile explicitly
router.put('/:agentId', csrfProtection, (req, res) => {
  const db = getDatabase();
  const agentId = req.params.agentId;
  const { belief_status, declared_source, notes } = req.body;

  if (!VALID_BELIEFS.includes(belief_status)) {
    return res.status(400).json({
      error: 'Invalid Belief Value',
      message: `Belief value must be one of: ${VALID_BELIEFS.join(', ')}`
    });
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const existing = db.prepare('SELECT * FROM agent_belief_profiles WHERE agent_id = ?').get(agentId);
  const now = new Date().toISOString();
  const finalSource = declared_source || `Explicit Administrator Experimentation by ${req.admin.username}`;

  db.prepare(`
    INSERT INTO agent_belief_profiles (agent_id, belief_status, declared_source, notes, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      belief_status = excluded.belief_status,
      declared_source = excluded.declared_source,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(agentId, belief_status, finalSource, notes || '', now);

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'BELIEF_PROFILE_UPDATED',
    targetType: 'BeliefProfile',
    targetId: agentId,
    targetName: agent.name,
    details: {
      previousBelief: existing ? existing.belief_status : 'Belief not specified',
      newBelief: belief_status,
      declared_source: finalSource,
      notes
    },
    ip: req.ip
  });

  const updatedProfile = db.prepare('SELECT * FROM agent_belief_profiles WHERE agent_id = ?').get(agentId);
  res.json({
    message: 'Belief profile updated successfully.',
    profile: updatedProfile
  });
});

module.exports = router;

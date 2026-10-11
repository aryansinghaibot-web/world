const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin, csrfProtection, logAuditEvent } = require('../security/middleware');
const engine = require('../simulation/engine');

// Apply admin authentication to all routes in this module
router.use(requireAdmin);

// List agents with search, multi-filter, sorting, and pagination
router.get('/', (req, res) => {
  const db = getDatabase();
  const {
    search = '',
    status = '', // 'active', 'paused', 'deactivated', 'deceased'
    lifeStatus = '', // 'living', 'deceased'
    activity = '', // 'working', 'eating', 'walking', 'resting', 'socializing', 'sleeping'
    location = '',
    belief = '',
    sortBy = 'id',
    sortOrder = 'asc',
    page = 1,
    limit = 20
  } = req.query;

  const conditions = [];
  const params = [];

  if (search.trim()) {
    conditions.push('(a.name LIKE ? OR a.occupation LIKE ? OR a.personality LIKE ? OR a.current_goal LIKE ? OR a.id = ?)');
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, search.trim());
  }

  if (status.trim()) {
    conditions.push('a.runtime_status = ?');
    params.push(status.trim());
  }

  if (lifeStatus.trim() === 'living') {
    conditions.push("a.runtime_status != 'deceased'");
  } else if (lifeStatus.trim() === 'deceased') {
    conditions.push("a.runtime_status = 'deceased'");
  }

  if (activity.trim()) {
    conditions.push('a.activity = ?');
    params.push(activity.trim());
  }

  if (location.trim()) {
    conditions.push('a.location = ?');
    params.push(location.trim());
  }

  if (belief.trim()) {
    conditions.push('b.belief_status = ?');
    params.push(belief.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed sort columns
  const allowedSorts = {
    id: 'a.id',
    name: 'a.name',
    age: 'a.age',
    health: 'a.health',
    stress: 'a.stress',
    hunger: 'a.hunger',
    energy: 'a.energy',
    happiness: 'a.happiness',
    social_needs: 'a.social_needs',
    virtual_balance: 'a.virtual_balance',
    reward_points: 'a.reward_points',
    activity: 'a.activity',
    status: 'a.runtime_status',
    generation: 'a.generation',
    updated_at: 'a.updated_at'
  };

  const sortColumn = allowedSorts[sortBy] || 'a.id';
  const orderDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  // Count total matching
  const countSql = `
    SELECT COUNT(*) as total
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    ${whereClause}
  `;
  const total = db.prepare(countSql).get(...params).total;

  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const querySql = `
    SELECT 
      a.id, a.name, a.avatar, a.photo_url, a.age, a.date_of_birth,
      a.occupation, a.location, a.activity, a.runtime_status,
      a.health, a.stress, a.emotion, a.personality, a.current_goal,
      a.hunger, a.energy, a.happiness, a.social_needs,
      a.virtual_balance, a.reward_points, a.last_decision_reason, a.last_decision_time,
      a.family_background, a.financial_status, a.deceased_at, a.cause_of_death,
      a.generation, a.parent_a_id, a.parent_b_id,
      a.created_at, a.updated_at,
      b.belief_status, b.declared_source, b.updated_at as belief_updated_at
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    ${whereClause}
    ORDER BY ${sortColumn} ${orderDirection}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(querySql).all(...params, parsedLimit, offset);

  res.json({
    data: rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  });
});

// Get single agent details including memories, relationships, and conversations
router.get('/:id', (req, res) => {
  const db = getDatabase();
  const agentId = req.params.id;

  const agent = db.prepare(`
    SELECT a.*, b.belief_status, b.declared_source, b.notes as belief_notes, b.updated_at as belief_updated_at
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    WHERE a.id = ?
  `).get(agentId);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // Fetch memories (support privacy level query parameter e.g. show all or public only)
  const privacyLevel = req.query.privacy || 'all';
  let memorySql = 'SELECT * FROM agent_memories WHERE agent_id = ?';
  const memParams = [agentId];
  if (privacyLevel === 'public') {
    memorySql += " AND privacy_level = 'public'";
  }
  memorySql += ' ORDER BY id DESC LIMIT 30';
  const memories = db.prepare(memorySql).all(...memParams);

  // Fetch relationships
  const relationships = db.prepare(`
    SELECT r.*, 
      CASE WHEN r.agent_a_id = ? THEN o.name ELSE self.name END as peer_name,
      CASE WHEN r.agent_a_id = ? THEN o.avatar ELSE self.avatar END as peer_avatar,
      CASE WHEN r.agent_a_id = ? THEN o.id ELSE self.id END as peer_id
    FROM agent_relationships r
    JOIN agents self ON r.agent_a_id = self.id
    JOIN agents o ON r.agent_b_id = o.id
    WHERE r.agent_a_id = ? OR r.agent_b_id = ?
    ORDER BY r.affinity_score DESC
  `).all(agentId, agentId, agentId, agentId, agentId);

  // Fetch recent conversations
  const conversations = db.prepare(`
    SELECT c.*, 
      a1.name as agent_a_name, a1.avatar as agent_a_avatar,
      a2.name as agent_b_name, a2.avatar as agent_b_avatar
    FROM agent_conversations c
    JOIN agents a1 ON c.agent_a_id = a1.id
    JOIN agents a2 ON c.agent_b_id = a2.id
    WHERE c.agent_a_id = ? OR c.agent_b_id = ?
    ORDER BY c.id DESC LIMIT 15
  `).all(agentId, agentId);

  // Fetch recent reward transactions
  const rewards = db.prepare(`
    SELECT t.*, r.name as rule_name
    FROM reward_transactions t
    LEFT JOIN reward_rules r ON t.rule_id = r.id
    WHERE t.agent_id = ?
    ORDER BY t.id DESC LIMIT 15
  `).all(agentId);

  // Fetch life events
  const lifeEvents = db.prepare('SELECT * FROM life_events WHERE agent_id = ? ORDER BY id DESC LIMIT 20').all(agentId);

  // Fetch prayers
  const prayers = db.prepare(`
    SELECT 
      p.*,
      p.created_at as timestamp,
      p.original_words as original_text,
      p.request_summary as summary,
      p.explicit_promise as explicit_vow,
      p.trigger_context as context_trigger
    FROM prayers_and_mannats p
    WHERE p.agent_id = ?
    ORDER BY p.id DESC LIMIT 10
  `).all(agentId);

  res.json({
    agent,
    memories,
    relationships,
    conversations,
    rewards,
    lifeEvents,
    prayers
  });
});

// Conclude agent lifecycle and record death
router.post('/:id/declare-deceased', csrfProtection, (req, res) => {
  try {
    const { cause = 'Natural Causes (Elder Age)' } = req.body;
    const result = engine.executeAgentDeath(req.params.id, cause, `Admin (${req.admin.username})`);
    if (result && result.alreadyDeceased) {
      return res.status(400).json({ error: 'Agent is already deceased; duplicate death events are prohibited.' });
    }
    res.json({ message: 'Agent lifecycle concluded; recorded in town archives.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Pause agent
router.post('/:id/pause', csrfProtection, (req, res) => {
  try {
    const result = engine.pauseAgent(req.params.id, `Admin (${req.admin.username})`);
    res.json({ message: 'Agent paused successfully.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Resume agent
router.post('/:id/resume', csrfProtection, (req, res) => {
  try {
    const result = engine.resumeAgent(req.params.id, `Admin (${req.admin.username})`);
    res.json({ message: 'Agent resumed successfully.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deactivate agent (destructive/irreversible operation requires confirmation on UI)
router.post('/:id/deactivate', csrfProtection, (req, res) => {
  try {
    const result = engine.deactivateAgent(req.params.id, `Admin (${req.admin.username})`);
    res.json({ message: 'Agent deactivated successfully.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reactivate agent
router.post('/:id/reactivate', csrfProtection, (req, res) => {
  try {
    const result = engine.reactivateAgent(req.params.id, `Admin (${req.admin.username})`);
    res.json({ message: 'Agent reactivated successfully.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Adjust configurable simulation attributes
router.patch('/:id/attributes', csrfProtection, (req, res) => {
  try {
    const updated = engine.updateAgentAttributes(req.params.id, req.body, `Admin (${req.admin.username})`);
    res.json({ message: 'Agent attributes updated successfully.', agent: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add manual memory for research/experimentation
router.post('/:id/memories', csrfProtection, (req, res) => {
  const db = getDatabase();
  const agentId = req.params.id;
  const { memory_text, emotional_valence = 0.0, privacy_level = 'private' } = req.body;

  if (!memory_text) {
    return res.status(400).json({ error: 'Memory text is required.' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(agentId, memory_text, emotional_valence, privacy_level, now);

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'AGENT_MEMORY_INJECTED',
    targetType: 'Agent',
    targetId: agentId,
    details: { memoryId: result.lastInsertRowid, memory_text, privacy_level },
    ip: req.ip
  });

  res.status(201).json({ message: 'Memory recorded successfully.', memoryId: result.lastInsertRowid });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin, csrfProtection, logAuditEvent } = require('../security/middleware');
const {
  previewRuleMatchingAgents,
  grantRewardTransaction,
  reverseRewardTransaction,
  bulkGrantRewardRule
} = require('../rewards/engine');

router.use(requireAdmin);

// 1. List all reward rules
router.get('/rules', (req, res) => {
  const db = getDatabase();
  const rules = db.prepare('SELECT * FROM reward_rules ORDER BY id ASC').all();
  res.json({ rules });
});

// 2. Create a reward rule
router.post('/rules', csrfProtection, (req, res) => {
  const db = getDatabase();
  const {
    name,
    description = '',
    point_type = 'Merit Tokens',
    amount,
    trigger_event = 'work_achievement',
    conditions = {},
    min_limit = 1.0,
    max_limit = 500.0,
    cooldown_seconds = 60,
    is_active = 1
  } = req.body;

  if (!name || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Rule name and valid positive reward amount are required.' });
  }

  const parsedAmount = parseFloat(amount);
  const parsedMin = parseFloat(min_limit) || 1.0;
  const parsedMax = parseFloat(max_limit) || 500.0;

  if (parsedAmount < parsedMin || parsedAmount > parsedMax) {
    return res.status(400).json({
      error: 'Invalid Amount',
      message: `Amount must be between min limit (${parsedMin}) and max limit (${parsedMax}).`
    });
  }

  const conditionsJson = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO reward_rules (
      name, description, point_type, amount, trigger_event, conditions_json,
      min_limit, max_limit, cooldown_seconds, is_active, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, description, point_type, parsedAmount, trigger_event, conditionsJson,
    parsedMin, parsedMax, parseInt(cooldown_seconds, 10) || 60, is_active ? 1 : 0,
    `Admin (${req.admin.username})`, now, now
  );

  const ruleId = result.lastInsertRowid;

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'REWARD_RULE_CREATED',
    targetType: 'RewardRule',
    targetId: ruleId,
    targetName: name,
    details: { name, amount: parsedAmount, point_type, trigger_event, conditions: conditionsJson },
    ip: req.ip
  });

  const rule = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
  res.status(201).json({ message: 'Reward rule created successfully.', rule });
});

// 3. Update existing reward rule
router.put('/rules/:id', csrfProtection, (req, res) => {
  const db = getDatabase();
  const ruleId = req.params.id;
  const {
    name,
    description = '',
    point_type = 'Merit Tokens',
    amount,
    trigger_event,
    conditions = {},
    min_limit = 1.0,
    max_limit = 500.0,
    cooldown_seconds = 60,
    is_active
  } = req.body;

  const existing = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
  if (!existing) {
    return res.status(404).json({ error: 'Reward rule not found.' });
  }

  const parsedAmount = parseFloat(amount !== undefined ? amount : existing.amount);
  const conditionsJson = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE reward_rules SET
      name = ?, description = ?, point_type = ?, amount = ?, trigger_event = ?,
      conditions_json = ?, min_limit = ?, max_limit = ?, cooldown_seconds = ?,
      is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name || existing.name,
    description !== undefined ? description : existing.description,
    point_type || existing.point_type,
    parsedAmount,
    trigger_event || existing.trigger_event,
    conditionsJson,
    parseFloat(min_limit) || existing.min_limit,
    parseFloat(max_limit) || existing.max_limit,
    parseInt(cooldown_seconds, 10) || existing.cooldown_seconds,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    now,
    ruleId
  );

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'REWARD_RULE_UPDATED',
    targetType: 'RewardRule',
    targetId: ruleId,
    targetName: name || existing.name,
    details: { ruleId, updates: req.body },
    ip: req.ip
  });

  const updated = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
  res.json({ message: 'Reward rule updated successfully.', rule: updated });
});

// 4. Toggle rule active/inactive
router.patch('/rules/:id/toggle', csrfProtection, (req, res) => {
  const db = getDatabase();
  const ruleId = req.params.id;
  const rule = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
  if (!rule) {
    return res.status(404).json({ error: 'Reward rule not found.' });
  }

  const newStatus = rule.is_active === 1 ? 0 : 1;
  const now = new Date().toISOString();
  db.prepare('UPDATE reward_rules SET is_active = ?, updated_at = ? WHERE id = ?').run(newStatus, now, ruleId);

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: newStatus === 1 ? 'REWARD_RULE_ACTIVATED' : 'REWARD_RULE_DEACTIVATED',
    targetType: 'RewardRule',
    targetId: ruleId,
    targetName: rule.name,
    details: { previousStatus: rule.is_active, newStatus },
    ip: req.ip
  });

  res.json({
    message: `Rule ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
    is_active: newStatus
  });
});

// 5. Delete reward rule
router.delete('/rules/:id', csrfProtection, (req, res) => {
  const db = getDatabase();
  const ruleId = req.params.id;
  const rule = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
  if (!rule) {
    return res.status(404).json({ error: 'Reward rule not found.' });
  }

  db.prepare('DELETE FROM reward_rules WHERE id = ?').run(ruleId);

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'REWARD_RULE_DELETED',
    targetType: 'RewardRule',
    targetId: ruleId,
    targetName: rule.name,
    ip: req.ip
  });

  res.json({ message: 'Rule deleted successfully.' });
});

// 5b. Apply reward rule in bulk to all eligible matching agents
router.post('/rules/:id/apply', csrfProtection, (req, res) => {
  const ruleId = parseInt(req.params.id, 10);
  const bypassCooldown = Boolean(req.body.bypassCooldown);

  try {
    const result = bulkGrantRewardRule(ruleId, {
      actor: `Admin (${req.admin.username})`,
      ip: req.ip,
      bypassCooldown
    });

    res.json({
      message: `Rule applied successfully to ${result.grantedCount} agent(s).`,
      result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Preview affected agents before rule activation or creation
router.post('/preview', (req, res) => {
  const { conditions = {} } = req.body;
  const conditionsJson = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
  const matchingAgents = previewRuleMatchingAgents(conditionsJson);

  let hasBeliefCondition = false;
  try {
    const parsed = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;
    if (parsed.belief_status) {
      hasBeliefCondition = true;
    }
  } catch (e) {}

  res.json({
    matchingCount: matchingAgents.length,
    matchingAgents,
    hasBeliefCondition,
    warning: hasBeliefCondition 
      ? 'WARNING: This rule evaluates characters based on their declared belief profile. Standard simulation reward rules should be based on actions, achievements, and cooperation.'
      : null
  });
});

// 7. Manual reward grant by an administrator
router.post('/grant', csrfProtection, (req, res) => {
  const { agentId, ruleId, amount, point_type, reason } = req.body;

  if (!agentId || !amount || !reason) {
    return res.status(400).json({ error: 'Agent, amount, and reason are required.' });
  }

  try {
    const result = grantRewardTransaction({
      agentId: parseInt(agentId, 10),
      ruleId: ruleId ? parseInt(ruleId, 10) : null,
      amount: parseFloat(amount),
      pointType: point_type || 'Merit Tokens',
      reason,
      actor: `Admin (${req.admin.username})`,
      ip: req.ip
    });

    res.status(201).json({ message: 'Reward granted successfully.', transaction: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Reward transactions history with filters & summaries
router.get('/transactions', (req, res) => {
  const db = getDatabase();
  const {
    agentId = '',
    ruleId = '',
    pointType = '',
    isReversal = '',
    search = '',
    page = 1,
    limit = 20
  } = req.query;

  const conditions = [];
  const params = [];

  if (agentId) {
    conditions.push('t.agent_id = ?');
    params.push(agentId);
  }

  if (ruleId) {
    conditions.push('t.rule_id = ?');
    params.push(ruleId);
  }

  if (pointType) {
    conditions.push('t.point_type = ?');
    params.push(pointType);
  }

  if (isReversal !== '') {
    conditions.push('t.is_reversal = ?');
    params.push(parseInt(isReversal, 10));
  }

  if (search.trim()) {
    conditions.push('(t.transaction_ref LIKE ? OR t.reason LIKE ? OR a.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Calculate summary metrics
  const summarySql = `
    SELECT 
      SUM(CASE WHEN is_reversal = 0 THEN amount ELSE 0 END) as totalIssued,
      SUM(CASE WHEN is_reversal = 1 THEN ABS(amount) ELSE 0 END) as totalReversed,
      COUNT(*) as totalTransactions
    FROM reward_transactions
  `;
  const summary = db.prepare(summarySql).get();

  // Total count matching current filters
  const countSql = `
    SELECT COUNT(*) as total
    FROM reward_transactions t
    JOIN agents a ON t.agent_id = a.id
    ${whereClause}
  `;
  const total = db.prepare(countSql).get(...params).total;

  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const listSql = `
    SELECT 
      t.*, 
      a.name as agent_name, 
      a.avatar as agent_avatar,
      r.name as rule_name
    FROM reward_transactions t
    JOIN agents a ON t.agent_id = a.id
    LEFT JOIN reward_rules r ON t.rule_id = r.id
    ${whereClause}
    ORDER BY t.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(listSql).all(...params, parsedLimit, offset);

  res.json({
    data: rows,
    summary: {
      totalIssued: summary.totalIssued || 0,
      totalReversed: summary.totalReversed || 0,
      netPoints: (summary.totalIssued || 0) - (summary.totalReversed || 0),
      totalTransactions: summary.totalTransactions || 0
    },
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  });
});

// 9. Reversal of a reward transaction
router.post('/transactions/:id/reverse', csrfProtection, (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A clear reason for reversal is required.' });
  }

  try {
    const result = reverseRewardTransaction({
      transactionId: parseInt(req.params.id, 10),
      reason: reason.trim(),
      actor: `Admin (${req.admin.username})`,
      ip: req.ip
    });

    res.json({ message: 'Transaction reversed successfully with offsetting record.', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

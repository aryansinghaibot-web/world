const crypto = require('crypto');
const { getDatabase, runTransaction } = require('../db/database');
const { logAuditEvent } = require('../security/middleware');

/**
 * Evaluate whether an agent meets the conditions of a reward rule.
 */
function evaluateRuleConditions(rule, agent, beliefProfile) {
  let conditions = {};
  try {
    conditions = typeof rule.conditions_json === 'string' 
      ? JSON.parse(rule.conditions_json) 
      : (rule.conditions_json || {});
  } catch (e) {
    conditions = {};
  }

  // 1. Administrative status check: Paused or deactivated agents cannot earn automatic rewards
  if (agent.runtime_status !== 'active') {
    return { matches: false, reason: 'Agent is not active in simulation' };
  }

  // 2. Activity condition
  if (conditions.activity && agent.activity !== conditions.activity) {
    return { matches: false, reason: `Activity ${agent.activity} does not match required ${conditions.activity}` };
  }

  // 3. Location condition
  if (conditions.location && agent.location !== conditions.location) {
    return { matches: false, reason: `Location ${agent.location} does not match required ${conditions.location}` };
  }

  // 4. Threshold conditions
  if (conditions.min_energy !== undefined && agent.energy < conditions.min_energy) {
    return { matches: false, reason: `Energy ${agent.energy.toFixed(1)} below required minimum ${conditions.min_energy}` };
  }
  if (conditions.min_happiness !== undefined && agent.happiness < conditions.min_happiness) {
    return { matches: false, reason: `Happiness ${agent.happiness.toFixed(1)} below required minimum ${conditions.min_happiness}` };
  }
  if (conditions.min_social !== undefined && agent.social_needs < conditions.min_social) {
    return { matches: false, reason: `Social needs ${agent.social_needs.toFixed(1)} below required minimum ${conditions.min_social}` };
  }

  // 5. Optional Belief Condition (For controlled experiments in simulation)
  // Requirement: "Never apply a reward rule to a character whose belief profile is unknown unless the rule explicitly defines that case."
  if (conditions.belief_status) {
    const agentBelief = beliefProfile ? beliefProfile.belief_status : 'Belief not specified';

    // If rule targets a specific belief, and agent's belief is unknown/unspecified,
    // only match if the rule condition specifically allowed 'Belief not specified'.
    if (conditions.belief_status !== agentBelief) {
      return { matches: false, reason: `Belief profile "${agentBelief}" does not match condition "${conditions.belief_status}"` };
    }
  }

  return { matches: true, reason: 'All rule criteria satisfied' };
}

/**
 * Preview affected agents for a proposed or existing reward rule.
 */
function previewRuleMatchingAgents(ruleConditionsJson) {
  const db = getDatabase();
  const agents = db.prepare(`
    SELECT a.*, b.belief_status, b.declared_source 
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    WHERE a.runtime_status = 'active'
  `).all();

  const dummyRule = { conditions_json: ruleConditionsJson };
  const matches = [];

  for (const agent of agents) {
    const beliefObj = { belief_status: agent.belief_status, declared_source: agent.declared_source };
    const evalRes = evaluateRuleConditions(dummyRule, agent, beliefObj);
    if (evalRes.matches) {
      matches.push({
        id: agent.id,
        name: agent.name,
        occupation: agent.occupation,
        location: agent.location,
        activity: agent.activity,
        belief_status: agent.belief_status || 'Belief not specified',
        current_rewards: agent.reward_points
      });
    }
  }

  return matches;
}

/**
 * Check duplicate reward prevention.
 * Returns true if agent has already received this reward rule within cooldown.
 */
function isDuplicateReward(db, agentId, ruleId, cooldownSeconds = 60) {
  if (!ruleId) return false;

  const lastTx = db.prepare(`
    SELECT created_at FROM reward_transactions
    WHERE agent_id = ? AND rule_id = ? AND is_reversal = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(agentId, ruleId);

  if (!lastTx) return false;

  const elapsedSeconds = (Date.now() - new Date(lastTx.created_at).getTime()) / 1000;
  return elapsedSeconds < cooldownSeconds;
}

/**
 * Grant a reward transaction atomically.
 */
function grantRewardTransaction({
  agentId,
  ruleId = null,
  amount,
  pointType = 'Merit Tokens',
  reason,
  actor,
  ip = null
}) {
  if (!agentId || !amount || amount <= 0) {
    throw new Error('Valid agent ID and positive reward amount are required.');
  }

  return runTransaction((db) => {
    // 1. Verify agent exists
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found.`);
    }

    // 2. Check rule constraints if ruleId provided
    if (ruleId) {
      const rule = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
      if (!rule) {
        throw new Error(`Reward rule #${ruleId} not found.`);
      }
      if (!rule.is_active) {
        throw new Error(`Reward rule #${ruleId} is currently deactivated.`);
      }

      // Check min/max limits
      if (amount < rule.min_limit || amount > rule.max_limit) {
        throw new Error(`Amount ${amount} is outside allowed limits (${rule.min_limit} - ${rule.max_limit}).`);
      }

      // Check duplicate / cooldown
      if (isDuplicateReward(db, agentId, ruleId, rule.cooldown_seconds)) {
        throw new Error(`Duplicate reward prevention active for agent #${agentId}. Cooldown has not expired.`);
      }
    }

    // 3. Generate unique transaction reference
    const txRef = 'TX-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const now = new Date().toISOString();

    // 4. Update agent reward balance
    db.prepare('UPDATE agents SET reward_points = reward_points + ?, updated_at = ? WHERE id = ?')
      .run(amount, now, agentId);

    // 5. Insert transaction record
    const result = db.prepare(`
      INSERT INTO reward_transactions (
        transaction_ref, agent_id, rule_id, amount, point_type, reason, actor, status, is_reversal, original_transaction_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 0, NULL, ?)
    `).run(txRef, agentId, ruleId, amount, pointType, reason, actor, now);

    const txId = result.lastInsertRowid;

    // 6. Log audit event
    logAuditEvent({
      actor,
      action: 'REWARD_GRANTED',
      targetType: 'RewardTransaction',
      targetId: txId,
      targetName: `Agent ${agent.name} (+${amount} ${pointType})`,
      details: { agentId, ruleId, amount, pointType, reason, txRef },
      ip
    });

    return {
      transactionId: txId,
      transactionRef: txRef,
      agentId,
      agentName: agent.name,
      amount,
      pointType,
      newBalance: agent.reward_points + amount
    };
  });
}

/**
 * Reverse a reward transaction atomically.
 * Does not delete the original transaction; records an offsetting reversal row.
 */
function reverseRewardTransaction({
  transactionId,
  reason,
  actor,
  ip = null
}) {
  if (!transactionId || !reason) {
    throw new Error('Transaction ID and reversal reason are required.');
  }

  return runTransaction((db) => {
    // 1. Fetch original transaction
    const original = db.prepare('SELECT * FROM reward_transactions WHERE id = ?').get(transactionId);
    if (!original) {
      throw new Error(`Transaction #${transactionId} not found.`);
    }

    if (original.is_reversal === 1) {
      throw new Error('Cannot reverse a transaction that is already a reversal record.');
    }

    if (original.status === 'reversed') {
      throw new Error('This transaction has already been reversed.');
    }

    // 2. Fetch agent
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(original.agent_id);
    if (!agent) {
      throw new Error(`Target agent #${original.agent_id} not found.`);
    }

    const now = new Date().toISOString();
    const reversalRef = 'REV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // 3. Mark original transaction as reversed
    db.prepare("UPDATE reward_transactions SET status = 'reversed' WHERE id = ?").run(transactionId);

    // 4. Subtract agent points (bounded at 0 minimum for balance safety)
    const newBalance = Math.max(0, agent.reward_points - original.amount);
    db.prepare('UPDATE agents SET reward_points = ?, updated_at = ? WHERE id = ?')
      .run(newBalance, now, agent.id);

    // 5. Insert explicit offsetting reversal record
    const result = db.prepare(`
      INSERT INTO reward_transactions (
        transaction_ref, agent_id, rule_id, amount, point_type, reason, actor, status, is_reversal, original_transaction_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 1, ?, ?)
    `).run(
      reversalRef,
      original.agent_id,
      original.rule_id,
      -original.amount,
      original.point_type,
      `Reversal of ${original.transaction_ref}: ${reason}`,
      actor,
      transactionId,
      now
    );

    const revId = result.lastInsertRowid;

    // 6. Log audit event
    logAuditEvent({
      actor,
      action: 'REWARD_REVERSED',
      targetType: 'RewardTransaction',
      targetId: revId,
      targetName: `Reversal of ${original.transaction_ref} for ${agent.name}`,
      details: { originalTxId: transactionId, amountReversed: original.amount, reason, reversalRef },
      ip
    });

    return {
      reversalId: revId,
      reversalRef,
      originalTxId: transactionId,
      agentId: agent.id,
      agentName: agent.name,
      reversedAmount: original.amount,
      newBalance
    };
  });
}

/**
 * Bulk apply a reward rule to all eligible matching agents atomically.
 */
function bulkGrantRewardRule(ruleId, { actor, ip = null, bypassCooldown = false }) {
  if (!ruleId) {
    throw new Error('Reward rule ID is required.');
  }

  return runTransaction((db) => {
    const rule = db.prepare('SELECT * FROM reward_rules WHERE id = ?').get(ruleId);
    if (!rule) {
      throw new Error(`Reward rule #${ruleId} not found.`);
    }
    if (!rule.is_active) {
      throw new Error(`Reward rule "${rule.name}" is currently deactivated.`);
    }

    // Fetch active agents and their belief profiles
    const agents = db.prepare(`
      SELECT a.*, b.belief_status, b.declared_source 
      FROM agents a
      LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
      WHERE a.runtime_status = 'active'
    `).all();

    const matchingAgents = [];
    for (const agent of agents) {
      const beliefObj = { belief_status: agent.belief_status, declared_source: agent.declared_source };
      const evalRes = evaluateRuleConditions(rule, agent, beliefObj);
      if (evalRes.matches) {
        matchingAgents.push(agent);
      }
    }

    if (matchingAgents.length === 0) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        grantedCount: 0,
        skippedCount: 0,
        totalAmountGranted: 0,
        transactions: [],
        message: 'No active agents currently match the rule criteria.'
      };
    }

    const granted = [];
    const skipped = [];
    const now = new Date().toISOString();

    for (const agent of matchingAgents) {
      // Check duplicate / cooldown unless explicitly bypassed
      if (!bypassCooldown && isDuplicateReward(db, agent.id, rule.id, rule.cooldown_seconds)) {
        skipped.push({ agentId: agent.id, name: agent.name, reason: 'Cooldown active' });
        continue;
      }

      const txRef = 'TX-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

      // Update agent reward points
      db.prepare('UPDATE agents SET reward_points = reward_points + ?, updated_at = ? WHERE id = ?')
        .run(rule.amount, now, agent.id);

      // Insert transaction record
      const res = db.prepare(`
        INSERT INTO reward_transactions (
          transaction_ref, agent_id, rule_id, amount, point_type, reason, actor, status, is_reversal, original_transaction_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 0, NULL, ?)
      `).run(txRef, agent.id, rule.id, rule.amount, rule.point_type, `Bulk rule trigger: ${rule.name}`, actor, now);

      granted.push({
        transactionId: res.lastInsertRowid,
        transactionRef: txRef,
        agentId: agent.id,
        name: agent.name,
        amount: rule.amount
      });
    }

    // Log bulk audit event
    logAuditEvent({
      actor,
      action: 'REWARD_BULK_APPLIED',
      targetType: 'RewardRule',
      targetId: rule.id,
      targetName: rule.name,
      details: {
        ruleId: rule.id,
        ruleName: rule.name,
        amountPerAgent: rule.amount,
        pointType: rule.point_type,
        grantedCount: granted.length,
        skippedCount: skipped.length,
        totalAmountGranted: granted.length * rule.amount
      },
      ip
    });

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      grantedCount: granted.length,
      skippedCount: skipped.length,
      totalAmountGranted: granted.length * rule.amount,
      transactions: granted,
      skipped
    };
  });
}

module.exports = {
  evaluateRuleConditions,
  previewRuleMatchingAgents,
  isDuplicateReward,
  grantRewardTransaction,
  reverseRewardTransaction,
  bulkGrantRewardRule
};

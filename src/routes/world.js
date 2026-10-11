const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const engine = require('../simulation/engine');

// Returns live snapshot of simulation world
router.get('/snapshot', (req, res) => {
  const db = getDatabase();

  // Snapshot from engine
  const snapshot = engine.getStateSnapshot();

  // Calculate high-level KPIs directly from live database
  const totalAgents = db.prepare('SELECT COUNT(*) as c FROM agents').get().c;
  const livingAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
  const deceasedAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;
  const activeAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'active'").get().c;
  const pausedAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'paused'").get().c;
  const deactivatedAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deactivated'").get().c;
  
  // Notice: A sleeping agent can still be active! Count sleeping among all agents
  const sleepingAgents = db.prepare("SELECT COUNT(*) as c FROM agents WHERE activity = 'sleeping'").get().c;
  const totalBorn = db.prepare('SELECT COUNT(*) as c FROM agents WHERE parent_a_id IS NOT NULL').get().c;
  const maxGenRow = db.prepare('SELECT MAX(generation) as m FROM agents').get();
  const maxGeneration = (maxGenRow && maxGenRow.m) ? maxGenRow.m : 1;

  // Prayer & Mannat KPIs
  const pendingPrayers = db.prepare("SELECT COUNT(*) as c FROM prayers_and_mannats WHERE status = 'pending'").get().c;
  const fulfilledPrayers = db.prepare("SELECT COUNT(*) as c FROM prayers_and_mannats WHERE status = 'fulfilled'").get().c;
  const unfulfilledPrayers = db.prepare("SELECT COUNT(*) as c FROM prayers_and_mannats WHERE status = 'unfulfilled'").get().c;

  // Activities breakdown
  const activityRows = db.prepare(`
    SELECT activity, COUNT(*) as count
    FROM agents
    GROUP BY activity
  `).all();
  const activities = {
    working: 0,
    eating: 0,
    walking: 0,
    resting: 0,
    socializing: 0,
    sleeping: 0
  };
  for (const row of activityRows) {
    if (activities[row.activity] !== undefined) {
      activities[row.activity] = row.count;
    }
  }

  // Belief profile counts
  const beliefRows = db.prepare(`
    SELECT b.belief_status, COUNT(a.id) as count
    FROM agents a
    LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    GROUP BY b.belief_status
  `).all();
  const beliefs = {
    'Trusts in God': 0,
    'Does not trust in God': 0,
    'Unsure or undecided': 0,
    'Belief not specified': 0
  };
  for (const row of beliefRows) {
    const key = row.belief_status || 'Belief not specified';
    beliefs[key] = (beliefs[key] || 0) + row.count;
  }

  // Rewards metrics
  const rewardsSummary = db.prepare(`
    SELECT 
      SUM(CASE WHEN is_reversal = 0 THEN amount ELSE 0 END) as issued,
      SUM(CASE WHEN is_reversal = 1 THEN ABS(amount) ELSE 0 END) as reversed,
      COUNT(*) as count
    FROM reward_transactions
  `).get();

  // Recent administrative activity (last 5 audit items)
  const recentAdminLogs = db.prepare(`
    SELECT id, timestamp, actor, action, target_type, target_name, details
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 6
  `).all();

  res.json({
    worldTime: snapshot.worldTime,
    isNight: snapshot.isNight,
    weather: snapshot.weather,
    isRunning: snapshot.isRunning,
    locations: snapshot.locations,
    agents: snapshot.agents,
    recentEvents: snapshot.recentEvents,
    recentAdminLogs,
    settings: snapshot.settings,
    kpis: {
      totalAgents,
      livingAgents,
      deceasedAgents,
      activeAgents,
      pausedAgents,
      deactivatedAgents,
      sleepingAgents,
      totalBorn,
      maxGeneration,
      pendingPrayers,
      fulfilledPrayers,
      unfulfilledPrayers,
      activities,
      beliefs,
      tech: {
        level: (snapshot.settings && snapshot.settings.tech_level !== undefined) ? snapshot.settings.tech_level : 120.0,
        growthRate: (snapshot.settings && snapshot.settings.tech_growth_rate !== undefined) ? snapshot.settings.tech_growth_rate : 1.0,
        era: (snapshot.settings && snapshot.settings.tech_era) || 'Digital & Cybernetic Age',
        discoveries: (() => { try { return JSON.parse(snapshot.settings.tech_discoveries || '[]'); } catch(e){ return []; } })(),
        timeSpeedMultiplier: (snapshot.settings && snapshot.settings.time_speed_multiplier !== undefined) ? snapshot.settings.time_speed_multiplier : 1.0
      },
      rewards: {
        totalIssued: rewardsSummary.issued || 0,
        totalReversed: rewardsSummary.reversed || 0,
        netPoints: (rewardsSummary.issued || 0) - (rewardsSummary.reversed || 0),
        transactionCount: rewardsSummary.count || 0
      }
    }
  });
});

module.exports = router;

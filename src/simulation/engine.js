const { getDatabase, runTransaction } = require('../db/database');
const { LOCATIONS } = require('./locations');
const { generateAgentDecision, generateAgentConversation, generateNewbornChild, generateAgentPrayerOrMannat } = require('./gemini-ai');
const { getPortraitUrl } = require('./portrait-service');
const { evaluateRuleConditions, grantRewardTransaction } = require('../rewards/engine');
const { logAuditEvent } = require('../security/middleware');

class SimulationEngine {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.tickCount = 0;
    this.currentMinute = 9 * 60; // Start at 09:00 AM (in minutes)
    this.currentDay = 1;
    this.recentEvents = [];
    this.lastBirthTickMap = new Map();
    this.lastPrayerTickMap = new Map();
    this.pendingBirthDeficit = 0;
    this.pendingMortalityQuota = 0;
    this.birthsSinceLastMortality = 0;
    this.lastMortalityTick = 0;
  }

  init() {
    const db = getDatabase();
    try {
      db.prepare(`
        UPDATE simulation_settings
        SET max_population = 2500, max_natural_age = 72, enable_natural_death = 1, enable_illness_death = 1, reproduction_enabled = 1
        WHERE id = 1 AND max_population < 1000
      `).run();
    } catch (e) {}
    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get();
    if (settings) {
      if (settings.is_running === 1) {
        this.start(settings.tick_rate_ms);
      }
    }
  }

  start(intervalMs = 3000) {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.tick().catch(err => console.error('Simulation tick error:', err));
    }, intervalMs);
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    const db = getDatabase();
    db.prepare('UPDATE simulation_settings SET is_running = 1, tick_rate_ms = ?, updated_at = ? WHERE id = 1')
      .run(intervalMs, new Date().toISOString());

    this.addEvent('SIMULATION_STARTED', `Simulation engine started with tick rate ${intervalMs}ms.`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;

    const db = getDatabase();
    db.prepare('UPDATE simulation_settings SET is_running = 0, updated_at = ? WHERE id = 1')
      .run(new Date().toISOString());

    this.addEvent('SIMULATION_STOPPED', 'Simulation engine paused.');
  }

  addEvent(type, message, details = {}) {
    const event = {
      id: 'EVT-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 50) {
      this.recentEvents.pop();
    }
  }

  /**
   * Advance simulation world clock by 10 virtual minutes per tick.
   */
  advanceClock(db) {
    const settings = db.prepare('SELECT time_speed_multiplier FROM simulation_settings WHERE id = 1').get() || {};
    const speed = settings.time_speed_multiplier !== undefined ? Math.max(0.1, parseFloat(settings.time_speed_multiplier)) : 1.0;
    const minutesToAdvance = Math.max(1, Math.round(10 * speed));

    this.currentMinute += minutesToAdvance;
    if (this.currentMinute >= 24 * 60) {
      const daysPassed = Math.floor(this.currentMinute / (24 * 60));
      this.currentMinute = this.currentMinute % (24 * 60);
      this.currentDay += daysPassed;
    }

    const hours = Math.floor(this.currentMinute / 60);
    const mins = this.currentMinute % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const pad = (n) => String(n).padStart(2, '0');
    const isNight = hours >= 22 || hours < 6;
    const timeStr = `${pad(displayHour)}:${pad(mins)} ${ampm} (Day ${this.currentDay})${isNight ? ' 🌙 Night' : ' ☀️ Day'}`;

    // Random weather shift rarely
    let weather = isNight ? 'Clear Night Sky' : 'Sunny';
    if (this.tickCount % 20 > 15) weather = 'Pleasant Breeze';
    else if (this.tickCount % 20 > 18) weather = 'Light Rain';

    db.prepare('UPDATE simulation_settings SET world_time = ?, weather = ?, updated_at = ? WHERE id = 1')
      .run(timeStr, weather, new Date().toISOString());

    return { timeStr, weather, speed, isNight, currentHour: hours };
  }

  /**
   * Execute single simulation tick.
   */
  async tick() {
    const db = getDatabase();
    this.tickCount++;
    const { timeStr, weather, isNight, currentHour } = this.advanceClock(db);
    const isNightTime = isNight;
    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get() || {};

    // Fetch all active agents
    const agents = db.prepare(`
      SELECT a.*, b.belief_status, b.declared_source, b.notes as belief_notes
      FROM agents a
      LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    `).all();

    // Fetch active reward rules
    const activeRules = db.prepare('SELECT * FROM reward_rules WHERE is_active = 1').all();

    for (const agent of agents) {
      // 1. Check administrative & life status:
      // Deceased, paused, or deactivated agents DO NOT decay needs, move, or make autonomous decisions.
      if (agent.runtime_status === 'paused' || agent.runtime_status === 'deactivated' || agent.runtime_status === 'deceased') {
        continue;
      }

      // 2. Active agent dynamics
      let { hunger, energy, happiness, social_needs, virtual_balance, location, activity } = agent;
      let decisionReason = agent.last_decision_reason;
      let health = agent.health !== undefined ? agent.health : 95.0;
      let stress = agent.stress !== undefined ? agent.stress : 20.0;
      let emotion = agent.emotion || 'hopeful';
      let age = agent.age !== undefined ? agent.age : 32;
      let effectiveRuntimeStatus = agent.runtime_status;

      // Diurnal time-based state transitions (Day / Night cycle):
      if (isNightTime) {
        // At night (10:00 PM - 06:00 AM), living citizens automatically retire to sleep at Residential Complex
        if (activity !== 'sleeping') {
          activity = 'sleeping';
          location = 'Residential Complex';
          decisionReason = 'Night time arrived (10:00 PM - 06:00 AM). Retired to Residential Complex for sleep and rest.';
        }
        effectiveRuntimeStatus = 'sleeping';
        // Deep energy recharge and stress reduction during night sleep
        energy = Math.min(100, energy + 8.0);
        hunger = Math.max(0, hunger - 0.4);
        stress = Math.max(0, stress - 2.0);
        if (health < 98) health = Math.min(100, health + 0.8);
      } else {
        // Daytime (06:00 AM - 10:00 PM): if agent was sleeping, wake up automatically!
        if (activity === 'sleeping' || agent.runtime_status === 'sleeping') {
          activity = hunger < 55 ? 'eating' : 'working';
          location = hunger < 55 ? 'Sunny Cafe' : 'Workplace (Tech Hub)';
          effectiveRuntimeStatus = 'active';
          decisionReason = 'Morning arrived. Woke up refreshed from night sleep and began daily routine.';
        }

        // Handle daytime needs changes based on current activity
        if (activity === 'eating') {
          hunger = Math.min(100, hunger + 18.0);
          energy = Math.min(100, energy + 2.0);
          stress = Math.max(0, stress - 1.0);
          virtual_balance = Math.max(0, virtual_balance - 4.0); // Cost of meal
          if (hunger >= 85) {
            activity = 'resting';
            decisionReason = `Satisfied appetite; taking a moment to relax.`;
          }
        } else if (activity === 'working') {
          energy = Math.max(0, energy - 2.5);
          hunger = Math.max(0, hunger - 1.8);
          stress = Math.min(100, stress + 1.2);
          virtual_balance += 6.0; // Earn wages
          happiness = Math.max(0, happiness - 0.8);
        } else if (activity === 'socializing') {
          social_needs = Math.min(100, social_needs + 12.0);
          happiness = Math.min(100, happiness + 4.0);
          stress = Math.max(0, stress - 2.0);
          energy = Math.max(0, energy - 1.0);
          hunger = Math.max(0, hunger - 1.0);
        } else if (activity === 'resting') {
          energy = Math.min(100, energy + 3.0);
          happiness = Math.min(100, happiness + 1.5);
          stress = Math.max(0, stress - 1.8);
          hunger = Math.max(0, hunger - 0.8);
          if (health < 95) health = Math.min(100, health + 0.5);
        } else if (activity === 'walking') {
          energy = Math.max(0, energy - 1.5);
          hunger = Math.max(0, hunger - 1.2);
          happiness = Math.min(100, happiness + 1.0);
        }
      }

      // Check severe malnutrition or exhaustion impacting health
      if (hunger < 15 || energy < 10) {
        health = Math.max(0, health - 1.5);
        stress = Math.min(100, stress + 2.5);
      }

      // Dynamic emotion update (preserving grief mourning period if active)
      if (emotion !== 'grief') {
        if (health < 30) {
          emotion = 'fear';
        } else if (stress > 65) {
          emotion = 'exhausted';
        } else if (happiness > 82 && health > 80) {
          emotion = 'happy';
        } else if (activity === 'resting' || activity === 'sleeping') {
          emotion = 'peaceful';
        } else {
          emotion = 'hopeful';
        }
      }

      // Check medically plausible health and mortality events
      const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get() || {};
      const mortalityMult = settings.mortality_rate || 1.0;

      // Illness death if health is critical
      if (settings.enable_illness_death && health < 8 && Math.random() < (0.04 * mortalityMult)) {
        this.executeAgentDeath(agent.id, 'Critical Illness & Physical Exhaustion', 'Natural Simulation Cycle');
        this.pendingBirthDeficit += 2;
        continue;
      }

      // Check threshold transitions during daytime
      if (!isNightTime) {
        if (activity !== 'sleeping' && energy < 18) {
          activity = 'sleeping';
          location = 'Residential Complex';
          decisionReason = `Energy depleted to ${energy.toFixed(0)}%; safely resting at Residential Complex.`;
        } else if (activity !== 'eating' && activity !== 'sleeping' && hunger < 22) {
          activity = 'eating';
          location = 'Sunny Cafe';
          decisionReason = `Hunger fell to critical level (${hunger.toFixed(0)}%); ordered meal at Sunny Cafe.`;
        } else if (this.tickCount % 3 === 0 && activity !== 'sleeping' && Math.random() < 0.06) {
          // Regular autonomous decision cycle for active sample
          const nearby = agents.filter(other => other.id !== agent.id && other.location === location && other.runtime_status === 'active');
          const decision = await generateAgentDecision({
            agent: { ...agent, hunger, energy, happiness, social_needs, health, stress, emotion },
            currentLocation: location,
            nearbyAgents: nearby,
            worldTime: timeStr,
            weather
          });

          if (decision) {
            activity = decision.nextActivity;
            location = decision.targetLocation;
            decisionReason = decision.reason;
          }
        }
      }

      // Compute coordinate based on target location for visual canvas
      const locInfo = LOCATIONS[location] || LOCATIONS['Town Square'];
      const targetX = locInfo.x + (Math.sin(agent.id + this.tickCount * 0.2) * (locInfo.width * 0.35));
      const targetY = locInfo.y + (Math.cos(agent.id + this.tickCount * 0.2) * (locInfo.height * 0.35));

      // Update agent in database
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE agents SET
          hunger = ?, energy = ?, happiness = ?, social_needs = ?, virtual_balance = ?,
          health = ?, stress = ?, emotion = ?,
          location = ?, activity = ?, runtime_status = ?, last_decision_reason = ?, last_decision_time = ?,
          x_coord = ?, y_coord = ?, updated_at = ?
        WHERE id = ?
      `).run(
        hunger, energy, happiness, social_needs, virtual_balance,
        health, stress, emotion,
        location, activity, effectiveRuntimeStatus, decisionReason, now,
        targetX, targetY, now, agent.id
      );

      // Check simulated autonomous belief reflection event rarely (e.g. once every ~30 ticks per agent)
      if (this.tickCount % 25 === 0 && Math.random() < 0.25) {
        this.triggerAutonomousBeliefEvent(db, agent, location);
      }

      // Evaluate automatic reward rules
      for (const rule of activeRules) {
        const beliefObj = { belief_status: agent.belief_status, declared_source: agent.declared_source };
        const evalRes = evaluateRuleConditions(rule, { ...agent, hunger, energy, happiness, social_needs, location, activity }, beliefObj);
        if (evalRes.matches) {
          try {
            grantRewardTransaction({
              agentId: agent.id,
              ruleId: rule.id,
              amount: rule.amount,
              pointType: rule.point_type,
              reason: `Autonomous rule trigger: ${rule.name}`,
              actor: `System (Rule #${rule.id}: ${rule.name})`
            });
            this.addEvent('REWARD_AUTOMATIC_TRIGGER', `${agent.name} awarded ${rule.amount} ${rule.point_type} by "${rule.name}".`);
          } catch (e) {
            // Duplicate prevention / cooldown or limits caught safely
          }
        }
      }
    }

    // Check for nearby agents to spark conversations
    this.checkForConversations(db, agents);

    // 1. Natural Aging & Youth Maturation
    this.processAgingAndMaturation(db, agents);

    // 2. Automatic Demographic Mortality (Elderly Natural Passing & Illness)
    await this.processAutomaticMortality(db, agents, settings);

    // 3. Automatic Reproduction & Population Growth Tied to Deaths
    await this.processAutomaticReproduction(db, agents, settings);

    // Autonomous Spiritual Reflection, Prayers & Mannats
    await this.checkSpiritualReflections(db, agents);

    // Science & Technology Progression System tied directly to Time Speed
    this.updateScienceAndTechnology(db, agents);
  }

  /**
   * Autonomous belief development through simulated life experiences or philosophical discourse.
   * "Allow agents to develop or update their profile through simulated experiences or explicit choices.
   * Do not automatically infer a belief from names, appearance, location, dialogue keywords, or unrelated behaviour."
   */
  triggerAutonomousBeliefEvent(db, agent, location) {
    const options = ['Trusts in God', 'Does not trust in God', 'Unsure or undecided'];
    const currentBelief = agent.belief_status;
    const candidates = options.filter(o => o !== currentBelief);
    const newBelief = candidates[Math.floor(Math.random() * candidates.length)];
    const sources = [
      'Autonomous Philosophical Reflection following deep library study',
      'Personal Simulated Life Event during community project',
      'Autonomous Ethical Dialogue with town peers'
    ];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO agent_belief_profiles (agent_id, belief_status, declared_source, notes, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        belief_status = excluded.belief_status,
        declared_source = excluded.declared_source,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).run(agent.id, newBelief, source, `Autonomous development during simulated cycle at ${location}`, now);

    // Record in agent memory
    db.prepare(`
      INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
      VALUES (?, ?, 0.6, 'private', ?)
    `).run(agent.id, `Contemplated personal philosophy and self-defined belief profile: "${newBelief}".`, now);

    // Audit log
    logAuditEvent({
      actor: `Autonomous Agent #${agent.id} (${agent.name})`,
      action: 'BELIEF_PROFILE_UPDATED',
      targetType: 'BeliefProfile',
      targetId: agent.id,
      targetName: agent.name,
      details: { previous: currentBelief, updatedTo: newBelief, source, reason: 'Autonomous simulated life event' }
    });

    this.addEvent('BELIEF_PROFILE_DEVELOPMENT', `${agent.name} autonomously updated belief profile to "${newBelief}".`, {
      agentId: agent.id,
      source
    });
  }

  /**
   * Detect agents in the same location and generate conversational interaction.
   */
  checkForConversations(db, agents) {
    const activeInTown = agents.filter(a => a.runtime_status === 'active' && a.activity !== 'sleeping');
    const locMap = {};
    for (const a of activeInTown) {
      if (!locMap[a.location]) locMap[a.location] = [];
      locMap[a.location].push(a);
    }

    for (const loc of Object.keys(locMap)) {
      const group = locMap[loc];
      if (group.length >= 2 && Math.random() < 0.3) {
        const a1 = group[0];
        const a2 = group[1];
        const conv = generateAgentConversation(a1, a2, loc);
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO agent_conversations (agent_a_id, agent_b_id, topic, snippet, location, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(a1.id, a2.id, conv.topic, conv.snippet, loc, now);

        this.addEvent('AGENT_CONVERSATION', conv.snippet, { topic: conv.topic, location: loc });
      }
    }
  }

  /**
   * Autonomous demographic aging and youth career maturation
   */
  /**
   * Autonomous demographic aging and youth career maturation
   * Accelerates directly with time_speed_multiplier (higher speed = faster aging & quicker mortality)
   */
  processAgingAndMaturation(db, agents) {
    const settings = db.prepare('SELECT time_speed_multiplier, aging_speed FROM simulation_settings WHERE id = 1').get() || {};
    const speed = settings.time_speed_multiplier !== undefined ? Math.max(0.1, parseFloat(settings.time_speed_multiplier)) : 1.0;
    const agingMult = settings.aging_speed !== undefined ? Math.max(0.1, parseFloat(settings.aging_speed)) : 1.0;
    const effectiveSpeed = speed * agingMult;
    
    const agingCadence = Math.max(1, Math.round(5 / effectiveSpeed));
    if (this.tickCount % agingCadence !== 0) return;
    const now = new Date().toISOString();

    // Increment age for living agents per cycle (batch size scales with speed)
    const batchSize = Math.min(100, Math.round(20 * Math.max(1, effectiveSpeed)));
    db.prepare(`
      UPDATE agents
      SET age = age + 1, updated_at = ?
      WHERE runtime_status != 'deceased' AND id IN (
        SELECT id FROM agents WHERE runtime_status != 'deceased' ORDER BY RANDOM() LIMIT ?
      )
    `).run(now, batchSize);

    // Promote graduated youths (age >= 18 who are still labeled Infants/Newborns)
    const graduated = db.prepare(`
      SELECT * FROM agents
      WHERE age >= 18 AND occupation LIKE '%Infant%' AND runtime_status != 'deceased'
      LIMIT 6
    `).all();

    const adultCareers = [
      'Junior Software Engineer', 'Urban Architect', 'Bio-Medical Researcher',
      'Renewable Energy Technician', 'Digital Sculptor & Artist', 'Global Trade Specialist',
      'Philosophical Scholar', 'Ecological Botanist', 'Community Medic', 'Artisan Baker'
    ];

    for (const youth of graduated) {
      const newCareer = adultCareers[Math.floor(Math.random() * adultCareers.length)];
      db.prepare(`
        UPDATE agents
        SET occupation = ?, avatar = '🧑', updated_at = ?
        WHERE id = ?
      `).run(newCareer, now, youth.id);

      this.addEvent('AGENT_MATURATION', `🎓 युवा का पदार्पण (Youth Graduation): ${youth.name} 18 वर्ष के हुए और उन्होंने ${newCareer} के रूप में आत्मनिर्भर जीवन शुरू किया!`);
    }
  }

  /**
   * Automatic continuous mortality system ("automatic logo ki maut hone lag jaye")
   * Evaluates elderly, frail, or illness-impacted citizens for natural life conclusion.
   * Speed-coupled: as simulation speed increases (e.g. 2x, 5x, 10x), deaths occur much faster!
   */
  async processAutomaticMortality(db, agents, settings) {
    if (settings && settings.enable_natural_death === 0 && settings.enable_illness_death === 0) return;

    const speed = settings.time_speed_multiplier !== undefined ? Math.max(0.1, parseFloat(settings.time_speed_multiplier)) : 1.0;
    const mortalityRate = (settings && settings.mortality_rate !== undefined) ? Math.max(0.2, parseFloat(settings.mortality_rate)) : 1.0;

    // Direct birth-death coupling and speed scaling:
    // When speed increases, cadence becomes faster (down to every 1 tick)
    const hasBirthQuota = this.pendingMortalityQuota > 0;
    const mortalityCadence = Math.max(1, Math.round(3 / (speed * mortalityRate)));

    if (!hasBirthQuota && (this.tickCount % mortalityCadence !== 0)) return;

    // Higher speed executes more mortality checks per tick so deaths happen quickly
    const deathsToProcess = (speed >= 3.0) ? Math.min(3, Math.floor((speed * mortalityRate) / 2)) : 1;

    for (let d = 0; d < deathsToProcess; d++) {
      // Pool of living agents
      const living = db.prepare(`
        SELECT * FROM agents
        WHERE runtime_status != 'deceased' AND runtime_status != 'paused' AND runtime_status != 'deactivated'
        ORDER BY age DESC
      `).all();

      if (living.length === 0) break;

      let candidate = null;
      let cause = 'Natural Causes (Elder Age)';

      // Priority 1: Senior citizen (age >= 68)
      const elders = living.filter(a => a.age >= (settings.max_natural_age || 70));
      if (elders.length > 0) {
        candidate = elders[0];
        const elderCauses = [
          `Natural Causes (Peaceful Passing in Old Age at ${candidate.age} yrs)`,
          `Age-Related Cardiovascular Rest (${candidate.age} yrs)`,
          `Completion of Life Journey & Eternal Peace (Age ${candidate.age})`
        ];
        cause = elderCauses[Math.floor(Math.random() * elderCauses.length)];
      } else {
        // Priority 2: Critical health / exhaustion
        const frail = living.filter(a => a.health < 28 || a.stress > 82);
        if (frail.length > 0) {
          candidate = frail[0];
          cause = `Severe Vital Exhaustion & Illness (Health ${Math.round(candidate.health)}%)`;
        } else {
          // Priority 3: Senior-most citizen in the simulation
          candidate = living[0];
          cause = `Natural Causes (Peaceful Passing in Advanced Age, ${candidate.age} yrs)`;
        }
      }

      if (candidate) {
        this.executeAgentDeath(candidate.id, cause, 'Autonomous Life-Cycle Engine');
        this.lastMortalityTick = this.tickCount;

        const deceasedCount = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;
        const livingCount = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
        const totalBorn = db.prepare("SELECT COUNT(*) as c FROM agents WHERE parent_a_id IS NOT NULL").get().c;

        if (this.pendingMortalityQuota > 0) {
          this.pendingMortalityQuota--;
          this.addEvent('MORTALITY_EVENT', `🕯️ जन्म-संतुलित त्वरित देहावसान (Speed ${speed}x): ${candidate.name} (आयु ${candidate.age} वर्ष) का देहावसान हुआ (${cause}) [जन्म के अनुपात में त्वरित मृत्यु चक्र]। कुल जन्म: ${totalBorn} | कुल मौतें: ${deceasedCount} | जीवित जनसंख्या: ${livingCount}`);
        } else {
          this.pendingBirthDeficit += 1;
          this.addEvent('MORTALITY_EVENT', `🕯️ त्वरित गति देहावसान (Speed ${speed}x Passing): ${candidate.name} (आयु ${candidate.age} वर्ष) का देहावसान हुआ (${cause})। कुल मौतें: ${deceasedCount} | जीवित जनसंख्या: ${livingCount}`);
        }
      }
    }
  }

  /**
   * Quick manual mortality event trigger from the Death System button
   */
  triggerInstantMortality(cause = null, actor = 'Administrator') {
    const db = getDatabase();
    const living = db.prepare(`
      SELECT * FROM agents
      WHERE runtime_status != 'deceased' AND runtime_status != 'paused' AND runtime_status != 'deactivated'
      ORDER BY age DESC
    `).all();

    if (living.length === 0) return { error: 'No living citizens available.' };

    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get() || {};
    let candidate = null;
    let chosenCause = cause;

    const elders = living.filter(a => a.age >= (settings.max_natural_age || 70));
    if (elders.length > 0) {
      candidate = elders[0];
      if (!chosenCause) chosenCause = `Natural Causes (Peaceful Passing in Old Age at ${candidate.age} yrs)`;
    } else {
      const frail = living.filter(a => a.health < 35 || a.stress > 75);
      if (frail.length > 0) {
        candidate = frail[0];
        if (!chosenCause) chosenCause = `Severe Vital Exhaustion & Illness (Health ${Math.round(candidate.health)}%)`;
      } else {
        candidate = living[0];
        if (!chosenCause) chosenCause = `Natural Completion of Life Journey (Age ${candidate.age} yrs)`;
      }
    }

    const result = this.executeAgentDeath(candidate.id, chosenCause, actor);
    this.pendingBirthDeficit += 1;

    const deceasedCount = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;
    const livingCount = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;

    this.addEvent('MORTALITY_EVENT', `🕯️ त्वरित देहावसान (Quick Mortality Trigger): ${candidate.name} (आयु ${candidate.age} वर्ष) का देहावसान हुआ (${chosenCause})। कुल मौतें: ${deceasedCount} | जीवित जनसंख्या: ${livingCount}`);

    return {
      success: true,
      agent: candidate,
      cause: chosenCause,
      deceasedCount,
      livingCount
    };
  }

  /**
   * Automatic reproduction and population replenishment tied to deaths ("papulation bhi badhe maut ke hisab se")
   */
  async processAutomaticReproduction(db, agents, settings) {
    if (settings && settings.reproduction_enabled === 0) return;

    const maxPop = (settings && settings.max_population) || 2500;
    const livingCount = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
    if (livingCount >= maxPop) return;

    const speed = settings.time_speed_multiplier !== undefined ? Math.max(0.1, parseFloat(settings.time_speed_multiplier)) : 1.0;

    // Trigger immediately if we have a birth deficit from deaths, or rapidly (every 2 ticks)
    const shouldBirth = this.pendingBirthDeficit > 0 || (this.tickCount % Math.max(1, Math.round(2 / speed)) === 0);
    if (!shouldBirth) return;

    // Get active living adults capable of parenting (age 18-58)
    const activeAdults = db.prepare(`
      SELECT * FROM agents
      WHERE runtime_status != 'deceased' AND runtime_status != 'paused' AND runtime_status != 'deactivated'
        AND age >= 18 AND age <= 58 AND occupation NOT LIKE '%Infant%'
      ORDER BY RANDOM()
      LIMIT 15
    `).all();

    if (activeAdults.length < 2) return;

    let parentA = null;
    let parentB = null;

    // 1. Try existing couples first
    const coupleRel = db.prepare(`
      SELECT r.*, a.name as a_name, b.name as b_name
      FROM agent_relationships r
      JOIN agents a ON r.agent_a_id = a.id
      JOIN agents b ON r.agent_b_id = b.id
      WHERE r.relationship_type IN ('Spouse', 'Romantic Partner')
        AND a.runtime_status != 'deceased' AND b.runtime_status != 'deceased'
        AND a.age >= 18 AND a.age <= 58 AND b.age >= 18 AND b.age <= 58
      ORDER BY r.affinity_score DESC
      LIMIT 1
    `).get();

    if (coupleRel) {
      parentA = db.prepare('SELECT * FROM agents WHERE id = ?').get(coupleRel.agent_a_id);
      parentB = db.prepare('SELECT * FROM agents WHERE id = ?').get(coupleRel.agent_b_id);
    } else {
      // 2. Select two compatible adult citizens
      parentA = activeAdults[0];
      parentB = activeAdults[1];

      // Form a family bond
      const nowIso = new Date().toISOString();
      db.prepare(`
        INSERT INTO agent_relationships (agent_a_id, agent_b_id, relationship_type, affinity_score, trust_score, updated_at)
        VALUES (?, ?, 'Romantic Partner', 88.0, 85.0, ?)
      `).run(parentA.id, parentB.id, nowIso);
    }

    if (parentA && parentB) {
      await this.deliverNewborn(db, parentA, parentB);
      if (this.pendingBirthDeficit > 0) {
        this.pendingBirthDeficit--;
      }
    }
  }

  // Alias for backward compatibility
  async checkAutonomousReproduction(db, agents) {
    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get() || {};
    return this.processAutomaticReproduction(db, agents, settings);
  }

  /**
   * Science & Technology Progression System tied directly to simulation time speed.
   * - Accelerated Time (> 1.0x): Population expands, high R&D momentum, scientific breakthroughs unlock.
   * - Decelerated Time (< 1.0x): Scientific research stalls/decays, tech growth drops, population slows.
   */
  updateScienceAndTechnology(db, agents) {
    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get() || {};
    const speed = settings.time_speed_multiplier !== undefined ? parseFloat(settings.time_speed_multiplier) : 1.0;
    let currentTech = settings.tech_level !== undefined ? parseFloat(settings.tech_level) : 120.0;
    let discoveries = [];
    try {
      discoveries = JSON.parse(settings.tech_discoveries || '[]');
    } catch (e) {
      discoveries = [];
    }

    const TECH_MILESTONES = [
      { score: 140, name: 'Solar Micro-Grid Optimization', domain: 'Energy & Infrastructure', impact: 'Clean energy reliability boosted townwide.' },
      { score: 180, name: 'Autonomous Agritech Hydroponics', domain: 'Agriculture & Nourishment', impact: 'Food production efficiency doubled at Town Bakery & Market.' },
      { score: 230, name: 'Quantum Neural Decision Logic', domain: 'Computing & AI', impact: 'Agent problem-solving efficiency and cognitive clarity elevated.' },
      { score: 300, name: 'Biotech Longevity Gene Therapies', domain: 'Medicine & Health', impact: 'Average healthy lifespan extended, immunity bolstered.' },
      { score: 400, name: 'Clean Magnetic Fusion Generator', domain: 'Clean Energy', impact: 'Virtually unlimited power grid for modern civic infrastructure.' },
      { score: 550, name: 'Gravitational Wave Sensor Array', domain: 'Deep Physics', impact: 'Atmospheric and tectonic forecasting achieved.' },
      { score: 750, name: 'Synthetic Cellular Regeneration', domain: 'Biotechnology', impact: 'Cellular degradation halted; age reversal therapies online.' },
      { score: 1000, name: 'Planetary Cognitive Singularity', domain: 'Unified Civilization', impact: 'Human consciousness harmonized with autonomous intelligent systems.' }
    ];

    let growthRate = 0.0;
    if (speed >= 1.0) {
      // GROWTH SURGE:
      const activeTechWorkers = agents.filter(a => 
        a.runtime_status === 'active' && 
        (a.occupation.includes('Doctor') || a.occupation.includes('Researcher') || a.occupation.includes('Engineer') || a.occupation.includes('Architect'))
      ).length;

      growthRate = parseFloat(((0.8 * speed) + (activeTechWorkers * 0.3 * speed)).toFixed(2));
      currentTech = parseFloat((currentTech + growthRate).toFixed(1));

      // Check milestones
      for (const m of TECH_MILESTONES) {
        if (currentTech >= m.score && !discoveries.some(d => d.name === m.name)) {
          const newDisc = {
            name: m.name,
            domain: m.domain,
            impact: m.impact,
            discovered_day: this.currentDay,
            discovered_at: new Date().toISOString()
          };
          discoveries.push(newDisc);
          this.addEvent('TECH_DISCOVERY', `🚀 Breakthrough: ${m.name} achieved! (${m.domain}) - ${m.impact}`);
          
          // Add to life events of tech agents
          const leadAgents = agents.filter(a => a.occupation.includes('Researcher') || a.occupation.includes('Engineer') || a.name.includes('Evelyn') || a.name.includes('Elena'));
          for (const lead of leadAgents) {
            db.prepare(`
              INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
              VALUES (?, 'CAREER_ADVANCEMENT', ?, ?, 'major', ?)
            `).run(
              lead.id,
              `Scientific Breakthrough: ${m.name}`,
              `${lead.name} contributed to groundbreaking research in ${m.domain}: ${m.impact}`,
              new Date().toISOString()
            );
          }
        }
      }
    } else {
      // GROWTH REGRESSION & STAGNATION:
      const penalty = parseFloat(((1.0 - speed) * 1.5).toFixed(2));
      growthRate = parseFloat((-penalty).toFixed(2));
      currentTech = Math.max(10.0, parseFloat((currentTech - (penalty * 0.4)).toFixed(1)));

      if (this.tickCount % 6 === 0 && speed <= 0.5) {
        this.addEvent('TECH_STAGNATION', `📉 Temporal Deceleration: Scientific research stalled and technological momentum dropped (${growthRate} pts/tick).`);
      }
    }

    // Determine civilization era
    let currentEra = 'Industrial & Digital Modernity';
    if (currentTech >= 1000) currentEra = 'Planetary Singularity Civilization';
    else if (currentTech >= 600) currentEra = 'Quantum Synthesis & Bio-Longevity Age';
    else if (currentTech >= 300) currentEra = 'Solar Fusion & Automated Era';
    else if (currentTech >= 150) currentEra = 'Digital & Cybernetic Age';
    else if (currentTech >= 80) currentEra = 'Early Computational Era';

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE simulation_settings 
      SET tech_level = ?, tech_growth_rate = ?, tech_era = ?, tech_discoveries = ?, updated_at = ?
      WHERE id = 1
    `).run(currentTech, growthRate, currentEra, JSON.stringify(discoveries), now);
  }

  /**
   * Real-time delivery and onboarding of newborn child agent
   */
  async deliverNewborn(db, parentA, parentB) {
    const preferredLoc = parentA.preferred_city || parentA.location || 'New Delhi & Mumbai Hub';
    const locInfo = LOCATIONS[preferredLoc] || LOCATIONS['Residential Complex'] || { x: 500, y: 300, width: 40, height: 40 };
    const childGen = Math.max((parentA.generation || 1), (parentB.generation || 1)) + 1;

    // Generate child attributes with Gemini AI or heuristic
    const childData = await generateNewbornChild({
      parentA,
      parentB,
      location: preferredLoc
    });

    const now = new Date().toISOString();
    const targetX = (locInfo.x || 500) + (Math.random() * 40 - 20);
    const targetY = (locInfo.y || 300) + (Math.random() * 40 - 20);

    const childRes = db.prepare(`
      INSERT INTO agents (
        name, avatar, occupation, location, activity, runtime_status,
        personality, current_goal, hunger, energy, happiness, social_needs,
        virtual_balance, reward_points, last_decision_reason, last_decision_time,
        x_coord, y_coord, generation, parent_a_id, parent_b_id,
        age, date_of_birth, health, stress, emotion, photo_url, family_background, financial_status,
        preferred_city, choice_reason,
        created_at, updated_at
      ) VALUES (?, ?, 'Infant (Newborn Child)', ?, 'resting', 'active',
        ?, ?, 95.0, 95.0, 99.0, 88.0, 80.0, 0.0, ?, ?, ?, ?, ?, ?, ?,
        1, ?, 100.0, 3.0, 'happy', '/assets/portraits/child.jpg', ?, 'Dependent (Family Care)',
        ?, ?,
        ?, ?)
    `).run(
      childData.name,
      childData.avatar || '👶',
      preferredLoc,
      childData.personality,
      childData.goal,
      `Born into simulation to ${parentA.name} and ${parentB.name}.`,
      now,
      targetX,
      targetY,
      childGen,
      parentA.id,
      parentB.id,
      now.split('T')[0],
      `Born to ${parentA.name} and ${parentB.name}`,
      preferredLoc,
      `Born to family residing in ${preferredLoc}`,
      now,
      now
    );

    const childId = childRes.lastInsertRowid;
    this.birthsSinceLastMortality++;
    this.pendingMortalityQuota++;

    // Register life milestone event
    const totalLiving = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
    const totalDeceased = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;

    db.prepare(`
      INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
      VALUES (?, 'BIRTH', 'Child Born in Town', ?, 'major', ?)
    `).run(childId, `Born into the simulation in Generation ${childGen} to parents ${parentA.name} and ${parentB.name} in ${preferredLoc}.`, now);

    this.addEvent('POPULATION_GROWTH', `🎉 शिशु का जन्म (Newborn Born): ${childData.name} का जन्म हुआ! माता-पिता: ${parentA.name} व ${parentB.name} (${preferredLoc})। जीवित जनसंख्या: ${totalLiving} | कुल मौतें: ${totalDeceased}`, {
      childId,
      parents: [parentA.id, parentB.id]
    });

    // Newborn belief profile: unforced, pending autonomous development
    db.prepare(`
      INSERT INTO agent_belief_profiles (agent_id, belief_status, declared_source, notes, updated_at)
      VALUES (?, 'Belief not specified', 'Newborn Child (Autonomous Self-Definition Pending)', ?, ?)
    `).run(childId, `Born in Gen ${childGen} to ${parentA.name} & ${parentB.name}`, now);

    // Parent-Child relationships
    db.prepare(`
      INSERT INTO agent_relationships (agent_a_id, agent_b_id, relationship_type, affinity_score, trust_score, updated_at)
      VALUES (?, ?, 'Parent-Child', 98.0, 98.0, ?)
    `).run(parentA.id, childId, now);

    db.prepare(`
      INSERT INTO agent_relationships (agent_a_id, agent_b_id, relationship_type, affinity_score, trust_score, updated_at)
      VALUES (?, ?, 'Parent-Child', 98.0, 98.0, ?)
    `).run(parentB.id, childId, now);

    // Memories
    db.prepare(`
      INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
      VALUES (?, ?, 0.9, 'public', ?)
    `).run(childId, `Born into the simulation to loving parents ${parentA.name} and ${parentB.name}.`, now);

    db.prepare(`
      INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
      VALUES (?, ?, 0.95, 'public', ?)
    `).run(parentA.id, `Celebrated the birth of our newborn child, ${childData.name}!`, now);

    db.prepare(`
      INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
      VALUES (?, ?, 0.95, 'public', ?)
    `).run(parentB.id, `Celebrated the birth of our newborn child, ${childData.name}!`, now);

    // Celebratory Conversation
    db.prepare(`
      INSERT INTO agent_conversations (agent_a_id, agent_b_id, topic, snippet, location, timestamp)
      VALUES (?, ?, 'Family & Childbirth', ?, 'Residential Complex', ?)
    `).run(parentA.id, parentB.id, childData.congratulationsSnippet, now);

    // Add World Event
    this.addEvent('AGENT_BORN', `🍼 Birth Announcement: ${parentA.name} & ${parentB.name} welcomed newborn ${childData.name} (Gen ${childGen})!`, {
      childId,
      childName: childData.name,
      parents: `${parentA.name} & ${parentB.name}`,
      generation: childGen
    });

    // Sanitized Audit Log
    logAuditEvent({
      actor: `Simulation Procreation (${parentA.name} & ${parentB.name})`,
      action: 'AGENT_BORN',
      targetType: 'Agent',
      targetId: childId,
      targetName: childData.name,
      details: {
        childName: childData.name,
        parents: [parentA.name, parentB.name],
        generation: childGen,
        personality: childData.personality,
        goal: childData.goal,
        source: childData.source
      }
    });

    return { childId, name: childData.name, generation: childGen };
  }

  // --- Administrative Operations ---

  pauseAgent(agentId, adminName = 'Admin') {
    const db = getDatabase();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) throw new Error('Agent not found');

    const now = new Date().toISOString();
    db.prepare("UPDATE agents SET runtime_status = 'paused', updated_at = ? WHERE id = ?").run(now, agentId);

    logAuditEvent({
      actor: adminName,
      action: 'AGENT_PAUSED',
      targetType: 'Agent',
      targetId: agentId,
      targetName: agent.name,
      details: { previousStatus: agent.runtime_status, newStatus: 'paused' }
    });

    this.addEvent('AGENT_STATUS_CHANGE', `${agent.name} was paused by ${adminName}.`);
    return { success: true, agentId, status: 'paused' };
  }

  resumeAgent(agentId, adminName = 'Admin') {
    const db = getDatabase();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) throw new Error('Agent not found');

    const now = new Date().toISOString();
    db.prepare("UPDATE agents SET runtime_status = 'active', updated_at = ? WHERE id = ?").run(now, agentId);

    logAuditEvent({
      actor: adminName,
      action: 'AGENT_RESUMED',
      targetType: 'Agent',
      targetId: agentId,
      targetName: agent.name,
      details: { previousStatus: agent.runtime_status, newStatus: 'active' }
    });

    this.addEvent('AGENT_STATUS_CHANGE', `${agent.name} was resumed by ${adminName}.`);
    return { success: true, agentId, status: 'active' };
  }

  deactivateAgent(agentId, adminName = 'Admin') {
    const db = getDatabase();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) throw new Error('Agent not found');

    const now = new Date().toISOString();
    db.prepare("UPDATE agents SET runtime_status = 'deactivated', updated_at = ? WHERE id = ?").run(now, agentId);

    logAuditEvent({
      actor: adminName,
      action: 'AGENT_DEACTIVATED',
      targetType: 'Agent',
      targetId: agentId,
      targetName: agent.name,
      details: { previousStatus: agent.runtime_status, newStatus: 'deactivated' }
    });

    this.addEvent('AGENT_STATUS_CHANGE', `${agent.name} was deactivated by ${adminName}.`);
    return { success: true, agentId, status: 'deactivated' };
  }

  reactivateAgent(agentId, adminName = 'Admin') {
    const db = getDatabase();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) throw new Error('Agent not found');

    const now = new Date().toISOString();
    db.prepare("UPDATE agents SET runtime_status = 'active', updated_at = ? WHERE id = ?").run(now, agentId);

    logAuditEvent({
      actor: adminName,
      action: 'AGENT_REACTIVATED',
      targetType: 'Agent',
      targetId: agentId,
      targetName: agent.name,
      details: { previousStatus: agent.runtime_status, newStatus: 'active' }
    });

    this.addEvent('AGENT_STATUS_CHANGE', `${agent.name} was reactivated by ${adminName}.`);
    return { success: true, agentId, status: 'active' };
  }

  updateAgentAttributes(agentId, updates, adminName = 'Admin') {
    const db = getDatabase();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) throw new Error('Agent not found');

    const allowed = ['hunger', 'energy', 'happiness', 'social_needs', 'virtual_balance', 'occupation', 'current_goal', 'location', 'activity'];
    const sets = [];
    const values = [];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (sets.length === 0) return agent;

    const now = new Date().toISOString();
    sets.push('updated_at = ?');
    values.push(now);
    values.push(agentId);

    db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    logAuditEvent({
      actor: adminName,
      action: 'AGENT_ATTRIBUTES_ADJUSTED',
      targetType: 'Agent',
      targetId: agentId,
      targetName: agent.name,
      details: updates
    });

    return db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  }

  updateSettings(newSettings, adminName = 'Admin') {
    const db = getDatabase();
    const now = new Date().toISOString();

    if (newSettings.time_speed_multiplier !== undefined) {
      const mul = parseFloat(newSettings.time_speed_multiplier);
      if (mul >= 0.1 && mul <= 10.0) {
        const calculatedRate = Math.max(300, Math.min(10000, Math.round(3000 / mul)));
        db.prepare('UPDATE simulation_settings SET time_speed_multiplier = ?, tick_rate_ms = ?, updated_at = ? WHERE id = 1')
          .run(mul, calculatedRate, now);
        
        if (this.isRunning) {
          this.start(calculatedRate);
        }

        const modeLabel = mul >= 2.0 ? 'Accelerated Innovation Era' : (mul < 1.0 ? 'Temporal Deceleration & Stagnation' : 'Standard Real-time Pace');
        this.addEvent('TIME_SPEED_CHANGED', `⏳ Temporal Flow set to ${mul}x (${modeLabel}). Population & Science progression adjusted.`);
      }
    } else if (newSettings.tick_rate_ms) {
      const rate = parseInt(newSettings.tick_rate_ms, 10);
      if (rate >= 300 && rate <= 60000) {
        if (this.isRunning) {
          this.start(rate);
        } else {
          db.prepare('UPDATE simulation_settings SET tick_rate_ms = ?, updated_at = ? WHERE id = 1').run(rate, now);
        }
      }
    }

    if (newSettings.weather) {
      db.prepare('UPDATE simulation_settings SET weather = ?, updated_at = ? WHERE id = 1').run(newSettings.weather, now);
    }

    if (newSettings.gemini_enabled !== undefined) {
      db.prepare('UPDATE simulation_settings SET gemini_enabled = ?, updated_at = ? WHERE id = 1')
        .run(newSettings.gemini_enabled ? 1 : 0, now);
    }

    if (newSettings.reproduction_enabled !== undefined) {
      db.prepare('UPDATE simulation_settings SET reproduction_enabled = ?, updated_at = ? WHERE id = 1')
        .run(newSettings.reproduction_enabled ? 1 : 0, now);
    }

    if (newSettings.max_population !== undefined) {
      const maxPop = parseInt(newSettings.max_population, 10);
      if (maxPop >= 2 && maxPop <= 200) {
        db.prepare('UPDATE simulation_settings SET max_population = ?, updated_at = ? WHERE id = 1')
          .run(maxPop, now);
      }
    }

    if (newSettings.aging_speed !== undefined) {
      const spd = parseFloat(newSettings.aging_speed);
      if (spd >= 0.1 && spd <= 10.0) {
        db.prepare('UPDATE simulation_settings SET aging_speed = ?, updated_at = ? WHERE id = 1').run(spd, now);
      }
    }

    if (newSettings.mortality_rate !== undefined) {
      const mr = parseFloat(newSettings.mortality_rate);
      if (mr >= 0.0 && mr <= 5.0) {
        db.prepare('UPDATE simulation_settings SET mortality_rate = ?, updated_at = ? WHERE id = 1').run(mr, now);
      }
    }

    if (newSettings.enable_natural_death !== undefined) {
      db.prepare('UPDATE simulation_settings SET enable_natural_death = ?, updated_at = ? WHERE id = 1')
        .run(newSettings.enable_natural_death ? 1 : 0, now);
    }

    if (newSettings.enable_illness_death !== undefined) {
      db.prepare('UPDATE simulation_settings SET enable_illness_death = ?, updated_at = ? WHERE id = 1')
        .run(newSettings.enable_illness_death ? 1 : 0, now);
    }

    if (newSettings.enable_accidental_death !== undefined) {
      db.prepare('UPDATE simulation_settings SET enable_accidental_death = ?, updated_at = ? WHERE id = 1')
        .run(newSettings.enable_accidental_death ? 1 : 0, now);
    }

    if (newSettings.max_natural_age !== undefined) {
      const age = parseInt(newSettings.max_natural_age, 10);
      if (age >= 50 && age <= 130) {
        db.prepare('UPDATE simulation_settings SET max_natural_age = ?, updated_at = ? WHERE id = 1').run(age, now);
      }
    }

    logAuditEvent({
      actor: adminName,
      action: 'SIMULATION_SETTINGS_CHANGED',
      targetType: 'SimulationSetting',
      targetId: '1',
      targetName: 'Global Simulation Settings',
      details: newSettings
    });

    return db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get();
  }

  /**
   * Set Time of Day manually (morning, night, dawn, afternoon, evening, or custom hour)
   * When Night: all living agents immediately deactivate/sleep and move to Residential Complex.
   * When Morning: all living sleeping agents immediately wake up and activate.
   */
  setTimeOfDay(timeOfDay, customHour = null, adminUsername = 'Administrator') {
    const db = getDatabase();
    let targetHour = 7; // Default morning
    let targetMinute = 0;
    let modeLabel = 'Morning';

    if (timeOfDay === 'night') {
      targetHour = 23; // 11:00 PM
      modeLabel = 'Night';
    } else if (timeOfDay === 'morning') {
      targetHour = 7; // 07:00 AM
      modeLabel = 'Morning';
    } else if (timeOfDay === 'dawn') {
      targetHour = 6; // 06:00 AM
      modeLabel = 'Dawn';
    } else if (timeOfDay === 'afternoon') {
      targetHour = 13; // 01:00 PM
      modeLabel = 'Afternoon';
    } else if (timeOfDay === 'evening') {
      targetHour = 19; // 07:00 PM
      modeLabel = 'Evening';
    } else if (customHour !== null && !isNaN(customHour)) {
      targetHour = Math.max(0, Math.min(23, parseInt(customHour, 10)));
      modeLabel = `Hour ${targetHour}:00`;
    }

    this.currentMinute = targetHour * 60 + targetMinute;
    const isNight = targetHour >= 22 || targetHour < 6;

    const pad = (n) => String(n).padStart(2, '0');
    const ampm = targetHour >= 12 ? 'PM' : 'AM';
    const displayHour = targetHour % 12 === 0 ? 12 : targetHour % 12;
    const timeStr = `${pad(displayHour)}:${pad(targetMinute)} ${ampm} (Day ${this.currentDay})${isNight ? ' 🌙 Night' : ' ☀️ Day'}`;

    const now = new Date().toISOString();
    let weather = isNight ? 'Clear Night Sky' : 'Sunny';

    // Update simulation settings
    db.prepare('UPDATE simulation_settings SET world_time = ?, weather = ?, updated_at = ? WHERE id = 1')
      .run(timeStr, weather, now);

    if (isNight) {
      // Put all living active/sleeping agents to sleep (deactivate from daytime activities)
      const res = db.prepare(`
        UPDATE agents SET 
          activity = 'sleeping',
          location = 'Residential Complex',
          runtime_status = 'sleeping',
          last_decision_reason = 'Night mode engaged by administrator. Retired to Residential Complex for sleep and rest.',
          updated_at = ?
        WHERE runtime_status != 'deceased' AND runtime_status != 'paused' AND runtime_status != 'deactivated'
      `).run(now);

      this.addEvent('TIME_SHIFT_NIGHT', `Administrator shifted simulation time to Night (${timeStr}). All living citizens went to sleep.`, { updatedCount: res.changes });
      logAuditEvent({
        actor: adminUsername,
        action: 'TIME_SHIFT_NIGHT',
        targetType: 'SimulationTime',
        targetId: '1',
        details: { timeStr, changedCitizens: res.changes }
      });
    } else {
      // Wake up all sleeping/inactive living citizens into active daytime life
      const res = db.prepare(`
        UPDATE agents SET 
          activity = CASE WHEN hunger < 60 THEN 'eating' ELSE 'working' END,
          location = CASE WHEN hunger < 60 THEN 'Sunny Cafe' ELSE 'Workplace (Tech Hub)' END,
          runtime_status = 'active',
          last_decision_reason = 'Morning mode engaged by administrator. Citizens awakened and resumed daily active life.',
          updated_at = ?
        WHERE (runtime_status = 'sleeping' OR runtime_status = 'inactive') AND runtime_status != 'deceased' AND runtime_status != 'paused' AND runtime_status != 'deactivated'
      `).run(now);

      this.addEvent('TIME_SHIFT_MORNING', `Administrator shifted simulation time to Morning (${timeStr}). All living citizens awakened and active.`, { updatedCount: res.changes });
      logAuditEvent({
        actor: adminUsername,
        action: 'TIME_SHIFT_MORNING',
        targetType: 'SimulationTime',
        targetId: '1',
        details: { timeStr, changedCitizens: res.changes }
      });
    }

    return {
      timeOfDay: modeLabel,
      isNight,
      timeStr,
      currentMinute: this.currentMinute,
      currentHour: targetHour
    };
  }

  /**
   * Conclude an agent's lifecycle due to natural causes, illness, or health events.
   * Preserves full history, profile, and memories.
   * Notifies close family, triggers mourning/grief, and executes single inheritance payout safely.
   */
  executeAgentDeath(agentId, cause = 'Natural Causes (Elder Age)', actor = 'System') {
    const db = getDatabase();
    return runTransaction(db => {
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
      if (!agent) throw new Error('Agent not found.');
      if (agent.runtime_status === 'deceased') return { alreadyDeceased: true, agentId };

      const now = new Date().toISOString();

      // 1. Mark as deceased
      db.prepare(`
        UPDATE agents
        SET runtime_status = 'deceased',
            activity = 'resting',
            health = 0.0,
            deceased_at = ?,
            cause_of_death = ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, cause, now, agent.id);

      // 2. Register historic life event
      db.prepare(`
        INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
        VALUES (?, 'DEATH', 'Passed Away', ?, 'historic', ?)
      `).run(
        agent.id,
        `${agent.name} (Age ${agent.age || 'Elder'}) concluded their simulated journey (${cause}). Their lifetime memories and achievements are permanently archived in the town hall.`,
        now
      );

      // 3. Notify relationships & set grief emotion
      const relationships = db.prepare(`
        SELECT * FROM agent_relationships
        WHERE agent_a_id = ? OR agent_b_id = ?
      `).all(agent.id, agent.id);

      for (const rel of relationships) {
        const peerId = rel.agent_a_id === agent.id ? rel.agent_b_id : rel.agent_a_id;
        const peer = db.prepare('SELECT * FROM agents WHERE id = ?').get(peerId);
        if (peer && peer.runtime_status === 'active') {
          // Peer enters mourning/grief
          db.prepare(`
            UPDATE agents
            SET emotion = 'grief',
                stress = MIN(100, stress + 30.0),
                happiness = MAX(0, happiness - 35.0),
                updated_at = ?
            WHERE id = ?
          `).run(now, peerId);

          db.prepare(`
            INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
            VALUES (?, ?, -0.9, 'public', ?)
          `).run(
            peerId,
            `In deep mourning after learning that my ${rel.relationship_type.toLowerCase()}, ${agent.name}, passed away (${cause}).`,
            now
          );
        }
      }

      // 4. Safe inheritance execution (guarded by inheritance_executed to prevent duplicate payouts)
      if (agent.inheritance_executed === 0 && agent.virtual_balance > 0) {
        const heirRel = db.prepare(`
          SELECT * FROM agent_relationships
          WHERE (agent_a_id = ? OR agent_b_id = ?) AND (relationship_type IN ('Spouse', 'Romantic Partner', 'Parent-Child'))
          ORDER BY affinity_score DESC LIMIT 1
        `).get(agent.id, agent.id);

        if (heirRel) {
          const heirId = heirRel.agent_a_id === agent.id ? heirRel.agent_b_id : heirRel.agent_a_id;
          const heir = db.prepare('SELECT * FROM agents WHERE id = ?').get(heirId);
          if (heir && heir.runtime_status !== 'deceased') {
            const inheritedAmount = agent.virtual_balance;
            db.prepare('UPDATE agents SET virtual_balance = virtual_balance + ?, updated_at = ? WHERE id = ?')
              .run(inheritedAmount, now, heirId);

            db.prepare(`
              INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
              VALUES (?, 'MEMORIAL', 'Family Inheritance Received', ?, 'major', ?)
            `).run(
              heirId,
              `Received inheritance of ${inheritedAmount.toFixed(1)} Solis from ${agent.name}'s estate.`,
              now
            );

            this.addEvent('INHERITANCE_EXECUTED', `Estate of ${agent.name} (${inheritedAmount.toFixed(1)} Solis) bequeathed to ${heir.name}.`);
          }
        }

        // Lock inheritance flag
        db.prepare('UPDATE agents SET virtual_balance = 0, inheritance_executed = 1, updated_at = ? WHERE id = ?')
          .run(now, agent.id);
      }

      // 5. Broadcast town memorial event
      this.addEvent('MEMORIAL_EVENT', `🕯️ In Memoriam: ${agent.name} passed away (${cause}). Memorial service held in town.`);

      // 6. Log audit event
      logAuditEvent({
        actor,
        action: 'AGENT_DECEASED',
        targetType: 'Agent',
        targetId: String(agent.id),
        targetName: agent.name,
        details: { cause, age: agent.age, balance: agent.virtual_balance }
      });

      return {
        agentId: agent.id,
        name: agent.name,
        cause,
        status: 'deceased'
      };
    });
  }

  /**
   * Autonomous spiritual reflection, prayers, and mannats engine.
   * Connects to agent's beliefs, distress, grief, gratitude, or contemplation.
   */
  async checkSpiritualReflections(db, agents) {
    const living = agents.filter(a => a.runtime_status === 'active');
    for (const agent of living) {
      const belief = agent.belief_status;
      // Non-believers are never forced to pray
      if (belief !== 'Trusts in God' && belief !== 'Unsure or undecided') {
        continue;
      }

      // Rate limit check: at least 25 ticks between prayers per agent
      const lastTick = this.lastPrayerTickMap.get(agent.id) || 0;
      if (this.tickCount - lastTick < 25) continue;

      let shouldPray = false;
      let contextType = 'personal_struggle';
      let triggerContext = 'Sought quiet reflection on personal dilemmas.';

      if (agent.emotion === 'grief') {
        shouldPray = true;
        contextType = 'illness_or_grief';
        triggerContext = 'Grieving the loss of a close friend or family member.';
      } else if (agent.health < 40) {
        shouldPray = true;
        contextType = 'illness_or_grief';
        triggerContext = `Suffering low health (${agent.health.toFixed(0)}%) and fatigue.`;
      } else if (agent.virtual_balance < 30) {
        shouldPray = true;
        contextType = 'financial_difficulty';
        triggerContext = 'Struggling with low financial reserves, debt, and livelihood anxiety.';
      } else if (agent.stress > 65) {
        shouldPray = true;
        contextType = 'personal_struggle';
        triggerContext = `High stress level (${agent.stress.toFixed(0)}%) and deep emotional turmoil.`;
      } else if (agent.social_needs < 35) {
        shouldPray = true;
        contextType = 'family_welfare';
        triggerContext = 'Experiencing loneliness and praying for family companion and domestic peace.';
      } else if (agent.location === 'Sanctuary of Reflection') {
        shouldPray = Math.random() < 0.4;
        contextType = 'vow_or_mannat';
        triggerContext = 'Visited Sanctuary of Reflection for peaceful contemplation and making a mannat.';
      }

      if (shouldPray) {
        this.lastPrayerTickMap.set(agent.id, this.tickCount);
        const prayerData = await generateAgentPrayerOrMannat({
          agent,
          contextType,
          triggerContext
        });

        const now = new Date().toISOString();
        const ref = 'REQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);

        db.prepare(`
          INSERT INTO prayers_and_mannats (
            request_ref, agent_id, category, original_words, request_summary,
            desired_outcome, explicit_promise, trigger_context, emotional_state,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          ref,
          agent.id,
          prayerData.category,
          prayerData.originalWords,
          prayerData.requestSummary,
          prayerData.desiredOutcome,
          prayerData.explicitPromise,
          triggerContext,
          prayerData.emotionalState,
          now,
          now
        );

        // Memory
        db.prepare(`
          INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
          VALUES (?, ?, 0.5, 'deep_confidential', ?)
        `).run(
          agent.id,
          `Offered sincere prayer: "${prayerData.originalWords.substring(0, 90)}..."`,
          now
        );

        this.addEvent('PRAYER_EXPRESSED', `🕊️ Spiritual Request: ${agent.name} offered a ${prayerData.category.toLowerCase()} at ${agent.location}.`);
        break; // Max 1 prayer generated per tick cycle
      }
    }
  }

  /**
   * Complete real-time snapshot for world viewer & dashboard.
   */
  getStateSnapshot() {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get();
    const agents = db.prepare(`
      SELECT a.*, b.belief_status, b.declared_source, b.updated_at as belief_updated_at
      FROM agents a
      LEFT JOIN agent_belief_profiles b ON a.id = b.agent_id
    `).all();

    const worldTime = settings ? settings.world_time : '09:00 AM';
    const isNight = worldTime ? (worldTime.includes('🌙') || worldTime.includes('Night')) : false;

    return {
      settings,
      isRunning: this.isRunning,
      worldTime,
      isNight,
      weather: settings ? settings.weather : 'Sunny',
      agents,
      recentEvents: this.recentEvents.slice(0, 20),
      locations: LOCATIONS
    };
  }
}

// Singleton simulation engine instance
const engine = new SimulationEngine();

module.exports = engine;

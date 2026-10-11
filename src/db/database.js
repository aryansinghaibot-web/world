const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const { seedAgents, seedCouples, seedChildRelations } = require('./seed-data');

// Ensure data folder exists (safe for serverless and read-only filesystems)
try {
  const dataDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.warn('dataDir creation notice:', err.message);
}

let dbInstance = null;

function getDatabase() {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = new DatabaseSync(config.DB_PATH);
  } catch (err) {
    console.warn(`Failed to open DB at ${config.DB_PATH}, falling back to :memory: SQLite:`, err.message);
    dbInstance = new DatabaseSync(':memory:');
  }
  
  // Enable foreign keys, WAL mode, and busy timeout for concurrent safety
  try { dbInstance.exec('PRAGMA foreign_keys = ON;'); } catch (e) {}
  try { dbInstance.exec('PRAGMA journal_mode = WAL;'); } catch (e) {}
  try { dbInstance.exec('PRAGMA busy_timeout = 5000;'); } catch (e) {}

  initSchema(dbInstance);
  seedInitialData(dbInstance);

  return dbInstance;
}

function initSchema(db) {
  let schemaSql = '';
  const candidatePaths = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'schema.sql')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      schemaSql = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  if (schemaSql) {
    db.exec(schemaSql);
  }

  // Safe schema migrations for realistic agents and lifecycles
  try { db.exec('ALTER TABLE agents ADD COLUMN generation INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN parent_a_id INTEGER;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN parent_b_id INTEGER;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN age INTEGER DEFAULT 32;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN date_of_birth TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN health REAL DEFAULT 95.0;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN stress REAL DEFAULT 20.0;'); } catch (e) {}
  try { db.exec("ALTER TABLE agents ADD COLUMN emotion TEXT DEFAULT 'hopeful';"); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN photo_url TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN family_background TEXT;'); } catch (e) {}
  try { db.exec("ALTER TABLE agents ADD COLUMN financial_status TEXT DEFAULT 'Stable';"); } catch (e) {}
  try { db.exec("ALTER TABLE agents ADD COLUMN life_history TEXT DEFAULT '[]';"); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN deceased_at TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN cause_of_death TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN inheritance_executed INTEGER DEFAULT 0;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN preferred_city TEXT;'); } catch (e) {}
  try { db.exec('ALTER TABLE agents ADD COLUMN choice_reason TEXT;'); } catch (e) {}

  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN reproduction_enabled INTEGER NOT NULL DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN max_population INTEGER NOT NULL DEFAULT 25;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN aging_speed REAL DEFAULT 1.0;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN mortality_rate REAL DEFAULT 1.0;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN enable_natural_death INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN enable_illness_death INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN enable_accidental_death INTEGER DEFAULT 1;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN max_natural_age INTEGER DEFAULT 95;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN time_speed_multiplier REAL DEFAULT 1.0;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN tech_level REAL DEFAULT 120.0;'); } catch (e) {}
  try { db.exec('ALTER TABLE simulation_settings ADD COLUMN tech_growth_rate REAL DEFAULT 1.0;'); } catch (e) {}
  try { db.exec("ALTER TABLE simulation_settings ADD COLUMN tech_era TEXT DEFAULT 'Digital & Cybernetic Age';"); } catch (e) {}
  try { db.exec("ALTER TABLE simulation_settings ADD COLUMN tech_discoveries TEXT DEFAULT '[]';"); } catch (e) {}

  // Backfill realistic photos and life data for existing agents
  const seedDetails = {
    'Dr. Evelyn Reed': { age: 38, dob: '1988-04-12', photo: '/assets/portraits/evelyn.jpg', bg: 'Raised in Cambridge by university botanists; passionate about quantum field research.', fin: 'Affluent (Research Grants)', emotion: 'hopeful' },
    'Marcus Vance': { age: 44, dob: '1982-08-25', photo: '/assets/portraits/marcus.jpg', bg: 'Third-generation architect with roots in sustainable civic masonry; devoted civic mentor.', fin: 'Prosperous (Civic Partner)', emotion: 'happy' },
    'Aria Thorne': { age: 27, dob: '1999-02-14', photo: '/assets/portraits/aria.jpg', bg: 'From a family of sculptors; moved to town seeking sanctuary for digital generative art.', fin: 'Moderate (Freelance Commissions)', emotion: 'curious' },
    'Kaito Tanaka': { age: 33, dob: '1993-11-03', photo: '/assets/portraits/kaito.jpg', bg: 'Grandson of Kyoto teahouse masters; preserves generational oral histories and artisanal blends.', fin: 'Stable (Cafe Proprietor)', emotion: 'peaceful' },
    'Elena Rostova': { age: 31, dob: '1995-06-19', photo: '/assets/portraits/elena.jpg', bg: 'Eldest daughter of industrial mechanics; obsessive problem-solver in algorithmic infrastructure.', fin: 'Stable (Lead Engineer)', emotion: 'focused' },
    'Julian Hayes': { age: 29, dob: '1997-09-08', photo: '/assets/portraits/julian.jpg', bg: 'Raised on rural permaculture farm; sensitive to ecosystem balance and wildlife.', fin: 'Modest (Ecological Stipend)', emotion: 'peaceful' },
    'Sora Williams': { age: 46, dob: '1980-01-30', photo: '/assets/portraits/sora.jpg', bg: 'Distinguished clinical biologist whose sister recovered from illness; dedicated to community clinic care.', fin: 'Prosperous (Medical Director)', emotion: 'compassionate' },
    'Tariq Al-Mansoor': { age: 62, dob: '1964-10-15', photo: '/assets/portraits/tariq.jpg', bg: 'Scholarly patriarch of ancient Middle Eastern heritage; respected elder and mentor to town youths.', fin: 'Comfortable (Tenured Emeritus)', emotion: 'reflective' },
    'Nadia Chen': { age: 26, dob: '2000-05-22', photo: '/assets/portraits/nadia.jpg', bg: 'Youngest daughter of machine shop machinists; pioneering autonomous robotics and civic repairs.', fin: 'Modest (Apprentice Mechanic)', emotion: 'optimistic' }
  };

  for (const [name, info] of Object.entries(seedDetails)) {
    try {
      db.prepare(`
        UPDATE agents
        SET age = COALESCE(age, ?),
            date_of_birth = COALESCE(date_of_birth, ?),
            photo_url = COALESCE(photo_url, ?),
            family_background = COALESCE(family_background, ?),
            financial_status = COALESCE(financial_status, ?),
            emotion = COALESCE(emotion, ?)
        WHERE name = ?
      `).run(info.age, info.dob, info.photo, info.bg, info.fin, info.emotion, name);
    } catch (e) {}
  }
}

function seedInitialData(db) {
  const now = new Date().toISOString();

  // 1. Simulation settings check (ensure reproduction enabled & high max_population)
  const settingsCheck = db.prepare('SELECT COUNT(*) as count FROM simulation_settings').get();
  if (settingsCheck.count === 0) {
    db.prepare(`
      INSERT INTO simulation_settings (id, tick_rate_ms, is_running, ai_decision_interval, gemini_enabled, world_time, weather, updated_at, reproduction_enabled, max_population)
      VALUES (1, ?, 1, 2, 0, '09:00 AM (Day 1)', 'Sunny', ?, 1, 2500)
    `).run(config.TICK_INTERVAL_DEFAULT_MS, now);
  } else {
    try {
      db.prepare(`
        UPDATE simulation_settings
        SET max_population = 2500, reproduction_enabled = 1
        WHERE id = 1
      `).run();
    } catch (e) {}
  }

  // 2. Agents seed check (Ensure 50+ diverse global citizens across all 10 hubs)
  const existingAgents = db.prepare('SELECT id, name FROM agents').all();
  const existingNameMap = new Map(existingAgents.map(a => [a.name, a.id]));

  const insertAgent = db.prepare(`
    INSERT INTO agents (
      name, avatar, photo_url, age, date_of_birth, health, stress, emotion,
      family_background, financial_status, life_history,
      occupation, location, preferred_city, choice_reason, activity, runtime_status,
      personality, current_goal, hunger, energy, happiness, social_needs,
      virtual_balance, reward_points, last_decision_reason, last_decision_time,
      x_coord, y_coord, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBelief = db.prepare(`
    INSERT INTO agent_belief_profiles (agent_id, belief_status, declared_source, notes, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMemory = db.prepare(`
    INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  const isTest = process.env.NODE_ENV === 'test';
  const targetAgents = isTest ? seedAgents.slice(0, 9) : seedAgents;

  for (const a of targetAgents) {
    if (existingNameMap.has(a.name)) continue;

    const res = insertAgent.run(
      a.name, a.avatar, a.photo_url, a.age, a.date_of_birth, a.health, a.stress, a.emotion,
      a.family_background, a.financial_status, a.life_history,
      a.occupation, a.location, a.preferred_city || a.location, a.choice_reason || 'Lives happily in this location.', a.activity, a.runtime_status || 'active',
      a.personality, a.current_goal, a.hunger, a.energy, a.happiness, a.social_needs,
      a.virtual_balance, a.reward_points, a.last_decision_reason, now,
      a.x_coord, a.y_coord, now, now
    );
    const agentId = res.lastInsertRowid;
    existingNameMap.set(a.name, agentId);

    // Belief profile
    try {
      insertBelief.run(agentId, a.belief || 'Belief not specified', a.beliefSource || 'Initial Simulation Registration', 'Recorded in simulation timeline', now);
    } catch (e) {}

    // Seed memories
    try {
      insertMemory.run(agentId, `Joined the Global Autonomous Simulation as ${a.occupation} in ${a.preferred_city || a.location}.`, 0.8, 'public', now);
      insertMemory.run(agentId, `Formulated personal goal: "${a.current_goal}".`, 0.5, 'private', now);
    } catch (e) {}
  }

  // 3. Established couples for autonomous reproduction
  const insertRel = db.prepare(`
    INSERT INTO agent_relationships (agent_a_id, agent_b_id, relationship_type, affinity_score, trust_score, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const c of seedCouples) {
    const idA = existingNameMap.get(c.a);
    const idB = existingNameMap.get(c.b);
    if (idA && idB) {
      const existingRel = db.prepare(`
        SELECT id FROM agent_relationships
        WHERE (agent_a_id = ? AND agent_b_id = ?) OR (agent_a_id = ? AND agent_b_id = ?)
      `).get(idA, idB, idB, idA);
      if (!existingRel) {
        try {
          insertRel.run(idA, idB, c.type, c.affinity, c.affinity, now);
        } catch (e) {}
      }
    }
  }

  // 4. Set parent links for children
  for (const cr of seedChildRelations) {
    const childId = existingNameMap.get(cr.child);
    const parentAId = existingNameMap.get(cr.parents[0]);
    const parentBId = existingNameMap.get(cr.parents[1]);
    if (childId && parentAId && parentBId) {
      try {
        db.prepare('UPDATE agents SET parent_a_id = ?, parent_b_id = ?, generation = 2 WHERE id = ?')
          .run(parentAId, parentBId, childId);
      } catch (e) {}
    }
  }

  // 5. Seed initial conversation if none exists
  const convCount = db.prepare('SELECT COUNT(*) as count FROM agent_conversations').get().count;
  if (convCount === 0) {
    const evId = existingNameMap.get('Dr. Evelyn Reed');
    const marId = existingNameMap.get('Marcus Vance');
    if (evId && marId) {
      try {
        db.prepare(`
          INSERT INTO agent_conversations (agent_a_id, agent_b_id, topic, snippet, location, timestamp)
          VALUES (?, ?, 'Renewable Urban Canopy', 'Evelyn reviewed Marcus’s structural tension equations with excitement.', 'Town Square', ?)
        `).run(evId, marId, now);
      } catch (e) {}
    }
  }

  // 3. Reward rules seed check
  const ruleCheck = db.prepare('SELECT COUNT(*) as count FROM reward_rules').get();
  if (ruleCheck.count === 0) {
    const now = new Date().toISOString();
    const insertRule = db.prepare(`
      INSERT INTO reward_rules (
        name, description, point_type, amount, trigger_event, conditions_json,
        min_limit, max_limit, cooldown_seconds, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRule.run(
      'Workplace Milestone Achievement',
      'Awarded when an agent actively works with sustained energy and delivers productive output.',
      'Merit Tokens',
      25.0,
      'work_achievement',
      JSON.stringify({ activity: 'working', min_energy: 40 }),
      5.0,
      100.0,
      120,
      1,
      'system_init',
      now,
      now
    );

    insertRule.run(
      'Civic Cooperation & Harmony Bonus',
      'Awarded when agents actively socialize and support each other in public squares.',
      'Civic Points',
      15.0,
      'cooperation',
      JSON.stringify({ activity: 'socializing', min_happiness: 60 }),
      5.0,
      50.0,
      90,
      1,
      'system_init',
      now,
      now
    );

    insertRule.run(
      'Scientific Discovery Grant',
      'Awarded for intensive research conducted at the Grand Library or Tech Hub.',
      'Community Karma',
      30.0,
      'goal_completed',
      JSON.stringify({ location: 'Grand Library', min_happiness: 50 }),
      10.0,
      150.0,
      180,
      1,
      'system_init',
      now,
      now
    );
  }

  // 4. Seed initial reward transaction for Evelyn to show ledger functionality
  const txCheck = db.prepare('SELECT COUNT(*) as count FROM reward_transactions').get();
  if (txCheck.count === 0) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO reward_transactions (
        transaction_ref, agent_id, rule_id, amount, point_type, reason, actor, status, is_reversal, original_transaction_id, created_at
      ) VALUES (?, 1, 1, 25.0, 'Merit Tokens', 'Initial system grant for quantum thermodynamics proof', 'System (Initial Seed)', 'completed', 0, NULL, ?)
    `).run('TX-' + Date.now().toString(36).toUpperCase() + '-INIT1', now);
  }

  // 5. Seed initial prayers and mannats check
  const prayerCheck = db.prepare('SELECT COUNT(*) as count FROM prayers_and_mannats').get();
  if (prayerCheck.count === 0) {
    const now = new Date().toISOString();
    const insertPrayer = db.prepare(`
      INSERT INTO prayers_and_mannats (
        request_ref, agent_id, category, original_words, request_summary,
        desired_outcome, explicit_promise, trigger_context, emotional_state,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPrayer.run(
      'REQ-2026-MANN-001',
      2, // Marcus Vance
      'Mannat',
      'हे भगवान, मेरे परिवार और पूरे नगर को हर विपत्ति से सुरक्षित रखना। अगर हमारे सोलर ग्रीनहाउस शेड का यह लोककल्याणकारी कार्य सकुशल पूरा हो गया और सभी नागरिक खुशहाल रहे, तो मैं मंदिर में अखंड दीप प्रज्वलित करूंगा और हर शुक्रवार को गरीब असहाय लोगों में अन्नदान (भोजन) कराऊंगा।\n\n(O Lord, please protect my family and our town from every hardship and adversity. If our solar greenhouse project succeeds for the welfare of the people and prosperity returns, I vow to light an eternal oil lamp at the altar and feed the poor and destitute every Friday.)',
      'मार्कस की नगर कल्याण व परिवार सुरक्षा की मन्नत: कार्य सिद्धि पर अन्नदान और दीप प्रज्वलन / Marcus takes a solemn mannat asking for family safety and successful civic greenhouse completion, pledging weekly food distribution to the needy and lighting a sacred lamp.',
      'नगर की खुशहाली, ग्रीनहाउस निर्माण और नागरिकों का कल्याण / Town flourishing, greenhouse completion, and community well-being.',
      'हर शुक्रवार असहायों को अन्नदान और पावन धाम पर अखंड दीप प्रज्वलन। / Weekly food distribution to the destitute and lighting an eternal sacred lamp.',
      'Civic planning anxieties and deep spiritual devotion to town welfare.',
      'Hopeful and dedicated',
      'pending',
      now,
      now
    );

    insertPrayer.run(
      'REQ-2026-PRAY-002',
      8, // Tariq Al-Mansoor
      'Personal Prayer',
      'हे न्याय और ज्ञान के परमेश्वर, हमारे नगर के युवाओं को धैर्य और विवेक प्रदान कीजिए। मुझे मेरी ढलती उम्र में करुणा और लगन से पढ़ाने का आत्मबल दीजिए।\n\n(O Lord of wisdom and justice, grant our youth patience to seek understanding before judgment, and grant me strength in my advancing years to teach with compassion.)',
      'तारिक की ज्ञान, धैर्य और वृद्धावस्था में शक्ति के लिए व्यक्तिगत प्रार्थना / Tariq offers a heartfelt personal prayer seeking strength in elder age and moral clarity for the next generation.',
      'आत्मिक शक्ति, वृद्धावस्था में स्वास्थ्य और छात्रों के लिए नैतिक प्रेरणा / Spiritual resilience, health in elder age, and moral inspiration for students.',
      null,
      'Contemplation of mortality and scholarly legacy in the Grand Library.',
      'Reflective and peaceful',
      'pending',
      now,
      now
    );

    insertPrayer.run(
      'REQ-2026-GRAT-003',
      6, // Julian Hayes
      'Gratitude',
      'हे ईश्वर, आपका कोटि-कोटि धन्यवाद इस सुबह की जीवनदायिनी वर्षा के लिए, जिसने हमारे पौधों को सींचा और मेरे थके हुए मन को असीम शांति दी।\n\n(I thank the Divine with all my heart for the gentle morning rains that nourished our seedlings and restored calm to my exhausted spirit.)',
      'प्राकृतिक कृपा, वर्षा और शांति के लिए कृतज्ञता / Julian expresses sincere spiritual gratitude for healing rain and renewed energy after days of ecological labor.',
      'प्रकृति और ईश्वर के प्रति कृतज्ञता / Expression of thanksgiving and continued peace.',
      null,
      'Morning sunrise after peaceful rest at Residential Complex.',
      'Grateful and serene',
      'resolved',
      now,
      now
    );
  }

  // 6. Seed initial life events check
  const lifeEventCheck = db.prepare('SELECT COUNT(*) as count FROM life_events').get();
  if (lifeEventCheck.count === 0) {
    const now = new Date().toISOString();
    const insertLifeEvent = db.prepare(`
      INSERT INTO life_events (agent_id, event_type, title, description, impact_level, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertLifeEvent.run(1, 'BIRTH', 'Town Registration', 'Dr. Evelyn Reed registered in the simulation records as Senior Quantum Physicist.', 'major', now);
    insertLifeEvent.run(2, 'CAREER_ADVANCEMENT', 'Civic Blueprint Approved', 'Marcus Vance completed architectural plans for the Town Square solar pavilion.', 'moderate', now);
    insertLifeEvent.run(8, 'MILESTONE', 'Emeritus Lecture', 'Professor Tariq Al-Mansoor delivered a keynote on Ethics in Autonomous Intelligence.', 'historic', now);
  }
}

/**
 * Execute a function within an ACID transaction.
 * Automatically rolls back on exception and commits on success.
 */
function runTransaction(callback) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  getDatabase,
  runTransaction
};

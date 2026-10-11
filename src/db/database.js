const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure data folder exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance = null;

function getDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = new DatabaseSync(config.DB_PATH);
  
  // Enable foreign keys, WAL mode, and busy timeout for concurrent safety
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  initSchema(dbInstance);
  seedInitialData(dbInstance);

  return dbInstance;
}

function initSchema(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

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
  // 1. Simulation settings check
  const settingsCheck = db.prepare('SELECT COUNT(*) as count FROM simulation_settings').get();
  if (settingsCheck.count === 0) {
    db.prepare(`
      INSERT INTO simulation_settings (id, tick_rate_ms, is_running, ai_decision_interval, gemini_enabled, world_time, weather, updated_at)
      VALUES (1, ?, 1, 2, 0, '09:00 AM (Day 1)', 'Sunny', ?)
    `).run(config.TICK_INTERVAL_DEFAULT_MS, new Date().toISOString());
  }

  // 2. Agents seed check
  const agentCheck = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  if (agentCheck.count === 0) {
    const seedAgents = [
      {
        name: 'Dr. Evelyn Reed',
        avatar: '👩‍🔬',
        photo_url: '/assets/portraits/evelyn.jpg',
        age: 34,
        date_of_birth: '1992-05-14',
        health: 98.0,
        stress: 15.0,
        emotion: 'curious',
        family_background: 'Eldest daughter of academic family from North Harbor',
        financial_status: 'Comfortable (Senior Research Grant)',
        life_history: 'Pioneered renewable quantum thermodynamics in Town and leads the Grand Library archives.',
        occupation: 'Quantum Physicist',
        location: 'Grand Library',
        activity: 'working',
        runtime_status: 'active',
        personality: 'Analytical, inquisitive, deeply ethical',
        current_goal: 'Formulate mathematical model for energy conservation',
        hunger: 80.0,
        energy: 85.0,
        happiness: 90.0,
        social_needs: 65.0,
        virtual_balance: 320.0,
        reward_points: 25.0,
        last_decision_reason: 'Needed quiet contemplation, arrived at Grand Library archive.',
        belief: 'Unsure or undecided',
        beliefSource: 'Autonomous Philosophical Discourse with Dr. Vance',
        x_coord: 420.0,
        y_coord: 180.0
      },
      {
        name: 'Marcus Vance',
        avatar: '👨‍💼',
        photo_url: '/assets/portraits/marcus.jpg',
        age: 42,
        date_of_birth: '1984-08-22',
        health: 92.0,
        stress: 28.0,
        emotion: 'hopeful',
        family_background: 'Father of two, married, long-time community organizer',
        financial_status: 'Upper Middle Class (Architect)',
        life_history: 'Designed civic infrastructure and Town Square solar pavilion.',
        occupation: 'Community Architect',
        location: 'Town Square',
        activity: 'socializing',
        runtime_status: 'active',
        personality: 'Outgoing, visionary, collaborative',
        current_goal: 'Gather civic opinions on new solar greenhouse canopy',
        hunger: 72.0,
        energy: 60.0,
        happiness: 85.0,
        social_needs: 80.0,
        virtual_balance: 240.0,
        reward_points: 40.0,
        last_decision_reason: 'Recognized fellow citizens gathering in Town Square; initiated conversation.',
        belief: 'Trusts in God',
        beliefSource: 'Personal Simulated Life Experience and Reflection',
        x_coord: 250.0,
        y_coord: 260.0
      },
      {
        name: 'Aria Thorne',
        avatar: '🎨',
        photo_url: '/assets/portraits/aria.jpg',
        age: 27,
        date_of_birth: '1999-11-03',
        health: 95.0,
        stress: 18.0,
        emotion: 'inspired',
        family_background: 'Second generation artist born to visiting botanists',
        financial_status: 'Modest / Freelance',
        life_history: 'Exhibits biomimetic sculptures and park installations in Central Park.',
        occupation: 'Digital Sculptor',
        location: 'Central Park',
        activity: 'resting',
        runtime_status: 'active',
        personality: 'Creative, contemplative, free-spirited',
        current_goal: 'Sketch generative biomimetic structures under willow trees',
        hunger: 65.0,
        energy: 78.0,
        happiness: 95.0,
        social_needs: 45.0,
        virtual_balance: 180.0,
        reward_points: 15.0,
        last_decision_reason: 'Sunny weather prompted outdoor creative reflection in Central Park.',
        belief: 'Belief not specified',
        beliefSource: 'Initial Simulation Registration',
        x_coord: 580.0,
        y_coord: 320.0
      },
      {
        name: 'Kaito Tanaka',
        avatar: '☕',
        photo_url: '/assets/portraits/kaito.jpg',
        age: 38,
        date_of_birth: '1988-02-19',
        health: 96.0,
        stress: 12.0,
        emotion: 'content',
        family_background: 'Raised in traditional tea-merchant lineage',
        financial_status: 'Stable Business Owner',
        life_history: 'Brews artisanal coffees and documents oral town histories at Sunny Cafe.',
        occupation: 'Master Barista & Historian',
        location: 'Sunny Cafe',
        activity: 'working',
        runtime_status: 'active',
        personality: 'Warm, hospitable, observant',
        current_goal: 'Brew artisanal blends and converse with weary morning commuters',
        hunger: 90.0,
        energy: 70.0,
        happiness: 88.0,
        social_needs: 85.0,
        virtual_balance: 290.0,
        reward_points: 30.0,
        last_decision_reason: 'Prepared morning roasting cycle at Sunny Cafe.',
        belief: 'Does not trust in God',
        beliefSource: 'Autonomous Philosophical Discourse with Dr. Reed',
        x_coord: 180.0,
        y_coord: 390.0
      },
      {
        name: 'Elena Rostova',
        avatar: '💻',
        photo_url: '/assets/portraits/elena.jpg',
        age: 29,
        date_of_birth: '1997-06-30',
        health: 97.0,
        stress: 22.0,
        emotion: 'focused',
        family_background: 'Daughter of aerospace engineers',
        financial_status: 'High Income (Lead Engineer)',
        life_history: 'Oversees town automated power grid and grid resiliency.',
        occupation: 'Systems Engineer',
        location: 'Workplace (Tech Hub)',
        activity: 'working',
        runtime_status: 'active',
        personality: 'Methodical, perfectionist, focused',
        current_goal: 'Debug simulation telemetric grid optimization loop',
        hunger: 55.0,
        energy: 45.0,
        happiness: 72.0,
        social_needs: 40.0,
        virtual_balance: 410.0,
        reward_points: 50.0,
        last_decision_reason: 'Focused on resolving high-priority algorithmic backlog item.',
        belief: 'Does not trust in God',
        beliefSource: 'Autonomous Reasoning and Life Reflection',
        x_coord: 720.0,
        y_coord: 150.0
      },
      {
        name: 'Julian Hayes',
        avatar: '🌿',
        photo_url: '/assets/portraits/julian.jpg',
        age: 31,
        date_of_birth: '1995-09-11',
        health: 94.0,
        stress: 14.0,
        emotion: 'peaceful',
        family_background: 'Farming family origins from eastern valley',
        financial_status: 'Comfortable (Master Horticulturist)',
        life_history: 'Cultivates town rooftop farms and botanical reserves.',
        occupation: 'Urban Ecologist',
        location: 'Residential Complex',
        activity: 'sleeping',
        runtime_status: 'active', // Active in sim, but currently sleeping!
        personality: 'Patient, calm, nature-aligned',
        current_goal: 'Recharge sleep cycles before morning soil sampling',
        hunger: 70.0,
        energy: 18.0,
        happiness: 68.0,
        social_needs: 50.0,
        virtual_balance: 195.0,
        reward_points: 10.0,
        last_decision_reason: 'Energy dipped below critical threshold (18%); retreated home to sleep.',
        belief: 'Trusts in God',
        beliefSource: 'Personal Simulated Life Experience',
        x_coord: 120.0,
        y_coord: 140.0
      },
      {
        name: 'Sora Williams',
        avatar: '🏥',
        photo_url: '/assets/portraits/sora.jpg',
        age: 33,
        date_of_birth: '1993-01-25',
        health: 96.0,
        stress: 24.0,
        emotion: 'empathetic',
        family_background: 'Single, close ties with healthcare collective',
        financial_status: 'Stable (Medical Researcher)',
        life_history: 'Coordinates preventive healthcare clinic for all citizens.',
        occupation: 'Biomedical Researcher',
        location: 'Wellness Clinic',
        activity: 'working',
        runtime_status: 'active',
        personality: 'Empathetic, cautious, diligent',
        current_goal: 'Calibrate metabolic scanners for community wellness',
        hunger: 82.0,
        energy: 65.0,
        happiness: 80.0,
        social_needs: 60.0,
        virtual_balance: 275.0,
        reward_points: 20.0,
        last_decision_reason: 'Scheduled clinic duty hours began at Wellness Clinic.',
        belief: 'Unsure or undecided',
        beliefSource: 'Autonomous Philosophical Discourse',
        x_coord: 680.0,
        y_coord: 440.0
      },
      {
        name: 'Tariq Al-Mansoor',
        avatar: '📚',
        photo_url: '/assets/portraits/tariq.jpg',
        age: 67,
        date_of_birth: '1959-10-18',
        health: 82.0,
        stress: 20.0,
        emotion: 'reflective',
        family_background: 'Widower, respected grandfather and scholar',
        financial_status: 'Pension & Savings',
        life_history: 'Emeritus Professor of Ethics, author of 4 foundational treatises.',
        occupation: 'Ethics Professor',
        location: 'Grand Library',
        activity: 'walking',
        runtime_status: 'paused', // Paused administratively for inspection
        personality: 'Erudite, principled, oratorical',
        current_goal: 'Prepare symposium lecture on AI civic consciousness',
        hunger: 75.0,
        energy: 55.0,
        happiness: 76.0,
        social_needs: 62.0,
        virtual_balance: 310.0,
        reward_points: 15.0,
        last_decision_reason: 'Walking between archive shelves examining ancient codices.',
        belief: 'Trusts in God',
        beliefSource: 'Autonomous Reflection and Scholarly Examination',
        x_coord: 460.0,
        y_coord: 210.0
      },
      {
        name: 'Nadia Chen',
        avatar: '🛠️',
        photo_url: '/assets/portraits/nadia.jpg',
        age: 26,
        date_of_birth: '2000-03-08',
        health: 90.0,
        stress: 35.0,
        emotion: 'restless',
        family_background: 'Youngest of four siblings from industrial district',
        financial_status: 'Modest Savings',
        life_history: 'Maintains automated drone fleet and civic transit robots.',
        occupation: 'Robotics Technician',
        location: 'Workplace (Tech Hub)',
        activity: 'resting',
        runtime_status: 'deactivated', // Administratively deactivated
        personality: 'Bold, inventive, restless',
        current_goal: 'Archived unit awaiting administrative reactivation protocol',
        hunger: 50.0,
        energy: 50.0,
        happiness: 50.0,
        social_needs: 50.0,
        virtual_balance: 120.0,
        reward_points: 5.0,
        last_decision_reason: 'Deactivated by administrative authority for maintenance.',
        belief: 'Belief not specified',
        beliefSource: 'Initial Simulation Registration',
        x_coord: 750.0,
        y_coord: 200.0
      }
    ];

    const insertAgent = db.prepare(`
      INSERT INTO agents (
        name, avatar, photo_url, age, date_of_birth, health, stress, emotion,
        family_background, financial_status, life_history,
        occupation, location, activity, runtime_status,
        personality, current_goal, hunger, energy, happiness, social_needs,
        virtual_balance, reward_points, last_decision_reason, last_decision_time,
        x_coord, y_coord, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertBelief = db.prepare(`
      INSERT INTO agent_belief_profiles (agent_id, belief_status, declared_source, notes, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMemory = db.prepare(`
      INSERT INTO agent_memories (agent_id, memory_text, emotional_valence, privacy_level, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const a of seedAgents) {
      const res = insertAgent.run(
        a.name, a.avatar, a.photo_url, a.age, a.date_of_birth, a.health, a.stress, a.emotion,
        a.family_background, a.financial_status, a.life_history,
        a.occupation, a.location, a.activity, a.runtime_status,
        a.personality, a.current_goal, a.hunger, a.energy, a.happiness, a.social_needs,
        a.virtual_balance, a.reward_points, a.last_decision_reason, now,
        a.x_coord, a.y_coord, now, now
      );
      const agentId = res.lastInsertRowid;

      // Belief profile stored separately
      insertBelief.run(agentId, a.belief, a.beliefSource, 'Recorded in simulation timeline', now);

      // Seed memories
      insertMemory.run(agentId, `Joined the Autonomous Human Simulation as ${a.occupation}.`, 0.8, 'public', now);
      insertMemory.run(agentId, `Formulated personal goal: "${a.current_goal}".`, 0.5, 'private', now);
    }

    // Seed relationship between Evelyn and Marcus
    db.prepare(`
      INSERT INTO agent_relationships (agent_a_id, agent_b_id, relationship_type, affinity_score, trust_score, updated_at)
      VALUES (1, 2, 'Collaborator', 82.0, 78.0, ?)
    `).run(now);

    // Seed conversation
    db.prepare(`
      INSERT INTO agent_conversations (agent_a_id, agent_b_id, topic, snippet, location, timestamp)
      VALUES (1, 2, 'Renewable Urban Canopy', 'Evelyn reviewed Marcus’s structural tension equations with excitement.', 'Town Square', ?)
    `).run(now);
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

-- Autonomous AI Human Simulation & Admin Control Panel Schema

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'superadmin',
  created_at TEXT NOT NULL,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar TEXT,
  occupation TEXT NOT NULL,
  location TEXT NOT NULL,
  activity TEXT NOT NULL, -- 'working', 'eating', 'walking', 'resting', 'socializing', 'sleeping'
  runtime_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'deactivated'
  personality TEXT NOT NULL,
  current_goal TEXT NOT NULL,
  hunger REAL NOT NULL DEFAULT 85.0,     -- 0 to 100 (100 = full/satiated, <25 triggers eating)
  energy REAL NOT NULL DEFAULT 90.0,     -- 0 to 100 (<20 triggers sleeping)
  happiness REAL NOT NULL DEFAULT 75.0,  -- 0 to 100
  social_needs REAL NOT NULL DEFAULT 70.0, -- 0 to 100 (<30 triggers socializing)
  virtual_balance REAL NOT NULL DEFAULT 150.0, -- in-world Solis currency
  reward_points REAL NOT NULL DEFAULT 0.0,   -- total merit points earned
  last_decision_reason TEXT,
  last_decision_time TEXT,
  x_coord REAL DEFAULT 100.0,
  y_coord REAL DEFAULT 100.0,
  generation INTEGER DEFAULT 1,
  parent_a_id INTEGER,
  parent_b_id INTEGER,
  age INTEGER DEFAULT 32,
  date_of_birth TEXT,
  health REAL NOT NULL DEFAULT 95.0,
  stress REAL NOT NULL DEFAULT 20.0,
  emotion TEXT NOT NULL DEFAULT 'hopeful',
  photo_url TEXT,
  family_background TEXT,
  financial_status TEXT DEFAULT 'Stable',
  life_history TEXT DEFAULT '[]',
  deceased_at TEXT,
  cause_of_death TEXT,
  inheritance_executed INTEGER DEFAULT 0,
  preferred_city TEXT,
  choice_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_belief_profiles (
  agent_id INTEGER PRIMARY KEY,
  belief_status TEXT NOT NULL DEFAULT 'Belief not specified', 
  -- Allowed fictional simulation values:
  -- 'Trusts in God', 'Does not trust in God', 'Unsure or undecided', 'Belief not specified'
  declared_source TEXT NOT NULL DEFAULT 'Autonomous Reflection after Philosophical Discourse',
  notes TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  memory_text TEXT NOT NULL,
  emotional_valence REAL DEFAULT 0.0, -- -1.0 to 1.0
  privacy_level TEXT DEFAULT 'private', -- 'public', 'private', 'deep_confidential'
  timestamp TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_a_id INTEGER NOT NULL,
  agent_b_id INTEGER NOT NULL,
  relationship_type TEXT DEFAULT 'Acquaintance',
  affinity_score REAL DEFAULT 50.0,
  trust_score REAL DEFAULT 50.0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agent_a_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_b_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_a_id INTEGER NOT NULL,
  agent_b_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  snippet TEXT NOT NULL,
  location TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  point_type TEXT NOT NULL DEFAULT 'Merit Tokens', -- 'Merit Tokens', 'Civic Points', 'Community Karma', 'Gold Solis'
  amount REAL NOT NULL,
  trigger_event TEXT NOT NULL, -- 'goal_completed', 'work_achievement', 'cooperation', 'helpful_action', 'philosophical_dialogue'
  conditions_json TEXT NOT NULL DEFAULT '{}',
  min_limit REAL DEFAULT 1.0,
  max_limit REAL DEFAULT 500.0,
  cooldown_seconds INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_ref TEXT UNIQUE NOT NULL,
  agent_id INTEGER NOT NULL,
  rule_id INTEGER,
  amount REAL NOT NULL,
  point_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL, -- e.g. 'Admin (admin)', 'System (Engine: Rule #1)'
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'reversed'
  is_reversal INTEGER DEFAULT 0,
  original_transaction_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_id) REFERENCES reward_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (original_transaction_id) REFERENCES reward_transactions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS simulation_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tick_rate_ms INTEGER NOT NULL DEFAULT 3000,
  is_running INTEGER NOT NULL DEFAULT 1,
  ai_decision_interval INTEGER NOT NULL DEFAULT 2,
  gemini_enabled INTEGER NOT NULL DEFAULT 0,
  reproduction_enabled INTEGER NOT NULL DEFAULT 1,
  max_population INTEGER NOT NULL DEFAULT 25,
  aging_speed REAL NOT NULL DEFAULT 1.0,
  mortality_rate REAL NOT NULL DEFAULT 1.0,
  enable_natural_death INTEGER NOT NULL DEFAULT 1,
  enable_illness_death INTEGER NOT NULL DEFAULT 1,
  enable_accidental_death INTEGER NOT NULL DEFAULT 1,
  max_natural_age INTEGER NOT NULL DEFAULT 95,
  world_time TEXT NOT NULL DEFAULT '09:00 AM (Day 1)',
  weather TEXT NOT NULL DEFAULT 'Sunny',
  time_speed_multiplier REAL NOT NULL DEFAULT 1.0,
  tech_level REAL NOT NULL DEFAULT 120.0,
  tech_growth_rate REAL NOT NULL DEFAULT 1.0,
  tech_era TEXT NOT NULL DEFAULT 'Digital & Cybernetic Age',
  tech_discoveries TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prayers_and_mannats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_ref TEXT UNIQUE NOT NULL,
  agent_id INTEGER NOT NULL,
  category TEXT NOT NULL, -- 'Mannat', 'Personal Prayer', 'Gratitude', 'Reflection', 'Needs Review'
  original_words TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  explicit_promise TEXT,
  trigger_context TEXT NOT NULL,
  emotional_state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'fulfilled', 'unfulfilled', 'postponed', 'resolved'
  admin_notes TEXT,
  decision_by TEXT,
  decision_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS life_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'BIRTH', 'MARRIAGE', 'DEATH', 'FUNERAL', 'PRAYER_MADE', 'PRAYER_FULFILLED', 'PRAYER_DECLINED', 'ILLNESS', 'ACCIDENT', 'CAREER_ADVANCEMENT', 'FINANCIAL_CRISIS', 'MEMORIAL'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_level TEXT DEFAULT 'moderate',
  timestamp TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'Agent', 'RewardRule', 'RewardTransaction', 'BeliefProfile', 'AdminAuth', 'SimulationSetting', 'Prayer'
  target_id TEXT,
  target_name TEXT,
  details TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(runtime_status);
CREATE INDEX IF NOT EXISTS idx_agents_activity ON agents(activity);
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location);
CREATE INDEX IF NOT EXISTS idx_reward_tx_agent ON reward_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_prayers_agent ON prayers_and_mannats(agent_id);
CREATE INDEX IF NOT EXISTS idx_prayers_status ON prayers_and_mannats(status);
CREATE INDEX IF NOT EXISTS idx_life_events_agent ON life_events(agent_id);

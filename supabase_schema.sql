-- ============================================================================
-- AUTONOMOUS AI HUMAN SIMULATION - SUPABASE POSTGRESQL SCHEMA
-- Paste and run this SQL in your Supabase Project SQL Editor:
-- https://supabase.com/dashboard/project/fcxgvpiofqrefeewnemj/sql/new
-- ============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Agents Table (Photorealistic Human Citizens, Needs, Life Cycle & Death)
CREATE TABLE IF NOT EXISTS public.agents (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  photo_url TEXT,
  age INTEGER DEFAULT 32,
  date_of_birth TEXT,
  health DOUBLE PRECISION DEFAULT 95.0,
  stress DOUBLE PRECISION DEFAULT 20.0,
  emotion TEXT DEFAULT 'hopeful',
  family_background TEXT,
  financial_status TEXT DEFAULT 'Stable',
  life_history TEXT DEFAULT '[]',
  occupation TEXT NOT NULL,
  location TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT 'working',
  runtime_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'deactivated', 'deceased'
  personality TEXT NOT NULL,
  current_goal TEXT NOT NULL,
  hunger DOUBLE PRECISION DEFAULT 70.0,
  energy DOUBLE PRECISION DEFAULT 75.0,
  happiness DOUBLE PRECISION DEFAULT 80.0,
  social_needs DOUBLE PRECISION DEFAULT 65.0,
  virtual_balance DOUBLE PRECISION DEFAULT 100.0,
  reward_points DOUBLE PRECISION DEFAULT 0.0,
  last_decision_reason TEXT,
  last_decision_time TIMESTAMPTZ,
  x_coord DOUBLE PRECISION DEFAULT 250.0,
  y_coord DOUBLE PRECISION DEFAULT 250.0,
  generation INTEGER DEFAULT 1,
  parent_a_id BIGINT,
  parent_b_id BIGINT,
  deceased_at TIMESTAMPTZ,
  cause_of_death TEXT,
  inheritance_executed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Agent Belief Profiles Table
CREATE TABLE IF NOT EXISTS public.agent_belief_profiles (
  agent_id BIGINT PRIMARY KEY REFERENCES public.agents(id) ON DELETE CASCADE,
  belief_status TEXT NOT NULL DEFAULT 'Belief not specified',
  declared_source TEXT NOT NULL DEFAULT 'Autonomous Reflection',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Prayers & Mannats Table (Spiritual Petitions, Vows & Administrative Decisions)
CREATE TABLE IF NOT EXISTS public.prayers_and_mannats (
  id BIGSERIAL PRIMARY KEY,
  request_ref TEXT UNIQUE NOT NULL,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'Mannat', 'Personal Prayer', 'Gratitude', 'Reflection', 'Needs Review'
  original_words TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  explicit_promise TEXT,
  trigger_context TEXT NOT NULL,
  emotional_state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'fulfilled', 'declined', 'postponed', 'resolved'
  admin_notes TEXT,
  decision_by TEXT,
  decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Life Events & Memorials Table
CREATE TABLE IF NOT EXISTS public.life_events (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'BIRTH', 'MARRIAGE', 'DEATH', 'PRAYER_MADE', 'PRAYER_FULFILLED', 'PRAYER_DECLINED', 'CAREER_ADVANCEMENT', 'MILESTONE'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_level TEXT DEFAULT 'moderate',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Agent Memories Table
CREATE TABLE IF NOT EXISTS public.agent_memories (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  memory_text TEXT NOT NULL,
  emotional_valence DOUBLE PRECISION DEFAULT 0.0,
  privacy_level TEXT DEFAULT 'private',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Agent Relationships Table
CREATE TABLE IF NOT EXISTS public.agent_relationships (
  id BIGSERIAL PRIMARY KEY,
  agent_a_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  agent_b_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'Acquaintance',
  affinity_score DOUBLE PRECISION DEFAULT 50.0,
  trust_score DOUBLE PRECISION DEFAULT 50.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Audit Logs Table (Administrative Actions & Security Interventions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details JSONB,
  ip_address TEXT
);

-- 8. Reward Rules & Ledger
CREATE TABLE IF NOT EXISTS public.reward_rules (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  point_type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  trigger_event TEXT,
  conditions_json JSONB,
  min_limit DOUBLE PRECISION DEFAULT 1.0,
  max_limit DOUBLE PRECISION DEFAULT 1000.0,
  cooldown_seconds INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_ref TEXT UNIQUE NOT NULL,
  agent_id BIGINT NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  rule_id BIGINT REFERENCES public.reward_rules(id) ON DELETE SET NULL,
  amount DOUBLE PRECISION NOT NULL,
  point_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  is_reversal INTEGER DEFAULT 0,
  original_transaction_id BIGINT REFERENCES public.reward_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Simulation Settings Table
CREATE TABLE IF NOT EXISTS public.simulation_settings (
  id BIGINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tick_rate_ms INTEGER DEFAULT 3000,
  is_running INTEGER DEFAULT 1,
  ai_decision_interval INTEGER DEFAULT 2,
  gemini_enabled INTEGER DEFAULT 0,
  reproduction_enabled INTEGER DEFAULT 1,
  max_population INTEGER DEFAULT 25,
  aging_speed DOUBLE PRECISION DEFAULT 1.0,
  mortality_rate DOUBLE PRECISION DEFAULT 1.0,
  enable_natural_death INTEGER DEFAULT 1,
  enable_illness_death INTEGER DEFAULT 1,
  enable_accidental_death INTEGER DEFAULT 1,
  max_natural_age INTEGER DEFAULT 95,
  world_time TEXT DEFAULT '09:00 AM (Day 1)',
  weather TEXT DEFAULT 'Sunny',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow service role / authenticated access
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayers_and_mannats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow full access to service role (used by simulation backend)
CREATE POLICY "Full access to service role for agents" ON public.agents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access to service role for prayers" ON public.prayers_and_mannats
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access to service role for life_events" ON public.life_events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access to service role for audit_logs" ON public.audit_logs
  FOR ALL USING (true) WITH CHECK (true);

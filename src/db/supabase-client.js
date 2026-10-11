const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseInstance = null;

/**
 * Returns a singleton instance of the Supabase client.
 * Uses SUPABASE_SECRET_KEY (service role) on the server for full operational safety.
 */
function getSupabaseClient() {
  if (!config.SUPABASE_URL) {
    return null;
  }

  if (!supabaseInstance) {
    const key = config.SUPABASE_SECRET_KEY || config.SUPABASE_PUBLISHABLE_KEY;
    if (!key) return null;

    supabaseInstance = createClient(config.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseInstance;
}

/**
 * Test connectivity with the remote Supabase project.
 */
async function testSupabaseConnection() {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      error: 'Supabase URL or Key is not configured in environment.'
    };
  }

  try {
    // Try pinging or querying a table or checking auth health
    const { data, error } = await client.from('agents').select('count', { count: 'exact', head: true });
    
    // Even if the table 'agents' doesn't exist yet on a fresh project, getting a response means network + auth succeeded
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // 42P01 means table does not exist in Postgres, which is expected before initial schema migration
      return {
        connected: true,
        schemaReady: false,
        note: `Connected to Supabase project (${config.SUPABASE_URL}), but tables need to be created: ${error.message}`
      };
    }

    return {
      connected: true,
      schemaReady: !error,
      url: config.SUPABASE_URL
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

/**
 * Sync or upsert a local agent to Supabase.
 */
async function syncAgentToSupabase(agent) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      photo_url: agent.photo_url,
      age: agent.age,
      date_of_birth: agent.date_of_birth,
      health: agent.health,
      stress: agent.stress,
      emotion: agent.emotion,
      family_background: agent.family_background,
      financial_status: agent.financial_status,
      life_history: agent.life_history,
      occupation: agent.occupation,
      location: agent.location,
      activity: agent.activity,
      runtime_status: agent.runtime_status,
      personality: agent.personality,
      current_goal: agent.current_goal,
      hunger: agent.hunger,
      energy: agent.energy,
      happiness: agent.happiness,
      social_needs: agent.social_needs,
      virtual_balance: agent.virtual_balance,
      reward_points: agent.reward_points,
      last_decision_reason: agent.last_decision_reason,
      deceased_at: agent.deceased_at,
      cause_of_death: agent.cause_of_death,
      inheritance_executed: agent.inheritance_executed ? 1 : 0,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client.from('agents').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] Warning syncing agent:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing agent:', err.message);
    return false;
  }
}

/**
 * Sync or upsert a prayer/mannat to Supabase.
 */
async function syncPrayerToSupabase(prayer) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: prayer.id,
      request_ref: prayer.request_ref,
      agent_id: prayer.agent_id,
      category: prayer.category,
      original_words: prayer.original_words,
      request_summary: prayer.request_summary,
      desired_outcome: prayer.desired_outcome,
      explicit_promise: prayer.explicit_promise,
      trigger_context: prayer.trigger_context,
      emotional_state: prayer.emotional_state,
      status: prayer.status,
      admin_notes: prayer.admin_notes,
      decision_by: prayer.decision_by,
      decision_at: prayer.decision_at,
      created_at: prayer.created_at,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('prayers_and_mannats').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] Warning syncing prayer:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing prayer:', err.message);
    return false;
  }
}

/**
 * Sync a life event to Supabase.
 */
async function syncLifeEventToSupabase(event) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const payload = {
      id: event.id,
      agent_id: event.agent_id,
      event_type: event.event_type,
      title: event.title,
      description: event.description,
      impact_level: event.impact_level || 'moderate',
      timestamp: event.timestamp || new Date().toISOString()
    };

    const { error } = await client.from('life_events').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Sync] Warning syncing life event:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Sync] Exception syncing life event:', err.message);
    return false;
  }
}

module.exports = {
  getSupabaseClient,
  testSupabaseConnection,
  syncAgentToSupabase,
  syncPrayerToSupabase,
  syncLifeEventToSupabase
};

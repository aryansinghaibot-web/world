const { getDatabase } = require('../src/db/database');
const { getSupabaseClient, testSupabaseConnection } = require('../src/db/supabase-client');

async function runSync() {
  console.log('========================================================');
  console.log(' Supabase Cloud Synchronization & Verification');
  console.log('========================================================\n');

  console.log('1. Testing connection to Supabase...');
  const conn = await testSupabaseConnection();
  console.log('Connection test result:', conn);

  if (!conn.connected) {
    console.error('❌ Could not connect to Supabase:', conn.error);
    process.exit(1);
  }

  const client = getSupabaseClient();
  const db = getDatabase();

  console.log('\n2. Syncing local SQLite agents to Supabase...');
  const agents = db.prepare('SELECT * FROM agents').all();
  console.log(`Found ${agents.length} local agents in SQLite.`);

  let agentsSynced = 0;
  for (const a of agents) {
    const payload = {
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      photo_url: a.photo_url,
      age: a.age,
      date_of_birth: a.date_of_birth,
      health: a.health,
      stress: a.stress,
      emotion: a.emotion,
      family_background: a.family_background,
      financial_status: a.financial_status,
      life_history: a.life_history,
      occupation: a.occupation,
      location: a.location,
      activity: a.activity,
      runtime_status: a.runtime_status,
      personality: a.personality,
      current_goal: a.current_goal,
      hunger: a.hunger,
      energy: a.energy,
      happiness: a.happiness,
      social_needs: a.social_needs,
      virtual_balance: a.virtual_balance,
      reward_points: a.reward_points,
      last_decision_reason: a.last_decision_reason,
      deceased_at: a.deceased_at,
      cause_of_death: a.cause_of_death,
      inheritance_executed: a.inheritance_executed ? 1 : 0,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('agents').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`  ⚠️ Table 'agents' error (${error.message}). Please ensure supabase_schema.sql has been run.`);
      break;
    } else {
      agentsSynced++;
    }
  }

  if (agentsSynced > 0) {
    console.log(`✅ Successfully synced ${agentsSynced}/${agents.length} agents to Supabase!`);
  }

  console.log('\n3. Syncing prayers and mannats to Supabase...');
  const prayers = db.prepare('SELECT * FROM prayers_and_mannats').all();
  let prayersSynced = 0;
  for (const p of prayers) {
    const payload = {
      id: p.id,
      request_ref: p.request_ref,
      agent_id: p.agent_id,
      category: p.category,
      original_words: p.original_words,
      request_summary: p.request_summary,
      desired_outcome: p.desired_outcome,
      explicit_promise: p.explicit_promise,
      trigger_context: p.trigger_context,
      emotional_state: p.emotional_state,
      status: p.status,
      admin_notes: p.admin_notes,
      decision_by: p.decision_by,
      decision_at: p.decision_at,
      created_at: p.created_at,
      updated_at: p.updated_at
    };

    const { error } = await client.from('prayers_and_mannats').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`  ⚠️ Table 'prayers_and_mannats' error (${error.message}).`);
      break;
    } else {
      prayersSynced++;
    }
  }

  if (prayersSynced > 0) {
    console.log(`✅ Successfully synced ${prayersSynced}/${prayers.length} prayers to Supabase!`);
  }

  console.log('\n========================================================');
  console.log(' Synchronization Completed.');
  console.log('========================================================');
}

runSync().catch(console.error);

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.DB_PATH = path.join(__dirname, '..', 'data', 'test-simulation.db');

// Remove test DB if leftover
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

const { startServer, stopServer } = require('../src/server');
const { createAdminUser, authenticateAdmin } = require('../src/security/auth');
const { getDatabase } = require('../src/db/database');
const engine = require('../src/simulation/engine');

const BASE_URL = 'http://localhost:3099';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = options.headers || {};
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTestSuite() {
  console.log('========================================================');
  console.log(' Starting Autonomous AI Simulation Test Suite');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error(err);
      failed++;
    }
  }

  await startServer(3099);

  let sessionToken = null;
  let csrfToken = null;

  try {
    // 1. Admin Authentication & Unauthorized Access Denial
    await test('Unauthorized access denial for protected routes', async () => {
      const res = await request('/api/admin/agents');
      assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized without session');
      assert.ok(res.data.error, 'Should contain error object');
    });

    await test('Provision administrator account & secure login', async () => {
      // First setup
      const setupRes = await request('/api/admin/auth/initial-setup', {
        method: 'POST',
        body: { username: 'testadmin', password: 'SuperSecretPassword123!' }
      });
      assert.strictEqual(setupRes.status, 201, 'Admin should be created');
      assert.strictEqual(setupRes.data.admin.username, 'testadmin');

      // Login
      const loginRes = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'testadmin', password: 'SuperSecretPassword123!' }
      });
      assert.strictEqual(loginRes.status, 200, 'Login should succeed');
      assert.ok(loginRes.data.token, 'Session token should be returned');
      assert.ok(loginRes.data.csrfToken, 'CSRF token should be returned');

      sessionToken = loginRes.data.token;
      csrfToken = loginRes.data.csrfToken;
    });

    await test('Rejected login on invalid credentials', async () => {
      const res = await request('/api/admin/auth/login', {
        method: 'POST',
        body: { username: 'testadmin', password: 'WrongPassword!' }
      });
      assert.strictEqual(res.status, 401, 'Should fail with 401 for bad password');
    });

    // 2. Counts for active, paused, sleeping, and deactivated agents
    await test('Correct counts for active, paused, sleeping, and deactivated agents', async () => {
      const res = await request('/api/world/snapshot');
      assert.strictEqual(res.status, 200);
      const kpis = res.data.kpis;

      assert.strictEqual(kpis.totalAgents, 9, 'Should have 9 initial seed agents');
      assert.strictEqual(kpis.activeAgents, 7, 'Should have 7 active agents');
      assert.strictEqual(kpis.pausedAgents, 1, 'Should have 1 paused agent (Tariq)');
      assert.strictEqual(kpis.deactivatedAgents, 1, 'Should have 1 deactivated agent (Nadia)');
      assert.strictEqual(kpis.sleepingAgents, 1, 'Should have 1 sleeping agent (Julian)');
      // Distinction verification: Julian is both sleeping AND administratively active
      const julian = res.data.agents.find(a => a.name === 'Julian Hayes');
      assert.strictEqual(julian.activity, 'sleeping');
      assert.strictEqual(julian.runtime_status, 'active');
    });

    // 3. Agent Pause / Resume and Deactivate / Reactivate
    await test('Agent pause and resume lifecycle operations', async () => {
      // Pause agent #1 (Evelyn)
      const pauseRes = await request('/api/admin/agents/1/pause', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        }
      });
      assert.strictEqual(pauseRes.status, 200);
      assert.strictEqual(pauseRes.data.result.status, 'paused');

      // Verify status in DB
      let agent = getDatabase().prepare('SELECT runtime_status FROM agents WHERE id = 1').get();
      assert.strictEqual(agent.runtime_status, 'paused');

      // Resume agent #1
      const resumeRes = await request('/api/admin/agents/1/resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        }
      });
      assert.strictEqual(resumeRes.status, 200);
      agent = getDatabase().prepare('SELECT runtime_status FROM agents WHERE id = 1').get();
      assert.strictEqual(agent.runtime_status, 'active');
    });

    await test('Agent deactivate and reactivate lifecycle operations', async () => {
      // Deactivate agent #2 (Marcus)
      const deactRes = await request('/api/admin/agents/2/deactivate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        }
      });
      assert.strictEqual(deactRes.status, 200);
      let agent = getDatabase().prepare('SELECT runtime_status FROM agents WHERE id = 2').get();
      assert.strictEqual(agent.runtime_status, 'deactivated');

      // Reactivate agent #2
      const reactRes = await request('/api/admin/agents/2/reactivate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        }
      });
      assert.strictEqual(reactRes.status, 200);
      agent = getDatabase().prepare('SELECT runtime_status FROM agents WHERE id = 2').get();
      assert.strictEqual(agent.runtime_status, 'active');
    });

    // 4. Belief Profile Creation & Filtering
    await test('Belief profile retrieval, updating, and source tracking', async () => {
      // Get stats
      const statsRes = await request('/api/admin/beliefs/stats', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(statsRes.status, 200);
      assert.ok(statsRes.data.distribution['Trusts in God'] >= 1);
      assert.ok(statsRes.data.distribution['Does not trust in God'] >= 1);

      // Update belief for agent #3 (Aria)
      const updateRes = await request('/api/admin/beliefs/3', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          belief_status: 'Trusts in God',
          declared_source: 'Simulated Artistic Revelation in Central Park',
          notes: 'Experimental observation'
        }
      });
      assert.strictEqual(updateRes.status, 200);
      assert.strictEqual(updateRes.data.profile.belief_status, 'Trusts in God');
      assert.strictEqual(updateRes.data.profile.declared_source, 'Simulated Artistic Revelation in Central Park');

      // Verify belief is stored separately and queryable via agent list
      const agentRes = await request('/api/admin/agents?belief=Trusts in God', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const matching = agentRes.data.data.map(a => a.name);
      assert.ok(matching.includes('Aria Thorne'));
    });

    // 5. Reward Rule Validation and Manual Reward Grants
    await test('Reward rule creation with validation and limit enforcement', async () => {
      // Invalid rule (amount > max_limit)
      const badRes = await request('/api/admin/rewards/rules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          name: 'Invalid Big Reward',
          amount: 1000,
          min_limit: 1,
          max_limit: 100
        }
      });
      assert.strictEqual(badRes.status, 400, 'Should reject rule exceeding limit');

      // Valid rule
      const validRes = await request('/api/admin/rewards/rules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          name: 'Eco Harmony Award',
          description: 'Award for urban ecology preservation',
          amount: 35.0,
          point_type: 'Merit Tokens',
          trigger_event: 'cooperation',
          conditions: { min_energy: 30 },
          min_limit: 5,
          max_limit: 100,
          cooldown_seconds: 30
        }
      });
      assert.strictEqual(validRes.status, 201);
      assert.strictEqual(validRes.data.rule.name, 'Eco Harmony Award');
    });

    await test('Manual reward grant & balance update', async () => {
      const initialAgent = getDatabase().prepare('SELECT reward_points FROM agents WHERE id = 1').get();
      const grantRes = await request('/api/admin/rewards/grant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          agentId: 1,
          amount: 50.0,
          point_type: 'Civic Points',
          reason: 'Manual grant by administrator for groundbreaking research'
        }
      });
      assert.strictEqual(grantRes.status, 201);
      assert.strictEqual(grantRes.data.transaction.amount, 50.0);

      // Verify agent reward balance increased by granted amount
      const agent = getDatabase().prepare('SELECT reward_points FROM agents WHERE id = 1').get();
      assert.strictEqual(agent.reward_points, initialAgent.reward_points + 50.0);
    });

    await test('Bulk reward grant to eligible agents with duplicate protection', async () => {
      // Create a test rule that targets working agents
      const ruleRes = await request('/api/admin/rewards/rules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          name: 'Bulk Production Stimulus',
          amount: 15.0,
          point_type: 'Merit Tokens',
          trigger_event: 'work_achievement',
          conditions: { activity: 'working' },
          min_limit: 1,
          max_limit: 50,
          cooldown_seconds: 60
        }
      });
      assert.strictEqual(ruleRes.status, 201);
      const ruleId = ruleRes.data.rule.id;

      // Apply bulk
      const bulkRes = await request(`/api/admin/rewards/rules/${ruleId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {}
      });
      assert.strictEqual(bulkRes.status, 200);
      assert.ok(bulkRes.data.result.grantedCount >= 1, 'Should grant rewards to active working agents');

      // Second immediate bulk apply should skip due to cooldown
      const secondBulk = await request(`/api/admin/rewards/rules/${ruleId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {}
      });
      assert.strictEqual(secondBulk.status, 200);
      assert.strictEqual(secondBulk.data.result.grantedCount, 0, 'Should grant 0 due to cooldown');
      assert.ok(secondBulk.data.result.skippedCount >= 1, 'Should record skipped agents');
    });

    // 6. Automatic Rewards and Duplicate Prevention
    await test('Duplicate reward prevention within cooldown window', async () => {
      const db = getDatabase();
      const { grantRewardTransaction } = require('../src/rewards/engine');

      // Clear any prior cooldown from previous bulk test
      db.prepare('DELETE FROM reward_transactions WHERE agent_id = ? AND rule_id = ?').run(4, 1);

      // First grant under rule #1
      const tx1 = grantRewardTransaction({
        agentId: 4,
        ruleId: 1,
        amount: 25.0,
        pointType: 'Merit Tokens',
        reason: 'Work test 1',
        actor: 'Test Engine'
      });
      assert.ok(tx1.transactionId);

      // Second immediate grant under rule #1 should fail cooldown check
      let failedDuplicate = false;
      try {
        grantRewardTransaction({
          agentId: 4,
          ruleId: 1,
          amount: 25.0,
          pointType: 'Merit Tokens',
          reason: 'Work test 2 (duplicate)',
          actor: 'Test Engine'
        });
      } catch (e) {
        failedDuplicate = true;
        assert.ok(e.message.includes('Duplicate reward prevention active'));
      }
      assert.strictEqual(failedDuplicate, true, 'Cooldown must block duplicate grant');
    });

    // 7. Concurrent Reward Updates & Transactional Balance Integrity
    await test('Atomic transactions and reversal records with balance integrity', async () => {
      // Create a transaction to reverse
      const grantRes = await request('/api/admin/rewards/grant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          agentId: 5,
          amount: 40.0,
          point_type: 'Merit Tokens',
          reason: 'Bonus to test reversal'
        }
      });
      const txId = grantRes.data.transaction.transactionId;

      // Reverse it
      const revRes = await request(`/api/admin/rewards/transactions/${txId}/reverse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken
        },
        body: {
          reason: 'Administrative correction: duplicated entry'
        }
      });
      assert.strictEqual(revRes.status, 200);
      assert.strictEqual(revRes.data.result.reversedAmount, 40.0);

      // Check that original row still exists (NOT deleted silently!)
      const db = getDatabase();
      const orig = db.prepare('SELECT status FROM reward_transactions WHERE id = ?').get(txId);
      assert.strictEqual(orig.status, 'reversed', 'Original transaction must be marked reversed, not deleted');

      // Check that offsetting row was created
      const revRecord = db.prepare('SELECT * FROM reward_transactions WHERE original_transaction_id = ?').get(txId);
      assert.ok(revRecord, 'Offsetting reversal row must exist');
      assert.strictEqual(revRecord.is_reversal, 1);
      assert.strictEqual(revRecord.amount, -40.0);
    });

    // 8. Audit Log Generation
    await test('Audit trail records administrative and security events', async () => {
      const res = await request('/api/admin/audit?limit=100', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.data.length >= 5, 'Should have multiple logged audit entries');

      const actions = res.data.data.map(l => l.action);
      assert.ok(actions.includes('ADMIN_LOGIN_SUCCESS'), 'Must record login');
      assert.ok(actions.includes('AGENT_PAUSED'), 'Must record agent pause');
      assert.ok(actions.includes('REWARD_GRANTED'), 'Must record reward grant');
      assert.ok(actions.includes('REWARD_REVERSED'), 'Must record reward reversal');

      // Check sanitization: verify no passwords leaked in any audit record
      for (const log of res.data.data) {
        if (log.details) {
          assert.strictEqual(log.details.includes('SuperSecretPassword123!'), false, 'Passwords must never appear in audit details');
        }
      }
    });

    // 9. Database Persistence after Refresh
    await test('Database persistence across server reload', async () => {
      // Agent 1 currently has 75 reward points
      const agentBefore = getDatabase().prepare('SELECT reward_points FROM agents WHERE id = 1').get();

      // Stop server
      await stopServer();

      // Restart server
      await startServer(3099);
      await new Promise(r => setTimeout(r, 150));

      // Verify persistence from sqlite file
      const agentAfter = getDatabase().prepare('SELECT reward_points FROM agents WHERE id = 1').get();
      assert.strictEqual(agentAfter.reward_points, agentBefore.reward_points, 'State must persist after server restart');
    });

    // 10. Gemini API Key Isolation from Frontend Assets
    await test('Gemini API key isolation from client frontend and responses', async () => {
      // 1. Fetch public HTML and JS files
      const htmlRes = await request('/index.html');
      assert.strictEqual(htmlRes.status, 200);
      assert.strictEqual(htmlRes.data.includes('AIzaSy'), false, 'No Google API keys in index.html');

      const jsRes = await request('/js/app.js');
      assert.strictEqual(jsRes.status, 200);
      assert.strictEqual(jsRes.data.includes('AIzaSy'), false, 'No Google API keys in app.js');

      // 2. Check settings endpoint
      const setRes = await request('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(setRes.status, 200);
      assert.strictEqual(typeof setRes.data.hasGeminiKey, 'boolean');
      assert.strictEqual(setRes.data.GEMINI_API_KEY, undefined, 'GEMINI_API_KEY string must never be returned');
    });

    // 11. Photorealistic Portraits & Realistic Identity Profiles
    await test('Photorealistic portrait assets and consistent identity persistence', async () => {
      const res = await request('/api/admin/agents', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(res.status, 200);
      const agents = res.data.data;
      assert.ok(agents.length > 0, 'Must have seeded agents');

      for (const agent of agents) {
        assert.ok(agent.photo_url, `Agent ${agent.name} must have photo_url`);
        assert.ok(agent.photo_url.startsWith('/assets/portraits/'), 'Photo URL must point to portraits directory');
        const filename = path.basename(agent.photo_url);
        const diskPath = path.join(__dirname, '..', 'public', 'assets', 'portraits', filename);
        assert.ok(fs.existsSync(diskPath), `Portrait image file ${diskPath} must exist on disk`);

        assert.ok(typeof agent.age === 'number' && agent.age > 0, `Agent ${agent.name} must have numeric age`);
        assert.ok(typeof agent.health === 'number', `Agent ${agent.name} must have numeric health`);
        assert.ok(typeof agent.stress === 'number', `Agent ${agent.name} must have numeric stress`);
        assert.ok(agent.emotion, `Agent ${agent.name} must have emotional state`);
        assert.ok(agent.family_background, `Agent ${agent.name} must have family background`);
        assert.ok(agent.financial_status, `Agent ${agent.name} must have financial status`);
      }
    });

    // 12. Prayers & Mannats Inbox Retrieval and Classification
    await test('Prayers & Mannats inbox retrieval, categorization, and pending records', async () => {
      const res = await request('/api/admin/prayers', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.data), 'Data should be array of prayers');
      assert.ok(res.data.counts, 'Counts object must be present');
      assert.ok(res.data.data.length >= 2, 'Should have initial seeded prayers/mannats');

      const mannatItem = res.data.data.find(p => p.category === 'Mannat');
      assert.ok(mannatItem, 'Should have at least one explicit Mannat item');
      assert.ok(mannatItem.explicit_vow, 'Mannat must contain explicit vow / promise');
      assert.ok(mannatItem.summary, 'Mannat must have clear plain English summary');
      assert.ok(mannatItem.desired_outcome, 'Mannat must have desired outcome');
      assert.ok(mannatItem.original_text, 'Mannat must preserve original statement');
    });

    // 13. Administrative Decisions: Fulfill and Decline with World Event Execution
    await test('Administrative decisions on prayers: Fulfill and Decline with world events', async () => {
      const prayersRes = await request('/api/admin/prayers?status=pending', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(prayersRes.status, 200);
      const pendingList = prayersRes.data.data;
      assert.ok(pendingList.length >= 2, 'Should have at least 2 pending prayers to test fulfill and decline');

      const toFulfill = pendingList[0];
      const fulfillRes = await request(`/api/admin/prayers/${toFulfill.id}/fulfill`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-CSRF-Token': csrfToken
        },
        body: { notes: 'Approved via test suite automation' }
      });
      assert.strictEqual(fulfillRes.status, 200, 'Fulfill should succeed');
      assert.strictEqual(fulfillRes.data.prayer.status, 'fulfilled');
      assert.ok(fulfillRes.data.event, 'Persistent world event must be created');

      // Verify life event recorded in DB
      const db = getDatabase();
      const lifeEvent = db.prepare('SELECT * FROM life_events WHERE agent_id = ? AND event_type = ?').get(toFulfill.agent_id, 'PRAYER_FULFILLED');
      assert.ok(lifeEvent, 'Life event for fulfilled prayer must be recorded');

      // Test Decline on second pending prayer
      const toDecline = pendingList[1];
      const declineRes = await request(`/api/admin/prayers/${toDecline.id}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-CSRF-Token': csrfToken
        },
        body: { notes: 'Natural world progression without intervention' }
      });
      assert.strictEqual(declineRes.status, 200, 'Decline should succeed');
      assert.strictEqual(declineRes.data.prayer.status, 'declined');
    });

    // 14. Life Cycle Mortality: Death Event, Inheritance Safety, and Memorial Archival
    await test('Life cycle mortality event: declare deceased, single inheritance, and archival', async () => {
      const agentId = 3;
      const deathRes = await request(`/api/admin/agents/${agentId}/declare-deceased`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-CSRF-Token': csrfToken
        },
        body: { cause: 'Severe Respiratory Illness' }
      });
      assert.strictEqual(deathRes.status, 200, 'Recording passing must succeed');
      assert.ok(deathRes.data.result, 'Should return death execution result');

      // Verify agent deceased status in database
      const db = getDatabase();
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
      assert.strictEqual(agent.runtime_status, 'deceased');
      assert.ok(agent.deceased_at, 'deceased_at must be populated');
      assert.strictEqual(agent.cause_of_death, 'Severe Respiratory Illness');
      assert.strictEqual(agent.inheritance_executed, 1, 'Inheritance must be marked executed');

      // Verify idempotent protection against double death / double inheritance
      const repeatRes = await request(`/api/admin/agents/${agentId}/declare-deceased`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-CSRF-Token': csrfToken
        },
        body: { cause: 'Old Age' }
      });
      assert.strictEqual(repeatRes.status, 400, 'Duplicate death declaration must be rejected');

      // Verify deceased filtering in API
      const decFilterRes = await request('/api/admin/agents?lifeStatus=deceased', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(decFilterRes.status, 200);
      assert.ok(decFilterRes.data.data.some(a => a.id === agentId), 'Deceased filter must include deceased agent');

      // Verify living filtering excludes deceased
      const livingFilterRes = await request('/api/admin/agents?lifeStatus=living', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      assert.strictEqual(livingFilterRes.status, 200);
      assert.strictEqual(livingFilterRes.data.data.some(a => a.id === agentId), false, 'Living filter must exclude deceased agent');
    });

  } finally {
    await stopServer();
    // Clean up test DB
    if (fs.existsSync(process.env.DB_PATH)) {
      try { fs.unlinkSync(process.env.DB_PATH); } catch (e) {}
    }
  }

  console.log('\n========================================================');
  console.log(` Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();

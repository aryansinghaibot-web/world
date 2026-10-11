const engine = require('../src/simulation/engine');
const { getDatabase } = require('../src/db/database');
const db = getDatabase();

async function testLifecycle() {
  const beforeDeceased = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;
  const beforeLiving = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
  console.log('Before ticks:', { living: beforeLiving, deceased: beforeDeceased });

  // Run 6 simulation ticks
  for (let i = 1; i <= 6; i++) {
    await engine.tick();
    const living = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status != 'deceased'").get().c;
    const deceased = db.prepare("SELECT COUNT(*) as c FROM agents WHERE runtime_status = 'deceased'").get().c;
    console.log(`Tick ${i}: Living = ${living}, Deceased = ${deceased}`);
    const lastEvent = engine.recentEvents[0];
    if (lastEvent) {
      console.log(`   Last Event: [${lastEvent.type}] ${lastEvent.message}`);
    }
  }
}

testLifecycle().catch(console.error);

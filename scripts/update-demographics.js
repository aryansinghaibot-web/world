const { getDatabase } = require('../src/db/database');
const db = getDatabase();

// 1. Update simulation_settings
db.prepare(`
  UPDATE simulation_settings
  SET max_population = 2500, max_natural_age = 72, enable_natural_death = 1, enable_illness_death = 1, reproduction_enabled = 1, mortality_rate = 1.0
  WHERE id = 1
`).run();

// 2. Diversify ages among existing agents so we have a realistic living human demographic
const agents = db.prepare("SELECT id, occupation, age FROM agents WHERE runtime_status != 'deceased'").all();
console.log('Total living agents:', agents.length);

const updateAgeStmt = db.prepare('UPDATE agents SET age = ? WHERE id = ?');
let updatedCount = 0;

for (let i = 0; i < agents.length; i++) {
  const a = agents[i];
  if (a.occupation && !a.occupation.includes('Infant') && !a.occupation.includes('Child')) {
    // Professional adults: distribute between 24 and 82
    const targetAge = 25 + (i % 58); // 25 to 82
    updateAgeStmt.run(targetAge, a.id);
    updatedCount++;
  } else {
    // Distribute previous cohorts: age 1 to 74
    const targetAge = 1 + (i % 74);
    updateAgeStmt.run(targetAge, a.id);
    updatedCount++;
  }
}

console.log('Successfully diversified ages for', updatedCount, 'agents');

const ageStats = db.prepare("SELECT MIN(age) as minAge, MAX(age) as maxAge, AVG(age) as avgAge FROM agents WHERE runtime_status != 'deceased'").get();
console.log('New age stats:', ageStats);
const elders = db.prepare("SELECT COUNT(*) as c FROM agents WHERE age >= 70 AND runtime_status != 'deceased'").get().c;
console.log('Elders (>= 70):', elders);

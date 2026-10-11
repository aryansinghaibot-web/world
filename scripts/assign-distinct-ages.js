const { getDatabase } = require('../src/db/database');
const db = getDatabase();

const adultOccupations = [
  'Quantum Physicist', 'Community Architect', 'Digital Sculptor', 'Master Barista & Historian',
  'Systems Engineer', 'Urban Ecologist', 'Biomedical Researcher', 'Ethics Professor', 'Robotics Technician',
  'Renewable Energy Specialist', 'Architectural Designer', 'Greenhouse Agronomist', 'Data Ethicist',
  'Town Pharmacist', 'Civic Historian', 'Classical Musician', 'Mechanical Engineer', 'Hydroponic Specialist',
  'Primary Educator', 'Solar Grid Manager', 'Bakery Artisan', 'Healthcare Assistant', 'Public Affairs Officer',
  'Ecosystem Ranger', 'Astrophysics Lecturer', 'Botanical Conservator', 'Cybersecurity Analyst',
  'Civil Infrastructure Engineer', 'Biotech Geneticist', 'Town Journalist', 'Culinary Chef',
  'Senior Town Elder & Advisor', 'Cultural Archivist', 'Environmental Geologist', 'Community Counselor',
  'Meteorological Forecaster', 'Library Curator', 'Aerospace Modeler', 'Artisan Woodworker',
  'Philosophy Instructor', 'Sustainable Materials Chemist', 'Marine Biologist', 'Solar Grid Electrician',
  'Public Health Coordinator', 'Acoustic Engineer', 'Urban Landscape Architect', 'Hydrology Scientist',
  'Museum Curator', 'Senior Civic Magistrate', 'Community Wellness Director'
];

const portraits = [
  '/assets/portraits/evelyn.jpg',
  '/assets/portraits/marcus.jpg',
  '/assets/portraits/aria.jpg',
  '/assets/portraits/kaito.jpg',
  '/assets/portraits/elena.jpg',
  '/assets/portraits/julian.jpg',
  '/assets/portraits/sora.jpg',
  '/assets/portraits/tariq.jpg',
  '/assets/portraits/nadia.jpg'
];

const agents = db.prepare('SELECT id, name, occupation, generation FROM agents ORDER BY id ASC').all();
console.log('Total agents to assign distinct ages to:', agents.length);

// Founders get distinct established adult ages
const founderAges = {
  1: 42, // Dr. Evelyn Reed
  2: 47, // Marcus Vance
  3: 29, // Aria Thorne
  4: 38, // Kaito Tanaka
  5: 35, // Elena Rostova
  6: 44, // Julian Hayes
  7: 33, // Sora Williams
  8: 65, // Tariq Al-Mansoor
  9: 26  // Nadia Chen
};

// Available unique ages pool for the remaining agents
const usedAges = new Set(Object.values(founderAges));
const pool = [];
for (let age = 3; age <= 120; age++) {
  if (!usedAges.has(age)) {
    pool.push(age);
  }
}

// Assign unique ages to all agents
db.exec('BEGIN TRANSACTION');
try {
  let poolIdx = 0;
  for (const a of agents) {
    let assignedAge;
    if (founderAges[a.id]) {
      assignedAge = founderAges[a.id];
    } else {
      assignedAge = pool[poolIdx++];
      usedAges.add(assignedAge);
    }

    let occupation = a.occupation;
    let photoUrl = a.photo_url;

    if (assignedAge < 18) {
      occupation = assignedAge < 6 ? 'Toddler / Kindergarten' : (assignedAge < 13 ? 'Elementary Student' : 'High School Student');
      photoUrl = '/assets/portraits/child.jpg';
    } else if (a.occupation.includes('Child') || a.occupation.includes('Student')) {
      occupation = adultOccupations[(a.id) % adultOccupations.length];
      photoUrl = portraits[(a.id) % portraits.length];
    }

    db.prepare('UPDATE agents SET age = ?, occupation = ?, photo_url = ? WHERE id = ?')
      .run(assignedAge, occupation, photoUrl, a.id);
  }

  // Update simulation settings to allow population growth
  db.prepare(`
    UPDATE simulation_settings
    SET max_population = 500,
        max_natural_age = 84,
        enable_natural_death = 1,
        reproduction_enabled = 1,
        mortality_rate = 1.0,
        aging_speed = 1.0
    WHERE id = 1
  `).run();

  db.exec('COMMIT');
  console.log('Successfully updated all 100 agents with unique, distinct ages!');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Error updating agents:', err);
}

// Verify no duplicate ages
const updated = db.prepare('SELECT id, name, age, occupation FROM agents ORDER BY age ASC').all();
const ageCount = {};
let dupes = 0;
updated.forEach(a => {
  ageCount[a.age] = (ageCount[a.age] || 0) + 1;
  if (ageCount[a.age] > 1) dupes++;
});
console.log('Duplicate ages count:', dupes);
console.log('Min age:', Math.min(...updated.map(a => a.age)), 'Max age:', Math.max(...updated.map(a => a.age)));
console.log('First 10 youngest:', updated.slice(0, 10).map(a => `${a.name} (${a.age}y - ${a.occupation})`));
console.log('Last 10 oldest:', updated.slice(-10).map(a => `${a.name} (${a.age}y - ${a.occupation})`));

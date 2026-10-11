const { app } = require('../src/server');
const { getDatabase } = require('../src/db/database');
const engine = require('../src/simulation/engine');

// Initialize database & engine for serverless invocation
try {
  getDatabase();
  engine.init();
} catch (err) {
  console.error('Serverless init error:', err);
}

module.exports = app;

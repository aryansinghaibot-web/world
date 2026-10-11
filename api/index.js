const { app } = require('../src/server');
const { getDatabase } = require('../src/db/database');
const engine = require('../src/simulation/engine');

let isInitialized = false;

function ensureInitialized() {
  if (isInitialized) return;
  try {
    getDatabase();
    engine.init();
    isInitialized = true;
  } catch (err) {
    console.error('Serverless initialization error:', err);
  }
}

// Ensure lazy initialization on serverless invocations
app.use((req, res, next) => {
  ensureInitialized();
  next();
});

ensureInitialized();

module.exports = app;

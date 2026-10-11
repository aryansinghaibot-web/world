const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { getDatabase } = require('./db/database');
const engine = require('./simulation/engine');

// Route controllers
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const beliefRoutes = require('./routes/beliefs');
const rewardRoutes = require('./routes/rewards');
const settingsRoutes = require('./routes/settings');
const auditRoutes = require('./routes/audit');
const prayersRoutes = require('./routes/prayers');
const worldRoutes = require('./routes/world');

const app = express();

// Security and body parsers
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Mount API routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/agents', agentRoutes);
app.use('/api/admin/beliefs', beliefRoutes);
app.use('/api/admin/rewards', rewardRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/audit', auditRoutes);
app.use('/api/admin/prayers', prayersRoutes);
app.use('/api/world', worldRoutes);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to index.html for SPA client-side routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.IS_PRODUCTION ? 'An unexpected error occurred.' : err.message
  });
});

let server = null;

function startServer(port = config.PORT) {
  // Ensure database initialized
  getDatabase();

  // Start simulation loop
  engine.init();

  return new Promise((resolve) => {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(` Autonomous AI Simulation & Admin Control Panel`);
      console.log(` Running on: http://localhost:${port}`);
      console.log(` Local IPv4: http://127.0.0.1:${port}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
      resolve(server);
    });
  });
}

function stopServer() {
  if (engine) engine.stop();
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    return new Promise((resolve) => {
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }
  return Promise.resolve();
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, stopServer };

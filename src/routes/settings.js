const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin, csrfProtection } = require('../security/middleware');
const engine = require('../simulation/engine');

router.use(requireAdmin);

// Get current simulation settings
router.get('/', (req, res) => {
  const db = getDatabase();
  const settings = db.prepare('SELECT * FROM simulation_settings WHERE id = 1').get();
  res.json({
    settings,
    engineRunning: engine.isRunning,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) // boolean only - never expose the key itself!
  });
});

// Update settings
router.post('/', csrfProtection, (req, res) => {
  try {
    const updated = engine.updateSettings(req.body, `Admin (${req.admin.username})`);
    res.json({
      message: 'Simulation settings updated successfully.',
      settings: updated,
      engineRunning: engine.isRunning
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start or stop simulation engine
router.post('/toggle-engine', csrfProtection, (req, res) => {
  const { running } = req.body;
  if (running) {
    const db = getDatabase();
    const settings = db.prepare('SELECT tick_rate_ms FROM simulation_settings WHERE id = 1').get();
    engine.start(settings ? settings.tick_rate_ms : 3000);
  } else {
    engine.stop();
  }

  res.json({
    message: `Engine ${engine.isRunning ? 'started' : 'stopped'} successfully.`,
    engineRunning: engine.isRunning
  });
});

// Trigger single manual simulation tick
router.post('/manual-tick', csrfProtection, async (req, res) => {
  try {
    await engine.tick();
    res.json({ message: 'Manual simulation tick executed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update temporal speed multiplier directly
router.post('/time-speed', csrfProtection, (req, res) => {
  const { multiplier } = (req.body && typeof req.body === 'object') ? req.body : {};
  const mul = parseFloat(multiplier);
  if (isNaN(mul) || mul < 0.1 || mul > 10.0) {
    return res.status(400).json({ error: 'Multiplier must be between 0.1x and 10.0x' });
  }

  const updated = engine.updateSettings({ time_speed_multiplier: mul }, `Admin (${req.admin.username})`);
  res.json({
    message: `Simulation temporal speed set to ${mul}x.`,
    settings: updated,
    timeSpeedMultiplier: mul
  });
});

// Set Time of Day (Morning / Night / Dawn / Afternoon / Evening / Custom Hour)
router.post('/time-of-day', csrfProtection, (req, res) => {
  const { timeOfDay, hour } = (req.body && typeof req.body === 'object') ? req.body : {};
  if (!timeOfDay && hour === undefined) {
    return res.status(400).json({ error: 'Please provide timeOfDay (morning, night, dawn, afternoon, evening) or hour.' });
  }

  try {
    const result = engine.setTimeOfDay(timeOfDay, hour, req.admin ? req.admin.username : 'Administrator');
    res.json({
      message: `Time of day updated to ${result.timeOfDay}.`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger an immediate mortality event from the Death System button
router.post('/trigger-mortality', csrfProtection, (req, res) => {
  try {
    const { cause } = req.body || {};
    const result = engine.triggerInstantMortality(cause, req.admin ? `Admin (${req.admin.username})` : 'Administrator');
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      message: 'त्वरित मृत्यु घटना सफलतापूर्वक दर्ज की गई (Mortality event executed).',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle continuous mortality system
router.post('/toggle-mortality', csrfProtection, (req, res) => {
  try {
    const db = getDatabase();
    const current = db.prepare('SELECT enable_natural_death FROM simulation_settings WHERE id = 1').get();
    const newStatus = (req.body && req.body.enabled !== undefined)
      ? (req.body.enabled ? 1 : 0)
      : (current && current.enable_natural_death ? 0 : 1);

    const updated = engine.updateSettings({ enable_natural_death: newStatus }, `Admin (${req.admin.username})`);
    res.json({
      message: `Mortality system ${newStatus ? 'activated (सक्रिय)' : 'deactivated (निष्क्रिय)'}.`,
      enableNaturalDeath: Boolean(newStatus),
      settings: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

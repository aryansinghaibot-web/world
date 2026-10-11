const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { createAdminUser, authenticateAdmin, destroySession } = require('../security/auth');
const { requireAdmin, logAuditEvent } = require('../security/middleware');
const config = require('../config');

// Check if any admin exists (for first-time initial setup wizard)
router.get('/setup-status', (req, res) => {
  const db = getDatabase();
  const countObj = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  res.json({ hasAdmin: countObj.count > 0 });
});

// Initial administrator setup (only permitted when no admin accounts exist)
router.post('/initial-setup', (req, res) => {
  const db = getDatabase();
  const countObj = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (countObj.count > 0) {
    return res.status(403).json({
      error: 'Setup Locked',
      message: 'Administrator account already exists. Use CLI or existing admin account.'
    });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const admin = createAdminUser(username, password, 'superadmin');
    
    // Automatically authenticate the newly created admin
    const authResult = authenticateAdmin(username, password, req.headers['user-agent'], req.ip);

    // Set secure cookie
    res.cookie(config.COOKIE_NAME, authResult.token, {
      httpOnly: true,
      secure: config.IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: config.SESSION_MAX_AGE_MS
    });

    logAuditEvent({
      actor: `Admin (${admin.username})`,
      action: 'ADMIN_INITIAL_SETUP',
      targetType: 'AdminAuth',
      targetId: admin.id,
      targetName: admin.username,
      details: { role: admin.role, method: 'web-setup' },
      ip: req.ip
    });

    res.status(201).json({
      message: 'Initial administrator account created successfully.',
      admin: authResult.admin,
      csrfToken: authResult.csrfToken
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const authResult = authenticateAdmin(username, password, req.headers['user-agent'], req.ip);
  if (!authResult) {
    logAuditEvent({
      actor: username || 'Unknown',
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'AdminAuth',
      details: { attemptedUsername: username, reason: 'Invalid credentials' },
      ip: req.ip
    });

    return res.status(401).json({
      error: 'Invalid Credentials',
      message: 'The username or password provided is incorrect.'
    });
  }

  // Set secure HTTP-only cookie
  res.cookie(config.COOKIE_NAME, authResult.token, {
    httpOnly: true,
    secure: config.IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: config.SESSION_MAX_AGE_MS
  });

  logAuditEvent({
    actor: `Admin (${authResult.admin.username})`,
    action: 'ADMIN_LOGIN_SUCCESS',
    targetType: 'AdminAuth',
    targetId: authResult.admin.id,
    targetName: authResult.admin.username,
    details: { loginTime: authResult.admin.lastLogin },
    ip: req.ip
  });

  res.json({
    message: 'Authentication successful.',
    admin: authResult.admin,
    csrfToken: authResult.csrfToken,
    token: authResult.token // also provided for clients using Authorization header
  });
});

// Admin logout
router.post('/logout', requireAdmin, (req, res) => {
  const token = req.cookies[config.COOKIE_NAME] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (token) {
    destroySession(token);
  }

  res.clearCookie(config.COOKIE_NAME);

  logAuditEvent({
    actor: `Admin (${req.admin.username})`,
    action: 'ADMIN_LOGOUT',
    targetType: 'AdminAuth',
    targetId: req.admin.id,
    targetName: req.admin.username,
    ip: req.ip
  });

  res.json({ message: 'Logged out successfully.' });
});

// Verify current session & return admin info + fresh CSRF token
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    admin: req.admin,
    csrfToken: req.session.csrfToken
  });
});

module.exports = router;

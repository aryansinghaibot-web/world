const { validateSession } = require('./auth');
const { getDatabase } = require('../db/database');
const config = require('../config');

/**
 * Authentication middleware enforcing server-side session authorization.
 */
function requireAdmin(req, res, next) {
  let token = null;

  // 1. Try cookie
  if (req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  // 2. Try Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in as an administrator.'
    });
  }

  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'Session Expired or Invalid',
      message: 'Your administrator session is invalid or has expired. Please log in again.'
    });
  }

  req.admin = session.admin;
  req.session = session;
  next();
}

/**
 * CSRF Protection for state-changing methods.
 */
function csrfProtection(req, res, next) {
  // Only check state-changing methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  // Skip CSRF check if the endpoint is login or initial setup (since session doesn't exist yet)
  if (req.path === '/api/admin/login' || req.path === '/api/admin/initial-setup') {
    return next();
  }

  const headerCsrf = req.headers[config.CSRF_HEADER] || req.headers['x-csrf-token'];
  if (!req.session || !headerCsrf || headerCsrf !== req.session.csrfToken) {
    return res.status(403).json({
      error: 'CSRF Validation Failed',
      message: 'Invalid or missing CSRF token in state-changing request.'
    });
  }

  next();
}

/**
 * Record an administrative or system event in the audit trail.
 * Sanitizes input to ensure passwords, keys, or raw tokens are NEVER written.
 */
function logAuditEvent({
  actor,
  action,
  targetType,
  targetId = null,
  targetName = null,
  details = null,
  ip = null
}) {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();

    let safeDetails = details;
    if (typeof details === 'object' && details !== null) {
      // Clone and sanitize sensitive fields
      const sanitized = { ...details };
      const sensitiveKeys = ['password', 'password_hash', 'salt', 'token', 'apiKey', 'gemini_key', 'secret'];
      for (const k of sensitiveKeys) {
        if (sanitized[k]) sanitized[k] = '[REDACTED]';
      }
      safeDetails = JSON.stringify(sanitized);
    } else if (typeof details === 'string') {
      // Basic redaction
      safeDetails = details.replace(/("password":\s*")[^"]+(")/gi, '$1[REDACTED]$2');
    }

    db.prepare(`
      INSERT INTO audit_logs (timestamp, actor, action, target_type, target_id, target_name, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      now,
      actor || 'System',
      action,
      targetType,
      targetId ? String(targetId) : null,
      targetName ? String(targetName) : null,
      safeDetails ? String(safeDetails) : null,
      ip || null
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

module.exports = {
  requireAdmin,
  csrfProtection,
  logAuditEvent
};

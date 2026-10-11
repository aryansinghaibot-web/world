const crypto = require('crypto');
const { getDatabase } = require('../db/database');
const config = require('../config');

/**
 * Hash password with PBKDF2 using cryptographically strong random salt.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password against stored hash and salt using constant-time comparison.
 */
function verifyPassword(password, storedHash, salt) {
  try {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const bufA = Buffer.from(hash, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    return false;
  }
}

/**
 * Create a new admin user safely.
 */
function createAdminUser(username, password, role = 'superadmin') {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username.trim().toLowerCase());
  if (existing) {
    throw new Error(`Administrator with username "${username}" already exists.`);
  }

  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO admins (username, password_hash, salt, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(username.trim().toLowerCase(), hash, salt, role, now);

  return { id: result.lastInsertRowid, username: username.trim().toLowerCase(), role };
}

/**
 * Authenticate credentials and generate session token and CSRF token.
 */
function authenticateAdmin(username, password, userAgent = '', ipAddress = '') {
  if (!username || !password) {
    throw new Error('Username and password are required.');
  }

  const db = getDatabase();
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim().toLowerCase());
  if (!admin) {
    return null; // Not found
  }

  const isValid = verifyPassword(password, admin.password_hash, admin.salt);
  if (!isValid) {
    return null; // Invalid credentials
  }

  // Update last login
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE admins SET last_login = ? WHERE id = ?').run(nowIso, admin.id);

  // Generate cryptographically secure tokens
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + config.SESSION_MAX_AGE_MS;

  db.prepare(`
    INSERT INTO sessions (token, admin_id, csrf_token, expires_at, created_at, user_agent, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sessionToken, admin.id, csrfToken, expiresAt, nowIso, userAgent, ipAddress);

  return {
    token: sessionToken,
    csrfToken,
    expiresAt,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      lastLogin: nowIso
    }
  };
}

/**
 * Validate active session.
 */
function validateSession(token) {
  if (!token) return null;

  const db = getDatabase();
  const session = db.prepare(`
    SELECT s.token, s.csrf_token, s.expires_at, a.id as admin_id, a.username, a.role
    FROM sessions s
    JOIN admins a ON s.admin_id = a.id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;

  if (Date.now() > session.expires_at) {
    // Expired - clean up
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    token: session.token,
    csrfToken: session.csrf_token,
    admin: {
      id: session.admin_id,
      username: session.username,
      role: session.role
    }
  };
}

/**
 * Invalidate session on logout.
 */
function destroySession(token) {
  if (!token) return;
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/**
 * Update an existing admin's password and invalidate their active sessions.
 */
function updateAdminPassword(username, newPassword) {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required.');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const db = getDatabase();
  const admin = db.prepare('SELECT id, username, role FROM admins WHERE username = ?').get(username.trim().toLowerCase());
  if (!admin) {
    throw new Error(`Administrator with username "${username}" not found.`);
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, admin.id);
  db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(admin.id);

  return { id: admin.id, username: admin.username, role: admin.role };
}

/**
 * Clean up all expired sessions.
 */
function cleanExpiredSessions() {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAdminUser,
  updateAdminPassword,
  authenticateAdmin,
  validateSession,
  destroySession,
  cleanExpiredSessions
};

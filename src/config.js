const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'simulation.db'),
  SESSION_SECRET: process.env.SESSION_SECRET || 'autonomous-sim-session-secret-change-in-prod-2026',
  SESSION_MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  COOKIE_NAME: 'sim_admin_token',
  CSRF_HEADER: 'x-csrf-token',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || '',
  SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL || '',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  TICK_INTERVAL_DEFAULT_MS: 3000,
};

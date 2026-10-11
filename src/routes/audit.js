const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/database');
const { requireAdmin } = require('../security/middleware');

router.use(requireAdmin);

// Fetch paginated audit log entries with search & filters
router.get('/', (req, res) => {
  const db = getDatabase();
  const {
    targetType = '',
    action = '',
    search = '',
    page = 1,
    limit = 25
  } = req.query;

  const conditions = [];
  const params = [];

  if (targetType) {
    conditions.push('target_type = ?');
    params.push(targetType);
  }

  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }

  if (search.trim()) {
    conditions.push('(actor LIKE ? OR target_name LIKE ? OR details LIKE ? OR action LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
  const total = db.prepare(countSql).get(...params).total;

  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const querySql = `
    SELECT * FROM audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;

  const logs = db.prepare(querySql).all(...params, parsedLimit, offset);

  // Available actions and target types for filter dropdowns
  const availableTypes = db.prepare('SELECT DISTINCT target_type FROM audit_logs').all().map(r => r.target_type);
  const availableActions = db.prepare('SELECT DISTINCT action FROM audit_logs').all().map(r => r.action);

  res.json({
    data: logs,
    availableTypes,
    availableActions,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit)
    }
  });
});

module.exports = router;

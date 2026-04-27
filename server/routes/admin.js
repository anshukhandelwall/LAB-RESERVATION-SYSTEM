const { db } = require('../db');
const router = require('express').Router();

// All admin routes require admin role — enforced by middleware in server.js

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const totalEquipment   = db.prepare("SELECT COUNT(*) AS n FROM equipment WHERE status != 'retired'").get().n;
  const totalUsers       = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n;
  const totalReservations= db.prepare("SELECT COUNT(*) AS n FROM reservations").get().n;
  const activeToday      = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE date = date('now','localtime') AND status = 'confirmed'").get().n;
  const cancelledCount   = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'cancelled'").get().n;
  const confirmedCount   = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'confirmed'").get().n;

  res.json({
    total_equipment: totalEquipment,
    total_students: totalUsers,
    total_reservations: totalReservations,
    active_today: activeToday,
    confirmed_count: confirmedCount,
    cancelled_count: cancelledCount
  });
});

// ─── GET /api/admin/equipment-utilization ─────────────────────────────────────
router.get('/equipment-utilization', (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.name, e.lab, e.category, e.total_slots, e.status,
      COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) AS confirmed_count,
      COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) AS cancelled_count,
      COUNT(r.id) AS total_count,
      ROUND(
        COUNT(CASE WHEN r.status = 'confirmed' THEN 1 END) * 100.0
        / MAX(1, (SELECT COUNT(DISTINCT date) FROM reservations WHERE equipment_id = e.id)),
        1
      ) AS daily_avg_bookings
    FROM equipment e
    LEFT JOIN reservations r ON r.equipment_id = e.id
    GROUP BY e.id
    ORDER BY confirmed_count DESC
  `).all();

  // Tag each as heavily_used, moderate, or underutilized
  const max = rows.reduce((m, r) => Math.max(m, r.confirmed_count), 0) || 1;
  const tagged = rows.map(r => ({
    ...r,
    utilization_pct: Math.round((r.confirmed_count / max) * 100),
    usage_level: r.confirmed_count / max >= 0.6 ? 'heavily_used'
               : r.confirmed_count / max >= 0.2 ? 'moderate'
               : 'underutilized'
  }));

  res.json(tagged);
});

// ─── GET /api/admin/daily-bookings ────────────────────────────────────────────
router.get('/daily-bookings', (req, res) => {
  const { days = 30 } = req.query;
  const rows = db.prepare(`
    SELECT date, COUNT(*) AS count
    FROM reservations
    WHERE date >= date('now', '-' || ? || ' days', 'localtime')
      AND status = 'confirmed'
    GROUP BY date
    ORDER BY date
  `).all(String(days));
  res.json(rows);
});

// ─── GET /api/admin/peak-hours ────────────────────────────────────────────────
router.get('/peak-hours', (req, res) => {
  const rows = db.prepare(`
    SELECT SUBSTR(start_time, 1, 2) AS hour, COUNT(*) AS count
    FROM reservations
    WHERE status = 'confirmed'
    GROUP BY hour
    ORDER BY hour
  `).all();
  res.json(rows);
});

// ─── GET /api/admin/recent-activity ──────────────────────────────────────────
router.get('/recent-activity', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.name AS user_name, u.role AS user_role,
           e.name AS equipment_name
    FROM usage_logs l
    LEFT JOIN users     u ON l.user_id      = u.id
    LEFT JOIN equipment e ON l.equipment_id = e.id
    ORDER BY l.timestamp DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const { action, user_id, equipment_id, from, to, limit = 200 } = req.query;
  let sql = `
    SELECT l.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
           e.name AS equipment_name, e.lab
    FROM usage_logs l
    LEFT JOIN users     u ON l.user_id      = u.id
    LEFT JOIN equipment e ON l.equipment_id = e.id
    WHERE 1=1
  `;
  const params = [];
  if (action)       { sql += ' AND l.action = ?';       params.push(action); }
  if (user_id)      { sql += ' AND l.user_id = ?';      params.push(user_id); }
  if (equipment_id) { sql += ' AND l.equipment_id = ?'; params.push(equipment_id); }
  if (from)         { sql += ' AND l.timestamp >= ?';   params.push(from); }
  if (to)           { sql += ' AND l.timestamp <= ?';   params.push(to + ' 23:59:59'); }
  sql += ` ORDER BY l.timestamp DESC LIMIT ${parseInt(limit)}`;
  res.json(db.prepare(sql).all(...params));
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.student_id, u.department, u.created_at,
      COUNT(r.id) AS total_reservations
    FROM users u
    LEFT JOIN reservations r ON r.user_id = u.id AND r.status = 'confirmed'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(rows);
});

module.exports = router;

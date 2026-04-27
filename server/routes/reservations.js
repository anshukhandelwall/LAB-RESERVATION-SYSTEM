const { db, isSlotAvailable, log } = require('../db');
const router = require('express').Router();

// ─── GET /api/reservations  (mine or all for admin) ──────────────────────────
router.get('/', (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const { status, date, equipment_id, user_id } = req.query;

  let sql = `
    SELECT r.*, u.name AS student_name, u.email AS student_email,
           e.name AS equipment_name, e.lab, e.category
    FROM reservations r
    JOIN users     u ON r.user_id      = u.id
    JOIN equipment e ON r.equipment_id = e.id
    WHERE 1=1
  `;
  const params = [];

  // Students can only see their own reservations
  if (!isAdmin) {
    sql += ' AND r.user_id = ?'; params.push(req.user.id);
  } else if (user_id) {
    sql += ' AND r.user_id = ?'; params.push(user_id);
  }

  if (status)       { sql += ' AND r.status = ?';       params.push(status); }
  if (date)         { sql += ' AND r.date = ?';          params.push(date); }
  if (equipment_id) { sql += ' AND r.equipment_id = ?'; params.push(equipment_id); }

  sql += ' ORDER BY r.date DESC, r.start_time DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

// ─── POST /api/reservations ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { equipment_id, date, start_time, end_time, notes } = req.body;

  if (!equipment_id || !date || !start_time || !end_time)
    return res.status(400).json({ error: 'equipment_id, date, start_time and end_time are required.' });

  // Validate times
  if (start_time >= end_time)
    return res.status(400).json({ error: 'start_time must be before end_time.' });

  // Cannot book in the past
  const now = new Date();
  const bookingDT = new Date(`${date}T${start_time}`);
  if (bookingDT < now)
    return res.status(400).json({ error: 'Cannot book a slot in the past.' });

  // Equipment must exist and be available
  const eq = db.prepare("SELECT * FROM equipment WHERE id = ? AND status = 'available'").get(equipment_id);
  if (!eq) return res.status(404).json({ error: 'Equipment not found or unavailable.' });

  // Conflict check (with row-level lock via SQLite serialisation)
  if (!isSlotAvailable(equipment_id, date, start_time, end_time))
    return res.status(409).json({ error: 'Time slot is fully booked. Please choose another time.' });

  const info = db.prepare(`
    INSERT INTO reservations (user_id, equipment_id, date, start_time, end_time, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, equipment_id, date, start_time, end_time, notes || null);

  log('RESERVATION_CREATED', {
    reservationId: info.lastInsertRowid,
    userId: req.user.id,
    equipmentId: equipment_id,
    details: `${eq.name} on ${date} ${start_time}-${end_time}`,
    ip: req.ip
  });

  res.status(201).json({
    id: info.lastInsertRowid,
    message: `Reservation confirmed for ${eq.name} on ${date} ${start_time}–${end_time}`
  });
});

// ─── GET /api/reservations/:id ────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const r = db.prepare(`
    SELECT r.*, u.name AS student_name, u.email AS student_email,
           e.name AS equipment_name, e.lab, e.category
    FROM reservations r
    JOIN users     u ON r.user_id      = u.id
    JOIN equipment e ON r.equipment_id = e.id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!r) return res.status(404).json({ error: 'Reservation not found.' });

  // Students can only view their own
  if (req.user.role !== 'admin' && r.user_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied.' });

  res.json(r);
});

// ─── PATCH /api/reservations/:id/cancel ──────────────────────────────────────
router.patch('/:id/cancel', (req, res) => {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Reservation not found.' });

  if (req.user.role !== 'admin' && r.user_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied.' });

  if (r.status !== 'confirmed')
    return res.status(400).json({ error: 'Only confirmed reservations can be cancelled.' });

  db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(r.id);

  log('RESERVATION_CANCELLED', {
    reservationId: r.id,
    userId: req.user.id,
    equipmentId: r.equipment_id,
    details: `Cancelled by ${req.user.role === 'admin' ? 'admin' : 'student'}`,
    ip: req.ip
  });

  res.json({ success: true, message: 'Reservation cancelled.' });
});

module.exports = router;

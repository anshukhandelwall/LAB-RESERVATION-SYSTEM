const { db, log } = require('../db');
const router = require('express').Router();

// ─── GET /api/equipment ───────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { category, lab, status, search } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM reservations r
       WHERE r.equipment_id = e.id AND r.status = 'confirmed'
         AND r.date = date('now', 'localtime')) AS today_bookings
    FROM equipment e WHERE 1=1
  `;
  const params = [];
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  if (lab)      { sql += ' AND e.lab = ?';      params.push(lab); }
  if (status)   { sql += ' AND e.status = ?';   params.push(status); }
  if (search)   { sql += ' AND (e.name LIKE ? OR e.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY e.lab, e.name';
  res.json(db.prepare(sql).all(...params));
});

// ─── GET /api/equipment/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Equipment not found.' });
  res.json(eq);
});

// ─── GET /api/equipment/:id/availability ─────────────────────────────────────
router.get('/:id/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD).' });

  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

  const booked = db.prepare(`
    SELECT r.start_time, r.end_time, u.name AS booked_by
    FROM reservations r JOIN users u ON r.user_id = u.id
    WHERE r.equipment_id = ? AND r.date = ? AND r.status = 'confirmed'
    ORDER BY r.start_time
  `).all(eq.id, date);

  res.json({ equipment: eq, date, booked_slots: booked });
});

// ─── POST /api/equipment  (admin only) ───────────────────────────────────────
router.post('/', requireAdmin, (req, res) => {
  const { name, lab, category, description, total_slots, status, image_url } = req.body;
  if (!name || !lab || !category) return res.status(400).json({ error: 'name, lab and category required.' });

  const info = db.prepare(
    'INSERT INTO equipment (name, lab, category, description, total_slots, status, image_url) VALUES (?,?,?,?,?,?,?)'
  ).run(name, lab, category, description || '', total_slots || 1, status || 'available', image_url || null);

  log('EQUIPMENT_ADDED', { userId: req.user.id, equipmentId: info.lastInsertRowid, details: name });
  res.status(201).json({ id: info.lastInsertRowid, name, lab, category });
});

// ─── PUT /api/equipment/:id  (admin only) ────────────────────────────────────
router.put('/:id', requireAdmin, (req, res) => {
  const eq = db.prepare('SELECT id FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

  const { name, lab, category, description, total_slots, status, image_url } = req.body;
  db.prepare(`
    UPDATE equipment SET name=?, lab=?, category=?, description=?, total_slots=?, status=?, image_url=?
    WHERE id=?
  `).run(name, lab, category, description, total_slots, status, image_url, req.params.id);

  log('EQUIPMENT_UPDATED', { userId: req.user.id, equipmentId: eq.id, details: `Updated ${name}` });
  res.json({ success: true });
});

// ─── DELETE /api/equipment/:id  (admin only) ─────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  const eq = db.prepare('SELECT id, name FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

  // Soft-delete: just set status to retired
  db.prepare("UPDATE equipment SET status = 'retired' WHERE id = ?").run(eq.id);
  log('EQUIPMENT_RETIRED', { userId: req.user.id, equipmentId: eq.id, details: eq.name });
  res.json({ success: true });
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = router;

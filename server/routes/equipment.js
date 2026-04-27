const { Equipment, Reservation, log, mongoose } = require('../db');
const router = require('express').Router();

// ─── GET /api/equipment ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, lab, status, search } = req.query;
    let query = {};
    if (category) query.category = category;
    if (lab) query.lab = lab;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const equipments = await Equipment.find(query).sort({ lab: 1, name: 1 });
    
    // Form local YYYY-MM-DD
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    const todayStr = localDate.toISOString().split('T')[0];

    const results = await Promise.all(equipments.map(async (e) => {
      const today_bookings = await Reservation.countDocuments({
        equipment_id: e._id,
        status: 'confirmed',
        date: todayStr
      });
      return { ...e.toJSON(), today_bookings };
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/equipment/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const eq = await Equipment.findById(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found.' });
    res.json(eq);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/equipment/:id/availability ─────────────────────────────────────
router.get('/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD).' });

    const eq = await Equipment.findById(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

    const booked = await Reservation.find({
      equipment_id: eq._id,
      date,
      status: 'confirmed'
    }).populate('user_id', 'name').sort({ start_time: 1 });

    const booked_slots = booked.map(r => ({
      start_time: r.start_time,
      end_time: r.end_time,
      booked_by: r.user_id ? r.user_id.name : 'Unknown'
    }));

    res.json({ equipment: eq, date, booked_slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/equipment  (admin only) ───────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, lab, category, description, total_slots, status, image_url } = req.body;
    if (!name || !lab || !category) return res.status(400).json({ error: 'name, lab and category required.' });

    const eq = await Equipment.create({
      name, lab, category, description: description || '',
      total_slots: total_slots || 1, status: status || 'available', image_url: image_url || null
    });

    log('EQUIPMENT_ADDED', { userId: req.user.id, equipmentId: eq._id, details: name });
    res.status(201).json({ id: eq._id, name, lab, category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/equipment/:id  (admin only) ────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const eq = await Equipment.findById(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

    const { name, lab, category, description, total_slots, status, image_url } = req.body;
    await Equipment.findByIdAndUpdate(req.params.id, {
      name, lab, category, description, total_slots, status, image_url
    });

    log('EQUIPMENT_UPDATED', { userId: req.user.id, equipmentId: eq._id, details: `Updated ${name}` });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/equipment/:id  (admin only) ─────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const eq = await Equipment.findById(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found.' });

    // Soft-delete: just set status to retired
    await Equipment.findByIdAndUpdate(req.params.id, { status: 'retired' });
    log('EQUIPMENT_RETIRED', { userId: req.user.id, equipmentId: eq._id, details: eq.name });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required.' });
  next();
}

module.exports = router;

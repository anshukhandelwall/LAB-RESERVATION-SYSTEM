const { Reservation, Equipment, isSlotAvailable, log } = require('../db');
const router = require('express').Router();

// ─── GET /api/reservations  (mine or all for admin) ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const { status, date, equipment_id, user_id } = req.query;

    let query = {};

    // Students can only see their own reservations
    if (!isAdmin) {
      query.user_id = req.user.id;
    } else if (user_id) {
      query.user_id = user_id;
    }

    if (status) query.status = status;
    if (date) query.date = date;
    if (equipment_id) query.equipment_id = equipment_id;

    const reservations = await Reservation.find(query)
      .populate('user_id', 'name email')
      .populate('equipment_id', 'name lab category')
      .sort({ date: -1, start_time: -1 })
      .limit(500);

    const formatted = reservations.map(r => {
      const data = r.toJSON();
      return {
        ...data,
        student_name: r.user_id?.name,
        student_email: r.user_id?.email,
        equipment_name: r.equipment_id?.name,
        lab: r.equipment_id?.lab,
        category: r.equipment_id?.category
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/reservations ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
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
    const eq = await Equipment.findOne({ _id: equipment_id, status: 'available' });
    if (!eq) return res.status(404).json({ error: 'Equipment not found or unavailable.' });

    // Conflict check
    const available = await isSlotAvailable(equipment_id, date, start_time, end_time);
    if (!available)
      return res.status(409).json({ error: 'Time slot is fully booked. Please choose another time.' });

    const r = await Reservation.create({
      user_id: req.user.id,
      equipment_id,
      date,
      start_time,
      end_time,
      notes: notes || null
    });

    log('RESERVATION_CREATED', {
      reservationId: r._id,
      userId: req.user.id,
      equipmentId: equipment_id,
      details: `${eq.name} on ${date} ${start_time}-${end_time}`,
      ip: req.ip
    });

    res.status(201).json({
      id: r._id,
      message: `Reservation confirmed for ${eq.name} on ${date} ${start_time}–${end_time}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/reservations/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id)
      .populate('user_id', 'name email')
      .populate('equipment_id', 'name lab category');

    if (!r) return res.status(404).json({ error: 'Reservation not found.' });

    // Students can only view their own
    if (req.user.role !== 'admin' && r.user_id._id.toString() !== req.user.id)
      return res.status(403).json({ error: 'Access denied.' });

    const data = r.toJSON();
    const formatted = {
      ...data,
      student_name: r.user_id?.name,
      student_email: r.user_id?.email,
      equipment_name: r.equipment_id?.name,
      lab: r.equipment_id?.lab,
      category: r.equipment_id?.category
    };

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/reservations/:id/cancel ──────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Reservation not found.' });

    if (req.user.role !== 'admin' && r.user_id.toString() !== req.user.id)
      return res.status(403).json({ error: 'Access denied.' });

    if (r.status !== 'confirmed')
      return res.status(400).json({ error: 'Only confirmed reservations can be cancelled.' });

    r.status = 'cancelled';
    await r.save();

    log('RESERVATION_CANCELLED', {
      reservationId: r._id,
      userId: req.user.id,
      equipmentId: r.equipment_id,
      details: `Cancelled by ${req.user.role === 'admin' ? 'admin' : 'student'}`,
      ip: req.ip
    });

    res.json({ success: true, message: 'Reservation cancelled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

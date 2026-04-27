const { Equipment, User, Reservation, UsageLog } = require('../db');
const router = require('express').Router();

// All admin routes require admin role — enforced by middleware in server.js

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const totalEquipment = await Equipment.countDocuments({ status: { $ne: 'retired' } });
    const totalUsers = await User.countDocuments({ role: 'student' });
    const totalReservations = await Reservation.countDocuments({});
    
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    const todayStr = localDate.toISOString().split('T')[0];

    const activeToday = await Reservation.countDocuments({ date: todayStr, status: 'confirmed' });
    const cancelledCount = await Reservation.countDocuments({ status: 'cancelled' });
    const confirmedCount = await Reservation.countDocuments({ status: 'confirmed' });

    res.json({
      total_equipment: totalEquipment,
      total_students: totalUsers,
      total_reservations: totalReservations,
      active_today: activeToday,
      confirmed_count: confirmedCount,
      cancelled_count: cancelledCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/equipment-utilization ─────────────────────────────────────
router.get('/equipment-utilization', async (req, res) => {
  try {
    const rows = await Equipment.aggregate([
      {
        $lookup: {
          from: 'reservations',
          localField: '_id',
          foreignField: 'equipment_id',
          as: 'reservations'
        }
      },
      {
        $project: {
          id: '$_id', name: 1, lab: 1, category: 1, total_slots: 1, status: 1,
          confirmed_count: {
            $size: {
              $filter: {
                input: '$reservations',
                as: 'r',
                cond: { $eq: ['$$r.status', 'confirmed'] }
              }
            }
          },
          cancelled_count: {
            $size: {
              $filter: {
                input: '$reservations',
                as: 'r',
                cond: { $eq: ['$$r.status', 'cancelled'] }
              }
            }
          },
          total_count: { $size: '$reservations' }
        }
      },
      { $sort: { confirmed_count: -1 } }
    ]);

    // Calculate unique dates separately for daily average (aggregate can be messy for this)
    const result = await Promise.all(rows.map(async (r) => {
      const dates = await Reservation.distinct('date', { equipment_id: r._id });
      const uniqueDays = Math.max(1, dates.length);
      return {
        ...r,
        daily_avg_bookings: parseFloat((r.confirmed_count / uniqueDays).toFixed(1))
      };
    }));

    const max = result.reduce((m, r) => Math.max(m, r.confirmed_count), 0) || 1;
    const tagged = result.map(r => ({
      ...r,
      utilization_pct: Math.round((r.confirmed_count / max) * 100),
      usage_level: r.confirmed_count / max >= 0.6 ? 'heavily_used'
                 : r.confirmed_count / max >= 0.2 ? 'moderate'
                 : 'underutilized'
    }));

    res.json(tagged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/daily-bookings ────────────────────────────────────────────
router.get('/daily-bookings', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetStr = targetDate.toISOString().split('T')[0];

    const rows = await Reservation.aggregate([
      { $match: { status: 'confirmed', date: { $gte: targetStr } } },
      { $group: { _id: '$date', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } }
    ]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/peak-hours ────────────────────────────────────────────────
router.get('/peak-hours', async (req, res) => {
  try {
    const rows = await Reservation.aggregate([
      { $match: { status: 'confirmed' } },
      { $project: { hour: { $substr: ['$start_time', 0, 2] } } },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { hour: '$_id', count: 1, _id: 0 } }
    ]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/recent-activity ──────────────────────────────────────────
router.get('/recent-activity', async (req, res) => {
  try {
    const logs = await UsageLog.find()
      .populate('user_id', 'name role email')
      .populate('equipment_id', 'name lab')
      .sort({ timestamp: -1 })
      .limit(100);

    const formatted = logs.map(l => {
      const data = l.toJSON();
      return {
        ...data,
        user_name: l.user_id?.name,
        user_role: l.user_id?.role,
        equipment_name: l.equipment_id?.name
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const { action, user_id, equipment_id, from, to, limit = 200 } = req.query;
    
    let query = {};
    if (action) query.action = action;
    if (user_id) query.user_id = user_id;
    if (equipment_id) query.equipment_id = equipment_id;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to + 'T23:59:59Z');
    }

    const logs = await UsageLog.find(query)
      .populate('user_id', 'name email role')
      .populate('equipment_id', 'name lab')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    const formatted = logs.map(l => {
      const data = l.toJSON();
      return {
        ...data,
        user_name: l.user_id?.name,
        user_email: l.user_id?.email,
        user_role: l.user_id?.role,
        equipment_name: l.equipment_id?.name,
        lab: l.equipment_id?.lab
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const rows = await User.aggregate([
      {
        $lookup: {
          from: 'reservations',
          let: { user_id: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$user_id', '$$user_id'] }, { $eq: ['$status', 'confirmed'] } ] } } }
          ],
          as: 'res'
        }
      },
      {
        $project: {
          id: '$_id', name: 1, email: 1, role: 1, student_id: 1, department: 1, created_at: 1,
          total_reservations: { $size: '$res' }
        }
      },
      { $sort: { created_at: -1 } }
    ]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

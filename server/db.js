require('dotenv').config();
const mongoose = require('mongoose');

// ─── Define Schemas ───────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  student_id: String,
  department: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lab: { type: String, required: true },
  category: { type: String, required: true },
  description: String,
  total_slots: { type: Number, default: 1 },
  status: { type: String, default: 'available' },
  image_url: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

const reservationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  start_time: { type: String, required: true }, // HH:MM
  end_time: { type: String, required: true }, // HH:MM
  status: { type: String, default: 'confirmed' },
  notes: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const usageLogSchema = new mongoose.Schema({
  reservation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
  action: { type: String, required: true },
  details: String,
  ip_address: String,
}, { timestamps: { createdAt: 'timestamp', updatedAt: false } });

// ─── JSON Transform (Convert _id to id) ───────────────────────────────────────
const transformOptions = {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
};
userSchema.set('toJSON', transformOptions);
equipmentSchema.set('toJSON', transformOptions);
reservationSchema.set('toJSON', transformOptions);
usageLogSchema.set('toJSON', transformOptions);

// ─── Models ───────────────────────────────────────────────────────────────────
const User = mongoose.model('User', userSchema);
const Equipment = mongoose.model('Equipment', equipmentSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const UsageLog = mongoose.model('UsageLog', usageLogSchema);

// ─── Connection Logic ─────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'lab_reservation_db' });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isSlotAvailable = async (equipmentId, date, startTime, endTime, excludeReservationId = null) => {
  const query = {
    equipment_id: equipmentId,
    date,
    status: 'confirmed',
    start_time: { $lt: endTime },
    end_time: { $gt: startTime }
  };
  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }
  const count = await Reservation.countDocuments(query);
  const eq = await Equipment.findById(equipmentId);
  if (!eq) return false;
  return count < eq.total_slots;
};

const log = async (action, { reservationId = null, userId = null, equipmentId = null, details = '', ip = '' } = {}) => {
  try {
    await UsageLog.create({
      reservation_id: reservationId,
      user_id: userId,
      equipment_id: equipmentId,
      action,
      details,
      ip_address: ip
    });
  } catch (err) {
    console.error('Error writing usage log:', err);
  }
};

module.exports = {
  connectDB,
  User,
  Equipment,
  Reservation,
  UsageLog,
  isSlotAvailable,
  log,
  mongoose
};

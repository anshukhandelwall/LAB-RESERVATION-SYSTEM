const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'lab_reservation.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'student',
    student_id  TEXT,
    department  TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    lab          TEXT    NOT NULL,
    category     TEXT    NOT NULL,
    description  TEXT,
    total_slots  INTEGER NOT NULL DEFAULT 1,
    status       TEXT    NOT NULL DEFAULT 'available',
    image_url    TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),
    date         TEXT    NOT NULL,
    start_time   TEXT    NOT NULL,
    end_time     TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'confirmed',
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER REFERENCES reservations(id),
    user_id        INTEGER REFERENCES users(id),
    equipment_id   INTEGER REFERENCES equipment(id),
    action         TEXT    NOT NULL,
    details        TEXT,
    ip_address     TEXT,
    timestamp      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_equipment_date
    ON reservations(equipment_id, date, status);
  CREATE INDEX IF NOT EXISTS idx_reservations_user
    ON reservations(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp
    ON usage_logs(timestamp);
`);


const helpers = {
  
  isSlotAvailable(equipmentId, date, startTime, endTime, excludeReservationId = null) {
    let sql = `
      SELECT COUNT(*) as cnt FROM reservations
      WHERE equipment_id = ?
        AND date = ?
        AND status = 'confirmed'
        AND start_time < ?
        AND end_time   > ?
    `;
    const params = [equipmentId, date, endTime, startTime];
    if (excludeReservationId) {
      sql += ` AND id != ?`;
      params.push(excludeReservationId);
    }
    const row = db.prepare(sql).get(...params);

    // Compare booked count against total_slots
    const eq = db.prepare('SELECT total_slots FROM equipment WHERE id = ?').get(equipmentId);
    if (!eq) return false;
    return row.cnt < eq.total_slots;
  },

  /** Insert a usage log entry. */
  log(action, { reservationId = null, userId = null, equipmentId = null, details = '', ip = '' } = {}) {
    db.prepare(`
      INSERT INTO usage_logs (reservation_id, user_id, equipment_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reservationId, userId, equipmentId, action, details, ip);
  }
};

module.exports = { db, ...helpers };

/**
 * seed.js — populates the database with demo data.
 * Run once: node server/seed.js
 */
const { db, log } = require('./db');
const bcrypt = require('bcryptjs');

console.log('🌱 Seeding database...');

// ─── Clear existing data ──────────────────────────────────────────────────────
db.exec(`
  DELETE FROM usage_logs;
  DELETE FROM reservations;
  DELETE FROM equipment;
  DELETE FROM users;
`);

// ─── Users ────────────────────────────────────────────────────────────────────
const adminPw   = bcrypt.hashSync('admin123',   12);
const studentPw = bcrypt.hashSync('student123', 12);

const insertUser = db.prepare(
  'INSERT INTO users (name, email, password, role, student_id, department) VALUES (?, ?, ?, ?, ?, ?)'
);

const adminId = insertUser.run('Dr. Admin',      'admin@lab.edu',   adminPw,   'admin',   null,       'Administration').lastInsertRowid;
const u1      = insertUser.run('Alice Johnson',  'alice@uni.edu',   studentPw, 'student', 'STU001',   'Chemistry').lastInsertRowid;
const u2      = insertUser.run('Bob Martinez',   'bob@uni.edu',     studentPw, 'student', 'STU002',   'Physics').lastInsertRowid;
const u3      = insertUser.run('Carol Patel',    'carol@uni.edu',   studentPw, 'student', 'STU003',   'Biology').lastInsertRowid;
const u4      = insertUser.run('David Kim',      'david@uni.edu',   studentPw, 'student', 'STU004',   'Chemistry').lastInsertRowid;
const u5      = insertUser.run('Emma Wilson',    'emma@uni.edu',    studentPw, 'student', 'STU005',   'Physics').lastInsertRowid;

// ─── Equipment ────────────────────────────────────────────────────────────────
const insertEq = db.prepare(
  'INSERT INTO equipment (name, lab, category, description, total_slots, status) VALUES (?, ?, ?, ?, ?, ?)'
);

const e1  = insertEq.run('HPLC Chromatograph',      'Chem Lab A', 'Analytical',    'High-performance liquid chromatography system for compound separation and analysis.', 2, 'available').lastInsertRowid;
const e2  = insertEq.run('NMR Spectrometer',         'Chem Lab A', 'Analytical',    '400 MHz Nuclear Magnetic Resonance spectrometer for molecular structure analysis.',   1, 'available').lastInsertRowid;
const e3  = insertEq.run('Mass Spectrometer',        'Chem Lab B', 'Analytical',    'High-resolution mass spectrometry for molecular weight determination.',               1, 'available').lastInsertRowid;
const e4  = insertEq.run('Confocal Microscope',      'Bio Lab 1',  'Microscopy',    'Laser scanning confocal microscope for 3D cellular imaging.',                         2, 'available').lastInsertRowid;
const e5  = insertEq.run('Flow Cytometer',           'Bio Lab 1',  'Cell Biology',  'Multi-parameter cell analysis and sorting system.',                                   1, 'available').lastInsertRowid;
const e6  = insertEq.run('PCR Thermocycler',         'Bio Lab 2',  'Molecular',     'Polymerase Chain Reaction machine, 96-well block.',                                   4, 'available').lastInsertRowid;
const e7  = insertEq.run('Electron Microscope',      'Physics Lab','Microscopy',    'Scanning electron microscope for nanoscale surface imaging.',                         1, 'available').lastInsertRowid;
const e8  = insertEq.run('X-ray Diffractometer',     'Physics Lab','Structural',    'Single-crystal X-ray diffractometer for crystal structure determination.',            1, 'available').lastInsertRowid;
const e9  = insertEq.run('Oscilloscope (16-Ch)',     'Electronics','Electronics',   '16-channel digital storage oscilloscope, 2 GHz bandwidth.',                           6, 'available').lastInsertRowid;
const e10 = insertEq.run('Centrifuge (Ultra)',        'Bio Lab 2',  'Separation',    'Ultracentrifuge up to 100,000 RPM for subcellular fractionation.',                    2, 'available').lastInsertRowid;
const e11 = insertEq.run('Atomic Force Microscope',  'Physics Lab','Microscopy',    'AFM for atomic-resolution surface topography.',                                       1, 'maintenance').lastInsertRowid;
const e12 = insertEq.run('Gas Chromatograph',        'Chem Lab B', 'Analytical',    'GC-FID/MS system for volatile compound analysis.',                                    2, 'available').lastInsertRowid;

// ─── Reservations ─────────────────────────────────────────────────────────────
const insertRes = db.prepare(
  'INSERT INTO reservations (user_id, equipment_id, date, start_time, end_time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

// Helper to get relative dates
function relDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const reservationData = [
  // Past reservations (variety of users and equipment)
  [u1, e1, relDate(-10), '09:00', '11:00', 'confirmed', 'Sample batch A analysis'],
  [u2, e7, relDate(-9),  '10:00', '12:00', 'confirmed', 'SEM imaging of thin film'],
  [u3, e6, relDate(-8),  '08:00', '10:00', 'confirmed', 'PCR for gene expression'],
  [u4, e2, relDate(-7),  '13:00', '15:00', 'confirmed', 'NMR of synthesized compound'],
  [u1, e4, relDate(-7),  '09:00', '11:00', 'confirmed', 'Cell imaging experiment'],
  [u5, e9, relDate(-6),  '14:00', '16:00', 'confirmed', 'Circuit testing'],
  [u2, e8, relDate(-6),  '10:00', '12:00', 'confirmed', 'Crystal diffraction study'],
  [u3, e5, relDate(-5),  '09:00', '11:00', 'confirmed', 'Flow cytometry of blood cells'],
  [u4, e1, relDate(-5),  '13:00', '15:00', 'confirmed', 'Protein HPLC run'],
  [u5, e6, relDate(-4),  '08:00', '10:00', 'confirmed', 'PCR amplification'],
  [u1, e3, relDate(-4),  '11:00', '13:00', 'confirmed', 'MS analysis of metabolites'],
  [u2, e10, relDate(-3), '09:00', '11:00', 'confirmed', 'Cell fractionation'],
  [u3, e6, relDate(-3),  '13:00', '15:00', 'confirmed', 'qPCR run'],
  [u4, e12, relDate(-2), '10:00', '12:00', 'confirmed', 'GC analysis of solvents'],
  [u5, e4, relDate(-2),  '14:00', '16:00', 'confirmed', 'Fluorescence imaging'],
  [u1, e2, relDate(-1),  '09:00', '11:00', 'confirmed', 'NMR characterisation'],
  [u3, e1, relDate(-1),  '13:00', '15:00', 'confirmed', 'HPLC purification'],
  [u2, e7, relDate(-1),  '10:00', '12:00', 'confirmed', 'SEM of polymer surface'],

  // Cancelled
  [u5, e8, relDate(-5),  '11:00', '13:00', 'cancelled', 'Cancelled — equipment conflict'],
  [u3, e3, relDate(-3),  '09:00', '11:00', 'cancelled', 'Sample not ready'],

  // Future reservations
  [u1, e1, relDate(1),  '09:00', '11:00', 'confirmed', 'HPLC method development'],
  [u2, e6, relDate(1),  '13:00', '15:00', 'confirmed', 'PCR — thesis experiment'],
  [u4, e9, relDate(2),  '10:00', '12:00', 'confirmed', 'Electronics practical'],
  [u5, e4, relDate(2),  '14:00', '16:00', 'confirmed', 'Imaging session'],
  [u3, e10, relDate(3), '09:00', '11:00', 'confirmed', 'Ultracentrifugation'],
  [u1, e7, relDate(3),  '11:00', '13:00', 'confirmed', 'SEM sample analysis'],
  [u2, e12, relDate(4), '10:00', '12:00', 'confirmed', 'GC volatile analysis'],
  [u4, e2, relDate(5),  '13:00', '15:00', 'confirmed', 'NMR for thesis'],
];

const resIds = reservationData.map(r => insertRes.run(...r).lastInsertRowid);

// ─── Usage Logs ───────────────────────────────────────────────────────────────
resIds.forEach((rid, i) => {
  const [uid, eid, , , , status] = reservationData[i];
  log(status === 'cancelled' ? 'RESERVATION_CANCELLED' : 'RESERVATION_CREATED', {
    reservationId: rid, userId: uid, equipmentId: eid,
    details: status === 'cancelled' ? 'Seeded cancellation' : 'Seeded reservation'
  });
});

log('USER_REGISTERED', { userId: u1, details: 'Alice Johnson <alice@uni.edu>' });
log('USER_REGISTERED', { userId: u2, details: 'Bob Martinez <bob@uni.edu>' });
log('USER_REGISTERED', { userId: u3, details: 'Carol Patel <carol@uni.edu>' });
log('USER_REGISTERED', { userId: u4, details: 'David Kim <david@uni.edu>' });
log('USER_REGISTERED', { userId: u5, details: 'Emma Wilson <emma@uni.edu>' });
log('EQUIPMENT_ADDED', { userId: adminId, equipmentId: e11, details: 'Atomic Force Microscope added' });

console.log('✅ Seed complete!');
console.log('   Admin  → admin@lab.edu  / admin123');
console.log('   Student→ alice@uni.edu  / student123');

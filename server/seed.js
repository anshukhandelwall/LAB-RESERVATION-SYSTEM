const { connectDB, User, Equipment, Reservation, UsageLog, mongoose } = require('./db');
const bcrypt = require('bcryptjs');

const seed = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding database...');

    // ─── Clear existing data ──────────────────────────────────────────────────────
    await UsageLog.deleteMany({});
    await Reservation.deleteMany({});
    await Equipment.deleteMany({});
    await User.deleteMany({});

    // ─── Users ────────────────────────────────────────────────────────────────────
    const adminPw   = bcrypt.hashSync('admin123',   12);
    const studentPw = bcrypt.hashSync('student123', 12);

    const users = await User.insertMany([
      { name: 'Dr. Admin',      email: 'admin@lab.edu',   password: adminPw,   role: 'admin',   student_id: null,       department: 'Administration' },
      { name: 'Alice Johnson',  email: 'alice@uni.edu',   password: studentPw, role: 'student', student_id: 'STU001',   department: 'Chemistry' },
      { name: 'Bob Martinez',   email: 'bob@uni.edu',     password: studentPw, role: 'student', student_id: 'STU002',   department: 'Physics' },
      { name: 'Carol Patel',    email: 'carol@uni.edu',   password: studentPw, role: 'student', student_id: 'STU003',   department: 'Biology' },
      { name: 'David Kim',      email: 'david@uni.edu',   password: studentPw, role: 'student', student_id: 'STU004',   department: 'Chemistry' },
      { name: 'Emma Wilson',    email: 'emma@uni.edu',    password: studentPw, role: 'student', student_id: 'STU005',   department: 'Physics' }
    ]);

    const adminId = users[0]._id;
    const [u1, u2, u3, u4, u5] = users.slice(1).map(u => u._id);

    // ─── Equipment ────────────────────────────────────────────────────────────────
    const equipments = await Equipment.insertMany([
      { name: 'HPLC Chromatograph',      lab: 'Chem Lab A', category: 'Analytical',    description: 'High-performance liquid chromatography system for compound separation and analysis.', total_slots: 2, status: 'available' },
      { name: 'NMR Spectrometer',         lab: 'Chem Lab A', category: 'Analytical',    description: '400 MHz Nuclear Magnetic Resonance spectrometer for molecular structure analysis.',   total_slots: 1, status: 'available' },
      { name: 'Mass Spectrometer',        lab: 'Chem Lab B', category: 'Analytical',    description: 'High-resolution mass spectrometry for molecular weight determination.',               total_slots: 1, status: 'available' },
      { name: 'Confocal Microscope',      lab: 'Bio Lab 1',  category: 'Microscopy',    description: 'Laser scanning confocal microscope for 3D cellular imaging.',                         total_slots: 2, status: 'available' },
      { name: 'Flow Cytometer',           lab: 'Bio Lab 1',  category: 'Cell Biology',  description: 'Multi-parameter cell analysis and sorting system.',                                   total_slots: 1, status: 'available' },
      { name: 'PCR Thermocycler',         lab: 'Bio Lab 2',  category: 'Molecular',     description: 'Polymerase Chain Reaction machine, 96-well block.',                                   total_slots: 4, status: 'available' },
      { name: 'Electron Microscope',      lab: 'Physics Lab',category: 'Microscopy',    description: 'Scanning electron microscope for nanoscale surface imaging.',                         total_slots: 1, status: 'available' },
      { name: 'X-ray Diffractometer',     lab: 'Physics Lab',category: 'Structural',    description: 'Single-crystal X-ray diffractometer for crystal structure determination.',            total_slots: 1, status: 'available' },
      { name: 'Oscilloscope (16-Ch)',     lab: 'Electronics',category: 'Electronics',   description: '16-channel digital storage oscilloscope, 2 GHz bandwidth.',                           total_slots: 6, status: 'available' },
      { name: 'Centrifuge (Ultra)',        lab: 'Bio Lab 2',  category: 'Separation',    description: 'Ultracentrifuge up to 100,000 RPM for subcellular fractionation.',                    total_slots: 2, status: 'available' },
      { name: 'Atomic Force Microscope',  lab: 'Physics Lab',category: 'Microscopy',    description: 'AFM for atomic-resolution surface topography.',                                       total_slots: 1, status: 'maintenance' },
      { name: 'Gas Chromatograph',        lab: 'Chem Lab B', category: 'Analytical',    description: 'GC-FID/MS system for volatile compound analysis.',                                    total_slots: 2, status: 'available' }
    ]);

    const [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12] = equipments.map(e => e._id);

    // ─── Reservations ─────────────────────────────────────────────────────────────
    function relDate(offset) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    }

    const reservationData = [
      { user_id: u1, equipment_id: e1, date: relDate(-10), start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'Sample batch A analysis' },
      { user_id: u2, equipment_id: e7, date: relDate(-9),  start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'SEM imaging of thin film' },
      { user_id: u3, equipment_id: e6, date: relDate(-8),  start_time: '08:00', end_time: '10:00', status: 'confirmed', notes: 'PCR for gene expression' },
      { user_id: u4, equipment_id: e2, date: relDate(-7),  start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'NMR of synthesized compound' },
      { user_id: u1, equipment_id: e4, date: relDate(-7),  start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'Cell imaging experiment' },
      { user_id: u5, equipment_id: e9, date: relDate(-6),  start_time: '14:00', end_time: '16:00', status: 'confirmed', notes: 'Circuit testing' },
      { user_id: u2, equipment_id: e8, date: relDate(-6),  start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'Crystal diffraction study' },
      { user_id: u3, equipment_id: e5, date: relDate(-5),  start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'Flow cytometry of blood cells' },
      { user_id: u4, equipment_id: e1, date: relDate(-5),  start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'Protein HPLC run' },
      { user_id: u5, equipment_id: e6, date: relDate(-4),  start_time: '08:00', end_time: '10:00', status: 'confirmed', notes: 'PCR amplification' },
      { user_id: u1, equipment_id: e3, date: relDate(-4),  start_time: '11:00', end_time: '13:00', status: 'confirmed', notes: 'MS analysis of metabolites' },
      { user_id: u2, equipment_id: e10, date: relDate(-3), start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'Cell fractionation' },
      { user_id: u3, equipment_id: e6, date: relDate(-3),  start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'qPCR run' },
      { user_id: u4, equipment_id: e12, date: relDate(-2), start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'GC analysis of solvents' },
      { user_id: u5, equipment_id: e4, date: relDate(-2),  start_time: '14:00', end_time: '16:00', status: 'confirmed', notes: 'Fluorescence imaging' },
      { user_id: u1, equipment_id: e2, date: relDate(-1),  start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'NMR characterisation' },
      { user_id: u3, equipment_id: e1, date: relDate(-1),  start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'HPLC purification' },
      { user_id: u2, equipment_id: e7, date: relDate(-1),  start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'SEM of polymer surface' },
      { user_id: u5, equipment_id: e8, date: relDate(-5),  start_time: '11:00', end_time: '13:00', status: 'cancelled', notes: 'Cancelled — equipment conflict' },
      { user_id: u3, equipment_id: e3, date: relDate(-3),  start_time: '09:00', end_time: '11:00', status: 'cancelled', notes: 'Sample not ready' },
      { user_id: u1, equipment_id: e1, date: relDate(1),   start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'HPLC method development' },
      { user_id: u2, equipment_id: e6, date: relDate(1),   start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'PCR — thesis experiment' },
      { user_id: u4, equipment_id: e9, date: relDate(2),   start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'Electronics practical' },
      { user_id: u5, equipment_id: e4, date: relDate(2),   start_time: '14:00', end_time: '16:00', status: 'confirmed', notes: 'Imaging session' },
      { user_id: u3, equipment_id: e10, date: relDate(3),  start_time: '09:00', end_time: '11:00', status: 'confirmed', notes: 'Ultracentrifugation' },
      { user_id: u1, equipment_id: e7, date: relDate(3),   start_time: '11:00', end_time: '13:00', status: 'confirmed', notes: 'SEM sample analysis' },
      { user_id: u2, equipment_id: e12, date: relDate(4),  start_time: '10:00', end_time: '12:00', status: 'confirmed', notes: 'GC volatile analysis' },
      { user_id: u4, equipment_id: e2, date: relDate(5),   start_time: '13:00', end_time: '15:00', status: 'confirmed', notes: 'NMR for thesis' }
    ];

    const reservations = await Reservation.insertMany(reservationData);

    // ─── Usage Logs ───────────────────────────────────────────────────────────────
    const logs = reservations.map(r => ({
      reservation_id: r._id,
      user_id: r.user_id,
      equipment_id: r.equipment_id,
      action: r.status === 'cancelled' ? 'RESERVATION_CANCELLED' : 'RESERVATION_CREATED',
      details: r.status === 'cancelled' ? 'Seeded cancellation' : 'Seeded reservation'
    }));

    await UsageLog.insertMany(logs);
    await UsageLog.create({ user_id: users[1]._id, action: 'USER_REGISTERED', details: 'Alice Johnson <alice@uni.edu>' });
    await UsageLog.create({ user_id: users[2]._id, action: 'USER_REGISTERED', details: 'Bob Martinez <bob@uni.edu>' });
    await UsageLog.create({ user_id: users[3]._id, action: 'USER_REGISTERED', details: 'Carol Patel <carol@uni.edu>' });
    await UsageLog.create({ user_id: users[4]._id, action: 'USER_REGISTERED', details: 'David Kim <david@uni.edu>' });
    await UsageLog.create({ user_id: users[5]._id, action: 'USER_REGISTERED', details: 'Emma Wilson <emma@uni.edu>' });
    await UsageLog.create({ user_id: adminId, equipment_id: e11, action: 'EQUIPMENT_ADDED', details: 'Atomic Force Microscope added' });

    console.log('✅ Seed complete!');
    console.log('   Admin  → admin@lab.edu  / admin123');
    console.log('   Student→ alice@uni.edu  / student123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();

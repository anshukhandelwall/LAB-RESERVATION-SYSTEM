const { db, log } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = require('express').Router();

const JWT_SECRET = process.env.JWT_SECRET || 'labsys_super_secret_2024';
const JWT_EXPIRES = '7d';

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { name, email, password, student_id, department } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already registered.' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(
    'INSERT INTO users (name, email, password, student_id, department) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hash, student_id || null, department || null);

  log('USER_REGISTERED', { userId: info.lastInsertRowid, details: `${name} <${email}>`, ip: req.ip });
  const token = jwt.sign({ id: info.lastInsertRowid, role: 'student' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({ token, user: { id: info.lastInsertRowid, name, email, role: 'student' } });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials.' });

  log('USER_LOGIN', { userId: user.id, details: `${user.name} logged in`, ip: req.ip });
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role, student_id, department, created_at FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;

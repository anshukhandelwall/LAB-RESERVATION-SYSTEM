const express = require('express');
const cors    = require('cors');
const path    = require('path');
const jwt     = require('jsonwebtoken');

const { JWT_SECRET } = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// JWT Auth middleware — attaches req.user if token present
app.use((req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* invalid token — req.user stays null */ }
  }
  next();
});

// Require authentication for protected routes
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required.' });
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/equipment',    require('./routes/equipment'));
app.use('/api/reservations', requireAuth, require('./routes/reservations'));
app.use('/api/admin',        requireAdmin, require('./routes/admin'));

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n🔬 Lab Reservation System running at http://localhost:${PORT}`);
  console.log(`   Admin login: admin@lab.edu / admin123`);
  console.log(`   Student login: alice@uni.edu / student123\n`);
});

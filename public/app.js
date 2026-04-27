/* ═══════════════════════════════════════════════════════════════
   LabReserve — SPA Core (auth, routing, API, utilities)
   ═══════════════════════════════════════════════════════════════ */

const API = 'https://lab-reservation-system-2d6d.onrender.com/api';
let currentUser = null;

// ─── API helper ──────────────────────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email: document.getElementById('login-email').value, password: document.getElementById('login-password').value }
    });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        student_id: document.getElementById('reg-sid').value,
        department: document.getElementById('reg-dept').value
      }
    });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    showApp();
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
}

// ─── App bootstrap ────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const data = await api('/auth/me');
      currentUser = data.user;
      showApp();
    } catch {
      localStorage.removeItem('token');
    }
  }
}

function showApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  buildSidebar();
  navigate(currentUser.role === 'admin' ? 'dashboard' : 'equipment');
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_STUDENT = [
  { page: 'equipment',     icon: '🧪', label: 'Browse Equipment' },
  { page: 'my-bookings',  icon: '📅', label: 'My Bookings' },
  { page: 'my-logs',      icon: '📋', label: 'My Usage History' }
];

const NAV_ADMIN = [
  { section: 'Overview' },
  { page: 'dashboard',    icon: '📊', label: 'Dashboard' },
  { section: 'Management' },
  { page: 'equipment',    icon: '🧪', label: 'Equipment' },
  { page: 'all-bookings', icon: '📅', label: 'All Reservations' },
  { section: 'Analytics' },
  { page: 'utilization',  icon: '📈', label: 'Utilization' },
  { page: 'logs',         icon: '🔒', label: 'Audit Logs' },
  { page: 'users',        icon: '👥', label: 'Users' }
];

function buildSidebar() {
  const nav = currentUser.role === 'admin' ? NAV_ADMIN : NAV_STUDENT;
  document.getElementById('sidebar-nav').innerHTML = nav.map(item =>
    item.section
      ? `<div class="nav-section-label">${item.section}</div>`
      : `<button class="nav-item" data-page="${item.page}" onclick="navigate('${item.page}')">
           <span class="nav-icon">${item.icon}</span>${item.label}
         </button>`
  ).join('');

  document.getElementById('sidebar-user').innerHTML = `
    <div class="user-name">${currentUser.name}</div>
    <div class="user-role">${currentUser.role}</div>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
let activePage = null;
function navigate(page) {
  activePage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const container = document.getElementById('page-container');
  container.innerHTML = `<div class="loader"><div class="spinner"></div> Loading…</div>`;
  renderPage(page, container);
}

async function renderPage(page, container) {
  const pages = {
    dashboard:    renderDashboard,
    equipment:    renderEquipment,
    'my-bookings':   renderMyBookings,
    'all-bookings':  renderAllBookings,
    'my-logs':       renderMyLogs,
    utilization:     renderUtilization,
    logs:            renderLogs,
    users:           renderUsers
  };
  const fn = pages[page];
  if (fn) await fn(container);
  else container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚧</div><p>Page not found.</p></div>';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d)     { return d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'; }

function categoryIcon(cat) {
  const m = { Analytical:'🔬', Microscopy:'🔭', Molecular:'🧬', 'Cell Biology':'🦠', Separation:'⚗️', Electronics:'⚡', Structural:'💎' };
  return m[cat] || '🧪';
}

function logDotClass(action) {
  if (action.includes('CREATED'))   return 'dot-created';
  if (action.includes('CANCELLED')) return 'dot-cancelled';
  if (action.includes('LOGIN'))     return 'dot-login';
  return 'dot-default';
}

// --- Dashboard (Admin) --------------------------------------------------------
async function renderDashboard(container) {
  const [stats, recent] = await Promise.all([
    api('/admin/stats'), api('/admin/recent-activity')
  ]);
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Admin Dashboard</h1>
      <p class="page-subtitle">System overview and recent activity</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon"></span>
        <div class="stat-value">${stats.total_equipment}</div>
        <div class="stat-label">Total Equipment</div>
      </div>
      <div class="stat-card teal">
        <span class="stat-icon"></span>
        <div class="stat-value">${stats.total_students}</div>
        <div class="stat-label">Registered Students</div>
      </div>
      <div class="stat-card rose">
        <span class="stat-icon"></span>
        <div class="stat-value">${stats.confirmed_count}</div>
        <div class="stat-label">Active Reservations</div>
      </div>
      <div class="stat-card amber">
        <span class="stat-icon"></span>
        <div class="stat-value">${stats.active_today}</div>
        <div class="stat-label">Booked Today</div>
      </div>
    </div>
    <div class="two-col">
      <div id="daily-chart-wrapper"></div>
      <div id="peak-chart-wrapper"></div>
    </div>
    <div class="card mt-6">
      <div class="section-header">
        <span class="section-title">?? Recent Activity</span>
      </div>
      <div id="recent-logs">
        ${recent.slice(0,15).map(l => `
          <div class="log-entry">
            <div class="log-dot ${logDotClass(l.action)}"></div>
            <div style="flex:1">
              <div class="log-action">${l.action.replace(/_/g,' ')}</div>
              <div class="log-details">${l.user_name || '�'} � ${l.equipment_name || ''} ${l.details ? '� ' + l.details : ''}</div>
            </div>
            <div class="log-time">${fmtDateTime(l.timestamp)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  loadDailyChart();
  loadPeakChart();
}

async function loadDailyChart() {
  const rows = await api('/admin/daily-bookings?days=14');
  const max = Math.max(...rows.map(r => r.count), 1);
  const html = `<div class="chart-wrapper">
    <div class="chart-title">?? Daily Bookings (last 14 days)</div>
    <div class="bar-chart">
      ${rows.map(r => {
        const pct = Math.round((r.count / max) * 100);
        return `<div class="bar-col">
          <div class="bar-val">${r.count}</div>
          <div class="bar-fill accent" style="height:${pct}%"></div>
          <div class="bar-label">${r.date.slice(5)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  const el = document.getElementById('daily-chart-wrapper');
  if (el) el.innerHTML = html;
}

async function loadPeakChart() {
  const rows = await api('/admin/peak-hours');
  const max = Math.max(...rows.map(r => r.count), 1);
  const html = `<div class="chart-wrapper">
    <div class="chart-title">? Peak Booking Hours</div>
    <div class="bar-chart">
      ${rows.map(r => {
        const pct = Math.round((r.count / max) * 100);
        return `<div class="bar-col">
          <div class="bar-val">${r.count}</div>
          <div class="bar-fill teal" style="height:${pct}%"></div>
          <div class="bar-label">${r.hour}:00</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  const el = document.getElementById('peak-chart-wrapper');
  if (el) el.innerHTML = html;
}

// --- Equipment Browser --------------------------------------------------------
async function renderEquipment(container) {
  let equipment = await api('/equipment');
  const isAdmin = currentUser.role === 'admin';

  function render(list) {
    if (!list.length) return '<div class="empty-state"><div class="empty-state-icon">??</div><p>No equipment found.</p></div>';
    return `<div class="cards-grid">${list.map(eq => `
      <div class="eq-card" onclick="openEquipmentDetail('${eq.id}')">
        <div class="eq-card-header">
          <span class="eq-icon">${categoryIcon(eq.category)}</span>
          <span class="eq-badge badge-${eq.status}">${eq.status}</span>
        </div>
        <div class="eq-name">${eq.name}</div>
        <div class="eq-lab">?? ${eq.lab}</div>
        <div class="eq-desc">${eq.description || ''}</div>
        <div class="eq-meta">
          <span class="eq-cat">${eq.category}</span>
          <span class="eq-slots">?? ${eq.total_slots} slot${eq.total_slots>1?'s':''}</span>
        </div>
      </div>`).join('')}</div>`;
  }

  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1 class="page-title">Laboratory Equipment</h1>
        <p class="page-subtitle">${equipment.length} items available across all labs</p>
      </div>
      ${isAdmin ? `<button class="btn-primary" onclick="openAddEquipment()">+ Add Equipment</button>` : ''}
    </div>
    <div class="filters-bar">
      <input class="filter-search" id="eq-search" placeholder="?? Search equipment�" oninput="filterEquipment()" />
      <select id="eq-cat" onchange="filterEquipment()">
        <option value="">All Categories</option>
        ${[...new Set(equipment.map(e=>e.category))].map(c=>`<option>${c}</option>`).join('')}
      </select>
      <select id="eq-lab" onchange="filterEquipment()">
        <option value="">All Labs</option>
        ${[...new Set(equipment.map(e=>e.lab))].map(l=>`<option>${l}</option>`).join('')}
      </select>
      <select id="eq-status" onchange="filterEquipment()">
        <option value="">All Status</option>
        <option>available</option><option>maintenance</option>
      </select>
    </div>
    <div id="eq-grid">${render(equipment)}</div>`;

  window._allEquipment = equipment;
}

function filterEquipment() {
  const q    = document.getElementById('eq-search').value.toLowerCase();
  const cat  = document.getElementById('eq-cat').value;
  const lab  = document.getElementById('eq-lab').value;
  const stat = document.getElementById('eq-status').value;
  let list = window._allEquipment || [];
  if (q)    list = list.filter(e => (e.name+e.description).toLowerCase().includes(q));
  if (cat)  list = list.filter(e => e.category === cat);
  if (lab)  list = list.filter(e => e.lab === lab);
  if (stat) list = list.filter(e => e.status === stat);
  const grid = document.getElementById('eq-grid');
  if (grid) grid.innerHTML = list.length
    ? `<div class="cards-grid">${list.map(eq => `
      <div class="eq-card" onclick="openEquipmentDetail('${eq.id}')">
        <div class="eq-card-header">
          <span class="eq-icon">${categoryIcon(eq.category)}</span>
          <span class="eq-badge badge-${eq.status}">${eq.status}</span>
        </div>
        <div class="eq-name">${eq.name}</div>
        <div class="eq-lab"> ${eq.lab}</div>
        <div class="eq-desc">${eq.description||''}</div>
        <div class="eq-meta">
          <span class="eq-cat">${eq.category}</span>
          <span class="eq-slots"> ${eq.total_slots} slot${eq.total_slots>1?'s':''}</span>
        </div>
      </div>`).join('')}</div>`
    : '<div class="empty-state"><div class="empty-state-icon">??</div><p>No results found.</p></div>';
}

async function openEquipmentDetail(id) {
  const eq = await api(`/equipment/${id}`);
  const today = new Date().toISOString().slice(0,10);
  openModal(`
    <div class="modal-title">${categoryIcon(eq.category)} ${eq.name}</div>
    <div class="modal-subtitle"> ${eq.lab} � ${eq.category} � <span class="eq-badge badge-${eq.status}">${eq.status}</span></div>
    <div class="modal-eq-info">${eq.description || 'No description provided.'}<br/><br/>
      <strong>Total Slots:</strong> ${eq.total_slots} concurrent booking(s)
    </div>
    ${eq.status === 'available' ? `
    <div class="form-group"><label>Select Date</label>
      <input type="date" id="book-date" value="${today}" min="${today}" onchange="loadAvailability('${id}')" />
    </div>
    <div id="availability-display" style="margin:12px 0"></div>
    <form onsubmit="submitBooking(event,'${id}')">
      <div class="form-row">
        <div class="form-group"><label>Start Time</label><input type="time" id="book-start" value="09:00" required /></div>
        <div class="form-group"><label>End Time</label><input type="time" id="book-end" value="11:00" required /></div>
      </div>
      <div class="form-group" style="margin-top:10px"><label>Notes (optional)</label>
        <textarea id="book-notes" placeholder="Purpose of use�"></textarea>
      </div>
      <div id="book-error" class="form-error hidden" style="margin-top:8px"></div>
      <button type="submit" class="btn-primary btn-full" style="margin-top:14px" id="book-btn">Confirm Reservation</button>
    </form>` : `<p class="text-muted" style="text-align:center;padding:20px">This equipment is currently unavailable for booking.</p>`}
  `);
  if (eq.status === 'available') loadAvailability(id);
}

async function loadAvailability(id) {
  const date = document.getElementById('book-date')?.value;
  if (!date) return;
  const el = document.getElementById('availability-display');
  if (!el) return;
  try {
    const data = await api(`/equipment/${id}/availability?date=${date}`);
    if (!data.booked_slots.length) {
      el.innerHTML = `<div style="color:var(--success);font-size:.85rem">? Fully available on ${date}</div>`;
    } else {
      el.innerHTML = `<div style="font-size:.82rem;color:var(--text-secondary)">?? Booked slots on ${date}:<br>${data.booked_slots.map(s=>`<span style="color:var(--rose)">${s.start_time}�${s.end_time}</span>`).join(', ')}</div>`;
    }
  } catch { el.innerHTML = ''; }
}

async function submitBooking(e, equipmentId) {
  e.preventDefault();
  const btn = document.getElementById('book-btn');
  const errEl = document.getElementById('book-error');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Reserving�';
  try {
    const msg = await api('/reservations', {
      method: 'POST',
      body: {
        equipment_id: equipmentId,
        date: document.getElementById('book-date').value,
        start_time: document.getElementById('book-start').value,
        end_time: document.getElementById('book-end').value,
        notes: document.getElementById('book-notes').value
      }
    });
    document.getElementById('modal-overlay').classList.add('hidden');
    toast(msg.message || 'Reservation confirmed!', 'success');
  } catch (err) {
    errEl.textContent = err.message; errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirm Reservation';
  }
}

// --- Add Equipment Modal (Admin) ----------------------------------------------
function openAddEquipment() {
  openModal(`
    <div class="modal-title"> Add New Equipment</div>
    <div class="modal-subtitle">Fill in equipment details to add it to the system.</div>
    <form onsubmit="submitAddEquipment(event)">
      <div class="form-row">
        <div class="form-group"><label>Name</label><input id="ne-name" required placeholder="HPLC Chromatograph"/></div>
        <div class="form-group"><label>Lab</label><input id="ne-lab" required placeholder="Chem Lab A"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Category</label>
          <select id="ne-cat">
            <option>Analytical</option><option>Microscopy</option><option>Molecular</option>
            <option>Cell Biology</option><option>Separation</option><option>Electronics</option>
            <option>Structural</option><option>Other</option>
          </select>
        </div>
        <div class="form-group"><label>Total Slots</label><input id="ne-slots" type="number" value="1" min="1" max="20"/></div>
      </div>
      <div class="form-group"><label>Description</label><textarea id="ne-desc" placeholder="Brief description�"></textarea></div>
      <button type="submit" class="btn-primary btn-full" style="margin-top:14px">Add Equipment</button>
    </form>`);
}

async function submitAddEquipment(e) {
  e.preventDefault();
  try {
    await api('/equipment', { method:'POST', body:{
      name: document.getElementById('ne-name').value,
      lab: document.getElementById('ne-lab').value,
      category: document.getElementById('ne-cat').value,
      total_slots: parseInt(document.getElementById('ne-slots').value),
      description: document.getElementById('ne-desc').value
    }});
    document.getElementById('modal-overlay').classList.add('hidden');
    toast('Equipment added!', 'success');
    navigate('equipment');
  } catch(err) { toast(err.message, 'error'); }
}

// --- My Bookings (Student) ----------------------------------------------------
async function renderMyBookings(container) {
  const rows = await api('/reservations');
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Reservations</h1>
      <p class="page-subtitle">Manage your upcoming and past bookings</p>
    </div>
    <div class="card">
      ${rows.length === 0 ? '<div class="empty-state"><div class="empty-state-icon"></div><p>No reservations yet. Browse equipment to make a booking.</p></div>' : `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Equipment</th><th>Lab</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td><strong>${r.equipment_name}</strong></td>
              <td class="text-teal">${r.lab}</td>
              <td>${fmtDate(r.date)}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.8rem">${r.start_time}�${r.end_time}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td>${r.status==='confirmed' ? `<button class="btn-danger btn-sm" onclick="cancelReservation('${r.id}')">Cancel</button>` : '�'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>`;
}

// --- All Bookings (Admin) -----------------------------------------------------
async function renderAllBookings(container) {
  const rows = await api('/reservations');
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">All Reservations</h1>
      <p class="page-subtitle">${rows.length} total records</p>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Student</th><th>Equipment</th><th>Lab</th><th>Date</th><th>Time Slot</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>${rows.map(r => `
            <tr>
              <td>
                <div style="font-weight:600">${r.student_name}</div>
                <div class="text-muted text-sm">${r.student_email}</div>
              </td>
              <td>${r.equipment_name}</td>
              <td class="text-teal">${r.lab}</td>
              <td>${fmtDate(r.date)}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.8rem">${r.start_time}�${r.end_time}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td>${r.status==='confirmed' ? `<button class="btn-danger btn-sm" onclick="cancelReservation('${r.id}')">Cancel</button>` : '�'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function cancelReservation(id) {
  if (!confirm('Cancel this reservation?')) return;
  try {
    await api(`/reservations/${id}/cancel`, { method:'PATCH' });
    toast('Reservation cancelled.', 'success');
    navigate(currentUser.role==='admin' ? 'all-bookings' : 'my-bookings');
  } catch(err) { toast(err.message, 'error'); }
}

// --- My Usage History (Student) -----------------------------------------------
async function renderMyLogs(container) {
  const rows = await api('/reservations');
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">My Usage History</h1>
      <p class="page-subtitle">Complete record of your lab equipment usage</p>
    </div>
    <div class="card">
      ${rows.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">??</div><p>No usage history found.</p></div>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Equipment</th><th>Lab</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>${rows.map(r=>`
            <tr>
              <td><strong>${r.equipment_name}</strong></td>
              <td class="text-teal">${r.lab}</td>
              <td>${fmtDate(r.date)}</td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:.8rem">${r.start_time}�${r.end_time}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td class="text-muted text-sm">${r.notes||'�'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    </div>`;
}

// --- Utilization (Admin) ------------------------------------------------------
async function renderUtilization(container) {
  const rows = await api('/admin/equipment-utilization');
  const heavily = rows.filter(r=>r.usage_level==='heavily_used').length;
  const under   = rows.filter(r=>r.usage_level==='underutilized').length;
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Equipment Utilization</h1>
      <p class="page-subtitle">Identify heavily used and underutilized equipment</p>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card rose">
        <span class="stat-icon">??</span>
        <div class="stat-value">${heavily}</div>
        <div class="stat-label">Heavily Used</div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">??</span>
        <div class="stat-value">${rows.length - heavily - under}</div>
        <div class="stat-label">Moderate Use</div>
      </div>
      <div class="stat-card teal">
        <span class="stat-icon">??</span>
        <div class="stat-value">${under}</div>
        <div class="stat-label">Underutilized</div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Equipment</th><th>Lab</th><th>Category</th>
            <th>Confirmed</th><th>Cancelled</th><th>Utilization</th><th>Level</th>
          </tr></thead>
          <tbody>${rows.map(r=>`
            <tr>
              <td><strong>${r.name}</strong></td>
              <td class="text-teal">${r.lab}</td>
              <td><span class="eq-cat">${r.category}</span></td>
              <td style="color:var(--success);font-weight:600">${r.confirmed_count}</td>
              <td style="color:var(--danger)">${r.cancelled_count}</td>
              <td style="min-width:140px">
                <div class="util-bar-wrap">
                  <div class="util-bar">
                    <div class="util-bar-fill fill-${r.usage_level==='heavily_used'?'heavy':r.usage_level==='moderate'?'moderate':'under'}"
                         style="width:${r.utilization_pct}%"></div>
                  </div>
                  <span class="text-sm text-muted">${r.utilization_pct}%</span>
                </div>
              </td>
              <td><span class="badge level-${r.usage_level}">${r.usage_level.replace('_',' ')}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// --- Audit Logs (Admin) -------------------------------------------------------
async function renderLogs(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Audit Logs</h1>
      <p class="page-subtitle">Complete immutable activity log for safety and compliance</p>
    </div>
    <div class="filters-bar">
      <select id="log-action" onchange="refreshLogs()">
        <option value="">All Actions</option>
        <option>RESERVATION_CREATED</option><option>RESERVATION_CANCELLED</option>
        <option>USER_LOGIN</option><option>USER_REGISTERED</option>
        <option>EQUIPMENT_ADDED</option><option>EQUIPMENT_UPDATED</option>
      </select>
    </div>
    <div class="card" id="logs-table-wrap"><div class="loader"><div class="spinner"></div> Loading�</div></div>`;
  refreshLogs();
}

async function refreshLogs() {
  const action = document.getElementById('log-action')?.value || '';
  const wrap = document.getElementById('logs-table-wrap');
  if (!wrap) return;
  const rows = await api('/admin/logs?limit=200' + (action ? '&action='+action : ''));
  wrap.innerHTML = rows.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">??</div><p>No logs found.</p></div>' : `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Timestamp</th><th>Action</th><th>User</th><th>Equipment</th><th>Details</th><th>IP</th></tr></thead>
        <tbody>${rows.map(l=>`
          <tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:.78rem;white-space:nowrap">${l.timestamp}</td>
            <td><span class="badge level-${l.action.includes('CANCEL')?'heavily_used':l.action.includes('LOGIN')||l.action.includes('REGISTER')?'moderate':'underutilized'}">${l.action.replace(/_/g,' ')}</span></td>
            <td>
              <div style="font-weight:500">${l.user_name||'System'}</div>
              <div class="text-muted text-sm">${l.user_role||''}</div>
            </td>
            <td>${l.equipment_name||'�'}</td>
            <td class="text-muted text-sm">${l.details||'�'}</td>
            <td class="text-muted text-sm" style="font-family:'JetBrains Mono',monospace">${l.ip_address||'�'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// --- Users (Admin) ------------------------------------------------------------
async function renderUsers(container) {
  const rows = await api('/admin/users');
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Registered Users</h1>
      <p class="page-subtitle">${rows.length} users in the system</p>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Student ID</th><th>Department</th><th>Reservations</th><th>Joined</th></tr></thead>
          <tbody>${rows.map(u=>`
            <tr>
              <td><strong>${u.name}</strong></td>
              <td class="text-muted text-sm">${u.email}</td>
              <td><span class="badge ${u.role==='admin'?'badge-confirmed':'badge-pending'}">${u.role}</span></td>
              <td class="text-sm">${u.student_id||'�'}</td>
              <td class="text-sm">${u.department||'�'}</td>
              <td style="font-weight:600;color:var(--teal)">${u.total_reservations}</td>
              <td class="text-muted text-sm">${fmtDate(u.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// --- Boot ---------------------------------------------------------------------
init();

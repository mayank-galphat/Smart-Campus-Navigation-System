// ════════════════════════════════════════════
// ADMIN PANEL — Side Panel inside Map
// ════════════════════════════════════════════

const API_BASE = 'http://127.0.0.1:5000/api';
const ADMIN_API = `${API_BASE}/admin`;

let adminLoggedIn = false;

// ── Inject CSS ──
(function injectAdminCSS() {
  if (document.getElementById('admin-panel-styles')) return; // Duplicate CSS roko
  const style = document.createElement('style');
  style.id = 'admin-panel-styles';
  style.textContent = `
    #adminToggleBtn { position: fixed; top: 16px; right: 16px; z-index: 2500; background: #0f1b35; color: white; border: none; border-radius: 10px; padding: 10px 18px; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 7px; }
    #adminToggleBtn:hover { background: #1a2d52; }
    #adminPanel { position: fixed; top: 0; right: -420px; width: 400px; height: 100vh; background: #fff; z-index: 2400; box-shadow: -4px 0 24px rgba(0,0,0,0.15); display: flex; flex-direction: column; transition: right 0.3s ease; font-family: 'Outfit', sans-serif; }
    #adminPanel.open { right: 0; }
    .ap-header { background: #0f1b35; color: white; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .ap-header h2 { margin:0; font-size:16px; font-weight:700; }
    .ap-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; line-height: 1; }
    .ap-tabs { display: flex; border-bottom: 2px solid #e2e8f0; flex-shrink: 0; }
    .ap-tab { flex: 1; padding: 11px 4px; text-align: center; font-size: 12px; font-weight: 600; cursor: pointer; color: #64748b; border: none; background: white; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color .2s, border-color .2s; }
    .ap-tab.active { color: #0f1b35; border-bottom-color: #ff6b18; }
    .ap-body { flex: 1; overflow-y: auto; padding: 16px; }
    .ap-login { padding: 32px 24px; }
    .ap-login h3 { margin: 0 0 20px; font-size: 18px; color: #0f1b35; }
    .ap-input { width: 100%; padding: 10px 12px; margin-bottom: 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 14px; box-sizing: border-box; color: #0f172a; }
    .ap-input:focus { outline: none; border-color: #0f1b35; }
    .ap-btn { width: 100%; padding: 11px; background: #0f1b35; color: white; border: none; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 4px; }
    .ap-btn:hover { background: #1a2d52; }
    .ap-btn.danger { background: #dc2626; }
    .ap-btn.danger:hover { background: #b91c1c; }
    .ap-btn.sm { width: auto; padding: 6px 14px; font-size: 12px; border-radius: 8px; margin-top: 0; }
    .ap-btn.outline { background: white; color: #0f1b35; border: 1.5px solid #e2e8f0; }
    .ap-btn.outline:hover { background: #f5f7fa; }
    .ap-msg { padding: 8px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 10px; display: none; }
    .ap-msg.err  { background: #fee2e2; color: #991b1b; display: block; }
    .ap-msg.ok   { background: #dcfce7; color: #166534; display: block; }
    .ap-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 16px 0 10px; }
    .ap-card { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; font-size: 13px; }
    .ap-card-row { display: flex; align-items: center; justify-content: space-between; }
    .ap-card-name { font-weight: 600; color: #0f172a; }
    .ap-card-sub  { color: #64748b; font-size: 12px; margin-top: 2px; }
    .ap-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .ap-mini-form { margin-top: 10px; display: none; }
    .ap-mini-form.open { display: block; }
    .ap-mini-input { width: 100%; padding: 7px 10px; margin-bottom: 7px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: 'Outfit', sans-serif; font-size: 13px; box-sizing: border-box; }
    .ap-mini-input:focus { outline: none; border-color: #0f1b35; }
    .ap-mini-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
    .ap-add-form { background: #f0f4ff; border: 1.5px dashed #c7d2fe; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
    .ap-add-form label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .5px; display: block; margin-bottom: 4px; }
    .ap-logout-bar { padding: 12px 16px; border-top: 1.5px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; font-size: 13px; color: #64748b; }
  `;
  document.head.appendChild(style);
})();

function buildAdminPanel() {
  if (document.getElementById('adminPanel')) document.getElementById('adminPanel').remove();
  if (document.getElementById('adminToggleBtn')) document.getElementById('adminToggleBtn').remove();

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'adminToggleBtn';
  toggleBtn.innerHTML = '🔐 Admin';
  toggleBtn.onclick = () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) checkAdminSession();
  };
  document.body.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.id = 'adminPanel';
  panel.innerHTML = `
    <div class="ap-header">
      <h2>🔐 Admin Panel</h2>
      <button class="ap-close" onclick="document.getElementById('adminPanel').classList.remove('open')">✕</button>
    </div>
    <div id="apLoginSection" class="ap-login">
      <h3>Admin Login</h3>
      <div id="apLoginMsg" class="ap-msg"></div>
      <input id="apUser" class="ap-input" type="text" placeholder="Username" />
      <input id="apPass" class="ap-input" type="password" placeholder="Password" />
      <button class="ap-btn" onclick="adminLogin()">Login →</button>
    </div>
    <div id="apMainSection" style="display:none; flex:1; display:none; flex-direction:column; overflow:hidden;">
      <div class="ap-tabs">
        <button class="ap-tab active" onclick="apSwitchTab('locations',this)">📍 Locations</button>
        <button class="ap-tab"        onclick="apSwitchTab('routes',this)">🗺️ Routes</button>
        <button class="ap-tab"        onclick="apSwitchTab('faculty',this)">👨‍🏫 Faculty</button>
      </div>
      <div class="ap-body" id="apBody"></div>
      <div class="ap-logout-bar">
        <span id="apAdminName">admin</span>
        <button class="ap-btn sm danger" onclick="adminLogout()">Logout</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
}

function checkAdminSession() {
  fetch(`${ADMIN_API}/check`, { credentials: 'include' })
    .then(r => r.json()).then(d => { if (d.logged_in) showAdminMain(d.username); });
}

function adminLogin() {
  const user = document.getElementById('apUser').value.trim();
  const pass = document.getElementById('apPass').value.trim();
  const msg  = document.getElementById('apLoginMsg');

  fetch(`${ADMIN_API}/login`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  })
  .then(r => r.json()).then(d => {
    if (d.success) showAdminMain(d.username);
    else { msg.className = 'ap-msg err'; msg.textContent = d.message || 'Invalid credentials'; }
  });
}

function adminLogout() {
  fetch(`${ADMIN_API}/logout`, { method: 'POST', credentials: 'include' })
    .then(() => {
      adminLoggedIn = false;
      document.getElementById('apMainSection').style.display = 'none';
      document.getElementById('apLoginSection').style.display = 'block';
      document.getElementById('apUser').value = '';
      document.getElementById('apPass').value = '';
    });
}

function showAdminMain(username) {
  adminLoggedIn = true;
  document.getElementById('apLoginSection').style.display  = 'none';
  document.getElementById('apMainSection').style.display = 'flex';
  document.getElementById('apAdminName').textContent = '👤 ' + username;
  apSwitchTab('locations', document.querySelector('.ap-tab'));
}

function apSwitchTab(tab, el) {
  document.querySelectorAll('.ap-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const body = document.getElementById('apBody');
  body.innerHTML = '<div style="color:#64748b;font-size:13px;text-align:center;margin-top:20px;">Loading... ⏳</div>';
  if (tab === 'locations') renderLocationsTab();
  if (tab === 'routes')    renderRoutesTab();
  if (tab === 'faculty')   renderFacultyTab();
}

function renderLocationsTab() {
  fetch(`${API_BASE}/locations`).then(r => r.json()).then(locs => {
      document.getElementById('apBody').innerHTML = `
        <div class="ap-section-title">Add New Location</div>
        <div class="ap-add-form" id="addLocForm">
          <label>Name</label><input class="ap-mini-input" id="newLocName" placeholder="e.g. D Block" />
          <div class="ap-mini-row"><div><label>Latitude</label><input class="ap-mini-input" id="newLocLat" placeholder="22.6210" /></div><div><label>Longitude</label><input class="ap-mini-input" id="newLocLng" placeholder="75.8040" /></div></div>
          <div class="ap-mini-row"><div><label>Icon</label><input class="ap-mini-input" id="newLocIcon" placeholder="🏫" /></div><div><label>Category</label><select class="ap-mini-input" id="newLocCat"><option value="academic">Academic</option><option value="facility">Facility</option><option value="hostel">Hostel</option><option value="entry">Entry</option></select></div></div>
          <label>Page (HTML file)</label><input class="ap-mini-input" id="newLocPage" placeholder="d_block.html" />
          <div id="addLocMsg" class="ap-msg"></div><button class="ap-btn sm" onclick="adminAddLocation()">+ Add Location</button>
        </div>
        <div class="ap-section-title">Existing Locations (${locs.length})</div>
        <div id="locList">${locs.map(l => `<div class="ap-card" id="locCard${l.id}"><div class="ap-card-row"><div><div class="ap-card-name">${l.icon} ${l.name}</div><div class="ap-card-sub">${l.category} · ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</div></div><div class="ap-card-actions"><button class="ap-btn sm outline" onclick="toggleLocEdit(${l.id})">Edit</button><button class="ap-btn sm danger" onclick="adminDeleteLocation(${l.id},'${l.name}')">Del</button></div></div><div class="ap-mini-form" id="locEdit${l.id}"><input class="ap-mini-input" id="leIcon${l.id}" value="${l.icon}" placeholder="Icon" /><input class="ap-mini-input" id="leName${l.id}" value="${l.name}" placeholder="Name" /><div class="ap-mini-row"><input class="ap-mini-input" id="leLat${l.id}" value="${l.lat}" placeholder="Lat" /><input class="ap-mini-input" id="leLng${l.id}" value="${l.lng}" placeholder="Lng" /></div><input class="ap-mini-input" id="lePage${l.id}" value="${l.page}" placeholder="page.html" /><div id="leMsg${l.id}" class="ap-msg"></div><button class="ap-btn sm" onclick="adminUpdateLocation(${l.id})">Save</button></div></div>`).join('')}</div>`;
    });
}
function toggleLocEdit(id) { document.getElementById('locEdit' + id).classList.toggle('open'); }
function adminAddLocation() {
  const msg = document.getElementById('addLocMsg'), data = { name: document.getElementById('newLocName').value.trim(), lat: parseFloat(document.getElementById('newLocLat').value), lng: parseFloat(document.getElementById('newLocLng').value), icon: document.getElementById('newLocIcon').value.trim() || '📍', category: document.getElementById('newLocCat').value, page: document.getElementById('newLocPage').value.trim() };
  if (!data.name || isNaN(data.lat) || isNaN(data.lng)) { msg.className = 'ap-msg err'; msg.textContent = 'Name, Lat, Lng required'; return; }
  fetch(`${ADMIN_API}/locations`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()).then(d => { if (d.error) { msg.className = 'ap-msg err'; msg.textContent = d.error; } else { msg.className = 'ap-msg ok'; msg.textContent = `Added!`; renderLocationsTab(); } });
}
function adminUpdateLocation(id) {
  const msg = document.getElementById('leMsg' + id), data = { name: document.getElementById('leName' + id).value.trim(), lat: parseFloat(document.getElementById('leLat' + id).value), lng: parseFloat(document.getElementById('leLng' + id).value), icon: document.getElementById('leIcon' + id).value.trim(), page: document.getElementById('lePage' + id).value.trim() };
  fetch(`${ADMIN_API}/locations/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()).then(d => { if (d.error) { msg.className = 'ap-msg err'; msg.textContent = d.error; } else { msg.className = 'ap-msg ok'; msg.textContent = 'Updated!'; } });
}
function adminDeleteLocation(id, name) {
  if (!confirm(`Delete "${name}"?`)) return; fetch(`${ADMIN_API}/locations/${id}`, { method: 'DELETE', credentials: 'include' }).then(() => document.getElementById('locCard' + id).remove() );
}

function renderRoutesTab() {
  Promise.all([ fetch(`${API_BASE}/routes`).then(r => r.json()).catch(()=>[]), fetch(`${API_BASE}/locations`).then(r => r.json()).catch(()=>[]) ]).then(([routes, locs]) => {
    const opts = locs.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    document.getElementById('apBody').innerHTML = `<div class="ap-section-title">Add New Route</div><div class="ap-add-form"><div class="ap-mini-row"><div><label>From</label><select class="ap-mini-input" id="newRouteFrom">${opts}</select></div><div><label>To</label><select class="ap-mini-input" id="newRouteTo">${opts}</select></div></div><label>Via (optional label)</label><input class="ap-mini-input" id="newRouteVia" placeholder="e.g. Short Route" /><label>Waypoints (JSON array)</label><textarea class="ap-mini-input" id="newRouteWP" rows="3" placeholder='[[22.620, 75.802],[22.621, 75.803]]'></textarea><div id="addRouteMsg" class="ap-msg"></div><button class="ap-btn sm" onclick="adminAddRoute()">+ Add Route</button></div><div class="ap-section-title">Existing Routes (${routes.length})</div><div id="routeList">${routes.map(r => `<div class="ap-card" id="routeCard${r.id}"><div class="ap-card-row"><div><div class="ap-card-name">${r.from} → ${r.to}</div><div class="ap-card-sub">${r.via ? 'via ' + r.via + ' · ' : ''}${r.waypoints.length} waypoints</div></div><button class="ap-btn sm danger" onclick="adminDeleteRoute(${r.id})">Del</button></div></div>`).join('')}</div>`;
  });
}
function adminAddRoute() {
  const msg = document.getElementById('addRouteMsg'); let waypoints;
  try { waypoints = JSON.parse(document.getElementById('newRouteWP').value); if (!Array.isArray(waypoints) || waypoints.length < 2) throw new Error(); } catch(e) { msg.className = 'ap-msg err'; msg.textContent = 'Invalid waypoints JSON'; return; }
  const data = { from: document.getElementById('newRouteFrom').value, to: document.getElementById('newRouteTo').value, via: document.getElementById('newRouteVia').value.trim() || null, waypoints: waypoints };
  if (data.from === data.to) { msg.className = 'ap-msg err'; msg.textContent = 'From and To cannot be same'; return; }
  fetch(`${ADMIN_API}/routes`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()).then(d => { if (d.error) { msg.className = 'ap-msg err'; msg.textContent = d.error; } else { msg.className = 'ap-msg ok'; msg.textContent = 'Added!'; renderRoutesTab(); } });
}
function adminDeleteRoute(id) { if (!confirm(`Delete Route #${id}?`)) return; fetch(`${ADMIN_API}/routes/${id}`, { method: 'DELETE', credentials: 'include' }).then(() => { document.getElementById('routeCard' + id).remove(); }); }

function renderFacultyTab() {
  fetch(`${API_BASE}/faculty`, { credentials: 'include' }).then(r => r.json()).then(faculty => {
      document.getElementById('apBody').innerHTML = `
        <div class="ap-section-title">Add New Faculty</div>
        <div class="ap-add-form">
          <input class="ap-mini-input" id="newFacName"  placeholder="Full Name (e.g. Mayank)" />
          <div class="ap-mini-row">
            <input class="ap-mini-input" id="newFacDept"  placeholder="Dept (e.g. CSE)" />
            <input class="ap-mini-input" id="newFacEmail" placeholder="email@medicaps.ac.in" />
          </div>
          <div class="ap-mini-row">
            <input class="ap-mini-input" id="newFacBlock" placeholder="Cabin Block (e.g. V Block)" />
            <input class="ap-mini-input" id="newFacRoom"  placeholder="Cabin Room (e.g. 202)" />
          </div>
          <input class="ap-mini-input" id="newFacPass"  type="password" placeholder="Password" />
          <div id="addFacMsg" class="ap-msg"></div>
          <button class="ap-btn sm" onclick="adminAddFaculty()">+ Add Faculty</button>
        </div>
        
        <div class="ap-section-title">Faculty Members (${faculty.length})</div>
        <div id="facList">${faculty.map(f => `
          <div class="ap-card" id="facCard${f.id}">
            <div class="ap-card-row">
              <div>
                <div class="ap-card-name">👨‍🏫 ${f.name}</div>
                <div class="ap-card-sub">${f.department} · ${f.block}, ${f.room}</div>
              </div>
              <div class="ap-card-actions">
                <button class="ap-btn sm outline" onclick="toggleFacTT(${f.id})">🕒 Schedule</button>
                <button class="ap-btn sm outline" onclick="toggleFacEdit(${f.id})">Edit</button>
                <button class="ap-btn sm danger"  onclick="adminDeleteFaculty(${f.id},'${f.name}')">Del</button>
              </div>
            </div>
            
            <div class="ap-mini-form" id="facEdit${f.id}">
              <input class="ap-mini-input" id="feName${f.id}"  value="${f.name}" placeholder="Name" />
              <input class="ap-mini-input" id="feDept${f.id}"  value="${f.department}" placeholder="Dept" />
              <div class="ap-mini-row">
                <input class="ap-mini-input" id="feBlock${f.id}" value="${f.block}" placeholder="Block" />
                <input class="ap-mini-input" id="feRoom${f.id}"  value="${f.room}"  placeholder="Room" />
              </div>
              <div id="feMsg${f.id}" class="ap-msg"></div>
              <button class="ap-btn sm" onclick="adminUpdateFaculty(${f.id})">Save Edit</button>
            </div>
            
            <div class="ap-mini-form" id="facTT${f.id}">
              <div style="font-size:11px; font-weight:bold; margin-bottom:5px; color:#ff6b18;">Add Class Schedule</div>
              <select class="ap-mini-input" id="ttDay${f.id}">
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
              <div class="ap-mini-row">
                <div><label style="font-size:10px;">Start Time</label><input type="time" class="ap-mini-input" id="ttStart${f.id}" /></div>
                <div><label style="font-size:10px;">End Time</label><input type="time" class="ap-mini-input" id="ttEnd${f.id}" /></div>
              </div>
              <div class="ap-mini-row">
                <input class="ap-mini-input" id="ttBlock${f.id}" placeholder="Class Block (e.g. C Block)" />
                <input class="ap-mini-input" id="ttRoom${f.id}" placeholder="Class Room (e.g. 101)" />
              </div>
              <div id="ttMsg${f.id}" class="ap-msg"></div>
              <button class="ap-btn sm" onclick="adminAddTimetable(${f.id})">+ Save Timetable</button>
            </div>
            
          </div>
        `).join('')}</div>
      `;
    });
}
function toggleFacEdit(id) { document.getElementById('facEdit' + id).classList.toggle('open'); }
function adminAddFaculty() {
  const msg = document.getElementById('addFacMsg'), data = { name: document.getElementById('newFacName').value.trim(), department: document.getElementById('newFacDept').value.trim(), email: document.getElementById('newFacEmail').value.trim(), block: document.getElementById('newFacBlock').value.trim(), room: document.getElementById('newFacRoom').value.trim(), password: document.getElementById('newFacPass').value.trim() || 'faculty123' };
  if (!data.name || !data.email) { msg.className = 'ap-msg err'; msg.textContent = 'Name and email required'; return; }
  fetch(`${ADMIN_API}/faculty`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()).then(d => { if (d.error) { msg.className = 'ap-msg err'; msg.textContent = d.error; } else { msg.className = 'ap-msg ok'; msg.textContent = `${d.name} added!`; renderFacultyTab(); } });
}
function adminUpdateFaculty(id) {
  const msg = document.getElementById('feMsg' + id), data = { name: document.getElementById('feName'+id).value.trim(), department: document.getElementById('feDept'+id).value.trim(), block: document.getElementById('feBlock'+id).value.trim(), room: document.getElementById('feRoom'+id).value.trim() };
  fetch(`${ADMIN_API}/faculty/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()).then(d => { if (d.error) { msg.className = 'ap-msg err'; msg.textContent = d.error; } else { msg.className = 'ap-msg ok'; msg.textContent = 'Updated!'; } });
}
function adminDeleteFaculty(id, name) { if (!confirm(`Delete "${name}"?`)) return; fetch(`${ADMIN_API}/faculty/${id}`, { method: 'DELETE', credentials: 'include' }).then(() => { document.getElementById('facCard' + id).remove(); }); }
// --- Timetable Logic for Admin Panel ---

function toggleFacTT(id) { 
  // Agar edit open hai toh use band karo aur timetable form kholo
  document.getElementById('facEdit' + id).classList.remove('open');
  document.getElementById('facTT' + id).classList.toggle('open'); 
}

function adminAddTimetable(id) {
  const msg = document.getElementById('ttMsg' + id);
  const data = {
    day: document.getElementById('ttDay' + id).value,
    start_time: document.getElementById('ttStart' + id).value,
    end_time: document.getElementById('ttEnd' + id).value,
    block: document.getElementById('ttBlock' + id).value.trim(),
    room: document.getElementById('ttRoom' + id).value.trim()
  };

  if (!data.start_time || !data.end_time || !data.block || !data.room) {
    msg.className = 'ap-msg err'; msg.textContent = 'Please fill all fields!';
    return;
  }

  fetch(`${ADMIN_API}/faculty/${id}/timetable`, { 
    method: 'POST', 
    credentials: 'include', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(data) 
  })
  .then(r => r.json())
  .then(d => { 
    if (d.error) { 
      msg.className = 'ap-msg err'; 
      msg.textContent = d.error; 
    } else { 
      msg.className = 'ap-msg ok'; 
      msg.textContent = '✅ Schedule added!'; 
      
      // Fields khali kar do agle use ke liye
      document.getElementById('ttStart' + id).value = '';
      document.getElementById('ttEnd' + id).value = '';
      setTimeout(() => msg.style.display = 'none', 3000);
    } 
  });
}
// ── Init ──
buildAdminPanel();
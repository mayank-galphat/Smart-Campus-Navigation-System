// ── Campus Locations Data (Dynamic from Backend) ──
let campusLocations = [];

var map = L.map('map').setView([22.6213, 75.8040], 17);

var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri'
});
var streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
});

satellite.addTo(map);
L.control.layers({ '🛰️ Satellite': satellite, '🗺️ Street Map': streets }, {}, { position: 'topright' }).addTo(map);

function makeIcon(emoji) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#0f1b35; color:white; border:2px solid #ff6b18; border-radius:50% 50% 50% 0; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:14px; transform:rotate(-45deg); box-shadow:0 2px 8px rgba(0,0,0,0.3);"><span style="transform:rotate(45deg)">${emoji}</span></div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34]
  });
}

function loadLocations() {
  fetch('http://127.0.0.1:5000/api/locations')
    .then(res => res.json())
    .then(data => {
      campusLocations = data;
      campusLocations.forEach(loc => {
        L.marker([loc.lat, loc.lng], { icon: makeIcon(loc.icon) })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:'Outfit',sans-serif; text-align:center; padding:4px 2px;">
              <div style="font-size:22px; margin-bottom:6px">${loc.icon}</div>
              <div style="font-weight:600; font-size:14px; color:#0f1b35">${loc.name}</div>
              <a href="${loc.page}" style="display:inline-block; margin-top:8px; background:#ff6b18; color:white; padding:6px 16px; border-radius:20px; font-size:12px; font-weight:600; text-decoration:none;">View Details →</a>
            </div>
          `);
      });
      buildRouteUI();
    }).catch(err => console.error('Error loading locations:', err));
}

var campusBoundary = [[22.6232, 75.8022], [22.6232, 75.8063], [22.6218, 75.8068], [22.6194, 75.8062], [22.6191, 75.8040], [22.6193, 75.8020], [22.6210, 75.8015]];
var polygon = L.polygon(campusBoundary, { color: "#ff6b18", weight: 2.5, fillColor: "#1a2d52", fillOpacity: 0.08, smoothFactor: 2 }).addTo(map);
polygon.bindPopup("<b style='font-family:Outfit,sans-serif;'>Medicaps University Campus</b>");
polygon.on('mouseover', function () { this.setStyle({ fillOpacity: 0.18 }); });
polygon.on('mouseout',  function () { this.setStyle({ fillOpacity: 0.08 }); });

L.marker([22.6213, 75.8040], { icon: L.divIcon({ className: "campus-label", html: "🎓 Medicaps University" }) }).addTo(map);

// ── Search ──
const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

function hideSuggestions() { suggestions.style.display = "none"; suggestions.innerHTML = ""; }

searchInput.addEventListener("input", function () {
  const query = this.value.toLowerCase().trim();
  if (query.length === 0) { hideSuggestions(); return; }
  const matches = campusLocations.filter(loc => loc.name.toLowerCase().includes(query));
  if (matches.length === 0) { hideSuggestions(); return; }
  suggestions.innerHTML = "";
  matches.forEach(loc => {
    const div = document.createElement("div"); div.className = "suggestion-item";
    div.innerHTML = '<div class="sug-icon">' + loc.icon + '</div><span>' + loc.name + '</span>';
    div.onclick = function () {
      searchInput.value = loc.name; hideSuggestions();
      map.flyTo([loc.lat, loc.lng], 19, { animate: true, duration: 1.2 });
      map.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
          var ll = layer.getLatLng();
          if (Math.abs(ll.lat - loc.lat) < 0.0001 && Math.abs(ll.lng - loc.lng) < 0.0001) layer.openPopup();
        }
      });
    };
    suggestions.appendChild(div);
  });
  suggestions.style.display = "block";
});

document.addEventListener("click", function (e) { if (!e.target.closest(".search-wrapper")) suggestions.style.display = "none"; });

// ════════════════════════════════════════════
// 🔷 DIJKSTRA ROUTING SYSTEM
// ════════════════════════════════════════════
var routeLayers  = [];
var routeMarkers = [];

function buildRouteUI() {
  if (document.getElementById('routePanel')) return;
  var locationNames = campusLocations.map(l => l.name);
  var panel = document.createElement('div');
  panel.id = "routePanel";
  panel.style.cssText = `background:white; border-radius:16px; border:1.5px solid #e2e8f0; box-shadow:0 4px 24px rgba(15,27,53,0.08); padding:16px; margin-top:16px;`;
  panel.innerHTML = `
    <div style="font-family:'Outfit',sans-serif; font-size:13px; font-weight:600; text-transform:uppercase; color:#64748b; margin-bottom:4px;">🔷Shortest Path</div>
    <div style="font-family:'Outfit',sans-serif; font-size:11px; color:#94a3b8; margin-bottom:12px;">getting best path</div>
    <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center; margin-bottom:12px;">
      <select id="routeFrom" style="padding:10px; border-radius:10px; border:1.5px solid #e2e8f0; font-family:'Outfit'; font-size:14px; width:100%;">
        <option value="">From...</option>${locationNames.map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>
      <div style="font-size:18px; color:#94a3b8;">→</div>
      <select id="routeTo" style="padding:10px; border-radius:10px; border:1.5px solid #e2e8f0; font-family:'Outfit'; font-size:14px; width:100%;">
        <option value="">To...</option>${locationNames.map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>
    </div>
    <button onclick="drawRoute()" style="width:100%; padding:11px; background:#0f1b35; color:white; border:none; border-radius:10px; font-family:'Outfit'; font-weight:600; cursor:pointer; font-size:14px;">
      🔷 Find Shortest Path
    </button>
    <div id="routeInfo"     style="display:none; margin-top:12px; padding:12px; background:#f0f7ff; border:1.5px solid #bfdbfe; border-radius:10px; font-family:'Outfit'; font-size:13px;"></div>
    <div id="routeLoading" style="display:none; margin-top:12px; text-align:center; font-family:'Outfit'; font-size:13px; color:#64748b;">
      ⏳ Loading...
    </div>
    <button id="clearRouteBtn" onclick="clearRoute()" style="display:none; margin-top:8px; width:100%; padding:9px; background:white; border:1.5px solid #e2e8f0; border-radius:10px; font-family:'Outfit'; cursor:pointer;">✕ Clear Route</button>
  `;
  document.querySelector('.main-container').appendChild(panel);
}

/**
 * 🔷 Dijkstra Route Drawing
 * Backend se shortest path fetch karo, map pe draw karo.
 */
function drawRoute() {
  var fromName = document.getElementById('routeFrom').value;
  var toName   = document.getElementById('routeTo').value;

  if (!fromName || !toName) { alert('Dono locations select karo.'); return; }
  if (fromName === toName)  { alert('Source aur destination same nahi ho sakte!'); return; }

  clearRoute();

  // Loading state
  document.getElementById('routeLoading').style.display = 'block';
  document.getElementById('routeInfo').style.display    = 'none';

  // 🔷 Dijkstra API call
  fetch(`http://127.0.0.1:5000/api/dijkstra?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('routeLoading').style.display = 'none';

      if (!data.success) {
        // Dijkstra fail — fallback to straight line
        console.warn('Dijkstra failed:', data.message);
        _drawFallbackLine(fromName, toName);
        return;
      }

      // ✅ Dijkstra path mila — map pe draw karo
      var waypoints = data.waypoints;

      // Route polyline — blue, solid
      var polyline = L.polyline(waypoints, {
        color   : '#1e90ff',
        weight  : 6,
        opacity : 0.92,
        lineJoin: 'round',
        lineCap : 'round'
      }).addTo(map);
      routeLayers.push(polyline);

      // Animated dashed overlay (visual effect)
      var dashed = L.polyline(waypoints, {
        color    : '#ffffff',
        weight   : 2,
        opacity  : 0.5,
        dashArray: '8, 12',
        lineJoin : 'round'
      }).addTo(map);
      routeLayers.push(dashed);

      // Start (A) aur End (B) markers
      routeMarkers.push(
        L.marker(waypoints[0],                { icon: _endpointIcon('A', '#16a34a') }).addTo(map),
        L.marker(waypoints[waypoints.length-1],{ icon: _endpointIcon('B', '#dc2626') }).addTo(map)
      );

      // Intermediate junction markers (small dots)
      if (data.path && data.path.length > 2) {
        // junctions ko chhote circle se mark karo (pehle aur aakhri ko skip karo)
        data.path.slice(1, -1).forEach(function(nodeId) {
          if (nodeId.startsWith('jn_')) {
            // Junction node — agar waypoint available hai toh dot dikhao
          }
        });
      }

      // Map ko route ke upar fit karo
      map.fitBounds(L.latLngBounds(waypoints), { padding: [60, 60] });

      // Route info panel update karo
      var pathDisplay = data.path
        .map(n => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))  // snake_case → Title Case
        .join(' → ');

      var infoHTML = `
        <div style="font-weight:700; font-size:14px; color:#0f172a; margin-bottom:8px;">
          🔷 Shortest Path
        </div>
        <div style="color:#1d4ed8; font-size:13px; margin-bottom:10px; font-weight:600;">
          ${fromName} → ${toName}
        </div>
        <div style="display:flex; gap:16px; margin-bottom:10px;">
          <div style="text-align:center; flex:1; background:white; border-radius:8px; padding:8px; border:1px solid #dbeafe;">
            <div style="font-size:18px; font-weight:700; color:#1e90ff;">${data.distance}m</div>
            <div style="font-size:11px; color:#64748b;">Total Distance</div>
          </div>
          <div style="text-align:center; flex:1; background:white; border-radius:8px; padding:8px; border:1px solid #dbeafe;">
            <div style="font-size:18px; font-weight:700; color:#16a34a;">${data.walk_minutes} min</div>
            <div style="font-size:11px; color:#64748b;">Walking Time</div>
          </div>
          <div style="text-align:center; flex:1; background:white; border-radius:8px; padding:8px; border:1px solid #dbeafe;">
            <div style="font-size:18px; font-weight:700; color:#8b5cf6;">${data.path.length}</div>
            <div style="font-size:11px; color:#64748b;">Turns</div>
          </div>
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:6px; line-height:1.6;">
          
        </div>
        <div style="margin-top:8px; font-size:10px; color:#94a3b8; background:#f8fafc; padding:6px; border-radius:6px;">
           Shortest Path 
        </div>
      `;

      document.getElementById('routeInfo').style.display    = 'block';
      document.getElementById('routeInfo').innerHTML        = infoHTML;
      document.getElementById('clearRouteBtn').style.display = 'block';
    })
    .catch(err => {
      document.getElementById('routeLoading').style.display = 'none';
      console.error('Dijkstra API error:', err);
      _drawFallbackLine(fromName, toName);
    });
}

/**
 * Fallback — Dijkstra API available nahi toh straight line dikhao
 */
function _drawFallbackLine(fromName, toName) {
  var fromLoc = campusLocations.find(l => l.name === fromName);
  var toLoc   = campusLocations.find(l => l.name === toName);
  if (!fromLoc || !toLoc) { alert('Location data missing!'); return; }

  var wps  = [[fromLoc.lat, fromLoc.lng], [toLoc.lat, toLoc.lng]];
  var dist = Math.round(L.latLng(wps[0]).distanceTo(L.latLng(wps[1])));

  routeLayers.push(L.polyline(wps, { color:'#dc2626', weight:5, opacity:0.85, dashArray:'8,6' }).addTo(map));
  routeMarkers.push(
    L.marker(wps[0], { icon: _endpointIcon('A', '#16a34a') }).addTo(map),
    L.marker(wps[1], { icon: _endpointIcon('B', '#dc2626') }).addTo(map)
  );
  map.fitBounds(L.latLngBounds(wps), { padding: [60, 60] });

  document.getElementById('routeInfo').style.display = 'block';
  document.getElementById('routeInfo').innerHTML = `
    <div style="font-weight:600; color:#dc2626; margin-bottom:6px;">⚠️ Direct Line ( unavailable)</div>
    <div>${fromName} → ${toName}</div>
    <div style="margin-top:6px;">📏 ~${dist}m | 🚶 ~${Math.ceil(dist/80)} min</div>
  `;
  document.getElementById('clearRouteBtn').style.display = 'block';
}

function _endpointIcon(letter, bgColor) {
  return L.divIcon({
    className: 'animated-marker',
    html: `<div style="background:${bgColor}; color:white; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; border:3px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.35);">${letter}</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15]
  });
}

function clearRoute() {
  routeLayers.forEach(l  => map.removeLayer(l));  routeLayers  = [];
  routeMarkers.forEach(m => map.removeLayer(m)); routeMarkers = [];
  document.getElementById('routeInfo').style.display     = 'none';
  document.getElementById('routeLoading').style.display  = 'none';
  document.getElementById('clearRouteBtn').style.display = 'none';
}

// ════════════════════════════════════════════
// 👨‍🏫 FACULTY DIRECTORY LOGIC
// ════════════════════════════════════════════
function openFacultyModal() {
  document.getElementById('facultyModal').style.display = 'flex';
  loadFacultyData();
}

function closeFacultyModal() {
  document.getElementById('facultyModal').style.display = 'none';
}

function loadFacultyData() {
  const listContainer = document.getElementById('facultyList');
  listContainer.innerHTML = '<p style="text-align: center; color: #64748b; margin-top: 20px;">Fetching live schedule... ⏳</p>';

  fetch('http://127.0.0.1:5000/api/faculty')
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) { listContainer.innerHTML = '<p style="text-align: center; color: #64748b; margin-top: 20px;">No faculty data available.</p>'; return; }
      let html = '';
      data.forEach(fac => {
        html += `
          <div class="fac-card">
            <div class="fac-info">
              <h4>${fac.name}</h4>
              <p>${fac.department} Department</p>
              <p style="font-size: 11px; margin-top: 6px; color: #0f1b35; font-weight: 600;">${fac.status}</p>
              <p style="font-size: 11px; color: #f59e0b; margin-top: 4px; font-weight: 600;">🗓️ ${fac.next_schedule}</p>
            </div>
            <div class="fac-loc">
              📍 ${fac.display_block}<br>
              <span style="font-size:11px; opacity: 0.9; font-weight: 500;">${fac.display_room}</span>
            </div>
          </div>
        `;
      });
      listContainer.innerHTML = html;
    }).catch(() => { listContainer.innerHTML = '<p style="text-align: center; color: #dc2626; margin-top: 20px;">❌ Error loading data.</p>'; });
}

document.getElementById('facultyModal').addEventListener('click', function(e) { if (e.target === this) closeFacultyModal(); });

// Init Map
loadLocations();
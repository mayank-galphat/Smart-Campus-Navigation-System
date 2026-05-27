from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import json
import os
import datetime
import heapq   # ✅ Dijkstra ke liye
import math    # ✅ Haversine distance ke liye

app = Flask(__name__, static_folder='.')
CORS(app, supports_credentials=True)

# ════════════════════════════════════════════
# Config
# ════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'campus.db').replace('\\', '/')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'campus_nav_secret_2024'

db = SQLAlchemy(app)

# ════════════════════════════════════════════
# 🗺️ Campus Graph — Dijkstra ke liye load karo
# ════════════════════════════════════════════
GRAPH_FILE = os.path.join(BASE_DIR, 'graph.json')
campus_graph = {'nodes': {}, 'edges': []}
try:
    with open(GRAPH_FILE, 'r', encoding='utf-8') as f:
        campus_graph = json.load(f)
    print(f"  ✅ Campus Graph loaded: {len(campus_graph['nodes'])} nodes, {len(campus_graph['edges'])} edges")
except Exception as e:
    print(f"  ⚠️ graph.json load nahi hua: {e}")


def haversine(lat1, lon1, lat2, lon2):
    """Do coordinates ke beech ka distance meters mein (Haversine formula)."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi   = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_adjacency_list(graph):
    """
    Graph ke edges se adjacency list banao.
    Har edge bidirectional hai.
    Structure: adj[node] = [(neighbor, distance_m, waypoints), ...]
    """
    adj = {node: [] for node in graph['nodes']}
    for edge in graph['edges']:
        fr  = edge['from']
        to  = edge['to']
        wps = edge.get('waypoints', [])
        if 'distance' in edge and edge['distance']:
            dist = float(edge['distance'])
        else:
            n_fr = graph['nodes'].get(fr, {})
            n_to = graph['nodes'].get(to, {})
            dist = haversine(n_fr['lat'], n_fr['lng'], n_to['lat'], n_to['lng'])
        if fr in adj:
            adj[fr].append((to, dist, wps))
        if to in adj:
            adj[to].append((fr, dist, list(reversed(wps))))
    return adj


def dijkstra(adj, start, end):
    """
    Dijkstra's Shortest Path Algorithm.
    Returns: (node_path, total_dist_meters, waypoints_list)
    """
    heap = [(0.0, start)]
    dist_map = {start: 0.0}
    prev_node = {start: None}
    prev_edge_wps = {}
    visited = set()

    while heap:
        cost, node = heapq.heappop(heap)
        if node in visited:
            continue
        visited.add(node)
        if node == end:
            break
        for neighbor, edge_dist, wps in adj.get(node, []):
            new_cost = cost + edge_dist
            if neighbor not in dist_map or new_cost < dist_map[neighbor]:
                dist_map[neighbor] = new_cost
                prev_node[neighbor] = node
                prev_edge_wps[(node, neighbor)] = wps
                heapq.heappush(heap, (new_cost, neighbor))

    if end not in prev_node and end != start:
        return None, float('inf'), []

    # Path reconstruct
    path = []
    current = end
    while current is not None:
        path.append(current)
        current = prev_node.get(current)
    path.reverse()

    # Waypoints chain karo
    all_waypoints = []
    for i in range(len(path) - 1):
        edge_wps = prev_edge_wps.get((path[i], path[i + 1]), [])
        if i == 0:
            all_waypoints.extend(edge_wps)
        else:
            all_waypoints.extend(edge_wps[1:] if edge_wps else [])

    # Fallback: agar waypoints nahi mile
    if not all_waypoints:
        nodes = campus_graph['nodes']
        all_waypoints = [[nodes[n]['lat'], nodes[n]['lng']] for n in path if n in nodes]

    return path, dist_map.get(end, float('inf')), all_waypoints


def name_to_node_id(name: str) -> str:
    """'Main Gate' → 'main_gate', 'A Block' → 'a_block'"""
    return name.strip().lower().replace(' ', '_')


# ════════════════════════════════════════════
# Models
# ════════════════════════════════════════════
class Location(db.Model):
    __tablename__ = 'location'
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(100), nullable=False, unique=True)
    lat      = db.Column(db.Float, nullable=False)
    lng      = db.Column(db.Float, nullable=False)
    icon     = db.Column(db.String(10))
    page     = db.Column(db.String(100))
    category = db.Column(db.String(50))
    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'lat': self.lat, 'lng': self.lng,
                'icon': self.icon, 'page': self.page, 'category': self.category}

class Route(db.Model):
    __tablename__ = 'route'
    id        = db.Column(db.Integer, primary_key=True)
    from_loc  = db.Column(db.String(100), nullable=False)
    to_loc    = db.Column(db.String(100), nullable=False)
    via       = db.Column(db.String(100), nullable=True)
    waypoints = db.Column(db.Text, nullable=False)
    def to_dict(self):
        return {'id': self.id, 'from': self.from_loc, 'to': self.to_loc,
                'via': self.via, 'waypoints': json.loads(self.waypoints)}

class Faculty(db.Model):
    __tablename__ = 'faculty'
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100))
    email      = db.Column(db.String(100), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    block      = db.Column(db.String(50))
    room       = db.Column(db.String(50))
    is_active  = db.Column(db.Boolean, default=True)
    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'department': self.department,
                'block': self.block, 'room': self.room, 'email': self.email}

class Timetable(db.Model):
    __tablename__ = 'timetable'
    id         = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer, nullable=False)
    day        = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.String(10), nullable=False)
    end_time   = db.Column(db.String(10), nullable=False)
    block      = db.Column(db.String(50), nullable=False)
    room       = db.Column(db.String(50), nullable=False)

class Admin(db.Model):
    __tablename__ = 'admin'
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class User(db.Model):
    __tablename__ = 'user'
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(100), nullable=False)
    email    = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return jsonify({'error': 'Unauthorized. Admin login required.'}), 401
        return f(*args, **kwargs)
    return decorated

# ════════════════════════════════════════════
# Serve Frontend
# ════════════════════════════════════════════
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# ════════════════════════════════════════════
# Public APIs
# ════════════════════════════════════════════
@app.route('/api/user/login', methods=['POST'])
def user_login():
    data = request.json
    user = User.query.filter_by(email=data.get('email'), password=data.get('password')).first()
    if user: return jsonify({'success': True, 'name': user.name})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/user/signup', methods=['POST'])
def user_signup():
    data = request.json
    name, email, password = data.get('name'), data.get('email'), data.get('password')
    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'All fields are required!'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already exists!'}), 409
    db.session.add(User(name=name, email=email, password=password))
    db.session.commit()
    return jsonify({'success': True, 'message': 'Account created successfully!'})

@app.route('/api/locations', methods=['GET'])
def get_locations():
    return jsonify([l.to_dict() for l in Location.query.all()])

@app.route('/api/routes', methods=['GET'])
def get_routes():
    from_loc, to_loc = request.args.get('from'), request.args.get('to')
    query = Route.query
    if from_loc and to_loc:
        query = query.filter(db.or_(
            db.and_(Route.from_loc == from_loc, Route.to_loc == to_loc),
            db.and_(Route.from_loc == to_loc,   Route.to_loc == from_loc)
        ))
    return jsonify([r.to_dict() for r in query.all()])


# ════════════════════════════════════════════
# 🔷 DIJKSTRA SHORTEST PATH API  ← NEW
# ════════════════════════════════════════════
@app.route('/api/dijkstra', methods=['GET'])
def dijkstra_route():
    """
    Campus ke do locations ke beech shortest path Dijkstra se nikalo.

    GET /api/dijkstra?from=Main Gate&to=A Block

    Response:
      {
        "success"    : true,
        "from"       : "Main Gate",
        "to"         : "A Block",
        "path"       : ["main_gate", "jn_8", "jn_2", "a_block"],
        "waypoints"  : [[22.620473, 75.802431], ...],
        "distance"   : 342,
        "walk_minutes": 5
      }
    """
    from_name = request.args.get('from', '').strip()
    to_name   = request.args.get('to',   '').strip()

    if not from_name or not to_name:
        return jsonify({'success': False, 'message': "'from' aur 'to' dono required hain."}), 400
    if from_name == to_name:
        return jsonify({'success': False, 'message': 'Source aur destination same nahi ho sakte!'}), 400

    nodes = campus_graph.get('nodes', {})
    if not nodes:
        return jsonify({'success': False, 'message': 'Campus graph load nahi hua. graph.json check karo.'}), 500

    from_node = name_to_node_id(from_name)
    to_node   = name_to_node_id(to_name)

    if from_node not in nodes:
        return jsonify({'success': False, 'message': f"'{from_name}' graph mein nahi mila (node: {from_node})"}), 404
    if to_node not in nodes:
        return jsonify({'success': False, 'message': f"'{to_name}' graph mein nahi mila (node: {to_node})"}), 404

    adj = build_adjacency_list(campus_graph)
    node_path, total_dist, waypoints = dijkstra(adj, from_node, to_node)

    if node_path is None:
        return jsonify({'success': False, 'message': f"'{from_name}' se '{to_name}' tak koi rasta nahi mila."}), 404

    return jsonify({
        'success'     : True,
        'from'        : from_name,
        'to'          : to_name,
        'path'        : node_path,
        'waypoints'   : waypoints,
        'distance'    : round(total_dist),
        'walk_minutes': math.ceil(total_dist / 80)
    })


# ════════════════════════════════════════════
# Admin APIs (Faculty)
# ════════════════════════════════════════════
@app.route('/api/admin/faculty', methods=['POST'])
@admin_required
def admin_add_faculty():
    data = request.json
    if Faculty.query.filter_by(email=data.get('email')).first():
        return jsonify({'error': 'Faculty with this email already exists!'})
    db.session.add(Faculty(name=data.get('name'), department=data.get('department'),
        email=data.get('email'), password=data.get('password', 'faculty123'),
        block=data.get('block'), room=data.get('room'), is_active=True))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/faculty/<int:id>', methods=['PUT'])
@admin_required
def admin_update_faculty(id):
    f = Faculty.query.get(id)
    if not f: return jsonify({'error': 'Faculty not found'})
    data = request.json
    f.name, f.department, f.block, f.room = (data.get('name', f.name), data.get('department', f.department),
                                              data.get('block', f.block), data.get('room', f.room))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/faculty/<int:faculty_id>/timetable', methods=['POST'])
@admin_required
def admin_add_timetable(faculty_id):
    data = request.json
    if not Faculty.query.get(faculty_id): return jsonify({'error': 'Faculty not found!'}), 404
    db.session.add(Timetable(faculty_id=faculty_id, day=data.get('day'),
        start_time=data.get('start_time'), end_time=data.get('end_time'),
        block=data.get('block'), room=data.get('room')))
    db.session.commit()
    return jsonify({'success': True, 'message': 'Schedule added!'})

@app.route('/api/admin/faculty/<int:id>', methods=['DELETE'])
@admin_required
def admin_delete_faculty(id):
    f = Faculty.query.get(id)
    if not f: return jsonify({'error': 'Faculty not found'})
    db.session.delete(f); db.session.commit()
    return jsonify({'success': True})

# ════════════════════════════════════════════
# Admin APIs (Locations)
# ════════════════════════════════════════════
@app.route('/api/admin/locations', methods=['POST'])
@admin_required
def admin_add_location():
    data = request.json
    if Location.query.filter_by(name=data.get('name')).first():
        return jsonify({'error': 'Location with this name already exists!'}), 400
    db.session.add(Location(name=data.get('name'), lat=data.get('lat'), lng=data.get('lng'),
        icon=data.get('icon', '📍'), category=data.get('category'), page=data.get('page')))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/locations/<int:id>', methods=['PUT'])
@admin_required
def admin_update_location(id):
    loc = Location.query.get(id)
    if not loc: return jsonify({'error': 'Location not found'}), 404
    data = request.json
    loc.name, loc.lat, loc.lng, loc.icon, loc.page = (data.get('name', loc.name), data.get('lat', loc.lat),
        data.get('lng', loc.lng), data.get('icon', loc.icon), data.get('page', loc.page))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/locations/<int:id>', methods=['DELETE'])
@admin_required
def admin_delete_location(id):
    loc = Location.query.get(id)
    if not loc: return jsonify({'error': 'Location not found'}), 404
    db.session.delete(loc); db.session.commit()
    return jsonify({'success': True})

# ════════════════════════════════════════════
# Admin APIs (Routes)
# ════════════════════════════════════════════
@app.route('/api/admin/routes', methods=['POST'])
@admin_required
def admin_add_route():
    data = request.json
    db.session.add(Route(from_loc=data.get('from'), to_loc=data.get('to'),
        via=data.get('via'), waypoints=json.dumps(data.get('waypoints'))))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/routes/<int:id>', methods=['DELETE'])
@admin_required
def admin_delete_route(id):
    r = Route.query.get(id)
    if not r: return jsonify({'error': 'Route not found'}), 404
    db.session.delete(r); db.session.commit()
    return jsonify({'success': True})

# ════════════════════════════════════════════
# Faculty APIs
# ════════════════════════════════════════════
@app.route('/api/faculty', methods=['GET'])
def get_faculty():
    now = datetime.datetime.now()
    current_day, current_time = now.strftime('%A'), now.strftime('%H:%M')
    result = []
    for f in Faculty.query.filter_by(is_active=True).all():
        fd = f.to_dict()
        if f.block == 'On Leave':
            fd.update({'display_block': 'Off Campus', 'display_room': '-', 'status': '🔴 On Leave'})
        else:
            tt = Timetable.query.filter(Timetable.faculty_id == f.id, Timetable.day == current_day,
                Timetable.start_time <= current_time, Timetable.end_time >= current_time).first()
            if tt:
                fd.update({'display_block': tt.block, 'display_room': tt.room, 'status': f'🟢 In Lecture (till {tt.end_time})'})
            else:
                fd.update({'display_block': f.block, 'display_room': f.room, 'status': '🔵 Available in Cabin'})
        nxt = Timetable.query.filter(Timetable.faculty_id == f.id, Timetable.day == current_day,
            Timetable.start_time > current_time).order_by(Timetable.start_time.asc()).first()
        fd['next_schedule'] = (f"Upcoming: {nxt.block} ({nxt.room}) at {nxt.start_time}" if nxt else "No more classes today")
        result.append(fd)
    return jsonify(result)

@app.route('/api/faculty/login', methods=['POST'])
def faculty_login():
    data = request.json
    f = Faculty.query.filter_by(email=data.get('email'), password=data.get('password'), is_active=True).first()
    if f: return jsonify({'success': True, 'faculty': f.to_dict()})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/faculty/location', methods=['POST'])
def update_faculty_location():
    data = request.json
    f = Faculty.query.get(data.get('id'))
    if not f: return jsonify({'success': False}), 404
    f.block, f.room = data.get('block', f.block), data.get('room', f.room)
    db.session.commit()
    return jsonify({'success': True, 'faculty': f.to_dict()})

# ════════════════════════════════════════════
# Admin Auth APIs
# ════════════════════════════════════════════
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    a = Admin.query.filter_by(username=data.get('username'), password=data.get('password')).first()
    if a:
        session['admin_logged_in'] = True
        session['admin_username']  = a.username
        return jsonify({'success': True, 'username': a.username})
    return jsonify({'success': False, 'message': 'Invalid admin credentials'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/admin/check', methods=['GET'])
def admin_check():
    return jsonify({'logged_in': session.get('admin_logged_in', False), 'username': session.get('admin_username', '')})

# ════════════════════════════════════════════
# ML Traffic Predictor
# ════════════════════════════════════════════
@app.route('/api/ml/traffic', methods=['GET'])
def predict_traffic():
    now = datetime.datetime.now()
    h, d, tw = now.hour, now.strftime('%A'), {}
    if d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
        if 12 <= h <= 14:   tw = {'Main Canteen': 3.5, 'CKD': 2.0}
        elif 8 <= h <= 10:  tw = {'Main Gate': 2.5, 'A Block': 2.0, 'C Block': 2.0}
        elif 16 <= h <= 18: tw = {'Main Gate': 3.0, 'Faculty Building': 1.5}
    return jsonify({'success': True, 'weights': tw})

# ════════════════════════════════════════════
# Seed Database
# ════════════════════════════════════════════
def seed_database():
    if Location.query.count() == 0:
        db.session.add_all([
            Location(name="Main Gate",        lat=22.620474, lng=75.802443, icon="🚪", page="main_gate.html",        category="entry"),
            Location(name="Admission Cell",   lat=22.621097, lng=75.803978, icon="📋", page="admission_cell.html",   category="facility"),
            Location(name="A Block",          lat=22.620222, lng=75.804389, icon="🏫", page="a_block.html",          category="academic"),
            Location(name="B Block",          lat=22.619903, lng=75.804470, icon="🏫", page="b_block.html",          category="academic"),
            Location(name="C Block",          lat=22.619602, lng=75.804189, icon="🏫", page="c_block.html",          category="academic"),
            Location(name="F Block",          lat=22.620562, lng=75.803281, icon="🏫", page="f_block.html",          category="academic"),
            Location(name="M Block",          lat=22.622306, lng=75.804583, icon="🏫", page="m_block.html",          category="academic"),
            Location(name="N Block",          lat=22.622913, lng=75.804489, icon="🏫", page="n_block.html",          category="academic"),
            Location(name="O Block",          lat=22.621722, lng=75.805028, icon="🏫", page="o_block.html",          category="academic"),
            Location(name="Q Block",          lat=22.621361, lng=75.804361, icon="🏫", page="q_block.html",          category="academic"),
            Location(name="S Block",          lat=22.621073, lng=75.805504, icon="🏫", page="s_block.html",          category="academic"),
            Location(name="V Block",          lat=22.622111, lng=75.805222, icon="🏫", page="v_block.html",          category="academic"),
            Location(name="Main Library",     lat=22.621229, lng=75.803757, icon="📚", page="main_library.html",     category="facility"),
            Location(name="Main Canteen",     lat=22.621557, lng=75.804093, icon="🍽️", page="main_canteen.html",    category="facility"),
            Location(name="Boys Hostel",      lat=22.621919, lng=75.802445, icon="🏠", page="boys_hostel.html",      category="hostel"),
            Location(name="Girls Hostel",     lat=22.621542, lng=75.805978, icon="🏠", page="girls_hostel.html",     category="hostel"),
            Location(name="Cricket Ground",   lat=22.621041, lng=75.802366, icon="🏏", page="cricket_ground.html",   category="facility"),
            Location(name="CKD",              lat=22.622256, lng=75.802746, icon="🏛️", page="ckd.html",             category="facility"),
            Location(name="Faculty Building", lat=22.622031, lng=75.803129, icon="👨‍🏫", page="faculty_building.html", category="facility"),
        ])
        print("  ✅ Seeded 19 Locations")

    if Route.query.count() == 0:
        routes_file = os.path.join(BASE_DIR, 'routes.json')
        try:
            with open(routes_file, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            routes_to_add = [Route(from_loc=r['from'], to_loc=r['to'], via=r.get('via'), waypoints=json.dumps(r['waypoints'])) for r in data.get('routes', [])]
            db.session.add_all(routes_to_add)
            print(f"  ✅ {len(routes_to_add)} Routes seeded")
        except Exception as e:
            print(f"  ⚠️ routes.json error: {e}. Loading fallback routes...")
            for r in [
                {"from": "Main Gate", "to": "F Block",      "waypoints": [[22.620473, 75.802431],[22.621083, 75.802833],[22.620705, 75.803678]]},
                {"from": "Main Gate", "to": "Main Library", "waypoints": [[22.620473, 75.802431],[22.621328, 75.803059],[22.621135, 75.803477]]},
                {"from": "Main Gate", "to": "A Block",      "waypoints": [[22.620473, 75.802431],[22.621016, 75.80288],[22.620269, 75.804755],[22.620234, 75.804515]]},
            ]: db.session.add(Route(from_loc=r['from'], to_loc=r['to'], waypoints=json.dumps(r['waypoints'])))

    if Faculty.query.count() == 0:
        db.session.add_all([
            Faculty(name="Dr. A. Sharma", department="CSE", email="sharma@medicaps.ac.in", password="faculty123", block="Faculty Building", room="Cabin 101"),
            Faculty(name="Prof. B. Verma", department="IT",  email="verma@medicaps.ac.in",  password="faculty123", block="Faculty Building", room="Cabin 105"),
        ])
        for d in ['Monday','Tuesday','Wednesday','Thursday','Friday']:
            db.session.add_all([
                Timetable(faculty_id=1, day=d, start_time="08:30", end_time="09:20", block="C Block", room="Room 201"),
                Timetable(faculty_id=1, day=d, start_time="10:20", end_time="11:10", block="F Block", room="Lab 3"),
                Timetable(faculty_id=1, day=d, start_time="12:50", end_time="13:40", block="A Block", room="Room 105"),
                Timetable(faculty_id=1, day=d, start_time="15:10", end_time="16:00", block="M Block", room="Room 402"),
                Timetable(faculty_id=2, day=d, start_time="09:20", end_time="10:10", block="A Block", room="Room 102"),
                Timetable(faculty_id=2, day=d, start_time="12:00", end_time="12:50", block="C Block", room="Lab 1"),
                Timetable(faculty_id=2, day=d, start_time="14:20", end_time="15:10", block="F Block", room="Room 305"),
            ])
        print("  ✅ Seeded Faculty + Timetable")

    if Admin.query.count() == 0:
        db.session.add(Admin(username='admin', password='admin123'))
    if User.query.count() == 0:
        db.session.add(User(name="Rahul Student", email="student@medicaps.ac.in", password="student123"))

    db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    print("\n✅ Smart Campus Navigation — Backend Ready")
    print("   🔷 Dijkstra API: GET /api/dijkstra?from=Main Gate&to=A Block")

app.run(debug=True, port=5000)
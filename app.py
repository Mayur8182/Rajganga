# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from flask import Flask, request, session, jsonify, render_template, redirect, send_from_directory, send_file
from pymongo import MongoClient, DESCENDING
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from bson import ObjectId
import os, math, random, string, datetime
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'hostel_raj_ganga_secret_2024_xk9')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

MONGO_URI = os.environ.get(
    'MONGO_URI',
    'mongodb+srv://mkbharvad8080:Mkb%408080@cluster0.a82h2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
)
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000, tls=True, tlsAllowInvalidCertificates=False)
    client.admin.command('ping')   # test connection
    print('[DB] Connected to MongoDB Atlas')
except Exception as e:
    print(f'[DB] Atlas connection failed: {e}  -- falling back to localhost')
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
db = client['hostel_raj_ganga']

users_col      = db['users']
students_col   = db['students']
attendance_col = db['attendance']
gate_logs_col  = db['gate_logs']
leaves_col     = db['leaves']
settings_col   = db['settings']

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# ── Helpers ────────────────────────────────────────────────────────────────

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def gen_username(count):
    return f"STU{count:03d}"

def gen_password(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def ist_now():
    tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    return datetime.datetime.now(tz).replace(tzinfo=None)

def ist_date():
    tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    return datetime.datetime.now(tz).date().isoformat()

def fix_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    doc['_id'] = str(doc['_id'])
    for k, v in doc.items():
        if isinstance(v, datetime.datetime):
            doc[k] = v.strftime('%Y-%m-%dT%H:%M:%S')
    return doc

def check_geofence(lat, lon):
    # Allow local testing on desktop without strict geofence blocking
    if request.remote_addr == '127.0.0.1':
        return True, 0.0

    cfg = settings_col.find_one({'key': 'geofence'})
    if not cfg or not cfg.get('enabled'):
        return True, 0.0
    hlat, hlon = cfg.get('lat'), cfg.get('lon')
    if hlat is None or hlon is None:
        return True, 0.0
    
    # Strict validation of coordinate values
    try:
        lat_f = float(lat)
        lon_f = float(lon)
        # Coordinates must not be exactly 0 (default location errors or mock defaults)
        if abs(lat_f) < 0.0001 or abs(lon_f) < 0.0001:
            return False, 999999.0
        # Check standard reasonable ranges for India / globally
        if not (-90 <= lat_f <= 90) or not (-180 <= lon_f <= 180):
            return False, 999999.0
    except (ValueError, TypeError):
        return False, 999999.0

    dist = haversine(lat_f, lon_f, hlat, hlon)
    return dist <= cfg.get('radius', 50), dist


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Please login'}), 401
        return f(*args, **kwargs)
    return decorated

# ── DB Init ────────────────────────────────────────────────────────────────

def init_db():
    if not users_col.find_one({'username': 'admin'}):
        users_col.insert_one({
            'username': 'admin',
            'password': generate_password_hash('admin@123'),
            'role': 'admin',
            'name': 'Administrator',
            'created_at': ist_now()
        })
        print("✅ Admin created: username=admin  password=admin@123")

# ── Page Routes ────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect('/admin' if session.get('role') == 'admin' else '/student')
    return render_template('login.html')

@app.route('/admin')
def admin_page():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect('/')
    return render_template('admin.html')

@app.route('/student')
def student_page():
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect('/')
    return render_template('student.html')

# ── Auth API ───────────────────────────────────────────────────────────────

@app.route('/api/login', methods=['POST'])
def api_login():
    d = request.get_json()
    user = users_col.find_one({'username': d.get('username', '').strip()})
    if not user or not check_password_hash(user['password'], d.get('password', '')):
        return jsonify({'error': 'Invalid username or password'}), 401
    session.clear()
    session['user_id']  = str(user['_id'])
    session['username'] = user['username']
    session['role']     = user['role']
    session['name']     = user.get('name', user['username'])
    if user['role'] == 'student':
        session['student_id'] = user.get('student_id', '')
    return jsonify({'success': True, 'role': user['role'], 'name': session['name'],
                    'redirect': '/admin' if user['role'] == 'admin' else '/student'})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
@login_required
def api_me():
    data = {k: session[k] for k in ('user_id','username','role','name') if k in session}
    if session.get('role') == 'student' and session.get('student_id'):
        try:
            s = students_col.find_one({'_id': ObjectId(session['student_id'])})
            if s:
                data['photo']         = s.get('photo', '')
                data['room']          = s.get('room', '')
                data['course']        = s.get('course', '')
                data['phone']         = s.get('phone', '')
                data['village']       = s.get('village', '')
                data['college']       = s.get('college', '')
                data['hostel_number'] = s.get('hostel_number', '')
                data['year']          = s.get('year', '')
                data['roll_number']   = s.get('roll_number', '')
                data['email']         = s.get('email', '')
        except:
            pass
    return jsonify(data)

@app.route('/api/register', methods=['POST'])
def api_register():
    """Allows students to self-register from the portal."""
    name          = request.form.get('name', '').strip()
    username      = request.form.get('username', '').strip()
    roll_number   = request.form.get('roll_number', '').strip()
    room          = request.form.get('room', '').strip()
    phone         = request.form.get('phone', '').strip()
    email         = request.form.get('email', '').strip()
    password      = request.form.get('password', '').strip()
    hostel_number = request.form.get('hostel_number', '').strip()
    year          = request.form.get('year', '').strip()

    if not name or not username or not roll_number or not phone or not password or not room:
        return jsonify({'error': 'Name, Username, Roll Number, Room Number, Phone, and Password are required'}), 400

    if students_col.find_one({'roll_number': roll_number}):
        return jsonify({'error': 'A student with this Roll Number is already registered'}), 400

    if users_col.find_one({'username': username}) or students_col.find_one({'username': username}):
        return jsonify({'error': 'This username is already taken, please choose another one'}), 400

    photo_url = None
    if 'photo' in request.files:
        f = request.files['photo']
        if f and f.filename and allowed_file(f.filename):
            ext = f.filename.rsplit('.', 1)[1].lower()
            fname = f"{username}_{int(datetime.datetime.utcnow().timestamp())}.{ext}"
            f.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
            photo_url = f"/static/uploads/{fname}"

    student_doc = {
        'name': name, 'roll_number': roll_number, 'room': room, 'phone': phone,
        'email': email,
        'hostel_number': hostel_number, 'year': year,
        'username': username, 'photo': photo_url,
        'active': True, 'created_at': ist_now()
    }
    result = students_col.insert_one(student_doc)
    sid = str(result.inserted_id)

    users_col.insert_one({
        'username': username,
        'password': generate_password_hash(password),
        'role': 'student', 'name': name,
        'student_id': sid, 'created_at': ist_now()
    })
    return jsonify({'success': True, 'username': username, 'name': name})

@app.route('/api/admin/reports/pdf', methods=['GET'])
@admin_required
def generate_pdf_report():
    """Generates a professional PDF report of student details or attendance."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas
    import io

    report_type = request.args.get('type', 'students') # 'students' or 'attendance'
    date_str    = request.args.get('date', ist_date())

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    styles = getSampleStyleSheet()
    
    def on_page(canvas, doc):
        canvas.saveState()
        img_path = os.path.join(app.root_path, 'static', 'hostel.png')
        if os.path.exists(img_path):
            canvas.drawImage(img_path, 36, letter[1] - 80, width=50, height=50)
        canvas.setFont('Helvetica', 9)
        canvas.drawString(letter[0]/2.0, 20, "Page %d" % doc.page)
        canvas.restoreState()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        alignment=1, # Center
        spaceAfter=15
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=25
    )
    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.white
    )
    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )

    # Title
    story.append(Paragraph("Raj Ganga Gopalak Chatralaya", title_style))
    
    if report_type == 'attendance':
        td_style_absent = ParagraphStyle(
            'TableCellAbsent',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#dc2626')
        )
        td_style_present = ParagraphStyle(
            'TableCellPresent',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=11,
            textColor=colors.HexColor('#16a34a')
        )

        story.append(Paragraph(f"Daily Attendance Report - Date: {date_str}", subtitle_style))
        students = list(students_col.find({'active': True}).sort([('roll_number', 1), ('name', 1)]))
        records  = {r['student_id']: r for r in attendance_col.find({'date': date_str})}
        
        data = [[
            Paragraph("No.", th_style),
            Paragraph("Name", th_style),
            Paragraph("Roll No", th_style),
            Paragraph("Room", th_style),
            Paragraph("Status", th_style),
            Paragraph("Time", th_style)
        ]]
        
        for i, s in enumerate(students, 1):
            sid = str(s['_id'])
            att = records.get(sid, {})
            status_val = att.get('status', 'absent')
            status_txt = status_val.upper()
            
            p_style = td_style_absent if status_val == 'absent' else (td_style_present if status_val == 'present' else td_style)

            marked_at = att.get('marked_at', '—')
            if marked_at != '—':
                if isinstance(marked_at, datetime.datetime):
                    marked_at = marked_at.strftime('%I:%M %p')
                else:
                    # try to parse if it's a string
                    try:
                        # might be YYYY-MM-DDTHH:MM:SS or HH:MM or HH:MM:SS
                        if 'T' in marked_at:
                            dt = datetime.datetime.fromisoformat(marked_at.split('.')[0])
                            marked_at = dt.strftime('%I:%M %p')
                        elif ':' in marked_at:
                            parts = marked_at.split(':')
                            dt = datetime.datetime.strptime(f"{parts[0]}:{parts[1]}", '%H:%M')
                            marked_at = dt.strftime('%I:%M %p')
                    except:
                        pass
            
            data.append([
                Paragraph(str(i), td_style),
                Paragraph(s['name'], td_style),
                Paragraph(s.get('roll_number', '—'), td_style),
                Paragraph(s.get('room', '—'), td_style),
                Paragraph(status_txt, p_style),
                Paragraph(str(marked_at), td_style)
            ])
            
        col_widths = [40, 160, 80, 60, 90, 110]
    else:
        story.append(Paragraph("All Registered Students Details Report", subtitle_style))
        students = list(students_col.find({'active': True}).sort('name', 1))
        
        data = [[
            Paragraph("Name", th_style),
            Paragraph("Username", th_style),
            Paragraph("Roll No", th_style),
            Paragraph("Room", th_style),
            Paragraph("Phone", th_style),
            Paragraph("Email", th_style),
            Paragraph("College", th_style)
        ]]
        
        for s in students:
            data.append([
                Paragraph(s['name'], td_style),
                Paragraph(s['username'], td_style),
                Paragraph(s.get('roll_number', '—'), td_style),
                Paragraph(s.get('room', '—'), td_style),
                Paragraph(s.get('phone', '—'), td_style),
                Paragraph(s.get('email', '—'), td_style),
                Paragraph(s.get('college', '—'), td_style)
            ])
            
        col_widths = [130, 60, 60, 40, 70, 90, 90]

    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    buffer.seek(0)
    
    filename = f"attendance_report_{date_str}.pdf" if report_type == 'attendance' else "students_report.pdf"
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/pdf'
    )



# ── Students API ───────────────────────────────────────────────────────────

@app.route('/api/admin/students', methods=['GET'])
@admin_required
def get_students():
    students = list(students_col.find({'active': True}).sort('created_at', DESCENDING))
    return jsonify([fix_doc(s) for s in students])

@app.route('/api/admin/students', methods=['POST'])
@admin_required
def add_student():
    name          = request.form.get('name', '').strip()
    roll_number   = request.form.get('roll_number', '').strip()
    room          = request.form.get('room', '').strip()
    course        = request.form.get('course', '').strip()
    phone         = request.form.get('phone', '').strip()
    email         = request.form.get('email', '').strip()
    village       = request.form.get('village', '').strip()
    college       = request.form.get('college', '').strip()
    hostel_number = request.form.get('hostel_number', '').strip()
    year          = request.form.get('year', '').strip()
    
    # support dynamic extra fields
    extra_fields = {}
    for k, v in request.form.items():
        if k not in ['name', 'roll_number', 'room', 'course', 'phone', 'email', 'village', 'college', 'hostel_number', 'year', 'photo']:
            extra_fields[k] = v.strip()

    if not name:
        return jsonify({'error': 'Student name is required'}), 400

    count = students_col.count_documents({}) + 1
    username = gen_username(count)
    while users_col.find_one({'username': username}):
        count += 1
        username = gen_username(count)
    password = gen_password()

    photo_url = None
    if 'photo' in request.files:
        f = request.files['photo']
        if f and f.filename and allowed_file(f.filename):
            ext = f.filename.rsplit('.', 1)[1].lower()
            fname = f"{username}_{int(datetime.datetime.utcnow().timestamp())}.{ext}"
            f.save(os.path.join(app.config['UPLOAD_FOLDER'], fname))
            photo_url = f"/static/uploads/{fname}"

    student_doc = {
        'name': name, 'roll_number': roll_number, 'room': room, 'course': course,
        'phone': phone, 'email': email, 'village': village, 'college': college,
        'hostel_number': hostel_number, 'year': year,
        'username': username, 'photo': photo_url,
        'extra_fields': extra_fields,
        'active': True, 'created_at': ist_now()
    }
    result = students_col.insert_one(student_doc)
    sid = str(result.inserted_id)

    users_col.insert_one({
        'username': username,
        'password': generate_password_hash(password),
        'role': 'student', 'name': name,
        'student_id': sid, 'created_at': ist_now()
    })
    return jsonify({'success': True, 'student_id': sid, 'username': username,
                    'password': password, 'name': name})



@app.route('/api/admin/students/bulk-import', methods=['POST'])
@admin_required
def bulk_import_students():
    """Import multiple students from a JSON list in one request."""
    data     = request.get_json()
    raw_list = data.get('students', [])
    results  = []
    errors   = []
    for item in raw_list:
        name   = (item.get('name') or '').strip()
        if not name:
            continue
        room   = (item.get('room')   or '').strip()
        course = (item.get('course') or '').strip()
        phone  = (item.get('phone')  or '').strip()
        try:
            count    = students_col.count_documents({}) + 1
            username = gen_username(count)
            while users_col.find_one({'username': username}):
                count   += 1
                username = gen_username(count)
            password    = gen_password()
            student_doc = {
                'name': name, 'room': room, 'course': course, 'phone': phone,
                'username': username, 'photo': None,
                'active': True, 'created_at': ist_now()
            }
            res = students_col.insert_one(student_doc)
            sid = str(res.inserted_id)
            users_col.insert_one({
                'username': username,
                'password': generate_password_hash(password),
                'role': 'student', 'name': name,
                'student_id': sid, 'created_at': ist_now()
            })
            results.append({
                'name': name, 'room': room, 'course': course,
                'phone': phone, 'username': username, 'password': password
            })
        except Exception as e:
            errors.append({'name': name, 'error': str(e)})
    return jsonify({'success': True, 'count': len(results),
                    'students': results, 'errors': errors})

@app.route('/api/admin/students/<sid>', methods=['DELETE'])
@admin_required
def delete_student(sid):
    try:
        s = students_col.find_one({'_id': ObjectId(sid)})
        if not s:
            return jsonify({'error': 'Student not found'}), 404
        
        # Hard delete student
        students_col.delete_one({'_id': ObjectId(sid)})
        
        # Delete user credentials
        if 'username' in s:
            users_col.delete_one({'username': s['username']})
        
        # Delete associated records (attendance, gate_logs, leaves)
        if 'roll_number' in s:
            attendance_col.delete_many({'roll_number': s['roll_number']})
            gate_logs_col.delete_many({'roll_number': s['roll_number']})
            leaves_col.delete_many({'roll_number': s['roll_number']})
            
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/students/<sid>/reset-password', methods=['POST'])
@admin_required
def reset_password(sid):
    try:
        s = students_col.find_one({'_id': ObjectId(sid)})
        if not s:
            return jsonify({'error': 'Not found'}), 404
        new_pass = gen_password()
        users_col.update_one({'username': s['username']},
                             {'$set': {'password': generate_password_hash(new_pass)}})
        return jsonify({'success': True, 'password': new_pass, 'username': s['username']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Attendance API ─────────────────────────────────────────────────────────

@app.route('/api/admin/attendance')
@admin_required
def admin_get_attendance():
    date = request.args.get('date', ist_date())
    students = list(students_col.find({'active': True}))
    records  = {r['student_id']: r for r in attendance_col.find({'date': date})}
    result = []
    for s in students:
        sid = str(s['_id'])
        att = records.get(sid, {})
        ma = att.get('marked_at', '')
        result.append({
            'student_id': sid, 'name': s['name'], 'room': s.get('room',''),
            'photo': s.get('photo',''), 'username': s.get('username',''),
            'status': att.get('status', 'absent'),
            'marked_at': ma.strftime('%H:%M') if isinstance(ma, datetime.datetime) else (ma[11:16] if ma else ''),
            'marked_by': att.get('marked_by','')
        })
    return jsonify(result)

@app.route('/api/admin/attendance', methods=['POST'])
@admin_required
def admin_mark_attendance():
    d = request.get_json()
    date = d.get('date', ist_date())
    attendance_col.update_one(
        {'student_id': d['student_id'], 'date': date},
        {'$set': {'student_id': d['student_id'], 'date': date,
                  'status': d.get('status','present'),
                  'marked_at': ist_now(), 'marked_by': 'admin'}},
        upsert=True)
    return jsonify({'success': True})

@app.route('/api/student/attendance/mark', methods=['POST'])
@login_required
def student_mark():
    if session.get('role') != 'student':
        return jsonify({'error': 'Student only'}), 403
    d = request.get_json()
    sid   = session['student_id']
    today = ist_date()
    existing = attendance_col.find_one({'student_id': sid, 'date': today})
    if existing:
        if existing.get('status') == 'present':
            return jsonify({'error': 'Attendance already marked for today!', 'already_marked': True}), 400
        if existing.get('status') == 'leave':
            return jsonify({'error': 'You are on approved leave today.', 'on_leave': True}), 400
    attendance_col.update_one(
        {'student_id': sid, 'date': today},
        {'$set': {'student_id': sid, 'date': today, 'status': 'present',
                  'marked_at': ist_now(), 'marked_by': 'student'}},
        upsert=True)
    return jsonify({'success': True, 'message': 'Attendance marked successfully!'})

@app.route('/api/student/attendance')
@login_required
def student_attendance():
    sid   = session.get('student_id','')
    month = request.args.get('month', ist_date()[:7])
    records = list(attendance_col.find({'student_id': sid, 'date': {'$regex': f'^{month}'}}))
    return jsonify([fix_doc(r) for r in records])

@app.route('/api/admin/attendance/monthly')
@admin_required
def attendance_monthly():
    month    = request.args.get('month', ist_date()[:7])
    students = list(students_col.find({'active': True}))
    records  = list(attendance_col.find({'date': {'$regex': f'^{month}'}}))
    by_sid   = {}
    for r in records:
        sid = r['student_id']
        by_sid.setdefault(sid, {'present': 0, 'absent': 0, 'leave': 0})
        by_sid[sid][r.get('status','absent')] = by_sid[sid].get(r.get('status','absent'), 0) + 1
    result = []
    for s in students:
        sid  = str(s['_id'])
        summ = by_sid.get(sid, {'present': 0, 'leave': 0})
        result.append({'student_id': sid, 'name': s['name'], 'room': s.get('room',''),
                       'photo': s.get('photo',''), **summ})
    return jsonify(result)

# ── Gate API ───────────────────────────────────────────────────────────────

@app.route('/api/gate', methods=['POST'])
@login_required
def gate_action():
    if session.get('role') != 'student':
        return jsonify({'error': 'Student only'}), 403
    d = request.get_json()
    action = d.get('action')
    reason = d.get('reason', '')
    sid  = session['student_id']
    last = gate_logs_col.find_one({'student_id': sid}, sort=[('timestamp', DESCENDING)])
    if action == 'out':
        if last and last.get('action') == 'out' and not last.get('return_time'):
            return jsonify({'error': 'You are already marked OUT. Mark IN first.'}), 400
        gate_logs_col.insert_one({
            'student_id': sid, 'student_name': session['name'],
            'action': 'out', 'reason': reason,
            'timestamp': ist_now(), 'return_time': None
        })
        return jsonify({'success': True, 'message': 'Marked OUT. Please return before curfew!'})
    elif action == 'in':
        if not last or last.get('action') == 'in' or last.get('return_time'):
            return jsonify({'error': 'You are already marked IN.'}), 400
        gate_logs_col.update_one({'_id': last['_id']}, {'$set': {'return_time': ist_now()}})
        gate_logs_col.insert_one({
            'student_id': sid, 'student_name': session['name'],
            'action': 'in', 'timestamp': ist_now()
        })
        return jsonify({'success': True, 'message': 'Welcome back! Marked IN.'})
    return jsonify({'error': 'Invalid action'}), 400

@app.route('/api/student/gate-status')
@login_required
def gate_status():
    sid  = session.get('student_id', '')
    last = gate_logs_col.find_one({'student_id': sid}, sort=[('timestamp', DESCENDING)])
    if not last:
        return jsonify({'status': 'in'})
    status = 'out' if (last.get('action') == 'out' and not last.get('return_time')) else 'in'
    ts = last['timestamp'].strftime('%d %b %Y %H:%M') if isinstance(last.get('timestamp'), datetime.datetime) else ''
    return jsonify({'status': status, 'last_action': last.get('action'), 'last_time': ts})

@app.route('/api/student/gate-logs')
@login_required
def student_gate_logs():
    sid  = session.get('student_id','')
    logs = list(gate_logs_col.find({'student_id': sid}).sort('timestamp', DESCENDING).limit(30))
    return jsonify([fix_doc(l) for l in logs])

@app.route('/api/admin/gate-logs')
@admin_required
def admin_gate_logs():
    date = request.args.get('date', ist_date())
    try:
        start = datetime.datetime.strptime(date, '%Y-%m-%d')
        end   = start + datetime.timedelta(days=1)
        logs  = list(gate_logs_col.find({'timestamp': {'$gte': start, '$lt': end}}).sort('timestamp', DESCENDING))
        return jsonify([fix_doc(l) for l in logs])
    except:
        return jsonify([])

@app.route('/api/admin/currently-out')
@admin_required
def currently_out():
    pipeline = [
        {'$sort': {'timestamp': -1}},
        {'$group': {'_id': '$student_id', 'doc': {'$first': '$$ROOT'}}}
    ]
    results = list(gate_logs_col.aggregate(pipeline))
    out = []
    for r in results:
        doc = r['doc']
        if doc.get('action') == 'out' and not doc.get('return_time'):
            out.append(fix_doc(doc))
    return jsonify(out)

# ── Leaves API ─────────────────────────────────────────────────────────────

@app.route('/api/student/leaves', methods=['GET'])
@login_required
def student_leaves():
    sid    = session.get('student_id','')
    leaves = list(leaves_col.find({'student_id': sid}).sort('created_at', DESCENDING))
    return jsonify([fix_doc(l) for l in leaves])

@app.route('/api/student/leaves', methods=['POST'])
@login_required
def apply_leave():
    if session.get('role') != 'student':
        return jsonify({'error': 'Student only'}), 403
    d         = request.get_json()
    from_date = d.get('from_date','').strip()
    to_date   = d.get('to_date','').strip()
    reason    = d.get('reason','').strip()
    if not from_date or not to_date or not reason:
        return jsonify({'error': 'All fields are required'}), 400
    leaves_col.insert_one({
        'student_id': session['student_id'],
        'student_name': session['name'],
        'from_date': from_date, 'to_date': to_date, 'reason': reason,
        'status': 'pending', 'created_at': ist_now()
    })
    return jsonify({'success': True, 'message': 'Leave application submitted!'})

@app.route('/api/admin/leaves')
@admin_required
def admin_leaves():
    status = request.args.get('status','')
    q      = {'status': status} if status else {}
    leaves = list(leaves_col.find(q).sort('created_at', DESCENDING))
    return jsonify([fix_doc(l) for l in leaves])

@app.route('/api/admin/leaves/<lid>', methods=['PUT'])
@admin_required
def review_leave(lid):
    d      = request.get_json()
    status = d.get('status')
    if status not in ['approved','rejected']:
        return jsonify({'error': 'Invalid status'}), 400
    leaves_col.update_one({'_id': ObjectId(lid)},
                          {'$set': {'status': status, 'reviewed_at': ist_now(),
                                    'reviewed_by': session['name']}})
    if status == 'approved':
        leave = leaves_col.find_one({'_id': ObjectId(lid)})
        if leave:
            try:
                fd = datetime.datetime.strptime(leave['from_date'], '%Y-%m-%d').date()
                td = datetime.datetime.strptime(leave['to_date'], '%Y-%m-%d').date()
                cur = fd
                while cur <= td:
                    attendance_col.update_one(
                        {'student_id': leave['student_id'], 'date': cur.isoformat()},
                        {'$set': {'student_id': leave['student_id'], 'date': cur.isoformat(),
                                  'status': 'leave', 'marked_at': ist_now(), 'marked_by': 'leave'}},
                        upsert=True)
                    cur += datetime.timedelta(days=1)
            except:
                pass
    return jsonify({'success': True})

# ── Settings API ───────────────────────────────────────────────────────────

@app.route('/api/admin/settings')
@admin_required
def get_settings():
    cfg = settings_col.find_one({'key': 'geofence'})
    if not cfg:
        return jsonify({'enabled': False, 'lat': None, 'lon': None, 'radius': 100,
                        'hostel_name': 'Raj Ganga Gopalak Chatralaya'})
    return jsonify(fix_doc(cfg))

@app.route('/api/admin/settings', methods=['PUT'])
@admin_required
def save_settings():
    d = request.get_json()
    settings_col.update_one(
        {'key': 'geofence'},
        {'$set': {'key': 'geofence', 'enabled': d.get('enabled', False),
                  'lat': d.get('lat'), 'lon': d.get('lon'),
                  'radius': d.get('radius', 100),
                  'hostel_name': d.get('hostel_name','Raj Ganga Gopalak Chatralaya'),
                  'updated_at': ist_now()}},
        upsert=True)
    return jsonify({'success': True})

# ── Dashboard Stats ────────────────────────────────────────────────────────

@app.route('/api/admin/stats')
@admin_required
def admin_stats():
    today    = ist_date()
    total    = students_col.count_documents({'active': True})
    present  = attendance_col.count_documents({'date': today, 'status': 'present'})
    on_leave = attendance_col.count_documents({'date': today, 'status': 'leave'})
    pipeline = [
        {'$sort': {'timestamp': -1}},
        {'$group': {'_id': '$student_id', 'action': {'$first': '$action'},
                    'return_time': {'$first': '$return_time'}}}
    ]
    agg       = list(gate_logs_col.aggregate(pipeline))
    out_count = sum(1 for r in agg if r.get('action') == 'out' and not r.get('return_time'))
    pending   = leaves_col.count_documents({'status': 'pending'})
    return jsonify({
        'total': total, 'present': present,
        'absent': max(0, total - present - on_leave),
        'on_leave': on_leave, 'currently_out': out_count,
        'pending_leaves': pending
    })

@app.route('/api/student/stats')
@login_required
def student_stats():
    sid   = session.get('student_id','')
    today = ist_date()
    month = today[:7]
    att_today = attendance_col.find_one({'student_id': sid, 'date': today})
    present_count = attendance_col.count_documents({'student_id': sid, 'date': {'$regex': f'^{month}'}, 'status': 'present'})
    leave_count   = attendance_col.count_documents({'student_id': sid, 'date': {'$regex': f'^{month}'}, 'status': 'leave'})
    return jsonify({
        'today_status': att_today.get('status','absent') if att_today else 'absent',
        'month_present': present_count,
        'month_leave': leave_count
    })

@app.route('/api/admin/gate_log/<log_id>', methods=['DELETE'])
@admin_required
def delete_gate_log(log_id):
    try:
        gate_logs_col.delete_one({'_id': ObjectId(log_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/leave/<leave_id>', methods=['DELETE'])
@admin_required
def delete_leave(leave_id):
    try:
        leaves_col.delete_one({'_id': ObjectId(leave_id)})
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000, host='0.0.0.0')

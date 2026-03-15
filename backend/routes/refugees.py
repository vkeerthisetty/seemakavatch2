from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
import datetime, random, string

refugees_bp = Blueprint('refugees', __name__)

def _gen_id():
    return f"REF-{datetime.datetime.utcnow().year}-{''.join(random.choices(string.digits,k=4))}"

def _best_ngo(conn, health, family_size, criminal):
    try:
        if criminal:
            r = conn.execute("SELECT name FROM ngos WHERE specialization='legal' AND assigned_count<capacity LIMIT 1").fetchone()
            if r: return r['name']
        if health in ('critical','injured'):
            r = conn.execute("SELECT name FROM ngos WHERE specialization='medical' AND assigned_count<capacity LIMIT 1").fetchone()
            if r: return r['name']
        if int(family_size or 1) >= 4:
            r = conn.execute("SELECT name FROM ngos WHERE specialization='family' AND assigned_count<capacity LIMIT 1").fetchone()
            if r: return r['name']
        r = conn.execute("SELECT name FROM ngos WHERE assigned_count<capacity ORDER BY (capacity-assigned_count) DESC LIMIT 1").fetchone()
        if r: return r['name']
        r = conn.execute("SELECT name FROM ngos LIMIT 1").fetchone()
        if r: return r['name']
    except: pass
    return 'UNHCR India'

def _do_register(data, registered_by):
    try:
        name    = str(data.get('name') or '').strip()
        if not name:
            return None, 'Name is required'
        temp_id  = _gen_id()
        now      = datetime.datetime.utcnow().isoformat()
        is_crim  = bool(data.get('criminal_flag') or data.get('criminal_record'))
        health   = str(data.get('health_condition') or 'stable').lower()
        family   = int(data.get('family_size') or data.get('family_members') or 1)
        age      = int(data.get('age') or 0)
        origin   = str(data.get('country_of_origin') or data.get('origin_country') or '')
        checkpoint = str(data.get('entry_checkpoint') or '')
        biometric  = str(data.get('biometric_notes') or data.get('biometric_id') or '')
        dob        = str(data.get('dob') or '')

        conn = get_db()
        ngo = str(data.get('assigned_ngo') or '').strip() or _best_ngo(conn, health, family, is_crim)

        conn.execute(
            '''INSERT INTO refugees
               (temp_id,name,country_of_origin,dob,entry_checkpoint,assigned_ngo,
                criminal_flag,biometric_notes,registered_by,registered_at,status,
                health_condition,family_size,age)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (temp_id,name,origin,dob,checkpoint,ngo,
             1 if is_crim else 0,biometric,registered_by,now,'active',health,family,age)
        )
        conn.execute(
            'INSERT INTO ngo_requests (refugee_temp_id,refugee_name,ngo_name,status,requested_at,attempt_number) VALUES (?,?,?,?,?,?)',
            (temp_id,name,ngo,'PENDING',now,1)
        )
        conn.execute('UPDATE ngos SET assigned_count=assigned_count+1 WHERE name=?',(ngo,))
        if is_crim:
            conn.execute(
                'INSERT INTO bsf_alerts (refugee_temp_id,refugee_name,origin,alert_type,reported_by,status,created_at) VALUES (?,?,?,?,?,?,?)',
                (temp_id,name,origin,'criminal_suspected',registered_by,'pending',now)
            )
        conn.commit()
        conn.close()
        return {'temp_id':temp_id,'status':'registered','assigned_ngo':ngo}, None
    except Exception as ex:
        return None, str(ex)

@refugees_bp.route('/', methods=['GET'])
@jwt_required()
def list_refugees():
    if get_identity().get('role') not in ('ngo','officer','mea'):
        return jsonify({'error':'Unauthorized'}), 403
    conn = get_db()
    rows = [dict(r) for r in conn.execute('SELECT * FROM refugees ORDER BY registered_at DESC').fetchall()]
    conn.close()
    return jsonify(rows)

@refugees_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    identity = get_identity()
    if identity.get('role') not in ('ngo','officer'):
        return jsonify({'error':'Unauthorized'}), 403
    result, err = _do_register(request.get_json(force=True), identity['user_id'])
    if err: return jsonify({'error':err}), 400
    return jsonify(result), 201

@refugees_bp.route('/register_refugee', methods=['POST'])
@jwt_required()
def register_alias():
    identity = get_identity()
    if identity.get('role') not in ('ngo','officer'):
        return jsonify({'error':'Unauthorized'}), 403
    result, err = _do_register(request.get_json(force=True), identity['user_id'])
    if err: return jsonify({'error':err}), 400
    return jsonify(result), 201

@refugees_bp.route('/bsf-alert/<temp_id>', methods=['POST'])
@jwt_required()
def bsf_alert(temp_id):
    identity = get_identity()
    conn = get_db()
    row = conn.execute('SELECT * FROM refugees WHERE temp_id=?',(temp_id,)).fetchone()
    if not row:
        conn.close(); return jsonify({'error':'Not found'}), 404
    now = datetime.datetime.utcnow().isoformat()
    conn.execute('UPDATE refugees SET criminal_flag=1 WHERE temp_id=?',(temp_id,))
    conn.execute('INSERT INTO bsf_alerts (refugee_temp_id,refugee_name,origin,alert_type,reported_by,status,created_at) VALUES (?,?,?,?,?,?,?)',
        (temp_id,row['name'],row['country_of_origin'],'criminal_suspected',identity['user_id'],'pending',now))
    conn.commit(); conn.close()
    return jsonify({'status':'alert_sent'})

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
import datetime

ngo_bp = Blueprint('ngo', __name__)

@ngo_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    if get_identity().get('role') not in ('ngo','officer','mea'):
        return jsonify({'error':'Unauthorized'}), 403
    conn = get_db()
    ngos = [dict(r) for r in conn.execute('SELECT * FROM ngos').fetchall()]
    for n in ngos:
        n['refugee_count']    = conn.execute("SELECT COUNT(*) FROM refugees WHERE assigned_ngo=?",(n['name'],)).fetchone()[0]
        n['flagged_count']    = conn.execute("SELECT COUNT(*) FROM refugees WHERE assigned_ngo=? AND criminal_flag=1",(n['name'],)).fetchone()[0]
        n['pending_requests'] = conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE ngo_name=? AND status='PENDING'",(n['name'],)).fetchone()[0]
        n['available_slots']  = max(0, n['capacity'] - n.get('assigned_count',0))
    conn.close()
    return jsonify(ngos)

@ngo_bp.route('/requests', methods=['GET'])
@jwt_required()
def get_requests():
    identity = get_identity()
    role = identity.get('role')
    conn = get_db()
    if role == 'ngo':
        worker = conn.execute('SELECT ngo_name FROM ngo_workers WHERE ngo_id=?',(identity['user_id'],)).fetchone()
        if not worker:
            conn.close(); return jsonify([])
        rows = conn.execute(
            '''SELECT nr.*,r.country_of_origin,r.age,r.health_condition,
                      r.family_size,r.criminal_flag,r.dob,r.entry_checkpoint
               FROM ngo_requests nr
               LEFT JOIN refugees r ON r.temp_id=nr.refugee_temp_id
               WHERE nr.ngo_name=? ORDER BY nr.requested_at DESC''',
            (worker['ngo_name'],)
        ).fetchall()
    else:
        rows = conn.execute(
            '''SELECT nr.*,r.country_of_origin,r.age,r.health_condition,r.family_size,r.criminal_flag
               FROM ngo_requests nr
               LEFT JOIN refugees r ON r.temp_id=nr.refugee_temp_id
               ORDER BY nr.requested_at DESC LIMIT 100'''
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@ngo_bp.route('/accept/<int:req_id>', methods=['POST'])
@jwt_required()
def accept_request(req_id):
    if get_identity().get('role') != 'ngo':
        return jsonify({'error':'NGO workers only'}), 403
    conn = get_db()
    req = conn.execute('SELECT * FROM ngo_requests WHERE id=?',(req_id,)).fetchone()
    if not req:
        conn.close(); return jsonify({'error':'Not found'}), 404
    if req['status'] != 'PENDING':
        conn.close(); return jsonify({'error':f'Already {req["status"]}'}), 400
    now = datetime.datetime.utcnow().isoformat()
    conn.execute("UPDATE ngo_requests SET status='ACCEPTED',responded_at=? WHERE id=?",(now,req_id))
    conn.execute("UPDATE refugees SET assigned_ngo=?,status='active' WHERE temp_id=?",(req['ngo_name'],req['refugee_temp_id']))
    conn.execute("UPDATE ngos SET assigned_count=assigned_count+1 WHERE name=?",(req['ngo_name'],))
    conn.commit(); conn.close()
    return jsonify({'status':'accepted','ngo':req['ngo_name']})

@ngo_bp.route('/reject/<int:req_id>', methods=['POST'])
@jwt_required()
def reject_request(req_id):
    if get_identity().get('role') != 'ngo':
        return jsonify({'error':'NGO workers only'}), 403
    data = request.get_json(force=True)
    conn = get_db()
    req = conn.execute('SELECT * FROM ngo_requests WHERE id=?',(req_id,)).fetchone()
    if not req:
        conn.close(); return jsonify({'error':'Not found'}), 404
    if req['status'] != 'PENDING':
        conn.close(); return jsonify({'error':f'Already {req["status"]}'}), 400
    now = datetime.datetime.utcnow().isoformat()
    conn.execute("UPDATE ngo_requests SET status='REJECTED',responded_at=?,notes=? WHERE id=?",(now,data.get('reason',''),req_id))
    next_ngo = conn.execute(
        "SELECT name FROM ngos WHERE name!=? AND assigned_count<capacity ORDER BY (capacity-assigned_count) DESC LIMIT 1",
        (req['ngo_name'],)
    ).fetchone()
    new_id = None
    if next_ngo:
        conn.execute(
            'INSERT INTO ngo_requests (refugee_temp_id,refugee_name,ngo_name,status,requested_at,attempt_number) VALUES (?,?,?,?,?,?)',
            (req['refugee_temp_id'],req['refugee_name'],next_ngo['name'],'PENDING',now,req['attempt_number']+1)
        )
        conn.execute("UPDATE refugees SET assigned_ngo=? WHERE temp_id=?",(next_ngo['name'],req['refugee_temp_id']))
        new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.commit(); conn.close()
    resp = {'status':'rejected'}
    if next_ngo: resp['forwarded_to'] = next_ngo['name']; resp['new_request_id'] = new_id
    return jsonify(resp)

@ngo_bp.route('/statistics', methods=['GET'])
@jwt_required()
def statistics():
    if get_identity().get('role') not in ('officer','ngo','mea'):
        return jsonify({'error':'Unauthorized'}), 403
    conn = get_db()
    result = {
        'total_refugees':   conn.execute("SELECT COUNT(*) FROM refugees").fetchone()[0],
        'pending_requests': conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE status='PENDING'").fetchone()[0],
        'accepted_requests':conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE status='ACCEPTED'").fetchone()[0],
        'rejected_requests':conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE status='REJECTED'").fetchone()[0],
        'flagged_refugees': conn.execute("SELECT COUNT(*) FROM refugees WHERE criminal_flag=1").fetchone()[0],
    }
    conn.close()
    return jsonify(result)

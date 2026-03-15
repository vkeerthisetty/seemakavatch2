"""
Offline sync endpoint.
POST /api/sync/offline  — accepts batched offline records and upserts them.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
import datetime, json

sync_bp = Blueprint('sync', __name__)


@sync_bp.route('/offline', methods=['POST'])
@jwt_required()
def sync_offline():
    identity = get_identity()
    if identity.get('role') != 'officer':
        return jsonify({'error': 'Officers only'}), 403

    data = request.get_json(force=True)
    scan_logs     = data.get('scan_logs', [])
    refugees      = data.get('refugees', [])
    ngo_requests  = data.get('ngo_requests', [])
    verif_results = data.get('verification_results', [])

    conn = get_db()
    now  = datetime.datetime.utcnow().isoformat()
    synced_counts = {'scan_logs': 0, 'refugees': 0, 'ngo_requests': 0, 'verif_results': 0}

    for log in scan_logs:
        exists = conn.execute(
            'SELECT id FROM scan_logs WHERE border_id=? AND timestamp=?',
            (log.get('border_id',''), log.get('timestamp',''))
        ).fetchone()
        if not exists:
            conn.execute(
                '''INSERT INTO scan_logs
                   (border_id,passport_number,traveller_name,officer_id,result,flag,timestamp,synced)
                   VALUES (?,?,?,?,?,?,?,1)''',
                (log.get('border_id'), log.get('passport_number'), log.get('traveller_name'),
                 identity['user_id'], log.get('result'), log.get('flag'), log.get('timestamp', now))
            )
            synced_counts['scan_logs'] += 1

    for ref in refugees:
        exists = conn.execute(
            'SELECT id FROM refugees WHERE temp_id=?', (ref.get('temp_id',''),)
        ).fetchone()
        if not exists:
            conn.execute(
                '''INSERT INTO refugees
                   (temp_id,name,country_of_origin,dob,entry_checkpoint,assigned_ngo,
                    criminal_flag,biometric_notes,registered_by,registered_at,status,
                    health_condition,family_size,age)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                (ref.get('temp_id'), ref.get('name'), ref.get('country_of_origin'),
                 ref.get('dob'), ref.get('entry_checkpoint'), ref.get('assigned_ngo', ''),
                 1 if ref.get('criminal_flag') else 0, ref.get('biometric_notes', ''),
                 identity['user_id'], ref.get('registered_at', now), 'active',
                 ref.get('health_condition', 'stable'), ref.get('family_size', 1), ref.get('age', 0))
            )
            synced_counts['refugees'] += 1
        else:
            # Merge — update status and ngo if changed
            conn.execute(
                '''UPDATE refugees SET assigned_ngo=?, status=?
                   WHERE temp_id=?''',
                (ref.get('assigned_ngo'), ref.get('status', 'active'), ref.get('temp_id'))
            )

    for ngo_req in ngo_requests:
        conn.execute(
            '''INSERT INTO ngo_requests
               (refugee_temp_id,refugee_name,ngo_name,status,requested_at,attempt_number)
               VALUES (?,?,?,?,?,?)''',
            (ngo_req.get('refugee_temp_id'), ngo_req.get('refugee_name'),
             ngo_req.get('ngo_name'), 'PENDING', ngo_req.get('requested_at', now), 1)
        )
        synced_counts['ngo_requests'] += 1

    for vr in verif_results:
        passport = vr.get('passport_number')
        if passport:
            conn.execute(
                '''UPDATE travellers SET flag=?, verification_status=?, verified_at=?
                   WHERE passport_number=? AND verification_status='pending' ''',
                (vr.get('flag', 'green'), vr.get('verification_status', 'cleared'),
                 vr.get('verified_at', now), passport)
            )
            synced_counts['verif_results'] += 1

    # Log the sync event
    conn.execute(
        '''INSERT INTO offline_sync_queue (data_type, payload, created_at, synced)
           VALUES (?,?,?,1)''',
        ('sync_event', json.dumps({'officer': identity['user_id'], 'counts': synced_counts}), now)
    )

    conn.commit()
    conn.close()
    return jsonify({'status': 'synced', 'synced': synced_counts})

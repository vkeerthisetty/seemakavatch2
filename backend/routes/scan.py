from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
import datetime

scan_bp = Blueprint('scan', __name__)

@scan_bp.route('/qr', methods=['POST'])
@jwt_required()
def scan_qr():
    identity = get_identity()
    if identity.get('role') != 'officer':
        return jsonify({'error': 'Officers only'}), 403

    border_id = request.get_json(force=True).get('border_id', '').strip()
    # EBI-PASSPORT-YEAR-CP  → parts[1] is passport
    parts = border_id.split('-')
    passport = parts[1] if len(parts) >= 2 else None

    conn = get_db()
    row  = conn.execute(
        'SELECT name,nationality,visa_type,flag,fraud_type FROM travellers WHERE passport_number=?',
        (passport,)
    ).fetchone() if passport else None

    flag   = row['flag']   if row else 'black'
    name   = row['name']   if row else 'Unknown'
    result = 'cleared'     if flag == 'green' else 'denied'

    conn.execute(
        '''INSERT INTO scan_logs (border_id,passport_number,traveller_name,officer_id,result,flag,timestamp)
           VALUES (?,?,?,?,?,?,?)''',
        (border_id, passport, name, identity['user_id'], result, flag,
         datetime.datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

    resp = {'result': result, 'flag': flag, 'name': name}
    if row:
        resp['nationality'] = row['nationality']
        resp['visa_type']   = row['visa_type']
    if flag != 'green':
        resp['reason'] = row['fraud_type'] if row else 'Border ID not found'
        resp['alert']  = True
    return jsonify(resp)


@scan_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    if get_identity().get('role') != 'officer':
        return jsonify({'error': 'Officers only'}), 403
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        'SELECT border_id,traveller_name,officer_id,result,flag,timestamp FROM scan_logs ORDER BY timestamp DESC LIMIT 20'
    ).fetchall()]
    conn.close()
    return jsonify(rows)

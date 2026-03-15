from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
from utils.verification import run_verification_pipeline
from utils.qr_generator import generate_border_id
import datetime

travellers_bp = Blueprint('travellers', __name__)

@travellers_bp.route('/apply', methods=['POST'])
@jwt_required()
def apply():
    identity = get_identity()
    if identity['role'] != 'traveller':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    conn = get_db()
    conn.execute(
        '''INSERT INTO applications (passport_number,nationality,purpose,duration,notes,submitted_at)
           VALUES (?,?,?,?,?,?)''',
        (identity['user_id'], data.get('nationality'), data.get('purpose'),
         data.get('duration'), data.get('notes',''),
         datetime.datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({'status': 'submitted'})


@travellers_bp.route('/verify/<passport_number>', methods=['POST'])
@jwt_required()
def verify(passport_number):
    conn = get_db()
    row = conn.execute(
        'SELECT * FROM travellers WHERE passport_number=?', (passport_number,)
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Traveller not found'}), 404

    traveller = dict(row)
    results   = run_verification_pipeline(traveller)
    passed    = all(r['passed'] for r in results)
    flag      = 'green' if passed else 'black'
    fraud     = next((r['check'] for r in results if not r['passed']), None)

    update = {
        'flag': flag,
        'verification_status': 'cleared' if passed else 'flagged',
        'fraud_type': fraud,
        'verified_at': datetime.datetime.utcnow().isoformat(),
    }

    if passed:
        bid_data = generate_border_id(traveller)
        update.update(bid_data)

    conn.execute(
        '''UPDATE travellers SET flag=?,verification_status=?,fraud_type=?,
           verified_at=?,border_id=?,qr_code_base64=?,qr_data=?,qr_valid_until=?
           WHERE passport_number=?''',
        (update['flag'], update['verification_status'], update.get('fraud_type'),
         update['verified_at'],
         update.get('border_id',''), update.get('qr_code_base64',''),
         update.get('qr_data',''), update.get('valid_until',''),
         passport_number)
    )
    conn.commit()
    conn.close()

    resp = {'passed': passed, 'results': results}
    if passed:
        resp['border_id'] = update
    else:
        resp['fraud_type'] = fraud
    return jsonify(resp)


@travellers_bp.route('/my-status', methods=['GET'])
@jwt_required()
def my_status():
    identity = get_identity()
    conn = get_db()
    row = conn.execute(
        'SELECT * FROM travellers WHERE passport_number=?', (identity['user_id'],)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    d = dict(row)
    d.pop('password_hash', None)
    return jsonify(d)

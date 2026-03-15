from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from utils.db import get_db
import hashlib, json

auth_bp = Blueprint('auth', __name__)

ROLE_TABLE = {
    'officer':   ('officers',    'gov_id'),
    'traveller': ('travellers',  'passport_number'),
    'ngo':       ('ngo_workers', 'ngo_id'),
    'mea':       ('mea_officers','mea_id'),
}

def _check_password(plain: str, stored_hash: str) -> bool:
    # Always try sha256 first (what seed_db.py uses)
    if hashlib.sha256(plain.encode()).hexdigest() == stored_hash:
        return True
    # Try bcrypt only if hash looks like a bcrypt hash (starts with $2)
    if stored_hash.startswith('$2'):
        try:
            import bcrypt
            return bcrypt.checkpw(plain.encode(), stored_hash.encode())
        except Exception:
            pass
    return False


@auth_bp.route('/login', methods=['POST'])
def login():
    data     = request.get_json(force=True)
    role     = data.get('role', '')
    user_id  = data.get('user_id', '').strip()
    password = data.get('password', '')

    if role not in ROLE_TABLE:
        return jsonify({'error': 'Invalid role'}), 400

    table, id_col = ROLE_TABLE[role]
    conn = get_db()
    row  = conn.execute(
        f'SELECT * FROM {table} WHERE {id_col} = ?', (user_id,)
    ).fetchone()

    officer_role = None
    if role == 'officer' and row:
        try:
            officer_role = row['officer_role']
        except Exception:
            officer_role = 'border_officer'

    conn.close()

    if not row:
        return jsonify({'error': 'Invalid credentials'}), 401

    if not _check_password(password, row['password_hash']):
        return jsonify({'error': 'Invalid credentials'}), 401

    # identity must be a string in flask-jwt-extended >= 4.x
    identity_str = json.dumps({
        'user_id': user_id,
        'role':    role,
        'name':    row['name'],
    })

    token = create_access_token(identity=identity_str)

    resp = {
        'token':   token,
        'role':    role,
        'name':    row['name'],
        'user_id': user_id,
    }
    if officer_role:
        resp['officer_role'] = officer_role

    return jsonify(resp)

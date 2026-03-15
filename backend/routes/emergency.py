from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db
import datetime

emergency_bp = Blueprint('emergency', __name__)


@emergency_bp.route('/declare', methods=['POST'])
@jwt_required()
def declare_emergency():
    identity = get_identity()
    if identity.get('role') not in ('mea', 'officer'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    region = data.get('region_name', '').strip()
    notes = data.get('notes', '')
    if not region:
        return jsonify({'error': 'region_name required'}), 400
    now = datetime.datetime.utcnow().isoformat()
    conn = get_db()
    row = conn.execute('SELECT id FROM emergency_regions WHERE region_name=?', (region,)).fetchone()
    if not row:
        conn.execute(
            'INSERT INTO emergency_regions (region_name, is_emergency, declared_by, declared_at, notes) VALUES (?,1,?,?,?)',
            (region, identity['user_id'], now, notes)
        )
    else:
        conn.execute(
            'UPDATE emergency_regions SET is_emergency=1, declared_by=?, declared_at=?, resolved_at=NULL, notes=? WHERE region_name=?',
            (identity['user_id'], now, notes, region)
        )
    conn.commit()
    conn.close()
    return jsonify({'status': 'emergency_declared', 'region': region, 'declared_at': now})


@emergency_bp.route('/resolve', methods=['POST'])
@jwt_required()
def resolve_emergency():
    identity = get_identity()
    if identity.get('role') not in ('mea', 'officer'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    region = data.get('region_name', '').strip()
    if not region:
        return jsonify({'error': 'region_name required'}), 400
    now = datetime.datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        'UPDATE emergency_regions SET is_emergency=0, resolved_at=? WHERE region_name=?',
        (now, region)
    )
    conn.commit()
    conn.close()
    return jsonify({'status': 'emergency_resolved', 'region': region})


@emergency_bp.route('/active', methods=['GET'])
@jwt_required()
def active_emergencies():
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        'SELECT * FROM emergency_regions ORDER BY region_name'
    ).fetchall()]
    conn.close()
    return jsonify(rows)


@emergency_bp.route('/toggle', methods=['POST'])
@jwt_required()
def toggle_emergency():
    """Toggle emergency on/off for a region — convenience endpoint for MEA dashboard."""
    identity = get_identity()
    if identity.get('role') not in ('mea', 'officer'):
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    region = data.get('region_name', '').strip()
    activate = bool(data.get('activate', False))
    now = datetime.datetime.utcnow().isoformat()
    conn = get_db()
    if activate:
        conn.execute(
            '''UPDATE emergency_regions
               SET is_emergency=1, declared_by=?, declared_at=?, resolved_at=NULL
               WHERE region_name=?''',
            (identity['user_id'], now, region)
        )
    else:
        conn.execute(
            'UPDATE emergency_regions SET is_emergency=0, resolved_at=? WHERE region_name=?',
            (now, region)
        )
    conn.commit()
    rows = [dict(r) for r in conn.execute('SELECT * FROM emergency_regions ORDER BY region_name').fetchall()]
    conn.close()
    return jsonify({'status': 'toggled', 'regions': rows})

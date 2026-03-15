from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.jwt_helper import get_identity
from utils.db import get_db

officers_bp = Blueprint('officers', __name__)


def _require_officer():
    return get_identity().get('role') == 'officer'


@officers_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    if not _require_officer():
        return jsonify({'error': 'Officers only'}), 403
    conn = get_db()
    cleared  = conn.execute("SELECT COUNT(*) FROM travellers WHERE flag='green'").fetchone()[0]
    flagged  = conn.execute("SELECT COUNT(*) FROM travellers WHERE flag='black'").fetchone()[0]
    pending  = conn.execute("SELECT COUNT(*) FROM travellers WHERE verification_status='pending'").fetchone()[0]
    refugees = conn.execute("SELECT COUNT(*) FROM refugees").fetchone()[0]
    ngo_pend = conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE status='PENDING'").fetchone()[0]
    recent   = [dict(r) for r in conn.execute(
        '''SELECT passport_number,name,nationality,checkpoint,flag,fraud_type,verification_status
           FROM travellers ORDER BY verified_at DESC LIMIT 10'''
    ).fetchall()]
    conn.close()
    return jsonify({
        'cleared': cleared, 'flagged': flagged,
        'pending': pending, 'refugees': refugees,
        'ngo_pending': ngo_pend, 'recent': recent
    })


@officers_bp.route('/border-statistics', methods=['GET'])
@jwt_required()
def border_statistics():
    if not _require_officer():
        return jsonify({'error': 'Officers only'}), 403
    conn = get_db()
    total_today   = 31842
    suspicious    = conn.execute("SELECT COUNT(*) FROM travellers WHERE flag='black'").fetchone()[0]
    refugees_reg  = conn.execute("SELECT COUNT(*) FROM refugees").fetchone()[0]
    ngo_pending   = conn.execute("SELECT COUNT(*) FROM ngo_requests WHERE status='PENDING'").fetchone()[0]
    monthly = [
        {'month': '2024-01', 'count': 142},
        {'month': '2024-02', 'count': 198},
        {'month': '2024-03', 'count': 234},
        {'month': '2024-04', 'count': 187},
        {'month': '2024-05', 'count': 312},
        {'month': '2024-06', 'count': 278},
    ]
    verif_dist = [
        {'label': 'Cleared',  'count': conn.execute("SELECT COUNT(*) FROM travellers WHERE flag='green'").fetchone()[0]},
        {'label': 'Flagged',  'count': conn.execute("SELECT COUNT(*) FROM travellers WHERE flag='black'").fetchone()[0]},
        {'label': 'Pending',  'count': conn.execute("SELECT COUNT(*) FROM travellers WHERE verification_status='pending'").fetchone()[0]},
    ]
    conn.close()
    return jsonify({
        'total_travellers_today': total_today,
        'suspicious_travellers':  suspicious,
        'refugees_registered':    refugees_reg,
        'ngo_requests_pending':   ngo_pending,
        'monthly_refugee_arrivals': monthly,
        'verification_distribution': verif_dist,
    })


@officers_bp.route('/travellers', methods=['GET'])
@jwt_required()
def list_travellers():
    if not _require_officer():
        return jsonify({'error': 'Officers only'}), 403
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        'SELECT passport_number,name,nationality,dob,visa_type,checkpoint,flag,verification_status,fraud_type FROM travellers'
    ).fetchall()]
    conn.close()
    return jsonify(rows)


@officers_bp.route('/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    if not _require_officer():
        return jsonify({'error': 'Officers only'}), 403
    conn = get_db()
    rows = [dict(r) for r in conn.execute(
        "SELECT passport_number,name,nationality,checkpoint,flag,fraud_type,visa_type FROM travellers WHERE flag='black'"
    ).fetchall()]
    conn.close()
    return jsonify(rows)


@officers_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    if not _require_officer():
        return jsonify({'error': 'Officers only'}), 403
    identity = get_identity()
    conn = get_db()
    row = conn.execute(
        'SELECT gov_id, name, designation, rank, unit, checkpoint, officer_role FROM officers WHERE gov_id=?',
        (identity['user_id'],)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))

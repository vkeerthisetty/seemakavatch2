"""
Helper to decode JWT identity — works whether identity is a dict or JSON string.
"""
import json
from flask_jwt_extended import get_jwt_identity

def get_identity():
    raw = get_jwt_identity()
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return {'user_id': str(raw), 'role': 'officer', 'name': ''}

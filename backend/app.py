from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, verify_jwt_in_request
from dotenv import load_dotenv
from utils.db import init_db
from utils.jwt_helper import get_identity
import os

load_dotenv()
app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'sk-dev-secret-2024')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400

CORS(app, origins=['http://localhost:3000','http://localhost:5173','http://127.0.0.1:5173',
                   os.getenv('FRONTEND_URL','')])
JWTManager(app)

with app.app_context():
    init_db()

from routes.auth       import auth_bp
from routes.travellers import travellers_bp
from routes.officers   import officers_bp
from routes.ngo        import ngo_bp
from routes.refugees   import refugees_bp
from routes.scan       import scan_bp
from routes.sync       import sync_bp
from routes.emergency  import emergency_bp

app.register_blueprint(auth_bp,       url_prefix='/api/auth')
app.register_blueprint(travellers_bp, url_prefix='/api/travellers')
app.register_blueprint(officers_bp,   url_prefix='/api/officers')
app.register_blueprint(ngo_bp,        url_prefix='/api/ngo')
app.register_blueprint(refugees_bp,   url_prefix='/api/refugees')
app.register_blueprint(scan_bp,       url_prefix='/api/scan')
app.register_blueprint(sync_bp,       url_prefix='/api/sync')
app.register_blueprint(emergency_bp,  url_prefix='/api/emergency')

@app.route('/api/health')
def health():
    return {'status':'ok','service':'SeemaKavatch Backend v2'}

@app.route('/api/register_refugee', methods=['POST'])
def register_refugee_top():
    verify_jwt_in_request()
    identity = get_identity()
    if identity.get('role') not in ('ngo','officer'):
        return jsonify({'error':'Unauthorized'}), 403
    from routes.refugees import _do_register
    result, err = _do_register(request.get_json(force=True), identity['user_id'])
    if err: return jsonify({'error':err}), 400
    return jsonify(result), 201

@app.route('/api/ngo_requests', methods=['GET'])
def ngo_requests_top():
    verify_jwt_in_request()
    from routes.ngo import get_requests
    return get_requests()

@app.route('/api/border_statistics')
def border_stats():
    verify_jwt_in_request()
    from routes.officers import border_statistics
    return border_statistics()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT',5000)))

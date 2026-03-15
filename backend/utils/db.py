import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sk.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS officers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gov_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            designation TEXT, rank TEXT, unit TEXT, checkpoint TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'officer',
            officer_role TEXT DEFAULT 'border_officer'
        );
        CREATE TABLE IF NOT EXISTS travellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passport_number TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            nationality TEXT, dob TEXT, passport_expiry TEXT, visa_type TEXT,
            checkpoint TEXT, flag TEXT DEFAULT 'green',
            verification_status TEXT DEFAULT 'pending',
            fraud_type TEXT, password_hash TEXT NOT NULL,
            border_id TEXT, qr_code_base64 TEXT, qr_data TEXT,
            qr_valid_until TEXT, verified_at TEXT
        );
        CREATE TABLE IF NOT EXISTS ngo_workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ngo_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            aadhar_linked TEXT, ngo_name TEXT, designation TEXT,
            password_hash TEXT NOT NULL, role TEXT DEFAULT 'ngo'
        );
        CREATE TABLE IF NOT EXISTS ngos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL, ngo_id TEXT, headquarters TEXT,
            capacity INTEGER DEFAULT 200, assigned_count INTEGER DEFAULT 0,
            specialization TEXT DEFAULT 'general'
        );
        CREATE TABLE IF NOT EXISTS refugees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temp_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            country_of_origin TEXT, dob TEXT, entry_checkpoint TEXT,
            assigned_ngo TEXT, criminal_flag INTEGER DEFAULT 0,
            biometric_notes TEXT, registered_by TEXT DEFAULT 'system',
            registered_at TEXT, status TEXT DEFAULT 'active',
            health_condition TEXT DEFAULT 'stable',
            family_size INTEGER DEFAULT 1, age INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ngo_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refugee_temp_id TEXT NOT NULL, refugee_name TEXT,
            ngo_name TEXT NOT NULL, status TEXT DEFAULT 'PENDING',
            requested_at TEXT, responded_at TEXT, notes TEXT,
            attempt_number INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS bsf_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            refugee_temp_id TEXT, refugee_name TEXT, origin TEXT,
            alert_type TEXT, reported_by TEXT,
            status TEXT DEFAULT 'pending', created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS scan_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            border_id TEXT, passport_number TEXT, traveller_name TEXT,
            officer_id TEXT, result TEXT, flag TEXT, timestamp TEXT,
            synced INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS offline_sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_type TEXT NOT NULL, payload TEXT NOT NULL,
            created_at TEXT, synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            passport_number TEXT, nationality TEXT, purpose TEXT,
            duration TEXT, notes TEXT,
            status TEXT DEFAULT 'pending_verification', submitted_at TEXT
        );
        CREATE TABLE IF NOT EXISTS mea_officers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mea_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            designation TEXT,
            ministry TEXT DEFAULT 'Ministry of External Affairs',
            password_hash TEXT NOT NULL, role TEXT DEFAULT 'mea'
        );
        CREATE TABLE IF NOT EXISTS emergency_regions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            region_name TEXT UNIQUE NOT NULL,
            is_emergency INTEGER DEFAULT 0,
            declared_by TEXT, declared_at TEXT, resolved_at TEXT, notes TEXT
        );
        INSERT OR IGNORE INTO emergency_regions (region_name, is_emergency) VALUES
            ('Punjab Border',0),('Rajasthan Border',0),('Gujarat Border',0),
            ('Kashmir Sector',0),('Arunachal Border',0),
            ('West Bengal Border',0),('Manipur Border',0);
    """)

    # Always ensure NGOs exist
    ngo_count = conn.execute("SELECT COUNT(*) FROM ngos").fetchone()[0]
    if ngo_count == 0:
        c.executemany(
            'INSERT OR IGNORE INTO ngos (name,ngo_id,headquarters,capacity,assigned_count,specialization) VALUES (?,?,?,?,?,?)',
            [
                ('Red Cross India',         'NGO-REDCROSS', 'New Delhi', 200, 0, 'medical'),
                ('Refugee Aid India',        'NGO-RAI',      'New Delhi', 150, 0, 'shelter'),
                ('Helping Hands Foundation', 'NGO-HHF',      'Mumbai',    180, 0, 'family'),
                ('UNHCR India',              'NGO-UNHCR',    'New Delhi', 360, 0, 'legal'),
                ('CARE India',               'NGO-CARE',     'New Delhi', 200, 0, 'general'),
            ]
        )

    conn.commit()
    conn.close()

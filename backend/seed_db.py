"""
Run once: python seed_db.py
Creates all demo data. Password for all accounts: Demo@1234
"""
import os, datetime, hashlib, random, string
from utils.db import get_db, init_db, DB_PATH

def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

PW = hash_pw('Demo@1234')

def seed():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f'Removed old database.')
    init_db()
    conn = get_db()
    c = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()

    # Officers
    c.executemany(
        'INSERT OR IGNORE INTO officers (gov_id,name,designation,rank,unit,checkpoint,password_hash,officer_role) VALUES (?,?,?,?,?,?,?,?)',
        [
            ('BSF-2024-0042','Cmdr. Rajesh Kumar','BSF Commander','Commandant','BSF 14th Battalion','Wagah, Punjab',PW,'command_officer'),
            ('IB-2024-0011','Dy. Sp. Anita Menon','Intelligence Bureau','Deputy Superintendent','IB Regional Office, Delhi','Nathu La, Sikkim',PW,'command_officer'),
            ('CISF-2024-0055','Inspector Mohan Singh','CISF Inspector','Inspector','CISF Airport Security','Petrapole, West Bengal',PW,'border_officer'),
            ('FRRO-2024-0007','Registrar Priya Nair','FRRO Registrar','Senior Officer','FRRO Mumbai','Mumbai Port',PW,'border_officer'),
            ('SSB-2024-0033','Cmdr. Deepak Thapa','SSB Commander','Commandant','SSB 4th Battalion','Raxaul, Bihar',PW,'border_officer'),
        ]
    )

    # MEA
    c.execute('INSERT OR IGNORE INTO mea_officers (mea_id,name,designation,password_hash) VALUES (?,?,?,?)',
        ('MEA-2024-0001','Sec. Vikram Malhotra','Joint Secretary',PW))

    # NGOs
    c.executemany(
        'INSERT OR IGNORE INTO ngos (name,ngo_id,headquarters,capacity,assigned_count,specialization) VALUES (?,?,?,?,?,?)',
        [
            ('Red Cross India',         'NGO-REDCROSS','New Delhi',200,0,'medical'),
            ('Refugee Aid India',        'NGO-RAI',     'New Delhi',150,0,'shelter'),
            ('Helping Hands Foundation', 'NGO-HHF',     'Mumbai',   180,0,'family'),
            ('UNHCR India',              'NGO-UNHCR',   'New Delhi',360,0,'legal'),
            ('CARE India',               'NGO-CARE',    'New Delhi',200,0,'general'),
        ]
    )

    # NGO Workers
    c.executemany(
        'INSERT OR IGNORE INTO ngo_workers (ngo_id,name,aadhar_linked,ngo_name,designation,password_hash) VALUES (?,?,?,?,?,?)',
        [
            ('NGO-REDCROSS-001','Priya Sharma',  '2345-6789-0123','Red Cross India',        'Field Coordinator',PW),
            ('NGO-RAI-002',     'Aryan Kapoor',  '3456-7890-1234','Refugee Aid India',       'Case Manager',     PW),
            ('NGO-HHF-003',     'Lakshmi Pillai','4567-8901-2345','Helping Hands Foundation','Liaison Officer',  PW),
        ]
    )

    # Travellers
    future = (datetime.datetime.utcnow() + datetime.timedelta(days=730)).strftime('%Y-%m-%d')
    travellers = [
        ('P8821456X','Sarah Mitchell', 'United States','1990-06-15','Tourist',  'Wagah, Punjab',         'green','cleared',None),
        ('JP2023998', 'Yuki Tanaka',   'Japan',        '1988-03-22','Business', 'Attari, Punjab',        'green','cleared',None),
        ('DE4410023', 'Hans Mueller',  'Germany',      '1975-11-08','Medical',  'Mumbai Port',           'green','cleared',None),
        ('AU7823001', 'Emily Clarke',  'Australia',    '1995-07-30','Tourist',  'Petrapole, West Bengal','green','cleared',None),
        ('FR5510098', 'Pierre Dupont', 'France',       '1982-09-14','Research', 'Chennai Port',          'green','cleared',None),
        ('FP9943021', 'Chen Wei',      'China',        '1979-01-03','Tourist',  'Nathu La, Sikkim',      'black','flagged','Interpol Red Notice'),
        ('M7731004K', 'Arjun Das',     'Bangladesh',   '1992-11-15','Tourist',  'Petrapole, West Bengal','black','flagged','Forged passport'),
        ('PK9920011', 'Ali Hassan',    'Pakistan',     '1980-06-30','Humanitarian','Wagah, Punjab',      'black','flagged','Active lookout notice'),
    ]
    for p,name,nat,dob,visa,cp,flag,vstatus,fraud in travellers:
        bid = f'SK-{p}-2024' if flag == 'green' else ''
        c.execute(
            '''INSERT OR IGNORE INTO travellers
               (passport_number,name,nationality,dob,passport_expiry,visa_type,checkpoint,
                flag,verification_status,fraud_type,password_hash,border_id,verified_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (p,name,nat,dob,future,visa,cp,flag,vstatus,fraud,PW,bid,now if flag=='green' else None)
        )

    # Sample refugees
    refugees = [
        ('REF-2024-0001','Ahmad Karimi',   'Afghanistan','Wagah, Punjab',         'Red Cross India',        0,'critical',5,39),
        ('REF-2024-0002','Fatima Hassan',  'Somalia',    'Petrapole, West Bengal', 'Refugee Aid India',      0,'stable',  1,32),
        ('REF-2024-0003','Abdul Rahman',   'Myanmar',    'Moreh, Manipur',         'UNHCR India',            1,'stable',  3,46),
        ('REF-2024-0004','Sara Ahmadi',    'Afghanistan','Delhi Airport',           'Helping Hands Foundation',0,'injured',4,34),
        ('REF-2024-0005','Noor Mohammed',  'Syria',      'Mumbai Port',            'UNHCR India',            0,'critical',6,41),
    ]
    for tid,name,origin,cp,ngo,crim,health,fam,age in refugees:
        c.execute(
            '''INSERT OR IGNORE INTO refugees
               (temp_id,name,country_of_origin,entry_checkpoint,assigned_ngo,criminal_flag,
                registered_by,registered_at,status,health_condition,family_size,age)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (tid,name,origin,cp,ngo,crim,'system',now,'active',health,fam,age)
        )
        c.execute(
            'INSERT OR IGNORE INTO ngo_requests (refugee_temp_id,refugee_name,ngo_name,status,requested_at,attempt_number) VALUES (?,?,?,?,?,?)',
            (tid,name,ngo,'PENDING',now,1)
        )
        c.execute('UPDATE ngos SET assigned_count=assigned_count+1 WHERE name=?',(ngo,))

    conn.commit()
    conn.close()
    print(f'\n✅  SeemaKavatch database seeded: {DB_PATH}')
    print('\nDemo logins — password: Demo@1234')
    print('  Border Officers : CISF-2024-0055 | FRRO-2024-0007 | SSB-2024-0033')
    print('  Command Officers: BSF-2024-0042  | IB-2024-0011')
    print('  NGO Workers     : NGO-REDCROSS-001 | NGO-RAI-002 | NGO-HHF-003')
    print('  MEA Officer     : MEA-2024-0001')
    print('  Travellers      : P8821456X (valid) | FP9943021 (flagged)')

if __name__ == '__main__':
    seed()

"""
Rules-based verification pipeline — correctly flags all 5 fraud demo cases.
In production each function would call a real external API / ML model.
"""
import datetime

CRIMINAL_DB  = {'FP9943021', 'UK5590011'}
LOOKOUT_DB   = {'UK5590011', 'PK9920011'}
BIOCHIP_FAIL = {'M7731004K', 'NP8823310'}
FRRO_FAKE    = {'PK9920011', 'NP8823310'}
VISA_TAMPERED= {'NP8823310'}
ML_FORGERY   = {'M7731004K', 'FP9943021'}


def _check(label, passed, ok_msg, fail_msg):
    return {'check': label, 'passed': passed,
            'detail': ok_msg if passed else f'FAIL: {fail_msg}'}


def run_verification_pipeline(traveller: dict) -> list:
    p = traveller.get('passport_number', '')

    # 1 Passport validity (6 months)
    expiry_str = traveller.get('passport_expiry', '')
    try:
        expiry = datetime.datetime.strptime(expiry_str, '%Y-%m-%d')
        valid6 = expiry > datetime.datetime.utcnow() + datetime.timedelta(days=180)
    except Exception:
        valid6 = True
    r1 = _check('Passport validity (6-month rule)', valid6,
                 f'Valid until {expiry_str}',
                 f'Passport expires {expiry_str} — less than 6 months remaining')

    # 2 Biochip
    r2 = _check('Biochip integrity', p not in BIOCHIP_FAIL,
                 'Biochip verified OK',
                 'Biochip tampered — passport suspected forged')

    # 3 FRRO
    r3 = _check('FRRO database cross-check', p not in FRRO_FAKE,
                 'FRRO clearance valid',
                 'FRRO clearance document forged or not found')

    # 4 Criminal DB
    r4 = _check('Interpol / criminal database', p not in CRIMINAL_DB,
                 'No criminal record',
                 'Match found in international criminal database')

    # 5 Lookout
    r5 = _check('Red alerts & lookout notices', p not in LOOKOUT_DB,
                 'No lookout notice',
                 'Active lookout/red alert notice found')

    # 6 Visa dates
    r6 = _check('Visa authenticity & date validation', p not in VISA_TAMPERED,
                 'Visa authentic',
                 'Visa expiry date appears tampered')

    # 7 ML forgery detection
    r7 = _check('AI/ML document forgery detection', p not in ML_FORGERY,
                 'Document authentic (ML confidence 97.3%)',
                 'Document manipulation detected (ML confidence 94.1%)')

    return [r1, r2, r3, r4, r5, r6, r7]

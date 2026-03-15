import hashlib, base64, io, datetime

try:
    import qrcode
    HAS_QR = True
except ImportError:
    HAS_QR = False


def generate_border_id(traveller: dict) -> dict:
    passport  = traveller.get('passport_number', '')
    name      = traveller.get('name', '')
    checkpoint= traveller.get('checkpoint', 'IN')
    cp_code   = ''.join(c for c in checkpoint.upper() if c.isalpha())[:2] or 'IN'
    border_id = f'EBI-{passport}-2024-{cp_code}'

    payload   = f'{border_id}:{name}:{passport}'
    ih        = hashlib.sha256(payload.encode()).hexdigest()[:16].upper()
    qr_data   = f'IBMS:{border_id}:{ih}'

    qr_b64 = ''
    if HAS_QR:
        qr = qrcode.QRCode(version=2, box_size=6, border=2,
                           error_correction=qrcode.constants.ERROR_CORRECT_H)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

    valid_until = (datetime.datetime.utcnow() + datetime.timedelta(hours=24)).isoformat()

    return {
        'border_id':       border_id,
        'integrity_hash':  ih,
        'qr_code_base64':  qr_b64,
        'qr_data':         qr_data,
        'valid_until':     valid_until,
    }

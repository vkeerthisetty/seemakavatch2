# SeemaSetu — Smart Border Management & Humanitarian Coordination System

## ✅ Changes Implemented in This Version

| Feature | Status |
|---|---|
| NGO Coordination System (register → assign → accept/reject) | ✅ Fixed & working |
| Real-time NGO portal polling (5s) | ✅ Added |
| MEA Officer role & login | ✅ New |
| MEA Dashboard with India border map | ✅ New |
| Emergency toggle per border region | ✅ New |
| Map turns RED with pulse on emergency | ✅ New |
| Officer dashboards receive emergency alerts | ✅ New |
| Consistent color palette (Saffron / Light Blue / White) | ✅ Applied |
| emergency_regions DB table + seed data | ✅ Added |
| API endpoints: /api/emergency/* | ✅ New |

---

## 🚀 Running Locally in VS Code

### Prerequisites
- Python 3.10+
- Node.js 18+

### Step 1 — Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python seed_db.py
python app.py
```

Backend runs at: http://localhost:5000

### Step 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## 🔐 Demo Logins (password for all: Demo@1234)

| Role | ID |
|---|---|
| Border Officer | CISF-2024-0055 |
| Border Officer | FRRO-2024-0007 |
| Command Officer | BSF-2024-0042 |
| NGO Worker | NGO-REDCROSS-001 |
| NGO Worker | NGO-RAI-002 |
| MEA Officer | MEA-2024-0001 |
| Traveller | P8821456X |

---

## 🚨 Emergency Flow

1. MEA Officer logs in → Emergency Control tab
2. Toggle a region ON → map turns RED with pulse
3. Officer dashboards show alert banner within 5 seconds
4. Toggle OFF → emergency resolved

## 🧭 NGO Flow

1. Border Officer → Register Refugee tab → submit form
2. NGO Worker logs in → Requests tab (auto-refreshes every 5s)
3. ACCEPT → refugee assigned to NGO
4. REJECT → auto-forwarded to next NGO with capacity

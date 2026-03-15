# SeemaSetu IBMS v2 — Modification Summary

## Modified Files

### Backend
| File | Change |
|------|--------|
| `backend/utils/db.py` | Added: `officer_role`, `ngo_requests`, `offline_sync_queue` tables; `health_condition`, `family_size`, `age` columns on refugees |
| `backend/seed_db.py` | Full rewrite: 5 officers (2 command + 3 border), 5 NGOs, 15 travellers (5 normal/5 suspicious/5 forged), 10 refugees with health/family data |
| `backend/app.py` | Added sync blueprint registration |
| `backend/routes/officers.py` | Added `GET /officers/border-statistics` and `GET /officers/profile` endpoints |
| `backend/routes/ngo.py` | Added `GET /ngo/requests`, `POST /ngo/accept/<id>`, `POST /ngo/reject/<id>` (with auto-forward), `GET /ngo/statistics` |
| `backend/routes/refugees.py` | Smart NGO matching logic based on health/family/criminal; creates `ngo_requests` record on register |
| `backend/requirements.txt` | Added matplotlib, numpy |

### New Backend Files
| File | Purpose |
|------|---------|
| `backend/routes/sync.py` | `POST /api/sync/offline` — upserts offline scan logs, refugees, NGO requests, verif results |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Added `OfficerRole`, `NGORequest`, `BorderStats`, offline types |
| `frontend/src/utils/api.ts` | Added: `getBorderStatistics`, `getOfficerProfile`, `getNGORequests`, `acceptNGORequest`, `rejectNGORequest`, `syncOfflineData` |
| `frontend/src/utils/offlineCache.ts` | Full rewrite: 5 IndexedDB stores (QR, scan logs, refugees, NGO requests, verif results); pending sync count |
| `frontend/src/hooks/useAuth.tsx` | Hydrates `officer_role` from `/officers/profile` on login |
| `frontend/src/components/Layout.tsx` | System Status indicator, Pending Sync count, Sync Now button, role badge, auto-sync on reconnect |
| `frontend/src/pages/LoginPage.tsx` | Two-column layout with feature highlights, updated demo credentials |
| `frontend/src/pages/OfficerDashboard.tsx` | **Role-split**: Border Officers get scanner/register/offline; Command Officers get analytics/NGO monitor |
| `frontend/src/pages/NGODashboard.tsx` | Accept/Reject workflow with auto-forward modal, capacity bars, full refugee directory |
| `frontend/src/index.css` | Inter font, government design system, animations |

### New Root Files
| File | Purpose |
|------|---------|
| `generate_border_map.py` | matplotlib + numpy India intelligence map: fencing, ICPs, airports, seaports, drones, IR cams, rivers, cities |

---

## Running the System

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python seed_db.py        # seed database (first time)
python app.py            # starts on http://localhost:5000
```

### 2. Frontend (Border Management System)
```bash
cd frontend
npm install
npm run dev              # starts on http://localhost:5173
```

### 3. Generate Intelligence Map
```bash
pip install matplotlib numpy plotly  # plotly optional for interactive HTML
python generate_border_map.py
# Outputs:
#   india_border_intelligence_map.png
#   india_border_map_interactive.html
```

---

## Demo Credentials (password: Demo@1234)

### Border Control Officers (offline capable)
- `CISF-2024-0055` — Inspector Mohan Singh, Petrapole
- `FRRO-2024-0007` — Registrar Priya Nair, Mumbai Port
- `SSB-2024-0033` — Cmdr. Deepak Thapa, Raxaul

### Command Center Officers (internet required)
- `BSF-2024-0042` — Cmdr. Rajesh Kumar (sees Analytics + NGO Monitor)
- `IB-2024-0011` — Dy. Sp. Anita Menon

### NGO Workers
- `NGO-REDCROSS-001` — Red Cross India
- `NGO-RAI-002` — Refugee Aid India
- `NGO-HHF-003` — Helping Hands Foundation

---

## Feature Implementation Notes

### Feature 1 — Role Based Command System
- `officer_role` column on officers table: `border_officer` | `command_officer`
- Frontend detects role from `/officers/profile` and renders different tabs
- Border officers: Dashboard, QR Scanner, Traveller DB, Alerts, Refugees, Register
- Command officers: Analytics, Border Activity, Alerts, Refugees, NGO Monitor

### Feature 2 — Offline Mode
- IndexedDB v2 with 5 stores: `qr_cache`, `offline_scan_logs`, `offline_refugees`, `offline_ngo_requests`, `offline_verif_results`
- Layout header shows System Status (green/red), Pending Sync count, Sync Now button
- Auto-sync fires when `online` event detected
- Backend `/api/sync/offline` handles conflict-safe upserts

### Feature 5 — Smart NGO Matching
- Algorithm: critical/injured → Red Cross (medical), large family → Helping Hands (family), criminal → UNHCR (legal), default → capacity-based
- If NGO rejects → auto-forwards to next NGO with available slots

### Feature 6 — NGO Portal
- Requests tab shows PENDING requests with Accept / Reject buttons
- Reject opens modal for reason, then auto-forwards
- History table shows resolved requests

### Feature 9 — API Endpoints
All required endpoints are present:
- `POST /api/travellers/verify/<passport>` ✓
- `POST /api/refugees/register` ✓
- `GET /api/ngo/requests` ✓
- `POST /api/ngo/accept/<id>` ✓
- `POST /api/ngo/reject/<id>` ✓
- `POST /api/sync/offline` ✓
- `GET /api/officers/border-statistics` ✓

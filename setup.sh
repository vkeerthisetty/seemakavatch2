#!/usr/bin/env bash
# IBMS Quick Setup — SQLite edition
# Usage: bash setup.sh

set -e
echo ""
echo "================================================"
echo "  IBMS — India Border Management System"
echo "  First-time setup (SQLite, no MongoDB needed)"
echo "================================================"
echo ""

# ── Backend ──
echo "1/4  Setting up Python backend..."
cd backend
python3 -m venv venv 2>/dev/null || python -m venv venv
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null || true
pip install -r requirements.txt -q
cp .env.example .env 2>/dev/null || true

echo "2/4  Seeding database..."
python seed_db.py
deactivate 2>/dev/null || true
cd ..

# ── Frontend ──
echo "3/4  Installing frontend packages..."
cd frontend
npm install --silent
cp .env.example .env.local 2>/dev/null || true
cd ..

echo ""
echo "================================================"
echo "  Setup complete!"
echo ""
echo "  To start the app open TWO terminals:"
echo ""
echo "  Terminal 1 (backend):"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    python app.py"
echo ""
echo "  Terminal 2 (frontend):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo "  Demo password for all accounts: Demo@1234"
echo "  Officer  : BSF-2024-0042"
echo "  Traveller: P8821456X"
echo "  NGO      : NGO-CARE-001"
echo "================================================"

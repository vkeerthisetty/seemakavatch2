@echo off
echo ==========================================
echo  SeemaKavatch - Starting Backend Server
echo ==========================================
cd /d "%~dp0backend"

echo Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from python.org
    pause
    exit /b
)

echo.
echo Setting up virtual environment...
if not exist venv (
    python -m venv venv
    echo Virtual environment created.
)

echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Installing packages...
pip install flask flask-cors flask-jwt-extended python-dotenv bcrypt qrcode --quiet

echo.
echo Seeding database...
python seed_db.py

echo.
echo ==========================================
echo  Backend running at http://localhost:5000
echo  Keep this window OPEN
echo ==========================================
echo.
python app.py
pause

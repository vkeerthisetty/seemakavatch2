@echo off
echo ==========================================
echo  SeemaKavatch - Starting Frontend
echo ==========================================
cd /d "%~dp0frontend"

echo Checking Node...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from nodejs.org
    pause
    exit /b
)

echo.
echo Installing packages (first time takes a few minutes)...
call npm install

echo.
echo ==========================================
echo  Frontend running at http://localhost:5173
echo  Opening browser...
echo  Keep this window OPEN
echo ==========================================
echo.
start http://localhost:5173
call npm run dev
pause

@echo off
echo ========================================================
echo Trident - Automated Startup Script
echo ========================================================
echo.

cd "%~dp0"

:: Check and setup Backend
echo [1/2] Checking Backend (Python)...
cd backend
if not exist ".venv\" (
    echo Creating Python virtual environment...
    python -m venv .venv
)
echo Activating virtual environment and installing/updating dependencies...
call .venv\Scripts\activate
pip install -r requirements.txt
echo Starting Backend Server...
start "Trident Backend" cmd /k "call .venv\Scripts\activate && uvicorn main:app --reload"
cd ..

:: Check and setup Frontend
echo.
echo [2/2] Checking Frontend (Node.js)...
cd frontend
if not exist "node_modules\" (
    echo Installing Node dependencies (this may take a minute)...
    call npm install
)
echo Starting Frontend Server...
start "Trident Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ========================================================
echo Both servers are starting in separate windows!
echo Please wait a few seconds, then open your browser to:
echo http://localhost:3000
echo ========================================================
pause

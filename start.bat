@echo off
echo Starting Tip Distribution Application
echo =========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Please install Node.js v18 or higher.
    pause
    exit /b
)

echo Python and Node.js are installed
echo.

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

echo.

REM Install Node.js dependencies
echo Installing Node.js dependencies...
call npm install

echo.
echo All dependencies installed!
echo.
echo Starting servers...
echo.

REM Start backend in a new window
echo Starting backend server on port 8000...
start "Backend Server" cmd /k python backend.py

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend
echo Starting frontend server on port 3000...
echo.
echo =========================================
echo Application is ready!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo =========================================
echo.
echo Close both terminal windows to stop the servers
echo.

call npm run dev

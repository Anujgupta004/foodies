@echo off
title FOODIES.COM - Full Stack Backend
color 0B

echo.
echo  =============================================
echo   FOODIES.COM - Starting Full Stack Backend
echo  =============================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js not installed!
    echo  Download: https://nodejs.org
    pause & exit /b
)

REM Check .env is filled
findstr /c:"XXXXX" "backend\.env" >nul 2>&1
if %errorlevel% equ 0 (
    echo  WARNING: backend\.env still has placeholder values!
    echo.
    echo  You need to fill in:
    echo    1. MONGO_URI  - from mongodb.com/atlas
    echo    2. RAZORPAY_KEY_ID  - from dashboard.razorpay.com
    echo    3. RAZORPAY_KEY_SECRET
    echo.
    echo  Press any key to open .env for editing...
    pause >nul
    notepad backend\.env
    echo.
    echo  After saving .env, press any key to start server...
    pause >nul
)

echo  Starting backend server...
echo  Open browser: http://localhost:5000
echo  Press Ctrl+C to stop
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

cd backend && node server.js

pause

@echo off
title FOODIES.COM — MongoDB Server
color 0A

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║   FOODIES.COM — Starting MongoDB Server   ║
echo  ╚═══════════════════════════════════════════╝
echo.

cd /d "%~dp0backend"

:: Check if node_modules exists
if not exist "node_modules" (
    echo  Installing dependencies...
    npm install
    echo.
)

echo  Starting server with MongoDB...
echo  Open browser: http://localhost:5000
echo.

node server-mongo.js

pause

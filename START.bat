@echo off
title FOODIES.COM — MongoDB Server
color 0A
echo.
echo  =============================================
echo   FOODIES.COM — Full Stack Food Ordering App
echo  =============================================
echo.
echo  Launching with MongoDB database...
echo.
timeout /t 2 /nobreak >nul
start "" "http://localhost:5000"
node backend/server-mongo.js
pause

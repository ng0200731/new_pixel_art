@echo off
REM Broadloom Application Startup Script
REM This script starts PostgreSQL, Backend Server, and opens the Web App

title Broadloom Startup
color 0A

echo ========================================
echo    Broadloom Image Converter
echo    Starting Application...
echo ========================================
echo.

REM Step 1: Start PostgreSQL
echo [Step 1/3] Starting PostgreSQL Database...
net start postgresql-x64-15 >nul 2>&1
if %errorlevel% equ 0 (
    echo   SUCCESS - PostgreSQL is running
) else (
    echo   INFO - PostgreSQL may already be running
)
echo.

REM Step 2: Start Backend Server
echo [Step 2/3] Starting Backend API Server...
echo   Opening backend in new window...
start "Broadloom Backend" cmd /k "cd backend && echo Starting backend server... && npm start"

REM Wait for backend to start
echo   Waiting for backend to initialize...
timeout /t 5 /nobreak >nul
echo   Backend should be running at http://localhost:3000
echo.

REM Step 3: Open Frontend
echo [Step 3/3] Opening Web Application...
start "" index.html
timeout /t 2 /nobreak >nul
echo   Web app opened in browser
echo.

echo ========================================
echo   APPLICATION STARTED SUCCESSFULLY!
echo ========================================
echo.
echo   Backend API: http://localhost:3000
echo   Health Check: http://localhost:3000/health
echo   Frontend: index.html (opened in browser)
echo.
echo ========================================
echo   HOW TO STOP:
echo ========================================
echo   1. Close the browser
echo   2. Close the "Broadloom Backend" window
echo      (or press Ctrl+C in that window)
echo.
echo ========================================
echo.
echo Press any key to exit this window...
echo (Backend will keep running)
pause >nul



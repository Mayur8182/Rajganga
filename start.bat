@echo off
title Raj Ganga Hostel - Attendance System
color 0A
echo.
echo ===================================================
echo   RAJ GANGA GOPALAK CHATRALAYA
echo   Hostel Attendance Management System
echo ===================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

:: Check MongoDB
echo [*] Checking MongoDB...
where mongod >nul 2>&1
if errorlevel 1 (
    echo [WARNING] mongod not found in PATH.
    echo           Make sure MongoDB is running!
    echo           Start MongoDB manually if needed.
    echo.
) else (
    echo [OK] MongoDB found.
)

:: Install dependencies
echo [*] Installing required packages...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] Failed to install packages.
    pause
    exit /b 1
)

echo.
echo [OK] All packages installed.
echo.
echo ===================================================
echo   Starting server at: http://localhost:5000
echo   Admin Login: username=admin  password=admin@123
echo ===================================================
echo.

:: Start Flask
python app.py

pause

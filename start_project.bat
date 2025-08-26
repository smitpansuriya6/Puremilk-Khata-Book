@echo off
echo ========================================
echo    MilkWeb Project Startup Script
echo ========================================
echo.

echo Step 1: Starting Backend Server...
echo ----------------------------------------
cd /d "%~dp0backend"

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Starting backend server in background...
start "MilkWeb Backend" cmd /k "python server.py"

echo Waiting for backend to start...
timeout /t 8 /nobreak >nul

echo.
echo Step 2: Creating Admin Account...
echo ----------------------------------------
cd /d "%~dp0"

echo Running admin creation script...
python create_admin.py

echo.
echo Step 3: Starting Frontend...
echo ----------------------------------------
cd /d "%~dp0frontend"

echo Starting frontend development server...
start "MilkWeb Frontend" cmd /k "yarn start"

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:8001
echo 📊 API Docs: http://localhost:8001/docs
echo.
echo 👤 Admin Login:
echo    Email: admin@puremilk.com
echo    Password: admin123456
echo.
echo Press any key to exit...
pause >nul


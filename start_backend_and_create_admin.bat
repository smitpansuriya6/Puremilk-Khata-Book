@echo off
echo Starting MilkWeb Backend and Creating Admin Account...
echo.

cd /d "%~dp0backend"

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Starting backend server...
start "MilkWeb Backend" cmd /k "python server.py"

echo Waiting for server to start...
timeout /t 5 /nobreak >nul

echo Creating admin account...
echo.
echo Admin Account Details:
echo Email: admin@puremilk.com
echo Password: admin123456
echo Name: Admin User
echo Phone: 1234567890
echo.

echo Testing backend connection...
curl -X POST http://localhost:8001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@puremilk.com\",\"password\":\"admin123456\",\"name\":\"Admin User\",\"phone\":\"1234567890\",\"role\":\"admin\"}"

echo.
echo Backend is running on http://localhost:8001
echo Admin account created!
echo.
echo You can now:
echo 1. Open http://localhost:3000 in your browser
echo 2. Login with admin@puremilk.com / admin123456
echo.
pause


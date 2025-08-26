@echo off
echo ========================================
echo    MongoDB Setup for MilkWeb
echo ========================================
echo.

echo Checking if MongoDB is already running...
netstat -an | findstr ":27017" >nul
if %errorlevel% == 0 (
    echo ✅ MongoDB is already running on port 27017
    goto :end
)

echo Checking if Docker is available...
docker --version >nul 2>&1
if %errorlevel% == 0 (
    echo 🐳 Docker found! Using Docker MongoDB...
    echo.
    echo Creating MongoDB container...
    docker run -d --name milk-mongo -p 27017:27017 -v milkdata:/data/db mongo:7
    
    echo Waiting for MongoDB to start...
    timeout /t 5 /nobreak >nul
    
    echo ✅ MongoDB started with Docker
    echo Container name: milk-mongo
    echo Port: 27017
    echo.
    echo To stop MongoDB: docker stop milk-mongo
    echo To start MongoDB: docker start milk-mongo
    echo To remove MongoDB: docker rm milk-mongo
) else (
    echo ❌ Docker not found
    echo.
    echo 📋 Manual MongoDB Setup Options:
    echo.
    echo Option 1: Install MongoDB Community Edition
    echo 1. Download from: https://www.mongodb.com/try/download/community
    echo 2. Install MongoDB as a service
    echo 3. MongoDB will run on port 27017
    echo.
    echo Option 2: Install MongoDB via Chocolatey
    echo 1. Install Chocolatey: https://chocolatey.org/install
    echo 2. Run: choco install mongodb
    echo 3. Start MongoDB service
    echo.
    echo Option 3: Use MongoDB Atlas (Cloud)
    echo 1. Go to: https://www.mongodb.com/atlas
    echo 2. Create free cluster
    echo 3. Update backend\.env with connection string
    echo.
    echo ⚠️  Please install MongoDB manually and restart this script
)

:end
echo.
echo 🎯 Next steps:
echo 1. Run: fix_backend.bat
echo 2. Or run: start_project.bat
echo.
echo Press any key to exit...
pause >nul


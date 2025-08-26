# 🥛 MilkWeb - Quick Start Guide

## 🚀 One-Click Setup

**Easiest way to start the project:**

1. **If backend doesn't work:** Double-click `fix_backend.bat`
2. **If MongoDB is missing:** Double-click `setup_mongodb.bat`
3. **For complete setup:** Double-click `start_project.bat`
4. Open http://localhost:3000 in your browser
5. Login with admin credentials

## 👤 Admin Account

**Default admin credentials:**
- **Email:** `admin@puremilk.com`
- **Password:** `admin123456`
- **Name:** Admin User
- **Phone:** 1234567890

## 🔧 Manual Setup (if needed)

### Prerequisites
- Python 3.10+ installed
- Node.js 20+ installed
- MongoDB running (or Docker)

### Step 1: Setup MongoDB
```powershell
# Option A: Using Docker (recommended)
docker run -d --name milk-mongo -p 27017:27017 mongo:7

# Option B: Install MongoDB Community Edition
# Download from: https://www.mongodb.com/try/download/community
```

### Step 2: Fix Backend Issues
```powershell
# Run diagnostic and fix script
python diagnose_backend.py
fix_backend.bat
```

### Step 3: Start Backend
```powershell
cd backend
.\.venv\Scripts\Activate
python server.py
```

### Step 4: Create Admin Account
```powershell
python create_admin.py
```

### Step 5: Start Frontend
```powershell
cd frontend
yarn start
```

## 🌐 Access URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **API Documentation:** http://localhost:8001/docs
- **Health Check:** http://localhost:8001/api/health

## 🐛 Troubleshooting

### Backend not starting?

**Common Issues & Solutions:**

1. **MongoDB not running**
   ```powershell
   # Check if MongoDB is running
   netstat -an | findstr ":27017"
   
   # Start with Docker
   docker run -d --name milk-mongo -p 27017:27017 mongo:7
   
   # Or use setup script
   setup_mongodb.bat
   ```

2. **Virtual environment issues**
   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate
   pip install -r requirements.txt
   ```

3. **Missing .env file**
   ```powershell
   # Create .env file in backend folder
   echo MONGO_URL=mongodb://localhost:27017> backend\.env
   echo DB_NAME=puremilk_dev>> backend\.env
   echo JWT_SECRET=dev-secret-change-me>> backend\.env
   echo CORS_ORIGINS=*>> backend\.env
   echo ALLOWED_HOSTS=*>> backend\.env
   echo JWT_EXPIRY_DAYS=7>> backend\.env
   ```

4. **Port 8001 in use**
   ```powershell
   # Find what's using port 8001
   netstat -ano | findstr :8001
   
   # Kill the process (replace PID with actual process ID)
   taskkill /PID <PID> /F
   ```

5. **Python version issues**
   ```powershell
   # Check Python version
   python --version
   
   # Should be 3.10 or higher
   # Install from: https://www.python.org/downloads/
   ```

### Frontend not starting?

1. **Node.js version too old**
   ```powershell
   node --version
   # Should be 20+ for react-router-dom v7
   
   # Install Node.js 20+ from: https://nodejs.org/
   ```

2. **Yarn not installed**
   ```powershell
   npm install -g yarn@1.22.22
   # Or use npm instead: npm install && npm start
   ```

3. **Dependencies not installed**
   ```powershell
   cd frontend
   yarn install
   # Or: npm install
   ```

### Login issues?

1. **Backend not running**
   - Check if backend is on http://localhost:8001
   - Run `fix_backend.bat`

2. **Admin account not created**
   ```powershell
   python create_admin.py
   ```

3. **Wrong credentials**
   - Use exactly: `admin@puremilk.com` / `admin123456`
   - Check for typos

### Network timeout errors?

1. **Backend not responding**
   - Run diagnostic: `python diagnose_backend.py`
   - Check MongoDB is running
   - Check virtual environment is activated

2. **CORS issues**
   - Ensure backend .env has `CORS_ORIGINS=*`
   - Check backend is running on correct port

## 🔍 Diagnostic Tools

**Run these scripts to identify issues:**

1. **`diagnose_backend.py`** - Comprehensive backend diagnostics
2. **`fix_backend.bat`** - Automatic backend fixes
3. **`setup_mongodb.bat`** - MongoDB setup helper

## 📱 Features

- **Admin Panel:** Manage customers, deliveries, payments
- **Customer Portal:** View deliveries and payments
- **Dashboard:** Real-time statistics and analytics
- **Responsive Design:** Works on desktop and mobile

## 🔐 Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization

## 🆘 Still having issues?

1. **Run diagnostics:** `python diagnose_backend.py`
2. **Check logs:** Look at backend console output
3. **Verify MongoDB:** Ensure it's running on port 27017
4. **Check ports:** Ensure 8001 and 3000 are available
5. **Update dependencies:** Run `pip install -r requirements.txt` in backend

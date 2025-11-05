# 🚀 How to Start the Application

Simple guide to get everything running.

---

## 🎯 First Time Setup (Do Once)

### Step 1: Install PostgreSQL

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Run installer
3. Remember your password!
4. Keep default port: `5432`

**macOS:**
```bash
brew install postgresql@15
```

**Linux:**
```bash
sudo apt install postgresql
```

### Step 2: Create Database

**Windows (Command Prompt):**
```cmd
cd "C:\Program Files\PostgreSQL\15\bin"
psql -U postgres

# Type your password, then:
CREATE DATABASE broadloom;
\q
```

**macOS/Linux:**
```bash
psql -U postgres
# Type password, then:
CREATE DATABASE broadloom;
\q
```

### Step 3: Setup Backend

```bash
# Go to backend folder
cd backend

# Install packages
npm install

# Copy config file
cp .env.example .env

# IMPORTANT: Edit .env and set your PostgreSQL password!
# Windows: notepad .env
# macOS: open .env
# Linux: nano .env
```

**Edit `.env` file:**
```env
DB_PASSWORD=your_postgres_password_here
```

### Step 4: Initialize Database

**Windows:**
```cmd
cd "C:\Program Files\PostgreSQL\15\bin"
psql -U postgres -d broadloom -f "D:\project\pixelart2\backend\schema.sql"
```

**macOS/Linux:**
```bash
cd backend
psql -U postgres -d broadloom -f schema.sql
```

---

## ▶️ Every Time You Start (Normal Usage)

### Option A: Windows Users

**Create a startup script:**

Create `START.bat` in project root:
```batch
@echo off
echo Starting Broadloom Application...
echo.

echo [1/3] Starting PostgreSQL...
net start postgresql-x64-15
echo PostgreSQL started!
echo.

echo [2/3] Starting Backend Server...
start cmd /k "cd backend && npm start"
timeout /t 3
echo Backend started!
echo.

echo [3/3] Opening Web App...
start index.html
echo.

echo ========================================
echo ✅ Application is running!
echo ========================================
echo Backend: http://localhost:3000
echo Frontend: Opened in browser
echo.
echo Press any key to stop all services...
pause > nul

echo.
echo Stopping backend server...
taskkill /F /FI "WINDOWTITLE eq Node.js*"
echo Done!
```

**Then just double-click `START.bat`** ✨

### Option B: Manual Start

#### 1. Start PostgreSQL

**Windows:**
- Press `Win + R`
- Type `services.msc`
- Find `postgresql-x64-15`
- Right-click → Start

**macOS:**
```bash
brew services start postgresql@15
```

**Linux:**
```bash
sudo systemctl start postgresql
```

#### 2. Start Backend Server

```bash
cd backend
npm start
```

You should see:
```
============================================================
🚀 Broadloom Pattern API Server
============================================================
✅ Server running on: http://localhost:3000
```

**Keep this terminal window open!**

#### 3. Start Frontend

**Option 1: Double-click `index.html`**

**Option 2: Use a local server:**
```bash
# If you have Python
python -m http.server 8080

# If you have Node.js http-server
npx http-server -p 8080
```

Then open: http://localhost:8080

---

## ✅ Verify Everything is Working

### 1. Check Backend
Open browser: http://localhost:3000/health

Should see:
```json
{
  "status": "ok",
  "timestamp": "2024-11-05T...",
  "uptime": 12.345
}
```

### 2. Check Database
```bash
psql -U postgres -d broadloom -c "SELECT COUNT(*) FROM patterns;"
```

Should see:
```
 count 
-------
     0
(1 row)
```

### 3. Test Web App
1. Open `index.html`
2. Upload an image
3. Click "Convert Image"
4. Upload a pattern
5. Refresh page
6. Pattern should still be there ✅

---

## 🛑 How to Stop

### Windows
1. Close browser
2. In backend terminal: Press `Ctrl + C`
3. (Optional) Stop PostgreSQL:
   - `services.msc` → postgresql → Stop

### macOS/Linux
1. Close browser
2. In backend terminal: Press `Ctrl + C`
3. (Optional) Stop PostgreSQL:
   ```bash
   # macOS
   brew services stop postgresql@15
   
   # Linux
   sudo systemctl stop postgresql
   ```

---

## 🔧 Troubleshooting

### Backend won't start

**Error:** `Failed to connect to database`

**Solution:**
```bash
# 1. Check PostgreSQL is running
# Windows: services.msc → postgresql → Status should be "Running"
# macOS: brew services list
# Linux: sudo systemctl status postgresql

# 2. Check credentials in backend/.env
# Make sure DB_PASSWORD matches your PostgreSQL password

# 3. Test connection manually
psql -U postgres -d broadloom
```

---

### Port 3000 already in use

**Error:** `Port 3000 already in use`

**Solution 1 - Change port:**
Edit `backend/.env`:
```env
PORT=3001
```

Restart backend.

**Solution 2 - Kill process:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F

# macOS/Linux
lsof -ti:3000 | xargs kill
```

---

### Frontend can't connect to backend

**Error in browser console:** `Failed to fetch` or `CORS error`

**Solution:**
1. Make sure backend is running: http://localhost:3000/health
2. Check `app.js` line 7:
   ```javascript
   const API_BASE_URL = 'http://localhost:3000/api';
   ```
3. If you changed backend port, update this line
4. Clear browser cache: `Ctrl + Shift + Delete`

---

## 📋 Quick Reference

### Check if PostgreSQL is running

```bash
# Windows
sc query postgresql-x64-15

# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Any platform
psql -U postgres -c "SELECT version();"
```

### Check if Backend is running

```bash
# PowerShell/CMD
curl http://localhost:3000/health

# PowerShell (alternative)
Invoke-WebRequest http://localhost:3000/health

# Browser
http://localhost:3000/health
```

### View Database

```bash
psql -U postgres -d broadloom

# Inside psql:
\dt                              # List tables
SELECT * FROM patterns;          # View patterns
SELECT COUNT(*) FROM patterns;   # Count patterns
\q                               # Quit
```

---

## 💡 Tips

### Auto-start PostgreSQL (Windows)
1. `services.msc`
2. Find `postgresql-x64-15`
3. Right-click → Properties
4. Startup type: `Automatic`
5. Click OK

Now PostgreSQL starts with Windows!

### Auto-restart Backend on code changes
```bash
cd backend
npm run dev
```

Uses `nodemon` - auto-restarts when you edit files.

### Keep Backend running in background

**Windows (PowerShell):**
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start"
```

**macOS/Linux:**
```bash
cd backend
npm start &
```

---

## 🎯 Typical Development Workflow

```bash
# Morning: Start everything
brew services start postgresql@15  # macOS (once)
cd backend && npm run dev          # Terminal 1 (keep open)

# Open browser
# Double-click index.html

# Work on your app...

# Evening: Stop
# Ctrl+C in Terminal 1
# Close browser
# (Leave PostgreSQL running)
```

---

## 📦 Production Deployment (Future)

When ready to deploy:

1. **Backend → Cloud Server**
   - Heroku: `git push heroku main`
   - AWS: Deploy to EC2/ECS
   - Vercel/Netlify: Deploy serverless functions

2. **Database → Cloud Database**
   - Supabase (easiest, free)
   - AWS RDS
   - Heroku Postgres
   - Google Cloud SQL

3. **Frontend → Static Hosting**
   - GitHub Pages
   - Netlify
   - Vercel
   - AWS S3 + CloudFront

---

## ✨ You're Ready!

**To start working:**
1. ✅ PostgreSQL running
2. ✅ Backend running (`npm start`)
3. ✅ Frontend open (`index.html`)

**Happy coding!** 🎨



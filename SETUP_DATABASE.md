# 🗄️ Database Setup Guide - Broadloom Pattern Storage

This guide will help you set up the local PostgreSQL database for storing pattern images.

## 📋 Quick Start Checklist

- [ ] Install PostgreSQL
- [ ] Create database
- [ ] Install Node.js dependencies
- [ ] Configure environment variables
- [ ] Run database schema
- [ ] Start backend server
- [ ] Test API connection

## Step-by-Step Instructions

### 1️⃣ Install PostgreSQL

#### Windows
1. Download installer: https://www.postgresql.org/download/windows/
2. Run installer (recommended: PostgreSQL 15 or higher)
3. During installation:
   - Port: `5432` (default)
   - Username: `postgres`
   - Password: **Choose a strong password and remember it!**
4. Install pgAdmin 4 (optional GUI tool)

#### macOS
```bash
# Using Homebrew
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2️⃣ Create Database

#### Using Command Line

**Windows (PowerShell or CMD):**
```powershell
# Navigate to PostgreSQL bin directory
cd "C:\Program Files\PostgreSQL\15\bin"

# Connect to PostgreSQL
.\psql.exe -U postgres

# Create database
CREATE DATABASE broadloom;

# Quit
\q
```

**macOS/Linux:**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE broadloom;

# Quit
\q
```

#### Using pgAdmin (GUI)
1. Open pgAdmin 4
2. Right-click "Databases" → "Create" → "Database"
3. Name: `broadloom`
4. Click "Save"

### 3️⃣ Install Backend Dependencies

```bash
# Navigate to backend folder
cd backend

# Install Node.js packages
npm install
```

This will install:
- `express` - Web server framework
- `pg` - PostgreSQL client
- `cors` - Enable cross-origin requests
- `dotenv` - Environment variable management
- `body-parser` - Parse JSON requests
- `nodemon` - Auto-restart during development

### 4️⃣ Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit .env file
# Windows: notepad .env
# macOS: open -e .env
# Linux: nano .env
```

Update `.env` with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=broadloom
DB_USER=postgres
DB_PASSWORD=your_password_here  # Change this!
PORT=3000
```

### 5️⃣ Initialize Database Schema

```bash
# Windows (from backend folder)
cd "C:\Program Files\PostgreSQL\15\bin"
.\psql.exe -U postgres -d broadloom -f "D:\project\pixelart2\backend\schema.sql"

# macOS/Linux (from backend folder)
psql -U postgres -d broadloom -f schema.sql
```

You should see: `Database schema created successfully!`

### 6️⃣ Start Backend Server

```bash
# From backend folder
npm start

# Or for development (auto-restart on changes):
npm run dev
```

Expected output:
```
============================================================
🚀 Broadloom Pattern API Server
============================================================
✅ Server running on: http://localhost:3000
✅ API endpoint: http://localhost:3000/api/patterns
✅ Health check: http://localhost:3000/health
============================================================
```

### 7️⃣ Test API Connection

#### Browser Test
Open browser and navigate to:
- http://localhost:3000/health

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-11-05T...",
  "uptime": 12.345
}
```

#### Test Pattern API
- http://localhost:3000/api/patterns

You should see:
```json
{
  "success": true,
  "count": 0,
  "patterns": []
}
```

### 8️⃣ Open Frontend

1. Open `index.html` in your browser
2. The app will automatically connect to the backend
3. Upload a pattern image - it will be saved to the database
4. Refresh the page - patterns should still be there!

---

## ✅ Verification

### Check Database Connection
```bash
# Windows
cd "C:\Program Files\PostgreSQL\15\bin"
.\psql.exe -U postgres -d broadloom -c "SELECT * FROM patterns;"

# macOS/Linux
psql -U postgres -d broadloom -c "SELECT * FROM patterns;"
```

### Check Server Status
```bash
# Check if backend is running
curl http://localhost:3000/health

# Or in PowerShell:
Invoke-WebRequest http://localhost:3000/health
```

---

## 🔧 Troubleshooting

### "Failed to connect to database"

**Problem:** Backend can't connect to PostgreSQL

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   # Windows
   services.msc  # Look for "postgresql" service
   
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Verify credentials in `.env` file
3. Test connection manually:
   ```bash
   psql -U postgres -d broadloom
   ```

### "Port 3000 already in use"

**Problem:** Another app is using port 3000

**Solutions:**
1. Change port in `.env`:
   ```env
   PORT=3001
   ```

2. Or kill the process:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   ```

### "relation patterns does not exist"

**Problem:** Database schema not initialized

**Solution:**
```bash
# Run schema.sql again
psql -U postgres -d broadloom -f backend/schema.sql
```

### "CORS error" in browser console

**Problem:** Frontend can't connect to backend

**Solution:**
1. Make sure backend is running (`npm start`)
2. Check `API_BASE_URL` in `app.js` matches your backend port
3. Clear browser cache and reload

### "npm install" fails

**Problem:** Node.js not installed or wrong version

**Solution:**
1. Install Node.js 14+ from https://nodejs.org/
2. Verify: `node --version` (should be v14.0.0 or higher)
3. Try again: `npm install`

---

## 📊 Database Management

### View All Patterns
```sql
SELECT id, name, width, height, rotation, created_at 
FROM patterns 
ORDER BY created_at DESC;
```

### Delete a Pattern
```sql
DELETE FROM patterns WHERE id = 1;
```

### Clear All Patterns
```sql
TRUNCATE TABLE patterns CASCADE;
```

### Backup Database
```bash
# Backup
pg_dump -U postgres broadloom > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres broadloom < backup_20241105.sql
```

---

## 🌐 Future: Cloud Migration

When you're ready to move to cloud:

### Option 1: AWS RDS
1. Create PostgreSQL RDS instance
2. Update `.env` with RDS endpoint
3. Run schema.sql on RDS
4. Deploy backend to EC2/ECS

### Option 2: Google Cloud SQL
1. Create Cloud SQL PostgreSQL instance
2. Update `.env` with Cloud SQL connection
3. Run schema.sql
4. Deploy to Cloud Run

### Option 3: Heroku
```bash
heroku create broadloom-api
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set DB_HOST=... DB_PORT=... DB_NAME=... DB_USER=... DB_PASSWORD=...
git push heroku main
```

### Option 4: Supabase (Easiest)
1. Create Supabase project (free tier includes PostgreSQL)
2. Run schema.sql in SQL Editor
3. Get connection string from Settings
4. Update `.env`
5. No backend deployment needed - can use Supabase client directly!

---

## 📝 Development Tips

### Auto-restart on Code Changes
```bash
npm run dev  # Uses nodemon
```

### View Server Logs
```bash
# Real-time logs
npm start

# Save to file
npm start > server.log 2>&1
```

### Database GUI Tools
- **pgAdmin** - Full-featured, comes with PostgreSQL
- **DBeaver** - Cross-platform, supports many databases
- **TablePlus** - Modern, beautiful UI (paid)

---

## 🔐 Security Notes

**For Production:**
1. ✅ Use strong database passwords
2. ✅ Enable SSL for database connections
3. ✅ Add authentication to API (JWT tokens)
4. ✅ Rate limiting to prevent abuse
5. ✅ Input validation and sanitization
6. ✅ HTTPS only (no HTTP)
7. ✅ Keep dependencies updated

**Current Setup:** ⚠️ Development only - NOT production-ready!

---

## 📞 Support

### Common Commands

```bash
# Start PostgreSQL
# Windows: services.msc → Start "postgresql"
# macOS: brew services start postgresql@15
# Linux: sudo systemctl start postgresql

# Stop PostgreSQL
# Windows: services.msc → Stop "postgresql"
# macOS: brew services stop postgresql@15
# Linux: sudo systemctl stop postgresql

# Start Backend
cd backend
npm start

# Check Backend Status
curl http://localhost:3000/health
```

### Log Locations

- **PostgreSQL logs:** `C:\Program Files\PostgreSQL\15\data\log\` (Windows)
- **Backend logs:** Console output (or redirect to file)
- **Browser logs:** F12 Developer Tools → Console

---

## ✨ Success!

If you can:
- ✅ Visit http://localhost:3000/health and see `"status": "ok"`
- ✅ Upload a pattern in the web app
- ✅ Refresh the page and see the pattern still there
- ✅ See the pattern in database: `SELECT * FROM patterns;`

**You're all set!** 🎉

The patterns are now being stored in your local PostgreSQL database and will persist even after closing the browser.



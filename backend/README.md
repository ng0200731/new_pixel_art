# 🗄️ Broadloom Pattern Storage - Backend API

Backend server for storing and managing pattern images for the Broadloom Image Converter.

## 📋 Prerequisites

1. **Node.js** (v14 or higher)
   - Download: https://nodejs.org/
   
2. **PostgreSQL** (v12 or higher)
   - Download: https://www.postgresql.org/download/
   - Or use Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres`

## 🚀 Quick Start

### Step 1: Install PostgreSQL

#### Windows:
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run installer (keep default port 5432)
3. Set password for `postgres` user (remember this!)
4. Install pgAdmin (optional, for GUI management)

#### macOS:
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create Database

Open PostgreSQL command line or pgAdmin and run:

```sql
CREATE DATABASE broadloom;
```

Or use command line:
```bash
# Windows (in Command Prompt as postgres user)
psql -U postgres
CREATE DATABASE broadloom;
\q

# macOS/Linux
sudo -u postgres psql
CREATE DATABASE broadloom;
\q
```

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

### Step 4: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings
# Windows: notepad .env
# macOS/Linux: nano .env
```

Update `.env` with your PostgreSQL credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=broadloom
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
```

### Step 5: Initialize Database Schema

```bash
# Windows (Command Prompt)
psql -U postgres -d broadloom -f schema.sql

# macOS/Linux
psql -U postgres -d broadloom -f schema.sql

# Or connect to database first, then run:
psql -U postgres -d broadloom
\i schema.sql
\q
```

### Step 6: Start Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

You should see:
```
============================================================
🚀 Broadloom Pattern API Server
============================================================
✅ Server running on: http://localhost:3000
✅ API endpoint: http://localhost:3000/api/patterns
✅ Health check: http://localhost:3000/health
============================================================
```

### Step 7: Test the API

Open browser and navigate to:
- http://localhost:3000/health

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "uptime": 12.345
}
```

## 📡 API Endpoints

### Get All Patterns
```http
GET /api/patterns
```

Response:
```json
{
  "success": true,
  "count": 2,
  "patterns": [
    {
      "id": 1,
      "name": "Pattern 1",
      "image_data": "data:image/png;base64,...",
      "width": 100,
      "height": 100,
      "rotation": 0,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Create New Pattern
```http
POST /api/patterns
Content-Type: application/json

{
  "name": "My Pattern",
  "image_data": "data:image/png;base64,iVBORw0KG...",
  "width": 100,
  "height": 100,
  "rotation": 0
}
```

### Update Pattern Rotation
```http
PUT /api/patterns/1
Content-Type: application/json

{
  "rotation": 45
}
```

### Delete Pattern
```http
DELETE /api/patterns/1
```

### Check Pattern Applications
```http
GET /api/patterns/1/applications
```

### Mark Pattern as Applied
```http
POST /api/patterns/1/apply
Content-Type: application/json

{
  "color_index": 3
}
```

## 🔧 Troubleshooting

### "Failed to connect to database"
- Make sure PostgreSQL is running: `pg_isready` (Linux/macOS)
- Check credentials in `.env` file
- Verify database exists: `psql -U postgres -l`

### "Port 3000 already in use"
- Change `PORT` in `.env` file
- Or kill process using port: 
  - Windows: `netstat -ano | findstr :3000` then `taskkill /PID <PID> /F`
  - macOS/Linux: `lsof -ti:3000 | xargs kill`

### "relation patterns does not exist"
- Run schema.sql again: `psql -U postgres -d broadloom -f schema.sql`

## 🌐 Cloud Migration (Future)

This setup is designed for easy cloud migration:

### AWS RDS (PostgreSQL)
1. Create RDS PostgreSQL instance
2. Update `.env` with RDS endpoint
3. Run schema.sql on RDS
4. Deploy backend to EC2/ECS/Lambda

### Google Cloud SQL
1. Create Cloud SQL PostgreSQL instance
2. Update `.env` with connection details
3. Run schema.sql
4. Deploy to Cloud Run/App Engine

### Heroku
```bash
heroku create
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set DB_HOST=... DB_PORT=... DB_NAME=... DB_USER=... DB_PASSWORD=...
git push heroku main
```

### Supabase
1. Create Supabase project (comes with PostgreSQL)
2. Run schema.sql in SQL Editor
3. Get connection string from Settings
4. Update `.env`

## 📁 Project Structure

```
backend/
├── server.js           # Main Express server
├── db.js              # Database connection
├── routes/
│   └── patterns.js    # Pattern API routes
├── schema.sql         # Database schema
├── package.json       # Dependencies
├── .env.example       # Environment template
└── README.md          # This file
```

## 🔐 Security Notes

**For Production:**
1. Use strong database passwords
2. Enable SSL for database connections
3. Add rate limiting (express-rate-limit)
4. Add authentication (JWT tokens)
5. Validate and sanitize all inputs
6. Use environment variables for secrets
7. Enable HTTPS

## 📝 Maintenance

### Backup Database
```bash
pg_dump -U postgres broadloom > backup.sql
```

### Restore Database
```bash
psql -U postgres broadloom < backup.sql
```

### View Logs
```bash
# If using systemd
journalctl -u broadloom-backend -f

# Or just redirect output
npm start > server.log 2>&1
```

## 🆘 Support

For issues, check:
1. PostgreSQL is running: `pg_isready`
2. Database exists: `psql -U postgres -l`
3. Server logs: Check console output
4. Network: Port 3000 is accessible

## 📜 License

MIT



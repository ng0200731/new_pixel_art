# 🚀 Quick Start - Pattern Database

## What Changed?

Patterns are now saved in a **PostgreSQL database** instead of browser memory. This means:
- ✅ Patterns persist across page refreshes
- ✅ No size limits (vs browser localStorage limits)
- ✅ Easy to backup/restore
- ✅ Can migrate to cloud later

## Files Added

```
project/
├── backend/                    # NEW: Backend server
│   ├── package.json           # Node.js dependencies
│   ├── server.js              # Express API server
│   ├── db.js                  # Database connection
│   ├── routes/patterns.js     # API endpoints
│   ├── schema.sql             # Database schema
│   ├── .env.example           # Config template
│   └── README.md              # Detailed backend docs
├── SETUP_DATABASE.md          # Full setup guide (this file)
└── QUICKSTART_DATABASE.md     # Quick start (you're reading it!)
```

## Frontend Changes

- **app.js** (v2.9.90):
  - Added API integration
  - Patterns load from database on page load
  - Patterns auto-save to database on upload
  - Rotation/deletion syncs with database
  - Fallback to memory if database unavailable

- **index.html** (v2.9.90):
  - Version updated

## 3-Minute Setup

### 1. Install PostgreSQL

**Windows:** https://www.postgresql.org/download/windows/
**macOS:** `brew install postgresql@15 && brew services start postgresql@15`
**Linux:** `sudo apt install postgresql && sudo systemctl start postgresql`

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE broadloom;
\q
```

### 3. Setup Backend

```bash
# Install dependencies
cd backend
npm install

# Configure (edit .env with your password)
cp .env.example .env

# Initialize database
psql -U postgres -d broadloom -f schema.sql

# Start server
npm start
```

### 4. Test

1. Open browser: http://localhost:3000/health
2. Should see: `{"status": "ok", ...}`
3. Open `index.html` in browser
4. Upload a pattern
5. Refresh page - pattern should still be there! 🎉

## Verification

```bash
# Check if patterns are in database
psql -U postgres -d broadloom -c "SELECT id, name FROM patterns;"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/patterns` | GET | Get all patterns |
| `/api/patterns` | POST | Upload new pattern |
| `/api/patterns/:id` | PUT | Update rotation |
| `/api/patterns/:id` | DELETE | Delete pattern |
| `/api/patterns/:id/applications` | GET | Check if applied |
| `/health` | GET | Server health check |

## How It Works

```
┌─────────────┐                  ┌─────────────┐                  ┌─────────────┐
│   Browser   │                  │   Backend   │                  │  Database   │
│ (index.html)│                  │ (server.js) │                  │ (PostgreSQL)│
└──────┬──────┘                  └──────┬──────┘                  └──────┬──────┘
       │                                │                                │
       │ 1. Page load                   │                                │
       ├──────────────────────────────>│                                │
       │ GET /api/patterns              │                                │
       │                                ├──────────────────────────────>│
       │                                │ SELECT * FROM patterns         │
       │                                │<───────────────────────────────┤
       │<───────────────────────────────┤ [{id:1, ...}]                  │
       │ [{id:1, dataURL:..., ...}]     │                                │
       │                                │                                │
       │ 2. Upload pattern              │                                │
       ├──────────────────────────────>│                                │
       │ POST /api/patterns             │                                │
       │ {name, dataURL, width, height} ├──────────────────────────────>│
       │                                │ INSERT INTO patterns           │
       │                                │<───────────────────────────────┤
       │<───────────────────────────────┤ {id: 2}                        │
       │ {success: true, pattern: {...}}│                                │
       │                                │                                │
       │ 3. Rotate pattern              │                                │
       ├──────────────────────────────>│                                │
       │ PUT /api/patterns/2            │                                │
       │ {rotation: 45}                 ├──────────────────────────────>│
       │                                │ UPDATE patterns SET rotation=45│
       │                                │<───────────────────────────────┤
       │<───────────────────────────────┤                                │
       │                                │                                │
       │ 4. Delete pattern              │                                │
       ├──────────────────────────────>│                                │
       │ DELETE /api/patterns/2         ├──────────────────────────────>│
       │                                │ DELETE FROM patterns WHERE id=2│
       │                                │<───────────────────────────────┤
       │<───────────────────────────────┤                                │
       └────────────────────────────────┴────────────────────────────────┘
```

## Migration Path to Cloud

When ready for production:

1. **Supabase** (Easiest):
   - Create project at https://supabase.com
   - Run `schema.sql` in SQL Editor
   - Update `.env` with Supabase credentials
   - Done! Free tier: 500MB

2. **AWS RDS**:
   - Create PostgreSQL RDS instance
   - Update `.env` with RDS endpoint
   - Deploy backend to EC2/Lambda

3. **Heroku**:
   ```bash
   heroku create
   heroku addons:create heroku-postgresql
   git push heroku main
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Can't connect to database" | Check PostgreSQL is running: `pg_isready` |
| "Port 3000 in use" | Change `PORT` in `.env` to 3001 |
| "relation patterns does not exist" | Run `schema.sql` again |
| Backend won't start | Check `.env` has correct password |
| Frontend can't reach backend | Ensure backend is running (`npm start`) |

## Data Flow

**Before (v2.9.88):**
```
Upload Pattern → Store in Array → Lost on Refresh ❌
```

**After (v2.9.90):**
```
Upload Pattern → Save to Database → Persists Forever ✅
                     ↓
              Load on Refresh ✅
```

## Development

```bash
# Auto-restart on code changes
npm run dev

# View database
psql -U postgres -d broadloom
\dt              # List tables
SELECT * FROM patterns;
\q

# Backup
pg_dump -U postgres broadloom > backup.sql

# Restore
psql -U postgres broadloom < backup.sql
```

## What Stays the Same?

- ✅ All UI features work exactly the same
- ✅ Pattern rotation, deletion, application
- ✅ Drag & drop functionality
- ✅ All other features unchanged

## What's New?

- ✅ Patterns survive page refresh
- ✅ Patterns survive browser restart
- ✅ Can backup/restore database
- ✅ Ready for cloud deployment
- ✅ No storage limits

---

**Need help?** See `SETUP_DATABASE.md` for detailed instructions.



# Quick Fix Guide - Getting UPM.Plus Working

## Common Issues and Fixes

### Issue 1: Import Errors

**Error**: `ImportError: cannot import name 'X'`

**Fix**: Run the startup test:
```bash
cd backend
python3 test_startup.py
```

This will identify which imports are failing.

### Issue 2: Server Won't Start

**Error**: Server hangs or crashes on startup

**Fix**: The startup process may be waiting for Redis or database. Make them optional:

1. **Make Redis optional** (already done - app continues if Redis fails)
2. **Check database connection** - Make sure SQLite file is writable
3. **Skip optional services** - The app should start even if some services fail

### Issue 3: Billing Endpoints Not Found

**Error**: 404 on `/api/v1/billing/*`

**Fix**: Check if billing router is included:
```bash
grep -r "billing" backend/app/api/v1/api.py
```

If missing, the billing endpoints won't be available.

### Issue 4: Database Errors

**Error**: Database connection or migration errors

**Fix**:
```bash
cd backend
# Run migrations
alembic upgrade head

# Or create fresh database
rm test.db
alembic upgrade head
```

### Issue 5: Redis Connection Errors

**Error**: Redis connection failed

**Fix**: Redis is optional. The app will work without it, but:
- Rate limiting may not work
- Usage tracking may not persist
- Caching won't work

To fix Redis:
```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

## Minimal Working Setup

### Step 1: Test Imports
```bash
cd backend
python3 test_startup.py
```

### Step 2: Start Server (Minimal Mode)
```bash
cd backend
# Set minimal environment
export DATABASE_URL=sqlite+aiosqlite:///./test.db
export SECRET_KEY=test-secret-key-min-32-characters-long
export REDIS_URL=redis://localhost:6379/0

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Test Health Endpoint
```bash
curl http://localhost:8000/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "service": "UPM.Plus API",
  "version": "1.0.0"
}
```

### Step 4: Test Billing Endpoint
```bash
# First register/login to get token
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","full_name":"Test User"}'

# Then test billing (with token from above)
curl http://localhost:8000/api/v1/billing/pricing \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting Commands

### Check if server is running
```bash
curl http://localhost:8000/health
```

### Check server logs
```bash
# If running with uvicorn, logs appear in terminal
# Check for errors in the output
```

### Test specific imports
```bash
cd backend
python3 -c "from app.main import app; print('OK')"
```

### Check database
```bash
cd backend
python3 -c "from app.core.database import get_db; print('OK')"
```

### Check Redis
```bash
redis-cli ping
# Should return: PONG
```

## Emergency Fix: Minimal App

If nothing works, create a minimal test app:

```python
# backend/test_minimal.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}
```

Run with:
```bash
uvicorn test_minimal:app --reload
```

If this works, the issue is with the main app imports.

## Getting Help

1. Run `test_startup.py` to identify the issue
2. Check the error message carefully
3. Look for import errors first
4. Check if dependencies are installed
5. Verify database/Redis connections

## Next Steps After Fix

Once the server starts:
1. Test `/health` endpoint
2. Test `/api/v1/billing/pricing` (no auth needed)
3. Register a user
4. Test authenticated endpoints
5. Run the demo: `python3 demo_production_features.py`



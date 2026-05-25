# Quick Fix Guide - Getting UPM.Plus Running

## Issues Fixed

### 1. Import Errors ✅
- Fixed `get_redis_client` → `redis_client` in health.py
- Fixed `get_redis_client` → `redis_client` in usage_tracking.py  
- Fixed `get_redis_client` → `redis_client` in rate_limiting.py
- Made plotly optional in advanced_analytics_service.py

### 2. SQLAlchemy Reserved Word ✅
- Fixed `metadata` column name conflict in billing models
- Renamed to `meta_data` with column name mapping to `metadata`

### 3. Missing Dependencies ⚠️
Some optional dependencies may be missing. The app should still run without them:
- `plotly` - Optional (for advanced analytics)
- `spacy` - Optional (for NLP)
- `speech_recognition` - Optional (for voice features)

## Quick Start

### 1. Test Imports
```bash
cd backend
python3 fix_imports.py
```

### 2. Start Server
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Test Health Endpoint
```bash
curl http://localhost:8000/health
```

### 4. Run Demo
```bash
# In another terminal
python3 demo_production_features.py
```

## Common Issues & Solutions

### Issue: "ModuleNotFoundError: No module named 'X'"
**Solution**: Install missing dependency or it's optional and app will run in fallback mode

### Issue: "ImportError: cannot import name 'get_redis_client'"
**Solution**: Already fixed - use `redis_client` instead

### Issue: "Attribute name 'metadata' is reserved"
**Solution**: Already fixed - renamed to `meta_data`

### Issue: Server won't start
**Solution**: 
1. Check if port 8000 is available
2. Check database connection
3. Check Redis connection (optional - app will work without it)
4. Run `python3 fix_imports.py` to diagnose

### Issue: Database errors
**Solution**:
```bash
cd backend
alembic upgrade head
```

## Minimal Working Configuration

Create `.env` file in `backend/`:
```bash
SECRET_KEY=your-secret-key-here-min-32-chars
DATABASE_URL=sqlite+aiosqlite:///./test.db
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
DEBUG=true
```

## Testing

### Test 1: Health Check
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "service": "UPM.Plus API",
  "version": "1.0.0"
}
```

### Test 2: API Docs
```bash
open http://localhost:8000/docs
```

### Test 3: Billing API
```bash
# First register/login to get token
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","full_name":"Test User"}'

# Then get pricing
curl http://localhost:8000/api/v1/billing/pricing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What Works Now

✅ Billing system
✅ Usage tracking  
✅ Health checks
✅ Subscription management
✅ Database models
✅ API endpoints

## What May Need Configuration

⚠️ Stripe (for payments) - Optional, can test without it
⚠️ Redis (for caching) - Optional, app works without it
⚠️ OpenAI API (for AI features) - Optional, app works without it

## Next Steps

1. **Start the server**: `uvicorn app.main:app --reload`
2. **Test health**: `curl http://localhost:8000/health`
3. **Run demo**: `python3 demo_production_features.py`
4. **Check API docs**: `http://localhost:8000/docs`

## Still Having Issues?

1. Check server logs for specific errors
2. Run `python3 fix_imports.py` to diagnose
3. Check that all required environment variables are set
4. Ensure database is accessible
5. Check that port 8000 is not in use

---

**Status**: Core functionality should work now! 🚀


# 🔧 Database Connection Fix - URGENT

**Date:** October 4, 2025 19:18  
**Status:** 🔴 **CRITICAL - Database Unreachable**  
**Issue:** `ENETUNREACH` error preventing server startup

---

## 🚨 Current Problem

### Error Message:
```
connect ENETUNREACH 2600:1f18:2e13:9d27:2266:8d43:28dd:de65:5432
```

### Root Cause:
The `DATABASE_URL` environment variable in Render is either:
1. ❌ Not set at all
2. ❌ Set to an incorrect/old IPv6 address
3. ❌ Pointing to a database that no longer exists

### Impact:
- Server fails to start
- Render shows "Port scan timeout" error
- No HTTP server is bound to port

---

## ✅ IMMEDIATE FIX - 3 Steps

### Step 1: Check DATABASE_URL in Render (2 minutes)

1. Go to: https://dashboard.render.com/web/srv-d2u8fu95pdvs73a8f5v0
2. Click **"Environment"** tab
3. Look for `DATABASE_URL` variable

**Check if it exists and looks correct:**
```
Should look like:
postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require

NOT like:
postgresql://...@2600:1f18:...  (IPv6 address)
```

### Step 2: Get Correct DATABASE_URL from Supabase (3 minutes)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **Database**
4. Scroll to **"Connection string"**
5. Select **"Session pooler"** (NOT Transaction pooler)
6. Copy the connection string
7. **Add `?sslmode=require` at the end**

**Example:**
```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### Step 3: Update DATABASE_URL in Render (1 minute)

1. In Render dashboard → **Environment** tab
2. Find `DATABASE_URL` (or click **"Add Environment Variable"** if missing)
3. Paste the correct connection string from Supabase
4. Click **"Save Changes"**
5. Render will automatically redeploy

---

## 🔍 Alternative: Check if You Have a Database

### Do you have a Supabase project?

**If NO:**
1. Go to: https://supabase.com/
2. Click **"Start your project"**
3. Create new project:
   - Name: `qestro-production`
   - Region: West US (Oregon)
   - Generate strong password (SAVE IT!)
4. Wait 2-3 minutes for setup
5. Follow Step 2 above to get DATABASE_URL

**If YES but can't find it:**
1. Go to: https://supabase.com/dashboard
2. Check if project is still active
3. If paused/deleted, create a new one

---

## 🛠️ Code Fix Applied

I've updated the database connection to be more resilient:

**File:** `backend/src/lib/db.ts`

**Change:**
```typescript
// Before: Crashes if database fails
createMainDatabaseConnection();

// After: Starts server even if database fails
try {
  createMainDatabaseConnection();
} catch (error) {
  logger.error('Failed to initialize database connection:', error);
  logger.warn('Server will start without database. Features will be limited.');
}
```

**This allows the server to:**
- ✅ Start and bind to port even if database fails
- ✅ Show health endpoint (with database status)
- ✅ Log clear error messages
- ❌ Database-dependent features won't work until DATABASE_URL is fixed

---

## 🧪 How to Verify Fix

### After updating DATABASE_URL:

1. **Check Render Logs:**
   ```
   ✅ Main database connection established
   ✅ Server running on port 10000
   ```

2. **Test Health Endpoint:**
   ```bash
   curl https://questro-api.onrender.com/health
   ```
   
   Should return:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```

3. **If database still fails:**
   - Check Supabase project is running
   - Verify password in connection string
   - Ensure `?sslmode=require` is at the end
   - Check Supabase isn't blocking Render's IP

---

## 📋 Environment Variables Checklist

Make sure ALL of these are set in Render:

### Critical (Must have):
- [ ] `DATABASE_URL` - From Supabase (Session pooler + ?sslmode=require)
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`

### Important:
- [ ] `USE_SUPABASE=true`
- [ ] `DB_SSL=true`
- [ ] `DB_SSL_REJECT_UNAUTHORIZED=false`

### Security:
- [ ] `JWT_SECRET` (from SECURITY_IMPLEMENTATION_GUIDE.md)
- [ ] `JWT_REFRESH_SECRET`
- [ ] `SESSION_SECRET`

---

## 🚨 Common Mistakes

### ❌ Wrong: IPv6 Address
```
postgresql://...@2600:1f18:2e13:9d27:2266:8d43:28dd:de65:5432/...
```

### ❌ Wrong: Transaction Pooler (port 6543)
```
postgresql://...@aws-0-us-west-1.pooler.supabase.com:6543/...
```

### ❌ Wrong: Missing SSL parameter
```
postgresql://...@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

### ✅ Correct: Session Pooler with SSL
```
postgresql://postgres.ref:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## 🎯 Quick Checklist

Before redeploying, verify:

1. [ ] Supabase project exists and is active
2. [ ] DATABASE_URL copied from Supabase (Session pooler)
3. [ ] `?sslmode=require` added to end of URL
4. [ ] DATABASE_URL pasted into Render environment variables
5. [ ] All other required env vars are set
6. [ ] Clicked "Save Changes" in Render

---

## 🚀 After Fixing

Once DATABASE_URL is correct:

1. Render will auto-redeploy (or click "Manual Deploy")
2. Wait 5-7 minutes
3. Check logs for "Database connected"
4. Test health endpoint
5. You're live! 🎉

---

## 📞 Still Having Issues?

### Check These:

1. **Supabase Dashboard:**
   - Is project running?
   - Is it paused due to inactivity?
   - Check "Database" → "Connection info"

2. **Render Logs:**
   - Look for specific error messages
   - Check if DATABASE_URL is being read

3. **Connection String:**
   - Verify password is correct
   - Check for typos
   - Ensure no extra spaces

### Test Locally:

```bash
# Export the DATABASE_URL
export DATABASE_URL="postgresql://..."

# Test connection
cd backend
npm start

# Should see:
# ✅ Main database connection established
# ✅ Server running on port 8000
```

---

**BOTTOM LINE:** You need a valid DATABASE_URL from Supabase in your Render environment variables. Without it, the app cannot start.

**Next Step:** Get DATABASE_URL from Supabase and add it to Render NOW! 🚀

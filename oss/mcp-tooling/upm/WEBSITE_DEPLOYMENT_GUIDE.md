# 🚀 Website Deployment Guide

## Issue Fixed: Template Path

**Problem**: The template path was calculated incorrectly, pointing to `src/templates/website` instead of `templates/website`.

**Solution**: Updated path calculation to go one more parent level up to reach the project root.

---

## 🔧 To See the New Website

### Step 1: Restart Your FastAPI Server

The server needs to be restarted to load the new code:

```bash
# Stop the current server (Ctrl+C if running)

# Start it again
python -m udp.api.main

# Or if using uvicorn directly
uvicorn udp.api.main:app --reload --host 0.0.0.0 --port 8040
```

### Step 2: Clear Browser Cache

Your browser might be caching the old JSON response:

1. **Hard Refresh**: 
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
   - Safari: `Cmd+Option+R`

2. **Or use Incognito/Private mode** to bypass cache

### Step 3: Test the Website

```bash
# Test locally
curl http://localhost:8040/

# Should return HTML, not JSON
# Look for "Universal Package Manager" in the response
```

Or use the test script:
```bash
./scripts/test-website.sh
```

---

## 🌐 Production Deployment

### For upmplus.dev

1. **Deploy the updated code** to your GCP/GKE cluster
2. **Restart the pods**:
   ```bash
   kubectl rollout restart deployment/udp-api -n udp
   ```
3. **Wait for rollout**:
   ```bash
   kubectl rollout status deployment/udp-api -n udp
   ```
4. **Test**:
   ```bash
   curl https://upmplus.dev/
   ```

---

## ✅ Verification Checklist

- [ ] Server restarted
- [ ] Browser cache cleared
- [ ] `/` shows HTML landing page (not JSON)
- [ ] `/pricing` works
- [ ] `/docs` works
- [ ] `/about` works
- [ ] `/blog` works
- [ ] All pages show modern design
- [ ] Animations work
- [ ] Dark mode works

---

## 🐛 Troubleshooting

### Still seeing JSON response?

1. **Check server logs** for errors
2. **Verify template path**:
   ```bash
   ls -la templates/website/index.html
   ```
3. **Test template loading**:
   ```python
   from fastapi.templating import Jinja2Templates
   from pathlib import Path
   templates = Jinja2Templates(directory="templates/website")
   ```

### Template not found error?

1. **Check file exists**:
   ```bash
   ls templates/website/index.html
   ```
2. **Check permissions**:
   ```bash
   chmod 644 templates/website/index.html
   ```

### Still looks the same?

1. **Hard refresh browser** (Ctrl+Shift+R)
2. **Check browser console** for errors
3. **Verify server is serving HTML**:
   ```bash
   curl -I http://localhost:8040/
   # Should show Content-Type: text/html
   ```

---

## 📊 Expected Result

When you visit `https://upmplus.dev`, you should see:

- ✅ Beautiful animated gradient background
- ✅ "Universal Package Manager" headline
- ✅ Modern navigation bar
- ✅ Feature cards
- ✅ Stats section
- ✅ Code examples
- ✅ Testimonials
- ✅ CTA buttons
- ✅ Professional footer

**Not**:
- ❌ JSON response
- ❌ Plain text
- ❌ Old design

---

**After restarting the server, you should see the new modern website! 🚀**

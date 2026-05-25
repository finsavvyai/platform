# Troubleshooting Guide — LunaOS Studio

## Debug Mode

Enable verbose logging in the browser console:
```javascript
localStorage.setItem('VITE_LOG_LEVEL', 'debug');
location.reload();
```

Or set in `.env.local`:
```
VITE_LOG_LEVEL=debug
```

---

## Common Errors

### "Execution failed: 401 Unauthorized"
**Cause**: Missing or expired auth token.
**Fix**:
1. Open DevTools → Application → Local Storage.
2. Check `lunaos_token` exists and is non-empty.
3. If missing, log in again at `https://agents.lunaos.ai`.

---

### "Execution failed: 429 Too Many Requests"
**Cause**: Rate limit exceeded for your plan tier.
**Fix**: Wait 60 seconds or upgrade to Pro at `https://lunaos.ai/pricing`.

---

### Workflow canvas is blank / nodes don't appear
**Cause**: ReactFlow initialisation issue or CSS not loaded.
**Fix**:
1. Hard-refresh: `Cmd+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows).
2. Check console for CSS import errors.
3. Verify `@xyflow/react` styles are imported in `main.tsx`.

---

### "No response body" during workflow execution
**Cause**: Browser or proxy does not support SSE streaming.
**Fix**:
1. Test in Chrome (best SSE support).
2. Disable browser extensions that may intercept fetch.
3. Check `Content-Type: text/event-stream` header on API response.

---

### WebGL warning in console
**Cause**: Browser or GPU settings disable WebGL.
**Fix**: Go to `chrome://flags` → enable WebGL. For older GPUs, disable hardware acceleration as a workaround.

---

### Service worker not registering
**Cause**: HTTPS required for service workers.
**Fix**: In development, use `vite --https` or test on a deployed preview URL.

---

### Tests fail: "Cannot find module"
**Fix**:
```bash
rm -rf node_modules
npm install
```

---

### Tests fail: localStorage is not defined
**Cause**: Jest environment is `node` instead of `jsdom`.
**Fix**: Check `jest.config.js` has `testEnvironment: 'jsdom'`.

---

### Lighthouse CI score below threshold
**Common causes & fixes**:

| Issue | Fix |
|-------|-----|
| Large bundle | Run `npm run build -- --analyze` to find large deps |
| Missing `alt` text | Add `alt` to all `<img>` elements |
| Low contrast | Check colours against WCAG AA (4.5:1 ratio) |
| No HTTPS | Deploy to Netlify; configure HSTS |
| Render-blocking scripts | Ensure Vite code splitting is active |

---

## Performance Troubleshooting

1. Open Chrome DevTools → Performance tab.
2. Record a page load.
3. Look for long tasks (> 50 ms) in the main thread.
4. Common culprits: large synchronous imports, layout thrashing in ReactFlow.

---

## Getting Help

- GitHub Issues: `https://github.com/lunaos/lunaos-studio/issues`
- Slack: `#lunaos-studio` channel
- Docs: `https://docs.lunaos.ai/guides/studio`

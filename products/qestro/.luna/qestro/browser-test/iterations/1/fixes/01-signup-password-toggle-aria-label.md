# Fix 01 — SignupPage password-toggle missing accessible name

**File**: `frontend/src/pages/SignupPage.tsx:193`
**Issue**: `<button>` toggling password visibility contained only icons with `aria-hidden="true"`. Heuristic flagged 1 unnamed button on `/register` across all viewports (mobile/tablet/desktop).
**Severity**: low (a11y — keyboard/screen-reader users could not identify the button).
**Pattern reused from**: `frontend/src/pages/LoginPage.tsx:258` which already sets `aria-label`.

## Diff

```diff
 <button
     type="button"
+    aria-label={showPassword ? 'Hide password' : 'Show password'}
     onClick={() => setShowPassword(!showPassword)}
     className="text-gray-400 hover:text-gray-500 focus:outline-none"
 >
```

## Expected effect

Iteration 2: `/register` `unnamedButtons` should drop from 1 → 0 on all viewports.

# AMLIQ Sanctions Screening - Browser QA Test Plan

## Prerequisites

### Environment Setup
1. Backend running: `go run ./cmd/api/main.go` (port 8080)
2. PostgreSQL running with seeded sanctions data: `make docker-up`
3. Frontend running: `cd web && npm run dev` (port 5173)
4. Seed data loaded: `go run ./cmd/seed/main.go` (OFAC, EU, UN lists)
5. Test user account created (or use signup flow)

### Test Accounts
- **New user**: Create via `/signup` during test
- **Existing user**: Use previously created credentials
- **No auth**: For public demo endpoint tests

### Browser DevTools
- Keep Network tab open (filter by `Fetch/XHR`)
- Keep Console tab open for errors
- Test at viewports: 375px (mobile), 768px (tablet), 1024px+ (desktop)

---

## Test Suite 1: Authentication (Prerequisite)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.1 | Signup | Go to `/signup`, fill form, submit | Account created, redirected to dashboard |
| 1.2 | Login | Go to `/login`, enter credentials | Token stored in `localStorage.amliq_token`, redirected |
| 1.3 | Token present | Open DevTools > Application > Local Storage | `amliq_token` key exists with JWT value |
| 1.4 | Auth redirect | Clear token, navigate to `/screen` | Redirected to `/login` |

---

## Test Suite 2: Screen Entity Page (`/screen`)

### 2A: Form Rendering

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2A.1 | Page loads | Navigate to `/screen` | Shield icon, title, form with Individual/Company tabs, screening layers panel visible |
| 2A.2 | Individual tab (default) | Check form fields | First Name, Last Name, DOB, Nationality fields visible |
| 2A.3 | Company tab | Click "Company" tab | Company Name field visible, individual fields hidden |
| 2A.4 | Tab switching | Toggle between Individual/Company | Fields change, previous data preserved |
| 2A.5 | Validation - empty | Click submit with empty fields | Red error: "First name is required", "Last name is required" |
| 2A.6 | Layers panel | Check right sidebar | OFAC, EU, UN, Custom toggles visible with colored icons |

### 2B: Screening - Known Sanctions Matches

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2B.1 | OFAC match | Enter "Vladimir Putin" (first/last), submit | **Matches found**: at least 1 result with entity name, list ID, confidence score, disposition badge |
| 2B.2 | Match card layout | Inspect result card | Shows: entity name (truncated), list badge (e.g., "OFAC"), disposition badge (colored), confidence % |
| 2B.3 | Expand match | Click on a match card | Expands to show: layer bars (Exact/Fuzzy/Phonetic/Token), algorithm name, score %, matched value |
| 2B.4 | Collapse match | Click expanded card again | Collapses back, chevron changes direction |
| 2B.5 | Confidence score color | Check ConfidenceScore badge | >=80%: red, >=60%: orange, <60%: green |
| 2B.6 | Layer bar colors | Check expanded layer bars | >=80%: red bar, >=50%: orange bar, <50%: green bar |
| 2B.7 | Processing time | Check response header area | Shows milliseconds (e.g., "23ms") |
| 2B.8 | Match count | Check results header | Shows correct number (e.g., "3 matches") |
| 2B.9 | Network request | DevTools > Network | POST to `/api/v1/screen`, request body has `entity_name`, response has `query`, `total_matches`, `processing_time_ms`, `matches[]` |

### 2C: Screening - No Matches

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2C.1 | Clean name | Enter "John Randomname Smith" | Green checkmark: "No Matches Found" with "No sanctions matches for..." message |
| 2C.2 | Response format | Check Network tab | Response: `total_matches: 0`, `matches: []` |

### 2D: Screening - Edge Cases

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2D.1 | Partial name | Enter just "Putin" as last name, "V" as first | Should still return fuzzy matches |
| 2D.2 | Misspelled name | Enter "Vladmir Poutin" | Fuzzy/phonetic layers should catch this, lower confidence |
| 2D.3 | Arabic/Cyrillic name | Enter transliterated name (e.g., "Bashar al-Assad") | Should match if in sanctions list |
| 2D.4 | Company screening | Switch to Company tab, enter "Bank of Iran" | Should return entity matches from sanctions lists |
| 2D.5 | Very long name | Enter 200+ character name | Should handle gracefully, no crash |
| 2D.6 | Special characters | Enter "O'Brien & Sons <script>" | No XSS, proper error or clean handling |
| 2D.7 | Double submit | Click submit rapidly 2x | Should not show duplicate results or crash |
| 2D.8 | Loading state | Submit and observe | "Screening in progress..." spinner appears, submit button disabled |

### 2E: Error Handling

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2E.1 | Backend down | Stop backend, submit screening | Error message displayed (not blank screen) |
| 2E.2 | 402 usage limit | If plan limit hit | Shows "Screening limit reached" with "Upgrade Plan" button linking to `/billing` |
| 2E.3 | 401 expired token | Clear/corrupt token, submit | Redirected to `/login` |
| 2E.4 | Slow response | Backend under load | Loading spinner persists, no timeout crash |

---

## Test Suite 3: PEP Screening Page (`/compliance/pep`)

### 3A: Form Rendering

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3A.1 | Page loads | Navigate to `/compliance/pep` | "Screen Entity" header, search field, threshold slider, list selector panel |
| 3A.2 | Search field | Check placeholder | "Enter entity name (e.g. Benjamin Netanyahu)" |
| 3A.3 | Threshold slider | Drag slider | Shows percentage label, value updates (0-100%) |
| 3A.4 | List selector | Check right panel | OFAC, EU, UN, UKOFSI, SECO, Israeli MoD, SDFM checkboxes. OFAC/EU/UN pre-selected |
| 3A.5 | Select All / Clear All | Click button | Toggles all checkboxes on/off |
| 3A.6 | Disabled submit | No text entered | "Screen Entity" button is disabled |

### 3B: Screening - Real Search

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3B.1 | Known match | Type "Hezbollah", click Screen Entity | Matches displayed with entity_name, list_id, confidence, disposition |
| 3B.2 | Individual match | Type "Benjamin Netanyahu" | If in PEP/sanctions list, shows matches |
| 3B.3 | Network request | DevTools > Network | POST to `/api/v1/screen` (NOT `/api/v1/pep/screen`), body has `entity_name`, `lists`, `threshold` |
| 3B.4 | Threshold filtering | Set threshold to 80%, search | Only matches with confidence >= 0.8 returned |
| 3B.5 | Low threshold | Set threshold to 10%, search same name | More matches returned (lower confidence included) |
| 3B.6 | List filtering | Deselect all except OFAC, search | Only OFAC list matches returned |
| 3B.7 | No lists selected | Deselect all lists, search | Returns matches from all lists (no filter applied) |
| 3B.8 | No matches | Search "xyznonexistent123" | "No Matches Found" card with green checkmark |
| 3B.9 | Expandable rows | Click a match row | Shows layer evidence bars with algorithm, score, matched value |
| 3B.10 | Processing time | Check results header | Shows milliseconds badge |

### 3C: Search by Enter Key

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3C.1 | Enter to submit | Type name, press Enter in search field | Triggers screening (same as clicking button) |

### 3D: Error States

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3D.1 | API error | Simulate backend error | Red error text in card: "Screening failed" or specific message |
| 3D.2 | Clear on new search | Get results, search new name | Previous results cleared, new results displayed |

---

## Test Suite 4: API Response Validation (DevTools Network Tab)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.1 | Response wrapper | POST `/api/v1/screen`, inspect response | `{ "data": { ... }, "timestamp": <non-zero unix timestamp> }` |
| 4.2 | Data shape | Inspect `data` object | Has: `query` (string), `total_matches` (number), `processing_time_ms` (number), `matches` (array), `available_lists` (array) |
| 4.3 | Match shape | Inspect `matches[0]` | Has: `entity_id`, `entity_name`, `list_id`, `confidence` (0-1), `disposition`, `layers` (array), `explanation` |
| 4.4 | Layer shape | Inspect `matches[0].layers[0]` | Has: `layer` (string, e.g. "Fuzzy"), `score` (0-1), `algorithm` (string), `matched` (string) |
| 4.5 | Confidence range | Check confidence values | Between 0.0 and 1.0 (NOT 0-100) |
| 4.6 | entity_name populated | Check match entity_name | Not empty string - shows actual matched entity name |
| 4.7 | list_id populated | Check match list_id | Shows actual list (e.g., "ofac_sdn", "eu_consolidated") |
| 4.8 | Timestamp real | Check top-level timestamp | Non-zero Unix timestamp (e.g., 1775000000+) |
| 4.9 | Available lists | Check available_lists | Array of strings: ["OFAC", "EU", "UN", "UKOFSI", "SECO", "IsraeliMoD", "SDFM", "NBCTF"] |

---

## Test Suite 5: Public Demo Endpoint (No Auth)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.1 | Public screening | `curl -X POST http://localhost:8080/api/v1/screen/public-demo -H 'Content-Type: application/json' -d '{"name":"Vladimir Putin"}'` | Returns matches with same response format |
| 5.2 | Rate limit | Send 3 requests in rapid succession | 3rd request returns 429 with `"demo: 2 screens/hour"` message |
| 5.3 | Empty name | Send `{"name":""}` | Returns 400 with "name required" |
| 5.4 | Default threshold | Send without threshold | Defaults to 0.5 (visible in results quality) |

---

## Test Suite 6: Responsive Design

| # | Test Case | Viewport | Expected Result |
|---|-----------|----------|-----------------|
| 6.1 | Mobile - `/screen` | 375px | Form stacks vertically, layers panel below form |
| 6.2 | Tablet - `/screen` | 768px | Form and layers may be side-by-side |
| 6.3 | Desktop - `/screen` | 1024px+ | 2-column grid: form (2/3), layers (1/3) |
| 6.4 | Mobile - `/compliance/pep` | 375px | Search, slider, button stack vertically. List selector below. |
| 6.5 | Mobile - results | 375px | Match cards full width, text truncated, expandable works |
| 6.6 | Desktop - results | 1024px+ | Match cards full width with adequate spacing |

---

## Test Suite 7: Screening Layers Panel (`/screen`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.1 | Toggle visibility | Toggle each layer on/off | Visual glow effect appears/disappears |
| 7.2 | Icons correct | Check each toggle | OFAC: Shield (red), EU: Globe (blue), UN: Flag (orange), Custom: Database (green) |
| 7.3 | State is local only | Toggle layers, note they don't affect API call | **Known limitation**: Layer toggles on `/screen` are cosmetic only; use `/compliance/pep` ListSelector for actual filtering |

---

## Test Suite 8: Cross-Page Consistency

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.1 | Same engine | Search "Putin" on `/screen` and `/compliance/pep` | Both return results from same engine, same format |
| 8.2 | Same result cards | Compare result cards on both pages | Both use `ScreenResults` > `ScreeningResultRow` components |
| 8.3 | Token persists | Navigate between pages | Auth token stays in localStorage, no re-login |

---

## Test Suite 9: Known Sanctions Names to Test

Use these names for predictable results (assuming seeded data):

| Name | Expected List | Notes |
|------|--------------|-------|
| Vladimir Putin | OFAC, EU, UN | High confidence, multiple list matches |
| Hezbollah | OFAC, EU | Organization match |
| Bank Melli Iran | OFAC | Company/entity match |
| Kim Jong Un | OFAC, UN | Individual |
| Bashar al-Assad | EU, UN | Transliterated name |
| Hamas | OFAC, EU, UN | Organization |
| IRGC | OFAC | Abbreviation match |
| Nicolas Maduro | OFAC | Individual |
| Wagner Group | EU, UKOFSI | Organization |
| xyznonexistent | None | Should return 0 matches |

---

## Bug Verification Checklist

These bugs were fixed in the latest changes. Verify each:

| # | Bug | How to Verify | Pass? |
|---|-----|---------------|-------|
| V1 | API timestamp was always 0 | Network tab: check `timestamp` field is real Unix time | [ ] |
| V2 | PEPScreening called `/pep/screen` instead of `/screen` | Network tab: POST goes to `/api/v1/screen` | [ ] |
| V3 | ScreenEntity used basic result cards | Results show expandable rows with layer bars, not just name+confidence | [ ] |
| V4 | Frontend types mismatched backend | No console errors, results display correctly | [ ] |
| V5 | Rate limit message said "10/hour" | Hit public demo limit, message says "2 screens/hour" | [ ] |
| V6 | No entity_name in match results | Each match shows actual matched entity name, not empty | [ ] |
| V7 | Lists/threshold not sent from PEP page | Network tab: request body includes `lists` and `threshold` fields | [ ] |
| V8 | .env.example had double /api path | Check file: `VITE_API_URL=http://localhost:8080` (no trailing /api) | [ ] |

---

## Quick Smoke Test (5 minutes)

1. Login at `/login`
2. Go to `/screen`, enter "Vladimir Putin", submit
3. Verify: matches appear with entity names, confidence scores, list badges
4. Click a match to expand - verify layer bars show
5. Go to `/compliance/pep`, enter "Hezbollah"
6. Deselect EU/UN, keep only OFAC
7. Set threshold to 70%, submit
8. Verify: only OFAC matches with confidence >= 70%
9. Enter "xyznonexistent" - verify "No Matches Found"
10. Check Network tab: all requests go to `/api/v1/screen`, responses have correct shape

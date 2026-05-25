# Browser Agent Prompt — PushCI LemonSqueezy Test Checkout

> Copy the block below into Claude in Chrome, Atlas browser, or any browser agent that can navigate, run JS, and fill forms. The agent will need permission to interact with `app.pushci.dev` and `checkout.lemonsqueezy.com`.

---

## Prompt to paste

You are helping me verify a LemonSqueezy test-mode checkout flow for PushCI. Run the steps below in order and report what you see after each. Stop and tell me if anything looks unexpected — do not guess.

### Step 1: Open the dashboard and verify login

1. Navigate to `https://app.pushci.dev`
2. If a login page appears, stop and tell me — I'll log in manually, then ask you to continue
3. If the dashboard loads, proceed to Step 2

### Step 2: Extract the JWT token

Open the browser console (or use the JavaScript execution tool) and run:

```javascript
const t = localStorage.getItem('pushci_token') || localStorage.getItem('token') || localStorage.getItem('jwt');
t ? `TOKEN FOUND: ${t.substring(0, 20)}...` : 'NO TOKEN — list keys: ' + Object.keys(localStorage).join(', ');
```

If `TOKEN FOUND`, copy the **full token value** (not the truncated version) for the next step. To get the full token:

```javascript
localStorage.getItem('pushci_token') || localStorage.getItem('token') || localStorage.getItem('jwt')
```

If `NO TOKEN`, list the localStorage keys and report back. Don't proceed.

### Step 3: Trigger the checkout

In the browser console, run this fetch (paste the real token in place of `YOUR_TOKEN`):

```javascript
fetch('https://api.pushci.dev/api/billing/checkout', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'pro' })
}).then(r => r.json()).then(d => JSON.stringify(d, null, 2));
```

Expected response:
```json
{ "url": "https://checkout.lemonsqueezy.com/..." }
```

If you get `{"error": "..."}`, stop and tell me the exact error. Common ones:
- `unauthorized` — token expired, re-grab it from localStorage
- `plan not configured` — variant ID secret missing on the Worker (this means setup is incomplete)
- `checkout creation failed` — LS API error, check LEMONSQUEEZY_API_KEY

### Step 4: Complete the test purchase

1. Navigate to the `url` from Step 3
2. On the LS checkout page, fill in:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: `12/29` (any future date)
   - **CVC**: `123`
   - **Name on card**: any name
   - **Email**: any valid email
3. Submit the form
4. Wait for the success page — should redirect to `https://app.pushci.dev/billing?success=1`

If LS shows a "Test Mode" banner at the top, that's correct. If it doesn't, stop — you may be in live mode and a real charge could occur.

### Step 5: Verify the subscription registered

After redirect, run this in the console:

```javascript
fetch('https://api.pushci.dev/api/me/entitlements', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(d => JSON.stringify(d, null, 2));
```

Expected:
```json
{ "plan": "pro", "name": "Pro", "features": { ... } }
```

If `plan` is still `"free"`, the webhook didn't fire or didn't update D1. Stop and report — that's the real failure mode we're testing for.

### Report format

When done, report:

1. Whether each step succeeded or failed
2. The full response from Step 5
3. Any unexpected dialogs, errors, or redirects

If everything works, the LemonSqueezy commercial layer is fully activated for PushCI.

---

## Notes for the human (not the agent)

- **Test mode required.** Before running, make sure your LS dashboard top-right toggle says "Test mode" — not "Live". The whole point is to verify the flow without real charges.
- **JWT token expiry.** If the dashboard logs you out between steps, just log in again and re-grab the token. Tokens typically last 24 hours.
- **Webhook lag.** If Step 5 returns `"plan": "free"`, wait 10 seconds and retry — LS webhooks can take a few seconds to fire. If still free after 30 seconds, the webhook isn't reaching your Worker (check `npx wrangler tail` in a terminal).
- **One-time test.** Don't run this prompt repeatedly — each run creates a new test subscription in LS. To reset, cancel the test subscription in your LS dashboard before re-testing.

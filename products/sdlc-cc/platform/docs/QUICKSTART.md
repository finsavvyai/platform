# SDLC.ai — First Value in 10 Minutes

Get from sign-up to your first API call in under 10 minutes.

## Prerequisites

- A supported browser (Chrome, Firefox, Safari, Edge)
- Optional: Python 3.8+ or Node.js 18+ for SDK examples

## Step 1: Create an account (1 min)

1. Open the [SDLC.ai landing page](https://sdlc.cc) (or your deployed URL).
2. Click **Get Started** or **Sign up**.
3. Complete sign-up with email or your preferred provider.
4. Verify your email if required.

## Step 2: Get your API key (1 min)

1. Go to the [Dashboard](https://sdlc.cc/dashboard) (or `/dashboard` on your deployment).
2. In **API Keys**, click **Generate New Key**.
3. Copy the key (it starts with `sk-sdlc-`). Store it securely; you won’t see the full key again in some setups.

## Step 3: Your first request (2 min)

### Option A: cURL

Replace `YOUR_API_KEY` with the key you copied. Replace the base URL if your deployment uses a different gateway.

```bash
curl -X POST "https://api.sdlc.cc/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }'
```

### Option B: Python (OpenAI-compatible)

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.sdlc.cc/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Say hello in one sentence."}]
)
print(response.choices[0].message.content)
```

### Option C: Node.js / TypeScript

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SDLC_API_KEY || "YOUR_API_KEY",
  baseURL: "https://api.sdlc.cc/v1",
});

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Say hello in one sentence." }],
});
console.log(response.choices[0].message.content);
```

## Step 4: Confirm it worked

- You should get a JSON response with `choices[0].message.content`.
- In the dashboard, usage (when enabled) will reflect the call.

## Environment-specific base URL

- **Production (sdlc.cc):** `https://api.sdlc.cc/v1`
- **Custom deployment:** Set `NEXT_PUBLIC_GATEWAY_URL` (or your gateway env) and use that base URL in the examples above.

## Next steps

- [Getting Started guide](/getting-started) — problem/solution and more examples
- [Dashboard](/dashboard) — manage keys and view usage
- [Pricing](/pricing) — plans and limits

## Troubleshooting

| Issue | Check |
|-------|--------|
| 401 Unauthorized | API key correct and copied in full (including `sk-sdlc-`) |
| 404 or connection error | Base URL correct for your deployment (`/v1` path) |
| 429 Too Many Requests | Plan limit reached; upgrade or wait for reset |
| Dashboard shows "Auth not configured" | Clerk env vars not set for this deployment; use a deployed instance with auth enabled |

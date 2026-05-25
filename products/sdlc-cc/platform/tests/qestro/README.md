# Qestro test harness

Playwright tests for the privacy gateway, browser extension, and Trust Center. Spec format matches what [Qestro](https://qestro.app) ingests so the same files can run locally **or** through Qestro's self-healing runner once selectors drift.

## Layout

```
tests/qestro/
├── api/            # Black-box /v1/redact tests against a live gateway
├── browser/        # Browser extension intercept tests (load-unpacked)
├── smoke/          # Trust Center post-deploy smoke
├── fixtures/       # Tiny HTML pages mirroring chat-UI selectors
├── helpers/        # Shared extension-loader + gateway stub
└── playwright.config.ts
```

## Setup

```bash
cd tests/qestro
npm install
npx playwright install chromium
```

## Run

### API tests — needs a running gateway

```bash
docker-compose up gateway              # from repo root
GATEWAY_URL=http://localhost:8080 npx playwright test api
```

To exercise the block-policy path, point at a tenant with DLP policy=block:

```bash
GATEWAY_URL=http://localhost:8080 \
BLOCK_TENANT_ID=<uuid> \
npx playwright test api
```

### Browser extension tests — needs the extension built

```bash
cd ../../extensions/browser && npm run build && cd -
npx playwright test browser --headed     # MV3 extensions require headed Chromium
```

The fixture HTTP server runs on `localhost:9999`; the extension's
gateway URL is stubbed via Playwright route interception, so no live
gateway is required for browser tests.

### Trust Center smoke

```bash
# Local
python3 -m http.server -d ../../trust 8001 &
TRUST_URL=http://localhost:8001 npx playwright test smoke

# Post-deploy
TRUST_URL=https://trust.sdlc.cc npx playwright test smoke
```

## Uploading to Qestro

Qestro ingests Playwright specs directly. Push this directory's
contents to your Qestro project and the self-healing runner takes
over for the browser-ext tests — which is exactly where selector
drift (ChatGPT/Claude/Gemini repaint their DOM monthly) bites
hardest.

## Manual real-site coverage

The browser tests run against **fixtures**, not the live chat sites,
because the live sites need logins we don't want in OSS. To
sanity-check real-site selectors before publishing the extension:

```bash
cd ../../extensions/browser && npm run build
# Load dist/ as unpacked in chrome://extensions
# Visit chat.openai.com, claude.ai, gemini.google.com, copilot.microsoft.com
# Type a prompt with an email; confirm the extension's modal appears
```

Track verification results in `ROADMAP.md` D.2.

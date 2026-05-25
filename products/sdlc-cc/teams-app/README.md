# sdlc.cc — Teams app

Personal tab + message-extension action that lets Teams users scrub
text (chat content, pasted bodies, etc.) through the sdlc.cc gateway
before forwarding to Copilot / Cowork / external AI.

## What ships

- `manifest/manifest.json` — Teams v1.17 manifest. Personal tab +
  compose extension command "Sanitize for AI" (action type, fetches
  a task module).
- `web/tab.html` + `tab.js` — vanilla HTML/JS tab UI. Initialises
  the Teams SDK on load; falls back to standalone-browser behaviour
  outside Teams.
- `web/icons/` — placeholder 192×192 colour + 32×32 outline icons
  (Teams requires both shapes).
- `web/_headers` — CSP carved for Teams iframe origins.

## Sideload

1. Push the static files: `wrangler pages deploy ./web --project-name=sdlc-cc-teams`
2. Bundle the manifest:
   ```bash
   cd manifest && zip -r teams-app.zip manifest.json ../web/icons/*.png
   ```
   (Or use the M365 Developer Portal: import the manifest JSON, it'll
   create the zip + GUID + appId for you.)
3. Teams → **Apps** → **Manage your apps** → **Upload an app** →
   **Upload a custom app** → pick the zip.
4. Add the personal tab from "Built for you" → "sdlc.cc Scrub".

## What's deliberately not in this scaffold

- **Bot connector**: the compose extension uses `botId` placeholder
  `00000000-0000-0000-0000-000000000000`. A real action message-
  extension needs a Bot Framework registration (Azure Bot resource +
  Microsoft App registration). For demo we ship the tab; the compose
  extension lights up after registering the bot.
- **AAD SSO**: `webApplicationInfo` is a stub. Wire up real OAuth
  when SSO becomes a requirement (it's not for the demo flow).
- **Adaptive Cards** for compose action: the response would be a
  Card showing the scrubbed text inline in the message author's
  draft. ~150 LOC follow-up.

## Roadmap

- Real bot registration → working compose-extension action
- AAD SSO via On-Behalf-Of flow (replace `sk_sdlc_*` UX with org
  identity)
- Group/channel tab (today: personal-only)
- Adaptive Card task module for the action

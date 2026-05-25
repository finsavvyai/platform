# Using sdlc.cc from Claude clients

How to point the various Claude clients at sdlc.cc so prompts are
DLP-scrubbed and audited before reaching Anthropic.

## What works where

| Client | Coverage | Mechanism |
|---|---|---|
| Claude Code (CLI) | ✅ full | `ANTHROPIC_BASE_URL` env var |
| Claude Desktop (macOS / Windows / Linux) | ✅ full | env var set before launch, OR Settings → Developer (newer builds) |
| Anthropic SDK (Python / TS / Go) | ✅ full | constructor `base_url=` or env var |
| IDE plugins built on Anthropic SDK (Cursor, Continue, …) | ✅ full | their settings page → custom endpoint, OR env var |
| **Claude Cowork** | ⚠️ partial | cannot intercept Cowork's own reasoning; only MCP tool calls flow through your gateway |
| **claude.ai web chat** | ❌ none | hosted on Anthropic; no override exists |

## Prereqs

- A public HTTPS URL that points at the gateway (e.g. `https://api.sdlc.cc`).
- A `sk_sdlc_*` API key, issued via `keytool issue --tenant <yours>`.
- For Cowork only: the AMLIQ MCP server reachable at a separate URL with bearer auth (see `aegis/docs/COWORK_MCP_SETUP.md`).

> **Localhost works for clients on the same machine** (Claude Code, Desktop, your own SDK code). For Cowork you must have a public URL — it runs on Anthropic's servers, not yours.

---

## macOS

### Claude Code

```bash
echo 'export ANTHROPIC_BASE_URL=https://api.sdlc.cc'   >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY=sk_sdlc_xxxxxxxx...'    >> ~/.zshrc
source ~/.zshrc
claude   # already going through sdlc.cc
```

### Claude Desktop

```bash
osascript -e 'quit app "Claude"'

launchctl setenv ANTHROPIC_BASE_URL https://api.sdlc.cc
launchctl setenv ANTHROPIC_API_KEY  sk_sdlc_xxxxxxxx...

open -a Claude
```

To survive reboot, drop a launchd plist at `~/Library/LaunchAgents/cc.sdlc.env.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>cc.sdlc.env</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string><string>-c</string>
    <string>launchctl setenv ANTHROPIC_BASE_URL https://api.sdlc.cc; launchctl setenv ANTHROPIC_API_KEY sk_sdlc_xxxxxxxx...</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/cc.sdlc.env.plist
```

---

## Windows

### Claude Code (PowerShell)

```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL","https://api.sdlc.cc","User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","sk_sdlc_xxxxxxxx...","User")
# Restart the terminal so the new vars load
claude
```

### Claude Desktop (Windows)

PowerShell, **as the user who runs Claude**:

```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL","https://api.sdlc.cc","User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY","sk_sdlc_xxxxxxxx...","User")
```

Then **fully exit** Claude (right-click tray icon → Quit) and launch again. New processes inherit the User-scope vars.

GUI alternative: Settings → System → Advanced system settings → Environment Variables → User variables → New.

---

## Linux

### Claude Code

```bash
echo 'export ANTHROPIC_BASE_URL=https://api.sdlc.cc' >> ~/.bashrc
echo 'export ANTHROPIC_API_KEY=sk_sdlc_xxxxxxxx...'  >> ~/.bashrc
source ~/.bashrc
claude
```

### Claude Desktop (AppImage / Flatpak)

systemd-user environment so all user services + apps inherit:

```bash
mkdir -p ~/.config/environment.d
cat > ~/.config/environment.d/sdlc.conf <<EOF
ANTHROPIC_BASE_URL=https://api.sdlc.cc
ANTHROPIC_API_KEY=sk_sdlc_xxxxxxxx...
EOF
systemctl --user daemon-reload
# Log out + back in (env.d is read on session start)
```

---

## SDKs

```python
# Python
from anthropic import Anthropic
client = Anthropic(
    base_url="https://api.sdlc.cc",
    api_key="sk_sdlc_xxxxxxxx...",
)
```

```ts
// TypeScript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({
  baseURL: "https://api.sdlc.cc",
  apiKey:  "sk_sdlc_xxxxxxxx...",
});
```

```go
// Go (anthropic-sdk-go)
client := anthropic.NewClient(
    option.WithBaseURL("https://api.sdlc.cc"),
    option.WithAPIKey("sk_sdlc_xxxxxxxx..."),
)
```

---

## IDE plugins (Cursor, Continue, Cody-Anthropic-mode, …)

Most expose **Custom API endpoint** + **API key** in settings. Paste:

- Endpoint: `https://api.sdlc.cc`
- API key: your `sk_sdlc_*`

If the plugin only takes a key (no endpoint), it's hard-coded to `api.anthropic.com` — won't work without source patching.

---

## Claude Cowork

**You cannot route Cowork's general reasoning through sdlc.cc today.** Cowork runs in the browser at claude.ai/cowork; its LLM calls happen on Anthropic infrastructure, not from your network.

What you *can* do: register your MCP server (e.g. AMLIQ) with Cowork. The agent calls those tools explicitly; tool input/output flows through your gateway and lands in your audit log.

**Setup** (operator):

1. Deploy AMLIQ MCP HTTP transport: see `aegis/docs/COWORK_MCP_SETUP.md`
2. Cowork admin → Settings → MCP servers → Add
   - URL: `https://your-amliq-mcp-host/mcp`
   - Auth: Bearer = the `MCP_BEARER` you set
3. Test with a sample prompt that should call a tool

**Limitation to set with stakeholders**: only the explicit tool inputs/outputs are scrubbed. The agent's reasoning prompt still goes to Anthropic raw. Treat regulated workflows as Claude Code / Desktop only; reserve Cowork for non-PII work.

---

## claude.ai web chat

No path. Hosted, no override. If you must use it for research, scrub before pasting.

---

## Verification (any platform)

After setting env vars, send a prompt and watch the audit counter:

```bash
# In another terminal, against your gateway:
curl -sS https://api.sdlc.cc/metrics | grep sdlc_requests_total_ok
```

Send a chat message in Claude Desktop. Re-run the curl. The counter should bump by 1.

If it doesn't:

| Symptom | Likely cause | Fix |
|---|---|---|
| Counter unchanged | env vars not reaching the app | quit + relaunch the app entirely; verify with `printenv ANTHROPIC_BASE_URL` |
| 401 in app | bad / revoked `sk_sdlc_*` | `keytool list --tenant <yours>`, issue a new one |
| Connection refused | gateway down | `flyctl status --app sdlc-cc` (or local docker compose ps) |
| TLS error | DNS not pointing yet | wait for cert propagation (~30s on Cloudflare) |

---

## Roll-out playbook (your team)

1. **You**: deploy gateway publicly (Fly + Cloudflare DNS) — done in this repo's deploy scripts
2. **You**: issue one `sk_sdlc_*` per teammate via `keytool issue --tenant tnt_<name> --label <person>`
3. **Each teammate**: follow the per-platform block above
4. **Audit**: `curl -H "Authorization: Bearer $SDLC_ADMIN_BEARER" https://api.sdlc.cc/v1/audit/usage` shows per-tenant spend + DLP hits
5. **Revoke** when someone leaves: `keytool revoke --id <id>` — invalidates immediately

# Cloudflare Tunnel as a launchd service — operator runbook

> **Blocker note (2026-05-11):** `cloudflared tunnel login` is a
> browser-based OAuth dance and can only be run by the user owning
> the Cloudflare account. Once that's done, every step below is
> non-interactive and can be re-run idempotently.

## What this gives you

`https://api.sdlc.cc` resolves to your local sdlc-cc gateway running
on `localhost:8080`, surviving laptop reboots, sleep cycles, and
network changes. No VPS, no Fly, no DNS hassle (the `tunnel route
dns` command writes the CNAME for you).

## One-time setup

```bash
# 1. Authenticate (opens browser, pick the sdlc.cc zone)
cloudflared tunnel login

# 2. Create the tunnel
cloudflared tunnel create sdlc-gateway

# 3. Note the tunnel UUID printed above; you'll need it twice.
UUID=$(cloudflared tunnel list | awk '$2=="sdlc-gateway" {print $1}')

# 4. Write the per-machine config
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $UUID
credentials-file: $HOME/.cloudflared/$UUID.json

ingress:
  - hostname: api.sdlc.cc
    service: http://localhost:8080
  - service: http_status:404
EOF

# 5. Route the public DNS at the tunnel
cloudflared tunnel route dns sdlc-gateway api.sdlc.cc
```

You should now be able to:

```bash
# Run the tunnel in foreground
cloudflared tunnel run sdlc-gateway

# In another shell:
curl https://api.sdlc.cc/health
# → {"status":"healthy"}
```

> If the existing `api.sdlc.cc` Worker is still bound, this command
> will conflict on the hostname. Unmount the Worker route in the
> Cloudflare dashboard first, OR use `api2.sdlc.cc` (set `HOSTNAME=api2.sdlc.cc`
> before invoking `scripts/tunnel-up.sh`).

## As a launchd service (survives reboot)

`scripts/tunnel-up.sh` already runs the tunnel interactively. The
launchd version below makes it boot-on-login and auto-restart on
crash.

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/cc.sdlc.tunnel.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>cc.sdlc.tunnel</string>

  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/cloudflared</string>
    <string>tunnel</string>
    <string>--config</string>
    <string>/Users/shaharsolomon/.cloudflared/config.yml</string>
    <string>run</string>
    <string>sdlc-gateway</string>
  </array>

  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key><false/>
    <key>NetworkState</key><true/>
  </dict>

  <key>StandardOutPath</key>
  <string>/Users/shaharsolomon/Library/Logs/cloudflared-sdlc.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/shaharsolomon/Library/Logs/cloudflared-sdlc.err</string>

  <!-- Throttle restart attempts so a failing tunnel doesn't spin
       the CPU. cloudflared has its own backoff but this is a
       belt-and-braces guard. -->
  <key>ThrottleInterval</key><integer>10</integer>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/cc.sdlc.tunnel.plist

# Verify
launchctl list | grep cc.sdlc.tunnel
tail -f ~/Library/Logs/cloudflared-sdlc.log
```

`cloudflared` runs as the logged-in user (not root) — fine because
the tunnel UUID + credentials file in `~/.cloudflared/` already
belong to your user. The `KeepAlive.NetworkState` flag tells
launchd to restart the process when network connectivity returns
after a sleep / Wi-Fi switch.

## Unload / disable

```bash
launchctl unload ~/Library/LaunchAgents/cc.sdlc.tunnel.plist
rm ~/Library/LaunchAgents/cc.sdlc.tunnel.plist  # permanent
```

## Linux equivalent (systemd)

```ini
# /etc/systemd/system/cloudflared-sdlc.service
[Unit]
Description=Cloudflare Tunnel for sdlc.cc gateway
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/USER/.cloudflared/config.yml run sdlc-gateway
Restart=on-failure
RestartSec=10
User=USER

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-sdlc
journalctl -u cloudflared-sdlc -f
```

## Verification

```bash
curl -sS https://api.sdlc.cc/health
# {"status":"healthy"}

# Confirm it's actually the new Go gateway (not the old Worker):
curl -sS https://api.sdlc.cc/metrics | head -3
# # HELP sdlc_requests_total_ok ...
```

## Notes

- `cloudflared` is in your PATH already (`/opt/homebrew/bin/cloudflared`); the plist hardcodes that path — adjust if Homebrew lives elsewhere.
- The tunnel uses your laptop's outbound — sleep means the tunnel pauses; wake means cloudflared reconnects in ~5s. Acceptable for personal use; for production, run the binary on Fly (`scripts/fly-bootstrap.sh`) instead.
- `KeepAlive.SuccessfulExit=false` means launchd only restarts on **non-zero** exit — a clean `kill` won't loop.

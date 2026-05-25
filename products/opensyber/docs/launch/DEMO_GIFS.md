# Demo GIF Specifications — OpenSyber Launch

**Global specs**
- Resolution: 1920x1080 (desktop), also export 1080x1080 (square) and 1080x1920 (vertical) for social
- Frame rate: 30fps captured, export as optimized MP4 (H.264) first, then WebM and animated GIF
- Max file size: 8MB for Twitter/X, 16MB for Product Hunt gallery, 2MB for inline email
- Font overlays: Bebas Neue for big text, DM Sans for small text, teal #00E5C3 on black for emphasis
- Mouse: use a visible cursor overlay (Cleanshot has a good one), never show a shaky hand
- Recording tool: Cleanshot X or Loom, followed by cleanup in Screenflow or DaVinci Resolve
- Seed data: use realistic demo account, not "foo/bar" or "lorem ipsum"

---

## GIF 1 — "60-Second Deploy" (5 seconds)

### Scene
Full-screen OpenSyber dashboard. User clicks "Create Agent," a modal opens with a name field pre-filled "recon-01," the user hits Enter, a timer appears in the top-right corner starting at 00:00 while the VM provisions in the background. Cuts to final state showing the agent healthy with green monitor, timer stopped at 00:58.

### Narrative
The platform's core claim in five seconds: you click once and get a secured agent before your coffee is ready.

### On-screen text
- Frame 1 (0:00): `SIGNUP → RUNNING AGENT`
- Frame 2 (0:03): `PROVISIONING...`
- Frame 3 (0:05): `58 SECONDS. MEASURED.`

### Recording instructions
1. Use a pre-warmed account on the staging environment with fast Hetzner region (Helsinki or Falkenstein).
2. Start the recording from the dashboard with "Create Agent" button visible.
3. Actually trigger the real provisioning — do not fake the timer. Speed up the middle section in post, keep the first and last second at real speed.
4. Add a subtle teal glow around the agent card when it goes green.
5. End on the dashboard with the timer frozen at 00:58.

---

## GIF 2 — "Malicious Skill, Blocked" (4 seconds)

### Scene
Split screen. Left: a terminal inside the agent running a skill that attempts `cat /etc/shadow`. Right: the OpenSyber real-time monitor showing the event fire, a red block banner appear, and a Slack notification slide in from the top-right.

### Narrative
Show — not tell — what 340ms detection looks like when a skill tries to escape its permissions.

### On-screen text
- Frame 1 (0:00): `SKILL ATTEMPTS: cat /etc/shadow`
- Frame 2 (0:02): `BLOCKED IN 340ms`
- Frame 3 (0:04): `ALERT → SLACK`

### Recording instructions
1. Use a pre-built "malicious-skill-demo" fixture in the staging env (marked obviously as a test).
2. Record both panels in one frame — the agent terminal on the left, the monitor on the right.
3. Ensure the timestamp delta visible on screen shows ≤400ms between the attempt and the block event.
4. Capture the Slack notification slide-in from the real Slack app, not a mockup.
5. Add a subtle red flash on the block banner at the moment of detection.

---

## GIF 3 — "Skill Marketplace, Audited" (5 seconds)

### Scene
Scroll through the skill marketplace page. Hover over a skill card revealing "Signed & SBOM Verified" badge, click into the skill detail page showing declared permissions, signature metadata, and SBOM download link.

### Narrative
Every skill has receipts. You can see what it will access before you install it.

### On-screen text
- Frame 1 (0:00): `MARKETPLACE — EVERY SKILL AUDITED`
- Frame 2 (0:02): `SIGNED · SBOM · PERMISSIONS DECLARED`
- Frame 3 (0:05): `KNOW BEFORE YOU INSTALL`

### Recording instructions
1. Use real seeded skills from the staging marketplace — do not use placeholder names.
2. Scroll slowly and smoothly (Cleanshot has a built-in smooth scroll).
3. Make sure the "Signed & SBOM Verified" badge is visible on at least three cards before the hover.
4. On the detail page, ensure the declared permissions list is readable (FS read:/tmp, NET egress:api.github.com, etc).
5. End on the Install button hover state so the viewer knows what's next.

---

## GIF 4 — "Device-Bound Session" (4 seconds)

### Scene
A session token is copied from one browser and pasted into another browser on a different device (simulated with two Chrome profiles side by side). The second browser shows the session fail with "Device binding verification failed" and a clean, non-scary error message.

### Narrative
TokenForge's device-bound session primitive in action. A stolen token is dead on arrival.

### On-screen text
- Frame 1 (0:00): `SESSION TOKEN COPIED FROM DEVICE A`
- Frame 2 (0:02): `PASTED INTO DEVICE B`
- Frame 3 (0:04): `DEVICE BINDING FAILED · TOKEN REJECTED`

### Recording instructions
1. Use two visibly different Chrome profiles (different avatars, different window chrome color).
2. Do the actual copy/paste with cmd-c / cmd-v — the viewer should see the interaction.
3. The rejection must be the real TokenForge flow, not a mockup. Trigger it against the staging API.
4. Keep the error message visible for at least 1.5 seconds on the final frame.
5. Add a subtle teal shield icon that appears near the rejected session to reinforce the security narrative.

---

## GIF 5 — "Compliance Evidence Export" (3 seconds)

### Scene
The compliance evidence panel showing SOC 2, ISO 27001, HIPAA, GDPR tabs. User clicks SOC 2, sees mapped controls to actual agent events, clicks "Export Evidence Bundle," a CSV download starts.

### Narrative
Turn audit prep from a week of screenshots into a one-click export.

### On-screen text
- Frame 1 (0:00): `COMPLIANCE EVIDENCE — LIVE`
- Frame 2 (0:02): `ONE-CLICK EXPORT`
- Frame 3 (0:03): `YOUR AUDITOR WILL STILL NOT BE FUN AT PARTIES`

### Recording instructions
1. Use a seeded account with at least 30 days of agent events so the evidence panel looks real.
2. Click through SOC 2 → CC6.1 (logical access) → show the mapped events list.
3. Click "Export Evidence Bundle" and let the real download fire.
4. The final frame must show the downloaded file in the browser's download shelf (filename like `opensyber-soc2-evidence-2026-04-08.csv`).
5. The third on-screen text line is a joke — keep it. It's on-brand and it lands.

---

## Delivery Checklist (per GIF)

- [ ] MP4 at 1920x1080, ≤8MB
- [ ] Square 1080x1080 for Twitter/LinkedIn
- [ ] Vertical 1080x1920 for TikTok/Shorts/Reels
- [ ] Animated GIF fallback ≤4MB for email + slower clients
- [ ] WebP fallback for docs site
- [ ] Captions burned in for accessibility
- [ ] Audio: none (these are silent GIFs, all narrative is on-screen text)
- [ ] File naming: `opensyber-gif-01-deploy.mp4`, `opensyber-gif-02-blocked.mp4`, etc.
- [ ] Stored in `docs/launch/assets/` once rendered

# PipeWarden Launch Day Checklist

> **Version**: v1.0.0 | **Target launch date**: April 2026
> **HN script**: `scripts/launch-hn.sh` | **PH script**: `scripts/launch-ph.sh`

---

## Pre-Launch (T-24h)

### Infrastructure
- [ ] `git tag v1.0.0 && git push origin v1.0.0` (done ✓)
- [ ] GoReleaser CI passes — binaries visible on GitHub Releases page (linux/darwin/windows × amd64/arm64)
- [ ] Docker image on Docker Hub: `docker pull pipewarden/pipewarden:1.0.0`
- [ ] `pipewarden.com` DNS → Cloudflare Pages live (check with `curl -I https://pipewarden.com`)
- [ ] `app.pipewarden.com` → Cloudflare Tunnel live (test login flow end-to-end)
- [ ] Demo account seeded with 3 sample connections + realistic findings (Critical, High, Medium)
- [ ] Uptime monitor configured (UptimeRobot or Better Uptime, alert threshold: 2 min downtime)
- [ ] SSL cert valid on both domains (check expiry with `openssl s_client -connect pipewarden.com:443`)

### Content
- [ ] Product Hunt listing fully drafted (tagline, description, all 5 gallery images, pricing tiers)
- [ ] Show HN post draft reviewed by 1-2 developers for clarity
- [ ] All 4 scheduled tweets drafted in Buffer/TweetDeck
- [ ] Dev.to article (`marketing/devto-article-1.md`) formatted and in Draft state
- [ ] 10 enterprise prospect list prepared (`marketing/enterprise-outreach.md`)

### Community Prep
- [ ] Joined CNCF Slack `#security` channel (if not already in)
- [ ] Joined DevSecOps Slack (invite at devsecopscommunity.com)
- [ ] Personal LinkedIn post drafted (Post 1 from LAUNCH_KIT.md Section 4)

---

## Launch Day

### 12:01 AM PT — Product Hunt
- [ ] Post PipeWarden on Product Hunt (use `scripts/launch-ph.sh` for all copy)
- [ ] Post maker comment immediately after listing goes live (within 60 seconds)
- [ ] Share link in personal social channels

### 9:00 AM EST — Show HN
- [ ] Post Show HN (use `scripts/launch-hn.sh` for title + body + first comment)
- [ ] Post first comment immediately after submitting
- [ ] Set 15-minute timer — reply to every HN comment within 15 min for first 2 hours

### Morning (9–11 AM EST)
- [ ] Tweet 1 fires at 12:05 AM PT (verify it sent)
- [ ] Tweet 2 scheduled for 9:00 AM PT — confirm it sent
- [ ] Share in CNCF Slack `#security`: "Just launched PipeWarden on HN and PH today — would love feedback from the CNCF community"
- [ ] Share in DevSecOps Slack
- [ ] Share in Go Slack `#projects` channel
- [ ] Publish Dev.to article (use `marketing/devto-article-1.md`)

### Midday (12 PM–2 PM)
- [ ] Tweet 3 fires at 1:00 PM PT — confirm
- [ ] Reply to every PH comment within 2 hours during the day
- [ ] Upvote from personal account on PH (NOT from multiple accounts)
- [ ] DM 10 enterprise prospects (use `marketing/enterprise-outreach.md` templates)
- [ ] Post LinkedIn Post 1 (problem framing, from LAUNCH_KIT.md)
- [ ] Post to r/netsec — "I built an open-source tool to monitor CI/CD pipeline behavior"

### Evening (4–6 PM)
- [ ] Tweet 4 fires at 5:00 PM PT — confirm
- [ ] Respond to all unanswered HN comments
- [ ] Respond to all unanswered PH comments
- [ ] Screenshot PH rank and vote count (for metrics)
- [ ] Screenshot HN points and comment count (for metrics)

---

## Post-Launch (T+1 to T+7)

### T+1
- [ ] Follow up with any HN commenters who showed purchase intent (reply + DM GitHub)
- [ ] Follow up with PH commenters who asked for enterprise/team plans
- [ ] Post r/golang — "Structured a 27K-line Go project: provider interface pattern for 6 CI/CD platforms"
- [ ] Capture metrics snapshot:
  - HN: points, rank, comments
  - PH: votes, rank, comments
  - GitHub: stars
  - pipewarden.com: signups from analytics

### T+2
- [ ] Publish LinkedIn Post 2 (technical — the 846→106 line refactor story)

### T+7
- [ ] Publish LinkedIn Post 3 (pricing angle — flat-rate vs per-seat)
- [ ] Post to r/netsec (if not done at launch)
- [ ] Second wave of 10 enterprise outreach DMs
- [ ] Update SPRINT_TRACKER.md with full metrics and learnings

### T+14
- [ ] Follow up with interested commenters who went quiet
- [ ] Review signup-to-paid conversion (if any)
- [ ] Decide on next sprint based on feedback themes

---

## Metrics Targets

| Metric | Target | Stretch |
|--------|--------|---------|
| HN points | 100+ | 300+ |
| HN comments | 20+ | 50+ |
| PH votes | 200+ | 500+ |
| PH rank | Top 10 of day | Top 5 |
| GitHub stars | 100+ (launch week) | 300+ |
| pipewarden.com signups | 50+ | 200+ |
| Paid conversions (30 days) | 3+ | 10+ |

---

## Emergency Runbook

**If pipewarden.com goes down during launch:**
1. Check Cloudflare Pages status: status.cloudflare.com
2. Check Cloudflare Tunnel health: `cloudflared tunnel info pipewarden`
3. Fall back to direct Cloudflare Pages URL while tunnel recovers
4. Post update to HN thread: "Quick note — the demo is temporarily down, GitHub repo is always up: github.com/finsavvyai/pipewarden"

**If Docker image is unreachable:**
1. Check Docker Hub status: status.docker.com
2. Verify image tag: `docker manifest inspect pipewarden/pipewarden:1.0.0`
3. Point users to GitHub Releases binaries as fallback

**If CI is red at launch time:**
- Do NOT delay launch — HN/PH timing is time-sensitive
- Acknowledge in comments: "CI is running; binaries are on the Releases page manually published"
- Fix CI post-launch, do not rush a broken merge

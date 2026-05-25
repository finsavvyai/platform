# Launch-day runbook — first 24 hours

A minute-by-minute timeline for the day everything goes live. Tape this
to a second monitor. Times are US Eastern; convert to your local timezone.

The goal of day-1 is **not** "go viral." It's "field every comment within
30 minutes, unblock every signup error within an hour, and capture the
first three customer signals on record." Day-2 metrics decide whether
this was a launch or a deck.

---

## Pre-launch — the night before

### T-12h (9pm ET, Monday)

- [ ] Run `npm test` in `gateway/`, `sdk/`, `mcp-server/`. All green.
- [ ] Run `npm run build` in `sdk/` and `mcp-server/`. Commit clean.
- [ ] `wrangler deploy --env production` for the gateway. Smoke-test
      `curl https://api.clawpipe.ai/health` returns 200.
- [ ] Check `https://app.clawpipe.ai/signup` flow end-to-end with a
      throwaway email. Land in dashboard. Generate API key. Make a
      live `/v1/prompt` call. Cancel signup.
- [ ] Verify `clawpipe.ai/openapi.json`, `/llms.txt`, `/llms-full.txt`,
      `/llms.json`, `/agents.txt`, `/.well-known/mcp.json`,
      `/.well-known/ai-plugin.json`, `/.well-known/security.txt` all
      respond 200 with correct Content-Type.
- [ ] Verify the OG card renders: paste `https://clawpipe.ai` into
      Twitter/X compose box. If the preview is broken, fix or
      defer the launch 24h.
- [ ] LemonSqueezy: log into the seller dashboard, confirm Dev /
      Growth / Scale variants are LIVE (not test mode). Place one
      $1 test charge against a sandbox card to trip the webhook.
- [ ] Status page (`status.clawpipe.ai`) reports "All systems
      operational."
- [ ] Have `docs/promotion/launch-kit/show-hn.md` open in one tab,
      `twitter-x.md` in another, `linkedin.md` in a third. Body text
      copied to clipboard once.

### T-1h (Tuesday, 8:30am ET)

- [ ] Coffee.
- [ ] One last `git pull && npm test` on production deployment.
- [ ] Open the Cloudflare dashboard's analytics page, the LemonSqueezy
      dashboard, and your support email tab. Three monitors if possible.
- [ ] Mute Slack DM notifications. Turn email push OFF except for the
      support address.

---

## Launch hour — 9:00am-10:00am ET, Tuesday

### 9:00am — Twitter/X
- [ ] Post the **standalone announcement** from `twitter-x.md` § 1.
      That's the canonical link people will share. Don't pre-thread
      it.
- [ ] Wait 30 seconds, post tweet 1/8 of the **hero thread** as a
      reply to the standalone (not as a separate post). Each
      subsequent tweet replies to the previous one.
- [ ] Watch the first 5 minutes for engagement. If less than 3 likes
      after 10 minutes, RT yourself once at 9:15.

### 9:15am — LinkedIn (personal)
- [ ] Post the **founder narrative** from `linkedin.md` § 1.
- [ ] Comment your own post 30 seconds later with the link.

### 9:30am — Show HN
- [ ] Submit the show-hn.md packet via news.ycombinator.com/submit.
      Don't paste the body into the URL field by mistake.
- [ ] DM the link to 2-3 close friends with HN accounts who'll see it
      and upvote within 5 minutes. (Do NOT brigade — direct DM only,
      not in a Slack channel of 50.)
- [ ] Camp in the comments thread. Reply within 10 minutes to every
      top-level comment for the first 4 hours.

### 9:45am — MCP / package registry
- [ ] Tweet a follow-up: "MCP server is on npm — `npm i -g
      clawpipe-mcp-server`. One-line install for Claude Desktop and
      Cursor." Reply to your own thread with this; don't make it a
      new post.

---

## Hour 2-4 — 10am-12pm ET

### 10:00am — Dev.to
- [ ] Publish the lead Dev.to article from `dev-to-hashnode.md`
      with `canonical_url` pointing back to your domain.
- [ ] Cross-post to Hashnode (canonical preserved).
- [ ] Tweet the link as a reply on the hero thread.

### 11:00am — first metrics check
- [ ] HN frontpage status. If between rank 11-30, you're in. If
      rank 31+, see "if HN doesn't take off" below.
- [ ] LinkedIn impressions on the personal post — should be 200+
      after 90 minutes if the founder network has any reach.
- [ ] Cloudflare analytics — `clawpipe.ai` traffic vs baseline. Look
      for the traffic spike, NOT signups (signups lag traffic by
      ~2 hours).

### 12:00pm ET — first lunch break (mandatory)
- [ ] Step away for 30 minutes. Do not check anything. Eat. Walk.
- [ ] When you come back, do one full pass through every active
      thread in priority order: HN > LinkedIn > Twitter replies >
      Reddit (if posted).

---

## Hour 5-12 — afternoon

### 1:00pm — first paid signup grace period
- [ ] Watch LemonSqueezy. The first paid signup is the most
      important moment of day-1. If the webhook didn't deliver,
      check `webhook_deliveries` table on D1 (status='dead' is bad)
      AND tail the gateway logs for the LS webhook signature
      verification.
- [ ] Send a personal email to the first paid customer within 1
      hour: "Thanks for being first. Reply to this with anything
      that doesn't work — I'll fix it tonight."

### 2:00pm — Reddit (only if HN is going well)
- [ ] Post r/programming submission from `reddit.md` § 3.
- [ ] Wait for r/MachineLearning until next morning to avoid
      mod-flagging as multi-post promotion.

### 3:00pm — Product Hunt (next day)
- [ ] Schedule the Product Hunt launch for Wednesday 12:01am PT
      (3:01am ET). Don't launch PH same day as HN — splits attention,
      both perform worse.
- [ ] Confirm the PH hunter is still on for tomorrow. Send them
      `product-hunt.md` as a sanity check.

### 4:00pm — first metrics screenshot
- [ ] Screenshot HN rank, LinkedIn impressions, Cloudflare requests.
      Drop into a `/launch-metrics-day-1.md` file in the repo.
      Tomorrow morning's update post quotes these numbers.

### 5:00pm — wrap-up
- [ ] One last reply pass on every thread.
- [ ] Email any friend who promised to share but hasn't yet. One
      sentence: "It's live; would love your boost when convenient."
- [ ] Status page: confirm green.
- [ ] Set up the next-morning "thanks + day-1 metrics" tweet. Don't
      post it tonight; post it 8am Wednesday.

---

## Failure modes — what to do if X goes wrong

### HN doesn't take off (rank 31+ at hour 2)

Don't panic. ~85% of Show HN posts never make the front page; this
is the median outcome.

1. Check whether the title is hooking. If clicks are happening but
   upvotes aren't, the body isn't paying off. Edit the body once
   to tighten the lede. (HN allows post edits within ~2 hours.)
2. If clicks aren't happening at all, the title is the problem.
   You can re-submit ONCE in 24 hours with a different title; don't
   re-submit twice in a row.
3. Pivot energy to LinkedIn / Twitter — those don't have a tight
   "be on the page in 3 hours" window.

### Signup error reported in a public thread

1. Reproduce immediately. Tail the production gateway logs.
2. Reply in the thread with "thanks, reproducing now" inside 5
   minutes. Public visibility is your friend — silence is what
   kills the conversation.
3. Ship a fix in the open. Push to main, deploy, post the commit
   hash + a one-sentence "fixed in commit `abc1234`, deployed at
   2:14pm ET" reply.

### LemonSqueezy webhook fails for the first paid customer

This is the most expensive bug to ship live.

1. Confirm the customer's billing went through on LS dashboard.
2. Manually invoke the webhook handler:
   ```
   wrangler tail clawpipe-gateway --format=pretty
   ```
   then `POST` the captured webhook payload through the LS
   "Resend webhook" UI.
3. If the row is still dead in `webhook_deliveries`, replay it:
   `POST /v1/webhooks/dlq/{id}/replay`
4. Email the customer: "Sorry, our webhook stalled for ~5 minutes.
   Your account is now upgraded; here's a screenshot of your
   dashboard showing the new tier."

### Provider goes down during launch

The failover chain handles 5xx/429 automatically. If a single
provider is degraded for >5 minutes:

1. Status page incident: yellow "Degraded" with a one-line note.
2. Don't take the gateway off. The router will self-heal as the
   provider recovers and the health-penalty decays.
3. If multiple providers go down simultaneously, that's an internet
   incident — link to the upstream Cloudflare/Anthropic/OpenAI
   status pages from your own status page and let it ride.

---

## Day 2 — Wednesday

### 8:00am ET
- [ ] Tweet a "thanks + here are the day-1 numbers" reply on the
      hero thread. Include the screenshots from `launch-metrics-
      day-1.md`. Honesty wins — if HN didn't break top-30, say so.
- [ ] LinkedIn comment on your own post with the same numbers.

### 9:00am ET
- [ ] Product Hunt launch goes live (12:01am PT = 3am ET; you'll
      catch up at 9am).
- [ ] Camp in the PH comments. Same playbook as HN.

### 10:00am-5:00pm ET
- [ ] Reply to every PH comment within 30 minutes.
- [ ] If a media outlet reaches out (TechCrunch, The Verge, dev.to
      Editor's Pick): respond fast, give honest numbers, don't pad.

### Day 2 closeout (5pm)
- [ ] Update `launch-metrics-day-1.md` with day-2 totals and
      rename to `launch-metrics-week-1.md`. Commit it.
- [ ] Schedule the day-7 follow-up post (`linkedin.md` § 2 template)
      as a draft.
- [ ] Take Wednesday evening off. Inbox can wait.

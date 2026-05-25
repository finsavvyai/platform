# Cloudflare WAF Configuration: Allow AI Crawlers

LunaOS is an AI developer tools platform. Blocking AI crawlers hurts
discoverability and is counterproductive for our market. This guide
ensures all LunaOS zones allow AI bots through Cloudflare WAF.

## Zones to Configure

| Zone | Domain | Purpose |
|------|--------|---------|
| lunaos.ai | lunaos.ai | Marketing site |
| docs.lunaos.ai | docs.lunaos.ai | Documentation |
| agents.lunaos.ai | agents.lunaos.ai | Dashboard |
| studio.lunaos.ai | studio.lunaos.ai | Visual IDE |
| api.lunaos.ai | api.lunaos.ai | Engine API |

## Step 1: Create WAF Allow Rule for AI Crawlers

For **each zone** listed above:

1. Go to **Security > WAF > Custom Rules**
2. Click **Create rule**
3. Configure:
   - **Rule name**: `Allow AI Crawlers`
   - **When incoming requests match**:
     Use "Edit expression" and paste:

```
(http.user_agent contains "GPTBot") or
(http.user_agent contains "ClaudeBot") or
(http.user_agent contains "Claude-Web") or
(http.user_agent contains "ChatGPT-User") or
(http.user_agent contains "Google-Extended") or
(http.user_agent contains "PerplexityBot") or
(http.user_agent contains "Anthropic-AI")
```

4. **Action**: Select **Skip**
5. Under skip settings, check:
   - [x] All remaining custom rules
   - [x] Rate limiting rules
   - [x] Super Bot Fight Mode
6. Click **Deploy**
7. **Drag this rule to the TOP** of the rule list (order matters)

## Step 2: Check Bot Fight Mode

For **each zone**:

1. Go to **Security > Bots**
2. Under **Bot Fight Mode**:
   - Keep it ON for general protection
   - It should NOT affect verified bots (AI crawlers with
     proper User-Agent headers pass through)
3. Under **Super Bot Fight Mode** (if on Pro/Business/Enterprise):
   - Set "Definitely automated" to **Allow** or **Challenge**
   - Set "Likely automated" to **Allow** (not Block)
   - Set "Verified bots" to **Allow**

## Step 3: Check Existing Rules for Conflicts

For **each zone**, review all existing custom rules:

1. Go to **Security > WAF > Custom Rules**
2. Look for rules that might block AI bots:
   - Rules matching on `http.user_agent`
   - Rules with "Block" action for bot-like patterns
   - Rules blocking non-browser user agents
3. Either delete those rules or add exceptions for AI crawlers

## Step 4: Verify with Cloudflare API (Optional)

Check current WAF rules via API:

```bash
# List all WAF custom rules for a zone
curl -X GET \
  "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json"
```

Create the allow rule via API:

```bash
# Get the zone's custom ruleset ID first, then add rule
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}/rules" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "skip",
    "action_parameters": {
      "ruleset": "current"
    },
    "expression": "(http.user_agent contains \"GPTBot\") or (http.user_agent contains \"ClaudeBot\") or (http.user_agent contains \"Claude-Web\") or (http.user_agent contains \"ChatGPT-User\") or (http.user_agent contains \"Google-Extended\") or (http.user_agent contains \"PerplexityBot\") or (http.user_agent contains \"Anthropic-AI\")",
    "description": "Allow AI Crawlers",
    "enabled": true
  }'
```

## Step 5: Verify Crawlers Can Access Sites

Test with curl using AI bot user agents:

```bash
# Test GPTBot access
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0)" \
  https://lunaos.ai/

# Test ClaudeBot access
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: ClaudeBot/1.0" \
  https://lunaos.ai/

# Test ChatGPT-User access
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: ChatGPT-User/1.0" \
  https://docs.lunaos.ai/
```

Expected: HTTP 200 for all. If you get 403 or a challenge page,
the WAF rule is not positioned correctly or another rule overrides it.

## Blocked Bots (Keep Blocking)

These bots are blocked via robots.txt and should stay blocked:

- **Bytespider** (TikTok's aggressive scraper)
- **AhrefsBot** (SEO scraper, high request volume)
- **SemrushBot** (SEO scraper, high request volume)

## Maintenance

- Review WAF rules monthly for new AI crawlers to allow
- Monitor Cloudflare Analytics > Security for blocked requests
- Check robots.txt across all sites stays consistent
- New AI crawlers to consider: Gemini, Meta AI, Mistral

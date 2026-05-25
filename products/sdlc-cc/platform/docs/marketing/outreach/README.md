# Outreach Templates — sdlc.cc Legal-AI Launch

**Status:** Drafts for manual use. Nothing in this directory is automated. The human (Shahar) sends every message individually after personalizing it.

Last updated: 2026-05-16

---

## What's here

| File | Channel | When to use |
|---|---|---|
| `01-template-firm-cto.md` | Cold email | First touch to a CTO / Director of Innovation at a 50–500-attorney firm |
| `02-template-newsletter-pitch.md` | Press pitch | Reaching out to legal-tech newsletter editors with a story angle (not a press release) |
| `03-template-aba-techshow.md` | Cold email | Reaching out to ABA TECHSHOW speakers and panel chairs you've actually researched |
| `04-template-reddit-r-lawfirm.md` | Community post | Genuine question post to r/LawFirm or r/lawyers (one or the other, not both) |
| `05-template-hn-show-hn.md` | Community post | Show HN launch when the repo is genuinely ready |
| `06-product-hunt-launch.md` | Launch | Product Hunt launch day copy, gallery captions, first comment |
| `07-followup-sequence.md` | Cold email | Day-5 and Day-14 follow-ups to non-responders to Template 01 |
| `08-discovery-call-script.md` | Live call | 30-minute discovery call structure for inbound or post-cold leads |
| `09-objection-handling.md` | Live call reference | Read before every call. Handles cost, AGPL, "we use Harvey," "no AI policy yet" |

---

## How to use these

### Order of operations for a real launch week

1. **Pre-launch (weeks -4 to -1):** publish the repo, finalize the landing page, get the architecture doc, audit-log walk-through, and DLP demo to "demo-ready" quality. Verify the commercial-license one-pager actually exists.
2. **Soft outreach (week -2 to 0):** start Template 02 (newsletter pitches) — these take weeks to bear fruit. Concurrently, start Template 03 (TECHSHOW speakers) — also slow burn.
3. **Public launch (week 0):** Template 05 (Show HN) Tuesday 8 AM PT or Template 06 (Product Hunt) Tuesday 12:01 AM PT. Not both in the same week.
4. **Community discussion (week 0 to +2):** Template 04 (Reddit) once, in the subreddit that fits best.
5. **Targeted cold outreach (week +1 onward):** Template 01 (firm CTOs), max 30–50 sends per day, followed by Template 07 follow-ups on Day 5 and Day 14.
6. **Inbound calls (continuous):** Template 08 script, Template 09 objection reference.

### Volume guardrails

- **50/day max** outbound cold email from a warmed-up domain. Above that, your IP reputation suffers and deliverability drops.
- **Total cold-email volume for the campaign:** plan for 500–1,000 carefully researched sends, not 10,000. The win rate on personalized email is 2–5%. The win rate on spray-and-pray is 0.1% *and* damages the sender domain.
- **Newsletter pitches:** 5 per week, max. Each one personalized.
- **Reddit / HN / PH:** one post each. Do not crosspost. Do not re-launch.

### Compliance baseline (read before sending anything)

- **CAN-SPAM (US):** every commercial email needs a real sender identity, a real physical postal address, an honest subject line, and a clear opt-out mechanism. All email templates here include these. Do not strip them.
- **GDPR (EU):** every email to an EU recipient needs an opt-in basis (legitimate-interest for B2B prospecting, documented), a privacy-policy link, and a deletion route. The GDPR addendum in Template 01 covers this — append it for EU recipients.
- **CASL (Canada):** more restrictive than CAN-SPAM. If you're sending to Canadian recipients, document the legitimate-interest basis and shorten the campaign.
- **Reddit / HN / PH rules:** read each platform's rules before posting. They override anything in this directory.

### What none of this does

- **No automation.** No Mailchimp blasts, no Lemlist sequences, no Apollo sends. Every message in this directory is composed and sent by a human.
- **No scraped lists.** Source contacts only from firm websites, public LinkedIn profiles, the public ABA member directory, and public conference programs.
- **No fake social proof.** No invented testimonials, no inflated user counts, no implied endorsements from the ABA or any bar association.
- **No fake urgency.** No "limited spots," no "must respond by Friday," no countdown timers.

### Citing ABA Op. 512

Across the templates, ABA Formal Opinion 512 is cited **once** (in Template 01, with shorter mentions in Templates 04, 06, 08, 09). Do not over-cite it. Editors and lawyers can spot a template a mile away when the same citation appears in every touch.

---

## Maintenance

- Every six months, re-review the templates against current ABA opinions, FRCP amendments, and state bar guidance on GenAI use.
- Refresh competitor references (currently: Harvey, CoCounsel, Lexis+ AI). If new entrants emerge, update Template 09 / Objection 3.
- If a template generates a complaint or unsubscribe spike, pause it and investigate before resuming.

---

## Open questions / TODOs

- [ ] Confirm legal entity name and physical mailing address for the CAN-SPAM signature block before sending any email
- [ ] Draft the sample acceptable-use policy template referenced in Objection 4 (or remove the reference until it exists)
- [ ] Identify and get written permission from two peer firms for the background-introduction offer in Template 03 (or remove the offer)
- [ ] Verify the commercial-license one-pager is publishable before promising it in calls
- [ ] Set the Product Hunt `{launch_date}` and freeze the gallery assets a week before

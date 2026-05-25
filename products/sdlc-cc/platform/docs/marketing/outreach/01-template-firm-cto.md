# Template 01 — Cold Email: Mid-Market Law Firm CTO / Director of Innovation

**Status:** Draft for manual send. Do not automate.

---

## Sender notes

- **Target:** CTO, CIO, Director of Innovation, or Chief Knowledge Officer at firms with 50–500 attorneys. Source contacts from firm websites and public LinkedIn profiles only — no scraped lists.
- **Volume:** Max 30–50 sends per day from a warmed-up domain (`sdlc.cc` or founder address). Stagger across business hours.
- **Expected response rate:** 2–5% on a well-researched list. Personalize the second sentence per firm (a recent matter, a public AI committee announcement, a CLE they hosted).
- **Do not** send to firms where you have no signal of AI interest. Re-route those to template 02 / 03 instead.
- **EU recipients:** add the GDPR opt-in line below the signature.

---

## Subject line (pick one — A/B over a week)

- A: `{firm_name} + on-prem RAG — quick question on attorney-client privilege`
- B: `Self-hosted AI for {firm_name} — built around ABA Op. 512`

Both are honest, name the firm, and signal the technical angle. Do not use `Re:` or `Fwd:`.

---

## Body

Hi {first_name},

I'm Shahar, founder of sdlc.cc. We build a self-hosted RAG and LLM gateway designed specifically for firms that can't send privileged matter content to a third-party AI vendor.

The reason I'm writing: ABA Formal Opinion 512 made clear that competence under Rule 1.1 now extends to generative AI, and that confidentiality under Rule 1.6 still applies when an attorney uses a GenAI tool. Most consumer and even enterprise AI products move privileged data to vendor infrastructure. That is a hard problem for firms doing M&A, litigation, or regulated-industry work.

sdlc.cc runs inside your VPC (AWS, Azure, or on-prem), so privileged documents never leave your tenancy. We include DLP for PII / PHI / matter-number redaction, per-matter access policies, and an audit log that maps to Rule 1.6(c) reasonable-efforts documentation.

The code is AGPL-3.0 (so your security team can read every line) with a commercial license available for firms that prefer not to publish modifications.

Would a 25-minute call next week be useful? I can show the deployment model and the audit log walk-through — no slides, just the product.

If this isn't relevant or you'd prefer I don't follow up, just reply "no thanks" and I'll remove you from my outreach list.

Best,
Shahar Solomon
Founder, sdlc.cc
{sender_email} · {sender_phone}
{mailing_address}

To stop receiving messages from me, reply with "unsubscribe" and I will not contact you again.

---

## GDPR addendum (append only when sending to EU recipients)

> This is a one-to-one business message from sdlc.cc (controller: {legal_entity_name}, {eu_address}). I sourced your contact from your firm's public website. You can view our privacy policy at https://sdlc.cc/privacy and request deletion of your contact details at privacy@sdlc.cc at any time.

---

## What to swap before sending

- `{first_name}`, `{firm_name}` — required
- Second paragraph — drop in one firm-specific detail (recent committee, conference talk, AI policy memo)
- Signature block fields — real address (CAN-SPAM § 7704(a)(5) requires a valid physical postal address)

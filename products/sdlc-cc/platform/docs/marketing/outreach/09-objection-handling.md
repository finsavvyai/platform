# Template 09 — Objection Handling

**Status:** Reference for the human. Read before every call. Do not paste responses verbatim.

---

## Use notes

- **Acknowledge, then answer.** Every objection starts with "That's fair" or "Good question" — and then a real answer, not a deflection.
- **If the answer is "I don't know," say so.** Make a note and follow up in writing within 24 hours.
- **Never argue.** If they hold a position after one round of explanation, drop it. Pushing twice loses the deal.

---

## Objection 1 — "It's too expensive to self-host. We don't have the IT staff."

**The honest answer:**

Self-hosting is not free. The realistic spend for a firm of 50–200 attorneys is roughly $X/month in cloud infrastructure plus a fraction of an existing sysadmin's time — not a dedicated hire. We provide a one-command Docker Compose for trial, and a Terraform module for AWS / Azure for production. The audit-log and DLP work is already done, so the IT team is operating, not building.

That said: if the firm has zero internal IT and outsources everything, self-hosted is probably the wrong model. The right answer for that firm might be a vendor-hosted enterprise option (Harvey, CoCounsel, Lexis+ AI). I'd rather tell you that up front than waste your time.

**What to do on the call:** ask them what their current cloud spend looks like and who runs it. If the answer is "we have no AWS account," move them gently toward a vendor-hosted referral.

---

## Objection 2 — "AGPL scares our risk committee. Doesn't that mean we have to publish our work?"

**The honest answer:**

The AGPL-3.0 obligation triggers when you *distribute* the software or make it available over a network *as a service to third parties*. A law firm running sdlc.cc internally for its own attorneys and clients is not distributing the software. The obligation kicks in if you modify the code and turn it into a product you sell to other firms — which is not what 99% of firms are going to do.

For firms whose risk committee wants belt-and-suspenders, we offer a commercial license. It removes the AGPL obligations entirely, includes indemnification, and is priced for mid-market firms. That's the standard open-core model — Elastic, MongoDB, GitLab all run it.

**What to do on the call:** offer to send the commercial license term sheet and a one-pager that the risk committee can review. Do not give legal advice on AGPL interpretation — be clear you're describing the license, not opining on it.

---

## Objection 3 — "We're already evaluating Harvey / CoCounsel / Lexis+ AI."

**The honest answer:**

Those are good products and they're well-funded. They solve a different problem. Harvey and CoCounsel are vendor-hosted: your privileged content moves through their infrastructure under their security model. For many firms that's an acceptable trade-off, especially given the vendor's SOC 2 and their contractual commitments.

The case for sdlc.cc shows up when:

- A client's outside-counsel guidelines prohibit vendor processing of matter content
- The firm handles regulated data (healthcare, financial, government) where the vendor's posture isn't enough
- The firm wants to use AI in matters where the engagement letter is silent on AI use and re-negotiating with the client isn't realistic
- The firm wants the option to run a local open-weights model (Llama 3, etc.) for cost or latency reasons

If none of those apply, Harvey is probably the right choice. Genuinely.

**What to do on the call:** ask which client matters are driving the AI evaluation. If the matters are commodity work (drafting, basic research), vendor-hosted is fine. If the matters are regulated or M&A, self-hosted becomes a real conversation.

---

## Objection 4 — "We don't have an AI policy yet. We're not ready."

**The honest answer:**

That's the most common position in the market right now, and it's a reasonable one. ABA Op. 512 actually says firms should develop policies *before* widespread deployment, not after. So you're being responsible.

A few things that might help while you're drafting:

- We have a sample acceptable-use policy template (free, no email gate) you can adapt — it's not legal advice, just a starting structure.
- Op. 512 paragraph references and ABA Rule 1.6(c) commentary are linked in our docs.
- I can introduce you to two firms (with their permission) at a similar stage who are willing to share their draft policies on background.

I'm not asking you to commit to anything. If the policy work goes well and you decide self-hosted is part of the answer in 6 months, we'll still be here.

**What to do on the call:** offer the sample policy doc and the peer-introductions only if both actually exist. Do not invent peers. Schedule a check-in for 90 days out with their permission.

---

## Objection 5 — "How do I know you'll still exist in two years?"

**The honest answer:**

Fair concern, and one I take seriously. Three things:

1. The code is AGPL-3.0 and on a public repo. If we disappear tomorrow, the firm's existing deployment keeps running, and the firm can fork the code. There is no vendor-lockout failure mode.
2. We can put source code escrow in the commercial license if it matters to your risk committee.
3. I'm not going to pretend we're a 200-person company. We're early-stage. If that's a deal-breaker, I understand — and I'd rather you know that now than discover it during procurement.

**What to do on the call:** do not promise a Series A you don't have. Do not name-drop investors or advisors unless you actually have them. Trust earned through honesty here is worth more than the deal you might lose.

---

## Catch-all: objection you haven't heard before

> "That's a good question and I don't want to give you a half-answer. Let me think about it carefully and come back to you in writing by {specific_date} — usually within 24 hours. Does that work?"

Then actually do it. Follow-through on a "let me think" beats a confident wrong answer every time.

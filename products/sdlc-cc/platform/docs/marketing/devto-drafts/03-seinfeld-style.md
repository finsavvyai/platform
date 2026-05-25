---
title: "What's the deal with attorney-client privilege in ChatGPT?"
published: false
description: "A comedic-technical hybrid about why every conversation between a law firm and an AI vendor talks past itself, and what a self-hosted LLM gateway with privilege redaction actually does about it. With Go."
tags: legaltech, llm, opensource, golang
cover_image: https://placeholder.sdlc.cc/blog/03-seinfeld-style/cover.png
canonical_url: https://sdlc.cc/blog/whats-the-deal-with-attorney-client-privilege-chatgpt
---

So I'm building this thing. It's a gateway. Sits between a law firm and ChatGPT. Catches all the privileged stuff before it goes out. Logs everything. AGPL-3.0, commercial license is $4K a year per seat if you don't want the AGPL.

And I'm talking to lawyers about it. And I'm talking to AI vendors about it. And what I have noticed — what I cannot un-notice — is that these two groups of people are not having the same conversation. They are using the same words. They are nodding at each other. And they are talking about two completely different things.

What's the *deal* with that?

## The lawyer conversation

The lawyer says: "We can't use ChatGPT for client work because of privilege."

You say: "Right, the data goes to OpenAI's servers, and—"

The lawyer says: "No no no. The data going to the servers is a problem. But the *real* problem is that if opposing counsel ever finds out we used ChatGPT to draft this brief, they will argue we waived work-product protection. Because we voluntarily disclosed our mental impressions to a third party. The third party being OpenAI."

You say: "But OpenAI doesn't read the brief."

The lawyer says: "Doesn't matter. Third party. FRCP 26(b)(3). Look it up."[^frcp-26]

So you look it up. The rule protects documents "prepared in anticipation of litigation" from discovery. It's been the law since 1970. It was written when the relevant third parties were typing pools and document-copy services. It does not anticipate large language models. Nothing anticipates large language models. The rule still applies anyway. The lawyer is correct.

What's the deal with rules from 1970 governing software from 2024?

## The AI vendor conversation

Now you go to the AI vendor. Could be OpenAI, could be Anthropic, could be one of the legal-AI startups. The vendor says: "We have an enterprise plan. Zero data retention. SOC 2 Type II. We're HIPAA-compatible if you sign a BAA. We have a tenant isolation guarantee. We're ready for legal."

You say: "Great, so privilege is preserved?"

The vendor says: "Privilege?"

You say: "Yeah, attorney-client privilege. Work product."

The vendor says: "Well, that's a legal determination, so we can't speak to that, but our data handling is industry-leading."

You say: "So… is it preserved or not?"

The vendor says: "We'd recommend you consult with counsel."

This is — and I want to be clear about this — not the vendor being evasive. The vendor genuinely cannot make the determination. The vendor has built a piece of software with excellent security properties. The vendor is not a law firm. Whether sending a privileged document to that software constitutes waiver is, in fact, a legal question, and asking the vendor is like asking the guy who installed your front door whether your divorce settlement is fair.

But the lawyer doesn't want a lecture on the difference between data security and legal privilege. The lawyer wants someone to say "yes." Nobody will say yes. So the lawyer doesn't buy it. So the firm uses ChatGPT.com on a personal account at home instead, which is — and I cannot stress this enough — much worse.

## The ABA, eventually, weighs in

In July 2024, the ABA finally publishes Formal Opinion 512.[^aba-512] Twelve pages on generative AI. The committee chairs are presumably exhausted. The opinion does not say "yes." The opinion says: a lawyer must make reasonable efforts to prevent inadvertent disclosure of confidential information; whether using a particular AI tool meets that standard depends on factors X, Y, Z, etc.

The lawyer reads the opinion. The lawyer concludes: "I need to make reasonable efforts."

The lawyer goes back to the AI vendor. The lawyer says: "What constitutes reasonable efforts?"

The vendor says: "We'd recommend you consult with counsel."

The lawyer *is* counsel. This is the problem. There is no one above the lawyer to consult.

What's the deal with regulatory frameworks that route every question back to the regulated party?

## The thing I built

So I built this thing. The thing does one specific job: it makes it possible for the lawyer to give an honest answer to the question "did you make reasonable efforts."

Because here's the move. The lawyer doesn't need ChatGPT to bless privilege. The lawyer needs a piece of evidence — produceable, hash-chained, timestamped — showing that *every prompt sent from this firm to an LLM was filtered through a tool whose default behaviour is to redact privileged markers and log the result*. That's it. That's the artifact. That's reasonable efforts.

The thing is a Go binary. It runs in the firm's infrastructure. The relevant file in the repo is `services/gateway/internal/infrastructure/middleware/dlp_legal.go`. The handler that wires it in is in the same directory as `dlp_middleware.go`, which already exists. The detector list is something like this:

```go
// services/gateway/internal/infrastructure/middleware/dlp_legal.go
var legalPatterns = []CustomPatternSpec{
    {
        Class:    "privileged_comm",
        Regex:    `(?i)\b(attorney[- ]client\s+privilege[d]?|privileged\s*&\s*confidential)\b`,
        Severity: "high",
    },
    {
        Class:    "work_product",
        Regex:    `(?i)\b(prepared in anticipation of litigation|attorney work[- ]product)\b`,
        Severity: "high",
    },
}
```

It's not exotic code. It's not novel research. It's a list of regular expressions, a buffered HTTP body, and a Postgres audit table with a `prior_hash` column. The whole thing is maybe 4,000 lines of Go. The reason nobody else has shipped it for this buyer at this price is not that it's hard to build. It's that nobody at OpenAI or Anthropic or Microsoft wants to be in a room with two lawyers and a state-bar investigator. Which, honestly — fair.

What's the deal with technical problems where the hard part is who agrees to be liable?

## The conversation, after the gateway

Now imagine the conversation again, but the firm has the gateway running.

Lawyer: "Did you use ChatGPT to draft this brief?"

Associate: "Yes, via the firm gateway."

Lawyer: "Was the work-product header set?"

Associate: "Yes."

Lawyer: "And the matter ID?"

Associate: "Yes."

Lawyer: "Run me the audit query."

Associate: *runs a SQL query*

```sql
SELECT ts, matter_id, detector_classes, action, llm_provider, request_hash
FROM audit_logs
WHERE matter_id = '2026-0142'
  AND user_id    = 'jdoe@firm.com'
ORDER BY ts;
```

Lawyer: "Okay. We have a record. Reasonable efforts. Documented. Send it."

That's the whole product. That's it. The gateway doesn't *create* privilege. The gateway *documents the attempt*. In a world where the rule from 1970 still controls and the vendor won't say "yes," documenting the attempt is the actual deliverable.

## What the gateway does not do

Look, I want to be honest about this, because the genre of "AI for lawyers" is full of people who are not being honest.

- The gateway does not certify SOC 2. The project hasn't done that yet.
- The gateway does not detect every privileged communication. It detects markers. If the partner emails a privileged thought to the LLM in plain prose with no header, the regex won't catch it.
- The gateway does not make ChatGPT safe to use. It makes ChatGPT *defensible* to use, which is a different thing, and which — I would argue — is what the firm actually needs.

What's the deal with software where being honest about what it doesn't do is the marketing?

## The license, briefly

It's AGPL-3.0. Run it inside your firm, fork it, change it, fine. Embed it in a closed-source product? Either release that product as AGPL or buy the commercial license at $4,000/yr/seat. Pricing: [sdlc.cc/pricing](https://sdlc.cc/pricing). Repo: [github.com/finsavvyai/sdlc-platform](https://github.com/finsavvyai/sdlc-platform). Honest comparison against managed alternatives: [sdlc.cc/compare](https://sdlc.cc/compare).

I'll be in the comments. Probably. For a while.

---

[^frcp-26]: Federal Rule of Civil Procedure 26(b)(3). https://www.law.cornell.edu/rules/frcp/rule_26
[^aba-512]: ABA Formal Opinion 512 (July 29, 2024). https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf

## Publishing checklist

- [ ] Final pass for accuracy
- [ ] Replace any placeholder URLs with real ones
- [ ] Confirm `services/gateway/internal/infrastructure/middleware/dlp_legal.go` exists in the repo before publishing
- [ ] Set `published: true`
- [ ] Run `luna-agents:devto-publish` to push to Dev.to

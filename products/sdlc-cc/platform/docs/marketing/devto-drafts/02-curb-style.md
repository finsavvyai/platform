---
title: "I open-sourced my legal-AI gateway and the bar associations have opinions"
published: false
description: "What happens when you build software for lawyers, license it under AGPL-3.0, and then read every state bar opinion on generative AI in one sitting. It does not go well. There is a Go snippet at the end."
tags: legaltech, opensource, llm, golang
cover_image: https://placeholder.sdlc.cc/blog/02-curb-style/cover.png
canonical_url: https://sdlc.cc/blog/legal-ai-gateway-bar-associations-have-opinions
---

So I built a thing.

It's an LLM gateway. It sits between a law firm and OpenAI or Anthropic and it redacts privileged content before the prompt leaves the building. I licensed it AGPL-3.0. I priced the commercial license at $4,000 a year per seat. I thought that was reasonable. I'm not sure anymore.

I'm not sure about a lot of things.

The first thing I did, after I shipped the OSS release, was read every state bar opinion on generative AI in one weekend. This was a mistake. Not because the opinions are bad — they're actually fine, mostly — but because every paragraph contains a phrase like "reasonable efforts" or "competent representation" or "informed client consent," and after about three hours of this, you start to wonder if your software is, in fact, reasonable. Or competent. Or informed.

It probably isn't. I don't know. Nobody knows. That's sort of the point of the opinions.

## The ABA opinion

ABA Formal Opinion 512 came out in July 2024.[^aba-512] It is twelve pages long. It is — and I say this as someone who likes the ABA, in principle — twelve pages of "it depends." Lawyers will of course tell you that "it depends" is the correct answer to almost every legal question, and they're not wrong, but it's not actionable software-engineering input.

The relevant bit, paraphrased: a lawyer must not put confidential client information into a generative-AI tool unless the lawyer has made reasonable efforts to ensure the tool doesn't compromise confidentiality. Then it lists factors. The factors include things like "the terms of service" and "the vendor's data-handling practices" and "whether the tool retains inputs for training."

I read this. I thought: okay, my gateway addresses all of these. The tool retains nothing. The data never leaves the firm's VPC. The terms of service are the firm's own internal policy because the firm owns the binary.

Then I thought: but does the *attorney* know that? Does the partner who downloaded my gateway because their nephew told them to, does that partner actually understand that they're still responsible for the consent conversation with the client? That installing a piece of OSS doesn't, by itself, satisfy Model Rule 1.6?[^aba-1.6]

I don't think so. I think the partner thinks the box is checked.

The box is not checked. I should probably put that in the README. I haven't.

## The work-product thing

There's also FRCP 26(b)(3).[^frcp-26] Work product. Documents prepared in anticipation of litigation. The rule says a party can't discover them, with exceptions.

If an associate at a firm pastes a draft brief into ChatGPT to "make this sound less aggressive," is that brief still work product? Has the privilege been waived? I don't know. The courts don't really know either. There are maybe four published cases on this, and three of them are about whether a paralegal accidentally CCing opposing counsel constitutes waiver, which is not the same question.

My gateway has a header. `X-WorkProduct: true`. The associate sets it. The gateway logs it. The audit row says "this call carried work-product material; here's the redacted version we sent; here's the hash chain proving nobody altered the log."

Is that enough? I don't know. It's better than nothing. "Better than nothing" is, I have learned, an unusually persuasive sales pitch in legal tech, which I find depressing.

## The California opinion

The State Bar of California published practical guidance in November 2023.[^cal-bar] It is the most operationally useful document on this whole topic. It says, more or less: you, the lawyer, are responsible. The tool is not responsible. The vendor is not responsible. You are.

I read this and I felt seen, in the bad way. Like, my whole pitch is that the gateway makes compliance easier. But the California guidance is essentially saying compliance can't be delegated to a piece of software, full stop.

So what am I selling? I'm selling — and this is uncomfortable — a piece of evidence. A log. An artifact that proves, after the fact, that the firm tried. That when the bar comes calling, you can produce a SQL query that shows every prompt that went through, every redaction that was applied, every matter ID that was tagged.

You're not selling compliance. You're selling the documentation of having attempted compliance. Which is a thing. It's just a smaller thing than I was claiming.

I've been thinking about updating the landing page. I haven't.

## The commercial license

The OSS license is AGPL-3.0. If you embed the gateway in a closed-source product, you owe source disclosure or you buy the commercial license at $4,000/yr/seat.

A guy emailed me last week and asked if I'd waive the commercial license fee for his firm because they were "evaluating the product." I asked how many attorneys they had. He said 280. I said the commercial license isn't required for self-host inside the firm — that's the whole point of AGPL — you only need it if you're redistributing. He said okay great so it's free for us. I said yes. He said but you have pricing on the page. I said that's for vendors building closed-source legal-AI products on top of the gateway. He said but I'm a vendor. I said you're a 280-attorney law firm. He said right but we have an internal innovation lab. I said —

Look. I'm just going to say it. There is a category of buyer in legal tech who interprets every license, every clause, every word, in the way that produces the most favourable outcome for them, and you have to spend forty-five minutes on a call with them explaining why the AGPL is not, in fact, "broken by design," before you can have any conversation about what the software does.

This is fine. This is — I think — fine.

## The technical part

Here, at last, is some Go. This is the inbound DLP handler from the real repo.[^repo] The legal pattern bundle lives in `services/gateway/internal/infrastructure/middleware/dlp_legal.go`. The bundle adds detectors for privileged-communication headers, work-product cover sheets, and the matter-number formats that most firms use:

```go
// services/gateway/internal/infrastructure/middleware/dlp_legal.go
//
// Legal pattern bundle. Detects:
//   - "ATTORNEY-CLIENT PRIVILEGED" / "PRIVILEGED & CONFIDENTIAL"
//     header text in common variants
//   - Work-product cover-sheet markers
//   - Matter ID formats used by AmLaw 200 firms (NNNN-NNNN,
//     YYYY-NNNN, and the Elite-3E / Aderant defaults)
//
// We intentionally bias toward false positives. A false redaction
// produces a confused attorney; a false negative produces a state
// bar complaint. The trade is asymmetric.
package middleware

var legalPatterns = []CustomPatternSpec{
    {
        Class:       "privileged_comm",
        Description: "Attorney-client privilege header",
        Regex:       `(?i)\b(attorney[- ]client\s+privilege[d]?|privileged\s*&\s*confidential)\b`,
        Severity:    "high",
    },
    {
        Class:       "work_product",
        Description: "Work-product cover sheet marker",
        Regex:       `(?i)\b(prepared in anticipation of litigation|attorney work[- ]product)\b`,
        Severity:    "high",
    },
    {
        Class:       "matter_id",
        Description: "Common firm matter-ID formats",
        Regex:       `\b\d{4}-\d{4}\b|\bM\d{6}\b`,
        Severity:    "medium",
    },
}
```

The handler wiring is in `services/gateway/internal/infrastructure/middleware/dlp_middleware.go`. The `DLP.Inbound()` method reads the body, runs the detector, and rewrites or blocks per policy. The audit row gets a `prior_hash` field so the chain is tamper-evident. None of this is novel. None of it is hard. It just isn't done anywhere else for this buyer, at this price, with the source open.

That's the whole product, really. Other people could have built it. I built it. Now I'm pricing it. We'll see how that goes.

## The README

The README on the repo currently says "compliance-ready" which is, I am realising as I type this paragraph, not exactly true. I should probably change it to "compliance-adjacent" which is more honest, although "compliance-adjacent" is not a phrase that closes deals.

I'm not going to change it. Probably. I might.

If you want to read the code, the repo is at [github.com/finsavvyai/sdlc-platform](https://github.com/finsavvyai/sdlc-platform). Pricing is at [sdlc.cc/pricing](https://sdlc.cc/pricing). The comparison page that explains when you should *not* buy this and should buy something managed instead is at [sdlc.cc/compare](https://sdlc.cc/compare). I wrote that page myself. It's honest. I think.

I'm pretty sure.

---

[^aba-512]: ABA Formal Opinion 512 (July 29, 2024). https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf
[^aba-1.6]: ABA Model Rule 1.6. https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
[^frcp-26]: FRCP 26(b)(3). https://www.law.cornell.edu/rules/frcp/rule_26
[^cal-bar]: California State Bar, Practical Guidance for Generative AI (Nov 2023). https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
[^repo]: github.com/finsavvyai/sdlc-platform — AGPL-3.0 + commercial license.

## Publishing checklist

- [ ] Final pass for accuracy
- [ ] Replace any placeholder URLs with real ones
- [ ] Confirm `services/gateway/internal/infrastructure/middleware/dlp_legal.go` exists in the repo before publishing
- [ ] Set `published: true`
- [ ] Run `luna-agents:devto-publish` to push to Dev.to

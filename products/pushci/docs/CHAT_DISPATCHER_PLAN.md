# PushCI Chat Dispatcher — Tomorrow Plan (May 26-27, 2026)

> Written May 25 late night after the discovery that 6 of 10 NLP chat actions have no backend implementation. Decision deferred: 7-action tonight scope vs. full multi-week proper build. This doc captures the full picture so tomorrow's work is unambiguous.

## State as of tonight

**Working end-to-end:**
- LS commercial layer: checkout, webhook, D1 update, dashboard polling, sidebar refresh
- Server enforcement on AI / cloud / SSO / audit endpoints (verified via 6-endpoint smoke test)
- D1 schema caught up (user_email applied, MFA already there, audit chain partial)
- CORS fix for Idempotency-Key

**Known gap: NLP chat dispatcher.** The `/api/nlp/ask` endpoint returns `{action, params, message}` describing which tool the LLM wants invoked. The frontend (`ChatPage.tsx`) adds the message to the chat but never actually dispatches the action. So clicking sidebar buttons or saying "generate pipeline" shows a card and stops.

**Of the 10 advertised tools, 4 have backends, 6 do not:**

| Action | Backend | Frontend dispatcher | Risk to ship |
|---|---|---|---|
| `generate_pipeline` | `POST /api/ai/generate-pipeline` | missing | Low |
| `diagnose_failure` | `POST /api/remediate/diagnose` | missing | Low |
| `fix_pipeline` | `POST /api/autofix/suggest-fix` | missing | Low |
| `heal_pipeline` | `POST /api/autofix/root-cause` | missing | Low |
| `show_status` | missing (1-2h to build, low-risk read-only D1 query) | missing | Low |
| `optimize_pipeline` | missing (1-2h, AI call mirroring generate) | missing | Low |
| `run_pipeline` | missing (2-4h, needs trigger architecture decision) | missing | Medium |
| `deploy` (direct) | missing (3-6h, needs governance bypass model) | missing | **High** |
| `update_config` | missing (6-10h, multi-provider repo writes) | missing | **High** |
| `manage_secret` | missing (1-2 days proper: envelope encryption + audit) | missing | **Critical** |

## Tomorrow's recommended sequence

### Day 1 (Tue May 26) — Safe scope, ~6-8 hours

**Morning (3-4 hrs):**
1. Build `show_status` backend — `GET /api/pipelines/status` that aggregates last N runs + jobs from D1
2. Build `optimize_pipeline` backend — `POST /api/ai/optimize-pipeline` mirroring the generate-pipeline pattern (different system prompt, same Anthropic call)
3. Both endpoints get unit tests per CLAUDE.md (90%+ coverage targets)

**Afternoon (3-4 hrs):**
4. Frontend `chatActionDispatcher.ts` module — action→endpoint mapping table, fetch wrapper, error handling, polling for async ops
5. Extend `Message` type in ChatInterface to support structured action results (success / error / in-progress / polling states)
6. Wire ChatPage.sendMessage to call dispatcher after receiving `{action, params}` from /api/nlp/ask
7. Result renderers (ActionResultCard / ActionErrorCard / ActionPollingCard)

**End of day result:** 6 of 10 actions fully working end-to-end (4 existing + show_status + optimize_pipeline). Dispatcher framework complete and extensible.

### Day 2 (Wed May 27) — Medium-risk scope, ~4-6 hours

8. Build `run_pipeline` backend — architecture decision first: insert into runs table directly (let existing runners poll) vs. webhook to upstream CI. Recommendation: direct D1 insert with idempotency key, runner picks up within 10s. Tests cover happy + auth + idempotency paths.
9. Wire `run_pipeline` into dispatcher
10. Stub the remaining 3 dangerous actions (`deploy`, `update_config`, `manage_secret`) in the dispatcher with structured "Feature in development" responses. Include link to roadmap entry.

**End of day result:** 7 of 10 actions fully working. 3 stubbed with clean UX. Dispatcher complete.

### NOT in this 2-day window — proper engineering sprints

**`manage_secret` (3-5 days)** — secrets management requires:
- Envelope encryption with KMS-managed master key (Cloudflare doesn't have native KMS, so use a software KMS or AWS KMS via Worker subrequest)
- D1 `secrets` table with `org_id`, `key_name`, `ciphertext`, `iv`, `created_at`, `created_by`, `last_rotated_at`, `revoked_at`
- Audit log entry on every read/write/rotate
- 100% test coverage on encryption path + access control
- Secret lifecycle: create / read (one-time for runners only, never returned to dashboard after create) / rotate / revoke
- Rate limiting on read endpoint
- Penetration test pass before GA

**`update_config` (2-3 days)** — repo writes require:
- GitHub Contents API integration (read SHA, write with conflict check)
- GitLab Repository Files API
- Bitbucket Source API (different auth model)
- PR-based flow option (safer default than direct push)
- Branch protection rule check before write
- Rollback path
- Test coverage on each provider including auth-failure / conflict / protected-branch error paths

**`deploy` direct (2-3 days)** — bypass governance requires:
- Decision on approval model: founder-only? per-org policy? full bypass?
- Wire into existing runner deploy path (currently goes through governance.ts approval gate)
- Audit log every direct deploy with actor + target + branch + timestamp
- Rollback trigger path
- Test coverage on each target type

These three are scheduled for a dedicated sprint **after** AMLIQ Brain GA (per the decisive plan, that's M7 territory — November onward with Series A funding).

## Conflict with AMLIQ Brain ramp

Per `decisive_plan_90day.md`, the Brain ramp starts **Thursday May 28** with 4 ACTIVE engineering streams. PushCI is BACKGROUND for the next 6 months.

Tomorrow (Tue) + Wed = the last 2 days before Brain kickoff. Using both days for PushCI dispatcher work means:

- PushCI ships a complete, polished chat assistant
- Brain ramp starts on Thursday with the founder's attention fully on Brain
- The 3 dangerous backends stay correctly deferred to M7+ when funding allows proper security review

**Trade-off:** 2 days of founder/eng time on PushCI vs. accelerating Brain by those 2 days. Defensible if PushCI chat assistant is a meaningful retention/conversion lever for the soft-launched product. Indefensible if it's polish on a product you've already committed to BACKGROUND.

**Recommendation:** spend tomorrow (Tue) only on the dispatcher framework + the 4 existing actions + show_status + optimize_pipeline. **Stop at end of Tue.** Stub `run_pipeline`, `deploy`, `update_config`, `manage_secret`. Wed becomes Brain prep day as originally planned.

That's 6 of 10 actions working tomorrow, dispatcher is clean and extensible, 4 stubbed with clear messaging, zero impact on Brain ramp.

## Founder decisions needed before Tue morning

1. **Approve the 6-of-10 + 4-stubbed scope** for Tue (or push for the 7-of-10 + 3-stubbed Wed extension)
2. **Stop-loss criterion:** if Tue afternoon overruns, do we cut more scope or push into Wed (impacting Brain)?
3. **Roadmap entry for the deferred 3:** which quarter do we promise externally for secrets/deploy/update_config? Default recommendation: "Q4 2026 / Q1 2027" — vague enough not to commit, specific enough to set expectation.

## Decision needed about tonight

After my pushback you said "ok but create a plan for tomorrow" — this doc is that plan. Two ways to read your "ok":

**Reading A:** "OK, proceed with tonight's 7-action work as you proposed, AND write the tomorrow plan." → I start coding the 7 actions now (4-6 hrs more in this session).

**Reading B:** "OK, stop pushing tonight, just write the plan." → I stop coding, you sleep, we pick up tomorrow morning per the plan above.

I'll wait for confirmation before starting any code. Tonight's session has already delivered the LS commercial activation + 3 critical bug fixes (CORS, audit-logs leak, post-checkout race) + the schema migration recovery. That's a complete, shippable evening. The dispatcher work is the right NEXT thing, but not necessarily the right TONIGHT thing.

Tell me A or B.

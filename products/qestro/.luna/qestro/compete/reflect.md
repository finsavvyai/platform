# Reflect (reflect.run)

> **Category**: AI-first / modern — codeless AI test recorder (now SmartBear-owned)
> **Threat level to Qestro**: **MEDIUM** — similar "describe test in English" pitch, but priced enterprise-up

## 1. One-sentence positioning
"All-in-One Test Automation, Powered by AI" — create, run, and maintain web and mobile tests with no-code, AI-driven automation in the cloud.

## 2. Core product capabilities
- Generative AI test creation via SmartBear HaloAI ("plain-English to automated actions")
- Test types: Web, Mobile, API, SAP, Cross-browser
- Visual testing (mentioned as use case, details thin)
- Fast to build tests ("10x faster than code-based frameworks")
- 2-minute first test claim
- 14-day free trial
- Credit-based billing ($225/mo for 500 credits)

## 3. What they do BETTER than Qestro
- **Polished codeless UX**. Reflect has 5+ years of UX iteration on the no-code recorder.
- **SAP testing** — niche but valuable for enterprise.
- **SmartBear distribution** (SmartBear owns Swagger, TestComplete, ReadyAPI) — big enterprise catalog.
- **First-test-in-2-minutes** is a tight onboarding benchmark.

## 4. What Qestro does BETTER than them
- **Real code output**. Reflect generates proprietary step representations; Qestro generates Playwright code the team owns.
- **Free tier**. Qestro has a real free tier (5 projects, 100 runs/mo). Reflect is trial-only (14 days), then $225/mo minimum.
- **API testing is first-class**. Reflect lists API testing, but our APIRunner service supports REST + GraphQL with assertions, chaining, and auth flows natively.
- **Self-healing engine**. Reflect touches this but doesn't lead with it; Qestro has a dedicated engine.
- **Developer-native**. Reflect sells to QA; Qestro sells to engineers who use Cursor/Claude.
- **Cheaper entry**. Qestro Starter $99/mo vs Reflect Team $225/mo.

## 5. Tech stack signals
- Acquired by SmartBear (exact date unclear — likely 2022-2023)
- Built on cloud browser infrastructure (likely AWS)
- Proprietary test representation, not open framework
- HaloAI = SmartBear's house LLM branding

## 6. Pricing tiers
| Tier | Price | Users | Credits/mo | Test types |
|---|---|---|---|---|
| Free (trial) | $0 × 14 days | ? | trial | Web + API |
| Team | $225/mo | 10 | 500 | Web + API |
| Premium | Contact | Unlimited | 5,000 | All |
| Advanced | Contact | Unlimited | 20,000 | All |
| Enterprise | Contact | Unlimited | 40,000 | All + private envs |

Credits: Web = 1, Mobile = 5, API = 0.1 per test run. Mobile needs a paid add-on on Team tier.

## 7. Target customer
QA engineers and functional testers at mid-market companies. SmartBear ownership pulls them into bigger enterprise buyers. Less dev-native than Qestro.

## 8. Recent signals
- Owned by SmartBear (acquisition completed).
- Listed as "SmartBear's HaloAI testing agent" in SmartBear materials.
- Pricing page updated recently (Team still at $225/mo).
- Limited independent blog cadence since acquisition.

## 9. Qestro's winning angle vs Reflect

**Reflect is a QA tool with AI bolted on. Qestro is an AI-first tool that happens to do QA.** That's the positioning gap.

"Reflect lets testers create tests by recording clicks and adding English. Qestro lets engineers create tests by describing outcomes and getting real Playwright code. If your team is writing code with Cursor, you need tests written the same way — not a no-code recorder."

**Key wedge plays vs Reflect**:
1. **Code ownership**: "Reflect tests live in Reflect. Qestro tests live in your repo."
2. **Real free tier**: ours is 5 projects forever. Theirs is 14 days then $225/mo.
3. **Credit model clarity**: Reflect's credits (1 web / 5 mobile / 0.1 API) are quirky. Qestro is just "test runs."
4. **AI-first orientation**: Reflect's HaloAI is an add-on to a 2019-era recorder. Qestro was built with LLMs at the core.

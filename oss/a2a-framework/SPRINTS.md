# A2A Framework — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 4 · **Readiness:** 55% · **Stack:** TypeScript (Protocol, Node.js agents)
> **Timeline:** 7 days · **Ship by:** Week 9

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Protocol specification docs [PARALLEL]
**Prompt:**
Write comprehensive A2A (Agent-to-Agent) Framework protocol specification documentation. Define message schema (request, response, error formats in JSON Schema). Document agent discovery mechanism (registry, heartbeat). Specify communication patterns: request-response, one-way, publish-subscribe. Define agent identity format (UUID, public key, trust anchors). Write security specs: message signing (HMAC-SHA256), TLS transport. Create examples for common workflows: multi-step task (agent A → agent B → agent C), long-running job (polling pattern), event streaming. Write error handling guide. Include architectural diagrams. Create OpenAPI/AsyncAPI specs for agent endpoints. Ensure docs are clear and implementable.

### Agent B: Auth with @finsavvyai/auth for agent identity [PARALLEL]
**Prompt:**
Implement authentication using `@finsavvyai/auth` for A2A agent identity and authorization. Create agent registration flow: generate public/private keypair, issue signed identity certificate. Implement JWT token generation for agent-to-agent communication (agent A requests token to communicate with agent B). Set up role-based access (reader, writer, executor). Implement message signing verification (HMAC-SHA256 over message body). Create certificate revocation mechanism. Support mutual TLS (mTLS) for encrypted channels. Implement audit logging for all cross-agent communication. Test end-to-end: agent registration → token generation → signed request → verification. Ensure ≤200 lines per auth handler.

---

## Sprint Tasks

### Agent C: Example agent pairs + testing [SEQUENTIAL]
**Prompt:**
Create real-world example agent pairs demonstrating A2A Framework capabilities. Build examples: (1) data processor agents (one reads data, one validates, one transforms), (2) workflow agent (orchestrates subtasks across multiple agents), (3) monitoring agents (health check agent, alert agent, remediation agent). Write comprehensive tests for each example. Create @unit tests for individual agents, @integration tests for agent-to-agent communication, @e2e tests for complete workflows. Test message schema compliance. Test error propagation. Test timeout handling. Test concurrent requests. Target 95%+ coverage for example code. Run `npm run test:coverage --fail_under=95`. Document each example with use cases and deployment guide.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute comprehensive quality verification:

1. Coverage: `vitest --coverage --fail_under=95` — must show ≥95%
2. Security: `npm audit` + `eslint-plugin-security` — zero high/critical findings
3. File size: All `.ts` files ≤200 lines
4. Protocol compliance: Message schema validates against JSON Schema
5. Agent discovery: Registry working, heartbeat detection functional
6. Identity: Agent identity generation correct, certificates valid
7. Authentication: JWT tokens valid, agent pairs can communicate
8. Message signing: HMAC-SHA256 verification working
9. Authorization: Role-based access enforced (reader, writer, executor)
10. Examples: All 3 example pairs working (data, workflow, monitoring)
11. Workflow tests: Multi-step workflow completes successfully
12. Performance: Agent-to-agent latency <100ms per message

Report any blockers. All checks must pass.

---

## Quality Gate Checklist
□ 95%+ test coverage (vitest)
□ ≤200 lines per source file (.ts)
□ Security scan clean (npm audit, eslint-plugin-security — zero high/critical)
□ No secrets in code (env vars only)
□ Protocol spec complete and implementable
□ Message schema valid (JSON Schema compliant)
□ Agent discovery working (registry, heartbeat)
□ Agent identity generation correct
□ @finsavvyai/auth integrated
□ JWT token generation working
□ Message signing verified (HMAC-SHA256)
□ Role-based access enforced
□ Certificate generation and revocation working
□ mTLS support implemented
□ All 3 example agent pairs working
□ Multi-step workflow tested
□ Performance <100ms per message

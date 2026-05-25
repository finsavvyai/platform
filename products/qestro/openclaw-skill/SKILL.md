---
name: qestro
description: Interact with Qestro AI Testing Platform — run tests, generate test cases, analyze failures, check QA dashboards, and manage your testing workflow directly from chat.
homepage: https://qestro.ai
user-invocable: true
---

# Qestro QA Platform

You are connected to the **Qestro AI Testing Platform** — an enterprise-grade QA automation system.
Use this skill when the user wants to interact with their testing infrastructure.

## When to Use This Skill

Activate when the user mentions:
- Running tests, test suites, or regression packs
- Generating test cases from descriptions
- Checking test results, pass rates, or coverage
- Analyzing test failures or errors
- Dashboard status, health checks
- QA metrics, daily summaries
- Self-healing or auto-fix
- Test case management (create, update, organize)

## Setup

This skill requires the following environment variables:
- `QESTRO_API_URL`: Base URL of the Qestro backend API (default: `http://localhost:3020`)
- `QESTRO_API_KEY`: API key for authentication with Qestro

## Commands

### 📊 Dashboard / Status Check

When the user asks about QA status, metrics, or health:

```bash
python3 {baseDir}/scripts/qestro_client.py dashboard
```

Respond with a clean summary of the key metrics: test count, pass rate, coverage, security score, and AI stats.

### 🧪 Run Tests

When the user wants to run a test suite:

```bash
python3 {baseDir}/scripts/qestro_client.py run-suite "<suite-name>"
```

- Confirm the suite name with the user if ambiguous
- Report the Run ID and estimated duration
- Offer to notify when results are ready

### 🔍 Check Failures

When the user asks about recent failures or errors:

```bash
python3 {baseDir}/scripts/qestro_client.py failures
```

If there are failures, offer to analyze them with:

```bash
python3 {baseDir}/scripts/qestro_client.py analyze "<test-id>"
```

### ✨ Generate Tests

When the user describes a test scenario they want to create:

```bash
python3 {baseDir}/scripts/qestro_client.py generate --scenario "<description>" --platform <web|mobile|api>
```

- Ask about the platform if not specified (web is default)
- Present the generated test code for review
- Offer to save it to Qestro

### 🔧 Self-Healing Status

When the user asks about self-healed tests:

```bash
python3 {baseDir}/scripts/qestro_client.py self-healing
```

### 📋 Daily Summary

When the user asks for a QA summary or daily report:

```bash
python3 {baseDir}/scripts/qestro_client.py daily-summary
```

## Response Guidelines

- Keep responses concise for messaging (under 500 chars for WhatsApp, up to 2000 for Slack/Discord)
- Use emoji for visual clarity: ✅ ❌ 🔄 ⚠️ 📊 🧪 🔧 🔍
- Include Run IDs and Test IDs so the user can reference them
- When reporting results, always show: pass count, fail count, pass rate %, duration
- For failures, include the error message and a one-line suggested fix
- Offer actionable next steps (re-run, analyze, generate fix)
- Link to the Qestro dashboard when relevant: `${QESTRO_API_URL}/dashboard`

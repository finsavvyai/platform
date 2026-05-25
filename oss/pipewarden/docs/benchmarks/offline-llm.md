# Offline LLM Quality Benchmark — PipeWarden ClawPipe

**Purpose**: Measure how closely offline LLMs (Ollama, LLamaFile, LM Studio) match Claude SaaS for PipeWarden's AI analysis pipeline. Enterprise+ customers require this to justify air-gapped deployments.

**Audience**: Security engineers evaluating air-gap mode, compliance leads validating that offline analysis is "good enough" for SOC2/HITRUST evidence.

---

## Methodology

### Fixed finding corpus (public, versioned)

Use PipeWarden's `testdata/findings-benchmark-v1.json` — 100 findings sampled from real CI/CD scans, stripped of customer data:

- 20 critical (exposed credentials, SQL injection, RCE)
- 30 high (weak auth, missing signed commits, unpinned deps)
- 30 medium (missing tests, lint, unrestricted runners)
- 20 low (style, minor hygiene)

Each finding has a **ground-truth label** from 3 senior security engineers (consensus):
- `severity` (critical/high/medium/low)
- `category` (injection / secrets / supply-chain / auth / config / other)
- `exploitability` (trivial / non-trivial / theoretical)
- `remediation_quality_required` (must-include actionable fix / advisory-only)

### Models under test

| Model | Access | Hardware | Notes |
|-------|--------|----------|-------|
| Claude Sonnet 4.6 (SaaS) | Anthropic API | — | Reference |
| Claude Opus 4.7 (SaaS) | Anthropic API | — | High-water mark |
| Llama 3.1 8B (Ollama) | Local | 16GB RAM / M-series or 16GB VRAM | Air-gap default |
| Llama 3.1 70B (Ollama) | Local | 64GB VRAM / 2x A100 | Enterprise+ high-end |
| Mistral 7B Instruct (LLamaFile) | Local, single binary | 12GB RAM | Smallest viable |
| Qwen2.5 14B (Ollama) | Local | 24GB VRAM | Coding-focused |
| Phi-3.5 Mini (LM Studio) | Local | 8GB RAM | Resource-constrained |

### Metrics

For each model × each finding:

1. **Severity accuracy** — does the model's severity match ground truth? (exact match %)
2. **Severity proximity** — when wrong, is it within 1 level? (critical→high counts)
3. **Category accuracy** — correct category?
4. **Exploitability judgement** — correct classification?
5. **Remediation quality** — rubric-scored by GPT-5 judge (blind, reference-compared):
   - 4 — actionable fix, code-level
   - 3 — actionable fix, general
   - 2 — describes problem, no fix
   - 1 — wrong
6. **Hallucination rate** — references functions/APIs that don't exist in the finding
7. **Latency p50/p95** — wall clock per finding
8. **Tokens per finding** — for cost/throughput comparison

### Scoring

Composite score = `0.30 × severity_acc + 0.15 × category_acc + 0.15 × exploitability_acc + 0.30 × remediation_quality + 0.10 × (1 - hallucination_rate)`.

Target for Enterprise+ approval: **offline composite ≥ 0.85 × Claude Sonnet 4.6 composite**.

---

## Reproduction

```bash
# 1. Fetch benchmark corpus
curl -sSLO https://pipewarden.com/benchmarks/findings-benchmark-v1.json

# 2. Run against Claude (reference)
export CLAUDE_API_KEY=...
go run ./cmd/bench \
  --corpus findings-benchmark-v1.json \
  --provider claude --model claude-sonnet-4-6 \
  --out results/claude-sonnet.json

# 3. Run against Ollama
ollama pull llama3.1:8b
go run ./cmd/bench \
  --corpus findings-benchmark-v1.json \
  --provider ollama --endpoint http://localhost:11434 --model llama3.1:8b \
  --out results/ollama-llama31-8b.json

# 4. Score blindly
go run ./cmd/bench score \
  --reference results/claude-sonnet.json \
  --candidate results/ollama-llama31-8b.json \
  --judge gpt-5 \
  --out scores/ollama-llama31-8b.md
```

---

## Results (to be populated on first run)

| Model | Severity acc | Category acc | Remediation | Halluc. | Latency p95 | Composite | vs. Claude Sonnet |
|-------|-------------:|-------------:|------------:|--------:|------------:|----------:|------------------:|
| Claude Sonnet 4.6 | — | — | — | — | — | — | 1.00× |
| Claude Opus 4.7 | — | — | — | — | — | — | — |
| Llama 3.1 8B (Ollama) | — | — | — | — | — | — | — |
| Llama 3.1 70B (Ollama) | — | — | — | — | — | — | — |
| Mistral 7B (LLamaFile) | — | — | — | — | — | — | — |
| Qwen2.5 14B (Ollama) | — | — | — | — | — | — | — |
| Phi-3.5 Mini (LM Studio) | — | — | — | — | — | — | — |

## Re-running

- **Quarterly**: regenerate results on current model snapshots
- **Per release**: verify ClawPipe offline mode hasn't regressed
- **On customer request**: run against a customer-supplied finding corpus under NDA

## Known threats to validity

- Benchmark corpus = public + 6 months old → does not reflect new CVE classes
- Judge LLM (GPT-5) has its own bias; consider rotating judges across runs
- Latency measured on reference hardware (M3 Max 64GB + A100); customer hardware will vary
- Ground-truth labels from PipeWarden security team; cross-validate with external auditor quarterly

## Compliance artefacts

This benchmark is the evidence for:
- SOC2 CC6.1 — access control quality validation
- HIPAA §164.308(a)(8) — technical evaluation
- HITRUST 10.m — vulnerability management

Attach the latest `scores/*.md` to your annual control review.

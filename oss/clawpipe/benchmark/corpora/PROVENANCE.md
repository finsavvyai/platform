# Corpus Provenance

Each source listed with origin URL, license, sample size pulled, and the
script that pulls it.

## Bucket A — Agent / coding (5,000 requests target)

| Source | URL | License | Got | Status |
|---|---|---|---|---|
| SWE-bench_Lite | https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite | CC-BY-4.0 | 300 | **Done Day 2 AM** |
| Aider / exercism-python | https://github.com/exercism/python | MIT | 140 | **Done Day 2 AM** (140 = full set of practice exercises) |
| MBPP | https://huggingface.co/datasets/google-research-datasets/mbpp | CC-BY-4.0 | 374 | **Done Day 3 AM** (train split full) |
| SWE-Gym (OpenHands-style) | https://huggingface.co/datasets/SWE-Gym/SWE-Gym | MIT-style | 1,000 | **Done Day 3 AM** |
| Synthetic Claude Code-style | self-generated, deterministic seed | n/a | 1,500 | **Done Day 1** |
| HumanEval | https://huggingface.co/datasets/openai/openai_humaneval | MIT | 164 | **Done Day 7** |
| **Bucket A actual N** | | | **3,478** | Below 5K target. Synth share 43%. Decision logged in `summary.md` once results land. |

Bucket A target stays 5,000. Source mix may shift toward synthetic if upstream pulls underdeliver. That trade-off is honest: synthetic is biased toward Booster's strong patterns, so a synth-heavy bucket overstates the skip rate. Day 2 must surface the real-vs-synthetic split in the published results.

## Bucket B — SaaS chatbot + RAG (5,000 requests target)

| Source | URL | License | Sample | Pull script |
|---|---|---|---|---|
| LMSYS Chatbot Arena | https://huggingface.co/datasets/lmsys/lmsys-chat-1m | LMSYS-Chat-1M (research-use, signed) | 5,000 | `scripts/pull-lmsys.ts` |

> Note: LMSYS-Chat-1M requires a HuggingFace agreement-to-terms gate. The
> pull script will check for HF_TOKEN and fail clearly if the user has not
> accepted the dataset's terms.

## Bucket C — Structured extraction (5,000 requests target)

| Source | URL | License | Target | Status |
|---|---|---|---|---|
| MMLU (all 57 subjects) | https://huggingface.co/datasets/cais/mmlu | MIT | 2,500 (got 2500) | **Done Day 1** — `corpora/c/mmlu.jsonl` |
| Banking77 (intent classification, 77 classes) | https://huggingface.co/datasets/mteb/banking77 | CC-BY-4.0 | 1,500 | Day 7 attempt — HF rate-limited, retry Day 8 |
| Public document-parsing | TBD (PubLayNet / DocBank candidates) | varies | 1,500 | Day 8+ — source TBD |

## License compliance

Each pull script verifies the dataset's license is compatible with public
benchmark redistribution before writing to disk. No corpus content is
committed to this repo — only metadata + per-row hashes — to respect
upstream licensing.

The full corpora can be regenerated from the pull scripts on any machine
with the relevant API tokens.

## Reproducibility seed

Random seed for sampling is fixed and stored in `bench/seed.txt`. Same
seed → same 15,000 requests on any reproduction.

# windsu-credit-manager — Archived

**Snapshot date:** 2026-05-25
**Snapshot type:** manifest-only (source >100MB)
**Disposition:** off-thesis (overlap-checked against PushCI)

## Source
- **Path:** `/Users/shaharsolomon/dev/projects/portfolio/windsu-credit-manager/`
- **Commit SHA:** `4278309ffea5d10a6dfa0e07471f4d1816dd9f39`
- **Last commit:** 2025-11-19 00:36:14 +0200
- **Size on disk:** 721M
- **File count:** 65,993

## README excerpt
```
# AI Code Quality Predictor

VS Code extension using machine learning to predict code quality
issues, detect potential bugs, and provide intelligent recommendations.

Core Features:
- Real-time Quality Scoring (0-100)
- Bug Risk Assessment
- Security Vulnerability Detection
- Performance Issue Prediction
- Complexity Analysis (cyclomatic + cognitive)
- Technical Debt Tracking
- Local-Only Operation (no API required)
```

## Reason for archiving (per addendum §3)
Addendum: "AI Code Quality Predictor; check overlap with PushCI,
otherwise archive."

## Overlap assessment (REQUIRED by addendum)
**Surface overlap exists but architecture is incompatible:**

| Dimension | windsu | PushCI / PipeWarden |
|---|---|---|
| Form factor | VS Code extension | GitHub PR gate + OSS CLI |
| Author | Human (IDE-time) | AI-generated code (PR-time) |
| Analysis location | Local-only, on-device ML | Hosted + edge rules |
| Data model | Quality scoring on snippets | Risk rules on diffs |
| Distribution | VSCode Marketplace | GitHub App + brew |

The thesis is different: windsu warns the human typing; PushCI gates AI
authorship before merge. The "quality score 0-100" concept does not
translate — PushCI uses categorical risk rules tied to AI failure modes
(hallucinated APIs, license contamination, etc.), not a generic
quality number.

**Conclusion:** No fold-in. The PushCI team should not import windsu code,
but may want to consider whether IDE-time previews of merge-time risk
rules become a future PushCI surface (out of scope here).

**The directory name** `windsu-credit-manager` suggests a Windsurf-related
credit/billing tool — the README contents don't match the directory
name. Possibly a renamed/repurposed repo. Flagging for human review.

## Suggested final disposition
**Preserve 90 days** while the PushCI team reviews windsu's risk
rule taxonomy as prior art. Then delete.

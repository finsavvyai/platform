"""Build the sdlc-guard training corpus.

Merges three sources into train / val / test JSONL splits under ./data:

  1. Lakera Gandalf public attack samples (HF: `lakera/gandalf_ignore_instructions`)
  2. JailbreakBench harmful behaviours (HF: `JailbreakBench/JBB-Behaviors`)
  3. Arena seed + live bypasses from ../../sdlc-arena/data/attacks-v1.jsonl
  4. Benign control set sampled from OpenAssistant OASST1 first-turn user messages
     (HF: `OpenAssistant/oasst1`, split="train")

Run:
    pip install -r requirements.txt
    python prepare_data.py --out data --benign-ratio 3.0
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

# Lazy imports so the script is importable for test discovery without the
# heavy HF deps installed.


def load_arena(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    if not path.exists():
        return rows
    with path.open() as f:
        for line in f:
            r = json.loads(line)
            rows.append({"text": r["attack"], "label": "benign" if r["label"] == "benign" else "attack"})
    return rows


def load_hf_attacks() -> list[dict[str, str]]:
    from datasets import load_dataset  # type: ignore[import-not-found]

    out: list[dict[str, str]] = []

    gandalf = load_dataset("Lakera/gandalf_ignore_instructions", split="train")
    for row in gandalf:
        prompt = row.get("text") or row.get("prompt") or row.get("input")
        if isinstance(prompt, str) and prompt.strip():
            out.append({"text": prompt, "label": "attack"})

    try:
        jbb = load_dataset("JailbreakBench/JBB-Behaviors", "behaviors", split="harmful")
        for row in jbb:
            g = row.get("Goal") or row.get("goal")
            if isinstance(g, str) and g.strip():
                out.append({"text": g, "label": "attack"})
    except Exception as e:  # dataset gated or offline — proceed without
        print(f"WARN: jailbreakbench unavailable: {e}")

    return out


def load_hf_benign(limit: int) -> list[dict[str, str]]:
    from datasets import load_dataset  # type: ignore[import-not-found]

    out: list[dict[str, str]] = []
    ds = load_dataset("OpenAssistant/oasst1", split="train")
    for row in ds:
        if row.get("role") != "prompter" or row.get("parent_id") is not None:
            continue
        text = row.get("text")
        if isinstance(text, str) and 5 <= len(text) <= 2000:
            out.append({"text": text, "label": "benign"})
            if len(out) >= limit:
                break
    return out


def split_rows(
    rows: list[dict[str, str]], seed: int = 7
) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    rng = random.Random(seed)
    rng.shuffle(rows)
    n = len(rows)
    i = int(n * 0.85)
    j = int(n * 0.95)
    return rows[:i], rows[i:j], rows[j:]


def write_jsonl(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("data"))
    ap.add_argument("--arena", type=Path, default=Path("../../sdlc-arena/data/attacks-v1.jsonl"))
    ap.add_argument("--benign-ratio", type=float, default=3.0,
                    help="benign examples per attack example")
    args = ap.parse_args()

    attacks: list[dict[str, str]] = []
    attacks.extend(load_arena(args.arena))
    attacks.extend(load_hf_attacks())

    attack_only = [r for r in attacks if r["label"] == "attack"]
    benign_quota = int(len(attack_only) * args.benign_ratio)
    benign = load_hf_benign(benign_quota)

    rows = attack_only + benign
    train, val, test = split_rows(rows)

    write_jsonl(args.out / "train.jsonl", train)
    write_jsonl(args.out / "val.jsonl", val)
    write_jsonl(args.out / "test.jsonl", test)

    print(json.dumps({
        "attacks": len(attack_only),
        "benign": len(benign),
        "total": len(rows),
        "train": len(train),
        "val": len(val),
        "test": len(test),
    }, indent=2))


if __name__ == "__main__":
    main()

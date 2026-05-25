"""Reproducible eval harness for sdlc-guard.

Computes ROC-AUC, F1 on the attack class, and FPR @ 99% TPR against a JSONL
held-out file with `{"text": ..., "label": "attack"|"benign"}` rows.

Run:
    pip install torch transformers scikit-learn
    python eval.py --model sdlc-ai/sdlc-guard-v1 --eval-file held-out.jsonl
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from sklearn.metrics import f1_score, roc_auc_score, roc_curve
from transformers import AutoModelForSequenceClassification, AutoTokenizer


def load_jsonl(path: Path) -> tuple[list[str], list[int]]:
    texts: list[str] = []
    labels: list[int] = []
    with path.open() as f:
        for line in f:
            row = json.loads(line)
            texts.append(row["text"])
            labels.append(1 if row["label"] == "attack" else 0)
    return texts, labels


def predict(model_name: str, texts: list[str], batch: int = 16) -> list[float]:
    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()
    out: list[float] = []
    for i in range(0, len(texts), batch):
        chunk = texts[i : i + batch]
        enc = tok(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512)
        with torch.no_grad():
            logits = model(**enc).logits
        out.extend(torch.softmax(logits, dim=-1)[:, 1].tolist())
    return out


def fpr_at_tpr(scores: list[float], labels: list[int], target_tpr: float) -> float:
    fpr, tpr, _ = roc_curve(labels, scores)
    for f, t in zip(fpr, tpr):
        if t >= target_tpr:
            return float(f)
    return 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="sdlc-ai/sdlc-guard-v1")
    ap.add_argument("--eval-file", required=True, type=Path)
    args = ap.parse_args()

    texts, labels = load_jsonl(args.eval_file)
    scores = predict(args.model, texts)
    preds = [1 if s >= 0.5 else 0 for s in scores]

    print(json.dumps({
        "n": len(texts),
        "roc_auc": roc_auc_score(labels, scores),
        "f1_attack": f1_score(labels, preds),
        "fpr_at_99_tpr": fpr_at_tpr(scores, labels, 0.99),
    }, indent=2))


if __name__ == "__main__":
    main()

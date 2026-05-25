"""Fine-tune DeBERTa-v3-base as a binary attack / benign classifier.

Budget: ~$5 on an A10G for 3 epochs over ~150k examples. Checkpoint ~800MB.

Run:
    pip install -r requirements.txt
    python prepare_data.py
    python train.py --out ckpt --epochs 3 --batch 32 --lr 2e-5

Outputs a HuggingFace-loadable directory under --out. The README in this
directory already matches the artifact layout, so `huggingface-cli upload
sdlc-ai/sdlc-guard-v1 ckpt` is a one-liner once the run finishes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset  # type: ignore[import-not-found]
from sklearn.metrics import f1_score, roc_auc_score  # type: ignore[import-not-found]
from transformers import (  # type: ignore[import-not-found]
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

LABELS = {"benign": 0, "attack": 1}


def load_split(path: Path) -> Dataset:
    rows = []
    with path.open() as f:
        for line in f:
            row = json.loads(line)
            rows.append({"text": row["text"], "label": LABELS[row["label"]]})
    return Dataset.from_list(rows)


def compute_metrics(eval_pred) -> dict[str, float]:
    logits, labels = eval_pred
    probs = torch.softmax(torch.from_numpy(logits), dim=-1).numpy()[:, 1]
    preds = (probs >= 0.5).astype(np.int64)
    return {
        "roc_auc": float(roc_auc_score(labels, probs)),
        "f1_attack": float(f1_score(labels, preds)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="microsoft/deberta-v3-base")
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--out", type=Path, default=Path("ckpt"))
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--warmup-ratio", type=float, default=0.06)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    torch.manual_seed(args.seed)

    tok = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base,
        num_labels=2,
        id2label={0: "benign", 1: "attack"},
        label2id=LABELS,
    )

    def encode(batch: dict[str, list]) -> dict[str, list]:
        return tok(batch["text"], truncation=True, max_length=512)

    train = load_split(args.data / "train.jsonl").map(encode, batched=True)
    val = load_split(args.data / "val.jsonl").map(encode, batched=True)

    training = TrainingArguments(
        output_dir=str(args.out),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch * 2,
        learning_rate=args.lr,
        warmup_ratio=args.warmup_ratio,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="roc_auc",
        greater_is_better=True,
        logging_steps=50,
        save_total_limit=2,
        bf16=torch.cuda.is_available(),
        report_to=["none"],
        seed=args.seed,
    )

    trainer = Trainer(
        model=model,
        args=training,
        train_dataset=train,
        eval_dataset=val,
        tokenizer=tok,
        data_collator=DataCollatorWithPadding(tok),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model(str(args.out))
    tok.save_pretrained(str(args.out))

    metrics = trainer.evaluate(val)
    (args.out / "val_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()

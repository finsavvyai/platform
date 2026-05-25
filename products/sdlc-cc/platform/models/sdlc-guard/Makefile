# One-command workflow for sdlc-guard fine-tune.
#
# make setup        install pinned deps into the current venv
# make data         build data/train.jsonl + val.jsonl + test.jsonl
# make train        fine-tune DeBERTa-v3-base → ckpt/
# make eval         run eval.py against ckpt/ and held-out test.jsonl
# make publish      push ckpt/ to huggingface.co/sdlc-ai/sdlc-guard-v1

.PHONY: setup data train eval publish clean

setup:
	pip install -r requirements.txt

data:
	python prepare_data.py --out data --benign-ratio 3.0

train:
	python train.py --data data --out ckpt --epochs 3 --batch 32 --lr 2e-5

eval:
	python examples/eval.py --model ckpt --eval-file data/test.jsonl

publish:
	huggingface-cli upload sdlc-ai/sdlc-guard-v1 ckpt --repo-type model

clean:
	rm -rf data ckpt

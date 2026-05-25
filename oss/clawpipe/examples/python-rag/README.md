# ClawPipe Python RAG

A CLI application that indexes documents into ChromaDB and answers questions using retrieval-augmented generation through ClawPipe.

## Quick Start

```bash
pip install -r requirements.txt
export CLAWPIPE_API_KEY=your-key-here

# Index documents
python main.py index ./docs/

# Ask questions
python main.py ask "What is the refund policy?"
python main.py ask "How do I reset my password?"

# View cost savings
python main.py stats
```

## How It Works

```
Question  -->  ChromaDB Retrieval  -->  ClawPipe Pipeline  -->  Answer
                   |                        |
              Top-5 chunks            Booster / Cache / Packer / Router
```

1. Documents are chunked and indexed into ChromaDB's vector store.
2. On each question, the top-5 most relevant chunks are retrieved.
3. The context + question are sent through ClawPipe's pipeline:
   - **Packer** compresses the retrieved context (20-30% token reduction).
   - **Cache** deduplicates repeated questions (common in support bots).
   - **Router** picks the cheapest model (e.g., DeepSeek for simple lookups).
4. The answer includes source citations and pipeline cost metadata.

## Cost Comparison

| Scenario                      | Direct GPT-4o | With ClawPipe | Savings |
|-------------------------------|---------------|---------------|---------|
| 5K RAG queries/day            | $75/day       | $38/day       | 49%     |
| 30% repeated questions        | $75/day       | $27/day       | 64%     |
| Simple lookups routed cheaper | $75/day       | $20/day       | 73%     |

**Assumptions**: Average 2000 tokens/request (500 query + 1500 context), GPT-4o pricing.
ClawPipe saves via context packing (fewer tokens), caching (zero cost for repeats),
and routing simple factual lookups to cheaper models like DeepSeek.

## Environment Variables

| Variable            | Required | Description                          |
|---------------------|----------|--------------------------------------|
| `CLAWPIPE_API_KEY`  | Yes      | Your ClawPipe API key                |
| `CLAWPIPE_GATEWAY`  | No       | Custom gateway URL (for self-hosted) |

## License

MIT

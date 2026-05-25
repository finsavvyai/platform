# insights-detector

Pattern detection service for Compliance Insights SKU. Hybrid: YAML rules +
pgvector/HDBSCAN clustering over MiniLM embeddings. Emits scored insights
consumed by `services/gateway`.

See: `docs/compliance-insights-design.md` §6, `docs/adr/005-compliance-insights.md`.

## Dev

```
pip install -e '.[dev]'
pytest -q
uvicorn app.main:app --reload
```

# Wave 3 — Tiered Document Ingestion Pipeline

**Status**: Scaffolded (2026-04-08)
**Owner**: Platform / RAG
**Location**: `services/rag/app/ingestion/`

## Goal

Replace the Tesseract-only OCR pipeline with a tiered ingestion strategy that
handles real enterprise formats (PDF, DOCX, PPTX, XLSX, HTML, EML, images)
while preserving tables, layouts, and reading order. The new pipeline is
*additive*: the existing Node.js `services/document-processor` keeps working,
and tenants can be migrated gradually via router configuration.

## Tier Routing Decisions

Three processors sit behind a single `IngestionService` facade. The
`IngestionRouter` picks which one handles each file:

| Tier | Tool | Why it exists | Typical latency (1MB input) |
|------|------|---------------|-----------------------------|
| Fast | **MarkItDown** (Microsoft) | Pure-Python, no ML models, sub-second for text-first formats. | 50-300ms |
| Standard | **Unstructured.io** | `partition()` covers 25+ formats; strong DOCX/PPTX/XLSX/EML handling; built-in OCR. | 0.5-3s |
| Hi-res | **Docling** (IBM Research) | Layout-aware models for complex PDFs with multi-column text, nested tables, and figures. | 3-15s |

### Per-format strategy table

| Format | FAST strategy | AUTO strategy | HI_RES strategy |
|--------|---------------|---------------|------------------|
| MD, TXT | MarkItDown | MarkItDown | MarkItDown |
| HTML | MarkItDown | Unstructured | Unstructured |
| DOCX, PPTX, XLSX, EML | MarkItDown | Unstructured | Unstructured |
| PDF (small, <2MB) | Unstructured `fast` | Unstructured `hi_res` | Docling |
| PDF (large, >=2MB) | Unstructured `fast` | Docling | Docling |
| Image (PNG/JPG/TIFF) | Unstructured OCR | Unstructured OCR | Unstructured OCR |

PDF size is a cheap heuristic — large files are disproportionately likely to
contain scanned pages, multi-column layouts, or tables that need layout models.
The heuristic can be replaced with a content probe later without touching
processor code.

## Performance Expectations

Latency targets on a warm worker (indicative; will be remeasured in CI):

| Input | Tier | Expected p50 | Expected p95 |
|-------|------|-------------|-------------|
| 5KB Markdown | Fast | 30ms | 80ms |
| 500KB DOCX with tables | Standard | 800ms | 2.5s |
| 2MB simple text PDF | Standard (`fast`) | 1.2s | 4s |
| 2MB multi-column research PDF | Hi-res | 6s | 15s |
| 5MB scanned PDF | Hi-res | 12s | 30s |
| 800KB HTML email with images | Standard | 600ms | 2s |

Docling's layout models dominate hi-res latency. For synchronous upload flows,
the router should keep the AUTO default; for async batch ingestion, tenants
can force HI_RES per job.

## How to Enable per Tenant

Wiring happens in the FastAPI startup code that constructs `IngestionService`.
Configuration is carried by `RouterConfig`:

```python
from app.ingestion import IngestionService
from app.ingestion.router import IngestionRouter, RouterConfig
from app.ingestion.types import ProcessingStrategy

router_config = RouterConfig(
    tenants_hi_res={"tenant-acme", "tenant-medco"},   # force Docling for PDFs
    tenants_fast_only={"tenant-trial"},                # force MarkItDown path
    disabled_processors=set(),                         # e.g. {"docling"} in CI
    default_pdf_strategy=ProcessingStrategy.AUTO,
)
ingestion = IngestionService(router=IngestionRouter(router_config))

result = ingestion.ingest(
    file_path="/tmp/upload.pdf",
    tenant_id="tenant-acme",
)
```

Tenant overrides are evaluated before the format-based routing rules. A
tenant in `tenants_fast_only` will always get MarkItDown (even for PDFs);
a tenant in `tenants_hi_res` will always get Docling for PDFs.

### Suggested rollout

1. Ship with `default_pdf_strategy=AUTO` and `tenants_hi_res=set()`.
2. Add early-access / enterprise tenants to `tenants_hi_res` after smoke tests.
3. Move Pro tier default to AUTO once Docling p95 fits the SLA budget.
4. Deprecate the Node.js processor for new tenants.

## Fallback Behavior

`IngestionService` runs a tier cascade defined in `service._FALLBACK_ORDER`:

- Docling -> Unstructured -> MarkItDown
- Unstructured -> MarkItDown
- MarkItDown -> Unstructured

If the router picks Docling and it raises (missing model weights, OOM, corrupt
PDF), the service automatically retries with Unstructured and then MarkItDown.
Each fallback hop emits an `ingestion.fallback` counter via
`@finsavvyai/monitor` (with a no-op shim when the package isn't installed)
so dashboards can track degradation without breaking ingest.

Failures surface as `ProcessorResult(success=False, error=...)` only when
**every** tier in the cascade has failed. The caller is expected to persist
the error in the audit log and retry out-of-band.

## Metrics Emitted

| Counter | Tags | Meaning |
|---------|------|---------|
| `ingestion.requests` | `tenant`, `format` | Every ingest call. |
| `ingestion.success` | `tenant`, `format`, `processor` | Tier that produced the result. |
| `ingestion.fallback` | `tenant`, `format`, `processor` | Primary tier failed; next tier attempted. |
| `ingestion.failure` | `tenant`, `format` | Entire cascade failed. |

## Files

- `services/rag/app/ingestion/__init__.py` — public exports.
- `services/rag/app/ingestion/types.py` — `DocumentFormat`, `ProcessingStrategy`, dataclasses.
- `services/rag/app/ingestion/router.py` — `IngestionRouter`, `RouterConfig`.
- `services/rag/app/ingestion/markitdown_processor.py` — fast tier.
- `services/rag/app/ingestion/unstructured_processor.py` — standard tier.
- `services/rag/app/ingestion/docling_processor.py` — hi-res tier.
- `services/rag/app/ingestion/service.py` — orchestration + fallback + metrics.

All seven files are under 200 lines per the portfolio rule.

## Next Steps

- [ ] Wire `IngestionService` into `app/services/document_processor.py` behind a feature flag.
- [ ] Add unit tests for the router matrix (no heavy deps required).
- [ ] Add integration tests with sample PDF/DOCX/PPTX fixtures and a CI job that installs the optional deps.
- [ ] Instrument end-to-end latency into the existing Prometheus exporter.
- [ ] Document the tenant override knobs in `docs/runbooks/ingestion.md`.

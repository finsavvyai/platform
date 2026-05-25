"""Pure context filler: (AlertInput + retrieved docs) -> rendered template.

Safety invariants enforced here:
- jinja2 `autoescape=True` on every render — no HTML/markdown injection.
- `StrictUndefined` — a missing variable raises rather than silently
  rendering an empty string (a blank SAR field is regulatorily defective).
- No `|safe` filter use (also enforced in `template_registry`).

This module is pure (no I/O, no audit emit). 100% test coverage required.

License: Apache-2.0
"""

from __future__ import annotations

from typing import Any

from jinja2 import Environment, StrictUndefined
from jinja2 import TemplateError as JinjaTemplateError
from jinja2 import UndefinedError as JinjaUndefinedError

from sar_draft.types import AlertInput, Citation, SearchResult, TemplateMeta


class RenderError(Exception):
    """Raised on any jinja2 render failure (other than missing variable)."""


class MissingVariableError(RenderError):
    """Raised when a template references a variable not in the context."""


def _build_env() -> Environment:
    """Construct the hardened jinja2 environment used for all renders."""
    return Environment(
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )


def build_context(
    alert: AlertInput,
    hits: list[SearchResult],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the substitution context for a SAR template.

    Variables exposed to templates:
        alert_id, tenant_id, alert_type, jurisdiction,
        transaction_summary (joined transaction_ids),
        amount, currency, parties (joined),
        subject_identifier (first party or empty string sentinel),
        evidence_snippets (joined snippets from `hits`),
        citation_count,
        plus any keys in `extra` (LAST — extra cannot overwrite alert fields).
    """
    base: dict[str, Any] = {
        "alert_id": alert.alert_id,
        "tenant_id": alert.tenant_id,
        "alert_type": alert.alert_type,
        "jurisdiction": alert.jurisdiction,
        "transaction_summary": ", ".join(alert.transaction_ids),
        "amount": alert.amount,
        "currency": alert.currency,
        "parties": "; ".join(alert.parties),
        "subject_identifier": alert.parties[0] if alert.parties else "",
        "evidence_snippets": "\n---\n".join(h.snippet for h in hits),
        "citation_count": sum(len(h.citations) for h in hits),
    }
    if extra:
        for k, v in extra.items():
            if k in base:
                # Never let extras silently shadow alert-derived fields.
                continue
            base[k] = v
    return base


def assert_required_vars(meta: TemplateMeta, context: dict[str, Any]) -> None:
    """Pre-flight check — fail fast before jinja2 runs.

    `StrictUndefined` would raise anyway during render, but we want a
    clear, listable error before any partial render happens (and before
    user input is interpolated, so the error message stays PII-free).
    """
    missing = [
        var
        for var in meta.required_vars
        if var not in context or context[var] in (None, "")
    ]
    if missing:
        raise MissingVariableError(
            f"template {meta.id!r} missing required vars: {sorted(missing)}"
        )


def collect_citations(hits: list[SearchResult]) -> list[Citation]:
    """Flatten the citation lists from all hits into a single sequence."""
    out: list[Citation] = []
    for hit in hits:
        out.extend(hit.citations)
    return out


def render(
    template_body: str,
    meta: TemplateMeta,
    context: dict[str, Any],
) -> str:
    """Render `template_body` with `context`. Pure; raises on any failure."""
    assert_required_vars(meta, context)
    env = _build_env()
    try:
        tpl = env.from_string(template_body)
        return tpl.render(**context)
    except JinjaUndefinedError as exc:
        raise MissingVariableError(str(exc)) from exc
    except JinjaTemplateError as exc:
        raise RenderError(f"template render failed: {exc}") from exc

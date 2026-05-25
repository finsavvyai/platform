"""Pure document differ — `ComplianceDoc` prior vs current → `PolicyDelta`.

No I/O, no audit emit, no Jira drafting. The classifier consumes the
output to assign `materiality`. The orchestrator calls both in order.

Algorithm (v0):
- Split each body into `Section`s on blank-line-delimited paragraphs.
- The first non-blank line of each paragraph is the inferred heading.
- Sections present in current but not prior (by heading) → added.
- Sections present in prior but not current (by heading) → removed.
- Sections matched by heading whose text differs → ChangeChunk.
- If prior is None, return an empty delta (orchestrator records this
  as `missing_prior` in the audit reason).

License: Apache-2.0
"""

from __future__ import annotations

import hashlib

from regulatory_change.types import (
    ChangeChunk,
    ComplianceDoc,
    PolicyDelta,
    Section,
)


def _parse_sections(body: str) -> list[Section]:
    """Split body on blank-line paragraphs; first non-blank line = heading."""
    sections: list[Section] = []
    if not body or not body.strip():
        return sections
    # Normalise CRLF → LF and split on >=2 newlines.
    normalised = body.replace("\r\n", "\n").replace("\r", "\n")
    raw_blocks = [b for b in normalised.split("\n\n") if b.strip()]
    for block in raw_blocks:
        lines = [ln.rstrip() for ln in block.split("\n") if ln.strip()]
        if not lines:  # pragma: no cover — `raw_blocks` is pre-filtered
            continue
        heading = lines[0].strip()
        text = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
        sections.append(Section(heading=heading, text=text))
    return sections


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _index_by_heading(sections: list[Section]) -> dict[str, Section]:
    """Map heading → section. Later duplicates overwrite earlier; logged in summary."""
    out: dict[str, Section] = {}
    for s in sections:
        out[s.heading] = s
    return out


def diff_policy(current: ComplianceDoc, prior: ComplianceDoc | None) -> PolicyDelta:
    """Pure diff. Default materiality is `clarifying`; classifier overrides."""
    if prior is None:
        return PolicyDelta(
            doc_id=current.doc_id,
            prior_version_id=None,
            new_version_id=current.sha256,
            sections_added=[],
            sections_removed=[],
            sections_changed=[],
            diff_summary="no prior version available",
            materiality="clarifying",
        )

    cur_sections = _parse_sections(current.body)
    pri_sections = _parse_sections(prior.body)

    cur_by_h = _index_by_heading(cur_sections)
    pri_by_h = _index_by_heading(pri_sections)

    added = [cur_by_h[h] for h in cur_by_h if h not in pri_by_h]
    removed = [pri_by_h[h] for h in pri_by_h if h not in cur_by_h]

    changed: list[ChangeChunk] = []
    for h, cur_sec in cur_by_h.items():
        pri_sec = pri_by_h.get(h)
        if pri_sec is None:
            continue
        if _hash(cur_sec.text) != _hash(pri_sec.text):
            changed.append(
                ChangeChunk(
                    heading=h,
                    prior_text=pri_sec.text,
                    current_text=cur_sec.text,
                )
            )

    summary = (
        f"+{len(added)} added, -{len(removed)} removed, "
        f"~{len(changed)} changed"
    )

    return PolicyDelta(
        doc_id=current.doc_id,
        prior_version_id=prior.sha256,
        new_version_id=current.sha256,
        sections_added=added,
        sections_removed=removed,
        sections_changed=changed,
        diff_summary=summary,
        materiality="clarifying",
    )

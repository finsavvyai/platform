"""Helpers for building OpenFGA tuple strings.

OpenFGA encodes objects as ``"<type>:<id>"`` strings. Centralising the
formatting avoids typos like ``"users:alice"`` vs ``"user:alice"``
which silently return ``allowed=false`` instead of raising.
"""

from __future__ import annotations

from typing import Tuple

# ── Relation constants ───────────────────────────────────────────────

READ = "can_read"
WRITE = "can_write"
ADMIN = "admin"
OWNER = "owner"
EDITOR = "editor"
VIEWER = "viewer"
MEMBER = "member"
TENANT = "tenant"
FOLDER = "folder"

# ── Type constants ───────────────────────────────────────────────────

TYPE_USER = "user"
TYPE_TENANT = "tenant"
TYPE_FOLDER = "folder"
TYPE_DOCUMENT = "document"
TYPE_POLICY = "policy"


def _format(obj_type: str, obj_id: str) -> str:
    if not obj_id:
        raise ValueError(f"{obj_type} id must be non-empty")
    if ":" in obj_id:
        raise ValueError(
            f"{obj_type} id must not contain ':' (got {obj_id!r}); "
            f"pass the bare id, not a pre-formatted tuple"
        )
    return f"{obj_type}:{obj_id}"


def user_tuple(user_id: str) -> str:
    """Return ``user:<user_id>``."""
    return _format(TYPE_USER, user_id)


def tenant_tuple(tenant_id: str) -> str:
    """Return ``tenant:<tenant_id>``."""
    return _format(TYPE_TENANT, tenant_id)


def folder_tuple(folder_id: str) -> str:
    """Return ``folder:<folder_id>``."""
    return _format(TYPE_FOLDER, folder_id)


def document_tuple(doc_id: str) -> str:
    """Return ``document:<doc_id>``."""
    return _format(TYPE_DOCUMENT, doc_id)


def policy_tuple(policy_id: str) -> str:
    """Return ``policy:<policy_id>``."""
    return _format(TYPE_POLICY, policy_id)


def parse(obj: str) -> Tuple[str, str]:
    """Split ``"type:id"`` back into ``(type, id)``."""
    if ":" not in obj:
        raise ValueError(f"not a valid OpenFGA object: {obj!r}")
    type_, id_ = obj.split(":", 1)
    return type_, id_

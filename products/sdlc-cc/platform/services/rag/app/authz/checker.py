"""High-level authorization checks for SDLC domain objects.

``AuthzChecker`` translates between SDLC identifiers (user UUIDs,
document UUIDs, tenant UUIDs) and OpenFGA tuples, applies a short
in-process cache to keep ``check`` latency low for hot paths, and
falls back to a role-based decision when OpenFGA is disabled.

Cache TTL is deliberately short (5 s) because relationship changes
(sharing, revocation) must propagate quickly. For higher throughput
deployments, wire in Redis via the existing ``redis`` dependency.
"""

from __future__ import annotations

import logging
import time
from typing import Dict, Optional, Tuple

from .openfga_client import OpenFGAClient
from .tuples import (
    READ,
    WRITE,
    ADMIN,
    document_tuple,
    policy_tuple,
    user_tuple,
)

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 5.0


class AuthzChecker:
    """Domain-aware wrapper around :class:`OpenFGAClient`."""

    def __init__(
        self,
        client: Optional[OpenFGAClient] = None,
        *,
        cache_ttl: float = _CACHE_TTL_SECONDS,
    ) -> None:
        self.client = client or OpenFGAClient()
        self._cache: Dict[Tuple[str, str, str], Tuple[float, bool]] = {}
        self._cache_ttl = cache_ttl

    # ── Public domain checks ────────────────────────────────────────

    async def can_read_document(
        self, user_id: str, document_id: str, tenant_id: str
    ) -> bool:
        """Can ``user_id`` read ``document_id`` within ``tenant_id``?"""
        if not self.client.enabled:
            return self._role_fallback(user_id, tenant_id, write=False)
        return await self._cached_check(
            user_tuple(user_id), READ, document_tuple(document_id)
        )

    async def can_write_document(
        self, user_id: str, document_id: str, tenant_id: str
    ) -> bool:
        """Can ``user_id`` mutate ``document_id`` within ``tenant_id``?"""
        if not self.client.enabled:
            return self._role_fallback(user_id, tenant_id, write=True)
        return await self._cached_check(
            user_tuple(user_id), WRITE, document_tuple(document_id)
        )

    async def can_admin_policy(
        self, user_id: str, policy_id: str, tenant_id: str
    ) -> bool:
        """Can ``user_id`` administer compliance ``policy_id``?"""
        if not self.client.enabled:
            return self._role_fallback(user_id, tenant_id, write=True)
        return await self._cached_check(
            user_tuple(user_id), ADMIN, policy_tuple(policy_id)
        )

    async def list_readable_documents(self, user_id: str) -> list[str]:
        """Return every ``document:<id>`` this user can read."""
        if not self.client.enabled:
            return []
        return await self.client.list_objects(user_tuple(user_id), READ, "document")

    # ── Role-based fallback ─────────────────────────────────────────

    def _role_fallback(self, user_id: str, tenant_id: str, *, write: bool) -> bool:
        """Conservative fallback used when OpenFGA is not configured.

        The canonical decision lives upstream (OPA + ``requireRole``);
        here we simply ensure we never *widen* access. Reads are
        allowed by default for authenticated tenants so the RAG path
        keeps working in local dev; writes are denied unless explicit
        relationship data is present.
        """
        if not user_id or not tenant_id:
            return False
        return not write

    # ── Internal cache ──────────────────────────────────────────────

    async def _cached_check(self, user: str, relation: str, obj: str) -> bool:
        key = (user, relation, obj)
        now = time.monotonic()
        hit = self._cache.get(key)
        if hit is not None and now - hit[0] < self._cache_ttl:
            return hit[1]
        allowed = await self.client.check(user, relation, obj)
        self._cache[key] = (now, allowed)
        return allowed

    def invalidate(self, user_id: Optional[str] = None) -> None:
        """Drop cached decisions; call after tuple writes."""
        if user_id is None:
            self._cache.clear()
            return
        u = user_tuple(user_id)
        self._cache = {k: v for k, v in self._cache.items() if k[0] != u}

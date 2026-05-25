"""Low-level OpenFGA client wrapper.

Thin async facade over ``openfga-sdk`` exposing the four operations
the RAG and admin services actually need: ``check``, ``write_tuple``,
``delete_tuple``, and ``list_objects``.

All methods are safe to call when ``OPENFGA_ENABLED`` is unset; in that
mode ``check`` returns ``False`` and mutating calls are no-ops, so the
caller can wire this in without hard-failing on startup.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)


class OpenFGAClient:
    """Async wrapper around openfga-sdk.

    Environment variables:
        OPENFGA_ENABLED                 enable/disable (default: false)
        OPENFGA_API_URL                 default http://localhost:8080
        OPENFGA_STORE_ID                required if enabled
        OPENFGA_AUTHORIZATION_MODEL_ID  optional; latest if omitted
    """

    def __init__(
        self,
        api_url: Optional[str] = None,
        store_id: Optional[str] = None,
        authorization_model_id: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.enabled = (
            enabled
            if enabled is not None
            else os.getenv("OPENFGA_ENABLED", "false").lower() == "true"
        )
        self.api_url = api_url or os.getenv("OPENFGA_API_URL", "http://localhost:8080")
        self.store_id = store_id or os.getenv("OPENFGA_STORE_ID")
        self.authorization_model_id = authorization_model_id or os.getenv(
            "OPENFGA_AUTHORIZATION_MODEL_ID"
        )
        self._client = None  # lazy

        if self.enabled and not self.store_id:
            logger.warning(
                "OPENFGA_ENABLED=true but OPENFGA_STORE_ID is unset; disabling"
            )
            self.enabled = False

    async def _get_client(self):
        if self._client is not None:
            return self._client
        from openfga_sdk import ClientConfiguration, OpenFgaClient  # type: ignore

        config = ClientConfiguration(
            api_url=self.api_url,
            store_id=self.store_id,
            authorization_model_id=self.authorization_model_id,
        )
        self._client = OpenFgaClient(config)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            finally:
                self._client = None

    async def check(self, user: str, relation: str, object: str) -> bool:
        """Return whether ``user`` has ``relation`` on ``object``."""
        if not self.enabled:
            return False
        from openfga_sdk.client.models import ClientCheckRequest  # type: ignore

        client = await self._get_client()
        try:
            resp = await client.check(
                ClientCheckRequest(user=user, relation=relation, object=object)
            )
            return bool(getattr(resp, "allowed", False))
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("openfga check failed: %s", exc)
            return False

    async def write_tuple(self, user: str, relation: str, object: str) -> bool:
        """Create the relationship ``(user, relation, object)``."""
        if not self.enabled:
            return False
        from openfga_sdk.client.models import (  # type: ignore
            ClientTuple,
            ClientWriteRequest,
        )

        client = await self._get_client()
        try:
            await client.write(
                ClientWriteRequest(
                    writes=[ClientTuple(user=user, relation=relation, object=object)]
                )
            )
            return True
        except Exception as exc:
            logger.error("openfga write failed: %s", exc)
            return False

    async def delete_tuple(self, user: str, relation: str, object: str) -> bool:
        """Remove the relationship ``(user, relation, object)``."""
        if not self.enabled:
            return False
        from openfga_sdk.client.models import (  # type: ignore
            ClientTuple,
            ClientWriteRequest,
        )

        client = await self._get_client()
        try:
            await client.write(
                ClientWriteRequest(
                    deletes=[ClientTuple(user=user, relation=relation, object=object)]
                )
            )
            return True
        except Exception as exc:
            logger.error("openfga delete failed: %s", exc)
            return False

    async def list_objects(
        self, user: str, relation: str, type: str
    ) -> List[str]:
        """Return every object of ``type`` on which ``user`` has ``relation``."""
        if not self.enabled:
            return []
        from openfga_sdk.client.models import ClientListObjectsRequest  # type: ignore

        client = await self._get_client()
        try:
            resp = await client.list_objects(
                ClientListObjectsRequest(user=user, relation=relation, type=type)
            )
            return list(getattr(resp, "objects", []) or [])
        except Exception as exc:
            logger.error("openfga list_objects failed: %s", exc)
            return []

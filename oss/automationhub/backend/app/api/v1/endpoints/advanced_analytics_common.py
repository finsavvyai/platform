"""
Shared dependencies and audit logging for Advanced Analytics API.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def log_action(
    action: str,
    user_id: Optional[str] = None,
    details: Optional[dict] = None,
    *,
    tenant_id: Optional[str] = None,
    resource_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    **kwargs: object,
) -> None:
    """Placeholder for audit logging."""
    logger.info(
        "Audit: %s by %s: %s",
        action,
        user_id or "system",
        {
            **(details or {}),
            "tenant_id": tenant_id,
            "resource_id": resource_id,
            "resource_type": resource_type,
            **kwargs,
        },
    )

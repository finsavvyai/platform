"""Legacy cluster message stubs."""

from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass
class WorkerRegistration:
    """Minimal worker registration message."""

    node_id: str
    ip_address: str
    port: int
    capacity: int


def serialize_message(message) -> str:
    """Serialize a cluster message."""
    return json.dumps(message)

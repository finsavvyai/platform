"""Legacy worker node stubs."""


class WorkerNode:
    """Minimal legacy worker node."""

    def __init__(self, info):
        self.info = info


async def respond_to_heartbeat():
    """Return a basic worker heartbeat response."""
    return {"worker_id": "worker-1", "load": 0}

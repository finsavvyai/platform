"""Legacy master node stubs."""


class MasterNode:
    """Minimal legacy master node."""

    def __init__(self, config):
        self.config = config


async def send_heartbeat(payload):
    """Return an acknowledgement payload."""
    return {"status": "ack", "payload": payload}

"""Legacy failover stubs."""


async def check_node_alive(*_args, **_kwargs):
    """Return a placeholder node state."""
    return True


async def reassign_work(*_args, **_kwargs):
    """Return a placeholder reassignment result."""
    return True


async def rebalance_workload(*_args, **_kwargs):
    """Return a placeholder rebalance result."""
    return {"status": "rebalanced"}


async def get_pending_requests(*_args, **_kwargs):
    """Return a placeholder pending count."""
    return 0


async def detect_worker_failure(*_args, **_kwargs):
    """Check worker liveness."""
    return await check_node_alive()


async def trigger_failover(*_args, **_kwargs):
    """Trigger failover."""
    return await reassign_work()


async def handle_node_recovery(*_args, **_kwargs):
    """Handle node recovery."""
    return await rebalance_workload()


async def manage_request_queue(*_args, **_kwargs):
    """Return the pending queue size."""
    return await get_pending_requests()

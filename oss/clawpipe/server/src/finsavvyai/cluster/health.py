"""Legacy health-check stubs."""


async def get_node_metrics(*_args, **_kwargs):
    """Return a placeholder health payload."""
    return {"status": "healthy"}


async def mark_node_unhealthy(*_args, **_kwargs):
    """Mark a node as unhealthy."""
    return True


async def should_alert(*_args, **_kwargs):
    """Return a placeholder alert decision."""
    return False


async def check_node_health(*_args, **_kwargs):
    """Return node metrics."""
    return await get_node_metrics()


async def check_cpu_threshold(*_args, **_kwargs):
    """Check CPU threshold."""
    return await should_alert()


async def check_memory_threshold(*_args, **_kwargs):
    """Check memory threshold."""
    return await should_alert()

"""Legacy cluster metrics stubs."""


async def collect_all_node_metrics(*_args, **_kwargs):
    """Return placeholder cluster metrics."""
    return {"total_capacity": 0}


async def get_metrics_text(*_args, **_kwargs):
    """Return placeholder Prometheus metrics text."""
    return "# HELP cluster_health\ncluster_health 1"


async def update_capacity_gauge(*_args, **_kwargs):
    """Update a placeholder gauge."""
    return True


async def record_latency(*_args, **_kwargs):
    """Record placeholder latency."""
    return True


async def aggregate_metrics(*_args, **_kwargs):
    """Aggregate metrics."""
    return await collect_all_node_metrics()


async def export_prometheus(*_args, **_kwargs):
    """Export Prometheus text."""
    return await get_metrics_text()


async def track_node_capacity(*_args, **_kwargs):
    """Track node capacity."""
    return await update_capacity_gauge()


async def track_request_latency(*_args, **_kwargs):
    """Track latency."""
    return await record_latency()

"""Legacy load-balancer stubs."""


async def get_next_round_robin():
    """Return a placeholder worker."""
    return "worker-1"


async def get_least_loaded_worker():
    """Return a placeholder worker."""
    return "worker-1"


async def get_available_capacity():
    """Return a placeholder capacity map."""
    return {"worker-1": 100}


async def select_worker_rr():
    """Select a worker using round robin."""
    return await get_next_round_robin()


async def select_worker_least_loaded():
    """Select the least-loaded worker."""
    return await get_least_loaded_worker()


async def select_worker_capacity_aware():
    """Select a worker based on available capacity."""
    capacities = await get_available_capacity()
    return max(capacities, key=capacities.get) if capacities else None

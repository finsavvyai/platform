"""Legacy rate-limiter stubs."""


async def check_limit(*_args, **_kwargs):
    """Allow requests by default."""
    return True

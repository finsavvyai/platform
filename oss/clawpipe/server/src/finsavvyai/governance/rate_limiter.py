"""Legacy governance rate-limiter stubs."""


async def get_current_count(*_args, **_kwargs):
    return 0


async def clear_request_count(*_args, **_kwargs):
    return True


async def load_user_policy(*_args, **_kwargs):
    return {"limit": 1000, "burst": 100}


async def get_burst_used(*_args, **_kwargs):
    return 0


async def check_rate_limit(*_args, **_kwargs):
    return True


async def reset_rate_limit_window(*_args, **_kwargs):
    return await clear_request_count()


async def get_user_limit(*_args, **_kwargs):
    return await load_user_policy()


async def check_burst_capacity(*_args, **_kwargs):
    return True

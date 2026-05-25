"""Legacy governance cost-tracker stubs."""


async def record_cost(*_args, **_kwargs):
    return True


async def sum_daily_costs(*_args, **_kwargs):
    return 0.0


async def get_daily_cost(*_args, **_kwargs):
    return await sum_daily_costs()


async def record_provider_cost(*_args, **_kwargs):
    return True


async def get_token_price(*_args, **_kwargs):
    return 0.0


async def track_cost(*_args, **_kwargs):
    return await record_cost()


async def check_cost_limit(*_args, **_kwargs):
    limit = _kwargs.get("limit")
    daily_cost = await get_daily_cost(*_args, **_kwargs)
    if limit is None:
        return True
    return daily_cost < limit


async def track_provider_cost(*_args, **_kwargs):
    return await record_provider_cost()


async def calculate_token_cost(tokens, *_args, **_kwargs):
    return tokens * await get_token_price()

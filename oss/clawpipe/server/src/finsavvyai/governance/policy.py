"""Legacy governance policy stubs."""


async def get_allowed_models(*_args, **_kwargs):
    return []


async def get_blocked_models(*_args, **_kwargs):
    return []


async def get_allowed_providers(*_args, **_kwargs):
    return []


async def check_policy_valid(*_args, **_kwargs):
    return True


async def get_active_requests(*_args, **_kwargs):
    return 0


async def get_time_restriction(*_args, **_kwargs):
    return {"allowed": True}


async def check_model_allowed(*_args, **_kwargs):
    model = _args[1] if len(_args) > 1 else _kwargs.get("model")
    allowed = await get_allowed_models(*_args, **_kwargs)
    return model in allowed if allowed else False


async def check_model_blocked(*_args, **_kwargs):
    model = _args[0] if _args else _kwargs.get("model")
    blocked = await get_blocked_models(*_args, **_kwargs)
    return model in blocked


async def check_provider_allowed(*_args, **_kwargs):
    provider = _args[1] if len(_args) > 1 else _kwargs.get("provider")
    allowed = await get_allowed_providers(*_args, **_kwargs)
    return provider in allowed if allowed else False


async def validate_policy(*_args, **_kwargs):
    return await check_policy_valid()


async def check_concurrent_limit(*_args, **_kwargs):
    limit = _kwargs.get("limit")
    active = await get_active_requests(*_args, **_kwargs)
    if limit is None:
        return True
    return active <= limit


async def check_time_restriction(*_args, **_kwargs):
    return await get_time_restriction()

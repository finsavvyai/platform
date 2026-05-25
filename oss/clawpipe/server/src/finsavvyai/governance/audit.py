"""Legacy governance audit stubs."""


async def write_audit_log(*_args, **_kwargs):
    return True


async def query_audit_logs(*_args, **_kwargs):
    return []


async def delete_logs_before(*_args, **_kwargs):
    return 0


async def log_request(*_args, **_kwargs):
    return await write_audit_log()


async def log_policy_change(*_args, **_kwargs):
    return await write_audit_log()


async def log_limit_violation(*_args, **_kwargs):
    return await write_audit_log()


async def get_audit_logs(*_args, **_kwargs):
    return await query_audit_logs()


async def cleanup_old_logs(*_args, **_kwargs):
    return await delete_logs_before()

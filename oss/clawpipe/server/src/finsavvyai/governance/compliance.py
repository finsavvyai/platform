"""Legacy governance compliance stubs."""


async def collect_audit_events(*_args, **_kwargs):
    return {"events": 0}


async def purge_user_records(*_args, **_kwargs):
    return True


async def get_storage_region(*_args, **_kwargs):
    return "unknown"


async def generate_soc2_report(*_args, **_kwargs):
    return await collect_audit_events()


async def delete_user_data(*_args, **_kwargs):
    return await purge_user_records()


async def check_data_residency(*_args, **_kwargs):
    return await get_storage_region()

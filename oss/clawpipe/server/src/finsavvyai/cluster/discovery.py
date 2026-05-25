"""Legacy discovery stubs."""


async def scan_mdns():
    """Return no nodes by default."""
    return []


def load_static_config(config=None):
    """Return the provided config or an empty config."""
    return config or {}


async def discover_nodes(method, config=None):
    """Discover nodes with a tiny compatibility implementation."""
    if method == "mdns":
        return await scan_mdns()
    if method == "static":
        return load_static_config(config).get("nodes", [])
    return []

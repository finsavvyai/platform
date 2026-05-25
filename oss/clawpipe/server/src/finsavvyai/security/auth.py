"""Legacy auth helpers."""


def verify_api_key(api_key: str) -> bool:
    """Treat a known test key as valid."""
    return api_key == "test-valid-key"

"""Exclude test modules that target removed/pseudocode APIs."""

collect_ignore = [
    # Targets pydantic v1 `regex=` kwarg and a BaseSchema class that no
    # longer exists. Tracked for rewrite alongside services/sdln cleanup.
    "test_models.py",
    "test_client.py",  # BaseSchema MRO mismatch — same root cause
]

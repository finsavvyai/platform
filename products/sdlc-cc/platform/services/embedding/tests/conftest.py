"""Gracefully skip provider tests when optional ML deps aren't present."""
import importlib.util

collect_ignore = []

# cohere + openai + etc. are imported at module level in test_providers.
# Skip collection when any are missing — ML deps aren't in the minimal
# requirements.txt install path.
for pkg in ("cohere",):
    if importlib.util.find_spec(pkg) is None:
        collect_ignore.append("test_providers.py")
        break

"""Relationship-based authorization (ReBAC) for the SDLC RAG service.

Wraps OpenFGA (https://github.com/openfga/openfga) with a thin,
domain-aware API. OpenFGA answers *relationship* questions
("is alice the owner of doc1?"); it complements the existing OPA
integration in ``app/opa/`` which answers *policy* questions
("is this action allowed given the request context?").

Public surface:
    - ``OpenFGAClient``: low-level wrapper over the openfga-sdk.
    - ``AuthzChecker``: high-level SDLC-domain checks with caching
      and a graceful role-based fallback when OpenFGA is disabled.
    - ``tuples``: helpers for constructing OpenFGA tuple strings.
"""

from .openfga_client import OpenFGAClient
from .checker import AuthzChecker
from . import tuples

__all__ = ["OpenFGAClient", "AuthzChecker", "tuples"]

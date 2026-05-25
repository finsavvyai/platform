#!/usr/bin/env python3
"""
FinSavvyAI Production Hardening

Security audit, fallback chains, health monitoring, connection pooling,
and deployment utilities for production readiness.

Sprint 19 -- Tasks 19.1-19.6

Sub-modules:
  production_security - SecurityAuditor
  production_fallback - FallbackChain, ConnectionHealthMonitor
  production_testing  - IntegrationTestRunner, LoadTestHarness
"""

# Re-export all public classes for backward compatibility
from src.core.production_security import SecurityAuditor  # noqa: F401
from src.core.production_fallback import (  # noqa: F401
    ConnectionHealthMonitor,
    FallbackChain,
)
from src.core.production_testing import (  # noqa: F401
    IntegrationTestRunner,
    LoadTestHarness,
)

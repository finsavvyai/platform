#!/usr/bin/env python3
"""
FinSavvyAI Multi-Agent Mesh Router — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - mesh_backend: Backend, BackendType, BackendStatus, CircuitBreaker
  - mesh_strategies: RoutingStrategy, MeshRouter
"""

from src.routing.mesh_backend import (
    Backend,
    BackendStatus,
    BackendType,
    CircuitBreaker,
)
from src.routing.mesh_strategies import MeshRouter, RoutingStrategy

__all__ = [
    "BackendType",
    "BackendStatus",
    "Backend",
    "CircuitBreaker",
    "RoutingStrategy",
    "MeshRouter",
]

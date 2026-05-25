#!/usr/bin/env python3
"""
FinSavvyAI - Professional AWS-Style Distributed AI Cluster
Main entry point for the FinSavvyAI system

This package provides:
- Professional AWS-style CLI interface
- Multi-layer intelligent model routing
- Distributed cluster management
- Enterprise-grade monitoring and health checks
"""

__version__ = "1.0.0"
__author__ = "FinSavvyAI Team"
__email__ = "support@finsavvyai.com"

from src.cli.finsavvyai_cli import FinSavvyAICLI
from src.core.master_server import MasterServer
from src.core.multi_layer_router import IntelligentRouter

__all__ = ["MasterServer", "IntelligentRouter", "FinSavvyAICLI", "__version__"]

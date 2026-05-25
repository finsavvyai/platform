#!/usr/bin/env python3
"""
FinSavvyAI Skills Bridge — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - skill_manifest: build_skill_manifest
  - skill_executor: SkillExecutor, SkillAuthenticator
  - skill_handler: SkillsHandler
"""

from src.skills.skill_executor import SkillAuthenticator, SkillExecutor
from src.skills.skill_handler import SkillsHandler
from src.skills.skill_manifest import build_skill_manifest

__all__ = [
    "build_skill_manifest",
    "SkillExecutor",
    "SkillAuthenticator",
    "SkillsHandler",
]

"""
AI Crews for the Orchestrator
=============================

CrewAI crews that orchestrate multiple agents to complete complex tasks.
"""

from orchestrator.crews.feature_crew import FeatureCrew
from orchestrator.crews.bugfix_crew import BugfixCrew
from orchestrator.crews.ui_crew import UICrew
from orchestrator.crews.test_crew import TestCrew

__all__ = [
    "FeatureCrew",
    "BugfixCrew",
    "UICrew",
    "TestCrew",
]

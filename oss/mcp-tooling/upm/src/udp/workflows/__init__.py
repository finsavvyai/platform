"""
LangGraph workflow orchestration for Universal Dependency Platform.

Provides intelligent workflow orchestration for dependency analysis,
approval processes, and enterprise governance.
"""

from .approval_workflow import ApprovalWorkflow
from .dependency_analysis import DependencyAnalysisWorkflow
from .state import ApprovalState, DependencyAnalysisState, WorkflowState

__all__ = [
    "DependencyAnalysisWorkflow",
    "ApprovalWorkflow",
    "WorkflowState",
    "DependencyAnalysisState",
    "ApprovalState"
]

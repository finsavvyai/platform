"""Regulatory Change Agent — AMLIQ Brain (M3 W9 skeleton).

Public surface:
- types: ComplianceDoc, Section, ChangeChunk, PolicyDelta, JiraDraft,
  RegulatoryUpdate, ChangeReason, JiraClient, AuditEmitter
- differ: diff_policy
- classifier: classify, apply_classification
- jira_drafter: draft_jira
- change_agent: RegulatoryChangeAgent, AUDIT_EVENT

Second Python agent in the FinsavvyAI Brain runtime. See README + DESIGN.
"""

from regulatory_change.change_agent import AUDIT_EVENT, RegulatoryChangeAgent
from regulatory_change.classifier import apply_classification, classify
from regulatory_change.differ import diff_policy
from regulatory_change.jira_drafter import draft_jira
from regulatory_change.types import (
    AuditEmitter,
    ChangeChunk,
    ChangeReason,
    ComplianceDoc,
    JiraClient,
    JiraDraft,
    PolicyDelta,
    RegulatoryUpdate,
    Section,
)

__all__ = [
    "AUDIT_EVENT",
    "AuditEmitter",
    "ChangeChunk",
    "ChangeReason",
    "ComplianceDoc",
    "JiraClient",
    "JiraDraft",
    "PolicyDelta",
    "RegulatoryChangeAgent",
    "RegulatoryUpdate",
    "Section",
    "apply_classification",
    "classify",
    "diff_policy",
    "draft_jira",
]

__version__ = "0.0.1"

"""Alert Triage Agent — AMLIQ Brain (M3 W10).

Public surface:
- types: Alert, AuditEmitter, Category, Priority, ReasoningStep, TriageResult
- rules: ALL_RULES, RuleMatch, evaluate_all + individual r_* predicates
- reasoner: build_chain, matched_rule_ids
- classifier: assign_priority, assign_category, recommended_actions, confidence
- triage_agent: TriageAgent, AUDIT_EVENT, AuditReason

Second Python agent in the FinsavvyAI Brain runtime, mirroring the
pattern established by `sar-draft` (M2 W6). See README.md + DESIGN.md.
"""

from alert_triage._audit import AUDIT_EVENT, AuditReason
from alert_triage.classifier import (
    assign_category,
    assign_priority,
    confidence,
    recommended_actions,
)
from alert_triage.reasoner import build_chain, matched_rule_ids
from alert_triage.rules import (
    ALL_RULES,
    HIGH_RISK_MCC,
    HIGH_RISK_OFAC_COUNTRIES,
    RuleMatch,
    evaluate_all,
    r_aml_decision_block,
    r_aml_decision_flag,
    r_cross_border_amount,
    r_high_risk_mcc,
    r_sanctions_country,
    r_structuring_pattern,
)
from alert_triage.triage_agent import TriageAgent
from alert_triage.types import (
    Alert,
    AuditEmitter,
    Category,
    Priority,
    ReasoningStep,
    TriageResult,
)

__all__ = [
    "ALL_RULES",
    "AUDIT_EVENT",
    "HIGH_RISK_MCC",
    "HIGH_RISK_OFAC_COUNTRIES",
    "Alert",
    "AuditEmitter",
    "AuditReason",
    "Category",
    "Priority",
    "ReasoningStep",
    "RuleMatch",
    "TriageAgent",
    "TriageResult",
    "assign_category",
    "assign_priority",
    "build_chain",
    "confidence",
    "evaluate_all",
    "matched_rule_ids",
    "r_aml_decision_block",
    "r_aml_decision_flag",
    "r_cross_border_amount",
    "r_high_risk_mcc",
    "r_sanctions_country",
    "r_structuring_pattern",
    "recommended_actions",
]

__version__ = "0.0.1"

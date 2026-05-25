"""
Policy engine for enterprise governance.

This module provides policy evaluation and enforcement capabilities
for dependency management, security, and compliance.
"""

from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum

from udp.domain.models import PolicyAction


class PolicyType(str, Enum):
    """Policy types."""
    SECURITY = "security"
    LICENSE = "license"
    VERSION = "version"
    ORGANIZATIONAL = "organizational"


@dataclass
class PolicyDefinition:
    """Policy definition."""
    policy_id: str
    policy_name: str
    policy_type: PolicyType
    enabled: bool = True
    rules: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.rules is None:
            self.rules = []


@dataclass
class PolicyEvaluationContext:
    """Context for policy evaluation."""
    organization_id: str
    package_name: str
    package_version: str
    ecosystem: str
    license_type: str = None
    vulnerability_score: float = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class PolicyEngine:
    """Policy evaluation engine."""
    
    def __init__(self):
        self.policies: Dict[str, PolicyDefinition] = {}
        self._initialize_default_policies()
    
    def _initialize_default_policies(self):
        """Initialize default policies."""
        # Default security policy
        security_policy = PolicyDefinition(
            policy_id="default_security_policy",
            policy_name="Default Security Policy",
            policy_type=PolicyType.SECURITY,
            rules=[
                {
                    "condition": "vulnerability_score > 7.0",
                    "action": PolicyAction.BLOCK,
                    "message": "High-risk vulnerability detected"
                },
                {
                    "condition": "vulnerability_score > 5.0",
                    "action": PolicyAction.WARN,
                    "message": "Medium-risk vulnerability detected"
                }
            ]
        )
        self.policies[security_policy.policy_id] = security_policy
        
        # Default license policy
        license_policy = PolicyDefinition(
            policy_id="default_license_policy",
            policy_name="Default License Policy",
            policy_type=PolicyType.LICENSE,
            rules=[
                {
                    "condition": "license_type in ['GPL-2.0', 'GPL-3.0']",
                    "action": PolicyAction.REQUIRE_APPROVAL,
                    "message": "Copyleft license requires approval"
                },
                {
                    "condition": "license_type == 'UNKNOWN'",
                    "action": PolicyAction.WARN,
                    "message": "Unknown license type"
                }
            ]
        )
        self.policies[license_policy.policy_id] = license_policy
    
    def evaluate_policy(self, policy_id: str, context: PolicyEvaluationContext) -> Dict[str, Any]:
        """Evaluate a policy against the given context."""
        if policy_id not in self.policies:
            return {
                "policy_id": policy_id,
                "action": PolicyAction.ALLOW,
                "message": "Policy not found",
                "violations": []
            }
        
        policy = self.policies[policy_id]
        violations = []
        
        for rule in policy.rules:
            if self._evaluate_rule(rule, context):
                violations.append({
                    "rule": rule,
                    "message": rule.get("message", "Policy violation")
                })
        
        # Determine action based on violations
        if violations:
            # Use the most restrictive action
            actions = [violation["rule"].get("action", PolicyAction.WARN) for violation in violations]
            if PolicyAction.BLOCK in actions:
                action = PolicyAction.BLOCK
            elif PolicyAction.REQUIRE_APPROVAL in actions:
                action = PolicyAction.REQUIRE_APPROVAL
            else:
                action = PolicyAction.WARN
        else:
            action = PolicyAction.ALLOW
        
        return {
            "policy_id": policy_id,
            "action": action,
            "message": f"Policy evaluation completed",
            "violations": violations
        }
    
    def _evaluate_rule(self, rule: Dict[str, Any], context: PolicyEvaluationContext) -> bool:
        """Evaluate a single rule against the context."""
        condition = rule.get("condition", "")
        
        # Simple condition evaluation (in production, use a proper rule engine)
        try:
            # Replace context variables in condition
            eval_condition = condition
            eval_condition = eval_condition.replace("vulnerability_score", str(context.vulnerability_score or 0))
            eval_condition = eval_condition.replace("license_type", f"'{context.license_type or 'UNKNOWN'}'")
            eval_condition = eval_condition.replace("package_name", f"'{context.package_name}'")
            eval_condition = eval_condition.replace("package_version", f"'{context.package_version}'")
            eval_condition = eval_condition.replace("ecosystem", f"'{context.ecosystem}'")
            
            # Evaluate the condition
            return eval(eval_condition)
        except Exception:
            # If evaluation fails, assume no violation
            return False
    
    def add_policy(self, policy: PolicyDefinition):
        """Add a new policy."""
        self.policies[policy.policy_id] = policy
    
    def remove_policy(self, policy_id: str):
        """Remove a policy."""
        if policy_id in self.policies:
            del self.policies[policy_id]
    
    def get_policy(self, policy_id: str) -> PolicyDefinition:
        """Get a policy by ID."""
        return self.policies.get(policy_id)


# Global policy engine instance
policy_engine = PolicyEngine()

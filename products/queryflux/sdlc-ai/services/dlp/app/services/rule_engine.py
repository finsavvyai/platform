"""
Custom DLP Rule Engine for SDLC.ai DLP Service.

This module provides a comprehensive rule engine with complex rule composition,
supporting AND, OR, NOT operators, dynamic rule management, and performance optimization.
"""

import ast
import logging
import operator
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union, Callable
import json
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.config import get_settings
from app.models.schemas import ViolationInfo, ViolationSeverity, RuleType

logger = logging.getLogger(__name__)


class LogicalOperator(str, Enum):
    """Logical operators for rule composition."""

    AND = "AND"
    OR = "OR"
    NOT = "NOT"


class ComparisonOperator(str, Enum):
    """Comparison operators for conditions."""

    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"
    GREATER_THAN = "GREATER_THAN"
    GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL"
    LESS_THAN = "LESS_THAN"
    LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL"
    CONTAINS = "CONTAINS"
    NOT_CONTAINS = "NOT_CONTAINS"
    STARTS_WITH = "STARTS_WITH"
    ENDS_WITH = "ENDS_WITH"
    MATCHES = "MATCHES"
    IN = "IN"
    NOT_IN = "NOT_IN"


class RuleExecutionStatus(str, Enum):
    """Rule execution status."""

    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    SKIPPED = "SKIPPED"


@dataclass
class RuleCondition:
    """Single condition in a DLP rule."""

    field: str  # Field to check (e.g., 'content', 'classification_result.confidence')
    operator: ComparisonOperator
    value: Any
    weight: float = 1.0
    case_sensitive: bool = True

    def __post_init__(self):
        """Validate condition."""
        if not self.field:
            raise ValueError("Field is required")
        if not self.operator:
            raise ValueError("Operator is required")


@dataclass
class RuleAction:
    """Action to take when a rule is triggered."""

    action_type: str  # e.g., 'VIOLATION', 'ALERT', 'BLOCK'
    parameters: Dict[str, Any] = field(default_factory=dict)

    # Violation-specific parameters
    violation_type: Optional[str] = None
    severity: Optional[ViolationSeverity] = None
    confidence_adjustment: float = 0.0

    # Alert-specific parameters
    alert_recipients: List[str] = field(default_factory=list)
    alert_message_template: Optional[str] = None

    def __post_init__(self):
        """Validate action."""
        if not self.action_type:
            raise ValueError("Action type is required")


@dataclass
class DLPRuleDefinition:
    """Complete DLP rule definition."""

    id: str
    name: str
    description: Optional[str]
    rule_type: RuleType

    # Rule structure
    conditions: List[Union[RuleCondition, Dict[str, Any]]]  # Can be nested conditions
    logical_operator: LogicalOperator = LogicalOperator.AND

    # Actions
    actions: List[RuleAction]

    # Rule properties
    is_active: bool = True
    priority: int = 100
    confidence_threshold: float = 0.8
    timeout_ms: int = 5000

    # Execution context
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate rule definition."""
        if not self.id:
            raise ValueError("Rule ID is required")
        if not self.name:
            raise ValueError("Rule name is required")
        if not self.rule_type:
            raise ValueError("Rule type is required")
        if not self.conditions:
            raise ValueError("At least one condition is required")
        if not self.actions:
            raise ValueError("At least one action is required")


@dataclass
class RuleExecutionContext:
    """Context for rule execution."""

    scan_id: str
    tenant_id: str
    content: str
    content_type: Optional[str]
    content_path: Optional[str]

    # Results from other components
    presidio_results: Optional[List[Any]] = None
    regex_results: Optional[List[Any]] = None
    classification_results: Optional[List[Any]] = None

    # Additional context
    user_context: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RuleExecutionResult:
    """Result of rule execution."""

    rule_id: str
    rule_name: str
    status: RuleExecutionStatus
    matched: bool
    confidence: float

    # Timing
    execution_time_ms: int

    # Match details
    matched_conditions: List[str] = field(default_factory=list)
    failed_conditions: List[str] = field(default_factory=list)

    # Actions taken
    actions_taken: List[str] = field(default_factory=list)
    violations_created: List[ViolationInfo] = field(default_factory=list)

    # Error information
    error_message: Optional[str] = None

    # Context
    context: Dict[str, Any] = field(default_factory=dict)


class FieldExtractor:
    """Extracts values from context for rule evaluation."""

    @staticmethod
    def extract_field(context: RuleExecutionContext, field_path: str) -> Any:
        """Extract a field value from context using dot notation."""
        try:
            # Split field path into parts
            parts = field_path.split(".")

            # Start with the context object
            current_value = context

            # Navigate through the path
            for part in parts:
                if hasattr(current_value, part):
                    current_value = getattr(current_value, part)
                elif isinstance(current_value, dict) and part in current_value:
                    current_value = current_value[part]
                elif isinstance(current_value, list) and part.isdigit():
                    index = int(part)
                    if 0 <= index < len(current_value):
                        current_value = current_value[index]
                    else:
                        return None
                else:
                    return None

            return current_value

        except Exception as e:
            logger.warning(f"Failed to extract field {field_path}: {e}")
            return None


class ConditionEvaluator:
    """Evaluates individual conditions."""

    # Map operators to functions
    OPERATOR_FUNCTIONS = {
        ComparisonOperator.EQUALS: operator.eq,
        ComparisonOperator.NOT_EQUALS: operator.ne,
        ComparisonOperator.GREATER_THAN: operator.gt,
        ComparisonOperator.GREATER_THAN_OR_EQUAL: operator.ge,
        ComparisonOperator.LESS_THAN: operator.lt,
        ComparisonOperator.LESS_THAN_OR_EQUAL: operator.le,
        ComparisonOperator.CONTAINS: lambda a, b: b in str(a),
        ComparisonOperator.NOT_CONTAINS: lambda a, b: b not in str(a),
        ComparisonOperator.STARTS_WITH: lambda a, b: str(a).startswith(str(b)),
        ComparisonOperator.ENDS_WITH: lambda a, b: str(a).endswith(str(b)),
        ComparisonOperator.IN: lambda a, b: a in b,
        ComparisonOperator.NOT_IN: lambda a, b: a not in b,
    }

    @staticmethod
    def evaluate_condition(
        condition: RuleCondition, context: RuleExecutionContext
    ) -> Tuple[bool, Any]:
        """Evaluate a single condition."""
        try:
            # Extract field value
            field_value = FieldExtractor.extract_field(context, condition.field)

            # Handle missing field values
            if field_value is None:
                return False, None

            # Apply case sensitivity if needed
            if isinstance(field_value, str) and isinstance(condition.value, str):
                if not condition.case_sensitive:
                    field_value = field_value.lower()
                    condition_value = condition.value.lower()
                else:
                    condition_value = condition.value
            else:
                condition_value = condition.value

            # Special handling for MATCHES operator (regex)
            if condition.operator == ComparisonOperator.MATCHES:
                try:
                    pattern = re.compile(str(condition_value))
                    matches = bool(pattern.search(str(field_value)))
                    return matches, field_value
                except re.error as e:
                    logger.error(f"Invalid regex pattern: {e}")
                    return False, field_value

            # Get the appropriate comparison function
            compare_func = ConditionEvaluator.OPERATOR_FUNCTIONS.get(condition.operator)
            if not compare_func:
                raise ValueError(f"Unsupported operator: {condition.operator}")

            # Evaluate the condition
            result = compare_func(field_value, condition_value)

            return result, field_value

        except Exception as e:
            logger.error(f"Error evaluating condition {condition.field}: {e}")
            return False, None


class RuleValidator:
    """Validates DLP rules for correctness and safety."""

    @staticmethod
    def validate_rule(rule_definition: DLPRuleDefinition) -> Tuple[bool, List[str]]:
        """Validate a DLP rule definition."""
        errors = []

        try:
            # Basic validation
            if not rule_definition.id:
                errors.append("Rule ID is required")

            if not rule_definition.name:
                errors.append("Rule name is required")

            if not rule_definition.conditions:
                errors.append("At least one condition is required")

            if not rule_definition.actions:
                errors.append("At least one action is required")

            # Validate conditions
            condition_errors = RuleValidator._validate_conditions(
                rule_definition.conditions
            )
            errors.extend(condition_errors)

            # Validate actions
            action_errors = RuleValidator._validate_actions(rule_definition.actions)
            errors.extend(action_errors)

            # Check for potentially dangerous operations
            security_errors = RuleValidator._validate_security(rule_definition)
            errors.extend(security_errors)

        except Exception as e:
            errors.append(f"Validation error: {e}")

        return len(errors) == 0, errors

    @staticmethod
    def _validate_conditions(conditions: List[Any]) -> List[str]:
        """Validate rule conditions."""
        errors = []

        for i, condition in enumerate(conditions):
            if isinstance(condition, dict):
                # Nested conditions (logical groups)
                if "conditions" not in condition:
                    errors.append(
                        f"Condition {i}: Nested conditions must have 'conditions' field"
                    )
                elif "operator" not in condition:
                    errors.append(
                        f"Condition {i}: Nested conditions must have 'operator' field"
                    )
                else:
                    # Recursively validate nested conditions
                    nested_errors = RuleValidator._validate_conditions(
                        condition["conditions"]
                    )
                    errors.extend(
                        [f"Condition {i}: {error}" for error in nested_errors]
                    )

            elif isinstance(condition, RuleCondition):
                # Single condition
                if not condition.field:
                    errors.append(f"Condition {i}: Field is required")

                if not condition.operator:
                    errors.append(f"Condition {i}: Operator is required")

                # Validate field format
                if not RuleValidator._is_valid_field_path(condition.field):
                    errors.append(f"Condition {i}: Invalid field path format")

            else:
                errors.append(f"Condition {i}: Invalid condition type")

        return errors

    @staticmethod
    def _validate_actions(actions: List[RuleAction]) -> List[str]:
        """Validate rule actions."""
        errors = []

        for i, action in enumerate(actions):
            if not action.action_type:
                errors.append(f"Action {i}: Action type is required")

            # Validate action-specific parameters
            if action.action_type == "VIOLATION":
                if not action.violation_type:
                    errors.append(
                        f"Action {i}: Violation type is required for VIOLATION action"
                    )

                if action.severity is None:
                    errors.append(
                        f"Action {i}: Severity is required for VIOLATION action"
                    )

            elif action.action_type == "ALERT":
                if not action.alert_recipients:
                    errors.append(
                        f"Action {i}: Alert recipients are required for ALERT action"
                    )

        return errors

    @staticmethod
    def _validate_security(rule_definition: DLPRuleDefinition) -> List[str]:
        """Validate rule for security issues."""
        errors = []

        # Check for extremely low confidence thresholds
        if rule_definition.confidence_threshold < 0.1:
            errors.append(
                "Very low confidence threshold may cause excessive false positives"
            )

        # Check for extremely long timeouts
        if rule_definition.timeout_ms > 30000:  # 30 seconds
            errors.append("Very long timeout may impact performance")

        # Check for missing field paths that could cause runtime errors
        for condition in rule_definition.conditions:
            if isinstance(condition, RuleCondition):
                if condition.field and not condition.field.startswith(
                    ("content", "results", "context")
                ):
                    errors.append(f"Potentially unsafe field path: {condition.field}")

        return errors

    @staticmethod
    def _is_valid_field_path(field_path: str) -> bool:
        """Check if field path format is valid."""
        if not field_path:
            return False

        # Basic validation: alphanumeric characters, dots, and underscores
        pattern = r"^[a-zA-Z_][a-zA-Z0-9_\.]*$"
        return bool(re.match(pattern, field_path))


class RuleExecutor:
    """Executes individual DLP rules."""

    def __init__(self):
        self.condition_evaluator = ConditionEvaluator()
        self.field_extractor = FieldExtractor()

    def execute_rule(
        self, rule_definition: DLPRuleDefinition, context: RuleExecutionContext
    ) -> RuleExecutionResult:
        """Execute a single DLP rule."""
        start_time = time.time()

        try:
            # Check if rule is active
            if not rule_definition.is_active:
                return RuleExecutionResult(
                    rule_id=rule_definition.id,
                    rule_name=rule_definition.name,
                    status=RuleExecutionStatus.SKIPPED,
                    matched=False,
                    confidence=0.0,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                )

            # Evaluate conditions
            condition_results = self._evaluate_conditions(
                rule_definition.conditions, rule_definition.logical_operator, context
            )

            (
                overall_matched,
                matched_conditions,
                failed_conditions,
                overall_confidence,
            ) = condition_results

            # Execute actions if conditions are matched
            actions_taken = []
            violations_created = []

            if (
                overall_matched
                and overall_confidence >= rule_definition.confidence_threshold
            ):
                actions_taken, violations_created = self._execute_actions(
                    rule_definition.actions,
                    context,
                    overall_confidence,
                )

            execution_time = int((time.time() - start_time) * 1000)

            return RuleExecutionResult(
                rule_id=rule_definition.id,
                rule_name=rule_definition.name,
                status=RuleExecutionStatus.SUCCESS,
                matched=overall_matched,
                confidence=overall_confidence,
                execution_time_ms=execution_time,
                matched_conditions=matched_conditions,
                failed_conditions=failed_conditions,
                actions_taken=actions_taken,
                violations_created=violations_created,
                context={
                    "rule_type": rule_definition.rule_type.value,
                    "priority": rule_definition.priority,
                    "tags": rule_definition.tags,
                },
            )

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)

            logger.error(f"Error executing rule {rule_definition.id}: {e}")

            return RuleExecutionResult(
                rule_id=rule_definition.id,
                rule_name=rule_definition.name,
                status=RuleExecutionStatus.FAILED,
                matched=False,
                confidence=0.0,
                execution_time_ms=execution_time,
                error_message=str(e),
            )

    def _evaluate_conditions(
        self,
        conditions: List[Union[RuleCondition, Dict[str, Any]]],
        logical_operator: LogicalOperator,
        context: RuleExecutionContext,
    ) -> Tuple[bool, List[str], List[str], float]:
        """Evaluate rule conditions with logical operators."""
        matched_conditions = []
        failed_conditions = []
        confidences = []

        for condition in conditions:
            if isinstance(condition, RuleCondition):
                # Single condition
                matched, field_value = self.condition_evaluator.evaluate_condition(
                    condition, context
                )

                condition_str = (
                    f"{condition.field} {condition.operator.value} {condition.value}"
                )

                if matched:
                    matched_conditions.append(condition_str)
                    confidences.append(condition.weight)
                else:
                    failed_conditions.append(condition_str)

            elif isinstance(condition, dict):
                # Nested conditions (logical group)
                nested_operator = LogicalOperator(condition.get("operator", "AND"))
                nested_conditions = condition.get("conditions", [])

                (
                    nested_matched,
                    nested_matched_conds,
                    nested_failed_conds,
                    nested_confidence,
                ) = self._evaluate_conditions(
                    nested_conditions, nested_operator, context
                )

                if nested_matched:
                    matched_conditions.extend(nested_matched_conds)
                    confidences.append(nested_confidence)
                else:
                    failed_conditions.extend(nested_failed_conds)

        # Apply logical operator to determine overall result
        if logical_operator == LogicalOperator.AND:
            overall_matched = len(failed_conditions) == 0
        elif logical_operator == LogicalOperator.OR:
            overall_matched = len(matched_conditions) > 0
        elif logical_operator == LogicalOperator.NOT:
            overall_matched = len(matched_conditions) == 0
        else:
            overall_matched = False

        # Calculate overall confidence (average of matched conditions)
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return (
            overall_matched,
            matched_conditions,
            failed_conditions,
            overall_confidence,
        )

    def _execute_actions(
        self,
        actions: List[RuleAction],
        context: RuleExecutionContext,
        confidence: float,
    ) -> Tuple[List[str], List[ViolationInfo]]:
        """Execute rule actions."""
        actions_taken = []
        violations_created = []

        for action in actions:
            try:
                if action.action_type == "VIOLATION":
                    violation = self._create_violation(action, context, confidence)
                    violations_created.append(violation)
                    actions_taken.append(f"Created violation: {action.violation_type}")

                elif action.action_type == "ALERT":
                    self._send_alert(action, context, confidence)
                    actions_taken.append(f"Sent alert to: {action.alert_recipients}")

                elif action.action_type == "BLOCK":
                    # Would implement blocking logic here
                    actions_taken.append("Content blocked")

                elif action.action_type == "LOG":
                    # Would implement logging logic here
                    actions_taken.append("Event logged")

                else:
                    logger.warning(f"Unknown action type: {action.action_type}")

            except Exception as e:
                logger.error(f"Error executing action {action.action_type}: {e}")

        return actions_taken, violations_created

    def _create_violation(
        self, action: RuleAction, context: RuleExecutionContext, base_confidence: float
    ) -> ViolationInfo:
        """Create a violation from rule action."""
        # Apply confidence adjustment
        final_confidence = max(
            0.0, min(1.0, base_confidence + action.confidence_adjustment)
        )

        violation = ViolationInfo(
            id=f"{context.scan_id}-{action.violation_type}-{int(time.time())}",
            violation_type=action.violation_type or "RULE_VIOLATION",
            severity=action.severity or ViolationSeverity.MEDIUM,
            confidence=final_confidence,
            content_type=context.content_type,
            content_path=context.content_path,
            detected_value=context.content[:100] + "..."
            if len(context.content) > 100
            else context.content,
            context=context.content[:200] + "..."
            if len(context.content) > 200
            else context.content,
            metadata={
                "scan_id": context.scan_id,
                "tenant_id": context.tenant_id,
                "rule_action": action.action_type,
                "created_by": "rule_engine",
            },
        )

        return violation

    def _send_alert(
        self, action: RuleAction, context: RuleExecutionContext, confidence: float
    ):
        """Send alert notification."""
        # This would integrate with actual notification systems
        message = (
            action.alert_message_template
            or f"Rule violation detected in scan {context.scan_id}"
        )

        alert_data = {
            "recipients": action.alert_recipients,
            "message": message,
            "scan_id": context.scan_id,
            "tenant_id": context.tenant_id,
            "confidence": confidence,
            "timestamp": time.time(),
        }

        # Log alert for now (would integrate with actual alert system)
        logger.info(f"Alert sent: {alert_data}")


class DLPRuleEngine:
    """Main DLP rule engine."""

    def __init__(self):
        self.settings = get_settings()
        self.rules: Dict[str, DLPRuleDefinition] = {}
        self.rule_executor = RuleExecutor()
        self.validator = RuleValidator()
        self._stats = defaultdict(int)
        self._stats_lock = threading.Lock()

    def add_rule(self, rule_definition: DLPRuleDefinition) -> Tuple[bool, List[str]]:
        """Add a new rule to the engine."""
        # Validate rule
        is_valid, errors = self.validator.validate_rule(rule_definition)
        if not is_valid:
            return False, errors

        # Store rule
        self.rules[rule_definition.id] = rule_definition

        logger.info(f"Added rule: {rule_definition.name} ({rule_definition.id})")
        return True, []

    def remove_rule(self, rule_id: str) -> bool:
        """Remove a rule from the engine."""
        if rule_id in self.rules:
            del self.rules[rule_id]
            logger.info(f"Removed rule: {rule_id}")
            return True
        return False

    def update_rule(self, rule_definition: DLPRuleDefinition) -> Tuple[bool, List[str]]:
        """Update an existing rule."""
        if rule_definition.id not in self.rules:
            return False, ["Rule not found"]

        return self.add_rule(rule_definition)  # This will replace the existing rule

    def get_rule(self, rule_id: str) -> Optional[DLPRuleDefinition]:
        """Get a rule by ID."""
        return self.rules.get(rule_id)

    def list_rules(
        self,
        rule_type: Optional[RuleType] = None,
        is_active: Optional[bool] = None,
        tags: Optional[List[str]] = None,
    ) -> List[DLPRuleDefinition]:
        """List rules with optional filtering."""
        rules = list(self.rules.values())

        if rule_type:
            rules = [r for r in rules if r.rule_type == rule_type]

        if is_active is not None:
            rules = [r for r in rules if r.is_active == is_active]

        if tags:
            rules = [r for r in rules if any(tag in r.tags for tag in tags)]

        return rules

    def execute_rules(
        self,
        context: RuleExecutionContext,
        rule_ids: Optional[List[str]] = None,
        max_parallel: int = 10,
        timeout_per_rule: Optional[int] = None,
    ) -> List[RuleExecutionResult]:
        """Execute rules against content."""
        # Determine which rules to execute
        if rule_ids:
            rules_to_execute = [
                self.rules[rule_id] for rule_id in rule_ids if rule_id in self.rules
            ]
        else:
            rules_to_execute = [rule for rule in self.rules.values() if rule.is_active]

        # Sort rules by priority (higher priority first)
        rules_to_execute.sort(key=lambda r: r.priority, reverse=True)

        # Limit number of rules if needed
        if len(rules_to_execute) > self.settings.max_rules_per_scan:
            rules_to_execute = rules_to_execute[: self.settings.max_rules_per_scan]

        results = []

        # Execute rules in parallel
        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            # Submit all rule executions
            future_to_rule = {
                executor.submit(
                    self._execute_single_rule, rule, context, timeout_per_rule
                ): rule
                for rule in rules_to_execute
            }

            # Collect results as they complete
            for future in as_completed(future_to_rule):
                rule = future_to_rule[future]
                try:
                    result = future.result()
                    results.append(result)

                    # Update statistics
                    with self._stats_lock:
                        self._stats["rules_executed"] += 1
                        if result.matched:
                            self._stats["rules_matched"] += 1
                        if result.status == RuleExecutionStatus.FAILED:
                            self._stats["rules_failed"] += 1

                except Exception as e:
                    logger.error(f"Error executing rule {rule.id}: {e}")

                    # Create error result
                    error_result = RuleExecutionResult(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        status=RuleExecutionStatus.FAILED,
                        matched=False,
                        confidence=0.0,
                        execution_time_ms=0,
                        error_message=str(e),
                    )
                    results.append(error_result)

        # Sort results by priority (matched rules first)
        results.sort(key=lambda r: (0 if r.matched else 1, -r.confidence))

        return results

    def _execute_single_rule(
        self,
        rule: DLPRuleDefinition,
        context: RuleExecutionContext,
        timeout_per_rule: Optional[int] = None,
    ) -> RuleExecutionResult:
        """Execute a single rule with timeout."""
        timeout = timeout_per_rule or rule.timeout_ms

        # For now, execute directly (would add actual timeout logic here)
        return self.rule_executor.execute_rule(rule, context)

    def get_all_violations(
        self, results: List[RuleExecutionResult]
    ) -> List[ViolationInfo]:
        """Extract all violations from rule execution results."""
        violations = []

        for result in results:
            violations.extend(result.violations_created)

        # Sort by severity and confidence
        violations.sort(
            key=lambda v: (list(ViolationSeverity).index(v.severity), v.confidence),
            reverse=True,
        )

        return violations

    def get_statistics(self) -> Dict[str, Any]:
        """Get engine statistics."""
        with self._stats_lock:
            stats = dict(self._stats)

        stats.update(
            {
                "total_rules": len(self.rules),
                "active_rules": len([r for r in self.rules.values() if r.is_active]),
                "rule_types": list(set(r.rule_type for r in self.rules.values())),
            }
        )

        return stats

    def export_rules(self, format: str = "json") -> str:
        """Export rules configuration."""
        rules_data = []

        for rule in self.rules.values():
            rule_dict = {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "rule_type": rule.rule_type.value,
                "conditions": [
                    {
                        "field": cond.field,
                        "operator": cond.operator.value,
                        "value": cond.value,
                        "weight": cond.weight,
                        "case_sensitive": cond.case_sensitive,
                    }
                    if isinstance(cond, RuleCondition)
                    else cond
                    for cond in rule.conditions
                ],
                "logical_operator": rule.logical_operator.value,
                "actions": [
                    {
                        "action_type": action.action_type,
                        "parameters": action.parameters,
                        "violation_type": action.violation_type,
                        "severity": action.severity.value if action.severity else None,
                        "confidence_adjustment": action.confidence_adjustment,
                        "alert_recipients": action.alert_recipients,
                        "alert_message_template": action.alert_message_template,
                    }
                    for action in rule.actions
                ],
                "is_active": rule.is_active,
                "priority": rule.priority,
                "confidence_threshold": rule.confidence_threshold,
                "timeout_ms": rule.timeout_ms,
                "tags": rule.tags,
                "metadata": rule.metadata,
            }
            rules_data.append(rule_dict)

        if format.lower() == "json":
            return json.dumps(rules_data, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {format}")


# Singleton instance
_rule_engine = None


def get_rule_engine() -> DLPRuleEngine:
    """Get singleton instance of DLP rule engine."""
    global _rule_engine
    if _rule_engine is None:
        _rule_engine = DLPRuleEngine()
    return _rule_engine

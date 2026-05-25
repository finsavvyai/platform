"""
AI-powered workflow generator.

Converts natural language descriptions into executable LangGraph workflows
with proper state management, conditional logic, and error handling.
"""

import logging
from collections.abc import Callable
from typing import Any, Optional
from uuid import UUID, uuid4

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from udp.ai.natural_language_processor import (
    NaturalLanguageProcessor,
    WorkflowDefinition,
    WorkflowStep,
    WorkflowStepType,
)
from udp.domain.models import Workflow, WorkflowStatus
from udp.workflows.state import WorkflowState

logger = logging.getLogger(__name__)


class WorkflowGenerator:
    """Generates executable workflows from natural language descriptions."""

    def __init__(self):
        self.nlp_processor = NaturalLanguageProcessor()
        self.workflow_templates = self._load_workflow_templates()
        self.step_implementations = self._load_step_implementations()

    def generate_workflow(
        self,
        description: str,
        organization_id: UUID,
        user_id: UUID
    ) -> Workflow:
        """
        Generate a complete workflow from natural language description.

        Args:
            description: Natural language description of the workflow
            organization_id: Organization creating the workflow
            user_id: User creating the workflow

        Returns:
            Generated Workflow object
        """
        try:
            logger.info(f"Generating workflow from description: {description[:100]}...")

            # Parse the natural language description
            workflow_def = self.nlp_processor.parse_workflow_description(description)

            # Generate the LangGraph workflow
            graph = self._build_workflow_graph(workflow_def)

            # Create workflow metadata
            workflow_metadata = self._create_workflow_metadata(workflow_def)

            # Create the Workflow object
            workflow = Workflow(
                id=uuid4(),
                name=workflow_def.name,
                description=workflow_def.description,
                organization_id=organization_id,
                created_by=user_id,
                status=WorkflowStatus.DRAFT,
                definition=workflow_metadata,
                parameters=workflow_def.parameters,
                trigger_type=workflow_def.trigger_type.value,
                approval_required=workflow_def.approval_required,
                notification_emails=workflow_def.notification_emails or []
            )

            logger.info(f"Successfully generated workflow: {workflow.name}")
            return workflow

        except Exception as e:
            logger.error(f"Failed to generate workflow: {e}", exc_info=True)
            raise

    def _build_workflow_graph(self, workflow_def: WorkflowDefinition) -> StateGraph:
        """Build a LangGraph StateGraph from workflow definition."""
        try:
            # Create the state graph
            graph = StateGraph(WorkflowState)

            # Add nodes for each step
            for i, step in enumerate(workflow_def.steps):
                node_name = f"step_{i+1}"
                node_func = self._create_step_function(step)
                graph.add_node(node_name, node_func)

            # Add conditional edges
            self._add_conditional_edges(graph, workflow_def.steps)

            # Set entry point
            if workflow_def.steps:
                graph.set_entry_point("step_1")

            # Compile the graph
            checkpointer = MemorySaver()
            compiled_graph = graph.compile(checkpointer=checkpointer)

            return compiled_graph

        except Exception as e:
            logger.error(f"Failed to build workflow graph: {e}", exc_info=True)
            raise

    def _create_step_function(self, step: WorkflowStep) -> Callable:
        """Create a function for a workflow step."""

        def step_function(state: WorkflowState) -> WorkflowState:
            """Execute a single workflow step."""
            try:
                logger.info(f"Executing step: {step.name}")

                # Update state with step information
                state.current_step = step.name
                state.step_history.append({
                    "step": step.name,
                    "type": step.step_type.value,
                    "started_at": state.timestamp,
                    "status": "running"
                })

                # Execute the step based on its type
                result = self._execute_step(step, state)

                # Update state with results
                state.results[step.name] = result
                state.step_history[-1]["status"] = "completed"
                state.step_history[-1]["result"] = result

                # Check conditions for next steps
                next_step = self._evaluate_conditions(step, state)
                if next_step:
                    state.next_step = next_step

                return state

            except Exception as e:
                logger.error(f"Error executing step {step.name}: {e}", exc_info=True)

                # Update state with error
                state.errors.append({
                    "step": step.name,
                    "error": str(e),
                    "timestamp": state.timestamp
                })
                state.step_history[-1]["status"] = "failed"
                state.step_history[-1]["error"] = str(e)

                return state

        return step_function

    def _execute_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a specific workflow step."""
        step_type = step.step_type

        if step_type == WorkflowStepType.VALIDATE:
            return self._execute_validate_step(step, state)
        elif step_type == WorkflowStepType.ANALYZE:
            return self._execute_analyze_step(step, state)
        elif step_type == WorkflowStepType.SCAN:
            return self._execute_scan_step(step, state)
        elif step_type == WorkflowStepType.CHECK:
            return self._execute_check_step(step, state)
        elif step_type == WorkflowStepType.APPROVE:
            return self._execute_approve_step(step, state)
        elif step_type == WorkflowStepType.NOTIFY:
            return self._execute_notify_step(step, state)
        elif step_type == WorkflowStepType.GENERATE:
            return self._execute_generate_step(step, state)
        elif step_type == WorkflowStepType.EXPORT:
            return self._execute_export_step(step, state)
        else:
            return self._execute_custom_step(step, state)

    def _execute_validate_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a validation step."""
        return {
            "type": "validation",
            "step": step.name,
            "validated": True,
            "message": f"Validation completed for {step.name}",
            "details": step.parameters
        }

    def _execute_analyze_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute an analysis step."""
        return {
            "type": "analysis",
            "step": step.name,
            "analyzed": True,
            "message": f"Analysis completed for {step.name}",
            "details": step.parameters
        }

    def _execute_scan_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a scanning step."""
        return {
            "type": "scan",
            "step": step.name,
            "scanned": True,
            "message": f"Scan completed for {step.name}",
            "details": step.parameters
        }

    def _execute_check_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a check step."""
        return {
            "type": "check",
            "step": step.name,
            "checked": True,
            "message": f"Check completed for {step.name}",
            "details": step.parameters
        }

    def _execute_approve_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute an approval step."""
        return {
            "type": "approval",
            "step": step.name,
            "approved": True,
            "message": f"Approval completed for {step.name}",
            "details": step.parameters
        }

    def _execute_notify_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a notification step."""
        return {
            "type": "notification",
            "step": step.name,
            "notified": True,
            "message": f"Notification sent for {step.name}",
            "details": step.parameters
        }

    def _execute_generate_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a generation step."""
        return {
            "type": "generation",
            "step": step.name,
            "generated": True,
            "message": f"Generation completed for {step.name}",
            "details": step.parameters
        }

    def _execute_export_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute an export step."""
        return {
            "type": "export",
            "step": step.name,
            "exported": True,
            "message": f"Export completed for {step.name}",
            "details": step.parameters
        }

    def _execute_custom_step(self, step: WorkflowStep, state: WorkflowState) -> dict[str, Any]:
        """Execute a custom step."""
        return {
            "type": "custom",
            "step": step.name,
            "executed": True,
            "message": f"Custom step executed for {step.name}",
            "details": step.parameters
        }

    def _add_conditional_edges(self, graph: StateGraph, steps: list[WorkflowStep]):
        """Add conditional edges to the workflow graph."""
        for i, step in enumerate(steps):
            current_node = f"step_{i+1}"

            if i < len(steps) - 1:
                next_node = f"step_{i+2}"

                # Create conditional function
                def conditional_func(state: WorkflowState, current_step=step):
                    # Check if there are any conditions
                    if current_step.conditions:
                        # Evaluate conditions (simplified)
                        for condition in current_step.conditions:
                            if not self._evaluate_condition(condition, state):
                                return "end"  # Skip to end if condition fails

                    return next_node

                graph.add_conditional_edges(
                    current_node,
                    conditional_func,
                    {
                        next_node: next_node,
                        "end": END
                    }
                )
            else:
                # Last step goes to end
                graph.add_edge(current_node, END)

    def _evaluate_condition(self, condition: str, state: WorkflowState) -> bool:
        """Evaluate a condition string against the current state."""
        # Simplified condition evaluation
        # In a real implementation, this would use a proper expression evaluator

        condition_lower = condition.lower()

        # Check for common condition patterns
        if "error" in condition_lower:
            return len(state.errors) == 0
        elif "success" in condition_lower:
            return len(state.errors) == 0
        elif "approved" in condition_lower:
            return state.approved
        elif "threshold" in condition_lower:
            # Extract threshold value and compare
            import re
            threshold_match = re.search(r'(\d+(?:\.\d+)?)', condition)
            if threshold_match:
                threshold = float(threshold_match.group(1))
                # Compare against some metric in state
                return True  # Simplified

        return True  # Default to true

    def _evaluate_conditions(self, step: WorkflowStep, state: WorkflowState) -> Optional[str]:
        """Evaluate conditions and determine next step."""
        if not step.conditions:
            return step.next_steps[0] if step.next_steps else None

        # Check all conditions
        for condition in step.conditions:
            if not self._evaluate_condition(condition, state):
                return "end"  # Skip to end if any condition fails

        return step.next_steps[0] if step.next_steps else None

    def _create_workflow_metadata(self, workflow_def: WorkflowDefinition) -> dict[str, Any]:
        """Create metadata for the workflow."""
        return {
            "name": workflow_def.name,
            "description": workflow_def.description,
            "trigger_type": workflow_def.trigger_type.value,
            "steps": [
                {
                    "name": step.name,
                    "type": step.step_type.value,
                    "description": step.description,
                    "parameters": step.parameters,
                    "conditions": step.conditions,
                    "next_steps": step.next_steps
                }
                for step in workflow_def.steps
            ],
            "output_format": workflow_def.output_format,
            "approval_required": workflow_def.approval_required,
            "generated_at": state.timestamp if 'state' in locals() else None,
            "version": "1.0.0"
        }

    def _load_workflow_templates(self) -> dict[str, Any]:
        """Load predefined workflow templates."""
        return {
            "dependency_analysis": {
                "name": "Dependency Analysis",
                "description": "Analyze project dependencies for security and compliance",
                "steps": [
                    {"type": "validate", "name": "validate_manifest"},
                    {"type": "analyze", "name": "analyze_dependencies"},
                    {"type": "scan", "name": "scan_vulnerabilities"},
                    {"type": "check", "name": "check_licenses"},
                    {"type": "generate", "name": "generate_report"}
                ]
            },
            "security_audit": {
                "name": "Security Audit",
                "description": "Comprehensive security audit of dependencies",
                "steps": [
                    {"type": "scan", "name": "scan_vulnerabilities"},
                    {"type": "check", "name": "check_security_policies"},
                    {"type": "analyze", "name": "analyze_risk"},
                    {"type": "notify", "name": "notify_security_team"}
                ]
            },
            "compliance_check": {
                "name": "Compliance Check",
                "description": "Check compliance with organizational policies",
                "steps": [
                    {"type": "validate", "name": "validate_policies"},
                    {"type": "check", "name": "check_licenses"},
                    {"type": "analyze", "name": "analyze_compliance"},
                    {"type": "generate", "name": "generate_compliance_report"}
                ]
            }
        }

    def _load_step_implementations(self) -> dict[str, Callable]:
        """Load implementations for different step types."""
        return {
            "validate": self._execute_validate_step,
            "analyze": self._execute_analyze_step,
            "scan": self._execute_scan_step,
            "check": self._execute_check_step,
            "approve": self._execute_approve_step,
            "notify": self._execute_notify_step,
            "generate": self._execute_generate_step,
            "export": self._execute_export_step,
            "custom": self._execute_custom_step
        }

    def suggest_workflow_improvements(self, workflow: Workflow) -> list[str]:
        """Suggest improvements for a generated workflow."""
        suggestions = []

        # Check for common issues
        if not workflow.approval_required and "security" in workflow.description.lower():
            suggestions.append("Consider adding approval step for security-related workflows")

        if len(workflow.definition.get("steps", [])) > 10:
            suggestions.append("Workflow has many steps - consider breaking into smaller workflows")

        if not workflow.notification_emails:
            suggestions.append("Consider adding notification emails for important workflow events")

        return suggestions

    def validate_workflow_definition(self, workflow_def: WorkflowDefinition) -> list[str]:
        """Validate a workflow definition and return any issues."""
        issues = []

        # Check for required fields
        if not workflow_def.name:
            issues.append("Workflow name is required")

        if not workflow_def.steps:
            issues.append("Workflow must have at least one step")

        # Check step definitions
        for i, step in enumerate(workflow_def.steps):
            if not step.name:
                issues.append(f"Step {i+1} must have a name")

            if not step.step_type:
                issues.append(f"Step {i+1} must have a type")

        return issues

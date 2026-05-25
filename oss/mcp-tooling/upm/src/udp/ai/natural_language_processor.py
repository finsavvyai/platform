"""
Natural Language Processing for workflow generation.

Converts natural language descriptions into structured workflow definitions
that can be executed by the LangGraph workflow engine.
"""

import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dataclasses import dataclass

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class WorkflowStepType(str, Enum):
    """Types of workflow steps that can be generated."""
    VALIDATE = "validate"
    ANALYZE = "analyze"
    SCAN = "scan"
    CHECK = "check"
    APPROVE = "approve"
    NOTIFY = "notify"
    GENERATE = "generate"
    EXPORT = "export"
    CUSTOM = "custom"


class WorkflowTriggerType(str, Enum):
    """Types of workflow triggers."""
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    WEBHOOK = "webhook"
    FILE_CHANGE = "file_change"
    PACKAGE_UPDATE = "package_update"


@dataclass
class WorkflowStep:
    """Represents a single step in a generated workflow."""
    name: str
    step_type: WorkflowStepType
    description: str
    parameters: Dict[str, Any]
    conditions: List[str]
    next_steps: List[str]
    timeout_seconds: int = 300
    retry_count: int = 3


@dataclass
class WorkflowDefinition:
    """Complete workflow definition generated from natural language."""
    name: str
    description: str
    trigger_type: WorkflowTriggerType
    steps: List[WorkflowStep]
    parameters: Dict[str, Any]
    output_format: str
    approval_required: bool = False
    notification_emails: List[str] = None


class NaturalLanguageProcessor:
    """Processes natural language descriptions into workflow definitions."""
    
    def __init__(self):
        self.step_patterns = {
            WorkflowStepType.VALIDATE: [
                r"validate", r"check", r"verify", r"ensure", r"confirm"
            ],
            WorkflowStepType.ANALYZE: [
                r"analyze", r"examine", r"review", r"assess", r"evaluate"
            ],
            WorkflowStepType.SCAN: [
                r"scan", r"search", r"look for", r"find", r"detect"
            ],
            WorkflowStepType.CHECK: [
                r"check", r"inspect", r"audit", r"monitor"
            ],
            WorkflowStepType.APPROVE: [
                r"approve", r"authorize", r"confirm", r"accept"
            ],
            WorkflowStepType.NOTIFY: [
                r"notify", r"alert", r"send", r"email", r"message"
            ],
            WorkflowStepType.GENERATE: [
                r"generate", r"create", r"build", r"produce", r"make"
            ],
            WorkflowStepType.EXPORT: [
                r"export", r"download", r"save", r"output"
            ]
        }
        
        self.trigger_patterns = {
            WorkflowTriggerType.MANUAL: [r"manually", r"on demand", r"when requested"],
            WorkflowTriggerType.SCHEDULED: [r"daily", r"weekly", r"monthly", r"schedule", r"cron"],
            WorkflowTriggerType.WEBHOOK: [r"webhook", r"api call", r"http request"],
            WorkflowTriggerType.FILE_CHANGE: [r"file change", r"commit", r"push", r"git"],
            WorkflowTriggerType.PACKAGE_UPDATE: [r"package update", r"dependency change", r"version bump"]
        }
        
        self.condition_keywords = [
            "if", "when", "unless", "only if", "provided that", "in case"
        ]
        
        self.approval_keywords = [
            "approval", "approve", "authorize", "manual review", "human review"
        ]
    
    def parse_workflow_description(self, description: str) -> WorkflowDefinition:
        """
        Parse a natural language workflow description into a structured definition.
        
        Args:
            description: Natural language description of the workflow
            
        Returns:
            WorkflowDefinition object
        """
        try:
            logger.info(f"Parsing workflow description: {description[:100]}...")
            
            # Extract workflow name and description
            name = self._extract_workflow_name(description)
            clean_description = self._clean_description(description)
            
            # Determine trigger type
            trigger_type = self._extract_trigger_type(description)
            
            # Extract steps
            steps = self._extract_workflow_steps(description)
            
            # Extract parameters
            parameters = self._extract_parameters(description)
            
            # Determine output format
            output_format = self._extract_output_format(description)
            
            # Check if approval is required
            approval_required = self._check_approval_required(description)
            
            # Extract notification emails
            notification_emails = self._extract_notification_emails(description)
            
            workflow_def = WorkflowDefinition(
                name=name,
                description=clean_description,
                trigger_type=trigger_type,
                steps=steps,
                parameters=parameters,
                output_format=output_format,
                approval_required=approval_required,
                notification_emails=notification_emails
            )
            
            logger.info(f"Successfully parsed workflow: {name} with {len(steps)} steps")
            return workflow_def
            
        except Exception as e:
            logger.error(f"Failed to parse workflow description: {e}", exc_info=True)
            raise
    
    def _extract_workflow_name(self, description: str) -> str:
        """Extract workflow name from description."""
        # Look for patterns like "Create a workflow called X" or "Build X workflow"
        name_patterns = [
            r"workflow called ['\"]([^'\"]+)['\"]",
            r"workflow named ['\"]([^'\"]+)['\"]",
            r"['\"]([^'\"]+)['\"] workflow",
            r"build ([a-zA-Z0-9\s]+) workflow",
            r"create ([a-zA-Z0-9\s]+) workflow"
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                return match.group(1).strip().title()
        
        # Default to first few words
        words = description.split()[:3]
        return " ".join(words).title()
    
    def _clean_description(self, description: str) -> str:
        """Clean and normalize the description."""
        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', description.strip())
        
        # Remove common prefixes
        prefixes = [
            r"^create a workflow that ",
            r"^build a workflow to ",
            r"^make a workflow that ",
            r"^generate a workflow for "
        ]
        
        for prefix in prefixes:
            cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE)
        
        return cleaned
    
    def _extract_trigger_type(self, description: str) -> WorkflowTriggerType:
        """Extract trigger type from description."""
        description_lower = description.lower()
        
        for trigger_type, patterns in self.trigger_patterns.items():
            for pattern in patterns:
                if re.search(pattern, description_lower):
                    return trigger_type
        
        return WorkflowTriggerType.MANUAL  # Default
    
    def _extract_workflow_steps(self, description: str) -> List[WorkflowStep]:
        """Extract workflow steps from description."""
        steps = []
        description_lower = description.lower()
        
        # Split description into sentences
        sentences = re.split(r'[.!?]+', description)
        
        step_counter = 1
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Determine step type
            step_type = self._classify_step_type(sentence)
            
            if step_type:
                # Extract step name
                step_name = self._extract_step_name(sentence, step_type, step_counter)
                
                # Extract parameters
                parameters = self._extract_step_parameters(sentence)
                
                # Extract conditions
                conditions = self._extract_step_conditions(sentence)
                
                # Determine next steps (simplified)
                next_steps = self._determine_next_steps(step_counter, len(sentences))
                
                step = WorkflowStep(
                    name=step_name,
                    step_type=step_type,
                    description=sentence,
                    parameters=parameters,
                    conditions=conditions,
                    next_steps=next_steps
                )
                
                steps.append(step)
                step_counter += 1
        
        return steps
    
    def _classify_step_type(self, sentence: str) -> Optional[WorkflowStepType]:
        """Classify the type of workflow step from a sentence."""
        sentence_lower = sentence.lower()
        
        for step_type, patterns in self.step_patterns.items():
            for pattern in patterns:
                if re.search(pattern, sentence_lower):
                    return step_type
        
        return None
    
    def _extract_step_name(self, sentence: str, step_type: WorkflowStepType, counter: int) -> str:
        """Extract a meaningful name for the workflow step."""
        # Try to extract the main action
        action_patterns = [
            r"(\w+)\s+(?:the|all|any)\s+(\w+)",
            r"(\w+)\s+(\w+)",
            r"(\w+)\s+(?:for|of|in|on)\s+(\w+)"
        ]
        
        for pattern in action_patterns:
            match = re.search(pattern, sentence.lower())
            if match:
                action = match.group(1)
                target = match.group(2)
                return f"{action.title()}_{target.title()}"
        
        # Default naming
        return f"{step_type.value.title()}_Step_{counter}"
    
    def _extract_step_parameters(self, sentence: str) -> Dict[str, Any]:
        """Extract parameters from a sentence."""
        parameters = {}
        
        # Look for specific parameter patterns
        param_patterns = {
            "timeout": r"timeout[:\s]+(\d+)\s*(?:seconds?|minutes?|hours?)",
            "retry": r"retry[:\s]+(\d+)",
            "threshold": r"threshold[:\s]+(\d+(?:\.\d+)?)",
            "severity": r"(?:severity|level)[:\s]+(low|medium|high|critical)",
            "format": r"format[:\s]+(\w+)",
            "email": r"email[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"
        }
        
        for param_name, pattern in param_patterns.items():
            match = re.search(pattern, sentence, re.IGNORECASE)
            if match:
                value = match.group(1)
                # Convert to appropriate type
                if param_name in ["timeout", "retry"]:
                    parameters[param_name] = int(value)
                elif param_name == "threshold":
                    parameters[param_name] = float(value)
                else:
                    parameters[param_name] = value
        
        return parameters
    
    def _extract_step_conditions(self, sentence: str) -> List[str]:
        """Extract conditional logic from a sentence."""
        conditions = []
        
        # Look for conditional keywords
        for keyword in self.condition_keywords:
            if keyword in sentence.lower():
                # Extract the condition part
                condition_match = re.search(
                    rf"{keyword}\s+(.+?)(?:\s+then|\s+else|$)",
                    sentence,
                    re.IGNORECASE
                )
                if condition_match:
                    conditions.append(condition_match.group(1).strip())
        
        return conditions
    
    def _determine_next_steps(self, current_step: int, total_steps: int) -> List[str]:
        """Determine the next steps for a workflow step."""
        if current_step < total_steps:
            return [f"step_{current_step + 1}"]
        return ["end"]
    
    def _extract_parameters(self, description: str) -> Dict[str, Any]:
        """Extract global workflow parameters."""
        parameters = {}
        
        # Look for common parameter patterns
        param_patterns = {
            "ecosystem": r"(?:ecosystem|package manager)[:\s]+(\w+)",
            "repository": r"repository[:\s]+([a-zA-Z0-9._/-]+)",
            "branch": r"branch[:\s]+([a-zA-Z0-9._/-]+)",
            "environment": r"environment[:\s]+(\w+)",
            "team": r"team[:\s]+([a-zA-Z0-9._/-]+)"
        }
        
        for param_name, pattern in param_patterns.items():
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                parameters[param_name] = match.group(1)
        
        return parameters
    
    def _extract_output_format(self, description: str) -> str:
        """Extract desired output format."""
        description_lower = description.lower()
        
        if "json" in description_lower:
            return "json"
        elif "yaml" in description_lower or "yml" in description_lower:
            return "yaml"
        elif "csv" in description_lower:
            return "csv"
        elif "pdf" in description_lower:
            return "pdf"
        elif "html" in description_lower:
            return "html"
        else:
            return "json"  # Default
    
    def _check_approval_required(self, description: str) -> bool:
        """Check if approval is required for the workflow."""
        description_lower = description.lower()
        
        for keyword in self.approval_keywords:
            if keyword in description_lower:
                return True
        
        return False
    
    def _extract_notification_emails(self, description: str) -> List[str]:
        """Extract notification email addresses."""
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, description)
        return list(set(emails))  # Remove duplicates

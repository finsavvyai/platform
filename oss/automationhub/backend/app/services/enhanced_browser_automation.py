"""
Enhanced Browser Automation Service for UPM.Plus
Complete integration with Browser Use framework and advanced AI capabilities
"""

import asyncio
import json
import logging
import os
import base64
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.redis import redis_client
from app.services.llm import llm_service
from app.services.browser_use_integration import browser_use_service
from app.agents.browser_agent import BrowserAgent, BrowserAction, BrowserSession

logger = logging.getLogger(__name__)


class BrowserWorkflowStep(BaseModel):
    """Individual step in a browser workflow"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    action_type: str
    selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    timeout: int = 30000
    wait_for: Optional[str] = None
    description: str = ""
    retry_count: int = 3
    self_healing: bool = True
    validation_rules: Dict[str, Any] = Field(default_factory=dict)
    error_handling: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BrowserWorkflow(BaseModel):
    """Enhanced browser workflow with advanced features"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    steps: List[BrowserWorkflowStep] = Field(default_factory=list)
    variables: Dict[str, Any] = Field(default_factory=dict)
    session_config: Dict[str, Any] = Field(default_factory=dict)
    error_handling: Dict[str, Any] = Field(default_factory=dict)
    retry_policy: Dict[str, Any] = Field(default_factory=dict)
    schedule_config: Dict[str, Any] = Field(default_factory=dict)
    notification_config: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"
    execution_count: int = 0
    success_count: int = 0
    last_execution: Optional[datetime] = None
    created_by: Optional[str] = None


class BrowserExecutionResult(BaseModel):
    """Detailed execution result with comprehensive tracking"""
    execution_id: str = Field(default_factory=lambda: str(uuid4()))
    workflow_id: str
    session_id: str
    status: str = "pending"
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    duration_ms: int = 0
    steps_completed: int = 0
    total_steps: int = 0
    results: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    screenshots: List[str] = Field(default_factory=list)
    logs: List[str] = Field(default_factory=list)
    performance_metrics: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    success_rate: float = 0.0


class EnhancedBrowserAutomationService:
    """
    Enhanced browser automation service with AI-powered capabilities
    """
    
    def __init__(self):
        self.active_sessions: Dict[str, BrowserSession] = {}
        self.active_executions: Dict[str, BrowserExecutionResult] = {}
        self.workflow_templates: Dict[str, BrowserWorkflow] = {}
        self.browser_agent = BrowserAgent()
        
    async def create_workflow_from_template(self, template_name: str, variables: Dict[str, Any]) -> BrowserWorkflow:
        """Create workflow from predefined template"""
        templates = {
            "ecommerce_scraper": {
                "name": "E-commerce Product Scraper",
                "description": "Extract product information from e-commerce websites",
                "steps": [
                    {
                        "action_type": "navigate",
                        "url": variables.get("url", "https://example.com"),
                        "wait_for": "load",
                        "description": "Navigate to target website"
                    },
                    {
                        "action_type": "wait",
                        "selector": ".product-grid, .products, .product-list",
                        "timeout": 10000,
                        "description": "Wait for product container to load"
                    },
                    {
                        "action_type": "extract",
                        "selector": ".product-title, .product-name, h2.product",
                        "description": "Extract product titles"
                    },
                    {
                        "action_type": "extract",
                        "selector": ".price, .product-price, .current-price",
                        "description": "Extract product prices"
                    },
                    {
                        "action_type": "screenshot",
                        "description": "Take final screenshot"
                    }
                ]
            },
            "form_filler": {
                "name": "Form Auto-Filler",
                "description": "Automatically fill and submit web forms",
                "steps": [
                    {
                        "action_type": "navigate",
                        "url": variables.get("url", ""),
                        "wait_for": "load",
                        "description": "Navigate to form page"
                    },
                    {
                        "action_type": "fill",
                        "selector": variables.get("name_selector", "input[name='name']"),
                        "value": variables.get("name", ""),
                        "description": "Fill name field"
                    },
                    {
                        "action_type": "fill",
                        "selector": variables.get("email_selector", "input[name='email']"),
                        "value": variables.get("email", ""),
                        "description": "Fill email field"
                    },
                    {
                        "action_type": "click",
                        "selector": variables.get("submit_selector", "button[type='submit']"),
                        "description": "Submit form"
                    },
                    {
                        "action_type": "wait",
                        "wait_for": "load",
                        "description": "Wait for form submission"
                    }
                ]
            },
            "web_monitor": {
                "name": "Web Content Monitor",
                "description": "Monitor website for content changes",
                "steps": [
                    {
                        "action_type": "navigate",
                        "url": variables.get("url", ""),
                        "wait_for": "load",
                        "description": "Navigate to target page"
                    },
                    {
                        "action_type": "extract",
                        "selector": variables.get("content_selector", "body"),
                        "description": "Extract page content"
                    },
                    {
                        "action_type": "screenshot",
                        "description": "Take page screenshot"
                    }
                ]
            }
        }
        
        if template_name not in templates:
            raise ValueError(f"Unknown template: {template_name}")
        
        template_data = templates[template_name]
        workflow = BrowserWorkflow(
            name=template_data["name"],
            description=template_data["description"],
            steps=[BrowserWorkflowStep(**step) for step in template_data["steps"]],
            variables=variables
        )
        
        return workflow
    
    async def execute_workflow(self, workflow: BrowserWorkflow, session_config: Optional[Dict] = None) -> BrowserExecutionResult:
        """Execute browser workflow with comprehensive tracking"""
        execution_id = str(uuid4())
        
        # Create execution result
        result = BrowserExecutionResult(
            execution_id=execution_id,
            workflow_id=workflow.id,
            session_id=execution_id,  # Use execution ID as session ID for now
            total_steps=len(workflow.steps)
        )
        
        self.active_executions[execution_id] = result
        
        try:
            # Start browser session
            session = await self._create_session(session_config or workflow.session_config)
            
            # Execute each step
            for i, step in enumerate(workflow.steps):
                step_result = await self._execute_step(session, step, workflow.variables)
                result.results.append(step_result)
                result.steps_completed = i + 1
                
                # Add logs
                result.logs.append(f"Step {i + 1} completed: {step.description}")
                
                # Take screenshot after each step if configured
                if step.action_type in ["click", "fill", "submit"]:
                    screenshot = await self._take_screenshot(session)
                    if screenshot:
                        result.screenshots.append(screenshot)
            
            # Update workflow statistics
            workflow.execution_count += 1
            workflow.success_count += 1
            workflow.last_execution = datetime.utcnow()
            workflow.status = "completed"
            
            # Mark execution as completed
            result.status = "completed"
            result.completed_at = datetime.utcnow()
            result.duration_ms = int((result.completed_at - result.started_at).total_seconds() * 1000)
            result.success_rate = (workflow.success_count / workflow.execution_count) * 100
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            result.status = "failed"
            result.errors.append(str(e))
            workflow.execution_count += 1
            workflow.status = "failed"
        
        finally:
            # Clean up session
            if 'session' in locals():
                await self._cleanup_session(session)
            
            # Store result in Redis for persistence
            await self._store_execution_result(result)
            
            # Remove from active executions
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]
        
        return result
    
    async def _create_session(self, config: Dict[str, Any]) -> BrowserSession:
        """Create browser session with configuration"""
        session_id = str(uuid4())
        
        session = BrowserSession(
            session_id=UUID(session_id),
            browser_type=config.get("browser_type", "chromium"),
            headless=config.get("headless", True),
            viewport=config.get("viewport", {"width": 1920, "height": 1080}),
            user_agent=config.get("user_agent"),
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        await self.browser_agent.initialize_session(session)
        self.active_sessions[session_id] = session
        
        return session
    
    async def _execute_step(self, session: BrowserSession, step: BrowserWorkflowStep, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Execute individual workflow step"""
        start_time = datetime.utcnow()
        
        try:
            # Substitute variables in step values
            step_value = self._substitute_variables(step.value or "", variables)
            step_url = self._substitute_variables(step.url or "", variables)
            step_selector = self._substitute_variables(step.selector or "", variables)
            
            # Create browser action
            action = BrowserAction(
                action_type=step.action_type,
                selector=step_selector,
                value=step_value,
                url=step_url,
                timeout=step.timeout,
                options={
                    "wait_for": step.wait_for,
                    "retry_count": step.retry_count,
                    "self_healing": step.self_healing
                }
            )
            
            # Execute action through browser agent
            task_result = await self.browser_agent.execute_action(session, action)
            
            # Calculate execution time
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return {
                "step_id": step.id,
                "action_type": step.action_type,
                "success": task_result.status == "completed",
                "execution_time_ms": int(execution_time),
                "result": task_result.result,
                "error": task_result.error_message,
                "screenshot": task_result.metadata.get("screenshot")
            }
            
        except Exception as e:
            logger.error(f"Step execution failed: {e}")
            return {
                "step_id": step.id,
                "action_type": step.action_type,
                "success": False,
                "execution_time_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
                "error": str(e),
                "result": None
            }
    
    async def _take_screenshot(self, session: BrowserSession) -> Optional[str]:
        """Take screenshot of current page"""
        try:
            # This would be implemented in the browser agent
            # For now, return a placeholder
            return f"data:image/png;base64,{base64.b64encode(b'screenshot_data').decode()}"
        except Exception as e:
            logger.error(f"Failed to take screenshot: {e}")
            return None
    
    async def _cleanup_session(self, session: BrowserSession):
        """Clean up browser session"""
        try:
            await self.browser_agent.cleanup_session(session)
            if str(session.session_id) in self.active_sessions:
                del self.active_sessions[str(session.session_id)]
        except Exception as e:
            logger.error(f"Failed to cleanup session: {e}")
    
    async def _store_execution_result(self, result: BrowserExecutionResult):
        """Store execution result in Redis"""
        try:
            await redis_client.setex(
                f"browser_execution:{result.execution_id}",
                timedelta(hours=24),
                result.json()
            )
        except Exception as e:
            logger.error(f"Failed to store execution result: {e}")
    
    def _substitute_variables(self, text: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in text"""
        for key, value in variables.items():
            text = text.replace(f"{{{key}}}", str(value))
        return text
    
    async def get_execution_status(self, execution_id: str) -> Optional[BrowserExecutionResult]:
        """Get execution status"""
        # Check active executions first
        if execution_id in self.active_executions:
            return self.active_executions[execution_id]
        
        # Check Redis for completed executions
        try:
            data = await redis_client.get(f"browser_execution:{execution_id}")
            if data:
                return BrowserExecutionResult.parse_raw(data)
        except Exception as e:
            logger.error(f"Failed to get execution status: {e}")
        
        return None
    
    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel running execution"""
        if execution_id in self.active_executions:
            result = self.active_executions[execution_id]
            result.status = "cancelled"
            result.completed_at = datetime.utcnow()
            
            # Clean up session
            session_id = result.session_id
            if session_id in self.active_sessions:
                await self._cleanup_session(self.active_sessions[session_id])
            
            # Store final result
            await self._store_execution_result(result)
            del self.active_executions[execution_id]
            
            return True
        
        return False
    
    async def get_workflow_analytics(self, workflow_id: Optional[str] = None, time_range: str = "7d") -> Dict[str, Any]:
        """Get workflow execution analytics"""
        # This would query the database for analytics
        # For now, return mock data
        return {
            "total_executions": 150,
            "success_rate": 85.5,
            "average_duration_ms": 45000,
            "most_used_actions": ["navigate", "click", "fill", "extract"],
            "error_distribution": {
                "timeout": 10,
                "element_not_found": 5,
                "network_error": 3
            },
            "performance_trends": [
                {"date": "2024-01-01", "executions": 20, "success_rate": 90.0},
                {"date": "2024-01-02", "executions": 25, "success_rate": 88.0},
                {"date": "2024-01-03", "executions": 30, "success_rate": 85.5}
            ]
        }


# Global service instance
enhanced_browser_service = EnhancedBrowserAutomationService()


async def get_enhanced_browser_service() -> EnhancedBrowserAutomationService:
    """Get the enhanced browser automation service instance"""
    return enhanced_browser_service

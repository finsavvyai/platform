"""
Browser automation service using Browser Use and NanoBrowser capabilities.

This service provides a high-level interface for browser automation tasks,
integrating with the BrowserAgent and providing workflow-level orchestration.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from pydantic import BaseModel, Field

from app.agents.browser_agent import BrowserAgent, BrowserAction, BrowserSession
from app.agents.base import Task, TaskType, ExecutionContext
from app.services.llm import llm_service
from app.services.browser_manager import (
    browser_manager, BrowserConfig, BrowserType, ExecutionMode, DeviceProfile
)
from app.services.self_healing import self_healing_service
from app.services.ai_selector import ai_selector_service
from app.core.redis import redis_client
import json
import base64

logger = logging.getLogger(__name__)


class BrowserWorkflow(BaseModel):
    """Browser automation workflow definition."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    actions: List[BrowserAction]
    variables: Dict[str, Any] = Field(default_factory=dict)
    session_config: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Multi-browser support
    browser_config: Optional[BrowserConfig] = None
    browser_preferences: Dict[str, Any] = Field(default_factory=dict)


class BrowserWorkflowResult(BaseModel):
    """Result of browser workflow execution."""
    workflow_id: UUID
    success: bool
    results: List[Any] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    execution_time_ms: int
    screenshots: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BrowserAutomationService:
    """
    High-level browser automation service with multi-browser support and self-healing capabilities.

    Provides workflow orchestration, session management, multi-browser
    capabilities, AI-powered element detection, automatic selector repair,
    and learning from execution history.
    """

    def __init__(self):
        self.browser_agent = BrowserAgent()
        self.active_workflows: Dict[UUID, BrowserWorkflow] = {}
        self.workflow_templates: Dict[str, BrowserWorkflow] = {}
        self.active_browser_instances: Dict[str, UUID] = {}
        self._initialize_templates()

        # Start browser manager performance monitoring
        # Note: Deferred until service is actually used to avoid event loop issues during import
        # asyncio.create_task(browser_manager.start_performance_monitoring())
    
    def _initialize_templates(self):
        """Initialize common workflow templates."""
        
        # Web scraping template
        scraping_template = BrowserWorkflow(
            name="web_scraping",
            description="Extract data from web pages",
            actions=[
                BrowserAction(
                    action_type="navigate",
                    url="{{target_url}}",
                    timeout=30000
                ),
                BrowserAction(
                    action_type="wait",
                    selector="{{wait_selector}}",
                    timeout=10000
                ),
                BrowserAction(
                    action_type="extract_all",
                    selector="{{data_selector}}",
                    options={"attribute": "{{attribute}}"}
                ),
                BrowserAction(
                    action_type="screenshot",
                    options={"type": "png", "full_page": True}
                )
            ],
            variables={
                "target_url": "https://example.com",
                "wait_selector": "body",
                "data_selector": "h1, h2, h3",
                "attribute": "textContent"
            }
        )
        self.workflow_templates["web_scraping"] = scraping_template
        
        # Form automation template
        form_template = BrowserWorkflow(
            name="form_automation",
            description="Fill and submit web forms",
            actions=[
                BrowserAction(
                    action_type="navigate",
                    url="{{form_url}}"
                ),
                BrowserAction(
                    action_type="wait",
                    selector="form",
                    timeout=10000
                ),
                BrowserAction(
                    action_type="type",
                    selector="{{field_selector}}",
                    value="{{field_value}}"
                ),
                BrowserAction(
                    action_type="click",
                    selector="{{submit_selector}}"
                ),
                BrowserAction(
                    action_type="wait",
                    selector="{{success_selector}}",
                    timeout=15000
                )
            ],
            variables={
                "form_url": "https://example.com/form",
                "field_selector": "input[name='email']",
                "field_value": "user@example.com",
                "submit_selector": "button[type='submit']",
                "success_selector": ".success-message"
            }
        )
        self.workflow_templates["form_automation"] = form_template
        
        # E-commerce automation template
        ecommerce_template = BrowserWorkflow(
            name="ecommerce_automation",
            description="Automate e-commerce interactions",
            actions=[
                BrowserAction(
                    action_type="navigate",
                    url="{{product_url}}"
                ),
                BrowserAction(
                    action_type="extract",
                    selector="{{price_selector}}",
                    options={"attribute": "textContent"}
                ),
                BrowserAction(
                    action_type="extract",
                    selector="{{availability_selector}}",
                    options={"attribute": "textContent"}
                ),
                BrowserAction(
                    action_type="click",
                    selector="{{add_to_cart_selector}}"
                ),
                BrowserAction(
                    action_type="screenshot",
                    options={"type": "png"}
                )
            ],
            variables={
                "product_url": "https://example-store.com/product/123",
                "price_selector": ".price",
                "availability_selector": ".availability",
                "add_to_cart_selector": ".add-to-cart"
            }
        )
        self.workflow_templates["ecommerce_automation"] = ecommerce_template
        
        logger.info(f"Initialized {len(self.workflow_templates)} workflow templates")

    # Multi-browser support methods
    async def get_available_browsers(self) -> List[Dict[str, Any]]:
        """Get list of available browsers with compatibility information."""
        return await browser_manager.get_available_browsers()

    async def get_device_profiles(self) -> Dict[str, Dict[str, Any]]:
        """Get available device profiles for mobile emulation."""
        return browser_manager.get_device_profiles()

    async def create_browser_config(
        self,
        browser_type: Union[str, BrowserType] = BrowserType.CHROMIUM,
        execution_mode: Union[str, ExecutionMode] = ExecutionMode.HEADLESS,
        device_profile: Optional[str] = None,
        viewport: Optional[Dict[str, int]] = None,
        user_agent: Optional[str] = None,
        **kwargs
    ) -> BrowserConfig:
        """Create a browser configuration."""
        if isinstance(browser_type, str):
            browser_type = BrowserType(browser_type)
        if isinstance(execution_mode, str):
            execution_mode = ExecutionMode(execution_mode)

        # Set device profile if specified
        device_profile_obj = None
        if device_profile:
            device_profiles = browser_manager.get_device_profiles()
            if device_profile in device_profiles:
                device_data = device_profiles[device_profile]
                device_profile_obj = DeviceProfile(**device_data)

        # Create configuration
        config = BrowserConfig(
            browser_type=browser_type,
            execution_mode=execution_mode,
            device_profile=device_profile_obj,
            viewport=viewport or (device_profile_obj.viewport if device_profile_obj else {"width": 1280, "height": 720}),
            user_agent=user_agent or (device_profile_obj.user_agent if device_profile_obj else None),
            **kwargs
        )

        return config

    async def check_browser_compatibility(self, browser_type: Union[str, BrowserType]) -> Dict[str, Any]:
        """Check browser compatibility and return detailed information."""
        if isinstance(browser_type, str):
            browser_type = BrowserType(browser_type)

        compatibility_info = await browser_manager.check_browser_compatibility(browser_type)
        return {
            "browser_type": compatibility_info.browser_type.value,
            "installed_version": compatibility_info.installed_version,
            "minimum_required_version": compatibility_info.minimum_required_version,
            "is_compatible": compatibility_info.is_compatible,
            "installation_path": compatibility_info.installation_path,
            "capabilities": compatibility_info.capabilities,
            "limitations": compatibility_info.limitations
        }

    async def create_browser_instance(self, config: BrowserConfig) -> str:
        """Create a new browser instance with the specified configuration."""
        instance_id = await browser_manager.create_browser_instance(config)
        self.active_browser_instances[config.browser_type.value] = instance_id
        return str(instance_id)

    async def create_workflow_with_browser_config(
        self,
        description: str,
        browser_config: BrowserConfig,
        target_url: Optional[str] = None
    ) -> BrowserWorkflow:
        """Create a workflow with specific browser configuration."""
        workflow = await self.create_workflow_from_description(description, target_url)
        workflow.browser_config = browser_config
        return workflow

    async def execute_workflow_with_browser_config(
        self,
        workflow: BrowserWorkflow,
        context: Optional[ExecutionContext] = None,
        variable_overrides: Optional[Dict[str, Any]] = None
    ) -> BrowserWorkflowResult:
        """Execute workflow with specific browser configuration."""
        start_time = datetime.utcnow()

        try:
            # Create browser instance if specified
            browser_instance_id = None
            if workflow.browser_config:
                browser_instance_id = await browser_manager.create_browser_instance(workflow.browser_config)
                logger.info(f"Created browser instance {browser_instance_id} for workflow {workflow.name}")

            # Execute workflow using browser manager
            if browser_instance_id and workflow.browser_config:
                result = await self._execute_workflow_with_browser_manager(
                    workflow, browser_instance_id, context, variable_overrides
                )
            else:
                # Fallback to original browser agent
                result = await self.execute_workflow(workflow, context, variable_overrides)

            # Add browser information to result metadata
            if workflow.browser_config:
                result.metadata.update({
                    "browser_type": workflow.browser_config.browser_type.value,
                    "execution_mode": workflow.browser_config.execution_mode.value,
                    "device_profile": workflow.browser_config.device_profile.name if workflow.browser_config.device_profile else None,
                    "browser_instance_id": str(browser_instance_id) if browser_instance_id else None
                })

            return result

        except Exception as e:
            logger.error(f"Multi-browser workflow execution failed: {e}")
            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return BrowserWorkflowResult(
                workflow_id=workflow.id,
                success=False,
                errors=[str(e)],
                execution_time_ms=execution_time,
                metadata={"browser_error": True}
            )

    async def _execute_workflow_with_browser_manager(
        self,
        workflow: BrowserWorkflow,
        browser_instance_id: UUID,
        context: Optional[ExecutionContext],
        variable_overrides: Optional[Dict[str, Any]]
    ) -> BrowserWorkflowResult:
        """Execute workflow using the browser manager."""
        start_time = datetime.utcnow()

        try:
            # Create context and page
            context_id = await browser_manager.create_context(browser_instance_id)
            page_id = await browser_manager.create_page(context_id)
            page = await browser_manager.get_page(page_id)

            # Merge variables with overrides
            variables = {**workflow.variables, **(variable_overrides or {})}
            processed_actions = self._substitute_variables(workflow.actions, variables)

            results = []
            errors = []
            screenshots = []

            # Execute actions
            for i, action in enumerate(processed_actions):
                try:
                    step_result = await self._execute_action_on_page(page, action)
                    results.append(step_result)

                    # Extract screenshots from results
                    if isinstance(step_result, dict) and "screenshot" in step_result:
                        screenshots.append(step_result["screenshot"])

                except Exception as e:
                    error_msg = f"Action {i+1} ({action.action_type}) failed: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)

                    # Continue unless it's a critical action
                    if hasattr(action, 'critical') and action.critical:
                        raise

            # Cleanup
            await browser_manager.close_page(page_id)
            await browser_manager.close_context(context_id)

            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return BrowserWorkflowResult(
                workflow_id=workflow.id,
                success=len(errors) == 0,
                results=results,
                errors=errors,
                execution_time_ms=execution_time,
                screenshots=screenshots,
                metadata={
                    "browser_manager": True,
                    "browser_instance_id": str(browser_instance_id),
                    "actions_executed": len(processed_actions)
                }
            )

        except Exception as e:
            logger.error(f"Browser manager workflow execution failed: {e}")
            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            return BrowserWorkflowResult(
                workflow_id=workflow.id,
                success=False,
                errors=[str(e)],
                execution_time_ms=execution_time
            )

    async def _execute_action_on_page(self, page: Page, action: BrowserAction) -> Any:
        """Execute a browser action on a specific page."""
        try:
            if action.action_type == "navigate":
                await page.goto(action.url, timeout=action.timeout)
                return {"url": page.url, "title": await page.title()}

            elif action.action_type == "click":
                if action.selector.startswith("ai:"):
                    # Use AI to find element
                    description = action.selector[3:].strip()
                    selector = await self._ai_element_selector_on_page(page, description)
                else:
                    selector = action.selector
                await page.click(selector, timeout=action.timeout)
                return {"clicked": selector}

            elif action.action_type == "type":
                if action.selector.startswith("ai:"):
                    description = action.selector[3:].strip()
                    selector = await self._ai_element_selector_on_page(page, description)
                else:
                    selector = action.selector
                await page.fill(selector, action.value)
                return {"typed": action.value, "selector": selector}

            elif action.action_type == "extract":
                if action.selector.startswith("ai:"):
                    description = action.selector[3:].strip()
                    selector = await self._ai_element_selector_on_page(page, description)
                else:
                    selector = action.selector

                if action.options.get("attribute"):
                    result = await page.get_attribute(selector, action.options["attribute"])
                else:
                    result = await page.text_content(selector)
                return {"extracted": result, "selector": selector}

            elif action.action_type == "extract_all":
                if action.selector.startswith("ai:"):
                    description = action.selector[3:].strip()
                    selector = await self._ai_element_selector_on_page(page, description)
                else:
                    selector = action.selector

                elements = await page.query_selector_all(selector)
                results = []
                for element in elements:
                    if action.options.get("attribute"):
                        text = await element.get_attribute(action.options["attribute"])
                    else:
                        text = await element.text_content()
                    results.append(text)
                return {"extracted": results, "count": len(results)}

            elif action.action_type == "wait":
                if action.selector:
                    if action.selector.startswith("ai:"):
                        description = action.selector[3:].strip()
                        selector = await self._ai_element_selector_on_page(page, description)
                    else:
                        selector = action.selector
                    await page.wait_for_selector(selector, timeout=action.timeout)
                    return {"waited_for": selector}
                else:
                    await page.wait_for_timeout(action.options.get("duration", 1000))
                    return {"waited": action.options.get("duration", 1000)}

            elif action.action_type == "screenshot":
                screenshot_options = action.options.copy()
                if action.selector:
                    if action.selector.startswith("ai:"):
                        description = action.selector[3:].strip()
                        selector = await self._ai_element_selector_on_page(page, description)
                    else:
                        selector = action.selector
                    element = await page.query_selector(selector)
                    screenshot = await element.screenshot(**screenshot_options)
                else:
                    screenshot = await page.screenshot(**screenshot_options)

                # Convert to base64 for JSON serialization
                screenshot_b64 = base64.b64encode(screenshot).decode()
                return {"screenshot": screenshot_b64, "format": screenshot_options.get("type", "png")}

            elif action.action_type == "evaluate":
                script = action.options.get("script", action.value)
                result = await page.evaluate(script)
                return {"result": result, "script": script}

            else:
                raise ValueError(f"Unsupported action type: {action.action_type}")

        except Exception as e:
            logger.error(f"Page action {action.action_type} failed: {e}")
            raise

    async def _ai_element_selector_on_page(self, page: Page, description: str) -> str:
        """Use AI to find element selector based on description."""
        try:
            # Get page content for AI analysis
            page_content = await page.content()
            page_title = await page.title()

            # Use LLM to generate selector
            prompt = f"""
            You are a web automation expert. Given the following web page content and element description,
            provide the best CSS selector to find the element.

            Page Title: {page_title}
            Element Description: {description}

            Page Content (first 2000 chars):
            {page_content[:2000]}

            Respond with only the CSS selector, no explanation.
            """

            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.1,
                max_tokens=100
            )

            selector = result["content"].strip()

            # Validate selector exists on page
            element = await page.query_selector(selector)
            if element:
                logger.info(f"AI found selector '{selector}' for description '{description}'")
                return selector
            else:
                # Fallback to text-based selector
                fallback_selector = f"text={description}"
                logger.warning(f"AI selector '{selector}' not found, using fallback: {fallback_selector}")
                return fallback_selector

        except Exception as e:
            logger.error(f"AI selector generation failed: {e}")
            # Fallback to text-based selector
            return f"text={description}"

    async def get_active_browser_instances(self) -> List[Dict[str, Any]]:
        """Get information about active browser instances."""
        return browser_manager.get_active_instances()

    async def close_browser_instance(self, instance_id: str) -> bool:
        """Close a specific browser instance."""
        try:
            from uuid import UUID
            instance_uuid = UUID(instance_id)
            await browser_manager.close_browser_instance(instance_uuid)

            # Remove from active instances tracking
            browser_type_to_remove = None
            for browser_type, tracked_id in self.active_browser_instances.items():
                if tracked_id == instance_uuid:
                    browser_type_to_remove = browser_type
                    break

            if browser_type_to_remove:
                del self.active_browser_instances[browser_type_to_remove]

            return True
        except Exception as e:
            logger.error(f"Failed to close browser instance {instance_id}: {e}")
            return False

    async def cleanup_all_browsers(self):
        """Clean up all browser instances."""
        try:
            await browser_manager.cleanup_all()
            self.active_browser_instances.clear()
            logger.info("All browser instances cleaned up")
        except Exception as e:
            logger.error(f"Failed to cleanup all browsers: {e}")

    async def create_workflow_from_description(
        self, 
        description: str, 
        target_url: Optional[str] = None
    ) -> BrowserWorkflow:
        """Create a browser workflow from natural language description."""
        try:
            # Use AI to generate workflow actions
            workflow_result = await llm_service.generate_workflow(
                objective=description,
                tools=[
                    "navigate", "click", "type", "extract", "extract_all", 
                    "wait", "screenshot", "evaluate"
                ],
                constraints=f"Target URL: {target_url or 'Not specified'}"
            )
            
            # Handle fallback responses
            if workflow_result.get("fallback", False):
                # Create a simple fallback workflow
                steps = [{
                    "tool": "navigate",
                    "parameters": {"url": target_url or "https://example.com"}
                }, {
                    "tool": "screenshot",
                    "parameters": {"type": "png"}
                }]
                workflow_data = {"steps": steps}
            else:
                workflow_data = workflow_result.get("workflow", {})
                steps = workflow_data.get("steps", [])
            
            # Convert AI-generated steps to BrowserActions
            actions = []
            variables = {}
            
            for i, step in enumerate(steps):
                action_type = step.get("tool", "navigate")
                parameters = step.get("parameters", {})
                
                # Map AI step to BrowserAction
                if action_type == "navigate":
                    action = BrowserAction(
                        action_type="navigate",
                        url=parameters.get("url", target_url or "https://example.com")
                    )
                elif action_type == "click":
                    action = BrowserAction(
                        action_type="click",
                        selector=parameters.get("selector", "button")
                    )
                elif action_type == "type":
                    action = BrowserAction(
                        action_type="type",
                        selector=parameters.get("selector", "input"),
                        value=parameters.get("value", "")
                    )
                elif action_type == "extract":
                    action = BrowserAction(
                        action_type="extract",
                        selector=parameters.get("selector", "body"),
                        options=parameters.get("options", {})
                    )
                elif action_type == "wait":
                    action = BrowserAction(
                        action_type="wait",
                        selector=parameters.get("selector"),
                        timeout=parameters.get("timeout", 10000)
                    )
                else:
                    # Default action
                    action = BrowserAction(
                        action_type="screenshot",
                        options={"type": "png"}
                    )
                
                actions.append(action)
                
                # Extract variables from parameters
                for key, value in parameters.items():
                    if isinstance(value, str) and "{{" in value:
                        var_name = value.replace("{{", "").replace("}}", "")
                        variables[var_name] = f"value_for_{var_name}"
            
            workflow = BrowserWorkflow(
                name=f"ai_generated_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                description=description,
                actions=actions,
                variables=variables
            )
            
            logger.info(f"Created AI-generated workflow with {len(actions)} actions")
            return workflow
            
        except Exception as e:
            logger.error(f"Failed to create workflow from description: {e}")
            
            # Fallback: create simple navigation workflow
            return BrowserWorkflow(
                name="simple_navigation",
                description=description,
                actions=[
                    BrowserAction(
                        action_type="navigate",
                        url=target_url or "https://example.com"
                    ),
                    BrowserAction(
                        action_type="screenshot",
                        options={"type": "png", "full_page": True}
                    )
                ]
            )
    
    async def execute_workflow(
        self, 
        workflow: BrowserWorkflow,
        context: Optional[ExecutionContext] = None,
        variable_overrides: Optional[Dict[str, Any]] = None
    ) -> BrowserWorkflowResult:
        """Execute a browser automation workflow."""
        start_time = datetime.utcnow()
        
        try:
            # Merge variables with overrides
            variables = {**workflow.variables, **(variable_overrides or {})}
            
            # Substitute variables in actions
            processed_actions = self._substitute_variables(workflow.actions, variables)
            
            # Create task for browser agent
            task = Task(
                type=TaskType.BROWSER_AUTOMATION,
                name=workflow.name,
                description=workflow.description,
                parameters={
                    "actions": [action.dict() for action in processed_actions],
                    "session": workflow.session_config
                }
            )
            
            # Execute with browser agent
            execution_context = context or ExecutionContext()
            result = await self.browser_agent.execute_task(task, execution_context)
            
            # Process results
            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            workflow_result = BrowserWorkflowResult(
                workflow_id=workflow.id,
                success=result.status.value == "completed",
                results=[step.result for step in result.execution_steps if step.result],
                errors=[step.error for step in result.execution_steps if step.error],
                execution_time_ms=execution_time,
                metadata={
                    "task_id": str(result.task_id),
                    "steps_executed": len(result.execution_steps),
                    "agent_id": str(self.browser_agent.id)
                }
            )
            
            # Extract screenshots from results
            for step_result in workflow_result.results:
                if isinstance(step_result, dict) and "screenshot" in step_result:
                    workflow_result.screenshots.append(step_result["screenshot"])
            
            logger.info(f"Workflow {workflow.name} executed in {execution_time}ms")
            return workflow_result
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            return BrowserWorkflowResult(
                workflow_id=workflow.id,
                success=False,
                errors=[str(e)],
                execution_time_ms=execution_time
            )
    
    def _substitute_variables(
        self, 
        actions: List[BrowserAction], 
        variables: Dict[str, Any]
    ) -> List[BrowserAction]:
        """Substitute variables in workflow actions."""
        processed_actions = []
        
        for action in actions:
            # Create a copy of the action
            action_dict = action.dict()
            
            # Substitute variables in all string fields
            for key, value in action_dict.items():
                if isinstance(value, str):
                    action_dict[key] = self._substitute_string_variables(value, variables)
                elif isinstance(value, dict):
                    action_dict[key] = self._substitute_dict_variables(value, variables)
            
            processed_actions.append(BrowserAction(**action_dict))
        
        return processed_actions
    
    def _substitute_string_variables(self, text: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in a string."""
        result = text
        for var_name, var_value in variables.items():
            placeholder = f"{{{{{var_name}}}}}"
            if placeholder in result:
                result = result.replace(placeholder, str(var_value))
        return result
    
    def _substitute_dict_variables(
        self, 
        data: Dict[str, Any], 
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Substitute variables in a dictionary."""
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self._substitute_string_variables(value, variables)
            elif isinstance(value, dict):
                result[key] = self._substitute_dict_variables(value, variables)
            else:
                result[key] = value
        return result
    
    async def execute_template_workflow(
        self, 
        template_name: str,
        variables: Dict[str, Any],
        context: Optional[ExecutionContext] = None
    ) -> BrowserWorkflowResult:
        """Execute a predefined workflow template."""
        template = self.workflow_templates.get(template_name)
        if not template:
            raise ValueError(f"Unknown workflow template: {template_name}")
        
        # Create workflow instance from template
        workflow = BrowserWorkflow(
            name=f"{template.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            description=template.description,
            actions=template.actions.copy(),
            variables={**template.variables, **variables},
            session_config=template.session_config
        )
        
        return await self.execute_workflow(workflow, context)
    
    async def scrape_website(
        self, 
        url: str, 
        selectors: List[str],
        wait_selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scrape data from a website using specified selectors."""
        variables = {
            "target_url": url,
            "data_selector": ", ".join(selectors),
            "wait_selector": wait_selector or "body"
        }
        
        result = await self.execute_template_workflow("web_scraping", variables)
        
        # Extract scraped data
        scraped_data = {}
        for i, step_result in enumerate(result.results):
            if isinstance(step_result, dict) and "extracted" in step_result:
                scraped_data[f"selector_{i}"] = step_result["extracted"]
        
        return {
            "success": result.success,
            "data": scraped_data,
            "url": url,
            "execution_time_ms": result.execution_time_ms,
            "errors": result.errors
        }
    
    async def fill_form(
        self, 
        form_url: str, 
        form_data: Dict[str, str],
        submit_selector: str = "button[type='submit']"
    ) -> Dict[str, Any]:
        """Fill and submit a web form."""
        # Create form filling workflow
        actions = [
            BrowserAction(action_type="navigate", url=form_url),
            BrowserAction(action_type="wait", selector="form", timeout=10000)
        ]
        
        # Add form field actions
        for field_selector, field_value in form_data.items():
            actions.append(BrowserAction(
                action_type="type",
                selector=field_selector,
                value=field_value
            ))
        
        # Add submit action
        actions.append(BrowserAction(
            action_type="click",
            selector=submit_selector
        ))
        
        # Add screenshot for verification
        actions.append(BrowserAction(
            action_type="screenshot",
            options={"type": "png"}
        ))
        
        workflow = BrowserWorkflow(
            name="form_filling",
            description=f"Fill form at {form_url}",
            actions=actions
        )
        
        result = await self.execute_workflow(workflow)
        
        return {
            "success": result.success,
            "form_url": form_url,
            "fields_filled": len(form_data),
            "execution_time_ms": result.execution_time_ms,
            "errors": result.errors,
            "screenshots": result.screenshots
        }
    
    async def monitor_website_changes(
        self, 
        url: str, 
        selector: str,
        check_interval_seconds: int = 300
    ) -> Dict[str, Any]:
        """Monitor a website for changes in specified element."""
        try:
            # Get initial state
            initial_result = await self.scrape_website(url, [selector])
            initial_content = initial_result.get("data", {}).get("selector_0", "")
            
            # Store in Redis for comparison
            cache_key = f"monitor:{url}:{selector}"
            await redis_client.set(cache_key, str(initial_content), expire=86400)  # 24 hours
            
            return {
                "success": True,
                "url": url,
                "selector": selector,
                "initial_content": initial_content,
                "monitoring_started": datetime.utcnow().isoformat(),
                "check_interval_seconds": check_interval_seconds
            }
            
        except Exception as e:
            logger.error(f"Failed to start website monitoring: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def check_website_changes(self, url: str, selector: str) -> Dict[str, Any]:
        """Check if monitored website content has changed."""
        try:
            cache_key = f"monitor:{url}:{selector}"
            previous_content = await redis_client.get(cache_key)
            
            if not previous_content:
                return {
                    "success": False,
                    "error": "No previous content found. Start monitoring first."
                }
            
            # Get current content
            current_result = await self.scrape_website(url, [selector])
            current_content = current_result.get("data", {}).get("selector_0", "")
            
            # Compare content
            has_changed = str(current_content) != str(previous_content)
            
            if has_changed:
                # Update cache with new content
                await redis_client.set(cache_key, str(current_content), expire=86400)
            
            return {
                "success": True,
                "url": url,
                "selector": selector,
                "has_changed": has_changed,
                "previous_content": previous_content,
                "current_content": current_content,
                "checked_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to check website changes: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_available_templates(self) -> List[Dict[str, Any]]:
        """Get list of available workflow templates."""
        return [
            {
                "name": name,
                "description": template.description,
                "actions_count": len(template.actions),
                "variables": list(template.variables.keys())
            }
            for name, template in self.workflow_templates.items()
        ]
    
    async def validate_workflow(self, workflow: BrowserWorkflow) -> Dict[str, Any]:
        """Validate a workflow for common issues."""
        issues = []
        warnings = []
        
        # Check for required variables
        required_vars = set()
        for action in workflow.actions:
            action_str = str(action.dict())
            import re
            vars_in_action = re.findall(r'\{\{(\w+)\}\}', action_str)
            required_vars.update(vars_in_action)
        
        missing_vars = required_vars - set(workflow.variables.keys())
        if missing_vars:
            issues.append(f"Missing variables: {', '.join(missing_vars)}")
        
        # Check for navigation actions
        has_navigation = any(action.action_type == "navigate" for action in workflow.actions)
        if not has_navigation:
            warnings.append("Workflow has no navigation action")
        
        # Check for reasonable timeouts
        for action in workflow.actions:
            if action.timeout and action.timeout > 60000:  # 60 seconds
                warnings.append(f"Long timeout ({action.timeout}ms) in {action.action_type} action")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "required_variables": list(required_vars),
            "actions_count": len(workflow.actions)
        }
    
    # Self-Healing Automation Methods

    async def execute_action_with_self_healing(
        self,
        page: Page,
        action: BrowserAction,
        execution_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a browser action with self-healing capabilities.

        Args:
            page: Playwright page instance
            action: Browser action to execute
            execution_context: Additional context for self-healing

        Returns:
            Action execution result with self-healing information
        """
        start_time = datetime.utcnow()
        original_selector = action.selector
        healing_attempts = 0
        max_attempts = 3

        execution_context = execution_context or {}

        while healing_attempts <= max_attempts:
            try:
                # Attempt to execute the action
                result = await self._execute_action(page, action)

                # If successful, learn from the execution
                if healing_attempts == 0:
                    await self._learn_from_successful_execution(
                        action, page, execution_context
                    )

                execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                return {
                    **result,
                    "self_healing": {
                        "attempts": healing_attempts,
                        "original_selector": original_selector,
                        "final_selector": action.selector,
                        "healing_applied": healing_attempts > 0,
                        "execution_time_ms": execution_time
                    }
                }

            except Exception as e:
                error_msg = str(e)
                logger.warning(f"Action failed (attempt {healing_attempts + 1}): {error_msg}")

                # If this is the first failure, try self-healing
                if healing_attempts == 0:
                    healing_result = await self._attempt_selector_healing(
                        action, page, error_msg, execution_context
                    )

                    if healing_result["healed"]:
                        action.selector = healing_result["repaired_selector"]
                        logger.info(f"Self-healing applied: {original_selector} -> {healing_result['repaired_selector']}")
                        healing_attempts += 1
                        continue

                # If healing failed or we've tried multiple times, give up
                if healing_attempts >= max_attempts:
                    # Learn from the failure
                    await self._learn_from_failed_execution(
                        action, page, error_msg, execution_context
                    )

                    execution_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                    return {
                        "error": error_msg,
                        "self_healing": {
                            "attempts": healing_attempts,
                            "original_selector": original_selector,
                            "final_selector": action.selector,
                            "healing_applied": healing_attempts > 0,
                            "healing_failed": True,
                            "execution_time_ms": execution_time
                        }
                    }

                healing_attempts += 1

        # This should not be reached, but just in case
        return {
            "error": "Self-healing attempts exhausted",
            "self_healing": {
                "attempts": healing_attempts,
                "original_selector": original_selector,
                "final_selector": action.selector,
                "healing_applied": True,
                "healing_failed": True
            }
        }

    async def _attempt_selector_healing(
        self,
        action: BrowserAction,
        page: Page,
        error_message: str,
        execution_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Attempt to heal a failed selector.

        Args:
            action: The failed browser action
            page: Playwright page instance
            error_message: Error message from the failed attempt
            execution_context: Execution context for healing

        Returns:
            Healing result with repaired selector
        """
        try:
            # Get page content for analysis
            page_content = await page.content()
            page_url = page.url

            # Attempt selector repair using self-healing service
            repair_result = await self_healing_service.repair_selector(
                failed_selector=action.selector,
                page_content=page_content,
                page_url=page_url,
                error_type=self._classify_error(error_message),
                context={
                    "action_type": action.action_type,
                    "execution_context": execution_context
                }
            )

            if repair_result.confidence > 0.5 and repair_result.repaired_selector != action.selector:
                # Validate the repaired selector
                validation_result = await ai_selector_service.validate_selector(
                    selector=repair_result.repaired_selector,
                    html_content=page_content
                )

                if validation_result["valid"]:
                    return {
                        "healed": True,
                        "repaired_selector": repair_result.repaired_selector,
                        "confidence": repair_result.confidence,
                        "repair_strategy": repair_result.repair_strategy,
                        "validation": validation_result
                    }
                else:
                    logger.warning(f"Repaired selector failed validation: {validation_result['issues']}")

            # If repair failed, try element detection
            detection_result = await self._attempt_element_detection(
                action, page, page_content, page_url, execution_context
            )

            if detection_result["detected"]:
                return {
                    "healed": True,
                    "repaired_selector": detection_result["selector"],
                    "confidence": detection_result["confidence"],
                    "repair_strategy": "element_detection",
                    "detection_method": detection_result["method"]
                }

            return {
                "healed": False,
                "repaired_selector": action.selector,
                "confidence": 0.0,
                "repair_strategy": "none"
            }

        except Exception as e:
            logger.error(f"Selector healing attempt failed: {e}")
            return {
                "healed": False,
                "repaired_selector": action.selector,
                "confidence": 0.0,
                "repair_strategy": "error",
                "error": str(e)
            }

    async def _attempt_element_detection(
        self,
        action: BrowserAction,
        page: Page,
        page_content: str,
        page_url: str,
        execution_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Attempt to detect elements using AI and other methods.

        Args:
            action: The failed browser action
            page: Playwright page instance
            page_content: HTML content of the page
            page_url: Current page URL
            execution_context: Execution context

        Returns:
            Detection result with alternative selector
        """
        try:
            # Generate element description from action context
            description = self._generate_element_description(action, execution_context)

            # Try AI-powered element detection
            element_matches = await self_healing_service.detect_element(
                page_content=page_content,
                page_url=page_url,
                original_selector=action.selector,
                description=description,
                visual_context=execution_context.get("visual_context")
            )

            if element_matches:
                best_match = element_matches[0]  # Take the highest confidence match

                # Validate the detected selector
                validation_result = await ai_selector_service.validate_selector(
                    selector=best_match.selector,
                    html_content=page_content
                )

                if validation_result["valid"] and validation_result["matches"] > 0:
                    return {
                        "detected": True,
                        "selector": best_match.selector,
                        "confidence": best_match.confidence,
                        "method": "ai_detection",
                        "validation": validation_result
                    }

            return {
                "detected": False,
                "selector": action.selector,
                "confidence": 0.0,
                "method": "none"
            }

        except Exception as e:
            logger.error(f"Element detection attempt failed: {e}")
            return {
                "detected": False,
                "selector": action.selector,
                "confidence": 0.0,
                "method": "error",
                "error": str(e)
            }

    async def _learn_from_successful_execution(
        self,
        action: BrowserAction,
        page: Page,
        execution_context: Dict[str, Any]
    ):
        """Learn from successful action execution."""
        try:
            # Create visual context if available
            visual_context = execution_context.get("visual_context", {})

            # Store execution success for learning
            await self_healing_service.learn_from_execution(
                execution_id=uuid4(),
                selector=action.selector,
                url=page.url,
                success=True,
                page_snapshot=await page.content(),
                element_snapshot=visual_context.get("element_snapshot"),
                confidence=execution_context.get("confidence", 1.0)
            )

        except Exception as e:
            logger.error(f"Failed to learn from successful execution: {e}")

    async def _learn_from_failed_execution(
        self,
        action: BrowserAction,
        page: Page,
        error_message: str,
        execution_context: Dict[str, Any]
    ):
        """Learn from failed action execution."""
        try:
            # Create visual context if available
            visual_context = execution_context.get("visual_context", {})

            # Store execution failure for learning
            await self_healing_service.learn_from_execution(
                execution_id=uuid4(),
                selector=action.selector,
                url=page.url,
                success=False,
                page_snapshot=await page.content(),
                element_snapshot=visual_context.get("element_snapshot"),
                error_type=self._classify_error(error_message),
                confidence=0.0
            )

        except Exception as e:
            logger.error(f"Failed to learn from failed execution: {e}")

    def _generate_element_description(
        self, action: BrowserAction, execution_context: Dict[str, Any]
    ) -> str:
        """Generate element description from action and context."""
        description_parts = []

        # Use action type as base description
        action_descriptions = {
            "click": "clickable element",
            "type": "text input field",
            "extract": "element containing information",
            "wait": "element to wait for",
            "screenshot": "element to capture"
        }

        base_desc = action_descriptions.get(action.action_type, "element")
        description_parts.append(base_desc)

        # Add selector information
        if action.selector:
            if action.selector.startswith("#"):
                description_parts.append(f"with id '{action.selector[1:]}'")
            elif action.selector.startswith("."):
                description_parts.append(f"with class '{action.selector[1:]}'")
            else:
                description_parts.append(f"matching selector '{action.selector}'")

        # Add value information for typing actions
        if action.action_type == "type" and action.value:
            description_parts.append(f"for entering '{action.value}'")

        # Add context information
        if execution_context.get("workflow_description"):
            description_parts.append(f"in {execution_context['workflow_description']}")

        if execution_context.get("previous_actions"):
            description_parts.append("after previous interactions")

        return " ".join(description_parts)

    def _classify_error(self, error_message: str) -> str:
        """Classify the type of error for healing strategies."""
        error_lower = error_message.lower()

        if "timeout" in error_lower or "timed out" in error_lower:
            return "timeout"
        elif "not found" in error_lower or "no element" in error_lower:
            return "element_not_found"
        elif "selector" in error_lower or "css" in error_lower:
            return "selector_invalid"
        elif "detached" in error_lower or "removed" in error_lower:
            return "element_detached"
        elif "visible" in error_lower or "hidden" in error_lower:
            return "element_not_visible"
        elif "clickable" in error_lower or "obscured" in error_lower:
            return "element_not_clickable"
        elif "disabled" in error_lower or "read-only" in error_lower:
            return "element_disabled"
        else:
            return "unknown"

    async def get_self_healing_statistics(self) -> Dict[str, Any]:
        """Get self-healing service statistics."""
        try:
            base_stats = self_healing_service.get_statistics()

            # Add service-specific statistics
            service_stats = {
                **base_stats,
                "browser_automation_service": {
                    "active_workflows": len(self.active_workflows),
                    "browser_instances": len(self.active_browser_instances),
                    "workflow_templates": len(self.workflow_templates)
                }
            }

            return service_stats

        except Exception as e:
            logger.error(f"Failed to get self-healing statistics: {e}")
            return {}

    async def enable_self_healing_mode(
        self,
        enabled: bool = True,
        healing_strategies: Optional[List[str]] = None,
        confidence_threshold: float = 0.5,
        max_healing_attempts: int = 3
    ) -> Dict[str, Any]:
        """
        Configure self-healing mode settings.

        Args:
            enabled: Whether to enable self-healing
            healing_strategies: List of strategies to use
            confidence_threshold: Minimum confidence threshold for healed selectors
            max_healing_attempts: Maximum number of healing attempts per action

        Returns:
            Configuration result
        """
        try:
            config = {
                "enabled": enabled,
                "healing_strategies": healing_strategies or [
                    "ai_detection",
                    "visual_matching",
                    "pattern_based",
                    "attribute_based",
                    "text_based",
                    "structural_based",
                    "fallback"
                ],
                "confidence_threshold": confidence_threshold,
                "max_healing_attempts": max_healing_attempts,
                "configured_at": datetime.utcnow().isoformat()
            }

            # Store configuration in Redis for persistence
            await redis_client.set(
                "self_healing:config",
                json.dumps(config, default=str),
                expire=86400 * 7  # 7 days
            )

            logger.info(f"Self-healing mode {'enabled' if enabled else 'disabled'}")
            return config

        except Exception as e:
            logger.error(f"Failed to configure self-healing mode: {e}")
            return {"error": str(e)}

    async def analyze_selector_health(
        self,
        selector: str,
        page_url: str,
        historical_data: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze the health and reliability of a selector.

        Args:
            selector: The selector to analyze
            page_url: URL where the selector is used
            historical_data: Whether to include historical analysis

        Returns:
            Selector health analysis
        """
        try:
            analysis = {
                "selector": selector,
                "url": page_url,
                "syntax_valid": self._is_valid_selector_syntax(selector),
                "complexity_score": 0.0,
                "robustness_score": 0.0,
                "historical_performance": {},
                "recommendations": []
            }

            # Calculate complexity score
            analysis["complexity_score"] = self._calculate_selector_complexity(selector)

            # Calculate robustness score
            analysis["robustness_score"] = self._calculate_selector_robustness(selector)

            # Add historical performance if requested
            if historical_data:
                historical_stats = await self._get_selector_historical_performance(selector, page_url)
                analysis["historical_performance"] = historical_stats

            # Generate recommendations
            analysis["recommendations"] = self._generate_selector_recommendations(analysis)

            # Overall health score
            analysis["health_score"] = (
                analysis["robustness_score"] * 0.5 +
                (1.0 - analysis["complexity_score"]) * 0.3 +
                analysis["historical_performance"].get("success_rate", 0.5) * 0.2
            )

            return analysis

        except Exception as e:
            logger.error(f"Failed to analyze selector health: {e}")
            return {"error": str(e), "selector": selector}

    def _is_valid_selector_syntax(self, selector: str) -> bool:
        """Check if selector has valid syntax."""
        try:
            # Basic syntax validation
            if not selector or not selector.strip():
                return False

            # Check for balanced brackets
            if selector.count('[') != selector.count(']'):
                return False
            if selector.count('(') != selector.count(')'):
                return False

            # Check for obvious syntax errors
            invalid_chars = ['<', '>', '|', '^', '$', '%', '&', '*']
            if any(char in selector for char in invalid_chars):
                return False

            return True

        except Exception:
            return False

    def _calculate_selector_complexity(self, selector: str) -> float:
        """Calculate selector complexity score (0-1, where 1 is most complex)."""
        try:
            complexity = 0.0

            # Length contributes to complexity
            length_score = min(1.0, len(selector) / 100.0)
            complexity += length_score * 0.3

            # Number of components
            components = len(selector.split())
            component_score = min(1.0, components / 10.0)
            complexity += component_score * 0.4

            # Number of special characters
            special_chars = sum(1 for c in selector if c in ['[', ']', '(', ')', ':', '>', '+', '~'])
            special_score = min(1.0, special_chars / 10.0)
            complexity += special_score * 0.3

            return min(1.0, complexity)

        except Exception:
            return 0.5

    def _calculate_selector_robustness(self, selector: str) -> float:
        """Calculate selector robustness score (0-1, where 1 is most robust)."""
        try:
            robustness = 0.5  # Base score

            # ID selectors are very robust
            if '#' in selector and not re.search(r'[.\s\[]+', selector.split('#')[1].split()[0]):
                robustness += 0.4

            # Test automation attributes are robust
            test_attrs = ['data-testid', 'data-test', 'data-automation', 'data-cy']
            if any(attr in selector for attr in test_attrs):
                robustness += 0.3

            # Semantic tags are more robust than generic ones
            semantic_tags = ['button', 'input', 'select', 'textarea', 'nav', 'main', 'header']
            if any(tag in selector for tag in semantic_tags):
                robustness += 0.1

            # Overly complex selectors are less robust
            complexity = self._calculate_selector_complexity(selector)
            if complexity > 0.7:
                robustness -= (complexity - 0.7) * 0.5

            return min(1.0, max(0.0, robustness))

        except Exception:
            return 0.5

    async def _get_selector_historical_performance(self, selector: str, page_url: str) -> Dict[str, Any]:
        """Get historical performance data for a selector."""
        try:
            # This would query the self-healing service's historical data
            # For now, return mock data
            return {
                "total_executions": 0,
                "successful_executions": 0,
                "success_rate": 0.0,
                "average_confidence": 0.0,
                "last_execution": None,
                "most_common_error": None
            }

        except Exception as e:
            logger.error(f"Failed to get selector historical performance: {e}")
            return {}

    def _generate_selector_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate recommendations for improving a selector."""
        recommendations = []

        try:
            if not analysis.get("syntax_valid"):
                recommendations.append("Selector has syntax errors - fix the CSS selector syntax")

            if analysis.get("complexity_score", 0) > 0.8:
                recommendations.append("Selector is very complex - consider simplifying for better maintainability")

            if analysis.get("robustness_score", 0) < 0.5:
                recommendations.append("Selector lacks robustness - consider using IDs or test automation attributes")

            if analysis.get("historical_performance", {}).get("success_rate", 0) < 0.7:
                recommendations.append("Selector has low historical success rate - consider alternative selectors")

            if not any(attr in analysis["selector"] for attr in ['#', '.', '[']):
                recommendations.append("Consider using more specific selectors with IDs, classes, or attributes")

            return recommendations

        except Exception as e:
            logger.error(f"Failed to generate selector recommendations: {e}")
            return ["Unable to generate recommendations due to error"]

    async def cleanup(self):
        """Clean up browser automation service resources."""
        try:
            await self.browser_agent.cleanup()
            logger.info("Browser automation service cleanup completed")
        except Exception as e:
            logger.error(f"Browser automation service cleanup failed: {e}")


# Global browser automation service instance
browser_automation_service = BrowserAutomationService()

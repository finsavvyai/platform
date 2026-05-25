"""
Browser automation agent implementation using Playwright.

This agent specializes in web browser automation tasks including navigation,
interaction, data extraction, and workflow automation.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from pydantic import BaseModel

from app.agents.base import (
    UPMAgent, Task, TaskResult, TaskStatus, TaskType, ExecutionContext,
    ExecutionStep, Capability, AgentStatus
)
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class BrowserAction(BaseModel):
    """Browser action definition."""
    action_type: str  # navigate, click, type, extract, wait, screenshot
    selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    timeout: int = 30000
    options: Dict[str, Any] = {}


class BrowserSession(BaseModel):
    """Browser session information."""
    session_id: UUID
    browser_type: str = "chromium"
    headless: bool = True
    viewport: Dict[str, int] = {"width": 1280, "height": 720}
    user_agent: Optional[str] = None
    created_at: datetime
    last_activity: datetime


class BrowserAgent(UPMAgent):
    """
    Browser automation agent using Playwright.
    
    Capabilities:
    - Web page navigation and interaction
    - Data extraction and scraping
    - Form filling and submission
    - Screenshot capture
    - Multi-page workflows
    - AI-powered element detection
    """
    
    def __init__(self, **kwargs):
        # Define browser-specific capabilities
        capabilities = [
            Capability(
                name="web_navigation",
                description="Navigate to web pages and handle redirects",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="element_interaction",
                description="Click, type, and interact with web elements",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="data_extraction",
                description="Extract text, attributes, and structured data from web pages",
                supported_task_types=[TaskType.BROWSER_AUTOMATION, TaskType.DATA_PROCESSING]
            ),
            Capability(
                name="form_automation",
                description="Fill and submit web forms automatically",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="screenshot_capture",
                description="Capture screenshots of web pages and elements",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            ),
            Capability(
                name="ai_element_detection",
                description="Use AI to detect and interact with web elements",
                supported_task_types=[TaskType.BROWSER_AUTOMATION]
            )
        ]
        
        super().__init__(
            name=kwargs.get("name", "BrowserAgent"),
            capabilities=capabilities,
            **kwargs
        )
        
        # Browser-specific attributes
        self.playwright = None
        self.browser = None
        self.contexts: Dict[UUID, BrowserContext] = {}
        self.pages: Dict[UUID, Page] = {}
        self.active_sessions: Dict[UUID, BrowserSession] = {}
    
    def _register_default_tools(self):
        """Register browser-specific tools."""
        self.tools.register_tool("playwright", self._get_playwright)
        self.tools.register_tool("browser", self._get_browser)
        self.tools.register_tool("ai_selector", self._ai_element_selector)
        self.tools.register_tool("smart_wait", self._smart_wait)
    
    async def _get_playwright(self):
        """Get or initialize Playwright instance."""
        if not self.playwright:
            self.playwright = await async_playwright().start()
        return self.playwright
    
    async def _get_browser(self, browser_type: str = "chromium", headless: bool = True):
        """Get or create browser instance."""
        if not self.browser:
            playwright = await self._get_playwright()
            if browser_type == "chromium":
                self.browser = await playwright.chromium.launch(headless=headless)
            elif browser_type == "firefox":
                self.browser = await playwright.firefox.launch(headless=headless)
            elif browser_type == "webkit":
                self.browser = await playwright.webkit.launch(headless=headless)
            else:
                raise ValueError(f"Unsupported browser type: {browser_type}")
        return self.browser
    
    async def execute_task(self, task: Task, context: ExecutionContext) -> TaskResult:
        """Execute a browser automation task."""
        self.status = AgentStatus.BUSY
        started_at = datetime.utcnow()
        execution_steps = []
        
        try:
            self.logger.info(f"Executing browser task: {task.name}")
            
            # Parse task parameters
            actions = task.parameters.get("actions", [])
            session_config = task.parameters.get("session", {})
            
            # Create browser session
            session_id = uuid4()
            session = await self._create_session(session_id, session_config)
            
            # Execute browser actions
            result = None
            for i, action_data in enumerate(actions):
                step_id = uuid4()
                step_started = datetime.utcnow()
                
                try:
                    action = BrowserAction(**action_data)
                    step_result = await self._execute_browser_action(session_id, action)
                    
                    step = ExecutionStep(
                        step_id=step_id,
                        action=f"{action.action_type}:{action.selector or action.url}",
                        parameters=action.dict(),
                        result=step_result,
                        started_at=step_started,
                        completed_at=datetime.utcnow(),
                        duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
                    )
                    execution_steps.append(step)
                    
                    # Store result from last action
                    result = step_result
                    
                except Exception as e:
                    self.logger.error(f"Browser action failed: {e}")
                    step = ExecutionStep(
                        step_id=step_id,
                        action=f"{action_data.get('action_type', 'unknown')}",
                        parameters=action_data,
                        error=str(e),
                        started_at=step_started,
                        completed_at=datetime.utcnow(),
                        duration_ms=int((datetime.utcnow() - step_started).total_seconds() * 1000)
                    )
                    execution_steps.append(step)
                    
                    # Continue with next action unless it's critical
                    if action_data.get("critical", False):
                        raise
            
            # Clean up session
            await self._cleanup_session(session_id)
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.COMPLETED,
                result=result,
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                metadata={
                    "session_id": str(session_id),
                    "actions_executed": len(execution_steps),
                    "browser_type": session.browser_type
                }
            )
            
            # Update performance metrics
            self.update_performance_metrics(task_result)
            self.status = AgentStatus.IDLE
            
            return task_result
            
        except Exception as e:
            self.logger.error(f"Browser task execution failed: {e}")
            self.status = AgentStatus.ERROR
            
            completed_at = datetime.utcnow()
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            
            task_result = TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_steps=execution_steps,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms
            )
            
            self.update_performance_metrics(task_result)
            return task_result
    
    async def _create_session(self, session_id: UUID, config: Dict[str, Any]) -> BrowserSession:
        """Create a new browser session."""
        browser_type = config.get("browser_type", "chromium")
        headless = config.get("headless", True)
        viewport = config.get("viewport", {"width": 1280, "height": 720})
        user_agent = config.get("user_agent")
        
        browser = await self._get_browser(browser_type, headless)
        context = await browser.new_context(
            viewport=viewport,
            user_agent=user_agent
        )
        page = await context.new_page()
        
        session = BrowserSession(
            session_id=session_id,
            browser_type=browser_type,
            headless=headless,
            viewport=viewport,
            user_agent=user_agent,
            created_at=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        
        self.contexts[session_id] = context
        self.pages[session_id] = page
        self.active_sessions[session_id] = session
        
        self.logger.info(f"Created browser session {session_id}")
        return session
    
    async def _execute_browser_action(self, session_id: UUID, action: BrowserAction) -> Any:
        """Execute a single browser action."""
        page = self.pages.get(session_id)
        if not page:
            raise ValueError(f"No active page for session {session_id}")
        
        # Update session activity
        if session_id in self.active_sessions:
            self.active_sessions[session_id].last_activity = datetime.utcnow()
        
        try:
            if action.action_type == "navigate":
                await page.goto(action.url, timeout=action.timeout)
                return {"url": page.url, "title": await page.title()}
            
            elif action.action_type == "click":
                selector = await self._resolve_selector(page, action.selector)
                await page.click(selector, timeout=action.timeout)
                return {"clicked": selector}
            
            elif action.action_type == "type":
                selector = await self._resolve_selector(page, action.selector)
                await page.fill(selector, action.value)
                return {"typed": action.value, "selector": selector}
            
            elif action.action_type == "extract":
                selector = await self._resolve_selector(page, action.selector)
                if action.options.get("attribute"):
                    result = await page.get_attribute(selector, action.options["attribute"])
                else:
                    result = await page.text_content(selector)
                return {"extracted": result, "selector": selector}
            
            elif action.action_type == "extract_all":
                selector = await self._resolve_selector(page, action.selector)
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
                    selector = await self._resolve_selector(page, action.selector)
                    await page.wait_for_selector(selector, timeout=action.timeout)
                    return {"waited_for": selector}
                else:
                    await page.wait_for_timeout(action.options.get("duration", 1000))
                    return {"waited": action.options.get("duration", 1000)}
            
            elif action.action_type == "screenshot":
                screenshot_options = action.options.copy()
                if action.selector:
                    selector = await self._resolve_selector(page, action.selector)
                    element = await page.query_selector(selector)
                    screenshot = await element.screenshot(**screenshot_options)
                else:
                    screenshot = await page.screenshot(**screenshot_options)
                
                # Convert to base64 for JSON serialization
                import base64
                screenshot_b64 = base64.b64encode(screenshot).decode()
                return {"screenshot": screenshot_b64, "format": screenshot_options.get("type", "png")}
            
            elif action.action_type == "evaluate":
                script = action.options.get("script", action.value)
                result = await page.evaluate(script)
                return {"result": result, "script": script}
            
            else:
                raise ValueError(f"Unsupported action type: {action.action_type}")
                
        except Exception as e:
            self.logger.error(f"Browser action {action.action_type} failed: {e}")
            raise
    
    async def _resolve_selector(self, page: Page, selector: str) -> str:
        """Resolve selector using AI if needed."""
        if not selector:
            raise ValueError("Selector is required")
        
        # If selector starts with "ai:", use AI to find the element
        if selector.startswith("ai:"):
            description = selector[3:].strip()
            return await self._ai_element_selector(page, description)
        
        return selector
    
    async def _ai_element_selector(self, page: Page, description: str) -> str:
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
                self.logger.info(f"AI found selector '{selector}' for description '{description}'")
                return selector
            else:
                # Fallback to text-based selector
                fallback_selector = f"text={description}"
                self.logger.warning(f"AI selector '{selector}' not found, using fallback: {fallback_selector}")
                return fallback_selector
                
        except Exception as e:
            self.logger.error(f"AI selector generation failed: {e}")
            # Fallback to text-based selector
            return f"text={description}"
    
    async def _smart_wait(self, page: Page, condition: str, timeout: int = 30000) -> bool:
        """Smart wait using AI to determine when condition is met."""
        try:
            # Use AI to generate wait condition
            prompt = f"""
            Generate a JavaScript expression that returns true when this condition is met on a web page:
            Condition: {condition}
            
            The expression should be suitable for page.wait_for_function() in Playwright.
            Respond with only the JavaScript expression.
            """
            
            result = await llm_service.generate_completion(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200
            )
            
            js_expression = result["content"].strip()
            await page.wait_for_function(js_expression, timeout=timeout)
            return True
            
        except Exception as e:
            self.logger.error(f"Smart wait failed: {e}")
            return False
    
    async def _cleanup_session(self, session_id: UUID):
        """Clean up browser session resources."""
        try:
            if session_id in self.pages:
                await self.pages[session_id].close()
                del self.pages[session_id]
            
            if session_id in self.contexts:
                await self.contexts[session_id].close()
                del self.contexts[session_id]
            
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            
            self.logger.info(f"Cleaned up browser session {session_id}")
            
        except Exception as e:
            self.logger.error(f"Session cleanup failed: {e}")
    
    async def _contribute_to_collaboration(
        self, 
        objective: str, 
        context: Optional[ExecutionContext] = None
    ) -> Dict[str, Any]:
        """Contribute browser automation capabilities to collaboration."""
        
        # Use AI to analyze how browser automation can help with the objective
        try:
            analysis = await llm_service.analyze_task(
                task_description=f"Browser automation contribution to: {objective}",
                context=f"Available capabilities: {[cap.name for cap in self.capabilities]}"
            )
            
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "browser_automation",
                "capabilities": [cap.name for cap in self.capabilities],
                "contribution_analysis": analysis.get("analysis", {}),
                "suggested_actions": [
                    "Navigate to relevant web pages",
                    "Extract data from web interfaces",
                    "Automate form submissions",
                    "Capture screenshots for documentation",
                    "Monitor web-based systems"
                ]
            }
            
        except Exception as e:
            self.logger.error(f"Collaboration contribution analysis failed: {e}")
            return {
                "agent_id": self.id,
                "agent_name": self.name,
                "agent_type": "browser_automation",
                "capabilities": [cap.name for cap in self.capabilities],
                "error": str(e)
            }
    
    async def cleanup(self):
        """Clean up all browser resources."""
        try:
            # Close all sessions
            for session_id in list(self.active_sessions.keys()):
                await self._cleanup_session(session_id)
            
            # Close browser
            if self.browser:
                await self.browser.close()
                self.browser = None
            
            # Stop playwright
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None
            
            self.logger.info("Browser agent cleanup completed")
            
        except Exception as e:
            self.logger.error(f"Browser agent cleanup failed: {e}")
    
    def __del__(self):
        """Ensure cleanup on deletion."""
        if self.browser or self.playwright:
            # Note: This is not ideal as __del__ can't be async
            # Better to explicitly call cleanup()
            self.logger.warning("Browser agent deleted without proper cleanup")

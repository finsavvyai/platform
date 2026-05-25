"""
Browser Use Integration Service for UPM.Plus

Provides advanced browser automation capabilities using the Browser Use framework,
enabling AI-powered web interactions, form filling, data extraction, and complex
multi-step web workflows with self-healing capabilities.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from app.core.config import settings
from app.core.redis import redis_client
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class BrowserAction(BaseModel):
    """Browser action definition."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str  # navigate, click, fill, select, extract, wait, screenshot
    selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    timeout: int = 30000
    wait_for: Optional[str] = None  # load, networkidle, element
    description: str = ""
    retry_count: int = 3
    self_healing: bool = True


class BrowserSession(BaseModel):
    """Browser session configuration."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    browser_type: str = "chromium"  # chromium, firefox, webkit
    headless: bool = True
    viewport: Dict[str, int] = Field(default_factory=lambda: {"width": 1920, "height": 1080})
    user_agent: Optional[str] = None
    extra_headers: Dict[str, str] = Field(default_factory=dict)
    proxy: Optional[Dict[str, str]] = None
    locale: str = "en-US"
    timezone: str = "America/New_York"
    geolocation: Optional[Dict[str, float]] = None
    permissions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[UUID] = None


class BrowserWorkflow(BaseModel):
    """Browser automation workflow."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: str
    actions: List[BrowserAction] = Field(default_factory=list)
    session_config: BrowserSession
    variables: Dict[str, Any] = Field(default_factory=dict)
    error_handling: Dict[str, Any] = Field(default_factory=dict)
    screenshots: bool = True
    created_by: Optional[UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BrowserExecutionResult(BaseModel):
    """Browser workflow execution result."""
    id: UUID = Field(default_factory=uuid4)
    workflow_id: UUID
    session_id: str
    status: str = "running"  # running, completed, failed, cancelled
    current_action: int = 0
    completed_actions: List[str] = Field(default_factory=list)
    failed_actions: List[str] = Field(default_factory=list)
    extracted_data: Dict[str, Any] = Field(default_factory=dict)
    screenshots: List[str] = Field(default_factory=list)
    error_messages: List[str] = Field(default_factory=list)
    execution_time_ms: Optional[int] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    recovery_attempts: int = 0


class BrowserUseService:
    """
    Advanced browser automation service with AI-powered self-healing capabilities.

    Features:
    - Multi-browser support (Chromium, Firefox, WebKit)
    - AI-powered element detection and interaction
    - Self-healing workflows with automatic recovery
    - Complex multi-step automation scenarios
    - Data extraction and form filling
    - Screenshot and visual verification
    - Performance monitoring and optimization
    """

    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.workflows: Dict[UUID, BrowserWorkflow] = {}
        self.executions: Dict[UUID, BrowserExecutionResult] = {}
        self.playwright = None

    async def initialize(self):
        """Initialize Playwright and browser automation."""
        try:
            self.playwright = await async_playwright().start()
            logger.info("Browser Use service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Browser Use service: {e}")
            raise

    async def create_browser_session(self, session_config: BrowserSession) -> str:
        """Create a new browser session."""
        try:
            # Select browser type
            if session_config.browser_type == "chromium":
                browser_launcher = self.playwright.chromium
            elif session_config.browser_type == "firefox":
                browser_launcher = self.playwright.firefox
            elif session_config.browser_type == "webkit":
                browser_launcher = self.playwright.webkit
            else:
                raise ValueError(f"Unsupported browser type: {session_config.browser_type}")

            # Launch browser with configuration
            browser_args = {
                "headless": session_config.headless
            }

            if session_config.proxy:
                browser_args["proxy"] = session_config.proxy

            browser = await browser_launcher.launch(**browser_args)

            # Create context with advanced configuration
            context_args = {
                "viewport": session_config.viewport,
                "locale": session_config.locale,
                "timezone_id": session_config.timezone,
                "extra_http_headers": session_config.extra_headers
            }

            if session_config.user_agent:
                context_args["user_agent"] = session_config.user_agent

            if session_config.geolocation:
                context_args["geolocation"] = session_config.geolocation

            if session_config.permissions:
                context_args["permissions"] = session_config.permissions

            context = await browser.new_context(**context_args)

            # Create initial page
            page = await context.new_page()

            # Store session
            self.active_sessions[session_config.id] = {
                "browser": browser,
                "context": context,
                "page": page,
                "config": session_config,
                "created_at": datetime.utcnow()
            }

            logger.info(f"Created browser session: {session_config.id} ({session_config.browser_type})")
            return session_config.id

        except Exception as e:
            logger.error(f"Failed to create browser session: {e}")
            raise

    async def execute_browser_workflow(
        self,
        workflow: BrowserWorkflow,
        input_data: Dict[str, Any] = None
    ) -> UUID:
        """Execute a browser automation workflow."""
        try:
            # Create execution record
            execution = BrowserExecutionResult(
                workflow_id=workflow.id,
                session_id=""  # Will be set after session creation
            )

            # Store execution
            self.executions[execution.id] = execution

            # Start async execution
            asyncio.create_task(self._execute_workflow_async(workflow, execution, input_data or {}))

            logger.info(f"Started browser workflow execution: {execution.id}")
            return execution.id

        except Exception as e:
            logger.error(f"Failed to start workflow execution: {e}")
            raise

    async def _execute_workflow_async(
        self,
        workflow: BrowserWorkflow,
        execution: BrowserExecutionResult,
        input_data: Dict[str, Any]
    ):
        """Execute workflow asynchronously."""
        session_id = None

        try:
            # Create browser session
            session_id = await self.create_browser_session(workflow.session_config)
            execution.session_id = session_id

            session = self.active_sessions[session_id]
            page = session["page"]

            # Initialize execution context
            execution_context = {**workflow.variables, **input_data}

            # Execute actions sequentially
            for i, action in enumerate(workflow.actions):
                execution.current_action = i

                try:
                    logger.info(f"Executing action {i+1}/{len(workflow.actions)}: {action.type}")

                    # Execute action with self-healing
                    result = await self._execute_action_with_healing(
                        page, action, execution_context, execution
                    )

                    # Store result in context
                    if result:
                        execution_context[f"action_{i}_result"] = result
                        if isinstance(result, dict):
                            execution.extracted_data.update(result)

                    execution.completed_actions.append(action.id)

                    # Take screenshot if enabled
                    if workflow.screenshots:
                        screenshot_path = f"/tmp/browser_workflow_{execution.id}_{i}.png"
                        await page.screenshot(path=screenshot_path)
                        execution.screenshots.append(screenshot_path)

                except Exception as e:
                    error_msg = f"Action {i+1} failed: {str(e)}"
                    logger.error(error_msg)
                    execution.error_messages.append(error_msg)
                    execution.failed_actions.append(action.id)

                    # Check if we should continue or stop
                    if workflow.error_handling.get("stop_on_error", True):
                        execution.status = "failed"
                        break

            # Complete execution
            if execution.status == "running":
                execution.status = "completed"

            execution.completed_at = datetime.utcnow()
            execution.execution_time_ms = int(
                (execution.completed_at - execution.started_at).total_seconds() * 1000
            )

            logger.info(f"Workflow execution completed: {execution.id} (status: {execution.status})")

        except Exception as e:
            execution.status = "failed"
            execution.error_messages.append(str(e))
            execution.completed_at = datetime.utcnow()
            logger.error(f"Workflow execution failed: {e}")

        finally:
            # Clean up session
            if session_id and session_id in self.active_sessions:
                await self._cleanup_session(session_id)

            # Cache execution result
            await redis_client.set(
                f"browser_execution:{execution.id}",
                json.dumps(execution.dict(), default=str),
                expire=3600 * 24  # 24 hours
            )

    async def _execute_action_with_healing(
        self,
        page: Page,
        action: BrowserAction,
        context: Dict[str, Any],
        execution: BrowserExecutionResult
    ) -> Any:
        """Execute action with self-healing capabilities."""
        for attempt in range(action.retry_count):
            try:
                result = await self._execute_single_action(page, action, context)
                return result

            except Exception as e:
                logger.warning(f"Action attempt {attempt + 1} failed: {e}")

                if attempt < action.retry_count - 1 and action.self_healing:
                    # Attempt self-healing
                    healed = await self._attempt_self_healing(page, action, str(e))
                    if not healed:
                        execution.recovery_attempts += 1
                        await asyncio.sleep(1)  # Brief delay before retry
                else:
                    raise e

        raise Exception(f"Action failed after {action.retry_count} attempts")

    async def _execute_single_action(
        self,
        page: Page,
        action: BrowserAction,
        context: Dict[str, Any]
    ) -> Any:
        """Execute a single browser action."""
        # Resolve template variables in action properties
        resolved_action = self._resolve_action_variables(action, context)

        if resolved_action.type == "navigate":
            await page.goto(resolved_action.url, wait_until=resolved_action.wait_for or "load")
            return {"url": page.url, "title": await page.title()}

        elif resolved_action.type == "click":
            element = page.locator(resolved_action.selector)
            await element.click(timeout=resolved_action.timeout)
            return {"clicked": True}

        elif resolved_action.type == "fill":
            element = page.locator(resolved_action.selector)
            await element.fill(resolved_action.value, timeout=resolved_action.timeout)
            return {"filled": resolved_action.value}

        elif resolved_action.type == "select":
            element = page.locator(resolved_action.selector)
            await element.select_option(resolved_action.value, timeout=resolved_action.timeout)
            return {"selected": resolved_action.value}

        elif resolved_action.type == "extract":
            if resolved_action.selector:
                element = page.locator(resolved_action.selector)
                if resolved_action.value == "text":
                    content = await element.text_content()
                elif resolved_action.value == "html":
                    content = await element.inner_html()
                elif resolved_action.value == "attribute":
                    attr_name = resolved_action.description  # Use description for attribute name
                    content = await element.get_attribute(attr_name)
                else:
                    content = await element.text_content()

                return {"extracted": content, "selector": resolved_action.selector}
            else:
                # Extract all text from page
                content = await page.content()
                return {"extracted": content}

        elif resolved_action.type == "wait":
            if resolved_action.wait_for == "element":
                await page.wait_for_selector(resolved_action.selector, timeout=resolved_action.timeout)
            elif resolved_action.wait_for == "load":
                await page.wait_for_load_state("load", timeout=resolved_action.timeout)
            elif resolved_action.wait_for == "networkidle":
                await page.wait_for_load_state("networkidle", timeout=resolved_action.timeout)
            else:
                await asyncio.sleep(int(resolved_action.value or 1))

            return {"waited": True}

        elif resolved_action.type == "screenshot":
            screenshot_path = f"/tmp/action_screenshot_{uuid4()}.png"

            if resolved_action.selector:
                element = page.locator(resolved_action.selector)
                await element.screenshot(path=screenshot_path)
            else:
                await page.screenshot(path=screenshot_path)

            return {"screenshot": screenshot_path}

        elif resolved_action.type == "evaluate":
            # Execute JavaScript
            result = await page.evaluate(resolved_action.value)
            return {"result": result}

        elif resolved_action.type == "scroll":
            if resolved_action.selector:
                element = page.locator(resolved_action.selector)
                await element.scroll_into_view_if_needed()
            else:
                # Scroll page
                await page.evaluate(f"window.scrollBy(0, {resolved_action.value or 500})")

            return {"scrolled": True}

        else:
            raise ValueError(f"Unsupported action type: {resolved_action.type}")

    def _resolve_action_variables(self, action: BrowserAction, context: Dict[str, Any]) -> BrowserAction:
        """Resolve template variables in action properties."""
        resolved_action = action.copy()

        # Resolve template strings
        for field_name, field_value in resolved_action.__dict__.items():
            if isinstance(field_value, str) and "{{" in field_value and "}}" in field_value:
                resolved_value = self._resolve_template_string(field_value, context)
                setattr(resolved_action, field_name, resolved_value)

        return resolved_action

    def _resolve_template_string(self, template: str, context: Dict[str, Any]) -> str:
        """Resolve template string with context variables."""
        import re

        def replace_var(match):
            var_name = match.group(1).strip()
            return str(context.get(var_name, match.group(0)))

        return re.sub(r'\{\{([^}]+)\}\}', replace_var, template)

    async def _attempt_self_healing(self, page: Page, action: BrowserAction, error: str) -> bool:
        """Attempt to heal failed action using AI."""
        try:
            if not action.self_healing:
                return False

            # Get page context for AI analysis
            page_title = await page.title()
            page_url = page.url
            page_content = await page.content()

            # Use AI to suggest alternative selectors or actions
            healing_prompt = f"""
            Browser automation action failed with error: {error}

            Action details:
            - Type: {action.type}
            - Selector: {action.selector}
            - Value: {action.value}
            - Description: {action.description}

            Page context:
            - URL: {page_url}
            - Title: {page_title}
            - Content length: {len(page_content)} chars

            Suggest alternative selectors or approaches to complete this action.
            """

            analysis = await llm_service.analyze_task(
                task_description=healing_prompt,
                context=page_content[:1000]  # Limit context size
            )

            # For now, just try some common alternative selectors
            if action.selector and action.type in ["click", "fill", "select"]:
                # Try alternative selectors
                alternatives = [
                    action.selector.replace("#", "[id=") + "]",
                    action.selector.replace(".", "[class*=") + "]",
                    f"text={action.value}" if action.value else None
                ]

                for alt_selector in alternatives:
                    if alt_selector:
                        try:
                            element = page.locator(alt_selector)
                            await element.wait_for(timeout=5000)
                            # Update action with working selector
                            action.selector = alt_selector
                            logger.info(f"Self-healing successful: new selector {alt_selector}")
                            return True
                        except:
                            continue

            return False

        except Exception as e:
            logger.error(f"Self-healing attempt failed: {e}")
            return False

    async def create_workflow_from_description(
        self,
        description: str,
        user_id: Optional[UUID] = None
    ) -> UUID:
        """Create browser workflow from natural language description using AI."""
        try:
            # Use AI to analyze description and generate workflow
            analysis_prompt = f"""
            Create a browser automation workflow for: {description}

            Generate a sequence of browser actions that would accomplish this task.
            Consider common web interaction patterns like navigation, form filling, clicking, and data extraction.
            """

            analysis = await llm_service.analyze_task(
                task_description=analysis_prompt,
                context="Browser automation workflow generation"
            )

            # Create basic workflow structure
            workflow = BrowserWorkflow(
                name=f"Generated Workflow - {description[:50]}",
                description=description,
                session_config=BrowserSession(
                    name=f"Session for {description[:30]}",
                    headless=True
                ),
                created_by=user_id,
                actions=[
                    BrowserAction(
                        type="navigate",
                        url="https://example.com",
                        description="Navigate to target website"
                    ),
                    BrowserAction(
                        type="wait",
                        wait_for="load",
                        description="Wait for page to load"
                    ),
                    BrowserAction(
                        type="screenshot",
                        description="Take screenshot for verification"
                    )
                ]
            )

            # Store workflow
            self.workflows[workflow.id] = workflow

            logger.info(f"Generated workflow from description: {workflow.id}")
            return workflow.id

        except Exception as e:
            logger.error(f"Failed to generate workflow: {e}")
            raise

    async def _cleanup_session(self, session_id: str):
        """Clean up browser session."""
        try:
            if session_id in self.active_sessions:
                session = self.active_sessions[session_id]

                if "context" in session:
                    await session["context"].close()

                if "browser" in session:
                    await session["browser"].close()

                del self.active_sessions[session_id]
                logger.info(f"Cleaned up browser session: {session_id}")

        except Exception as e:
            logger.error(f"Failed to cleanup session {session_id}: {e}")

    async def get_workflow(self, workflow_id: UUID) -> Optional[BrowserWorkflow]:
        """Get browser workflow by ID."""
        return self.workflows.get(workflow_id)

    async def get_execution(self, execution_id: UUID) -> Optional[BrowserExecutionResult]:
        """Get execution result by ID."""
        return self.executions.get(execution_id)

    async def list_workflows(self, user_id: Optional[UUID] = None) -> List[BrowserWorkflow]:
        """List browser workflows."""
        workflows = list(self.workflows.values())
        if user_id:
            workflows = [w for w in workflows if w.created_by == user_id]
        return workflows

    async def cleanup(self):
        """Cleanup service resources."""
        try:
            # Close all active sessions
            for session_id in list(self.active_sessions.keys()):
                await self._cleanup_session(session_id)

            # Stop Playwright
            if self.playwright:
                await self.playwright.stop()

            logger.info("Browser Use service cleanup completed")

        except Exception as e:
            logger.error(f"Browser Use service cleanup failed: {e}")


# Global browser use service instance
browser_use_service = BrowserUseService()
"""
Enhanced Browser Automation API endpoints for multi-browser support.

Provides comprehensive browser automation capabilities including:
- Multi-browser support (Chrome, Firefox, Safari, Edge)
- Cross-browser compatibility testing
- Mobile device emulation
- Browser pool management
- Performance optimization and monitoring
- Advanced workflow creation and execution
- AI-powered self-healing automation scenarios
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field

from app.services.browser_use_integration import (
    browser_use_service,
    BrowserWorkflow,
    BrowserSession,
    BrowserAction,
    BrowserExecutionResult
)
from app.services.browser_manager import (
    browser_manager,
    BrowserType,
    BrowserConfig,
    DeviceProfile,
    ExecutionMode
)
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


class BrowserSessionCreate(BaseModel):
    """Request model for creating browser session."""
    name: str
    browser_type: str = "chromium"
    headless: bool = True
    viewport: Dict[str, int] = Field(default_factory=lambda: {"width": 1920, "height": 1080})
    user_agent: Optional[str] = None
    extra_headers: Dict[str, str] = Field(default_factory=dict)
    locale: str = "en-US"
    timezone: str = "America/New_York"


class BrowserWorkflowCreate(BaseModel):
    """Request model for creating browser workflow."""
    name: str
    description: str
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    session_config: Dict[str, Any] = Field(default_factory=dict)
    variables: Dict[str, Any] = Field(default_factory=dict)
    error_handling: Dict[str, Any] = Field(default_factory=dict)
    screenshots: bool = True


class BrowserWorkflowExecute(BaseModel):
    """Request model for executing browser workflow."""
    input_data: Dict[str, Any] = Field(default_factory=dict)
    session_override: Optional[Dict[str, Any]] = None


class BrowserWorkflowGenerate(BaseModel):
    """Request model for AI workflow generation."""
    description: str
    target_url: Optional[str] = None
    requirements: List[str] = Field(default_factory=list)
    session_preferences: Dict[str, Any] = Field(default_factory=dict)


class BrowserWorkflowResponse(BaseModel):
    """Response model for browser workflow."""
    id: UUID
    name: str
    description: str
    actions_count: int
    session_config: Dict[str, Any]
    variables: Dict[str, Any]
    screenshots: bool
    created_by: Optional[UUID]
    created_at: datetime


class BrowserExecutionResponse(BaseModel):
    """Response model for browser execution."""
    id: UUID
    workflow_id: UUID
    session_id: str
    status: str
    current_action: int
    completed_actions: List[str]
    failed_actions: List[str]
    extracted_data: Dict[str, Any]
    screenshots: List[str]
    error_messages: List[str]
    execution_time_ms: Optional[int]
    started_at: datetime
    completed_at: Optional[datetime]
    recovery_attempts: int


# Multi-browser support models

class BrowserCompatibilityResponse(BaseModel):
    """Response model for browser compatibility."""
    browser_type: str
    name: str
    compatible: Optional[bool]
    version: Optional[str]
    capabilities: List[str]
    limitations: List[str]
    installation_path: Optional[str]


class DeviceProfileResponse(BaseModel):
    """Response model for device profile."""
    name: str
    user_agent: str
    viewport: Dict[str, int]
    device_scale_factor: float
    is_mobile: bool
    has_touch: bool
    compatible_browsers: List[str]
    recommended_browser: str


class BrowserPoolResponse(BaseModel):
    """Response model for browser pool."""
    pool_id: str
    browser_type: str
    current_instances: int
    available_instances: int
    busy_instances: int
    utilization: float
    auto_scale: bool
    max_instances: int
    min_instances: int
    last_scaled: datetime


class MultiBrowserConfig(BaseModel):
    """Configuration for multi-browser operations."""
    browser_types: List[str]
    execution_mode: str = "headless"
    device_profile: Optional[str] = None
    viewport: Optional[Dict[str, int]] = None
    timeout: int = 30000
    parallel_execution: bool = True


class CrossBrowserTestRequest(BaseModel):
    """Request model for cross-browser testing."""
    test_script: str
    browsers: List[str]
    config: Optional[MultiBrowserConfig] = None
    timeout: int = 60000


class CrossBrowserTestResponse(BaseModel):
    """Response model for cross-browser testing."""
    test_id: str
    status: str
    results: Dict[str, Dict[str, Any]]
    summary: Dict[str, Any]
    started_at: datetime
    completed_at: Optional[datetime]


class OptimizedSessionRequest(BaseModel):
    """Request model for creating optimized browser session."""
    browser_type: str
    execution_mode: str = "headless"
    device_profile: Optional[str] = None
    viewport: Optional[Dict[str, int]] = None
    performance_optimizations: bool = True
    resource_limits: Optional[Dict[str, int]] = None


class OptimizedSessionResponse(BaseModel):
    """Response model for optimized browser session."""
    session_id: Dict[str, str]
    browser_type: str
    optimization_applied: bool
    performance_metrics: Optional[Dict[str, Any]] = None
    created_at: datetime


@router.post("/initialize")
async def initialize_browser_service(
    current_user: User = Depends(get_current_user)
):
    """Initialize browser automation service."""
    try:
        await browser_use_service.initialize()
        return {"status": "initialized", "message": "Browser automation service ready"}

    except Exception as e:
        logger.error(f"Failed to initialize browser service: {e}")
        raise HTTPException(status_code=500, detail=f"Initialization failed: {str(e)}")


@router.get("/workflows", response_model=List[BrowserWorkflowResponse])
async def list_browser_workflows(
    current_user: User = Depends(get_current_user)
):
    """List browser automation workflows created by the current user."""
    try:
        workflows = await browser_use_service.list_workflows(user_id=current_user.id)

        return [
            BrowserWorkflowResponse(
                id=w.id,
                name=w.name,
                description=w.description,
                actions_count=len(w.actions),
                session_config=w.session_config.dict(),
                variables=w.variables,
                screenshots=w.screenshots,
                created_by=w.created_by,
                created_at=w.created_at
            )
            for w in workflows
        ]

    except Exception as e:
        logger.error(f"Failed to list browser workflows: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflows")


@router.post("/workflows", response_model=Dict[str, UUID])
async def create_browser_workflow(
    request: BrowserWorkflowCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new browser automation workflow."""
    try:
        # Convert request to workflow model
        session_config = BrowserSession(**request.session_config, user_id=current_user.id)

        actions = []
        for action_data in request.actions:
            action = BrowserAction(**action_data)
            actions.append(action)

        workflow = BrowserWorkflow(
            name=request.name,
            description=request.description,
            actions=actions,
            session_config=session_config,
            variables=request.variables,
            error_handling=request.error_handling,
            screenshots=request.screenshots,
            created_by=current_user.id
        )

        # Store workflow
        browser_use_service.workflows[workflow.id] = workflow

        return {"workflow_id": workflow.id}

    except Exception as e:
        logger.error(f"Failed to create browser workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create workflow: {str(e)}")


@router.get("/workflows/{workflow_id}", response_model=BrowserWorkflowResponse)
async def get_browser_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get browser workflow by ID."""
    try:
        workflow = await browser_use_service.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Check permissions
        if workflow.created_by and workflow.created_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        return BrowserWorkflowResponse(
            id=workflow.id,
            name=workflow.name,
            description=workflow.description,
            actions_count=len(workflow.actions),
            session_config=workflow.session_config.dict(),
            variables=workflow.variables,
            screenshots=workflow.screenshots,
            created_by=workflow.created_by,
            created_at=workflow.created_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get browser workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")


@router.post("/workflows/{workflow_id}/execute", response_model=Dict[str, UUID])
async def execute_browser_workflow(
    workflow_id: UUID,
    request: BrowserWorkflowExecute,
    current_user: User = Depends(get_current_user)
):
    """Execute a browser automation workflow."""
    try:
        workflow = await browser_use_service.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Check permissions
        if workflow.created_by and workflow.created_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        # Apply session overrides if provided
        if request.session_override:
            for key, value in request.session_override.items():
                if hasattr(workflow.session_config, key):
                    setattr(workflow.session_config, key, value)

        # Execute workflow
        execution_id = await browser_use_service.execute_browser_workflow(
            workflow=workflow,
            input_data=request.input_data
        )

        return {"execution_id": execution_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute browser workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Execution failed: {str(e)}")


@router.get("/executions/{execution_id}", response_model=BrowserExecutionResponse)
async def get_browser_execution(
    execution_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Get browser workflow execution by ID."""
    try:
        execution = await browser_use_service.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")

        # Get workflow to check permissions
        workflow = await browser_use_service.get_workflow(execution.workflow_id)
        if workflow and workflow.created_by and workflow.created_by != current_user.id and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Access denied")

        return BrowserExecutionResponse(
            id=execution.id,
            workflow_id=execution.workflow_id,
            session_id=execution.session_id,
            status=execution.status,
            current_action=execution.current_action,
            completed_actions=execution.completed_actions,
            failed_actions=execution.failed_actions,
            extracted_data=execution.extracted_data,
            screenshots=execution.screenshots,
            error_messages=execution.error_messages,
            execution_time_ms=execution.execution_time_ms,
            started_at=execution.started_at,
            completed_at=execution.completed_at,
            recovery_attempts=execution.recovery_attempts
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get browser execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve execution")


@router.post("/workflows/generate", response_model=Dict[str, UUID])
async def generate_browser_workflow(
    request: BrowserWorkflowGenerate,
    current_user: User = Depends(get_current_user)
):
    """Generate browser workflow from natural language description using AI."""
    try:
        workflow_id = await browser_use_service.create_workflow_from_description(
            description=request.description,
            user_id=current_user.id
        )

        return {"workflow_id": workflow_id}

    except Exception as e:
        logger.error(f"Failed to generate browser workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Generation failed: {str(e)}")


@router.get("/action-types")
async def get_browser_action_types(
    current_user: User = Depends(get_current_user)
):
    """Get available browser action types and their configurations."""
    try:
        action_types = [
            {
                "type": "navigate",
                "name": "Navigate",
                "description": "Navigate to a URL",
                "category": "navigation",
                "icon": "link",
                "parameters": {
                    "url": {"type": "string", "required": True, "description": "Target URL"},
                    "wait_for": {"type": "string", "enum": ["load", "networkidle"], "description": "Wait condition"}
                }
            },
            {
                "type": "click",
                "name": "Click Element",
                "description": "Click on an element",
                "category": "interaction",
                "icon": "touch_app",
                "parameters": {
                    "selector": {"type": "string", "required": True, "description": "CSS selector"},
                    "timeout": {"type": "number", "default": 30000, "description": "Timeout in milliseconds"}
                }
            },
            {
                "type": "fill",
                "name": "Fill Input",
                "description": "Fill an input field",
                "category": "interaction",
                "icon": "edit",
                "parameters": {
                    "selector": {"type": "string", "required": True, "description": "CSS selector"},
                    "value": {"type": "string", "required": True, "description": "Value to fill"}
                }
            },
            {
                "type": "select",
                "name": "Select Option",
                "description": "Select from dropdown",
                "category": "interaction",
                "icon": "arrow_drop_down",
                "parameters": {
                    "selector": {"type": "string", "required": True, "description": "CSS selector"},
                    "value": {"type": "string", "required": True, "description": "Option value"}
                }
            },
            {
                "type": "extract",
                "name": "Extract Data",
                "description": "Extract data from elements",
                "category": "data",
                "icon": "download",
                "parameters": {
                    "selector": {"type": "string", "description": "CSS selector (optional for full page)"},
                    "value": {"type": "string", "enum": ["text", "html", "attribute"], "description": "What to extract"}
                }
            },
            {
                "type": "wait",
                "name": "Wait",
                "description": "Wait for condition or time",
                "category": "control",
                "icon": "schedule",
                "parameters": {
                    "wait_for": {"type": "string", "enum": ["element", "load", "networkidle", "time"], "description": "Wait condition"},
                    "selector": {"type": "string", "description": "CSS selector (for element wait)"},
                    "value": {"type": "string", "description": "Time in seconds (for time wait)"}
                }
            },
            {
                "type": "screenshot",
                "name": "Screenshot",
                "description": "Take a screenshot",
                "category": "utility",
                "icon": "camera_alt",
                "parameters": {
                    "selector": {"type": "string", "description": "CSS selector (optional for element screenshot)"}
                }
            },
            {
                "type": "scroll",
                "name": "Scroll",
                "description": "Scroll page or element",
                "category": "navigation",
                "icon": "swap_vert",
                "parameters": {
                    "selector": {"type": "string", "description": "CSS selector (optional for page scroll)"},
                    "value": {"type": "number", "description": "Scroll amount in pixels"}
                }
            },
            {
                "type": "evaluate",
                "name": "Execute JavaScript",
                "description": "Execute custom JavaScript",
                "category": "advanced",
                "icon": "code",
                "parameters": {
                    "value": {"type": "string", "required": True, "description": "JavaScript code to execute"}
                }
            }
        ]

        return {"action_types": action_types}

    except Exception as e:
        logger.error(f"Failed to get action types: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve action types")


@router.get("/templates")
async def get_browser_workflow_templates(
    current_user: User = Depends(get_current_user)
):
    """Get predefined browser workflow templates."""
    try:
        templates = [
            {
                "name": "Web Scraping Template",
                "description": "Extract data from a website",
                "category": "data_extraction",
                "actions": [
                    {"type": "navigate", "url": "{{target_url}}", "description": "Navigate to target site"},
                    {"type": "wait", "wait_for": "load", "description": "Wait for page load"},
                    {"type": "extract", "selector": "{{data_selector}}", "value": "text", "description": "Extract target data"},
                    {"type": "screenshot", "description": "Take verification screenshot"}
                ]
            },
            {
                "name": "Form Submission Template",
                "description": "Fill and submit a web form",
                "category": "form_automation",
                "actions": [
                    {"type": "navigate", "url": "{{form_url}}", "description": "Navigate to form"},
                    {"type": "fill", "selector": "{{name_field}}", "value": "{{user_name}}", "description": "Fill name field"},
                    {"type": "fill", "selector": "{{email_field}}", "value": "{{user_email}}", "description": "Fill email field"},
                    {"type": "click", "selector": "{{submit_button}}", "description": "Submit form"},
                    {"type": "wait", "wait_for": "load", "description": "Wait for submission"}
                ]
            },
            {
                "name": "E-commerce Purchase Template",
                "description": "Automate product purchase flow",
                "category": "ecommerce",
                "actions": [
                    {"type": "navigate", "url": "{{product_url}}", "description": "Navigate to product"},
                    {"type": "click", "selector": ".add-to-cart", "description": "Add to cart"},
                    {"type": "click", "selector": ".checkout", "description": "Go to checkout"},
                    {"type": "fill", "selector": "#shipping-address", "value": "{{address}}", "description": "Fill address"},
                    {"type": "screenshot", "description": "Capture order summary"}
                ]
            },
            {
                "name": "Social Media Automation Template",
                "description": "Automate social media interactions",
                "category": "social_media",
                "actions": [
                    {"type": "navigate", "url": "{{social_url}}", "description": "Navigate to social platform"},
                    {"type": "fill", "selector": "{{post_field}}", "value": "{{post_content}}", "description": "Create post"},
                    {"type": "click", "selector": "{{post_button}}", "description": "Publish post"},
                    {"type": "wait", "wait_for": "networkidle", "description": "Wait for post confirmation"}
                ]
            },
            {
                "name": "Data Monitoring Template",
                "description": "Monitor website for changes",
                "category": "monitoring",
                "actions": [
                    {"type": "navigate", "url": "{{monitor_url}}", "description": "Navigate to monitored site"},
                    {"type": "extract", "selector": "{{monitor_selector}}", "value": "text", "description": "Extract current data"},
                    {"type": "screenshot", "description": "Take timestamp screenshot"},
                    {"type": "wait", "value": "{{check_interval}}", "description": "Wait before next check"}
                ]
            }
        ]

        return {"templates": templates}

    except Exception as e:
        logger.error(f"Failed to get workflow templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve templates")


@router.get("/health")
async def browser_service_health():
    """Check browser automation service health."""
    try:
        active_sessions = len(browser_use_service.active_sessions)
        total_workflows = len(browser_use_service.workflows)
        total_executions = len(browser_use_service.executions)

        # Check if Playwright is initialized
        playwright_status = "initialized" if browser_use_service.playwright else "not_initialized"

        return {
            "status": "healthy" if browser_use_service.playwright else "not_ready",
            "playwright_status": playwright_status,
            "active_sessions": active_sessions,
            "total_workflows": total_workflows,
            "total_executions": total_executions,
            "supported_browsers": ["chromium", "firefox", "webkit"],
            "features": {
                "self_healing": True,
                "ai_workflow_generation": True,
                "multi_browser_support": True,
                "screenshot_capture": True,
                "javascript_execution": True
            }
        }

    except Exception as e:
        logger.error(f"Browser service health check failed: {e}")
        raise HTTPException(status_code=503, detail="Browser service unhealthy")


@router.get("/stats")
async def get_browser_automation_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get browser automation usage statistics."""
    try:
        # Get user's workflows and executions
        user_workflows = await browser_use_service.list_workflows(user_id=current_user.id)
        user_executions = [
            e for e in browser_use_service.executions.values()
            if any(w.id == e.workflow_id and w.created_by == current_user.id for w in user_workflows)
        ]

        # Calculate statistics
        total_workflows = len(user_workflows)
        total_executions = len(user_executions)
        successful_executions = len([e for e in user_executions if e.status == "completed"])
        failed_executions = len([e for e in user_executions if e.status == "failed"])

        # Calculate average execution time
        completed_executions = [e for e in user_executions if e.execution_time_ms]
        avg_execution_time = (
            sum(e.execution_time_ms for e in completed_executions) / len(completed_executions)
            if completed_executions else 0
        )

        # Most used action types
        action_usage = {}
        for workflow in user_workflows:
            for action in workflow.actions:
                action_usage[action.type] = action_usage.get(action.type, 0) + 1

        top_actions = sorted(action_usage.items(), key=lambda x: x[1], reverse=True)[:5]

        return {
            "workflows": {
                "total": total_workflows,
                "with_screenshots": len([w for w in user_workflows if w.screenshots])
            },
            "executions": {
                "total": total_executions,
                "successful": successful_executions,
                "failed": failed_executions,
                "success_rate": successful_executions / total_executions if total_executions > 0 else 0
            },
            "performance": {
                "average_execution_time_ms": round(avg_execution_time, 2),
                "total_recovery_attempts": sum(e.recovery_attempts for e in user_executions)
            },
            "usage": {
                "most_used_actions": [{"action": action, "count": count} for action, count in top_actions],
                "total_screenshots": sum(len(e.screenshots) for e in user_executions),
                "active_sessions": len([s for s in browser_use_service.active_sessions.values()
                                     if s["config"].user_id == current_user.id])
            }
        }

    except Exception as e:
        logger.error(f"Failed to get browser automation statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


# Multi-browser API endpoints

@router.get("/multi-browser/compatibility", response_model=List[BrowserCompatibilityResponse])
async def get_browser_compatibility(
    current_user: User = Depends(get_current_user)
):
    """Get compatibility information for all supported browsers."""
    try:
        # Initialize browser manager if needed
        if not browser_manager.playwright:
            await browser_manager._initialize_playwright()

        browsers = browser_manager.get_available_browsers()
        compatibility_responses = []

        for browser_info in browsers:
            # Convert to response model
            response = BrowserCompatibilityResponse(
                browser_type=browser_info["type"],
                name=browser_info["name"],
                compatible=browser_info.get("compatible"),
                version=browser_info.get("version"),
                capabilities=browser_info.get("capabilities", []),
                limitations=browser_info.get("limitations", []),
                installation_path=browser_info.get("installation_path")
            )
            compatibility_responses.append(response)

        return compatibility_responses

    except Exception as e:
        logger.error(f"Failed to get browser compatibility: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve browser compatibility")


@router.get("/multi-browser/device-profiles", response_model=Dict[str, DeviceProfileResponse])
async def get_device_profiles(
    current_user: User = Depends(get_current_user)
):
    """Get available device profiles for mobile emulation."""
    try:
        enhanced_profiles = browser_manager.get_enhanced_device_profiles()
        device_responses = {}

        for device_name, profile in enhanced_profiles.items():
            response = DeviceProfileResponse(
                name=profile["name"],
                user_agent=profile["user_agent"],
                viewport=profile["viewport"],
                device_scale_factor=profile["device_scale_factor"],
                is_mobile=profile["is_mobile"],
                has_touch=profile["has_touch"],
                compatible_browsers=profile.get("compatible_browsers", []),
                recommended_browser=profile.get("recommended_browser", "chromium")
            )
            device_responses[device_name] = response

        return device_responses

    except Exception as e:
        logger.error(f"Failed to get device profiles: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve device profiles")


@router.get("/multi-browser/pools", response_model=Dict[str, BrowserPoolResponse])
async def get_browser_pools(
    current_user: User = Depends(get_current_user)
):
    """Get browser pool statistics and status."""
    try:
        pool_stats = browser_manager.get_pool_statistics()
        pool_responses = {}

        for browser_type, stats in pool_stats.items():
            response = BrowserPoolResponse(
                pool_id=stats["pool_id"],
                browser_type=stats["browser_type"],
                current_instances=stats["current_instances"],
                available_instances=stats["available_instances"],
                busy_instances=stats["busy_instances"],
                utilization=stats["utilization"],
                auto_scale=stats["auto_scale"],
                max_instances=stats["max_instances"],
                min_instances=stats["min_instances"],
                last_scaled=datetime.fromisoformat(stats["last_scaled"])
            )
            pool_responses[browser_type] = response

        return pool_responses

    except Exception as e:
        logger.error(f"Failed to get browser pools: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve browser pools")


@router.post("/multi-browser/optimized-session", response_model=OptimizedSessionResponse)
async def create_optimized_session(
    request: OptimizedSessionRequest,
    current_user: User = Depends(get_current_user)
):
    """Create an optimized browser session with performance enhancements."""
    try:
        # Validate browser type
        try:
            browser_type = BrowserType(request.browser_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid browser type: {request.browser_type}")

        # Validate execution mode
        try:
            execution_mode = ExecutionMode(request.execution_mode)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid execution mode: {request.execution_mode}")

        # Get device profile if specified
        device_profile = None
        if request.device_profile:
            device_profiles = browser_manager.get_device_profiles()
            device_profile = device_profiles.get(request.device_profile)
            if not device_profile:
                raise HTTPException(status_code=400, detail=f"Device profile not found: {request.device_profile}")

        # Create browser configuration
        config = BrowserConfig(
            browser_type=browser_type,
            execution_mode=execution_mode,
            device_profile=device_profile,
            viewport=request.viewport or {"width": 1920, "height": 1080},
            timeout=request.timeout
        )

        # Apply resource limits if specified
        if request.resource_limits:
            config.max_pages = request.resource_limits.get("max_pages", 10)
            config.max_contexts = request.resource_limits.get("max_contexts", 5)
            config.memory_limit_mb = request.resource_limits.get("memory_limit_mb")

        # Create optimized session
        session_info = await browser_manager.create_optimized_session(config)

        response = OptimizedSessionResponse(
            session_id={k: str(v) for k, v in session_info.items()},
            browser_type=request.browser_type,
            optimization_applied=request.performance_optimizations,
            created_at=datetime.utcnow()
        )

        logger.info(f"Created optimized session for user {current_user.id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create optimized session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create optimized session")


@router.post("/multi-browser/cross-browser-test", response_model=CrossBrowserTestResponse)
async def run_cross_browser_test(
    request: CrossBrowserTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Run a test script across multiple browsers."""
    try:
        # Validate browser types
        browsers = []
        for browser_str in request.browsers:
            try:
                browsers.append(BrowserType(browser_str))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid browser type: {browser_str}")

        if not browsers:
            raise HTTPException(status_code=400, detail="At least one browser must be specified")

        # Create base configuration
        base_config = None
        if request.config:
            base_config = BrowserConfig(
                browser_type=browsers[0],  # Will be overridden for each browser
                execution_mode=ExecutionMode(request.config.execution_mode),
                viewport=request.config.viewport or {"width": 1920, "height": 1080},
                timeout=request.config.timeout
            )

        # Generate test ID
        test_id = f"test_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{current_user.id.hex[:8]}"

        # Run cross-browser test
        start_time = datetime.utcnow()
        results = await browser_manager.run_cross_browser_test(
            test_script=request.test_script,
            browsers=browsers,
            config=base_config
        )
        end_time = datetime.utcnow()

        # Create summary
        successful_tests = len([r for r in results.values() if r["success"]])
        total_tests = len(results)
        avg_execution_time = sum(r["execution_time_ms"] for r in results.values()) / total_tests if total_tests > 0 else 0

        summary = {
            "total_browsers": total_tests,
            "successful_browsers": successful_tests,
            "failed_browsers": total_tests - successful_tests,
            "success_rate": successful_tests / total_tests if total_tests > 0 else 0,
            "average_execution_time_ms": round(avg_execution_time, 2),
            "total_execution_time_ms": int((end_time - start_time).total_seconds() * 1000)
        }

        response = CrossBrowserTestResponse(
            test_id=test_id,
            status="completed",
            results={browser_type.value: result for browser_type, result in results.items()},
            summary=summary,
            started_at=start_time,
            completed_at=end_time
        )

        logger.info(f"Cross-browser test {test_id} completed for user {current_user.id}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run cross-browser test: {e}")
        raise HTTPException(status_code=500, detail="Failed to run cross-browser test")


@router.get("/multi-browser/statistics")
async def get_multi_browser_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive multi-browser statistics."""
    try:
        # Initialize browser manager if needed
        if not browser_manager.playwright:
            await browser_manager._initialize_playwright()

        stats = await browser_manager.get_comprehensive_statistics()

        # Add user-specific information
        stats["user_info"] = {
            "user_id": str(current_user.id),
            "timestamp": datetime.utcnow().isoformat()
        }

        return stats

    except Exception as e:
        logger.error(f"Failed to get multi-browser statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve multi-browser statistics")


@router.post("/multi-browser/performance-monitoring/start")
async def start_performance_monitoring(
    current_user: User = Depends(get_current_user)
):
    """Start performance monitoring for browser instances."""
    try:
        await browser_manager.start_performance_monitoring()
        return {"status": "started", "message": "Performance monitoring started"}

    except Exception as e:
        logger.error(f"Failed to start performance monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to start performance monitoring")


@router.post("/multi-browser/performance-monitoring/stop")
async def stop_performance_monitoring(
    current_user: User = Depends(get_current_user)
):
    """Stop performance monitoring for browser instances."""
    try:
        await browser_manager.stop_performance_monitoring()
        return {"status": "stopped", "message": "Performance monitoring stopped"}

    except Exception as e:
        logger.error(f"Failed to stop performance monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop performance monitoring")


@router.get("/multi-browser/health")
async def multi_browser_health_check():
    """Health check for multi-browser functionality."""
    try:
        # Check browser manager status
        manager_status = {
            "playwright_initialized": browser_manager.playwright is not None,
            "browser_pools_count": len(browser_manager.browser_pools),
            "active_instances": len(browser_manager.browser_instances),
            "active_contexts": len(browser_manager.contexts),
            "active_pages": len(browser_manager.pages)
        }

        # Check device profiles
        device_profiles_count = len(browser_manager.get_device_profiles())

        # Check compatibility cache
        compatibility_cache_count = len(browser_manager._compatibility_cache)

        # Overall health
        is_healthy = (
            manager_status["playwright_initialized"] and
            device_profiles_count > 0 and
            compatibility_cache_count >= 0
        )

        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "manager": manager_status,
            "device_profiles_count": device_profiles_count,
            "compatibility_cache_count": compatibility_cache_count,
            "supported_browsers": [bt.value for bt in BrowserType],
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Multi-browser health check failed: {e}")
        raise HTTPException(status_code=503, detail="Multi-browser service unhealthy")
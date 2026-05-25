"""
Advanced Browser Features API endpoints.

This module provides REST API endpoints for advanced browser capabilities including:
- Browser extensions and plugins management
- Network interception and modification
- Advanced screenshot and recording features
- Cookie and session management automation
- Proxy and VPN automation support
- Advanced performance monitoring and profiling
- Browser fingerprinting and privacy features
"""

import logging
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.services.advanced_browser_features import (
    advanced_browser_features_service,
    BrowserExtension,
    NetworkRule,
    ScreenshotConfig,
    RecordingConfig,
    ProxyConfig,
    CookieConfig,
    ExtensionType,
    NetworkModificationType,
    ScreenshotFormat,
    RecordingFormat
)
from app.services.browser_manager import browser_manager
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models

class ExtensionInstallRequest(BaseModel):
    """Request model for installing browser extension."""
    name: str
    extension_type: ExtensionType
    source: str
    permissions: List[str] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class ExtensionInstallResponse(BaseModel):
    """Response model for extension installation."""
    success: bool
    extension_id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    version: Optional[str] = None
    installed_at: Optional[str] = None
    error: Optional[str] = None


class NetworkRuleCreateRequest(BaseModel):
    """Request model for creating network rule."""
    name: str
    url_pattern: str
    modification_type: NetworkModificationType
    action: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 0
    enabled: bool = True


class NetworkRuleResponse(BaseModel):
    """Response model for network rule operations."""
    success: bool
    rule_id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[int] = None
    error: Optional[str] = None


class ScreenshotRequest(BaseModel):
    """Request model for advanced screenshot."""
    browser_instance_id: str
    context_id: str
    page_id: Optional[str] = None
    config: ScreenshotConfig
    save_to_disk: bool = True


class ScreenshotResponse(BaseModel):
    """Response model for screenshot operations."""
    success: bool
    screenshot_id: Optional[str] = None
    format: Optional[str] = None
    size_bytes: Optional[int] = None
    base64_data: Optional[str] = None
    file_path: Optional[str] = None
    captured_at: Optional[str] = None
    error: Optional[str] = None


class RecordingStartRequest(BaseModel):
    """Request model for starting recording."""
    browser_instance_id: str
    context_id: str
    page_id: Optional[str] = None
    config: RecordingConfig


class RecordingStartResponse(BaseModel):
    """Response model for recording start."""
    success: bool
    recording_id: Optional[str] = None
    status: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    started_at: Optional[str] = None
    error: Optional[str] = None


class RecordingStopResponse(BaseModel):
    """Response model for recording stop."""
    success: bool
    recording_id: Optional[str] = None
    status: Optional[str] = None
    file_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    frames_captured: Optional[int] = None
    file_size_bytes: Optional[int] = None
    stopped_at: Optional[str] = None
    error: Optional[str] = None


class CookieManageRequest(BaseModel):
    """Request model for cookie management."""
    browser_instance_id: str
    context_id: str
    action: str  # get, set, clear
    cookies: Optional[List[Dict[str, Any]]] = None
    domain: Optional[str] = None


class ProxySetupRequest(BaseModel):
    """Request model for proxy setup."""
    browser_instance_id: str
    context_id: str
    proxy_config: ProxyConfig


class PerformanceMetricsResponse(BaseModel):
    """Response model for performance metrics."""
    success: bool
    metrics: List[Dict[str, Any]] = Field(default_factory=list)
    total_count: int = 0
    error: Optional[str] = None


class PerformanceReportResponse(BaseModel):
    """Response model for performance report."""
    success: bool
    report: Optional[Dict[str, Any]] = None
    file_path: Optional[str] = None
    generated_at: Optional[str] = None
    error: Optional[str] = None


class BrowserFingerprintResponse(BaseModel):
    """Response model for browser fingerprint."""
    success: bool
    fingerprint: Optional[Dict[str, Any]] = None
    generated_at: Optional[str] = None
    error: Optional[str] = None


# Browser Extensions Endpoints

@router.post("/extensions/install", response_model=ExtensionInstallResponse)
async def install_browser_extension(
    request: ExtensionInstallRequest,
    current_user: User = Depends(get_current_user)
):
    """Install a browser extension."""
    try:
        # Get browser context
        browser_instance_id = UUID(request.name)  # Using name as instance_id for simplicity
        context = browser_manager.contexts.get(browser_instance_id)

        if not context:
            # Create a temporary context for extension installation
            compatibility = await browser_manager.check_browser_compatibility("chromium")
            if not compatibility.is_compatible:
                raise HTTPException(status_code=400, detail="No compatible browser available")

            config = browser_manager.BrowserConfig(
                browser_type="chromium",
                execution_mode="headless"
            )
            instance_id = await browser_manager.create_browser_instance(config)
            context_id = await browser_manager.create_context(instance_id)
            context = browser_manager.contexts[context_id]

        # Create extension object
        extension = BrowserExtension(
            name=request.name,
            extension_type=request.extension_type,
            source=request.source,
            permissions=request.permissions,
            settings=request.settings,
            enabled=request.enabled
        )

        # Install extension
        result = await advanced_browser_features_service.install_extension(context, extension)

        return ExtensionInstallResponse(
            success=result["success"],
            extension_id=result.get("extension_id"),
            name=result.get("name"),
            type=result.get("type"),
            permissions=result.get("permissions", []),
            version=result.get("version"),
            installed_at=datetime.utcnow().isoformat() if result["success"] else None,
            error=result.get("error")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to install browser extension: {e}")
        raise HTTPException(status_code=500, detail=f"Extension installation failed: {str(e)}")


@router.delete("/extensions/{extension_id}")
async def uninstall_browser_extension(
    extension_id: str,
    current_user: User = Depends(get_current_user)
):
    """Uninstall a browser extension."""
    try:
        extension_uuid = UUID(extension_id)

        # Get a browser context (create temporary one if needed)
        compatibility = await browser_manager.check_browser_compatibility("chromium")
        if not compatibility.is_compatible:
            raise HTTPException(status_code=400, detail="No compatible browser available")

        config = browser_manager.BrowserConfig(
            browser_type="chromium",
            execution_mode="headless"
        )
        instance_id = await browser_manager.create_browser_instance(config)
        context_id = await browser_manager.create_context(instance_id)
        context = browser_manager.contexts[context_id]

        # Uninstall extension
        result = await advanced_browser_features_service.uninstall_extension(context, extension_uuid)

        return {
            "success": result["success"],
            "extension_id": result.get("extension_id"),
            "name": result.get("name"),
            "error": result.get("error")
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid extension ID")
    except Exception as e:
        logger.error(f"Failed to uninstall browser extension: {e}")
        raise HTTPException(status_code=500, detail=f"Extension uninstallation failed: {str(e)}")


@router.get("/extensions")
async def list_browser_extensions(
    current_user: User = Depends(get_current_user)
):
    """List installed browser extensions."""
    try:
        extensions = advanced_browser_features_service.get_installed_extensions()
        return {"extensions": extensions}
    except Exception as e:
        logger.error(f"Failed to list browser extensions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve extensions")


@router.post("/extensions/upload")
async def upload_browser_extension(
    file: UploadFile = File(...),
    name: str = Query(...),
    extension_type: ExtensionType = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Upload and install a browser extension from file."""
    try:
        # Save uploaded file
        temp_dir = Path(tempfile.gettempdir()) / "upm_extensions"
        temp_dir.mkdir(exist_ok=True)

        file_path = temp_dir / file.filename

        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Handle zip files (extract if needed)
        if file.filename.endswith('.zip'):
            extract_dir = temp_dir / name.replace(' ', '_')
            extract_dir.mkdir(exist_ok=True)

            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            # Look for manifest.json
            manifest_path = extract_dir / "manifest.json"
            if manifest_path.exists():
                extension_source = str(extract_dir)
            else:
                raise HTTPException(status_code=400, detail="Invalid extension: no manifest.json found")
        else:
            extension_source = str(file_path)

        # Create extension object
        extension = BrowserExtension(
            name=name,
            extension_type=extension_type,
            source=extension_source,
            enabled=True
        )

        # Get browser context and install
        compatibility = await browser_manager.check_browser_compatibility("chromium")
        if not compatibility.is_compatible:
            raise HTTPException(status_code=400, detail="No compatible browser available")

        config = browser_manager.BrowserConfig(
            browser_type="chromium",
            execution_mode="headless"
        )
        instance_id = await browser_manager.create_browser_instance(config)
        context_id = await browser_manager.create_context(instance_id)
        context = browser_manager.contexts[context_id]

        # Install extension
        result = await advanced_browser_features_service.install_extension(context, extension)

        return {
            "success": result["success"],
            "extension_id": result.get("extension_id"),
            "name": result.get("name"),
            "type": result.get("type"),
            "uploaded_filename": file.filename,
            "installed_at": datetime.utcnow().isoformat() if result["success"] else None,
            "error": result.get("error")
        }

    except Exception as e:
        logger.error(f"Failed to upload browser extension: {e}")
        raise HTTPException(status_code=500, detail=f"Extension upload failed: {str(e)}")


# Network Interception Endpoints

@router.post("/network/rules", response_model=NetworkRuleResponse)
async def add_network_rule(
    request: NetworkRuleCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Add a network modification rule."""
    try:
        # Create network rule
        rule = NetworkRule(
            name=request.name,
            url_pattern=request.url_pattern,
            modification_type=request.modification_type,
            action=request.action,
            priority=request.priority,
            enabled=request.enabled
        )

        # Add rule
        result = await advanced_browser_features_service.add_network_rule(rule)

        return NetworkRuleResponse(
            success=result["success"],
            rule_id=result.get("rule_id"),
            name=result.get("name"),
            type=result.get("type"),
            priority=result.get("priority"),
            error=result.get("error")
        )

    except Exception as e:
        logger.error(f"Failed to add network rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add network rule: {str(e)}")


@router.get("/network/rules")
async def list_network_rules(
    current_user: User = Depends(get_current_user)
):
    """List network modification rules."""
    try:
        rules = advanced_browser_features_service.get_network_rules()
        return {"rules": rules}
    except Exception as e:
        logger.error(f"Failed to list network rules: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve network rules")


@router.post("/network/intercept/{page_id}")
async def setup_network_interception(
    page_id: str,
    current_user: User = Depends(get_current_user)
):
    """Setup network interception for a page."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        # Setup interception
        result = await advanced_browser_features_service.setup_network_interception(page)

        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to setup network interception: {e}")
        raise HTTPException(status_code=500, detail=f"Network interception setup failed: {str(e)}")


@router.delete("/network/rules/{rule_id}")
async def delete_network_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a network modification rule."""
    try:
        rule_uuid = UUID(rule_id)

        if rule_uuid in advanced_browser_features_service.network_rules:
            del advanced_browser_features_service.network_rules[rule_uuid]
            return {"success": True, "rule_id": rule_id}
        else:
            raise HTTPException(status_code=404, detail="Network rule not found")

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule ID")
    except Exception as e:
        logger.error(f"Failed to delete network rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete network rule: {str(e)}")


# Advanced Screenshot Endpoints

@router.post("/screenshots", response_model=ScreenshotResponse)
async def capture_advanced_screenshot(
    request: ScreenshotRequest,
    current_user: User = Depends(get_current_user)
):
    """Capture an advanced screenshot."""
    try:
        # Get page
        page_uuid = UUID(request.page_id) if request.page_id else None
        if not page_uuid:
            # Create temporary page if not specified
            browser_instance_id = UUID(request.browser_instance_id)
            context_id = UUID(request.context_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]
        else:
            page = browser_manager.pages.get(page_uuid)
            if not page:
                raise HTTPException(status_code=404, detail="Page not found")

        # Capture screenshot
        result = await advanced_browser_features_service.capture_screenshot(
            page=page,
            config=request.config,
            save_to_disk=request.save_to_disk
        )

        return ScreenshotResponse(
            success=result["success"],
            screenshot_id=result.get("screenshot_id"),
            format=result.get("format"),
            size_bytes=result.get("size_bytes"),
            base64_data=result.get("base64_data"),
            file_path=result.get("file_path"),
            captured_at=result.get("captured_at"),
            error=result.get("error")
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page or configuration")
    except Exception as e:
        logger.error(f"Failed to capture screenshot: {e}")
        raise HTTPException(status_code=500, detail=f"Screenshot capture failed: {str(e)}")


@router.get("/screenshots/{screenshot_id}/download")
async def download_screenshot(
    screenshot_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a screenshot file."""
    try:
        # Get screenshot from cache
        screenshot_bytes = advanced_browser_features_service.screenshot_cache.get(screenshot_id)
        if not screenshot_bytes:
            raise HTTPException(status_code=404, detail="Screenshot not found")

        # Create temporary file
        temp_file = Path(tempfile.gettempdir()) / f"upm_screenshot_{screenshot_id}.png"
        with open(temp_file, "wb") as f:
            f.write(screenshot_bytes)

        return FileResponse(
            path=temp_file,
            filename=f"screenshot_{screenshot_id}.png",
            media_type="image/png"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download screenshot: {e}")
        raise HTTPException(status_code=500, detail=f"Screenshot download failed: {str(e)}")


@router.get("/screenshots")
async def list_screenshots(
    current_user: User = Depends(get_current_user)
):
    """List available screenshots."""
    try:
        screenshots = []
        for screenshot_id, screenshot_bytes in advanced_browser_features_service.screenshot_cache.items():
            screenshots.append({
                "screenshot_id": screenshot_id,
                "size_bytes": len(screenshot_bytes),
                "format": "png"  # Default format
            })

        return {"screenshots": screenshots}
    except Exception as e:
        logger.error(f"Failed to list screenshots: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve screenshots")


# Recording Endpoints

@router.post("/recordings/start", response_model=RecordingStartResponse)
async def start_screen_recording(
    request: RecordingStartRequest,
    current_user: User = Depends(get_current_user)
):
    """Start screen recording."""
    try:
        # Get page
        page_uuid = UUID(request.page_id) if request.page_id else None
        if not page_uuid:
            # Create temporary page if not specified
            browser_instance_id = UUID(request.browser_instance_id)
            context_id = UUID(request.context_id)
            page_id = await browser_manager.create_page(context_id)
            page = browser_manager.pages[page_id]
        else:
            page = browser_manager.pages.get(page_uuid)
            if not page:
                raise HTTPException(status_code=404, detail="Page not found")

        # Start recording
        result = await advanced_browser_features_service.start_recording(page, request.config)

        return RecordingStartResponse(
            success=result["success"],
            recording_id=result.get("recording_id"),
            status=result.get("status"),
            config=result.get("config"),
            started_at=result.get("started_at"),
            error=result.get("error")
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page or configuration")
    except Exception as e:
        logger.error(f"Failed to start recording: {e}")
        raise HTTPException(status_code=500, detail=f"Recording start failed: {str(e)}")


@router.post("/recordings/{recording_id}/stop", response_model=RecordingStopResponse)
async def stop_screen_recording(
    recording_id: str,
    current_user: User = Depends(get_current_user)
):
    """Stop screen recording."""
    try:
        result = await advanced_browser_features_service.stop_recording(recording_id)

        return RecordingStopResponse(
            success=result["success"],
            recording_id=result.get("recording_id"),
            status=result.get("status"),
            file_path=result.get("file_path"),
            duration_seconds=result.get("duration_seconds"),
            frames_captured=result.get("frames_captured"),
            file_size_bytes=result.get("file_size_bytes"),
            stopped_at=result.get("stopped_at"),
            error=result.get("error")
        )

    except Exception as e:
        logger.error(f"Failed to stop recording: {e}")
        raise HTTPException(status_code=500, detail=f"Recording stop failed: {str(e)}")


@router.get("/recordings")
async def list_recordings(
    current_user: User = Depends(get_current_user)
):
    """List active and completed recordings."""
    try:
        active_recordings = advanced_browser_features_service.get_active_recordings()
        return {"recordings": active_recordings}
    except Exception as e:
        logger.error(f"Failed to list recordings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve recordings")


@router.get("/recordings/{recording_id}/download")
async def download_recording(
    recording_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a recording file."""
    try:
        # Look for recording file
        recording_files = list(advanced_browser_features_service.recordings_dir.glob(f"*{recording_id}*"))
        if not recording_files:
            raise HTTPException(status_code=404, detail="Recording file not found")

        recording_file = recording_files[0]
        return FileResponse(
            path=recording_file,
            filename=recording_file.name,
            media_type="video/webm"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download recording: {e}")
        raise HTTPException(status_code=500, detail=f"Recording download failed: {str(e)}")


# Cookie and Session Management Endpoints

@router.post("/cookies/manage")
async def manage_cookies(
    request: CookieManageRequest,
    current_user: User = Depends(get_current_user)
):
    """Manage cookies (get, set, clear)."""
    try:
        # Get browser context
        context_uuid = UUID(request.context_id)
        context = browser_manager.contexts.get(context_uuid)

        if not context:
            raise HTTPException(status_code=404, detail="Context not found")

        if request.action == "get":
            urls = request.cookies if request.cookies else None
            cookies = await advanced_browser_features_service.get_cookies(context, urls)
            return {"success": True, "cookies": cookies}

        elif request.action == "set":
            if not request.cookies:
                raise HTTPException(status_code=400, detail="Cookies data required for set action")

            result = await advanced_browser_features_service.set_cookies(context, request.cookies)
            return result

        elif request.action == "clear":
            result = await advanced_browser_features_service.clear_cookies(context, request.domain)
            return result

        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'get', 'set', or 'clear'")

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid context ID")
    except Exception as e:
        logger.error(f"Failed to manage cookies: {e}")
        raise HTTPException(status_code=500, detail=f"Cookie management failed: {str(e)}")


@router.post("/sessions/export")
async def export_session(
    context_id: str,
    current_user: User = Depends(get_current_user)
):
    """Export browser session data."""
    try:
        context_uuid = UUID(context_id)
        context = browser_manager.contexts.get(context_uuid)

        if not context:
            raise HTTPException(status_code=404, detail="Context not found")

        result = await advanced_browser_features_service.export_session(context)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid context ID")
    except Exception as e:
        logger.error(f"Failed to export session: {e}")
        raise HTTPException(status_code=500, detail=f"Session export failed: {str(e)}")


@router.post("/sessions/import")
async def import_session(
    context_id: str,
    session_file_path: str = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Import browser session data."""
    try:
        context_uuid = UUID(context_id)
        context = browser_manager.contexts.get(context_uuid)

        if not context:
            raise HTTPException(status_code=404, detail="Context not found")

        result = await advanced_browser_features_service.import_session(context, session_file_path)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid context ID")
    except Exception as e:
        logger.error(f"Failed to import session: {e}")
        raise HTTPException(status_code=500, detail=f"Session import failed: {str(e)}")


@router.get("/sessions/{session_file_path}/download")
async def download_session_file(
    session_file_path: str,
    current_user: User = Depends(get_current_user)
):
    """Download session export file."""
    try:
        file_path = Path(session_file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Session file not found")

        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download session file: {e}")
        raise HTTPException(status_code=500, detail=f"Session file download failed: {str(e)}")


# Proxy and VPN Endpoints

@router.post("/proxy/setup")
async def setup_proxy(
    request: ProxySetupRequest,
    current_user: User = Depends(get_current_user)
):
    """Setup proxy configuration."""
    try:
        # Get browser context
        context_uuid = UUID(request.context_id)
        context = browser_manager.contexts.get(context_uuid)

        if not context:
            raise HTTPException(status_code=404, detail="Context not found")

        result = await advanced_browser_features_service.setup_proxy(context, request.proxy_config)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid context ID")
    except Exception as e:
        logger.error(f"Failed to setup proxy: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy setup failed: {str(e)}")


@router.post("/proxy/test/{page_id}")
async def test_proxy_connection(
    page_id: str,
    test_url: str = Query(default="https://httpbin.org/ip"),
    current_user: User = Depends(get_current_user)
):
    """Test proxy connection."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        result = await advanced_browser_features_service.test_proxy_connection(page, test_url)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to test proxy connection: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy test failed: {str(e)}")


# Performance Monitoring Endpoints

@router.post("/performance/start/{page_id}")
async def start_performance_monitoring(
    page_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start performance monitoring for a page."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        result = await advanced_browser_features_service.start_performance_monitoring(page)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to start performance monitoring: {e}")
        raise HTTPException(status_code=500, detail=f"Performance monitoring start failed: {str(e)}")


@router.post("/performance/collect/{page_id}", response_model=PerformanceMetricsResponse)
async def collect_performance_metrics(
    page_id: str,
    url: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Collect performance metrics from a page."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        metrics = await advanced_browser_features_service.collect_performance_metrics(page, url)
        metrics_list = advanced_browser_features_service.get_performance_metrics(limit=1)

        return PerformanceMetricsResponse(
            success=True,
            metrics=[{
                "timestamp": metrics.timestamp.isoformat(),
                "url": metrics.url,
                "load_time_ms": metrics.load_time_ms,
                "domContentLoaded_ms": metrics.domContentLoaded_ms,
                "first_paint_ms": metrics.first_paint_ms,
                "first_contentful_paint_ms": metrics.first_contentful_paint_ms,
                "largest_contentful_paint_ms": metrics.largest_contentful_paint_ms,
                "cumulative_layout_shift": metrics.cumulative_layout_shift,
                "first_input_delay_ms": metrics.first_input_delay_ms,
                "resources_count": metrics.resources_count,
                "transfer_size_bytes": metrics.transfer_size_bytes,
                "memory_usage_mb": metrics.memory_usage_mb
            }],
            total_count=1
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to collect performance metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Performance metrics collection failed: {str(e)}")


@router.get("/performance/metrics", response_model=PerformanceMetricsResponse)
async def get_performance_metrics(
    limit: int = Query(default=100, ge=1, le=1000),
    url_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get collected performance metrics."""
    try:
        metrics = advanced_browser_features_service.get_performance_metrics(limit, url_filter)

        return PerformanceMetricsResponse(
            success=True,
            metrics=metrics,
            total_count=len(metrics)
        )

    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve performance metrics: {str(e)}")


@router.post("/performance/report/{page_id}", response_model=PerformanceReportResponse)
async def generate_performance_report(
    page_id: str,
    url: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Generate comprehensive performance report."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        result = await advanced_browser_features_service.generate_performance_report(page, url)

        return PerformanceReportResponse(
            success=result["success"],
            report=result.get("report"),
            file_path=result.get("file_path"),
            generated_at=result.get("report", {}).get("generated_at") if result.get("report") else None,
            error=result.get("error")
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to generate performance report: {e}")
        raise HTTPException(status_code=500, detail=f"Performance report generation failed: {str(e)}")


@router.get("/performance/reports/{report_file_path}/download")
async def download_performance_report(
    report_file_path: str,
    current_user: User = Depends(get_current_user)
):
    """Download performance report file."""
    try:
        file_path = Path(report_file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Performance report file not found")

        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="application/json"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download performance report: {e}")
        raise HTTPException(status_code=500, detail=f"Performance report download failed: {str(e)}")


# Browser Fingerprinting and Privacy Endpoints

@router.post("/fingerprint/generate/{page_id}", response_model=BrowserFingerprintResponse)
async def generate_browser_fingerprint(
    page_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate browser fingerprint."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        fingerprint = await advanced_browser_features_service.generate_browser_fingerprint(page)

        return BrowserFingerprintResponse(
            success=True,
            fingerprint={
                "user_agent": fingerprint.user_agent,
                "screen_resolution": fingerprint.screen_resolution,
                "color_depth": fingerprint.color_depth,
                "timezone": fingerprint.timezone,
                "language": fingerprint.language,
                "platform": fingerprint.platform,
                "webgl_hash": fingerprint.webgl_hash,
                "canvas_hash": fingerprint.canvas_hash,
                "fonts": fingerprint.fonts,
                "plugins": fingerprint.plugins,
                "cookies_enabled": fingerprint.cookies_enabled,
                "localStorage_enabled": fingerprint.localStorage_enabled,
                "sessionStorage_enabled": fingerprint.sessionStorage_enabled,
                "indexed_db_enabled": fingerprint.indexed_db_enabled,
                "open_database_enabled": fingerprint.open_database_enabled
            },
            generated_at=datetime.utcnow().isoformat()
        )

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to generate browser fingerprint: {e}")
        raise HTTPException(status_code=500, detail=f"Browser fingerprint generation failed: {str(e)}")


@router.get("/fingerprints")
async def list_browser_fingerprints(
    current_user: User = Depends(get_current_user)
):
    """List collected browser fingerprints."""
    try:
        fingerprints = advanced_browser_features_service.get_browser_fingerprints()
        return {"fingerprints": fingerprints}
    except Exception as e:
        logger.error(f"Failed to list browser fingerprints: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve browser fingerprints")


@router.post("/privacy/enable/{page_id}")
async def enable_privacy_mode(
    page_id: str,
    options: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
):
    """Enable privacy mode to reduce fingerprinting."""
    try:
        page_uuid = UUID(page_id)
        page = browser_manager.pages.get(page_uuid)

        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

        result = await advanced_browser_features_service.enable_privacy_mode(page, options)
        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page ID")
    except Exception as e:
        logger.error(f"Failed to enable privacy mode: {e}")
        raise HTTPException(status_code=500, detail=f"Privacy mode enable failed: {str(e)}")


# Health Check

@router.get("/health")
async def advanced_browser_features_health():
    """Health check for advanced browser features service."""
    try:
        status = {
            "status": "healthy",
            "services": {
                "extensions": len(advanced_browser_features_service.extensions),
                "network_rules": len(advanced_browser_features_service.network_rules),
                "active_recordings": len(advanced_browser_features_service.active_recordings),
                "cached_screenshots": len(advanced_browser_features_service.screenshot_cache),
                "performance_metrics": len(advanced_browser_features_service.performance_metrics),
                "browser_fingerprints": len(advanced_browser_features_service.browser_fingerprints)
            },
            "directories": {
                "temp_dir": str(advanced_browser_features_service.temp_dir),
                "extensions_dir": str(advanced_browser_features_service.extensions_dir),
                "recordings_dir": str(advanced_browser_features_service.recordings_dir)
            },
            "timestamp": datetime.utcnow().isoformat()
        }

        return status

    except Exception as e:
        logger.error(f"Advanced browser features health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
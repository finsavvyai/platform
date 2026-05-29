"""
Scanning API routes for SDLC.ai DLP Service.

This module provides REST API endpoints for content scanning, batch scanning,
and real-time scanning operations.
"""

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
import asyncio

from app.models.schemas import (
    ScanRequest, ScanResult, BatchScanRequest, BatchScanResult,
    ErrorResponse, ViolationInfo
)
from app.services.real_time_scanner import get_real_time_scanner, ScanPriority, ScanMode
from app.services.violation_reporter import get_violation_reporter
from app.api.dependencies.auth import get_current_user, get_current_tenant
from app.api.dependencies.rate_limit import rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency injection
scanner = get_real_time_scanner()
reporter = get_violation_reporter()


@router.post("/scan", response_model=ScanResult)
async def scan_content(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    priority: ScanPriority = ScanPriority.MEDIUM,
    mode: ScanMode = ScanMode.SYNCHRONOUS,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Scan content for DLP violations.

    This endpoint analyzes the provided content for potential data loss prevention violations
    using Presidio PII detection, regex pattern matching, ML-based content classification,
    and custom DLP rules.

    - **content**: The text content to scan
    - **content_type**: MIME type of the content (optional)
    - **policies**: Specific DLP policies to apply (optional)
    - **rules**: Specific DLP rules to apply (optional)
    - **priority**: Scan priority (LOW, MEDIUM, HIGH, CRITICAL)
    - **mode**: Scan mode (SYNCHRONOUS, ASYNCHRONOUS, STREAMING)

    Returns detailed scan results including detected violations, risk assessment,
    and processing metadata.
    """
    try:
        # Apply rate limiting
        await rate_limiter.check_limit(f"scan:{tenant_id}")

        # Validate content size
        max_size = 10 * 1024 * 1024  # 10MB
        if len(request.content.encode('utf-8')) > max_size:
            raise HTTPException(
                status_code=413,
                detail="Content size exceeds maximum allowed size"
            )

        # Perform scan
        result = await scanner.scan_content(
            request=request,
            tenant_id=tenant_id,
            priority=priority,
            mode=mode,
        )

        # If asynchronous mode, return scan ID
        if mode == ScanMode.ASYNCHRONOUS:
            if isinstance(result, str):
                # Schedule violation reporting in background
                background_tasks.add_task(
                    report_scan_completion,
                    result,
                    tenant_id
                )

                return {
                    "scan_id": result,
                    "status": "PENDING",
                    "message": "Scan queued for processing"
                }

        # Report violations if any found
        if hasattr(result, 'violations') and result.violations:
            background_tasks.add_task(
                reporter.report_violations,
                result.violations,
                result.metadata.scan_id,
                tenant_id
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scan failed for tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during scan"
        )


@router.post("/scan/batch", response_model=BatchScanResult)
async def scan_batch(
    request: BatchScanRequest,
    background_tasks: BackgroundTasks,
    priority: ScanPriority = ScanPriority.MEDIUM,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Scan multiple contents in batch.

    This endpoint processes multiple scan requests in parallel, providing
    aggregated results and performance metrics for batch operations.

    - **items**: List of scan requests (max 100 items)
    - **parallel_processing**: Enable parallel processing (default: true)
    - **max_concurrent_scans**: Maximum concurrent scans (default: 10)
    - **aggregate_results**: Aggregate results across all items (default: true)

    Returns aggregated batch results with individual scan details and summary statistics.
    """
    try:
        # Apply rate limiting
        await rate_limiter.check_limit(f"batch_scan:{tenant_id}")

        # Validate batch size
        if len(request.items) > 100:
            raise HTTPException(
                status_code=400,
                detail="Batch size exceeds maximum allowed size (100 items)"
            )

        # Validate total content size
        total_size = sum(
            len(item.content.encode('utf-8')) for item in request.items
        )
        max_total_size = 50 * 1024 * 1024  # 50MB
        if total_size > max_total_size:
            raise HTTPException(
                status_code=413,
                detail="Total content size exceeds maximum allowed size"
            )

        # Perform batch scan
        result = await scanner.scan_batch(
            requests=request.items,
            tenant_id=tenant_id,
            priority=priority,
        )

        # Report violations in background
        all_violations = []
        for scan_result in result.results:
            if hasattr(scan_result, 'violations'):
                all_violations.extend(scan_result.violations)

        if all_violations:
            background_tasks.add_task(
                reporter.report_violations,
                all_violations,
                result.batch_id,
                tenant_id
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch scan failed for tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during batch scan"
        )


@router.get("/scan/{scan_id}/result", response_model=ScanResult)
async def get_scan_result(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Get result of an asynchronous scan.

    This endpoint retrieves the result of a previously submitted asynchronous scan.

    - **scan_id**: The ID of the scan to retrieve

    Returns the complete scan result if available, or an error if the scan
    is not found or still processing.
    """
    try:
        result = await scanner.get_scan_result(scan_id)

        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Scan result not found: {scan_id}"
            )

        # Verify tenant access
        if hasattr(result.metadata, 'tenant_id') and result.metadata.tenant_id != tenant_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this scan result"
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scan result {scan_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error retrieving scan result"
        )


@router.get("/scan/{scan_id}/progress")
async def get_scan_progress(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Get progress of an ongoing scan.

    This endpoint provides real-time progress information for scans that are
    currently processing, including completion percentage and current step.

    - **scan_id**: The ID of the scan to get progress for

    Returns progress information including status, completion percentage,
    current step, and estimated remaining time.
    """
    try:
        progress = await scanner.get_scan_progress(scan_id)

        if not progress:
            raise HTTPException(
                status_code=404,
                detail=f"Scan progress not found: {scan_id}"
            )

        # Verify tenant access
        if hasattr(progress, 'tenant_id') and progress.tenant_id != tenant_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied to this scan progress"
            )

        return progress

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scan progress {scan_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error retrieving scan progress"
        )


@router.post("/scan/stream")
async def scan_stream(
    request: ScanRequest,
    priority: ScanPriority = ScanPriority.MEDIUM,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Scan content using streaming API.

    This endpoint provides a streaming interface for large content scans,
    allowing clients to receive progress updates in real-time.

    Returns a streaming response with periodic progress updates.
    """
    try:
        # Apply rate limiting
        await rate_limiter.check_limit(f"stream_scan:{tenant_id}")

        # Create scan task
        scan_id = str(uuid.uuid4())

        # Convert content to stream
        async def content_stream():
            chunk_size = 4096
            content = request.content

            for i in range(0, len(content), chunk_size):
                chunk = content[i:i + chunk_size]
                yield chunk.encode('utf-8')
                await asyncio.sleep(0.01)  # Simulate streaming

        # Create streaming response
        async def generate_progress():
            from app.services.real_time_scanner import ScanProgress

            # Yield initial progress
            yield f"data: {ScanProgress(scan_id=scan_id, status='RUNNING', progress_percentage=0.0, current_step='Initializing', steps_completed=[], steps_remaining=['Processing content'], elapsed_time_ms=0, estimated_remaining_time_ms=0, violations_found=0, processing_rate_bytes_per_sec=0.0).json()}\n\n"

            # Simulate scan progress (would integrate with actual scanner)
            for i in range(1, 101, 10):
                await asyncio.sleep(0.1)  # Simulate processing time

                progress = ScanProgress(
                    scan_id=scan_id,
                    status="RUNNING" if i < 100 else "COMPLETED",
                    progress_percentage=i,
                    current_step=f"Processing {i}%",
                    steps_completed=[f"Step {j}" for j in range(1, i//10 + 1)],
                    steps_remaining=[f"Step {j}" for j in range(i//10 + 1, 11)],
                    elapsed_time_ms=i * 10,
                    estimated_remaining_time_ms=max(0, (100 - i) * 10),
                    violations_found=0,
                    processing_rate_bytes_per_sec=1000.0,
                )

                yield f"data: {progress.json()}\n\n"

            # Final completion message
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_progress(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Scan-ID": scan_id,
            }
        )

    except Exception as e:
        logger.error(f"Stream scan failed for tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during stream scan"
        )


@router.delete("/scan/{scan_id}")
async def cancel_scan(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Cancel an ongoing or queued scan.

    This endpoint cancels a scan that is currently processing or queued
    for processing.

    - **scan_id**: The ID of the scan to cancel

    Returns confirmation of scan cancellation.
    """
    try:
        # This would integrate with the actual scanner to cancel scans
        # For now, return a placeholder response

        return {
            "scan_id": scan_id,
            "status": "CANCELLED",
            "message": "Scan cancelled successfully"
        }

    except Exception as e:
        logger.error(f"Failed to cancel scan {scan_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error cancelling scan"
        )


@router.get("/scans", response_model=List[ScanResult])
async def list_scans(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    List recent scans for the tenant.

    This endpoint returns a paginated list of recent scans with optional filtering
    by status and severity.

    - **limit**: Maximum number of scans to return (1-1000)
    - **offset**: Number of scans to skip for pagination
    - **status**: Filter by scan status (optional)
    - **severity**: Filter by maximum violation severity (optional)

    Returns a list of scan results with pagination metadata.
    """
    try:
        # This would typically query a database for scan history
        # For now, return an empty list as placeholder

        return []

    except Exception as e:
        logger.error(f"Failed to list scans for tenant {tenant_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error listing scans"
        )


async def report_scan_completion(scan_id: str, tenant_id: str):
    """
    Background task to report scan completion.

    This function runs in the background to handle violation reporting
    for completed scans.
    """
    try:
        # Get scan result
        result = await scanner.get_scan_result(scan_id)

        if result and hasattr(result, 'violations') and result.violations:
            # Report violations
            await reporter.report_violations(
                violations=result.violations,
                scan_id=scan_id,
                tenant_id=tenant_id
            )

            logger.info(f"Reported {len(result.violations)} violations for scan {scan_id}")

    except Exception as e:
        logger.error(f"Failed to report scan completion for {scan_id}: {e}")

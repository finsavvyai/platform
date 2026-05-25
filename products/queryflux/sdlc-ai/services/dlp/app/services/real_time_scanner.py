"""
Real-time Scanning Service for SDLC.ai DLP Service.

This module provides high-performance real-time scanning capabilities with
streaming analysis, low-latency processing, and parallel execution.
"""

import asyncio
import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union, AsyncGenerator, Callable
import json
import threading
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import gzip

from app.core.config import get_settings
from app.models.schemas import (
    ScanRequest,
    ScanResult,
    BatchScanResult,
    ViolationInfo,
    ScanStatus,
    ViolationSeverity,
    RiskLevel,
)
from app.models.database import DLPScan, DLPViolation
from app.services.presidio_detector import get_presidio_detector, PIIExtractionResult
from app.services.regex_engine import get_regex_engine, PatternMatchResult
from app.services.content_classifier import (
    get_classification_service,
    RiskAssessmentResult,
)
from app.services.rule_engine import (
    get_rule_engine,
    RuleExecutionResult,
    RuleExecutionContext,
)

logger = logging.getLogger(__name__)


class ScanPriority(str, Enum):
    """Scan priority levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ScanMode(str, Enum):
    """Scanning modes."""

    SYNCHRONOUS = "SYNCHRONOUS"
    ASYNCHRONOUS = "ASYNCHRONOUS"
    STREAMING = "STREAMING"
    BATCH = "BATCH"


@dataclass
class ScanTask:
    """Individual scan task."""

    id: str
    tenant_id: str
    content: str
    content_type: Optional[str]
    content_path: Optional[str]
    priority: ScanPriority
    mode: ScanMode

    # Scan configuration
    policies: Optional[List[str]] = None
    rules: Optional[List[str]] = None
    timeout_ms: Optional[int] = None
    max_violations: Optional[int] = None

    # Metadata
    user_context: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Timestamps
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None

    # Callback
    callback: Optional[Callable] = None


@dataclass
class ScanProgress:
    """Progress information for a scan."""

    scan_id: str
    status: ScanStatus
    progress_percentage: float
    current_step: str
    steps_completed: List[str]
    steps_remaining: List[str]

    # Performance metrics
    elapsed_time_ms: int
    estimated_remaining_time_ms: int

    # Results so far
    violations_found: int
    processing_rate_bytes_per_sec: float

    # Error information
    error_message: Optional[str] = None


@dataclass
class ScanStatistics:
    """Statistics for scan operations."""

    total_scans: int
    completed_scans: int
    failed_scans: int
    average_scan_time_ms: float

    # Performance metrics
    scans_per_second: float
    average_content_size: float
    cache_hit_rate: float

    # Violation statistics
    total_violations: int
    violations_by_severity: Dict[ViolationSeverity, int]
    violations_by_type: Dict[str, int]

    # Resource usage
    active_workers: int
    queue_size: int
    memory_usage_mb: float


class ScanCache:
    """Cache for scan results to improve performance."""

    def __init__(self, max_size: int = 10000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache = {}
        self._access_times = {}
        self._lock = asyncio.Lock()

    async def get(self, content_hash: str) -> Optional[ScanResult]:
        """Get cached scan result."""
        async with self._lock:
            if content_hash in self._cache:
                cached_data = self._cache[content_hash]
                if not self._is_expired(cached_data["timestamp"]):
                    self._access_times[content_hash] = time.time()
                    return cached_data["result"]
                else:
                    # Remove expired entry
                    del self._cache[content_hash]
                    if content_hash in self._access_times:
                        del self._access_times[content_hash]

        return None

    async def set(self, content_hash: str, result: ScanResult):
        """Cache a scan result."""
        async with self._lock:
            # Clean up if needed
            if len(self._cache) >= self.max_size:
                await self._cleanup()

            self._cache[content_hash] = {
                "result": result,
                "timestamp": time.time(),
            }
            self._access_times[content_hash] = time.time()

    def _is_expired(self, timestamp: float) -> bool:
        """Check if cache entry is expired."""
        return time.time() - timestamp > self.ttl_seconds

    async def _cleanup(self):
        """Clean up expired entries."""
        current_time = time.time()
        expired_keys = []

        for key, data in self._cache.items():
            if current_time - data["timestamp"] > self.ttl_seconds:
                expired_keys.append(key)

        for key in expired_keys:
            if key in self._cache:
                del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]

        # If still too many entries, remove oldest
        if len(self._cache) >= self.max_size:
            # Sort by access time
            sorted_keys = sorted(
                self._access_times.keys(), key=lambda k: self._access_times[k]
            )

            # Remove oldest 25%
            keys_to_remove = sorted_keys[: len(sorted_keys) // 4]

            for key in keys_to_remove:
                if key in self._cache:
                    del self._cache[key]
                if key in self._access_times:
                    del self._access_times[key]


class ScanQueue:
    """Priority queue for scan tasks."""

    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self._queues = {
            ScanPriority.CRITICAL: deque(),
            ScanPriority.HIGH: deque(),
            ScanPriority.MEDIUM: deque(),
            ScanPriority.LOW: deque(),
        }
        self._lock = asyncio.Lock()
        self._not_empty = asyncio.Condition(self._lock)

    async def put(self, task: ScanTask) -> bool:
        """Add a task to the queue."""
        async with self._not_empty:
            if len(self._get_all_tasks()) >= self.max_size:
                return False  # Queue is full

            self._queues[task.priority].append(task)
            self._not_empty.notify()
            return True

    async def get(self) -> Optional[ScanTask]:
        """Get the next task from the queue."""
        async with self._not_empty:
            while True:
                # Check queues in priority order
                for priority in [
                    ScanPriority.CRITICAL,
                    ScanPriority.HIGH,
                    ScanPriority.MEDIUM,
                    ScanPriority.LOW,
                ]:
                    if self._queues[priority]:
                        return self._queues[priority].popleft()

                # No tasks available, wait
                await self._not_empty.wait()

    async def size(self) -> int:
        """Get total queue size."""
        async with self._lock:
            return len(self._get_all_tasks())

    def _get_all_tasks(self) -> List[ScanTask]:
        """Get all tasks from all priority queues."""
        all_tasks = []
        for queue in self._queues.values():
            all_tasks.extend(queue)
        return all_tasks


class StreamingScanner:
    """Handles streaming content analysis."""

    def __init__(self, chunk_size: int = 4096):
        self.chunk_size = chunk_size
        self.presidio_detector = get_presidio_detector()
        self.regex_engine = get_regex_engine()
        self.classifier = get_classification_service()

    async def scan_stream(
        self,
        content_stream: AsyncGenerator[bytes, None],
        scan_id: str,
        tenant_id: str,
        progress_callback: Optional[Callable[[ScanProgress], None]] = None,
    ) -> AsyncGenerator[ScanProgress, None]:
        """Scan content as it streams in."""

        buffer = b""
        total_bytes = 0
        chunks_processed = 0

        try:
            async for chunk in content_stream:
                buffer += chunk
                total_bytes += len(chunk)

                # Process complete chunks
                while len(buffer) >= self.chunk_size:
                    chunk_data = buffer[: self.chunk_size]
                    buffer = buffer[self.chunk_size :]

                    # Process chunk
                    chunk_text = chunk_data.decode("utf-8", errors="ignore")
                    await self._process_chunk(
                        chunk_text, scan_id, tenant_id, chunks_processed
                    )

                    chunks_processed += 1

                    # Report progress
                    if progress_callback:
                        progress = ScanProgress(
                            scan_id=scan_id,
                            status=ScanStatus.RUNNING,
                            progress_percentage=0.0,  # Unknown total size for streaming
                            current_step=f"Processing chunk {chunks_processed}",
                            steps_completed=[f"Chunk {chunks_processed}"],
                            steps_remaining=["Continue processing..."],
                            elapsed_time_ms=0,
                            estimated_remaining_time_ms=0,
                            violations_found=0,
                            processing_rate_bytes_per_sec=0.0,
                        )
                        progress_callback(progress)

                        yield progress

            # Process remaining data
            if buffer:
                remaining_text = buffer.decode("utf-8", errors="ignore")
                await self._process_chunk(
                    remaining_text, scan_id, tenant_id, chunks_processed
                )
                chunks_processed += 1

            # Final progress update
            if progress_callback:
                final_progress = ScanProgress(
                    scan_id=scan_id,
                    status=ScanStatus.COMPLETED,
                    progress_percentage=100.0,
                    current_step="Scan completed",
                    steps_completed=[f"Processed {chunks_processed} chunks"],
                    steps_remaining=[],
                    elapsed_time_ms=0,
                    estimated_remaining_time_ms=0,
                    violations_found=0,
                    processing_rate_bytes_per_sec=0.0,
                )
                progress_callback(final_progress)
                yield final_progress

        except Exception as e:
            logger.error(f"Error in streaming scan {scan_id}: {e}")
            if progress_callback:
                error_progress = ScanProgress(
                    scan_id=scan_id,
                    status=ScanStatus.FAILED,
                    progress_percentage=0.0,
                    current_step="Error occurred",
                    steps_completed=[],
                    steps_remaining=[],
                    elapsed_time_ms=0,
                    estimated_remaining_time_ms=0,
                    violations_found=0,
                    processing_rate_bytes_per_sec=0.0,
                    error_message=str(e),
                )
                progress_callback(error_progress)
                yield error_progress

    async def _process_chunk(
        self, chunk_text: str, scan_id: str, tenant_id: str, chunk_index: int
    ):
        """Process a single chunk of content."""
        try:
            # This would integrate with the actual scanning components
            # For now, just log the chunk processing
            logger.debug(f"Processing chunk {chunk_index} for scan {scan_id}")

            # Future: Process chunk with Presidio, regex, and classification
            # Future: Store intermediate results

        except Exception as e:
            logger.error(f"Error processing chunk {chunk_index}: {e}")


class RealTimeScanner:
    """Main real-time scanning service."""

    def __init__(self):
        self.settings = get_settings()
        self.scan_queue = ScanQueue()
        self.scan_cache = ScanCache()
        self.streaming_scanner = StreamingScanner()

        # Get service instances
        self.presidio_detector = get_presidio_detector()
        self.regex_engine = get_regex_engine()
        self.classifier = get_classification_service()
        self.rule_engine = get_rule_engine()

        # Worker pool
        self.max_workers = self.settings.max_parallel_scans
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers)

        # Statistics
        self._stats = defaultdict(int)
        self._stats_lock = threading.Lock()

        # Active scans tracking
        self._active_scans: Dict[str, ScanTask] = {}
        self._active_scans_lock = asyncio.Lock()

        # Background workers
        self._workers_running = False
        self._worker_tasks = []

    async def start(self):
        """Start the scanning service."""
        if self._workers_running:
            return

        self._workers_running = True

        # Start worker coroutines
        for i in range(self.max_workers):
            task = asyncio.create_task(self._worker(f"worker-{i}"))
            self._worker_tasks.append(task)

        logger.info(f"Started {self.max_workers} scan workers")

    async def stop(self):
        """Stop the scanning service."""
        self._workers_running = False

        # Cancel worker tasks
        for task in self._worker_tasks:
            task.cancel()

        # Wait for workers to finish
        if self._worker_tasks:
            await asyncio.gather(*self._worker_tasks, return_exceptions=True)

        # Shutdown thread pool
        self.executor.shutdown(wait=True)

        logger.info("Stopped scanning service")

    async def scan_content(
        self,
        request: ScanRequest,
        tenant_id: str,
        priority: ScanPriority = ScanPriority.MEDIUM,
        mode: ScanMode = ScanMode.SYNCHRONOUS,
    ) -> Union[ScanResult, str]:
        """Scan content for DLP violations."""

        # Create scan task
        scan_id = str(uuid.uuid4())
        task = ScanTask(
            id=scan_id,
            tenant_id=tenant_id,
            content=request.content,
            content_type=request.content_type,
            content_path=request.content_path,
            priority=priority,
            mode=mode,
            policies=request.policies,
            rules=request.rules,
            timeout_ms=request.timeout_ms,
            max_violations=request.max_violations,
        )

        # Generate content hash for caching
        content_hash = self._generate_content_hash(request.content)

        # Check cache first
        if mode != ScanMode.STREAMING:
            cached_result = await self.scan_cache.get(content_hash)
            if cached_result:
                with self._stats_lock:
                    self._stats["cache_hits"] += 1

                logger.info(f"Cache hit for scan {scan_id}")
                return cached_result

        with self._stats_lock:
            self._stats["cache_misses"] += 1

        # Handle different scan modes
        if mode == ScanMode.SYNCHRONOUS:
            return await self._scan_synchronous(task, content_hash)

        elif mode == ScanMode.ASYNCHRONOUS:
            # Queue task and return scan ID
            success = await self.scan_queue.put(task)
            if not success:
                raise RuntimeError("Scan queue is full")

            return scan_id

        elif mode == ScanMode.STREAMING:
            # Return async generator for streaming
            return self._scan_streaming(task)

        else:
            raise ValueError(f"Unsupported scan mode: {mode}")

    async def scan_batch(
        self,
        requests: List[ScanRequest],
        tenant_id: str,
        priority: ScanPriority = ScanPriority.MEDIUM,
    ) -> BatchScanResult:
        """Scan multiple contents in batch."""

        batch_id = str(uuid.uuid4())
        start_time = time.time()

        # Create scan tasks
        tasks = []
        for i, request in enumerate(requests):
            scan_id = f"{batch_id}-{i}"
            task = ScanTask(
                id=scan_id,
                tenant_id=tenant_id,
                content=request.content,
                content_type=request.content_type,
                content_path=request.content_path,
                priority=priority,
                mode=ScanMode.SYNCHRONOUS,
                policies=request.policies,
                rules=request.rules,
            )
            tasks.append(task)

        # Execute scans in parallel
        results = []
        failed_count = 0

        # Limit concurrent scans
        semaphore = asyncio.Semaphore(self.max_workers)

        async def scan_single_task(task: ScanTask) -> ScanResult:
            async with semaphore:
                try:
                    return await self._scan_synchronous(task, None)
                except Exception as e:
                    logger.error(f"Batch scan failed for {task.id}: {e}")
                    failed_count += 1
                    # Return error result
                    return ScanResult(
                        scan_id=task.id,
                        status=ScanStatus.FAILED,
                        total_violations=0,
                        violations_by_severity={},
                        violations_by_type={},
                        risk_score=0.0,
                        risk_level=RiskLevel.LOW,
                        violations=[],
                        metadata=ScanMetadata(
                            scan_id=task.id,
                            tenant_id=task.tenant_id,
                            content_type=task.content_type or "text/plain",
                            content_size_bytes=len(task.content),
                            scan_duration_ms=0,
                            processing_time_ms=0,
                            items_processed=1,
                        ),
                    )

        # Execute all scans
        scan_results = await asyncio.gather(
            *[scan_single_task(task) for task in tasks], return_exceptions=False
        )

        # Aggregate results
        total_violations = sum(result.total_violations for result in scan_results)
        violations_by_severity = defaultdict(int)
        violations_by_type = defaultdict(int)

        for result in scan_results:
            for severity, count in result.violations_by_severity.items():
                violations_by_severity[severity] += count

            for vtype, count in result.violations_by_type.items():
                violations_by_type[vtype] += count

        total_duration = int((time.time() - start_time) * 1000)

        return BatchScanResult(
            batch_id=batch_id,
            status=ScanStatus.COMPLETED,
            total_items=len(requests),
            completed_items=len(scan_results) - failed_count,
            failed_items=failed_count,
            total_violations=total_violations,
            violations_by_severity=dict(violations_by_severity),
            violations_by_type=dict(violations_by_type),
            results=scan_results,
            total_duration_ms=total_duration,
        )

    async def get_scan_result(self, scan_id: str) -> Optional[ScanResult]:
        """Get result of an asynchronous scan."""
        # This would typically query a database or cache
        # For now, return None as placeholder
        return None

    async def get_scan_progress(self, scan_id: str) -> Optional[ScanProgress]:
        """Get progress of an ongoing scan."""
        # This would typically query active scans
        # For now, return None as placeholder
        return None

    async def _scan_synchronous(
        self, task: ScanTask, content_hash: Optional[str]
    ) -> ScanResult:
        """Perform synchronous scan."""
        start_time = time.time()
        task.started_at = start_time

        try:
            # Add to active scans
            async with self._active_scans_lock:
                self._active_scans[task.id] = task

            # Execute scan
            result = await self._execute_scan(task)

            # Cache result if hash provided
            if content_hash:
                await self.scan_cache.set(content_hash, result)

            # Update statistics
            with self._stats_lock:
                self._stats["scans_completed"] += 1
                self._stats["total_scan_time"] += result.metadata.processing_time_ms

            return result

        except Exception as e:
            logger.error(f"Synchronous scan failed for {task.id}: {e}")

            with self._stats_lock:
                self._stats["scans_failed"] += 1

            # Return error result
            return ScanResult(
                scan_id=task.id,
                status=ScanStatus.FAILED,
                total_violations=0,
                violations_by_severity={},
                violations_by_type={},
                risk_score=0.0,
                risk_level=RiskLevel.LOW,
                violations=[],
                metadata=ScanMetadata(
                    scan_id=task.id,
                    tenant_id=task.tenant_id,
                    content_type=task.content_type or "text/plain",
                    content_size_bytes=len(task.content),
                    scan_duration_ms=int((time.time() - start_time) * 1000),
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    items_processed=1,
                ),
            )

        finally:
            # Remove from active scans
            async with self._active_scans_lock:
                if task.id in self._active_scans:
                    del self._active_scans[task.id]

            task.completed_at = time.time()

    async def _scan_streaming(
        self, task: ScanTask
    ) -> AsyncGenerator[ScanProgress, None]:
        """Perform streaming scan."""

        # Convert content to stream
        async def content_stream():
            # Split content into chunks
            chunk_size = 4096
            for i in range(0, len(task.content), chunk_size):
                chunk = task.content[i : i + chunk_size].encode("utf-8")
                yield chunk
                await asyncio.sleep(0.01)  # Small delay to simulate streaming

        # Use streaming scanner
        async for progress in self.streaming_scanner.scan_stream(
            content_stream(), task.id, task.tenant_id
        ):
            yield progress

    async def _execute_scan(self, task: ScanTask) -> ScanResult:
        """Execute the actual scan with all components."""
        start_time = time.time()
        content = task.content

        # Step 1: Presidio PII Detection
        presidio_results = await self._run_presidio_detection(content)

        # Step 2: Regex Pattern Matching
        regex_results = self._run_regex_matching(content)

        # Step 3: ML Content Classification
        classification_results = self._run_content_classification(content)

        # Step 4: Risk Assessment
        risk_assessment = self._run_risk_assessment(
            content,
            classification_results,
            len(presidio_results.entities) + regex_results.total_matches,
        )

        # Step 5: Rule Engine Evaluation
        rule_context = RuleExecutionContext(
            scan_id=task.id,
            tenant_id=task.tenant_id,
            content=content,
            content_type=task.content_type,
            content_path=task.content_path,
            presidio_results=presidio_results.entities,
            regex_results=regex_results.matches,
            classification_results=[classification_results],
        )

        rule_results = self.rule_engine.execute_rules(rule_context, task.rules)

        # Step 6: Aggregate Results
        all_violations = []

        # Convert Presidio results to violations
        presidio_violations = self.presidio_detector.convert_to_violations(
            presidio_results, content, task.id, task.tenant_id
        )
        all_violations.extend(presidio_violations)

        # Convert regex results to violations
        regex_violations = self.regex_engine.convert_to_violations(
            regex_results, task.id, task.tenant_id, task.content_path
        )
        all_violations.extend(regex_violations)

        # Add rule engine violations
        for rule_result in rule_results:
            all_violations.extend(rule_result.violations_created)

        # Apply max violations limit
        if task.max_violations and len(all_violations) > task.max_violations:
            all_violations = all_violations[: task.max_violations]

        # Sort violations by severity and confidence
        all_violations.sort(
            key=lambda v: (list(ViolationSeverity).index(v.severity), v.confidence),
            reverse=True,
        )

        # Calculate statistics
        violations_by_severity = defaultdict(int)
        violations_by_type = defaultdict(int)

        for violation in all_violations:
            violations_by_severity[violation.severity] += 1
            violations_by_type[violation.violation_type] += 1

        processing_time = int((time.time() - start_time) * 1000)

        # Create scan metadata
        metadata = ScanMetadata(
            scan_id=task.id,
            tenant_id=task.tenant_id,
            content_type=task.content_type or "text/plain",
            content_size_bytes=len(content),
            scan_duration_ms=processing_time,
            processing_time_ms=processing_time,
            policies_applied=task.policies or [],
            rules_applied=task.rules or [],
            items_processed=1,
            cache_hits=self._stats.get("cache_hits", 0),
            additional_metadata={
                "presidio_entities": len(presidio_results.entities),
                "regex_matches": regex_results.total_matches,
                "classification_confidence": classification_results.confidence,
                "risk_score": risk_assessment.risk_score,
                "rules_executed": len(rule_results),
                "rules_matched": len([r for r in rule_results if r.matched]),
            },
        )

        return ScanResult(
            scan_id=task.id,
            status=ScanStatus.COMPLETED,
            total_violations=len(all_violations),
            violations_by_severity=dict(violations_by_severity),
            violations_by_type=dict(violations_by_type),
            risk_score=risk_assessment.risk_score,
            risk_level=risk_assessment.risk_level,
            violations=all_violations,
            metadata=metadata,
        )

    async def _run_presidio_detection(self, content: str) -> PIIExtractionResult:
        """Run Presidio PII detection."""
        try:
            return await self.presidio_detector.extract_pii(content)
        except Exception as e:
            logger.error(f"Presidio detection failed: {e}")
            # Return empty result
            return PIIExtractionResult(
                entities=[],
                anonymized_text=None,
                risk_score=0.0,
                processing_time_ms=0,
                language=None,
                entity_counts={},
                confidence_scores={},
            )

    def _run_regex_matching(self, content: str) -> PatternMatchResult:
        """Run regex pattern matching."""
        try:
            return self.regex_engine.match_text(content)
        except Exception as e:
            logger.error(f"Regex matching failed: {e}")
            # Return empty result
            return PatternMatchResult(
                matches=[],
                total_matches=0,
                patterns_matched=[],
                processing_time_ms=0,
                text_length=len(content),
                categories_found=[],
                patterns_tested=0,
                cache_hits=0,
                cache_misses=0,
            )

    def _run_content_classification(self, content: str):
        """Run ML content classification."""
        try:
            return self.classifier.classify_content(content)
        except Exception as e:
            logger.error(f"Content classification failed: {e}")
            # Return mock result
            from app.models.schemas import ContentType, ClassificationResult

            return ClassificationResult(
                predicted_class=ContentType.PUBLIC,
                confidence=0.5,
                probabilities={ContentType.PUBLIC: 0.5},
                model_name="fallback",
                model_version="1.0.0",
                processing_time_ms=10,
                features_used=["fallback"],
            )

    def _run_risk_assessment(
        self, content: str, classification_result, violation_count: int
    ) -> RiskAssessmentResult:
        """Run risk assessment."""
        try:
            return self.classifier.risk_assessor.assess_risk(
                [classification_result], violation_count, len(content)
            )
        except Exception as e:
            logger.error(f"Risk assessment failed: {e}")
            # Return low risk result
            return RiskAssessmentResult(
                risk_level=RiskLevel.LOW,
                risk_score=0.1,
                risk_factors={},
                confidence=0.5,
                category_risks={},
                recommendations=[],
                mitigation_actions=[],
                model_name="fallback",
                processing_time_ms=5,
            )

    async def _worker(self, worker_name: str):
        """Background worker that processes scan tasks from queue."""
        logger.info(f"Started worker: {worker_name}")

        while self._workers_running:
            try:
                # Get next task from queue
                task = await asyncio.wait_for(
                    self.scan_queue.get(),
                    timeout=1.0,  # Check if we should still be running
                )

                # Process task
                await self._process_async_task(task)

            except asyncio.TimeoutError:
                # No task available, continue
                continue
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")
                await asyncio.sleep(1.0)  # Brief pause before continuing

        logger.info(f"Stopped worker: {worker_name}")

    async def _process_async_task(self, task: ScanTask):
        """Process an asynchronous scan task."""
        try:
            # Execute scan
            result = await self._execute_scan(task)

            # Store result (would typically go to database)
            logger.info(f"Completed async scan: {task.id}")

            # Call callback if provided
            if task.callback:
                try:
                    if asyncio.iscoroutinefunction(task.callback):
                        await task.callback(result)
                    else:
                        task.callback(result)
                except Exception as e:
                    logger.error(f"Callback error for {task.id}: {e}")

        except Exception as e:
            logger.error(f"Async scan failed for {task.id}: {e}")

    def _generate_content_hash(self, content: str) -> str:
        """Generate hash for content caching."""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def get_statistics(self) -> ScanStatistics:
        """Get scanning service statistics."""
        with self._stats_lock:
            stats = dict(self._stats)

        # Calculate derived statistics
        total_scans = stats.get("scans_completed", 0) + stats.get("scans_failed", 0)
        avg_scan_time = stats.get("total_scan_time", 0) / max(
            1, stats.get("scans_completed", 0)
        )

        cache_hit_rate = stats.get("cache_hits", 0) / max(
            1, stats.get("cache_hits", 0) + stats.get("cache_misses", 0)
        )

        return ScanStatistics(
            total_scans=total_scans,
            completed_scans=stats.get("scans_completed", 0),
            failed_scans=stats.get("scans_failed", 0),
            average_scan_time_ms=avg_scan_time,
            scans_per_second=0.0,  # Would calculate from recent time window
            average_content_size=0.0,  # Would track from scans
            cache_hit_rate=cache_hit_rate,
            total_violations=0,  # Would track from results
            violations_by_severity={},
            violations_by_type={},
            active_workers=len(self._worker_tasks),
            queue_size=asyncio.run(self.scan_queue.size()),
            memory_usage_mb=0.0,  # Would track actual memory usage
        )


# Singleton instance
_real_time_scanner = None


def get_real_time_scanner() -> RealTimeScanner:
    """Get singleton instance of real-time scanner."""
    global _real_time_scanner
    if _real_time_scanner is None:
        _real_time_scanner = RealTimeScanner()
    return _real_time_scanner

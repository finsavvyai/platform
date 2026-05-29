"""
Batch embedding processor for handling large datasets efficiently.

This module provides scalable batch processing capabilities for embedding generation,
including:
- Concurrent batch processing with configurable limits
- Progress tracking and monitoring
- Error recovery and retry mechanisms
- Resource usage optimization
- Queue-based processing for async workflows
- Memory-efficient processing for large datasets
- Integration with the document processing pipeline
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from uuid import UUID, uuid4

from ..core.config import get_settings
from ..models.document import DocumentChunk, DocumentStatus
from .embedding_service import (
    EmbeddingProvider,
    EmbeddingRequest,
    EmbeddingResponse,
    get_embedding_service,
)

logger = logging.getLogger(__name__)


class BatchStatus(str, Enum):
    """Batch processing status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class BatchPriority(str, Enum):
    """Batch processing priority levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class BatchConfig:
    """Configuration for batch processing."""

    batch_size: int = 100
    max_concurrent_batches: int = 5
    max_retries: int = 3
    retry_delay: float = 1.0  # seconds
    timeout_per_batch: float = 300.0  # seconds
    memory_limit_mb: int = 2048
    progress_reporting_interval: int = 10  # Report progress every N batches
    cleanup_completed_batches: bool = True
    cleanup_delay_hours: int = 24
    enable_progress_persistence: bool = True

    def __post_init__(self):
        """Validate configuration."""
        if self.batch_size <= 0:
            raise ValueError("Batch size must be positive")
        if self.max_concurrent_batches <= 0:
            raise ValueError("Max concurrent batches must be positive")
        if self.max_retries < 0:
            raise ValueError("Max retries must be non-negative")


@dataclass
class BatchJob:
    """A batch job for embedding generation."""

    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    document_id: Optional[UUID]
    chunks: List[DocumentChunk]
    provider: EmbeddingProvider
    model: str
    priority: BatchPriority
    status: BatchStatus = BatchStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    processed_count: int = 0
    total_count: int = field(init=False)
    progress_percentage: float = field(init=False)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Initialize derived fields."""
        self.total_count = len(self.chunks)
        self.progress_percentage = 0.0

    def update_progress(self, processed: int) -> None:
        """Update job progress."""
        self.processed_count = processed
        self.progress_percentage = (
            (processed / self.total_count) * 100 if self.total_count > 0 else 0.0
        )

    def mark_started(self) -> None:
        """Mark job as started."""
        self.status = BatchStatus.RUNNING
        self.started_at = datetime.utcnow()

    def mark_completed(self) -> None:
        """Mark job as completed."""
        self.status = BatchStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.update_progress(self.total_count)

    def mark_failed(self, error_message: str) -> None:
        """Mark job as failed."""
        self.status = BatchStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.utcnow()

    def can_retry(self) -> bool:
        """Check if job can be retried."""
        return self.retry_count < 3 and self.status == BatchStatus.FAILED

    def get_duration(self) -> Optional[timedelta]:
        """Get job duration."""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None

    @property
    def is_finished(self) -> bool:
        """Check if job is finished."""
        return self.status in [
            BatchStatus.COMPLETED,
            BatchStatus.FAILED,
            BatchStatus.CANCELLED,
        ]


@dataclass
class BatchStatistics:
    """Statistics for batch processing."""

    total_jobs: int = 0
    pending_jobs: int = 0
    running_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    cancelled_jobs: int = 0
    total_chunks: int = 0
    processed_chunks: int = 0
    total_processing_time_ms: int = 0
    average_batch_time_ms: float = 0.0
    cache_hit_rate: float = 0.0
    error_rate: float = 0.0
    throughput_chunks_per_second: float = 0.0
    cost_estimate_usd: float = 0.0

    def update_from_job(self, job: BatchJob) -> None:
        """Update statistics from a job."""
        self.total_jobs += 1
        self.total_chunks += job.total_count
        self.processed_chunks += job.processed_count

        if job.status == BatchStatus.PENDING:
            self.pending_jobs += 1
        elif job.status == BatchStatus.RUNNING:
            self.running_jobs += 1
        elif job.status == BatchStatus.COMPLETED:
            self.completed_jobs += 1
            if job.get_duration():
                self.total_processing_time_ms += int(
                    job.get_duration().total_seconds() * 1000
                )
        elif job.status == BatchStatus.FAILED:
            self.failed_jobs += 1
        elif job.status == BatchStatus.CANCELLED:
            self.cancelled_jobs += 1

        # Update derived statistics
        self._update_derived_stats()

    def _update_derived_stats(self) -> None:
        """Update derived statistics."""
        if self.completed_jobs > 0:
            self.average_batch_time_ms = (
                self.total_processing_time_ms / self.completed_jobs
            )

        if self.total_chunks > 0:
            self.processed_chunks / self.total_chunks
            self.error_rate = (
                self.failed_jobs / self.total_jobs if self.total_jobs > 0 else 0.0
            )

        if self.total_processing_time_ms > 0:
            self.throughput_chunks_per_second = (
                self.processed_chunks / self.total_processing_time_ms
            ) * 1000


class BatchQueue:
    """Queue for managing batch jobs with priority support."""

    def __init__(self, max_size: int = 10000):
        """Initialize batch queue."""
        self.max_size = max_size
        self._queues: Dict[BatchPriority, asyncio.Queue] = {
            BatchPriority.URGENT: asyncio.Queue(maxsize=max_size // 4),
            BatchPriority.HIGH: asyncio.Queue(maxsize=max_size // 4),
            BatchPriority.NORMAL: asyncio.Queue(maxsize=max_size // 2),
            BatchPriority.LOW: asyncio.Queue(maxsize=max_size // 4),
        }
        self._job_lookup: Dict[UUID, BatchJob] = {}
        self._lock = asyncio.Lock()

    async def put(self, job: BatchJob) -> bool:
        """Add a job to the queue."""
        async with self._lock:
            if job.id in self._job_lookup:
                logger.warning(f"Job {job.id} already exists in queue")
                return False

            # Check if queue has space
            if (
                self._queues[job.priority].qsize()
                >= self._queues[job.priority]._maxsize
            ):
                logger.warning(f"Queue for priority {job.priority} is full")
                return False

            await self._queues[job.priority].put(job)
            self._job_lookup[job.id] = job

            logger.debug(f"Added job {job.id} to {job.priority} queue")
            return True

    async def get(self) -> Optional[BatchJob]:
        """Get the next job from the queue (highest priority first)."""
        for priority in [
            BatchPriority.URGENT,
            BatchPriority.HIGH,
            BatchPriority.NORMAL,
            BatchPriority.LOW,
        ]:
            try:
                if not self._queues[priority].empty():
                    job = self._queues[priority].get_nowait()
                    async with self._lock:
                        if job.id in self._job_lookup:
                            del self._job_lookup[job.id]
                    return job
            except asyncio.QueueEmpty:
                continue

        return None

    async def get_job(self, job_id: UUID) -> Optional[BatchJob]:
        """Get a specific job by ID."""
        async with self._lock:
            return self._job_lookup.get(job_id)

    async def update_job_status(self, job_id: UUID, status: BatchStatus) -> bool:
        """Update job status."""
        async with self._lock:
            job = self._job_lookup.get(job_id)
            if job:
                job.status = status
                return True
            return False

    def get_queue_sizes(self) -> Dict[str, int]:
        """Get current queue sizes."""
        return {
            priority.value: queue.qsize() for priority, queue in self._queues.items()
        }

    def get_total_size(self) -> int:
        """Get total number of jobs in queue."""
        return sum(queue.qsize() for queue in self._queues.values())


class BatchEmbeddingProcessor:
    """
    High-performance batch embedding processor for handling large datasets.

    Features:
    - Concurrent batch processing with configurable limits
    - Intelligent queue management with priority support
    - Memory-efficient processing for large datasets
    - Comprehensive error handling and retry mechanisms
    - Progress tracking and monitoring
    - Resource usage optimization
    - Integration with document processing pipeline
    """

    def __init__(self, config: Optional[BatchConfig] = None):
        """Initialize batch processor."""
        self.settings = get_settings()
        self.config = config or BatchConfig()

        # Initialize queue
        self.queue = BatchQueue(max_size=10000)

        # Processing state
        self._running = False
        self._workers: List[asyncio.Task] = []
        self._active_jobs: Dict[UUID, BatchJob] = {}
        self._completed_jobs: List[BatchJob] = []
        self._statistics = BatchStatistics()

        # Rate limiting and resource management
        self._semaphore = asyncio.Semaphore(self.config.max_concurrent_batches)
        self._processing_lock = asyncio.Lock()

        # Progress tracking
        self._progress_callbacks: List[callable] = []

        # Embedding service
        self._embedding_service = None

    async def initialize(self) -> None:
        """Initialize the batch processor."""
        logger.info("Initializing batch embedding processor...")

        # Get embedding service
        self._embedding_service = await get_embedding_service()

        # Start worker tasks
        await self.start()

        logger.info(
            f"Batch processor initialized with {self.config.max_concurrent_batches} workers"
        )

    async def start(self) -> None:
        """Start the batch processor."""
        if self._running:
            logger.warning("Batch processor is already running")
            return

        self._running = True

        # Start worker tasks
        for i in range(self.config.max_concurrent_batches):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self._workers.append(worker)

        # Start cleanup task
        cleanup_task = asyncio.create_task(self._cleanup_task())
        self._workers.append(cleanup_task)

        logger.info(f"Started {len(self._workers)} worker tasks")

    async def stop(self) -> None:
        """Stop the batch processor."""
        if not self._running:
            return

        logger.info("Stopping batch processor...")
        self._running = False

        # Cancel all workers
        for worker in self._workers:
            worker.cancel()

        # Wait for workers to finish
        await asyncio.gather(*self._workers, return_exceptions=True)

        self._workers.clear()

        logger.info("Batch processor stopped")

    async def _worker(self, worker_name: str) -> None:
        """Worker task for processing batch jobs."""
        logger.info(f"Worker {worker_name} started")

        while self._running:
            try:
                # Get next job from queue
                job = await self.queue.get()
                if job is None:
                    await asyncio.sleep(0.1)
                    continue

                logger.info(f"Worker {worker_name} processing job {job.id}")

                # Process job with semaphore to limit concurrency
                async with self._semaphore:
                    await self._process_job(job, worker_name)

            except asyncio.CancelledError:
                logger.info(f"Worker {worker_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {str(e)}")
                await asyncio.sleep(1.0)  # Brief delay before continuing

        logger.info(f"Worker {worker_name} stopped")

    async def _process_job(self, job: BatchJob, worker_name: str) -> None:
        """Process a single batch job."""
        start_time = time.time()

        try:
            # Mark job as started
            job.mark_started()
            self._active_jobs[job.id] = job

            # Notify progress callbacks
            await self._notify_progress(job)

            # Process chunks in batches
            await self._process_chunks_in_batches(job, worker_name)

            # Mark job as completed
            job.mark_completed()

            processing_time = (time.time() - start_time) * 1000
            logger.info(f"Job {job.id} completed in {processing_time:.2f}ms")

        except Exception as e:
            logger.error(f"Job {job.id} failed: {str(e)}")
            job.mark_failed(str(e))

            # Retry if possible
            if job.can_retry():
                job.retry_count += 1
                job.status = BatchStatus.PENDING
                await self.queue.put(job)
                logger.info(f"Retrying job {job.id} (attempt {job.retry_count})")

        finally:
            # Move job from active to completed
            if job.id in self._active_jobs:
                del self._active_jobs[job.id]

            self._completed_jobs.append(job)
            self._statistics.update_from_job(job)

            # Notify progress callbacks
            await self._notify_progress(job)

    async def _process_chunks_in_batches(self, job: BatchJob, worker_name: str) -> None:
        """Process document chunks in batches."""
        chunks = job.chunks
        processed_count = 0

        # Process in configurable batch sizes
        batch_size = min(self.config.batch_size, len(chunks))

        for i in range(0, len(chunks), batch_size):
            if not self._running:
                break

            batch_chunks = chunks[i : i + batch_size]

            try:
                # Process batch with timeout
                await asyncio.wait_for(
                    self._process_batch(batch_chunks, job),
                    timeout=self.config.timeout_per_batch,
                )

                processed_count += len(batch_chunks)
                job.update_progress(processed_count)

                # Notify progress periodically
                if i % (batch_size * self.config.progress_reporting_interval) == 0:
                    await self._notify_progress(job)

                # Brief pause to prevent overwhelming the system
                await asyncio.sleep(0.01)

            except asyncio.TimeoutError:
                logger.error(f"Batch timeout for job {job.id}, batch {i // batch_size}")
                raise
            except Exception as e:
                logger.error(f"Batch processing error for job {job.id}: {str(e)}")
                raise

    async def _process_batch(self, chunks: List[DocumentChunk], job: BatchJob) -> None:
        """Process a single batch of chunks."""
        if not chunks:
            return

        try:
            # Use embedding service to process chunks
            processed_chunks = await self._embedding_service.process_document_chunks(
                chunks=chunks,
                provider=job.provider,
                model=EmbeddingModel(job.model),
                tenant_id=job.tenant_id,
            )

            # Update chunk metadata
            for chunk in processed_chunks:
                chunk.metadata["batch_job_id"] = str(job.id)
                chunk.metadata["processed_at"] = datetime.utcnow().isoformat()
                chunk.metadata["worker"] = job.metadata.get("worker", "unknown")

        except Exception as e:
            # Mark all chunks in batch as failed
            for chunk in chunks:
                chunk.embedding_status = DocumentStatus.FAILED
                chunk.metadata["embedding_error"] = str(e)
                chunk.metadata["batch_job_id"] = str(job.id)

            raise

    async def _cleanup_task(self) -> None:
        """Background task for cleanup operations."""
        while self._running:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Clean up old completed jobs
                if self.config.cleanup_completed_batches:
                    cutoff_time = datetime.utcnow() - timedelta(
                        hours=self.config.cleanup_delay_hours
                    )

                    old_jobs = [
                        job
                        for job in self._completed_jobs
                        if job.completed_at and job.completed_at < cutoff_time
                    ]

                    self._completed_jobs = [
                        job for job in self._completed_jobs if job not in old_jobs
                    ]

                    if old_jobs:
                        logger.info(f"Cleaned up {len(old_jobs)} old completed jobs")

            except Exception as e:
                logger.error(f"Cleanup task error: {str(e)}")

    async def _notify_progress(self, job: BatchJob) -> None:
        """Notify progress callbacks."""
        for callback in self._progress_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(job)
                else:
                    callback(job)
            except Exception as e:
                logger.warning(f"Progress callback error: {str(e)}")

    async def submit_job(
        self,
        chunks: List[DocumentChunk],
        provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
        model: str = EmbeddingModel.SENTENCE_MINILM_L6_V2.value,
        priority: BatchPriority = BatchPriority.NORMAL,
        tenant_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UUID:
        """
        Submit a batch job for processing.

        Args:
            chunks: List of document chunks to process
            provider: Embedding provider to use
            model: Embedding model to use
            priority: Job priority
            tenant_id: Tenant ID
            user_id: User ID who submitted the job
            document_id: Document ID if applicable
            metadata: Additional metadata

        Returns:
            Job ID
        """
        if not chunks:
            raise ValueError("No chunks provided for batch processing")

        # Get tenant ID from chunks if not provided
        if not tenant_id:
            tenant_id = chunks[0].tenant_id

        # Create batch job
        job = BatchJob(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            document_id=document_id,
            chunks=chunks,
            provider=provider,
            model=model,
            priority=priority,
            metadata=metadata or {},
        )

        # Submit to queue
        success = await self.queue.put(job)
        if not success:
            raise RuntimeError("Failed to submit job to queue (queue full)")

        logger.info(f"Submitted batch job {job.id} with {len(chunks)} chunks")
        return job.id

    async def get_job_status(self, job_id: UUID) -> Optional[BatchJob]:
        """Get the status of a specific job."""
        # Check active jobs first
        if job_id in self._active_jobs:
            return self._active_jobs[job_id]

        # Check completed jobs
        for job in self._completed_jobs:
            if job.id == job_id:
                return job

        # Check queue
        return await self.queue.get_job(job_id)

    async def cancel_job(self, job_id: UUID) -> bool:
        """Cancel a batch job."""
        job = await self.get_job_status(job_id)
        if not job:
            return False

        if job.status in [
            BatchStatus.COMPLETED,
            BatchStatus.FAILED,
            BatchStatus.CANCELLED,
        ]:
            return False

        job.status = BatchStatus.CANCELLED
        job.completed_at = datetime.utcnow()

        # Remove from active jobs if running
        if job_id in self._active_jobs:
            del self._active_jobs[job_id]

        logger.info(f"Cancelled job {job_id}")
        return True

    async def retry_job(self, job_id: UUID) -> bool:
        """Retry a failed batch job."""
        job = await self.get_job_status(job_id)
        if not job:
            return False

        if not job.can_retry():
            return False

        # Reset job status
        job.status = BatchStatus.PENDING
        job.error_message = None
        job.started_at = None
        job.completed_at = None

        # Reset chunk statuses
        for chunk in job.chunks:
            if chunk.embedding_status == DocumentStatus.FAILED:
                chunk.embedding_status = DocumentStatus.PENDING
                chunk.metadata.pop("embedding_error", None)

        # Resubmit to queue
        success = await self.queue.put(job)
        if success:
            logger.info(f"Resubmitted job {job_id} for retry")

        return success

    def get_statistics(self) -> BatchStatistics:
        """Get current processing statistics."""
        # Update real-time statistics
        stats = BatchStatistics()

        # Queue statistics
        queue_sizes = self.queue.get_queue_sizes()
        stats.pending_jobs = sum(queue_sizes.values())

        # Active jobs
        stats.running_jobs = len(self._active_jobs)

        # Completed jobs
        for job in self._completed_jobs:
            stats.update_from_job(job)

        # Total chunks currently processing
        stats.total_chunks = sum(job.total_count for job in self._active_jobs.values())
        stats.processed_chunks = sum(
            job.processed_count for job in self._active_jobs.values()
        )

        return stats

    def get_queue_info(self) -> Dict[str, Any]:
        """Get queue information."""
        return {
            "queue_sizes": self.queue.get_queue_sizes(),
            "total_queued": self.queue.get_total_size(),
            "active_jobs": len(self._active_jobs),
            "max_concurrent_batches": self.config.max_concurrent_batches,
            "batch_size": self.config.batch_size,
        }

    def add_progress_callback(self, callback: callable) -> None:
        """Add a progress callback function."""
        self._progress_callbacks.append(callback)

    def remove_progress_callback(self, callback: callable) -> None:
        """Remove a progress callback function."""
        if callback in self._progress_callbacks:
            self._progress_callbacks.remove(callback)

    async def get_jobs(
        self,
        status_filter: Optional[BatchStatus] = None,
        tenant_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[BatchJob]:
        """Get jobs with optional filtering."""
        all_jobs = list(self._active_jobs.values()) + self._completed_jobs

        # Apply filters
        if status_filter:
            all_jobs = [job for job in all_jobs if job.status == status_filter]

        if tenant_id:
            all_jobs = [job for job in all_jobs if job.tenant_id == tenant_id]

        # Sort by creation time (newest first)
        all_jobs.sort(key=lambda x: x.created_at, reverse=True)

        # Apply pagination
        return all_jobs[offset : offset + limit]

    async def get_job_metrics(self, job_id: UUID) -> Optional[Dict[str, Any]]:
        """Get detailed metrics for a specific job."""
        job = await self.get_job_status(job_id)
        if not job:
            return None

        metrics = {
            "job_id": str(job.id),
            "tenant_id": str(job.tenant_id),
            "status": job.status.value,
            "priority": job.priority.value,
            "provider": job.provider.value,
            "model": job.model,
            "total_chunks": job.total_count,
            "processed_chunks": job.processed_count,
            "progress_percentage": job.progress_percentage,
            "retry_count": job.retry_count,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "metadata": job.metadata,
        }

        # Add duration if completed
        if job.get_duration():
            metrics["duration_seconds"] = job.get_duration().total_seconds()

        # Add chunk status breakdown
        chunk_statuses = {}
        for chunk in job.chunks:
            status = chunk.embedding_status.value
            chunk_statuses[status] = chunk_statuses.get(status, 0) + 1

        metrics["chunk_statuses"] = chunk_statuses

        return metrics


# Global instance
_batch_processor: Optional[BatchEmbeddingProcessor] = None


async def get_batch_processor() -> BatchEmbeddingProcessor:
    """Get global batch processor instance."""
    global _batch_processor

    if _batch_processor is None:
        _batch_processor = BatchEmbeddingProcessor()
        await _batch_processor.initialize()

    return _batch_processor


# Convenience functions
async def submit_embedding_batch(
    chunks: List[DocumentChunk],
    provider: EmbeddingProvider = EmbeddingProvider.SENTENCE_TRANSFORMERS,
    model: str = EmbeddingModel.SENTENCE_MINILM_L6_V2.value,
    priority: BatchPriority = BatchPriority.NORMAL,
    **kwargs,
) -> UUID:
    """Submit a batch embedding job."""
    processor = await get_batch_processor()
    return await processor.submit_job(chunks, provider, model, priority, **kwargs)


async def get_batch_job_status(job_id: UUID) -> Optional[Dict[str, Any]]:
    """Get status of a batch job."""
    processor = await get_batch_processor()
    job = await processor.get_job_status(job_id)

    if job:
        return {
            "id": str(job.id),
            "status": job.status.value,
            "progress": job.progress_percentage,
            "processed": job.processed_count,
            "total": job.total_count,
            "error": job.error_message,
        }

    return None


async def cancel_batch_job(job_id: UUID) -> bool:
    """Cancel a batch job."""
    processor = await get_batch_processor()
    return await processor.cancel_job(job_id)

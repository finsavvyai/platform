"""
Job queue management for batch embedding processing.

This module provides a priority-based job queue system with Redis backend,
supporting job scheduling, retries, and deadlock prevention.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Union

import redis.asyncio as redis
from redis.asyncio import Redis


class JobStatus(str, Enum):
    """Job status enumeration."""

    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobPriority(int, Enum):
    """Job priority levels (higher numbers = higher priority)."""

    LOW = 1
    NORMAL = 5
    HIGH = 10
    CRITICAL = 20
    URGENT = 50


class Job:
    """Represents a batch embedding job."""

    def __init__(
        self,
        job_id: str,
        tenant_id: str,
        texts: List[str],
        provider: str,
        model: str,
        priority: JobPriority = JobPriority.NORMAL,
        batch_size: int = 100,
        metadata: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
    ):
        """Initialize job."""
        self.job_id = job_id
        self.tenant_id = tenant_id
        self.texts = texts
        self.provider = provider
        self.model = model
        self.priority = priority
        self.batch_size = batch_size
        self.metadata = metadata or {}
        self.created_at = created_at or datetime.utcnow()

        # Runtime fields
        self.status = JobStatus.PENDING
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.error_message: Optional[str] = None
        self.retry_count = 0
        self.max_retries = 3
        self.progress = 0.0
        self.processed_batches = 0
        self.total_batches = (len(texts) + batch_size - 1) // batch_size

    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary."""
        return {
            "job_id": self.job_id,
            "tenant_id": self.tenant_id,
            "texts": self.texts,
            "provider": self.provider,
            "model": self.model,
            "priority": self.priority.value,
            "batch_size": self.batch_size,
            "metadata": self.metadata,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "progress": self.progress,
            "processed_batches": self.processed_batches,
            "total_batches": self.total_batches,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Job":
        """Create job from dictionary."""
        job = cls(
            job_id=data["job_id"],
            tenant_id=data["tenant_id"],
            texts=data["texts"],
            provider=data["provider"],
            model=data["model"],
            priority=JobPriority(data["priority"]),
            batch_size=data["batch_size"],
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]),
        )

        job.status = JobStatus(data["status"])
        job.started_at = (
            datetime.fromisoformat(data["started_at"])
            if data.get("started_at")
            else None
        )
        job.completed_at = (
            datetime.fromisoformat(data["completed_at"])
            if data.get("completed_at")
            else None
        )
        job.error_message = data.get("error_message")
        job.retry_count = data.get("retry_count", 0)
        job.max_retries = data.get("max_retries", 3)
        job.progress = data.get("progress", 0.0)
        job.processed_batches = data.get("processed_batches", 0)
        job.total_batches = data.get("total_batches", 0)

        return job


class JobQueue:
    """Priority-based job queue with Redis backend."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/1",
        queue_name: str = "embedding_jobs",
        max_concurrent_jobs: int = 10,
        job_timeout: int = 3600,  # 1 hour
        max_retries: int = 3,
        cleanup_interval: int = 300,  # 5 minutes
    ):
        """
        Initialize job queue.

        Args:
            redis_url: Redis connection URL
            queue_name: Queue name prefix
            max_concurrent_jobs: Maximum concurrent jobs
            job_timeout: Job timeout in seconds
            max_retries: Maximum retry attempts
            cleanup_interval: Cleanup interval in seconds
        """
        self.redis_url = redis_url
        self.queue_name = queue_name
        self.max_concurrent_jobs = max_concurrent_jobs
        self.job_timeout = job_timeout
        self.max_retries = max_retries
        self.cleanup_interval = cleanup_interval

        self._redis: Optional[Redis] = None
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None

        # Queue keys
        self._pending_queue = f"{queue_name}:pending"
        self._processing_queue = f"{queue_name}:processing"
        self._completed_queue = f"{queue_name}:completed"
        self._failed_queue = f"{queue_name}:failed"
        self._job_data = f"{queue_name}:data"
        self._job_stats = f"{queue_name}:stats"

    async def initialize(self) -> None:
        """Initialize job queue."""
        try:
            self._redis = redis.from_url(
                self.redis_url,
                max_connections=20,
                socket_timeout=10,
                socket_connect_timeout=10,
                health_check_interval=30,
            )

            # Test connection
            await self._redis.ping()

            # Start cleanup task
            self._running = True
            self._cleanup_task = asyncio.create_task(self._cleanup_worker())

        except Exception as e:
            raise RuntimeError(f"Failed to initialize job queue: {e}")

    async def cleanup(self) -> None:
        """Cleanup job queue resources."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        if self._redis:
            await self._redis.close()
            await self._redis.wait_closed()
            self._redis = None

    async def submit_job(
        self,
        tenant_id: str,
        texts: List[str],
        provider: str,
        model: str,
        priority: JobPriority = JobPriority.NORMAL,
        batch_size: int = 100,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Submit a new job to the queue.

        Args:
            tenant_id: Tenant ID
            texts: List of texts to embed
            provider: Embedding provider
            model: Embedding model
            priority: Job priority
            batch_size: Batch size for processing
            metadata: Additional metadata

        Returns:
            Job ID
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        job_id = str(uuid.uuid4())

        job = Job(
            job_id=job_id,
            tenant_id=tenant_id,
            texts=texts,
            provider=provider,
            model=model,
            priority=priority,
            batch_size=batch_size,
            metadata=metadata or {},
        )

        try:
            # Store job data
            await self._redis.hset(self._job_data, job_id, json.dumps(job.to_dict()))

            # Add to pending queue with priority score
            await self._redis.zadd(self._pending_queue, {job_id: priority.value})

            # Update stats
            await self._update_stats("submitted")

            return job_id

        except Exception as e:
            raise RuntimeError(f"Failed to submit job: {e}")

    async def get_next_job(self, timeout: int = 30) -> Optional[Job]:
        """
        Get the next job from the queue.

        Args:
            timeout: Timeout in seconds

        Returns:
            Next job or None if no jobs available
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                # Check if we can process more jobs
                processing_count = await self._redis.zcard(self._processing_queue)
                if processing_count >= self.max_concurrent_jobs:
                    await asyncio.sleep(1)
                    continue

                # Get highest priority job
                result = await self._redis.zpopmax(self._pending_queue, count=1)

                if not result:
                    await asyncio.sleep(1)
                    continue

                job_id, _ = result[0]

                # Get job data
                job_data = await self._redis.hget(self._job_data, job_id)
                if not job_data:
                    continue

                job = Job.from_dict(json.loads(job_data))

                # Move to processing queue
                await self._redis.zadd(self._processing_queue, {job_id: time.time()})

                # Update job status
                job.status = JobStatus.PROCESSING
                job.started_at = datetime.utcnow()
                await self._save_job(job)

                # Update stats
                await self._update_stats("started")

                return job

            except Exception as e:
                print(f"Error getting next job: {e}")
                await asyncio.sleep(1)

        return None

    async def complete_job(
        self, job_id: str, success: bool = True, error_message: Optional[str] = None
    ) -> bool:
        """
        Mark a job as completed.

        Args:
            job_id: Job ID
            success: Whether job completed successfully
            error_message: Error message if failed

        Returns:
            True if successfully updated
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            # Get job data
            job_data = await self._redis.hget(self._job_data, job_id)
            if not job_data:
                return False

            job = Job.from_dict(json.loads(job_data))
            job.completed_at = datetime.utcnow()

            if success:
                job.status = JobStatus.COMPLETED
                job.progress = 1.0
                job.processed_batches = job.total_batches

                # Move to completed queue
                await self._redis.zadd(self._completed_queue, {job_id: time.time()})

                await self._update_stats("completed")

            else:
                job.status = JobStatus.FAILED
                job.error_message = error_message

                # Check if we should retry
                if job.retry_count < job.max_retries:
                    job.status = JobStatus.RETRYING
                    job.retry_count += 1

                    # Add back to pending queue with lower priority
                    retry_priority = max(job.priority.value // 2, 1)
                    await self._redis.zadd(
                        self._pending_queue, {job_id: retry_priority}
                    )

                    await self._update_stats("retried")

                else:
                    # Move to failed queue
                    await self._redis.zadd(self._failed_queue, {job_id: time.time()})

                    await self._update_stats("failed")

            # Save updated job
            await self._save_job(job)

            # Remove from processing queue
            await self._redis.zrem(self._processing_queue, job_id)

            return True

        except Exception as e:
            raise RuntimeError(f"Failed to complete job: {e}")

    async def update_job_progress(self, job_id: str, processed_batches: int) -> bool:
        """
        Update job progress.

        Args:
            job_id: Job ID
            processed_batches: Number of processed batches

        Returns:
            True if successfully updated
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            # Get job data
            job_data = await self._redis.hget(self._job_data, job_id)
            if not job_data:
                return False

            job = Job.from_dict(json.loads(job_data))
            job.processed_batches = processed_batches
            job.progress = (
                processed_batches / job.total_batches if job.total_batches > 0 else 0.0
            )

            # Save updated job
            await self._save_job(job)

            return True

        except Exception as e:
            raise RuntimeError(f"Failed to update job progress: {e}")

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a job.

        Args:
            job_id: Job ID

        Returns:
            True if successfully cancelled
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            # Get job data
            job_data = await self._redis.hget(self._job_data, job_id)
            if not job_data:
                return False

            job = Job.from_dict(json.loads(job_data))

            # Can only cancel pending or processing jobs
            if job.status in [JobStatus.PENDING, JobStatus.PROCESSING]:
                job.status = JobStatus.CANCELLED
                job.completed_at = datetime.utcnow()

                # Save updated job
                await self._save_job(job)

                # Remove from all queues
                await self._redis.zrem(self._pending_queue, job_id)
                await self._redis.zrem(self._processing_queue, job_id)

                await self._update_stats("cancelled")

                return True

            return False

        except Exception as e:
            raise RuntimeError(f"Failed to cancel job: {e}")

    async def get_job(self, job_id: str) -> Optional[Job]:
        """
        Get job by ID.

        Args:
            job_id: Job ID

        Returns:
            Job or None if not found
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            job_data = await self._redis.hget(self._job_data, job_id)
            if not job_data:
                return None

            return Job.from_dict(json.loads(job_data))

        except Exception as e:
            raise RuntimeError(f"Failed to get job: {e}")

    async def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        tenant_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Job]:
        """
        List jobs with optional filtering.

        Args:
            status: Filter by status
            tenant_id: Filter by tenant ID
            limit: Maximum number of jobs to return
            offset: Offset for pagination

        Returns:
            List of jobs
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            # Determine which queue to search
            if status:
                if status == JobStatus.PENDING:
                    job_ids = await self._redis.zrange(self._pending_queue, 0, -1)
                elif status == JobStatus.PROCESSING:
                    job_ids = await self._redis.zrange(self._processing_queue, 0, -1)
                elif status == JobStatus.COMPLETED:
                    job_ids = await self._redis.zrange(self._completed_queue, 0, -1)
                elif status == JobStatus.FAILED:
                    job_ids = await self._redis.zrange(self._failed_queue, 0, -1)
                else:
                    # For other statuses, get all and filter
                    all_queues = [
                        self._pending_queue,
                        self._processing_queue,
                        self._completed_queue,
                        self._failed_queue,
                    ]
                    job_ids = []
                    for queue in all_queues:
                        job_ids.extend(await self._redis.zrange(queue, 0, -1))
            else:
                # Get all jobs from all queues
                all_queues = [
                    self._pending_queue,
                    self._processing_queue,
                    self._completed_queue,
                    self._failed_queue,
                ]
                job_ids = []
                for queue in all_queues:
                    job_ids.extend(await self._redis.zrange(queue, 0, -1))

            # Get job data
            jobs = []
            for job_id in job_ids[offset : offset + limit]:
                job = await self.get_job(job_id)
                if job:
                    # Apply tenant filter if specified
                    if tenant_id is None or job.tenant_id == tenant_id:
                        # Apply status filter if specified
                        if status is None or job.status == status:
                            jobs.append(job)

            return jobs

        except Exception as e:
            raise RuntimeError(f"Failed to list jobs: {e}")

    async def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics.

        Returns:
            Queue statistics
        """
        if not self._redis:
            raise RuntimeError("Job queue not initialized")

        try:
            pending_count = await self._redis.zcard(self._pending_queue)
            processing_count = await self._redis.zcard(self._processing_queue)
            completed_count = await self._redis.zcard(self._completed_queue)
            failed_count = await self._redis.zcard(self._failed_queue)

            # Get overall stats
            stats_data = await self._redis.hgetall(self._job_stats)
            stats = {k.decode(): int(v.decode()) for k, v in stats_data.items()}

            return {
                "queue_counts": {
                    "pending": pending_count,
                    "processing": processing_count,
                    "completed": completed_count,
                    "failed": failed_count,
                    "total": pending_count
                    + processing_count
                    + completed_count
                    + failed_count,
                },
                "processing_capacity": {
                    "current": processing_count,
                    "max": self.max_concurrent_jobs,
                    "available": self.max_concurrent_jobs - processing_count,
                },
                "stats": stats,
                "config": {
                    "max_concurrent_jobs": self.max_concurrent_jobs,
                    "job_timeout": self.job_timeout,
                    "max_retries": self.max_retries,
                },
            }

        except Exception as e:
            raise RuntimeError(f"Failed to get queue stats: {e}")

    async def _save_job(self, job: Job) -> None:
        """Save job data to Redis."""
        if not self._redis:
            return

        await self._redis.hset(self._job_data, job.job_id, json.dumps(job.to_dict()))

    async def _update_stats(self, stat_type: str) -> None:
        """Update queue statistics."""
        if not self._redis:
            return

        await self._redis.hincrby(self._job_stats, stat_type, 1)

    async def _cleanup_worker(self) -> None:
        """Background worker for cleaning up old jobs."""
        while self._running:
            try:
                await asyncio.sleep(self.cleanup_interval)

                if not self._running:
                    break

                await self._cleanup_old_jobs()

            except Exception as e:
                print(f"Job queue cleanup error: {e}")
                continue

    async def _cleanup_old_jobs(self) -> None:
        """Clean up old completed and failed jobs."""
        if not self._redis:
            return

        try:
            # Clean up completed jobs older than 7 days
            cutoff_time = time.time() - (7 * 24 * 3600)  # 7 days ago

            old_completed = await self._redis.zrangebyscore(
                self._completed_queue, 0, cutoff_time
            )

            for job_id in old_completed:
                await self._redis.zrem(self._completed_queue, job_id)
                await self._redis.hdel(self._job_data, job_id)

            # Clean up failed jobs older than 30 days
            failed_cutoff = time.time() - (30 * 24 * 3600)  # 30 days ago

            old_failed = await self._redis.zrangebyscore(
                self._failed_queue, 0, failed_cutoff
            )

            for job_id in old_failed:
                await self._redis.zrem(self._failed_queue, job_id)
                await self._redis.hdel(self._job_data, job_id)

            # Clean up timed out processing jobs
            processing_cutoff = time.time() - self.job_timeout

            timed_out_jobs = await self._redis.zrangebyscore(
                self._processing_queue, 0, processing_cutoff
            )

            for job_id in timed_out_jobs:
                # Mark as failed and retry if possible
                await self.complete_job(job_id, False, "Job timed out")

            if old_completed or old_failed or timed_out_jobs:
                print(
                    f"Cleaned up {len(old_completed)} completed, {len(old_failed)} failed, and {len(timed_out_jobs)} timed out jobs"
                )

        except Exception as e:
            print(f"Error during job cleanup: {e}")

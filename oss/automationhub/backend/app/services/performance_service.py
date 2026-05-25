"""
Performance Optimization Service
Provides query optimization, background job processing, and performance monitoring
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import statistics
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.services.cache_service import cache_service, CacheStrategy
from app.core.database import get_db_session

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Background job status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class JobPriority(str, Enum):
    """Job priority levels"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class QueryOptimizationType(str, Enum):
    """Query optimization types"""
    INDEX_HINT = "index_hint"
    QUERY_REWRITE = "query_rewrite"
    BATCH_PROCESSING = "batch_processing"
    CACHING = "caching"
    PAGINATION = "pagination"


@dataclass
class BackgroundJob:
    """Background job definition"""
    id: str
    name: str
    function: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    priority: JobPriority = JobPriority.NORMAL
    status: JobStatus = JobStatus.PENDING
    scheduled_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 300
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QueryMetrics:
    """Query performance metrics"""
    query_hash: str
    execution_time: float
    rows_affected: int
    timestamp: datetime
    optimization_applied: bool = False
    optimization_type: Optional[QueryOptimizationType] = None
    cache_hit: bool = False


class PerformanceMetrics(BaseModel):
    """Overall performance metrics"""
    avg_query_time: float = 0.0
    total_queries: int = 0
    cached_queries: int = 0
    cache_hit_ratio: float = 0.0
    background_jobs_completed: int = 0
    background_jobs_failed: int = 0
    system_load: float = 0.0
    memory_usage: int = 0


class PerformanceOptimizationService:
    """
    Performance optimization service that provides query optimization,
    background job processing, and performance monitoring
    """

    def __init__(self):
        self.job_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.running_jobs: Dict[str, BackgroundJob] = {}
        self.completed_jobs: Dict[str, BackgroundJob] = {}
        self.failed_jobs: Dict[str, BackgroundJob] = {}

        # Performance tracking
        self.query_metrics: List[QueryMetrics] = []
        self.max_metrics_history = 10000

        # Query optimization cache
        self.query_cache: Dict[str, Any] = {}
        self.query_plans: Dict[str, str] = {}

        # Worker management
        self.workers_running = False
        self.worker_count = 3
        self.thread_pool = ThreadPoolExecutor(max_workers=5)

        # Performance monitoring
        self.metrics = PerformanceMetrics()

    async def initialize(self):
        """Initialize performance service"""
        try:
            # Initialize cache service
            if not cache_service.initialized:
                await cache_service.initialize()

            # Start background workers
            await self._start_workers()

            logger.info("Performance optimization service initialized")

        except Exception as e:
            logger.error(f"Failed to initialize performance service: {e}")

    async def _start_workers(self):
        """Start background job workers"""
        if self.workers_running:
            return

        self.workers_running = True

        # Start worker tasks
        for i in range(self.worker_count):
            asyncio.create_task(self._worker(f"worker-{i}"))

        logger.info(f"Started {self.worker_count} background workers")

    async def _worker(self, worker_name: str):
        """Background job worker"""
        logger.info(f"Started performance worker: {worker_name}")

        while self.workers_running:
            try:
                # Get job from queue with timeout
                try:
                    priority, job = await asyncio.wait_for(
                        self.job_queue.get(),
                        timeout=1.0
                    )
                    await self._execute_job(job)
                except asyncio.TimeoutError:
                    continue

            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")

    async def _execute_job(self, job: BackgroundJob):
        """Execute a background job"""
        try:
            logger.info(f"Executing job: {job.name} (ID: {job.id})")

            job.status = JobStatus.RUNNING
            job.started_at = datetime.now()
            self.running_jobs[job.id] = job

            # Execute job with timeout
            try:
                if asyncio.iscoroutinefunction(job.function):
                    result = await asyncio.wait_for(
                        job.function(*job.args, **job.kwargs),
                        timeout=job.timeout_seconds
                    )
                else:
                    # Run sync function in thread pool
                    result = await asyncio.get_event_loop().run_in_executor(
                        self.thread_pool,
                        lambda: job.function(*job.args, **job.kwargs)
                    )

                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.now()
                job.metadata['result'] = result

                # Move to completed jobs
                self.completed_jobs[job.id] = job
                self.running_jobs.pop(job.id, None)

                self.metrics.background_jobs_completed += 1
                logger.info(f"Job completed: {job.name}")

            except asyncio.TimeoutError:
                job.status = JobStatus.FAILED
                job.error_message = f"Job timed out after {job.timeout_seconds} seconds"
                await self._handle_job_failure(job)

            except Exception as e:
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                await self._handle_job_failure(job)

        except Exception as e:
            logger.error(f"Job execution error: {e}")

    async def _handle_job_failure(self, job: BackgroundJob):
        """Handle job failure with retry logic"""
        try:
            job.retry_count += 1

            if job.retry_count <= job.max_retries:
                # Retry job
                job.status = JobStatus.RETRYING
                job.scheduled_at = datetime.now() + timedelta(seconds=2 ** job.retry_count)

                # Re-queue job with delay
                await asyncio.sleep(2 ** job.retry_count)
                await self.schedule_job(
                    job.name, job.function, *job.args,
                    priority=job.priority,
                    max_retries=job.max_retries - job.retry_count,
                    **job.kwargs
                )

                logger.info(f"Retrying job {job.name} (attempt {job.retry_count})")
            else:
                # Job failed permanently
                job.completed_at = datetime.now()
                self.failed_jobs[job.id] = job
                self.running_jobs.pop(job.id, None)
                self.metrics.background_jobs_failed += 1

                logger.error(f"Job failed permanently: {job.name} - {job.error_message}")

        except Exception as e:
            logger.error(f"Error handling job failure: {e}")

    async def schedule_job(
        self,
        name: str,
        function: Callable,
        *args,
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = 3,
        timeout_seconds: int = 300,
        **kwargs
    ) -> str:
        """Schedule a background job"""
        try:
            job_id = f"{name}_{int(time.time() * 1000)}"

            job = BackgroundJob(
                id=job_id,
                name=name,
                function=function,
                args=args,
                kwargs=kwargs,
                priority=priority,
                max_retries=max_retries,
                timeout_seconds=timeout_seconds
            )

            # Priority mapping for queue
            priority_values = {
                JobPriority.LOW: 4,
                JobPriority.NORMAL: 3,
                JobPriority.HIGH: 2,
                JobPriority.CRITICAL: 1
            }

            queue_priority = priority_values.get(priority, 3)
            await self.job_queue.put((queue_priority, job))

            logger.info(f"Scheduled background job: {name} (ID: {job_id})")
            return job_id

        except Exception as e:
            logger.error(f"Error scheduling job {name}: {e}")
            raise

    async def optimize_query(
        self,
        query: str,
        params: Dict[str, Any] = None,
        use_cache: bool = True,
        optimization_type: QueryOptimizationType = QueryOptimizationType.CACHING
    ) -> Any:
        """Optimize and execute database query"""
        start_time = time.time()
        params = params or {}

        try:
            # Generate query hash for caching
            query_hash = self._generate_query_hash(query, params)

            # Check cache first
            if use_cache:
                cached_result = await cache_service.get(
                    query_hash,
                    namespace="query_cache",
                    **params
                )
                if cached_result is not None:
                    execution_time = time.time() - start_time
                    await self._record_query_metrics(
                        query_hash, execution_time, 0, True, optimization_type
                    )
                    return cached_result

            # Apply query optimizations
            optimized_query = await self._apply_query_optimizations(query, optimization_type)

            # Execute query
            async with get_db_session() as session:
                result = await session.execute(text(optimized_query), params)

                if result.returns_rows:
                    rows = result.fetchall()
                    row_count = len(rows)
                    # Convert to list of dicts for JSON serialization
                    result_data = [dict(row._mapping) for row in rows]
                else:
                    result_data = {"rows_affected": result.rowcount}
                    row_count = result.rowcount

            execution_time = time.time() - start_time

            # Cache result if beneficial
            if use_cache and execution_time > 0.1:  # Cache slow queries
                await cache_service.set(
                    query_hash,
                    result_data,
                    ttl=3600,  # 1 hour
                    namespace="query_cache",
                    tags=["queries", f"optimization_{optimization_type.value}"],
                    strategy=CacheStrategy.WRITE_THROUGH,
                    **params
                )

            # Record metrics
            await self._record_query_metrics(
                query_hash, execution_time, row_count, False, optimization_type
            )

            return result_data

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Query optimization error: {e}")
            # Record failed query metrics
            await self._record_query_metrics(
                self._generate_query_hash(query, params),
                execution_time, 0, False, optimization_type
            )
            raise

    def _generate_query_hash(self, query: str, params: Dict[str, Any]) -> str:
        """Generate unique hash for query and parameters"""
        import hashlib
        query_str = f"{query}:{sorted(params.items())}"
        return hashlib.md5(query_str.encode()).hexdigest()

    async def _apply_query_optimizations(
        self,
        query: str,
        optimization_type: QueryOptimizationType
    ) -> str:
        """Apply query optimizations based on type"""
        try:
            if optimization_type == QueryOptimizationType.INDEX_HINT:
                # Add index hints for known patterns
                if "SELECT" in query.upper() and "WHERE" in query.upper():
                    # This is a simplified example - real implementation would be more sophisticated
                    return query

            elif optimization_type == QueryOptimizationType.QUERY_REWRITE:
                # Rewrite inefficient query patterns
                # Example: Convert subqueries to JOINs where beneficial
                return query

            elif optimization_type == QueryOptimizationType.PAGINATION:
                # Add pagination for large result sets
                if "LIMIT" not in query.upper():
                    query += " LIMIT 1000"  # Default limit

            return query

        except Exception as e:
            logger.warning(f"Query optimization failed: {e}")
            return query  # Return original query if optimization fails

    async def _record_query_metrics(
        self,
        query_hash: str,
        execution_time: float,
        rows_affected: int,
        cache_hit: bool,
        optimization_type: QueryOptimizationType
    ):
        """Record query performance metrics"""
        try:
            metric = QueryMetrics(
                query_hash=query_hash,
                execution_time=execution_time,
                rows_affected=rows_affected,
                timestamp=datetime.now(),
                optimization_applied=True,
                optimization_type=optimization_type,
                cache_hit=cache_hit
            )

            self.query_metrics.append(metric)

            # Limit metrics history
            if len(self.query_metrics) > self.max_metrics_history:
                self.query_metrics = self.query_metrics[-self.max_metrics_history:]

            # Update overall metrics
            self.metrics.total_queries += 1
            if cache_hit:
                self.metrics.cached_queries += 1

            # Update averages
            recent_metrics = self.query_metrics[-100:]  # Last 100 queries
            if recent_metrics:
                self.metrics.avg_query_time = statistics.mean(
                    [m.execution_time for m in recent_metrics]
                )
                self.metrics.cache_hit_ratio = (
                    sum(1 for m in recent_metrics if m.cache_hit) / len(recent_metrics) * 100
                )

        except Exception as e:
            logger.error(f"Error recording query metrics: {e}")

    async def batch_process(
        self,
        items: List[Any],
        processor_function: Callable,
        batch_size: int = 100,
        max_workers: int = 3
    ) -> List[Any]:
        """Process items in optimized batches"""
        try:
            results = []
            batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]

            # Process batches concurrently
            semaphore = asyncio.Semaphore(max_workers)

            async def process_batch(batch):
                async with semaphore:
                    if asyncio.iscoroutinefunction(processor_function):
                        return await processor_function(batch)
                    else:
                        return await asyncio.get_event_loop().run_in_executor(
                            self.thread_pool, processor_function, batch
                        )

            # Execute all batches
            batch_results = await asyncio.gather(
                *[process_batch(batch) for batch in batches],
                return_exceptions=True
            )

            # Flatten results
            for batch_result in batch_results:
                if isinstance(batch_result, Exception):
                    logger.error(f"Batch processing error: {batch_result}")
                else:
                    if isinstance(batch_result, list):
                        results.extend(batch_result)
                    else:
                        results.append(batch_result)

            logger.info(f"Batch processed {len(items)} items in {len(batches)} batches")
            return results

        except Exception as e:
            logger.error(f"Batch processing error: {e}")
            raise

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a background job"""
        try:
            # Check running jobs
            if job_id in self.running_jobs:
                job = self.running_jobs[job_id]
                return {
                    "id": job.id,
                    "name": job.name,
                    "status": job.status.value,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "retry_count": job.retry_count,
                    "metadata": job.metadata
                }

            # Check completed jobs
            if job_id in self.completed_jobs:
                job = self.completed_jobs[job_id]
                duration = None
                if job.started_at and job.completed_at:
                    duration = (job.completed_at - job.started_at).total_seconds()

                return {
                    "id": job.id,
                    "name": job.name,
                    "status": job.status.value,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "duration_seconds": duration,
                    "metadata": job.metadata
                }

            # Check failed jobs
            if job_id in self.failed_jobs:
                job = self.failed_jobs[job_id]
                return {
                    "id": job.id,
                    "name": job.name,
                    "status": job.status.value,
                    "error_message": job.error_message,
                    "retry_count": job.retry_count,
                    "failed_at": job.completed_at.isoformat() if job.completed_at else None
                }

            return None

        except Exception as e:
            logger.error(f"Error getting job status: {e}")
            return None

    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        try:
            # Job metrics
            total_jobs = (
                len(self.running_jobs) +
                len(self.completed_jobs) +
                len(self.failed_jobs)
            )

            job_success_rate = 0
            if total_jobs > 0:
                job_success_rate = (len(self.completed_jobs) / total_jobs) * 100

            # Query metrics
            recent_queries = self.query_metrics[-1000:]  # Last 1000 queries
            slow_queries = [q for q in recent_queries if q.execution_time > 1.0]

            # Cache metrics
            cache_metrics = await cache_service.get_metrics()

            return {
                "query_performance": {
                    "total_queries": self.metrics.total_queries,
                    "avg_query_time_ms": round(self.metrics.avg_query_time * 1000, 2),
                    "cache_hit_ratio": round(self.metrics.cache_hit_ratio, 2),
                    "slow_queries_count": len(slow_queries),
                    "recent_queries": len(recent_queries)
                },
                "background_jobs": {
                    "running": len(self.running_jobs),
                    "completed": len(self.completed_jobs),
                    "failed": len(self.failed_jobs),
                    "success_rate": round(job_success_rate, 2),
                    "queue_size": self.job_queue.qsize()
                },
                "cache_performance": cache_metrics,
                "system": {
                    "workers_running": self.workers_running,
                    "worker_count": self.worker_count,
                    "thread_pool_active": self.thread_pool._threads
                }
            }

        except Exception as e:
            logger.error(f"Error getting performance metrics: {e}")
            return {"error": str(e)}

    async def health_check(self) -> Dict[str, Any]:
        """Perform performance service health check"""
        try:
            status = "healthy"
            issues = []

            # Check workers
            if not self.workers_running:
                issues.append("Background workers not running")
                status = "unhealthy"

            # Check queue size
            queue_size = self.job_queue.qsize()
            if queue_size > 100:
                issues.append(f"High queue size: {queue_size}")
                status = "degraded"

            # Check recent failures
            recent_failures = len([
                job for job in self.failed_jobs.values()
                if job.completed_at and
                job.completed_at > datetime.now() - timedelta(hours=1)
            ])

            if recent_failures > 10:
                issues.append(f"High failure rate: {recent_failures} in last hour")
                status = "degraded"

            return {
                "service_name": "performance_optimization",
                "status": status,
                "timestamp": datetime.now().isoformat(),
                "issues": issues,
                "metrics": await self.get_performance_metrics()
            }

        except Exception as e:
            logger.error(f"Performance health check failed: {e}")
            return {
                "service_name": "performance_optimization",
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def cleanup(self):
        """Cleanup resources"""
        try:
            self.workers_running = False
            self.thread_pool.shutdown(wait=True)
            await cache_service.cleanup()
            logger.info("Performance service cleanup completed")
        except Exception as e:
            logger.error(f"Performance cleanup error: {e}")


# Global performance service instance
performance_service = PerformanceOptimizationService()
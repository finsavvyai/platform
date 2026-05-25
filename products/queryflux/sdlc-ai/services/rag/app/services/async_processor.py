"""
Async Processing Pipeline

High-performance asynchronous task queue management for RAG service with:
- Background job processing
- Concurrent request handling
- Async context management
- Error recovery and retry logic
- Performance monitoring
- Resource management and cleanup
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, AsyncGenerator, Union
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import json
import traceback
import weakref
from contextlib import asynccontextmanager

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    TIMEOUT = "timeout"


class TaskPriority(str, Enum):
    """Task priority levels"""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TaskConfig:
    """Configuration for task execution"""

    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    timeout_seconds: Optional[float] = None
    priority: TaskPriority = TaskPriority.NORMAL
    queue_name: str = "default"
    metadata: Dict[str, Any] = field(default_factory=dict)
    callback_url: Optional[str] = None
    webhook_secret: Optional[str] = None


@dataclass
class AsyncTask:
    """Asynchronous task representation"""

    task_id: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    config: TaskConfig = field(default_factory=TaskConfig)

    # Runtime state
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
    retry_count: int = 0

    # Performance metrics
    execution_time_ms: Optional[float] = None
    wait_time_ms: Optional[float] = None
    memory_usage_mb: Optional[float] = None

    # Dependencies and relationships
    dependencies: List[str] = field(default_factory=list)
    dependents: List[str] = field(default_factory=list)

    # Context management
    context: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Post-initialization setup"""
        if not self.task_id:
            self.task_id = str(uuid.uuid4())


@dataclass
class TaskQueue:
    """Task queue with priority support"""

    name: str
    max_size: int = 1000
    max_workers: int = 10

    # Queue storage (organized by priority)
    _queues: Dict[TaskPriority, deque] = field(
        default_factory=lambda: defaultdict(deque)
    )

    # Worker management
    _workers: List[asyncio.Task] = field(default_factory=list)
    _active_tasks: Dict[str, AsyncTask] = field(default_factory=dict)
    _completed_tasks: Dict[str, AsyncTask] = field(default_factory=dict)

    # Queue metrics
    _total_tasks: int = 0
    _completed_count: int = 0
    _failed_count: int = 0
    _cancelled_count: int = 0

    # Synchronization
    _queue_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _worker_semaphore: asyncio.Semaphore = field(
        default_factory=lambda: asyncio.Semaphore(10)
    )
    _not_empty: asyncio.Condition = field(
        default_factory=lambda: asyncio.Condition(asyncio.Lock())
    )

    def __post_init__(self):
        """Initialize queue"""
        self._worker_semaphore = asyncio.Semaphore(self.max_workers)


@dataclass
class ProcessorMetrics:
    """Processor performance metrics"""

    total_tasks_processed: int = 0
    tasks_per_second: float = 0.0
    average_execution_time_ms: float = 0.0
    average_wait_time_ms: float = 0.0
    success_rate: float = 0.0
    error_rate: float = 0.0
    memory_usage_mb: float = 0.0
    active_workers: int = 0
    queue_sizes: Dict[str, int] = field(default_factory=dict)

    # Detailed metrics
    execution_times: List[float] = field(default_factory=list)
    wait_times: List[float] = field(default_factory=list)
    error_types: Dict[str, int] = field(default_factory=int)
    priority_distribution: Dict[TaskPriority, int] = field(default_factory=int)


class AsyncProcessor:
    """High-performance asynchronous task processor"""

    def __init__(self):
        self._queues: Dict[str, TaskQueue] = {}
        self._tasks: Dict[str, AsyncTask] = {}
        self._workers: List[asyncio.Task] = []

        # Metrics and monitoring
        self._metrics = ProcessorMetrics()
        self._start_time = datetime.utcnow()

        # Configuration
        self._max_queues = 100
        self._max_total_workers = 100
        self._cleanup_interval_seconds = 300  # 5 minutes
        self._metrics_update_interval_seconds = 60  # 1 minute

        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        self._metrics_task: Optional[asyncio.Task] = None

        # Event handlers
        self._task_callbacks: Dict[str, List[Callable]] = defaultdict(list)
        self._error_handlers: List[Callable] = []

        # Shutdown flag
        self._shutdown = False
        self._shutdown_event = asyncio.Event()

        logger.info("Async Processor initialized")

    async def start(self) -> None:
        """Start the async processor"""
        logger.info("Starting Async Processor...")

        # Start background tasks
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        self._metrics_task = asyncio.create_task(self._metrics_loop())

        # Initialize default queue
        await self.create_queue("default", max_size=1000, max_workers=10)

        logger.info("Async Processor started successfully")

    async def stop(self) -> None:
        """Stop the async processor gracefully"""
        logger.info("Stopping Async Processor...")

        # Set shutdown flag
        self._shutdown = True
        self._shutdown_event.set()

        # Cancel background tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._metrics_task:
            self._metrics_task.cancel()

        # Wait for all workers to complete
        for queue in self._queues.values():
            for worker in queue._workers:
                if not worker.done():
                    worker.cancel()

        # Wait for all workers to finish
        await asyncio.gather(
            *[worker for worker in self._workers], return_exceptions=True
        )

        logger.info("Async Processor stopped")

    async def create_queue(
        self, name: str, max_size: int = 1000, max_workers: int = 10
    ) -> None:
        """Create a new task queue"""
        async with self._queue_lock if hasattr(self, "_queue_lock") else asyncio.Lock():
            if name in self._queues:
                logger.warning(f"Queue '{name}' already exists")
                return

            if len(self._queues) >= self._max_queues:
                raise ValueError(
                    f"Maximum number of queues ({self._max_queues}) reached"
                )

            queue = TaskQueue(name=name, max_size=max_size, max_workers=max_workers)
            self._queues[name] = queue

            # Start workers for this queue
            for i in range(max_workers):
                worker = asyncio.create_task(
                    self._worker_loop(queue, f"{name}-worker-{i}")
                )
                queue._workers.append(worker)
                self._workers.append(worker)

            logger.info(f"Created queue '{name}' with {max_workers} workers")

    async def submit_task(
        self,
        func: Callable,
        *args,
        task_id: Optional[str] = None,
        queue: str = "default",
        priority: TaskPriority = TaskPriority.NORMAL,
        max_retries: int = 3,
        timeout_seconds: Optional[float] = None,
        dependencies: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> str:
        """Submit a task for asynchronous processing"""
        if self._shutdown:
            raise RuntimeError("Processor is shutting down")

        # Create task configuration
        config = TaskConfig(
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
            priority=priority,
            queue_name=queue,
            metadata=metadata or {},
        )

        # Create task
        task = AsyncTask(
            task_id=task_id or str(uuid.uuid4()),
            func=func,
            args=args,
            kwargs=kwargs,
            config=config,
            dependencies=dependencies or [],
        )

        # Store task
        self._tasks[task.task_id] = task

        # Add to queue
        await self._add_to_queue(task, queue)

        # Trigger callbacks
        await self._trigger_callbacks("task_submitted", task)

        logger.debug(f"Submitted task {task.task_id} to queue '{queue}'")
        return task.task_id

    async def get_task(self, task_id: str) -> Optional[AsyncTask]:
        """Get task by ID"""
        return self._tasks.get(task_id)

    async def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get task status"""
        task = await self.get_task(task_id)
        return task.status if task else None

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a task"""
        task = await self.get_task(task_id)
        if not task:
            return False

        if task.status in [
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
        ]:
            return False

        task.status = TaskStatus.CANCELLED
        task.completed_at = datetime.utcnow()

        # Remove from queue if pending
        queue = self._queues.get(task.config.queue_name)
        if queue:
            async with queue._queue_lock:
                for priority_queue in queue._queues.values():
                    if task in priority_queue:
                        priority_queue.remove(task)
                        break

        # Trigger callbacks
        await self._trigger_callbacks("task_cancelled", task)

        logger.info(f"Cancelled task {task_id}")
        return True

    async def wait_for_task(
        self, task_id: str, timeout_seconds: Optional[float] = None
    ) -> AsyncTask:
        """Wait for task completion"""
        start_time = time.time()

        while True:
            task = await self.get_task(task_id)
            if not task:
                raise ValueError(f"Task {task_id} not found")

            if task.status in [
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ]:
                return task

            if timeout_seconds and (time.time() - start_time) > timeout_seconds:
                raise TimeoutError(
                    f"Task {task_id} did not complete within {timeout_seconds} seconds"
                )

            await asyncio.sleep(0.1)

    async def get_queue_status(self, queue_name: str) -> Optional[Dict[str, Any]]:
        """Get queue status information"""
        queue = self._queues.get(queue_name)
        if not queue:
            return None

        async with queue._queue_lock:
            total_queued = sum(len(q) for q in queue._queues.values())

            return {
                "name": queue.name,
                "total_queued": total_queued,
                "active_tasks": len(queue._active_tasks),
                "completed_tasks": len(queue._completed_tasks),
                "total_processed": queue._completed_count
                + queue._failed_count
                + queue._cancelled_count,
                "success_rate": queue._completed_count
                / max(
                    1,
                    queue._completed_count
                    + queue._failed_count
                    + queue._cancelled_count,
                ),
                "workers": len(queue._workers),
                "max_workers": queue.max_workers,
                "max_size": queue.max_size,
                "queues_by_priority": {
                    priority.value: len(queue._queues[priority])
                    for priority in TaskPriority
                },
            }

    async def get_metrics(self) -> ProcessorMetrics:
        """Get processor metrics"""
        # Update queue sizes
        self._metrics.queue_sizes = {
            name: sum(len(q._queues[p]) for p in TaskPriority)
            for name, q in self._queues.items()
        }

        # Calculate success rate
        total_completed = self._metrics.total_tasks_processed
        if total_completed > 0:
            self._metrics.success_rate = (
                total_completed - self._metrics.error_rate * total_completed
            ) / total_completed

        # Calculate tasks per second
        uptime_seconds = (datetime.utcnow() - self._start_time).total_seconds()
        if uptime_seconds > 0:
            self._metrics.tasks_per_second = total_completed / uptime_seconds

        return self._metrics

    async def _add_to_queue(self, task: AsyncTask, queue_name: str) -> None:
        """Add task to queue"""
        queue = self._queues.get(queue_name)
        if not queue:
            raise ValueError(f"Queue '{queue_name}' not found")

        async with queue._queue_lock:
            total_queued = sum(len(q) for q in queue._queues.values())
            if total_queued >= queue.max_size:
                raise RuntimeError(f"Queue '{queue_name}' is full")

            queue._queues[task.config.priority].append(task)
            queue._total_tasks += 1

            # Notify workers
            async with queue._not_empty:
                queue._not_empty.notify()

    async def _worker_loop(self, queue: TaskQueue, worker_name: str) -> None:
        """Worker loop for processing tasks"""
        logger.debug(f"Starting worker {worker_name}")

        while not self._shutdown:
            try:
                # Get next task
                task = await self._get_next_task(queue)
                if not task:
                    continue

                # Process task
                await self._process_task(task, queue)

            except asyncio.CancelledError:
                logger.debug(f"Worker {worker_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")
                await asyncio.sleep(1)  # Prevent rapid error loops

        logger.debug(f"Worker {worker_name} stopped")

    async def _get_next_task(self, queue: TaskQueue) -> Optional[AsyncTask]:
        """Get next task from queue"""
        async with queue._not_empty:
            # Wait for task
            while True:
                # Check queues in priority order
                for priority in [
                    TaskPriority.CRITICAL,
                    TaskPriority.HIGH,
                    TaskPriority.NORMAL,
                    TaskPriority.LOW,
                ]:
                    if queue._queues[priority]:
                        task = queue._queues[priority].popleft()
                        return task

                if self._shutdown:
                    return None

                # Wait for notification
                await queue._not_empty.wait()

    async def _process_task(self, task: AsyncTask, queue: TaskQueue) -> None:
        """Process a single task"""
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()

        # Calculate wait time
        if task.started_at and task.created_at:
            task.wait_time_ms = (
                task.started_at - task.created_at
            ).total_seconds() * 1000

        # Add to active tasks
        queue._active_tasks[task.task_id] = task

        # Trigger callbacks
        await self._trigger_callbacks("task_started", task)

        try:
            # Execute task with timeout
            if task.config.timeout_seconds:
                result = await asyncio.wait_for(
                    self._execute_task_with_context(task),
                    timeout=task.config.timeout_seconds,
                )
            else:
                result = await self._execute_task_with_context(task)

            # Task completed successfully
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()

            # Calculate execution time
            if task.completed_at and task.started_at:
                task.execution_time_ms = (
                    task.completed_at - task.started_at
                ).total_seconds() * 1000

            # Update metrics
            queue._completed_count += 1
            self._metrics.total_tasks_processed += 1

            # Trigger callbacks
            await self._trigger_callbacks("task_completed", task)

            logger.debug(f"Task {task.task_id} completed successfully")

        except asyncio.TimeoutError:
            # Task timed out
            task.status = TaskStatus.TIMEOUT
            task.error = "Task execution timed out"
            task.completed_at = datetime.utcnow()

            queue._failed_count += 1
            await self._trigger_callbacks("task_failed", task)

        except Exception as e:
            # Task failed
            task.error = str(e)
            task.traceback = traceback.format_exc()

            # Check if we should retry
            if task.retry_count < task.config.max_retries:
                task.status = TaskStatus.RETRYING
                task.retry_count += 1

                # Schedule retry with delay
                await asyncio.sleep(task.config.retry_delay_seconds)
                await self._retry_task(task, queue)
            else:
                task.status = TaskStatus.FAILED
                task.completed_at = datetime.utcnow()

                queue._failed_count += 1
                await self._trigger_callbacks("task_failed", task)

                # Trigger error handlers
                await self._trigger_error_handlers(task)

            logger.error(f"Task {task.task_id} failed: {e}")

        finally:
            # Remove from active tasks
            queue._active_tasks.pop(task.task_id, None)

            # Move to completed tasks
            if task.status in [
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
                TaskStatus.TIMEOUT,
            ]:
                queue._completed_tasks[task.task_id] = task

                # Update metrics
                if task.execution_time_ms:
                    self._metrics.execution_times.append(task.execution_time_ms)
                if task.wait_time_ms:
                    self._metrics.wait_times.append(task.wait_time_ms)

    async def _execute_task_with_context(self, task: AsyncTask) -> Any:
        """Execute task with context management"""
        # Create context for task execution
        context = {
            "task_id": task.task_id,
            "queue": task.config.queue_name,
            "priority": task.config.priority,
            "retry_count": task.retry_count,
            "created_at": task.created_at,
            "started_at": datetime.utcnow(),
        }

        # Merge with existing context
        task.context.update(context)

        # Execute the function
        if asyncio.iscoroutinefunction(task.func):
            result = await task.func(*task.args, **task.kwargs, _context=task.context)
        else:
            # Run synchronous function in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: task.func(*task.args, **task.kwargs, _context=task.context),
            )

        return result

    async def _retry_task(self, task: AsyncTask, queue: TaskQueue) -> None:
        """Retry a failed task"""
        logger.info(f"Retrying task {task.task_id} (attempt {task.retry_count + 1})")

        # Reset task state
        task.status = TaskStatus.PENDING
        task.started_at = None
        task.error = None
        task.traceback = None

        # Add back to queue
        await self._add_to_queue(task, queue.config.queue_name)

    async def _cleanup_loop(self) -> None:
        """Background cleanup loop"""
        while not self._shutdown:
            try:
                await self._cleanup_completed_tasks()
                await asyncio.sleep(self._cleanup_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(60)

    async def _cleanup_completed_tasks(self) -> None:
        """Clean up old completed tasks"""
        cutoff_time = datetime.utcnow() - timedelta(hours=1)

        for queue in self._queues.values():
            # Remove old completed tasks
            old_tasks = [
                task_id
                for task_id, task in queue._completed_tasks.items()
                if task.completed_at and task.completed_at < cutoff_time
            ]

            for task_id in old_tasks:
                del queue._completed_tasks[task_id]

                # Also remove from global tasks
                self._tasks.pop(task_id, None)

            if old_tasks:
                logger.debug(
                    f"Cleaned up {len(old_tasks)} old tasks from queue '{queue.name}'"
                )

    async def _metrics_loop(self) -> None:
        """Background metrics update loop"""
        while not self._shutdown:
            try:
                await self._update_metrics()
                await asyncio.sleep(self._metrics_update_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Metrics loop error: {e}")
                await asyncio.sleep(60)

    async def _update_metrics(self) -> None:
        """Update performance metrics"""
        # Calculate averages
        if self._metrics.execution_times:
            self._metrics.average_execution_time_ms = sum(
                self._metrics.execution_times
            ) / len(self._metrics.execution_times)
            # Keep only recent values
            if len(self._metrics.execution_times) > 1000:
                self._metrics.execution_times = self._metrics.execution_times[-1000:]

        if self._metrics.wait_times:
            self._metrics.average_wait_time_ms = sum(self._metrics.wait_times) / len(
                self._metrics.wait_times
            )
            # Keep only recent values
            if len(self._metrics.wait_times) > 1000:
                self._metrics.wait_times = self._metrics.wait_times[-1000:]

        # Calculate error rate
        total_tasks = sum(
            q._completed_count + q._failed_count for q in self._queues.values()
        )
        failed_tasks = sum(q._failed_count for q in self._queues.values())

        if total_tasks > 0:
            self._metrics.error_rate = failed_tasks / total_tasks

        # Update active workers count
        self._metrics.active_workers = sum(
            len(q._workers) for q in self._queues.values()
        )

    async def _trigger_callbacks(self, event_type: str, task: AsyncTask) -> None:
        """Trigger event callbacks"""
        for callback in self._task_callbacks[event_type]:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(task)
                else:
                    callback(task)
            except Exception as e:
                logger.error(f"Callback error for {event_type}: {e}")

    async def _trigger_error_handlers(self, task: AsyncTask) -> None:
        """Trigger error handlers"""
        for handler in self._error_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(task)
                else:
                    handler(task)
            except Exception as e:
                logger.error(f"Error handler failed: {e}")

    def add_callback(self, event_type: str, callback: Callable) -> None:
        """Add event callback"""
        self._task_callbacks[event_type].append(callback)

    def add_error_handler(self, handler: Callable) -> None:
        """Add error handler"""
        self._error_handlers.append(handler)

    def remove_callback(self, event_type: str, callback: Callable) -> None:
        """Remove event callback"""
        if callback in self._task_callbacks[event_type]:
            self._task_callbacks[event_type].remove(callback)

    def remove_error_handler(self, handler: Callable) -> None:
        """Remove error handler"""
        if handler in self._error_handlers:
            self._error_handlers.remove(handler)


# Global processor instance
_processor_instance: Optional[AsyncProcessor] = None


async def get_async_processor() -> AsyncProcessor:
    """Get or create global async processor instance"""
    global _processor_instance

    if _processor_instance is None:
        _processor_instance = AsyncProcessor()
        await _processor_instance.start()

    return _processor_instance


async def shutdown_async_processor() -> None:
    """Shutdown global async processor"""
    global _processor_instance

    if _processor_instance:
        await _processor_instance.stop()
        _processor_instance = None


# Context manager for processor
@asynccontextmanager
async def async_processor_context():
    """Context manager for async processor"""
    processor = AsyncProcessor()
    await processor.start()

    try:
        yield processor
    finally:
        await processor.stop()


# Decorators for easy task submission
def async_task(
    queue: str = "default",
    priority: TaskPriority = TaskPriority.NORMAL,
    max_retries: int = 3,
    timeout_seconds: Optional[float] = None,
):
    """Decorator to make function async-task ready"""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            processor = await get_async_processor()
            return await processor.submit_task(
                func,
                *args,
                queue=queue,
                priority=priority,
                max_retries=max_retries,
                timeout_seconds=timeout_seconds,
                **kwargs,
            )

        # Preserve original function for direct calls
        wrapper._original_func = func
        wrapper._async_task_config = {
            "queue": queue,
            "priority": priority,
            "max_retries": max_retries,
            "timeout_seconds": timeout_seconds,
        }

        return wrapper

    return decorator


# Utility functions
async def submit_batch(
    func: Callable,
    items: List[Any],
    queue: str = "default",
    max_concurrent: int = 10,
    **task_kwargs,
) -> List[str]:
    """Submit multiple tasks for batch processing"""
    processor = await get_async_processor()

    # Create semaphore to limit concurrency
    semaphore = asyncio.Semaphore(max_concurrent)

    async def submit_single(item):
        async with semaphore:
            return await processor.submit_task(func, item, queue=queue, **task_kwargs)

    # Submit all tasks
    tasks = [submit_single(item) for item in items]
    return await asyncio.gather(*tasks)


async def wait_for_batch(
    task_ids: List[str], timeout_seconds: Optional[float] = None
) -> List[AsyncTask]:
    """Wait for multiple tasks to complete"""
    processor = await get_async_processor()

    tasks = [processor.wait_for_task(task_id, timeout_seconds) for task_id in task_ids]

    return await asyncio.gather(*tasks)

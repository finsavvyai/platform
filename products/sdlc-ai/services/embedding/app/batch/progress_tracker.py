"""
Progress tracking for batch embedding jobs.

This module provides comprehensive progress tracking with real-time updates,
WebSocket notifications, and detailed progress metrics.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from .job_queue import Job, JobStatus


class ProgressEvent:
    """Represents a progress event."""

    def __init__(
        self,
        job_id: str,
        event_type: str,
        data: Dict[str, Any],
        timestamp: Optional[datetime] = None,
    ):
        """Initialize progress event."""
        self.job_id = job_id
        self.event_type = event_type
        self.data = data
        self.timestamp = timestamp or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        return {
            "job_id": self.job_id,
            "event_type": self.event_type,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
        }


class ProgressTracker:
    """Tracks progress for embedding jobs with real-time updates."""

    def __init__(
        self,
        history_size: int = 1000,
        cleanup_interval: int = 3600,  # 1 hour
        event_retention_hours: int = 24,
    ):
        """
        Initialize progress tracker.

        Args:
            history_size: Size of event history buffer
            cleanup_interval: Cleanup interval in seconds
            event_retention_hours: Hours to retain events
        """
        self.history_size = history_size
        self.cleanup_interval = cleanup_interval
        self.event_retention_hours = event_retention_hours

        # Job progress tracking
        self._job_progress: Dict[str, Dict[str, Any]] = {}
        self._job_events: Dict[str, List[ProgressEvent]] = {}
        self._event_history: List[ProgressEvent] = []

        # Subscribers for real-time updates
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

        # Background task
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        """Start progress tracker background tasks."""
        if self._running:
            return

        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_worker())

    async def stop(self) -> None:
        """Stop progress tracker background tasks."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    def initialize_job(self, job: Job) -> None:
        """
        Initialize progress tracking for a job.

        Args:
            job: Job to track
        """
        self._job_progress[job.job_id] = {
            "job_id": job.job_id,
            "tenant_id": job.tenant_id,
            "status": job.status.value,
            "progress": 0.0,
            "processed_batches": 0,
            "total_batches": job.total_batches,
            "total_texts": len(job.texts),
            "provider": job.provider,
            "model": job.model,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "estimated_completion": None,
            "current_batch": 0,
            "batch_progress": 0.0,
            "error_message": None,
            "retry_count": job.retry_count,
            "processing_rate_texts_per_second": 0.0,
            "estimated_time_remaining_seconds": 0,
        }

        self._job_events[job.job_id] = []

        # Add initialization event
        self._add_event(
            job.job_id,
            "job_initialized",
            {
                "total_texts": len(job.texts),
                "total_batches": job.total_batches,
                "provider": job.provider,
                "model": job.model,
            },
        )

    def update_job_progress(
        self,
        job_id: str,
        processed_batches: int,
        current_batch: Optional[int] = None,
        batch_progress: Optional[float] = None,
    ) -> None:
        """
        Update job progress.

        Args:
            job_id: Job ID
            processed_batches: Number of processed batches
            current_batch: Currently processing batch
            batch_progress: Progress within current batch (0-1)
        """
        if job_id not in self._job_progress:
            return

        progress_data = self._job_progress[job_id]
        old_progress = progress_data["progress"]

        # Update progress
        progress_data["processed_batches"] = processed_batches
        progress_data["progress"] = processed_batches / progress_data["total_batches"]

        if current_batch is not None:
            progress_data["current_batch"] = current_batch

        if batch_progress is not None:
            progress_data["batch_progress"] = batch_progress

        # Calculate processing rate and estimates
        self._calculate_processing_estimates(job_id)

        # Add progress event
        self._add_event(
            job_id,
            "progress_updated",
            {
                "progress": progress_data["progress"],
                "processed_batches": processed_batches,
                "progress_delta": progress_data["progress"] - old_progress,
            },
        )

        # Notify subscribers
        asyncio.create_task(self._notify_subscribers(job_id, "progress", progress_data))

    def update_job_status(
        self, job_id: str, status: JobStatus, error_message: Optional[str] = None
    ) -> None:
        """
        Update job status.

        Args:
            job_id: Job ID
            status: New job status
            error_message: Error message if failed
        """
        if job_id not in self._job_progress:
            return

        progress_data = self._job_progress[job_id]
        old_status = progress_data["status"]

        progress_data["status"] = status.value

        if status == JobStatus.COMPLETED:
            progress_data["progress"] = 1.0
            progress_data["completed_at"] = datetime.utcnow().isoformat()
        elif status == JobStatus.FAILED:
            progress_data["error_message"] = error_message
            progress_data["failed_at"] = datetime.utcnow().isoformat()
        elif status == JobStatus.PROCESSING and not progress_data.get("started_at"):
            progress_data["started_at"] = datetime.utcnow().isoformat()

        # Add status event
        self._add_event(
            job_id,
            "status_updated",
            {
                "old_status": old_status,
                "new_status": status.value,
                "error_message": error_message,
            },
        )

        # Notify subscribers
        asyncio.create_task(self._notify_subscribers(job_id, "status", progress_data))

    def _calculate_processing_estimates(self, job_id: str) -> None:
        """Calculate processing rate and time estimates."""
        progress_data = self._job_progress[job_id]

        if not progress_data.get("started_at"):
            return

        started_at = datetime.fromisoformat(progress_data["started_at"])
        current_time = datetime.utcnow()
        elapsed_seconds = (current_time - started_at).total_seconds()

        if elapsed_seconds > 0 and progress_data["processed_batches"] > 0:
            # Calculate processing rate
            progress_data["processing_rate_texts_per_second"] = (
                progress_data["processed_batches"]
                * progress_data.get("batch_size", 100)
            ) / elapsed_seconds

            # Estimate time remaining
            remaining_batches = (
                progress_data["total_batches"] - progress_data["processed_batches"]
            )
            if progress_data["processing_rate_texts_per_second"] > 0:
                progress_data["estimated_time_remaining_seconds"] = (
                    remaining_batches
                    * progress_data.get("batch_size", 100)
                    / progress_data["processing_rate_texts_per_second"]
                )

                # Calculate estimated completion time
                estimated_completion = current_time + timedelta(
                    seconds=progress_data["estimated_time_remaining_seconds"]
                )
                progress_data["estimated_completion"] = estimated_completion.isoformat()

    def _add_event(self, job_id: str, event_type: str, data: Dict[str, Any]) -> None:
        """Add a progress event."""
        event = ProgressEvent(job_id, event_type, data)

        # Add to job-specific events
        if job_id not in self._job_events:
            self._job_events[job_id] = []

        self._job_events[job_id].append(event)

        # Limit job event history
        if len(self._job_events[job_id]) > self.history_size:
            self._job_events[job_id] = self._job_events[job_id][-self.history_size :]

        # Add to global event history
        self._event_history.append(event)

        # Limit global event history
        if len(self._event_history) > self.history_size * 10:
            self._event_history = self._event_history[-(self.history_size * 10) :]

    async def subscribe_to_job(self, job_id: str, queue: asyncio.Queue) -> None:
        """
        Subscribe to progress updates for a specific job.

        Args:
            job_id: Job ID to subscribe to
            queue: Queue for receiving updates
        """
        if job_id not in self._subscribers:
            self._subscribers[job_id] = set()

        self._subscribers[job_id].add(queue)

        # Send current progress
        if job_id in self._job_progress:
            await queue.put(
                {
                    "type": "progress",
                    "job_id": job_id,
                    "data": self._job_progress[job_id],
                }
            )

    def unsubscribe_from_job(self, job_id: str, queue: asyncio.Queue) -> None:
        """
        Unsubscribe from progress updates for a specific job.

        Args:
            job_id: Job ID to unsubscribe from
            queue: Queue to remove
        """
        if job_id in self._subscribers:
            self._subscribers[job_id].discard(queue)

            # Clean up empty subscriber sets
            if not self._subscribers[job_id]:
                del self._subscribers[job_id]

    async def _notify_subscribers(
        self, job_id: str, update_type: str, data: Dict[str, Any]
    ) -> None:
        """Notify all subscribers of a job."""
        if job_id not in self._subscribers:
            return

        message = {
            "type": update_type,
            "job_id": job_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Send to all subscribers
        for queue in self._subscribers[job_id].copy():
            try:
                await queue.put(message)
            except asyncio.QueueFull:
                # Remove full queues to prevent blocking
                self._subscribers[job_id].discard(queue)
            except Exception:
                # Remove problematic queues
                self._subscribers[job_id].discard(queue)

    def get_job_progress(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current progress for a job.

        Args:
            job_id: Job ID

        Returns:
            Job progress data or None if not found
        """
        return self._job_progress.get(job_id)

    def get_job_events(self, job_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get events for a specific job.

        Args:
            job_id: Job ID
            limit: Maximum number of events to return

        Returns:
            List of events
        """
        if job_id not in self._job_events:
            return []

        events = self._job_events[job_id][-limit:]
        return [event.to_dict() for event in events]

    def get_all_jobs_progress(
        self, tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get progress for all jobs.

        Args:
            tenant_id: Filter by tenant ID

        Returns:
            List of job progress data
        """
        jobs = []

        for job_id, progress_data in self._job_progress.items():
            if tenant_id is None or progress_data.get("tenant_id") == tenant_id:
                jobs.append(progress_data)

        return jobs

    def get_active_jobs(self, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get currently active jobs.

        Args:
            tenant_id: Filter by tenant ID

        Returns:
            List of active job progress data
        """
        active_statuses = [
            JobStatus.PENDING.value,
            JobStatus.QUEUED.value,
            JobStatus.PROCESSING.value,
        ]

        active_jobs = []
        for progress_data in self._job_progress.values():
            if progress_data["status"] in active_statuses:
                if tenant_id is None or progress_data.get("tenant_id") == tenant_id:
                    active_jobs.append(progress_data)

        return active_jobs

    def get_completion_stats(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get completion statistics for the last N hours.

        Args:
            hours: Number of hours to look back

        Returns:
            Completion statistics
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        completed_jobs = 0
        failed_jobs = 0
        total_processing_time = 0.0
        total_texts = 0

        for progress_data in self._job_progress.values():
            if progress_data.get("completed_at"):
                completed_at = datetime.fromisoformat(progress_data["completed_at"])
                if completed_at >= cutoff_time:
                    completed_jobs += 1
                    total_texts += progress_data["total_texts"]

                    # Calculate processing time
                    if progress_data.get("started_at"):
                        started_at = datetime.fromisoformat(progress_data["started_at"])
                        processing_time = (completed_at - started_at).total_seconds()
                        total_processing_time += processing_time

            elif progress_data.get("failed_at"):
                failed_at = datetime.fromisoformat(progress_data["failed_at"])
                if failed_at >= cutoff_time:
                    failed_jobs += 1

        return {
            "period_hours": hours,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "success_rate": completed_jobs / (completed_jobs + failed_jobs)
            if (completed_jobs + failed_jobs) > 0
            else 0.0,
            "total_texts_processed": total_texts,
            "average_processing_time_seconds": total_processing_time / completed_jobs
            if completed_jobs > 0
            else 0.0,
            "texts_per_hour": total_texts / hours if hours > 0 else 0.0,
        }

    async def _cleanup_worker(self) -> None:
        """Background worker for cleaning up old data."""
        while self._running:
            try:
                await asyncio.sleep(self.cleanup_interval)

                if not self._running:
                    break

                await self._cleanup_old_data()

            except Exception as e:
                print(f"Progress tracker cleanup error: {e}")
                continue

    async def _cleanup_old_data(self) -> None:
        """Clean up old progress data and events."""
        cutoff_time = datetime.utcnow() - timedelta(hours=self.event_retention_hours)

        # Clean up old job progress
        jobs_to_remove = []
        for job_id, progress_data in self._job_progress.items():
            # Remove jobs that are completed/failed and older than retention period
            if progress_data["status"] in [
                JobStatus.COMPLETED.value,
                JobStatus.FAILED.value,
            ]:
                timestamp_key = (
                    "completed_at"
                    if progress_data["status"] == JobStatus.COMPLETED.value
                    else "failed_at"
                )
                if timestamp_key in progress_data:
                    timestamp = datetime.fromisoformat(progress_data[timestamp_key])
                    if timestamp < cutoff_time:
                        jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            self._job_progress.pop(job_id, None)
            self._job_events.pop(job_id, None)
            self._subscribers.pop(job_id, None)

        # Clean up old events
        old_events = [
            event for event in self._event_history if event.timestamp < cutoff_time
        ]

        for event in old_events:
            self._event_history.remove(event)

        if jobs_to_remove or old_events:
            print(
                f"Cleaned up {len(jobs_to_remove)} old jobs and {len(old_events)} old events"
            )

    def export_progress_data(self, job_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Export progress data for analysis.

        Args:
            job_id: Specific job ID to export, or None for all jobs

        Returns:
            Exported progress data
        """
        if job_id:
            return {
                "job_progress": self._job_progress.get(job_id),
                "job_events": [
                    event.to_dict() for event in self._job_events.get(job_id, [])
                ],
            }
        else:
            return {
                "all_jobs_progress": self._job_progress,
                "all_events": [event.to_dict() for event in self._event_history],
                "completion_stats": self.get_completion_stats(),
                "active_jobs": self.get_active_jobs(),
            }

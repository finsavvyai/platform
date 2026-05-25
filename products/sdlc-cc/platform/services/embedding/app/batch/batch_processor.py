"""
Batch processor for embedding jobs.

This module handles the actual processing of batch embedding jobs,
including error handling, progress tracking, and resource management.
"""

import asyncio
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..cache.cache_manager import CacheManager
from ..providers.factory import ProviderFactory
from .job_queue import Job, JobStatus


class BatchProcessor:
    """Processes batch embedding jobs efficiently."""

    def __init__(
        self,
        cache_manager: CacheManager,
        max_concurrent_batches: int = 5,
        batch_timeout: int = 1800,  # 30 minutes
        error_retry_delay: float = 5.0,
        max_error_retries: int = 3,
    ):
        """
        Initialize batch processor.

        Args:
            cache_manager: Cache manager instance
            max_concurrent_batches: Maximum concurrent batch processes
            batch_timeout: Timeout for batch processing
            error_retry_delay: Delay between error retries
            max_error_retries: Maximum error retries per batch
        """
        self.cache_manager = cache_manager
        self.max_concurrent_batches = max_concurrent_batches
        self.batch_timeout = batch_timeout
        self.error_retry_delay = error_retry_delay
        self.max_error_retries = max_error_retries

        # Processing state
        self._current_jobs: Dict[str, asyncio.Task] = {}
        self._semaphore = asyncio.Semaphore(max_concurrent_batches)

        # Statistics
        self._stats = {
            "total_jobs_processed": 0,
            "successful_jobs": 0,
            "failed_jobs": 0,
            "total_batches_processed": 0,
            "total_texts_processed": 0,
            "total_processing_time_ms": 0,
            "average_batch_time_ms": 0.0,
            "cache_hits": 0,
            "cache_misses": 0,
        }

    async def process_job(self, job: Job) -> bool:
        """
        Process a single embedding job.

        Args:
            job: Job to process

        Returns:
            True if job completed successfully
        """
        start_time = time.time()

        try:
            print(f"Processing job {job.job_id} with {len(job.texts)} texts")

            # Create provider
            provider_config = {
                "name": job.provider,
                "provider_type": job.provider,
                "model": job.model,
            }

            provider = ProviderFactory.create_provider_from_dict(provider_config)

            # Initialize provider
            await provider.initialize()

            try:
                # Process job in batches
                success = await self._process_job_batches(job, provider)

                # Update statistics
                processing_time_ms = (time.time() - start_time) * 1000
                self._update_job_stats(job, success, processing_time_ms)

                return success

            finally:
                # Cleanup provider
                await provider.cleanup()

        except Exception as e:
            error_msg = f"Job processing failed: {e}"
            print(f"Job {job.job_id} failed: {error_msg}")
            return False

    async def _process_job_batches(self, job: Job, provider) -> bool:
        """Process job in batches."""
        total_texts = len(job.texts)
        processed_texts = 0

        # Process in chunks
        for batch_start in range(0, total_texts, job.batch_size):
            batch_end = min(batch_start + job.batch_size, total_texts)
            batch_texts = job.texts[batch_start:batch_end]

            try:
                # Process batch with timeout
                batch_success = await asyncio.wait_for(
                    self._process_batch_with_cache(job, batch_texts, provider),
                    timeout=self.batch_timeout
                    / job.total_batches,  # Distribute timeout
                )

                if not batch_success:
                    return False

                processed_texts += len(batch_texts)

                # Update job progress
                job.progress = processed_texts / total_texts
                job.processed_batches = batch_start // job.batch_size + 1

                print(
                    f"Job {job.job_id} progress: {job.progress:.1%} ({processed_texts}/{total_texts})"
                )

            except asyncio.TimeoutError:
                error_msg = f"Batch {batch_start // job.batch_size} timed out"
                print(f"Job {job.job_id}: {error_msg}")
                return False

            except Exception as e:
                error_msg = f"Batch {batch_start // job.batch_size} failed: {e}"
                print(f"Job {job.job_id}: {error_msg}")
                return False

        return True

    async def _process_batch_with_cache(
        self, job: Job, batch_texts: List[str], provider
    ) -> bool:
        """Process a batch with cache optimization."""
        batch_start = time.time()

        try:
            # Check cache first
            (
                cached_embeddings,
                missing_indices,
            ) = await self.cache_manager.get_batch_embeddings(
                batch_texts,
                job.provider,
                job.model,
            )

            # Update cache statistics
            hit_count = len(batch_texts) - len(missing_indices)
            self._stats["cache_hits"] += hit_count
            self._stats["cache_misses"] += len(missing_indices)

            if not missing_indices:
                # All embeddings found in cache
                print(f"Cache hit for batch of {len(batch_texts)} texts")
                return True

            # Process missing texts
            missing_texts = [batch_texts[i] for i in missing_indices]

            print(
                f"Processing {len(missing_texts)} missing texts (cache hit: {hit_count})"
            )

            # Generate embeddings for missing texts
            batch_result = await provider.generate_batch_embeddings(
                missing_texts,
                model=job.model,
            )

            # Cache the new embeddings
            await self.cache_manager.set_batch_embeddings(
                missing_texts,
                batch_result.embeddings,
                job.provider,
                job.model,
            )

            # Combine cached and new embeddings
            final_embeddings = cached_embeddings
            for i, missing_idx in enumerate(missing_indices):
                final_embeddings[missing_idx] = batch_result.embeddings[i]

            # Verify we have all embeddings
            if None in final_embeddings:
                print("Warning: Some embeddings are missing after processing")
                return False

            processing_time_ms = (time.time() - batch_start) * 1000
            print(f"Batch processed in {processing_time_ms:.0f}ms")

            return True

        except Exception as e:
            print(f"Batch processing error: {e}")
            return False

    async def process_job_async(self, job: Job) -> None:
        """Process job asynchronously (for background processing)."""
        async with self._semaphore:
            self._current_jobs[job.job_id] = asyncio.current_task()

            try:
                success = await self.process_job(job)
                # Note: Job completion status should be handled by the job queue
                print(
                    f"Job {job.job_id} processing completed: {'SUCCESS' if success else 'FAILED'}"
                )

            except Exception as e:
                print(f"Job {job.job_id} processing error: {e}")
                # Job queue will handle the error status

            finally:
                self._current_jobs.pop(job.job_id, None)

    def get_current_jobs(self) -> List[str]:
        """Get list of currently processing job IDs."""
        return list(self._current_jobs.keys())

    def get_processing_capacity(self) -> Dict[str, int]:
        """Get current processing capacity information."""
        current_processing = len(self._current_jobs)
        available_slots = self.max_concurrent_batches - current_processing

        return {
            "current": current_processing,
            "max": self.max_concurrent_batches,
            "available": available_slots,
            "utilization": current_processing / self.max_concurrent_batches,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get processing statistics."""
        total_processing_time = self._stats["total_processing_time_ms"]
        total_batches = self._stats["total_batches_processed"]

        avg_batch_time = (
            total_processing_time / total_batches if total_batches > 0 else 0.0
        )

        cache_hit_rate = (
            self._stats["cache_hits"]
            / (self._stats["cache_hits"] + self._stats["cache_misses"])
            if (self._stats["cache_hits"] + self._stats["cache_misses"]) > 0
            else 0.0
        )

        return {
            **self._stats,
            "average_batch_time_ms": avg_batch_time,
            "cache_hit_rate": cache_hit_rate,
            "success_rate": (
                self._stats["successful_jobs"] / self._stats["total_jobs_processed"]
                if self._stats["total_jobs_processed"] > 0
                else 0.0
            ),
            "current_jobs": len(self._current_jobs),
            "max_concurrent_batches": self.max_concurrent_batches,
        }

    def _update_job_stats(
        self, job: Job, success: bool, processing_time_ms: float
    ) -> None:
        """Update processing statistics."""
        self._stats["total_jobs_processed"] += 1
        self._stats["total_batches_processed"] += job.total_batches
        self._stats["total_texts_processed"] += len(job.texts)
        self._stats["total_processing_time_ms"] += processing_time_ms

        if success:
            self._stats["successful_jobs"] += 1
        else:
            self._stats["failed_jobs"] += 1

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a currently processing job.

        Args:
            job_id: Job ID to cancel

        Returns:
            True if job was cancelled
        """
        task = self._current_jobs.get(job_id)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

            self._current_jobs.pop(job_id, None)
            return True

        return False

    async def shutdown(self) -> None:
        """Shutdown the batch processor gracefully."""
        print("Shutting down batch processor...")

        # Cancel all running jobs
        tasks = list(self._current_jobs.values())
        for task in tasks:
            task.cancel()

        # Wait for tasks to complete
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self._current_jobs.clear()
        print("Batch processor shutdown complete")

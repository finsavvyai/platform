"""
Scalable batch processing pipeline for document processing with parallel processing.

This module provides high-performance batch processing capabilities for large volumes
of documents with parallel execution, monitoring, and error handling.
"""

import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

import psutil
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.services.document_processor import DocumentProcessor, ProcessingOptions
from app.services.text_processor import TextProcessor
from app.services.chunking import ChunkingService, ChunkOptions

logger = logging.getLogger(__name__)


class BatchStatus(str, Enum):
    """Batch processing status enumeration."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class ProcessingMode(str, Enum):
    """Processing mode for batch operations."""

    SEQUENTIAL = "sequential"
    PARALLEL_THREADS = "parallel_threads"
    PARALLEL_PROCESSES = "parallel_processes"
    ASYNC_CONCURRENT = "async_concurrent"


@dataclass
class BatchJob:
    """Represents a batch processing job."""

    job_id: str
    tenant_id: str
    documents: List[Document]
    options: ProcessingOptions
    status: BatchStatus = BatchStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_mode: ProcessingMode = ProcessingMode.ASYNC_CONCURRENT
    max_workers: int = 4
    progress: float = 0.0
    processed_count: int = 0
    failed_count: int = 0
    total_count: int = 0
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Initialize derived fields."""
        self.total_count = len(self.documents)


@dataclass
class BatchResult:
    """Result of batch processing operation."""

    job_id: str
    status: BatchStatus
    processed_documents: List[Document]
    failed_documents: List[Tuple[Document, str]]
    chunks_created: int
    processing_time_ms: int
    throughput_docs_per_second: float
    errors: List[str]
    metadata: Dict[str, Any]


class ResourceMonitor:
    """Monitor system resources during batch processing."""

    def __init__(self):
        self.start_time = None
        self.peak_memory_usage = 0
        self.peak_cpu_usage = 0
        self.avg_cpu_usage = 0
        self.cpu_samples = []

    def start_monitoring(self):
        """Start resource monitoring."""
        self.start_time = datetime.now()
        self.peak_memory_usage = 0
        self.peak_cpu_usage = 0
        self.avg_cpu_usage = 0
        self.cpu_samples = []

    def record_metrics(self):
        """Record current system metrics."""
        try:
            # Memory usage
            memory_info = psutil.virtual_memory()
            current_memory_mb = memory_info.used / 1024 / 1024
            self.peak_memory_usage = max(self.peak_memory_usage, current_memory_mb)

            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.cpu_samples.append(cpu_percent)
            self.peak_cpu_usage = max(self.peak_cpu_usage, cpu_percent)

            if self.cpu_samples:
                self.avg_cpu_usage = sum(self.cpu_samples) / len(self.cpu_samples)

        except Exception as e:
            logger.warning(f"Failed to record resource metrics: {e}")

    def get_summary(self) -> Dict[str, float]:
        """Get resource usage summary."""
        return {
            "peak_memory_usage_mb": self.peak_memory_usage,
            "peak_cpu_usage_percent": self.peak_cpu_usage,
            "avg_cpu_usage_percent": self.avg_cpu_usage,
            "monitoring_duration_seconds": (
                datetime.now() - self.start_time
            ).total_seconds()
            if self.start_time
            else 0,
        }


class BatchProcessor:
    """High-performance batch processing system for documents."""

    def __init__(self):
        self.document_processor = DocumentProcessor()
        self.text_processor = TextProcessor()
        self.chunking_service = ChunkingService()
        self.active_jobs: Dict[str, BatchJob] = {}
        self.job_queue = asyncio.Queue()
        self.resource_monitor = ResourceMonitor()
        self.max_concurrent_jobs = 5
        self.max_system_memory_usage = 0.8  # 80% of available memory
        self.max_system_cpu_usage = 0.9  # 90% CPU usage

    async def submit_batch_job(
        self,
        tenant_id: str,
        documents: List[Document],
        options: Optional[ProcessingOptions] = None,
        processing_mode: ProcessingMode = ProcessingMode.ASYNC_CONCURRENT,
        max_workers: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Submit a batch processing job."""
        job_id = str(uuid4())

        if options is None:
            options = ProcessingOptions()

        if max_workers is None:
            max_workers = min(self._calculate_optimal_workers(), len(documents))

        job = BatchJob(
            job_id=job_id,
            tenant_id=tenant_id,
            documents=documents,
            options=options,
            processing_mode=processing_mode,
            max_workers=max_workers,
            metadata=metadata or {},
        )

        self.active_jobs[job_id] = job
        await self.job_queue.put(job)

        logger.info(f"Submitted batch job {job_id} with {len(documents)} documents")
        return job_id

    async def process_batch_job(self, job: BatchJob, db: AsyncSession) -> BatchResult:
        """Process a single batch job."""
        self.resource_monitor.start_monitoring()
        job.status = BatchStatus.RUNNING
        job.started_at = datetime.now()

        start_time = time.time()
        processed_documents = []
        failed_documents = []
        total_chunks_created = 0
        errors = []

        try:
            # Select processing strategy
            if job.processing_mode == ProcessingMode.SEQUENTIAL:
                results = await self._process_sequential(job, db)
            elif job.processing_mode == ProcessingMode.PARALLEL_THREADS:
                results = await self._process_parallel_threads(job, db)
            elif job.processing_mode == ProcessingMode.PARALLEL_PROCESSES:
                results = await self._process_parallel_processes(job, db)
            else:  # ASYNC_CONCURRENT
                results = await self._process_async_concurrent(job, db)

            processed_documents, failed_documents, total_chunks_created, errors = (
                results
            )

            # Update job status
            job.status = BatchStatus.COMPLETED
            job.completed_at = datetime.now()
            job.processed_count = len(processed_documents)
            job.failed_count = len(failed_documents)
            job.progress = 100.0

            processing_time = int((time.time() - start_time) * 1000)
            throughput = len(processed_documents) / max(processing_time / 1000, 1)

            result = BatchResult(
                job_id=job.job_id,
                status=job.status,
                processed_documents=processed_documents,
                failed_documents=failed_documents,
                chunks_created=total_chunks_created,
                processing_time_ms=processing_time,
                throughput_docs_per_second=throughput,
                errors=errors,
                metadata={
                    "resource_usage": self.resource_monitor.get_summary(),
                    "job_metadata": job.metadata,
                    "processing_mode": job.processing_mode.value,
                    "max_workers": job.max_workers,
                },
            )

            logger.info(
                f"Completed batch job {job.job_id}: {len(processed_documents)} processed, {len(failed_documents)} failed"
            )
            return result

        except Exception as e:
            job.status = BatchStatus.FAILED
            job.completed_at = datetime.now()
            job.errors.append(str(e))

            logger.error(f"Batch job {job.job_id} failed: {e}")

            return BatchResult(
                job_id=job.job_id,
                status=BatchStatus.FAILED,
                processed_documents=processed_documents,
                failed_documents=failed_documents,
                chunks_created=total_chunks_created,
                processing_time_ms=int((time.time() - start_time) * 1000),
                throughput_docs_per_second=0.0,
                errors=errors + [str(e)],
                metadata={"resource_usage": self.resource_monitor.get_summary()},
            )

    async def _process_sequential(
        self, job: BatchJob, db: AsyncSession
    ) -> Tuple[List[Document], List[Tuple[Document, str]], int, List[str]]:
        """Process documents sequentially."""
        processed = []
        failed = []
        total_chunks = 0
        errors = []

        for i, document in enumerate(job.documents):
            try:
                # Update progress
                job.progress = (i / len(job.documents)) * 100
                job.processed_count = i

                # Process document
                chunks, _ = await self.document_processor.process_document(
                    document,
                    b"",
                    job.options,
                    db,  # file_data would come from storage
                )

                # Update document status and save chunks
                document.processing_status = DocumentStatus.COMPLETED
                processed.append(document)
                total_chunks += len(chunks)

                # Record resource metrics
                self.resource_monitor.record_metrics()

                # Check resource limits
                if not self._check_resource_limits():
                    logger.warning("Resource limits reached, pausing processing")
                    await asyncio.sleep(5)  # Brief pause

            except Exception as e:
                error_msg = f"Failed to process document {document.id}: {str(e)}"
                logger.error(error_msg)
                failed.append((document, error_msg))
                errors.append(error_msg)

        return processed, failed, total_chunks, errors

    async def _process_parallel_threads(
        self, job: BatchJob, db: AsyncSession
    ) -> Tuple[List[Document], List[Tuple[Document, str]], int, List[str]]:
        """Process documents using parallel threads."""
        processed = []
        failed = []
        total_chunks = 0
        errors = []

        with ThreadPoolExecutor(max_workers=job.max_workers) as executor:
            # Submit all tasks
            future_to_doc = {
                executor.submit(
                    self._process_single_document_sync, doc, job.options
                ): doc
                for doc in job.documents
            }

            # Process completed tasks
            completed = 0
            for future in as_completed(future_to_doc):
                document = future_to_doc[future]
                completed += 1

                try:
                    chunks, error = future.result(
                        timeout=300
                    )  # 5 minute timeout per document

                    if error:
                        error_msg = f"Failed to process document {document.id}: {error}"
                        failed.append((document, error_msg))
                        errors.append(error_msg)
                    else:
                        document.processing_status = DocumentStatus.COMPLETED
                        processed.append(document)
                        total_chunks += len(chunks)

                    # Update progress
                    job.progress = (completed / len(job.documents)) * 100
                    job.processed_count = completed

                    # Record resource metrics
                    self.resource_monitor.record_metrics()

                except Exception as e:
                    error_msg = (
                        f"Processing failed for document {document.id}: {str(e)}"
                    )
                    failed.append((document, error_msg))
                    errors.append(error_msg)

        return processed, failed, total_chunks, errors

    async def _process_parallel_processes(
        self, job: BatchJob, db: AsyncSession
    ) -> Tuple[List[Document], List[Tuple[Document, str]], int, List[str]]:
        """Process documents using parallel processes."""
        processed = []
        failed = []
        total_chunks = 0
        errors = []

        # For process-based processing, we need to limit the number of processes
        # to avoid excessive memory usage
        max_processes = min(job.max_workers, psutil.cpu_count())

        with ProcessPoolExecutor(max_workers=max_processes) as executor:
            # Submit tasks in batches to manage memory
            batch_size = max(1, len(job.documents) // (max_processes * 2))

            for i in range(0, len(job.documents), batch_size):
                batch = job.documents[i : i + batch_size]

                future_to_doc = {
                    executor.submit(
                        self._process_single_document_sync, doc, job.options
                    ): doc
                    for doc in batch
                }

                for future in as_completed(future_to_doc):
                    document = future_to_doc[future]

                    try:
                        chunks, error = future.result(timeout=600)  # 10 minute timeout

                        if error:
                            error_msg = (
                                f"Failed to process document {document.id}: {error}"
                            )
                            failed.append((document, error_msg))
                            errors.append(error_msg)
                        else:
                            document.processing_status = DocumentStatus.COMPLETED
                            processed.append(document)
                            total_chunks += len(chunks)

                        # Update progress
                        job.progress = (
                            (len(processed) + len(failed)) / len(job.documents) * 100
                        )
                        job.processed_count = len(processed)

                    except Exception as e:
                        error_msg = (
                            f"Processing failed for document {document.id}: {str(e)}"
                        )
                        failed.append((document, error_msg))
                        errors.append(error_msg)

        return processed, failed, total_chunks, errors

    async def _process_async_concurrent(
        self, job: BatchJob, db: AsyncSession
    ) -> Tuple[List[Document], List[Tuple[Document, str]], int, List[str]]:
        """Process documents using async concurrency."""
        processed = []
        failed = []
        total_chunks = 0
        errors = []

        # Create semaphore to limit concurrent tasks
        semaphore = asyncio.Semaphore(job.max_workers)

        async def process_document_with_semaphore(document):
            async with semaphore:
                return await self._process_single_document_async(document, job.options)

        # Process all documents concurrently
        tasks = [process_document_with_semaphore(doc) for doc in job.documents]

        completed = 0
        for i, task in enumerate(asyncio.as_completed(tasks)):
            try:
                document, chunks, error = await task

                if error:
                    error_msg = f"Failed to process document {document.id}: {error}"
                    failed.append((document, error_msg))
                    errors.append(error_msg)
                else:
                    document.processing_status = DocumentStatus.COMPLETED
                    processed.append(document)
                    total_chunks += len(chunks)

                completed += 1
                job.progress = (completed / len(job.documents)) * 100
                job.processed_count = completed

                # Record resource metrics
                self.resource_monitor.record_metrics()

            except Exception as e:
                error_msg = f"Async processing failed for document: {str(e)}"
                failed.append((None, error_msg))  # Document may be None
                errors.append(error_msg)

        return processed, failed, total_chunks, errors

    def _process_single_document_sync(
        self, document: Document, options: ProcessingOptions
    ) -> Tuple[List, Optional[str]]:
        """Process a single document synchronously."""
        try:
            # This would be implemented with actual file data from storage
            chunks, _ = asyncio.run(
                self.document_processor.process_document(document, b"", options)
            )
            return chunks, None
        except Exception as e:
            return [], str(e)

    async def _process_single_document_async(
        self, document: Document, options: ProcessingOptions
    ) -> Tuple[Document, List, Optional[str]]:
        """Process a single document asynchronously."""
        try:
            # This would be implemented with actual file data from storage
            chunks, _ = await self.document_processor.process_document(
                document, b"", options
            )
            return document, chunks, None
        except Exception as e:
            return document, [], str(e)

    def _calculate_optimal_workers(self) -> int:
        """Calculate optimal number of workers based on system resources."""
        cpu_count = psutil.cpu_count()
        memory_gb = psutil.virtual_memory().total / 1024 / 1024 / 1024

        # Base workers on CPU count
        base_workers = cpu_count

        # Adjust based on available memory (assume 500MB per worker)
        memory_based_workers = int(memory_gb * 1024 / 500)

        # Use the more conservative estimate
        optimal_workers = min(base_workers, memory_based_workers, 8)  # Cap at 8

        logger.info(
            f"Calculated optimal workers: {optimal_workers} (CPU: {cpu_count}, Memory: {memory_gb:.1f}GB)"
        )
        return optimal_workers

    def _check_resource_limits(self) -> bool:
        """Check if system resource usage is within limits."""
        try:
            # Check memory usage
            memory = psutil.virtual_memory()
            memory_usage_percent = memory.percent

            # Check CPU usage
            cpu_usage = psutil.cpu_percent(interval=1)

            # Check if we're within limits
            memory_ok = memory_usage_percent < (self.max_system_memory_usage * 100)
            cpu_ok = cpu_usage < (self.max_system_cpu_usage * 100)

            if not memory_ok:
                logger.warning(f"High memory usage: {memory_usage_percent:.1f}%")

            if not cpu_ok:
                logger.warning(f"High CPU usage: {cpu_usage:.1f}%")

            return memory_ok and cpu_ok

        except Exception as e:
            logger.warning(f"Failed to check resource limits: {e}")
            return True  # Assume okay if we can't check

    async def get_job_status(self, job_id: str) -> Optional[BatchJob]:
        """Get the status of a batch job."""
        return self.active_jobs.get(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a batch job."""
        job = self.active_jobs.get(job_id)
        if job and job.status in [BatchStatus.PENDING, BatchStatus.RUNNING]:
            job.status = BatchStatus.CANCELLED
            job.completed_at = datetime.now()
            logger.info(f"Cancelled batch job {job_id}")
            return True
        return False

    async def pause_job(self, job_id: str) -> bool:
        """Pause a batch job."""
        job = self.active_jobs.get(job_id)
        if job and job.status == BatchStatus.RUNNING:
            job.status = BatchStatus.PAUSED
            logger.info(f"Paused batch job {job_id}")
            return True
        return False

    async def resume_job(self, job_id: str) -> bool:
        """Resume a paused batch job."""
        job = self.active_jobs.get(job_id)
        if job and job.status == BatchStatus.PAUSED:
            job.status = BatchStatus.RUNNING
            await self.job_queue.put(job)  # Re-queue the job
            logger.info(f"Resumed batch job {job_id}")
            return True
        return False

    async def get_job_statistics(self) -> Dict[str, Any]:
        """Get statistics for all batch jobs."""
        total_jobs = len(self.active_jobs)
        completed_jobs = sum(
            1
            for job in self.active_jobs.values()
            if job.status == BatchStatus.COMPLETED
        )
        failed_jobs = sum(
            1 for job in self.active_jobs.values() if job.status == BatchStatus.FAILED
        )
        running_jobs = sum(
            1 for job in self.active_jobs.values() if job.status == BatchStatus.RUNNING
        )

        return {
            "total_jobs": total_jobs,
            "completed_jobs": completed_jobs,
            "failed_jobs": failed_jobs,
            "running_jobs": running_jobs,
            "success_rate": completed_jobs / total_jobs if total_jobs > 0 else 0,
            "resource_usage": self.resource_monitor.get_summary(),
        }

    async def cleanup_completed_jobs(self, max_age_hours: int = 24) -> int:
        """Clean up old completed jobs."""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        jobs_to_remove = []

        for job_id, job in self.active_jobs.items():
            if (
                job.status
                in [BatchStatus.COMPLETED, BatchStatus.FAILED, BatchStatus.CANCELLED]
                and job.completed_at
                and job.completed_at < cutoff_time
            ):
                jobs_to_remove.append(job_id)

        for job_id in jobs_to_remove:
            del self.active_jobs[job_id]

        logger.info(f"Cleaned up {len(jobs_to_remove)} old batch jobs")
        return len(jobs_to_remove)

    async def start_worker(self):
        """Start the batch processing worker."""
        logger.info("Starting batch processing worker")

        while True:
            try:
                # Wait for a job
                job = await self.job_queue.get()

                if job.status == BatchStatus.CANCELLED:
                    continue

                # Process the job (database session would be injected)
                # In a real implementation, this would be called with a database session
                logger.info(f"Processing batch job {job.job_id}")

                # For now, just simulate processing
                await asyncio.sleep(1)

                # Mark as completed (simulation)
                job.status = BatchStatus.COMPLETED
                job.completed_at = datetime.now()
                job.progress = 100.0

            except Exception as e:
                logger.error(f"Error in batch processing worker: {e}")
                await asyncio.sleep(5)  # Brief pause on error

"""
API endpoints for Performance Optimization and Caching services
"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
import asyncio

from app.services.performance_service import (
    performance_service,
    JobPriority,
    QueryOptimizationType
)
from app.services.cache_service import cache_service, CacheStrategy
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter()


# Request/Response Models

class CacheSetRequest(BaseModel):
    """Request model for setting cache values"""
    key: str = Field(..., description="Cache key")
    value: Any = Field(..., description="Value to cache")
    ttl: Optional[int] = Field(300, description="Time to live in seconds")
    namespace: str = Field("default", description="Cache namespace")
    tags: Optional[List[str]] = Field(None, description="Cache tags for invalidation")
    strategy: CacheStrategy = Field(CacheStrategy.WRITE_THROUGH, description="Cache strategy")


class CacheGetRequest(BaseModel):
    """Request model for getting cache values"""
    key: str = Field(..., description="Cache key")
    namespace: str = Field("default", description="Cache namespace")
    params: Optional[Dict[str, Any]] = Field(None, description="Additional parameters")


class CacheInvalidateRequest(BaseModel):
    """Request model for cache invalidation"""
    tags: List[str] = Field(..., description="Tags to invalidate")


class QueryOptimizationRequest(BaseModel):
    """Request model for query optimization"""
    query: str = Field(..., description="SQL query to optimize")
    params: Optional[Dict[str, Any]] = Field(None, description="Query parameters")
    use_cache: bool = Field(True, description="Whether to use caching")
    optimization_type: QueryOptimizationType = Field(
        QueryOptimizationType.CACHING,
        description="Type of optimization to apply"
    )


class BackgroundJobRequest(BaseModel):
    """Request model for scheduling background jobs"""
    name: str = Field(..., description="Job name")
    function_name: str = Field(..., description="Function to execute")
    args: List[Any] = Field(default_factory=list, description="Function arguments")
    kwargs: Dict[str, Any] = Field(default_factory=dict, description="Function keyword arguments")
    priority: JobPriority = Field(JobPriority.NORMAL, description="Job priority")
    max_retries: int = Field(3, description="Maximum retry attempts")
    timeout_seconds: int = Field(300, description="Job timeout")


class BatchProcessRequest(BaseModel):
    """Request model for batch processing"""
    items: List[Any] = Field(..., description="Items to process")
    processor_name: str = Field(..., description="Processor function name")
    batch_size: int = Field(100, description="Batch size")
    max_workers: int = Field(3, description="Maximum concurrent workers")


# Cache Management Endpoints

@router.post("/cache/set")
async def set_cache_value(
    request: CacheSetRequest,
    current_user: User = Depends(get_current_user)
):
    """Set a value in the cache"""
    try:
        success = await cache_service.set(
            key=request.key,
            value=request.value,
            ttl=request.ttl,
            namespace=request.namespace,
            tags=request.tags,
            strategy=request.strategy
        )

        if success:
            return {
                "status": "success",
                "message": f"Value cached with key: {request.key}",
                "namespace": request.namespace,
                "ttl": request.ttl
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to set cache value")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache set error: {str(e)}")


@router.post("/cache/get")
async def get_cache_value(
    request: CacheGetRequest,
    current_user: User = Depends(get_current_user)
):
    """Get a value from the cache"""
    try:
        params = request.params or {}
        value = await cache_service.get(
            key=request.key,
            namespace=request.namespace,
            **params
        )

        if value is not None:
            return {
                "status": "hit",
                "key": request.key,
                "value": value,
                "namespace": request.namespace
            }
        else:
            return {
                "status": "miss",
                "key": request.key,
                "namespace": request.namespace
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache get error: {str(e)}")


@router.delete("/cache/{namespace}/{key}")
async def delete_cache_value(
    namespace: str,
    key: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a value from the cache"""
    try:
        success = await cache_service.delete(key=key, namespace=namespace)

        if success:
            return {
                "status": "success",
                "message": f"Cache value deleted: {key}",
                "namespace": namespace
            }
        else:
            return {
                "status": "not_found",
                "message": f"Cache value not found: {key}"
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache delete error: {str(e)}")


@router.post("/cache/invalidate")
async def invalidate_cache_by_tags(
    request: CacheInvalidateRequest,
    current_user: User = Depends(get_current_user)
):
    """Invalidate cache entries by tags"""
    try:
        invalidated_count = await cache_service.invalidate_by_tags(request.tags)

        return {
            "status": "success",
            "message": f"Invalidated {invalidated_count} cache entries",
            "tags": request.tags,
            "invalidated_count": invalidated_count
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache invalidation error: {str(e)}")


@router.delete("/cache/namespace/{namespace}")
async def clear_cache_namespace(
    namespace: str,
    current_user: User = Depends(get_current_user)
):
    """Clear all cache entries in a namespace"""
    try:
        cleared_count = await cache_service.clear_namespace(namespace)

        return {
            "status": "success",
            "message": f"Cleared {cleared_count} cache entries",
            "namespace": namespace,
            "cleared_count": cleared_count
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clear error: {str(e)}")


@router.get("/cache/metrics")
async def get_cache_metrics(
    current_user: User = Depends(get_current_user)
):
    """Get cache performance metrics"""
    try:
        metrics = await cache_service.get_metrics()
        return {
            "status": "success",
            "metrics": metrics
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache metrics error: {str(e)}")


# Query Optimization Endpoints

@router.post("/optimize/query")
async def optimize_query(
    request: QueryOptimizationRequest,
    current_user: User = Depends(get_current_user)
):
    """Optimize and execute a database query"""
    try:
        result = await performance_service.optimize_query(
            query=request.query,
            params=request.params,
            use_cache=request.use_cache,
            optimization_type=request.optimization_type
        )

        return {
            "status": "success",
            "result": result,
            "optimization_type": request.optimization_type.value,
            "cached": request.use_cache
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query optimization error: {str(e)}")


# Background Job Management Endpoints

@router.post("/jobs/schedule")
async def schedule_background_job(
    request: BackgroundJobRequest,
    current_user: User = Depends(get_current_user)
):
    """Schedule a background job"""
    try:
        # Map function names to actual functions (in real implementation)
        # This is a simplified example - you'd have a registry of available functions
        available_functions = {
            "test_function": lambda x: f"Processed: {x}",
            "data_processing": lambda items: len(items),
            "cleanup_task": lambda: "Cleanup completed"
        }

        if request.function_name not in available_functions:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown function: {request.function_name}"
            )

        function = available_functions[request.function_name]

        job_id = await performance_service.schedule_job(
            name=request.name,
            function=function,
            *request.args,
            priority=request.priority,
            max_retries=request.max_retries,
            timeout_seconds=request.timeout_seconds,
            **request.kwargs
        )

        return {
            "status": "success",
            "message": f"Job scheduled: {request.name}",
            "job_id": job_id,
            "priority": request.priority.value
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job scheduling error: {str(e)}")


@router.get("/jobs/{job_id}/status")
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get status of a background job"""
    try:
        job_status = await performance_service.get_job_status(job_id)

        if job_status:
            return {
                "status": "success",
                "job": job_status
            }
        else:
            raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job status error: {str(e)}")


@router.post("/batch/process")
async def batch_process(
    request: BatchProcessRequest,
    current_user: User = Depends(get_current_user)
):
    """Process items in optimized batches"""
    try:
        # Map processor names to functions
        available_processors = {
            "data_validator": lambda batch: [{"valid": True, "item": item} for item in batch],
            "item_transformer": lambda batch: [f"transformed_{item}" for item in batch],
            "aggregator": lambda batch: {"count": len(batch), "items": batch}
        }

        if request.processor_name not in available_processors:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown processor: {request.processor_name}"
            )

        processor = available_processors[request.processor_name]

        results = await performance_service.batch_process(
            items=request.items,
            processor_function=processor,
            batch_size=request.batch_size,
            max_workers=request.max_workers
        )

        return {
            "status": "success",
            "message": f"Processed {len(request.items)} items in batches",
            "results": results,
            "batch_count": len(request.items) // request.batch_size + 1
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing error: {str(e)}")


# Performance Monitoring Endpoints

@router.get("/metrics")
async def get_performance_metrics(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive performance metrics"""
    try:
        metrics = await performance_service.get_performance_metrics()
        return {
            "status": "success",
            "metrics": metrics
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Performance metrics error: {str(e)}")


@router.get("/health")
async def get_performance_health():
    """Get performance service health status"""
    try:
        cache_health = await cache_service.health_check()
        performance_health = await performance_service.health_check()

        overall_status = "healthy"
        if cache_health["status"] != "healthy" or performance_health["status"] != "healthy":
            overall_status = "degraded"

        return {
            "service_name": "performance_optimization",
            "status": overall_status,
            "components": {
                "cache_service": cache_health,
                "performance_service": performance_health
            }
        }

    except Exception as e:
        return {
            "service_name": "performance_optimization",
            "status": "unhealthy",
            "error": str(e)
        }


# System Optimization Endpoints

@router.post("/optimize/system")
async def optimize_system_performance(
    current_user: User = Depends(get_current_user)
):
    """Run system-wide performance optimizations"""
    try:
        optimizations = []

        # Clear expired cache entries
        cache_metrics = await cache_service.get_metrics()
        if cache_metrics.get("l1_cache_size", 0) > 800:
            await cache_service.clear_namespace("temp")
            optimizations.append("Cleared temporary cache entries")

        # Schedule cleanup jobs
        cleanup_job_id = await performance_service.schedule_job(
            name="system_cleanup",
            function=lambda: "System cleanup completed",
            priority=JobPriority.LOW
        )
        optimizations.append(f"Scheduled cleanup job: {cleanup_job_id}")

        return {
            "status": "success",
            "message": "System optimization completed",
            "optimizations": optimizations
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"System optimization error: {str(e)}")


@router.get("/status")
async def get_performance_status(
    current_user: User = Depends(get_current_user)
):
    """Get detailed performance service status"""
    try:
        # Get metrics from both services
        cache_metrics = await cache_service.get_metrics()
        performance_metrics = await performance_service.get_performance_metrics()

        return {
            "status": "success",
            "cache_service": {
                "initialized": cache_metrics.get("initialized", False),
                "redis_connected": cache_metrics.get("redis_connected", False),
                "hit_ratio": cache_metrics.get("hit_ratio_percent", 0),
                "l1_cache_size": cache_metrics.get("l1_cache_size", 0),
                "memory_usage": cache_metrics.get("memory_usage_bytes", 0)
            },
            "performance_service": {
                "workers_running": performance_metrics["system"]["workers_running"],
                "worker_count": performance_metrics["system"]["worker_count"],
                "queue_size": performance_metrics["background_jobs"]["queue_size"],
                "success_rate": performance_metrics["background_jobs"]["success_rate"],
                "avg_query_time": performance_metrics["query_performance"]["avg_query_time_ms"]
            },
            "recommendations": await _get_performance_recommendations(
                cache_metrics, performance_metrics
            )
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Performance status error: {str(e)}")


async def _get_performance_recommendations(
    cache_metrics: Dict[str, Any],
    performance_metrics: Dict[str, Any]
) -> List[str]:
    """Generate performance recommendations based on current metrics"""
    recommendations = []

    try:
        # Cache recommendations
        hit_ratio = cache_metrics.get("hit_ratio_percent", 0)
        if hit_ratio < 70:
            recommendations.append("Consider increasing cache TTL or improving cache key strategy")

        # Query performance recommendations
        avg_query_time = performance_metrics["query_performance"]["avg_query_time_ms"]
        if avg_query_time > 100:
            recommendations.append("Optimize slow queries or add database indexes")

        # Background job recommendations
        queue_size = performance_metrics["background_jobs"]["queue_size"]
        if queue_size > 50:
            recommendations.append("Consider adding more background workers")

        success_rate = performance_metrics["background_jobs"]["success_rate"]
        if success_rate < 95:
            recommendations.append("Review failed jobs and improve error handling")

        if not recommendations:
            recommendations.append("Performance is optimal - no immediate actions needed")

        return recommendations

    except Exception as e:
        return [f"Error generating recommendations: {str(e)}"]
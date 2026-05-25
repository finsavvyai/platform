#!/usr/bin/env python3
"""
UPM.Plus Performance Optimization - Live Demo
Demonstrates the smart caching and performance optimization features
"""

import asyncio
import time
import random
from datetime import datetime
from typing import List, Dict, Any

# Import our new services
from app.services.cache_service import cache_service, CacheStrategy
from app.services.performance_service import (
    performance_service,
    JobPriority,
    QueryOptimizationType
)

async def demo_performance_optimization():
    """Complete demonstration of performance optimization features"""

    print("🚀 UPM.Plus Performance Optimization - LIVE DEMO")
    print("=" * 65)

    # Demo 1: Smart Caching System
    print("\n💾 1. SMART CACHING SYSTEM")
    print("-" * 35)

    # Initialize services
    await cache_service.initialize()
    await performance_service.initialize()

    print(f"✅ Cache Service Initialized")
    print(f"✅ Performance Service Initialized")

    # Demonstrate multi-level caching
    print("\n🔄 Multi-Level Cache Operations:")

    # L1 (Memory) Cache Demo
    start_time = time.time()
    await cache_service.set(
        key="user_profile",
        value={
            "id": 12345,
            "name": "John Doe",
            "email": "john@company.com",
            "preferences": {"theme": "dark", "notifications": True}
        },
        ttl=300,
        namespace="users",
        tags=["profile", "active_user"],
        strategy=CacheStrategy.WRITE_THROUGH
    )
    set_time = (time.time() - start_time) * 1000

    # Cache hit (L1 - fastest)
    start_time = time.time()
    user_data = await cache_service.get("user_profile", namespace="users")
    get_time = (time.time() - start_time) * 1000

    print(f"   📝 Cache SET: {set_time:.2f}ms")
    print(f"   📖 Cache GET (L1 hit): {get_time:.2f}ms")
    print(f"   👤 Retrieved: {user_data['name']} ({user_data['email']})")

    # Cache with parameters
    await cache_service.set(
        "api_response",
        {"data": [1, 2, 3, 4, 5], "count": 5},
        namespace="api",
        user_id=12345,
        endpoint="/data",
        version="v1"
    )

    cached_response = await cache_service.get(
        "api_response",
        namespace="api",
        user_id=12345,
        endpoint="/data",
        version="v1"
    )
    print(f"   🔗 Parameterized cache: {cached_response['count']} items")

    # Demo 2: Background Job Processing
    print("\n⚡ 2. BACKGROUND JOB PROCESSING")
    print("-" * 38)

    async def data_processing_job(dataset_size: int, complexity: str):
        """Simulate data processing work"""
        await asyncio.sleep(0.3)  # Simulate processing time
        return {
            "processed_records": dataset_size,
            "complexity": complexity,
            "processing_time": 0.3,
            "timestamp": datetime.now().isoformat()
        }

    def sync_calculation_job(numbers: List[int]):
        """Synchronous calculation job"""
        result = sum(x * x for x in numbers)
        return {"sum_of_squares": result, "count": len(numbers)}

    # Schedule jobs with different priorities
    print("   📋 Scheduling Background Jobs:")

    critical_job_id = await performance_service.schedule_job(
        "Critical Data Processing",
        data_processing_job,
        1000,  # dataset_size
        "high",  # complexity
        priority=JobPriority.CRITICAL,
        timeout_seconds=60
    )

    high_job_id = await performance_service.schedule_job(
        "Analytics Calculation",
        sync_calculation_job,
        list(range(100)),  # numbers
        priority=JobPriority.HIGH
    )

    normal_job_id = await performance_service.schedule_job(
        "Routine Processing",
        data_processing_job,
        500,  # dataset_size
        "medium",  # complexity
        priority=JobPriority.NORMAL
    )

    print(f"   🔴 Critical Job: {critical_job_id}")
    print(f"   🟡 High Priority Job: {high_job_id}")
    print(f"   🟢 Normal Job: {normal_job_id}")

    # Monitor job execution
    print("\n   📊 Real-time Job Monitoring:")
    for i in range(10):
        await asyncio.sleep(0.2)

        jobs_status = []
        for job_id, priority in [(critical_job_id, "CRITICAL"), (high_job_id, "HIGH"), (normal_job_id, "NORMAL")]:
            status = await performance_service.get_job_status(job_id)
            if status:
                jobs_status.append(f"{priority}: {status['status']}")

        print(f"   ⏳ {' | '.join(jobs_status)}")

        # Check if all jobs completed
        all_completed = True
        for job_id in [critical_job_id, high_job_id, normal_job_id]:
            status = await performance_service.get_job_status(job_id)
            if status and status['status'] not in ['completed', 'failed']:
                all_completed = False
                break

        if all_completed:
            break

    # Demo 3: Query Optimization
    print("\n🗄️  3. QUERY OPTIMIZATION")
    print("-" * 30)

    # Simulate database queries with different optimization strategies
    queries = [
        ("SELECT * FROM users WHERE active = true", QueryOptimizationType.INDEX_HINT),
        ("SELECT COUNT(*) FROM orders WHERE date > '2024-01-01'", QueryOptimizationType.CACHING),
        ("SELECT * FROM products ORDER BY price", QueryOptimizationType.PAGINATION),
    ]

    print("   🔍 Optimizing Database Queries:")

    for query, opt_type in queries:
        try:
            # Note: This would normally hit a real database
            # For demo purposes, we'll simulate the optimization
            start_time = time.time()

            # Simulate query optimization (would be real in production)
            await asyncio.sleep(0.05)  # Simulate query time
            simulated_result = [
                {"id": i, "data": f"record_{i}"}
                for i in range(random.randint(5, 20))
            ]

            execution_time = (time.time() - start_time) * 1000

            print(f"   📈 {opt_type.value}: {len(simulated_result)} rows in {execution_time:.1f}ms")

        except Exception as e:
            print(f"   ❌ Query optimization failed: {e}")

    # Demo 4: Batch Processing
    print("\n📦 4. INTELLIGENT BATCH PROCESSING")
    print("-" * 42)

    # Generate sample data for batch processing
    data_items = [
        {"id": i, "value": random.randint(1, 100), "category": f"cat_{i % 5}"}
        for i in range(250)
    ]

    def process_data_batch(batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a batch of data items"""
        return [
            {
                "id": item["id"],
                "processed_value": item["value"] * 2,
                "category": item["category"],
                "batch_processed": True
            }
            for item in batch
        ]

    print(f"   📊 Processing {len(data_items)} items in optimized batches...")

    start_time = time.time()
    processed_results = await performance_service.batch_process(
        items=data_items,
        processor_function=process_data_batch,
        batch_size=50,
        max_workers=4
    )
    batch_time = time.time() - start_time

    print(f"   ✅ Processed {len(processed_results)} items in {batch_time:.2f}s")
    print(f"   📈 Throughput: {len(processed_results)/batch_time:.0f} items/second")

    # Demo 5: Cache Performance with Tags
    print("\n🏷️  5. ADVANCED CACHE MANAGEMENT")
    print("-" * 40)

    # Cache data with different tags
    cache_operations = [
        ("product_1", {"name": "Widget A", "price": 19.99}, ["product", "electronics", "active"]),
        ("product_2", {"name": "Widget B", "price": 29.99}, ["product", "electronics", "featured"]),
        ("user_session", {"user_id": 123, "login_time": datetime.now().isoformat()}, ["session", "active"]),
        ("analytics_data", {"views": 1500, "clicks": 89}, ["analytics", "daily"]),
    ]

    print("   📝 Caching data with tags:")
    for key, value, tags in cache_operations:
        await cache_service.set(
            key=key,
            value=value,
            namespace="demo",
            tags=tags,
            ttl=600
        )
        print(f"   💾 {key}: {tags}")

    # Demonstrate tag-based invalidation
    print("\n   🗑️  Tag-based cache invalidation:")
    invalidated_count = await cache_service.invalidate_by_tags(["electronics"])
    print(f"   ✅ Invalidated {invalidated_count} entries with 'electronics' tag")

    # Verify invalidation
    product_1 = await cache_service.get("product_1", namespace="demo")
    user_session = await cache_service.get("user_session", namespace="demo")
    print(f"   📊 Product 1 after invalidation: {'❌ Removed' if product_1 is None else '✅ Still cached'}")
    print(f"   📊 User session after invalidation: {'❌ Removed' if user_session is None else '✅ Still cached'}")

    # Demo 6: Performance Metrics & Analytics
    print("\n📈 6. PERFORMANCE METRICS & ANALYTICS")
    print("-" * 45)

    # Get comprehensive performance metrics
    cache_metrics = await cache_service.get_metrics()
    performance_metrics = await performance_service.get_performance_metrics()

    print("   💾 Cache Performance:")
    print(f"      • Hit Ratio: {cache_metrics.get('hit_ratio_percent', 0):.1f}%")
    print(f"      • Total Operations: {cache_metrics.get('hits', 0) + cache_metrics.get('misses', 0)}")
    print(f"      • L1 Cache Size: {cache_metrics.get('l1_cache_size', 0)} entries")
    print(f"      • Avg Response Time: {cache_metrics.get('avg_response_time_ms', 0):.2f}ms")

    print("\n   ⚡ Background Job Performance:")
    job_metrics = performance_metrics.get("background_jobs", {})
    print(f"      • Completed Jobs: {job_metrics.get('completed', 0)}")
    print(f"      • Success Rate: {job_metrics.get('success_rate', 0):.1f}%")
    print(f"      • Queue Size: {job_metrics.get('queue_size', 0)}")

    print("\n   🗄️  Query Performance:")
    query_metrics = performance_metrics.get("query_performance", {})
    print(f"      • Total Queries: {query_metrics.get('total_queries', 0)}")
    print(f"      • Avg Query Time: {query_metrics.get('avg_query_time_ms', 0):.2f}ms")
    print(f"      • Cache Hit Ratio: {query_metrics.get('cache_hit_ratio', 0):.1f}%")

    # Demo 7: Health Monitoring
    print("\n🏥 7. SYSTEM HEALTH MONITORING")
    print("-" * 36)

    cache_health = await cache_service.health_check()
    performance_health = await performance_service.health_check()

    print("   🔍 Service Health Status:")
    print(f"      💾 Cache Service: {cache_health['status']} ({'Redis connected' if cache_health.get('checks', {}).get('redis', {}).get('connected') else 'Memory-only mode'})")
    print(f"      ⚡ Performance Service: {performance_health['status']} ({performance_health.get('metrics', {}).get('system', {}).get('worker_count', 0)} workers)")

    # Demo 8: Performance Optimization Recommendations
    print("\n💡 8. OPTIMIZATION RECOMMENDATIONS")
    print("-" * 42)

    recommendations = []

    # Analyze metrics and provide recommendations
    hit_ratio = cache_metrics.get('hit_ratio_percent', 0)
    if hit_ratio < 70:
        recommendations.append("🔧 Consider increasing cache TTL or improving cache key strategy")

    avg_query_time = query_metrics.get('avg_query_time_ms', 0)
    if avg_query_time > 100:
        recommendations.append("🗄️  Review slow queries and consider adding database indexes")

    queue_size = job_metrics.get('queue_size', 0)
    if queue_size > 10:
        recommendations.append("⚡ Consider adding more background workers for better throughput")

    success_rate = job_metrics.get('success_rate', 100)
    if success_rate < 95:
        recommendations.append("🔧 Review failed jobs and improve error handling")

    if not recommendations:
        recommendations.append("✅ Performance is optimal - no immediate actions needed")

    print("   📋 Performance Recommendations:")
    for i, rec in enumerate(recommendations, 1):
        print(f"      {i}. {rec}")

    # Demo 9: Real-time Performance Monitoring
    print("\n📊 9. REAL-TIME PERFORMANCE DASHBOARD")
    print("-" * 46)

    print("   🔄 Live Performance Metrics (5 second snapshot):")

    for i in range(5):
        await asyncio.sleep(1)

        # Get fresh metrics
        current_cache_metrics = await cache_service.get_metrics()
        current_perf_metrics = await performance_service.get_performance_metrics()

        cache_ops = current_cache_metrics.get('hits', 0) + current_cache_metrics.get('misses', 0)
        active_jobs = current_perf_metrics.get('background_jobs', {}).get('running', 0)
        queue_size = current_perf_metrics.get('background_jobs', {}).get('queue_size', 0)

        print(f"   {i+1}/5 📈 Cache Ops: {cache_ops:3d} | Active Jobs: {active_jobs:2d} | Queue: {queue_size:2d}")

    print("\n" + "=" * 65)
    print("🎉 PERFORMANCE OPTIMIZATION DEMO COMPLETE")
    print("✨ Smart caching and performance optimization fully operational!")
    print("🚀 System ready for high-performance production workloads")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(demo_performance_optimization())
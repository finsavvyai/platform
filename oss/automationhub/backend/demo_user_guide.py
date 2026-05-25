#!/usr/bin/env python3
"""
UPM.Plus Performance Optimization - User Guide Demo
A practical tutorial showing how to use the new performance features
"""

import asyncio
import time
import json
from datetime import datetime
from typing import List, Dict, Any

# Import services
from app.services.cache_service import cache_service, CacheStrategy
from app.services.performance_service import performance_service, JobPriority, QueryOptimizationType
from app.services.workflow_orchestration import (
    workflow_orchestration_service,
    WorkflowDefinition,
    TaskDefinition,
    TaskType
)

async def user_guide_demo():
    """
    Comprehensive user guide showing practical use cases for the performance features
    """

    print("📚 UPM.Plus Performance Optimization - USER GUIDE")
    print("=" * 60)
    print("This demo shows you how to use the new performance features")
    print("in real-world scenarios for maximum efficiency!")
    print("=" * 60)

    # Initialize services
    await cache_service.initialize()
    await performance_service.initialize()

    # SCENARIO 1: E-commerce Platform Optimization
    print("\n🛍️  SCENARIO 1: E-COMMERCE PLATFORM")
    print("-" * 40)
    print("You're building an e-commerce platform that needs to:")
    print("• Cache user sessions and product data")
    print("• Process orders in the background")
    print("• Optimize database queries for product search")

    # 1.1: Cache user sessions and product data
    print("\n📝 Step 1: Cache User Sessions & Product Data")

    # Cache user session
    user_session = {
        "user_id": 12345,
        "username": "john_doe",
        "cart_items": [{"product_id": 101, "quantity": 2}, {"product_id": 202, "quantity": 1}],
        "login_time": datetime.now().isoformat(),
        "preferences": {"currency": "USD", "language": "en"}
    }

    await cache_service.set(
        key="user_session",
        value=user_session,
        namespace="sessions",
        ttl=3600,  # 1 hour
        tags=["user", "session", "active"],
        user_id=12345  # Parameterized cache key
    )
    print("   ✅ User session cached for 1 hour")

    # Cache product catalog
    products = [
        {"id": 101, "name": "Wireless Headphones", "price": 99.99, "category": "electronics"},
        {"id": 202, "name": "Bluetooth Speaker", "price": 149.99, "category": "electronics"},
        {"id": 303, "name": "Smartphone Case", "price": 24.99, "category": "accessories"}
    ]

    for product in products:
        await cache_service.set(
            key=f"product_{product['id']}",
            value=product,
            namespace="products",
            ttl=7200,  # 2 hours
            tags=["product", product["category"], "catalog"]
        )
    print(f"   ✅ {len(products)} products cached")

    # 1.2: Retrieve cached data (simulating user browsing)
    print("\n🔍 Step 2: Fast User Data Retrieval")

    start_time = time.time()
    cached_session = await cache_service.get("user_session", namespace="sessions", user_id=12345)
    session_time = (time.time() - start_time) * 1000

    start_time = time.time()
    cached_product = await cache_service.get("product_101", namespace="products")
    product_time = (time.time() - start_time) * 1000

    print(f"   📊 User session retrieved in {session_time:.2f}ms")
    print(f"   📊 Product data retrieved in {product_time:.2f}ms")
    print(f"   👤 Welcome back, {cached_session['username']}!")
    print(f"   🛒 Cart: {len(cached_session['cart_items'])} items")

    # 1.3: Background order processing
    print("\n⚡ Step 3: Background Order Processing")

    async def process_order(order_data):
        """Simulate order processing"""
        await asyncio.sleep(0.3)  # Simulate payment processing
        return {
            "order_id": f"ORD_{int(time.time())}",
            "status": "confirmed",
            "total": sum(item["price"] * item["quantity"] for item in order_data["items"]),
            "processing_time": 0.3
        }

    def send_order_email(order_result):
        """Simulate sending confirmation email"""
        return f"Email sent for order {order_result['order_id']}"

    # Schedule high-priority order processing
    order_data = {
        "user_id": 12345,
        "items": [{"product_id": 101, "price": 99.99, "quantity": 2}]
    }

    order_job_id = await performance_service.schedule_job(
        "process_order",
        process_order,
        order_data,
        priority=JobPriority.HIGH,
        timeout_seconds=60
    )

    email_job_id = await performance_service.schedule_job(
        "send_confirmation_email",
        send_order_email,
        {"order_id": "placeholder"},  # Would be filled by order result
        priority=JobPriority.NORMAL
    )

    print(f"   📋 Order processing job: {order_job_id}")
    print(f"   📧 Email job scheduled: {email_job_id}")

    # SCENARIO 2: Data Analytics Dashboard
    print("\n📊 SCENARIO 2: DATA ANALYTICS DASHBOARD")
    print("-" * 45)
    print("You're building an analytics dashboard that needs to:")
    print("• Cache expensive analytics queries")
    print("• Process large datasets in batches")
    print("• Optimize database performance")

    # 2.1: Cache expensive analytics queries
    print("\n💾 Step 1: Cache Analytics Results")

    # Simulate expensive analytics calculation
    analytics_result = {
        "total_revenue": 125000.50,
        "order_count": 1250,
        "avg_order_value": 100.00,
        "top_products": [
            {"name": "Wireless Headphones", "sales": 450},
            {"name": "Bluetooth Speaker", "sales": 320}
        ],
        "generated_at": datetime.now().isoformat()
    }

    await cache_service.set(
        key="daily_analytics",
        value=analytics_result,
        namespace="analytics",
        ttl=3600,  # Cache for 1 hour
        tags=["analytics", "dashboard", "daily"],
        date="2024-01-15"  # Parameterized by date
    )
    print("   ✅ Daily analytics cached for 1 hour")

    # 2.2: Batch process large datasets
    print("\n📦 Step 2: Batch Process Large Datasets")

    # Generate sample transaction data
    transactions = []
    for i in range(1000):
        transactions.append({
            "id": i,
            "amount": round(50 + (i % 200), 2),
            "user_id": 1000 + (i % 100),
            "timestamp": datetime.now().isoformat()
        })

    def calculate_user_metrics(batch):
        """Calculate metrics for a batch of transactions"""
        user_totals = {}
        for transaction in batch:
            user_id = transaction["user_id"]
            if user_id not in user_totals:
                user_totals[user_id] = {"total": 0, "count": 0}
            user_totals[user_id]["total"] += transaction["amount"]
            user_totals[user_id]["count"] += 1

        return [
            {
                "user_id": uid,
                "total_spent": data["total"],
                "transaction_count": data["count"],
                "avg_transaction": round(data["total"] / data["count"], 2)
            }
            for uid, data in user_totals.items()
        ]

    print(f"   📊 Processing {len(transactions)} transactions...")
    start_time = time.time()

    user_metrics = await performance_service.batch_process(
        items=transactions,
        processor_function=calculate_user_metrics,
        batch_size=100,
        max_workers=4
    )

    batch_time = time.time() - start_time
    print(f"   ✅ Processed in {batch_time:.2f}s ({len(transactions)/batch_time:.0f} transactions/sec)")
    print(f"   📈 Generated metrics for {len(user_metrics)} users")

    # SCENARIO 3: Workflow-Based Automation
    print("\n🔄 SCENARIO 3: WORKFLOW-BASED AUTOMATION")
    print("-" * 48)
    print("You want to create workflows that leverage performance optimizations:")
    print("• Cache workflow results")
    print("• Use background jobs for heavy processing")
    print("• Monitor workflow performance")

    # 3.1: Create performance-optimized workflow
    print("\n🏗️  Step 1: Create Performance-Optimized Workflow")

    tasks = [
        TaskDefinition(
            name="🔍 Data Extraction",
            type=TaskType.DATA_PROCESSING,
            description="Extract data with caching",
            config={"cache_results": True, "ttl": 1800}
        ),
        TaskDefinition(
            name="🧮 Heavy Computation",
            type=TaskType.CUSTOM,
            description="CPU-intensive processing in background",
            config={"use_background_job": True, "priority": "high"}
        ),
        TaskDefinition(
            name="📊 Generate Report",
            type=TaskType.CODE_GENERATION,
            description="Generate final report",
            config={"cache_template": True}
        )
    ]

    # Set up dependencies
    tasks[1].dependencies = [tasks[0].id]  # Computation depends on extraction
    tasks[2].dependencies = [tasks[1].id]  # Report depends on computation

    workflow = WorkflowDefinition(
        name="🚀 Performance-Optimized Data Pipeline",
        description="Workflow with caching and background processing",
        tasks=tasks,
        metadata={
            "performance_optimization": True,
            "cache_strategy": "aggressive",
            "background_processing": True
        },
        created_by="demo@example.com"
    )

    workflow_result = await workflow_orchestration_service.create_workflow(workflow)
    print(f"   ✅ Workflow created: {workflow_result['status']}")

    # 3.2: Execute with performance monitoring
    print("\n⚡ Step 2: Execute with Performance Monitoring")

    execution_result = await workflow_orchestration_service.execute_workflow(
        workflow.id,
        context={"dataset_size": 10000, "optimization_level": "high"}
    )
    print(f"   🚀 Execution started: {execution_result['status']}")

    # Monitor execution with performance tracking
    print("   📊 Performance Monitoring:")
    for i in range(6):
        await asyncio.sleep(0.3)

        from uuid import UUID
        execution_id = UUID(execution_result["execution_id"])
        status = await workflow_orchestration_service.get_execution_status(execution_id)

        if status["status"] == "success":
            progress = status["progress_percent"]
            workflow_status = status["workflow_status"]

            # Also get performance metrics
            perf_metrics = await performance_service.get_performance_metrics()
            cache_metrics = await cache_service.get_metrics()

            print(f"   {i+1}/6 📈 Progress: {progress:5.1f}% | "
                  f"Status: {workflow_status:>10} | "
                  f"Cache Hit: {cache_metrics.get('hit_ratio_percent', 0):4.1f}%")

            if workflow_status in ["completed", "failed"]:
                break

    # SCENARIO 4: API Performance Optimization
    print("\n🌐 SCENARIO 4: API PERFORMANCE OPTIMIZATION")
    print("-" * 48)
    print("You're building high-performance APIs that need:")
    print("• Response caching")
    print("• Request rate limiting")
    print("• Background task processing")

    # 4.1: API Response Caching
    print("\n💨 Step 1: API Response Caching")

    async def get_user_profile(user_id: int):
        """Simulate API endpoint with caching"""
        cache_key = f"user_profile_{user_id}"

        # Try cache first
        cached_profile = await cache_service.get(cache_key, namespace="api_responses")
        if cached_profile:
            return {"data": cached_profile, "cached": True, "response_time": "< 1ms"}

        # Simulate database query
        await asyncio.sleep(0.1)  # Simulate DB query time
        profile = {
            "user_id": user_id,
            "name": f"User {user_id}",
            "email": f"user{user_id}@example.com",
            "last_login": datetime.now().isoformat(),
            "preferences": {"theme": "dark", "notifications": True}
        }

        # Cache the result
        await cache_service.set(
            cache_key,
            profile,
            namespace="api_responses",
            ttl=300,  # 5 minutes
            tags=["api", "user_profile"]
        )

        return {"data": profile, "cached": False, "response_time": "~100ms"}

    # Test API with and without cache
    print("   🔍 Testing API Performance:")

    # First call (cache miss)
    start_time = time.time()
    result1 = await get_user_profile(12345)
    time1 = (time.time() - start_time) * 1000

    # Second call (cache hit)
    start_time = time.time()
    result2 = await get_user_profile(12345)
    time2 = (time.time() - start_time) * 1000

    print(f"   📊 First call (DB): {time1:.1f}ms - Cached: {result1['cached']}")
    print(f"   📊 Second call (Cache): {time2:.1f}ms - Cached: {result2['cached']}")
    print(f"   🚀 Performance improvement: {(time1/time2):.1f}x faster!")

    # 4.2: Background task processing for APIs
    print("\n🔧 Step 2: Background API Tasks")

    async def send_notification(user_id: int, message: str):
        """Simulate sending notification"""
        await asyncio.sleep(0.2)  # Simulate email/SMS sending
        return {
            "notification_id": f"notif_{int(time.time())}",
            "user_id": user_id,
            "message": message,
            "sent_at": datetime.now().isoformat(),
            "status": "delivered"
        }

    def generate_report(report_type: str, user_id: int):
        """Simulate report generation"""
        time.sleep(0.5)  # Simulate heavy processing
        return {
            "report_id": f"report_{int(time.time())}",
            "type": report_type,
            "user_id": user_id,
            "status": "completed",
            "download_url": f"/reports/report_{int(time.time())}.pdf"
        }

    # Schedule background tasks (non-blocking)
    notification_job = await performance_service.schedule_job(
        "send_welcome_notification",
        send_notification,
        12345,
        "Welcome to our platform!",
        priority=JobPriority.HIGH
    )

    report_job = await performance_service.schedule_job(
        "generate_user_report",
        generate_report,
        "activity_summary",
        12345,
        priority=JobPriority.NORMAL
    )

    print(f"   📧 Notification job: {notification_job}")
    print(f"   📄 Report job: {report_job}")

    # SCENARIO 5: Performance Monitoring & Optimization
    print("\n📈 SCENARIO 5: PERFORMANCE MONITORING")
    print("-" * 43)
    print("Monitor and optimize your system performance:")

    # 5.1: Get comprehensive metrics
    print("\n📊 Step 1: Performance Dashboard")

    cache_metrics = await cache_service.get_metrics()
    perf_metrics = await performance_service.get_performance_metrics()
    workflow_health = await workflow_orchestration_service.health_check()

    print("   💾 Cache Performance:")
    print(f"      • Hit Ratio: {cache_metrics.get('hit_ratio_percent', 0):.1f}%")
    print(f"      • Operations: {cache_metrics.get('hits', 0)} hits, {cache_metrics.get('misses', 0)} misses")
    print(f"      • Response Time: {cache_metrics.get('avg_response_time_ms', 0):.2f}ms avg")
    print(f"      • Memory Usage: {cache_metrics.get('l1_cache_size', 0)} entries")

    print("\n   ⚡ Background Jobs:")
    job_metrics = perf_metrics["background_jobs"]
    print(f"      • Completed: {job_metrics['completed']}")
    print(f"      • Success Rate: {job_metrics['success_rate']:.1f}%")
    print(f"      • Queue Size: {job_metrics['queue_size']}")

    print("\n   🔄 Workflows:")
    print(f"      • Total Workflows: {workflow_health['total_workflows']}")
    print(f"      • Total Executions: {workflow_health['total_executions']}")

    # 5.2: Optimization recommendations
    print("\n💡 Step 2: Optimization Recommendations")

    recommendations = []

    # Analyze cache performance
    hit_ratio = cache_metrics.get('hit_ratio_percent', 0)
    if hit_ratio > 80:
        recommendations.append("🟢 Excellent cache performance! Consider expanding cache usage.")
    elif hit_ratio > 60:
        recommendations.append("🟡 Good cache performance. Consider optimizing cache keys.")
    else:
        recommendations.append("🔴 Low cache hit ratio. Review caching strategy and TTL values.")

    # Analyze job performance
    success_rate = job_metrics.get('success_rate', 100)
    if success_rate > 95:
        recommendations.append("🟢 Background jobs performing excellently!")
    else:
        recommendations.append("🟡 Review failed background jobs and error handling.")

    # Check queue size
    queue_size = job_metrics.get('queue_size', 0)
    if queue_size > 20:
        recommendations.append("🔴 High queue size. Consider adding more workers.")
    elif queue_size > 10:
        recommendations.append("🟡 Moderate queue size. Monitor during peak hours.")
    else:
        recommendations.append("🟢 Queue size optimal.")

    print("   📋 Recommendations:")
    for i, rec in enumerate(recommendations, 1):
        print(f"      {i}. {rec}")

    # PRACTICAL TIPS SECTION
    print("\n💡 PRACTICAL TIPS FOR PRODUCTION")
    print("-" * 40)

    tips = [
        "🔧 Use appropriate TTL values: Short for dynamic data, long for static content",
        "🏷️  Leverage cache tags for efficient invalidation of related data",
        "⚡ Schedule heavy tasks as background jobs to keep APIs responsive",
        "📊 Monitor cache hit ratios and adjust strategies accordingly",
        "🔄 Use workflows for complex multi-step processes with dependencies",
        "📈 Batch process large datasets instead of processing individually",
        "💾 Cache expensive database queries and API responses",
        "🎯 Use different job priorities based on business criticality"
    ]

    print("   📚 Best Practices:")
    for tip in tips:
        print(f"      • {tip}")

    # FINAL SUMMARY
    print("\n" + "=" * 60)
    print("🎉 USER GUIDE COMPLETE!")
    print("✨ You now know how to:")
    print("   💾 Implement smart caching for 10-1000x performance gains")
    print("   ⚡ Use background jobs for non-blocking operations")
    print("   📦 Process large datasets efficiently with batching")
    print("   🔄 Create performance-optimized workflows")
    print("   📊 Monitor and optimize system performance")
    print("   🌐 Build high-performance APIs with caching")
    print("\n🚀 Ready to build lightning-fast applications!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(user_guide_demo())
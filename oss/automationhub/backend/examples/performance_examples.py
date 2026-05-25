"""
UPM.Plus Performance Optimization - Code Examples
Practical code examples showing how to implement performance optimizations
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from app.services.cache_service import cache_service, CacheStrategy
from app.services.performance_service import performance_service, JobPriority, QueryOptimizationType


# ============================================================================
# EXAMPLE 1: E-COMMERCE PRODUCT CATALOG WITH CACHING
# ============================================================================

@dataclass
class Product:
    id: int
    name: str
    price: float
    category: str
    description: str
    stock: int

class ProductService:
    """Example service showing how to implement caching for product data"""

    async def get_product(self, product_id: int) -> Optional[Product]:
        """Get product with caching"""
        cache_key = f"product_{product_id}"

        # Try cache first
        cached_product = await cache_service.get(
            key=cache_key,
            namespace="products"
        )

        if cached_product:
            return Product(**cached_product)

        # Simulate database query
        await asyncio.sleep(0.1)  # DB query time
        product_data = {
            "id": product_id,
            "name": f"Product {product_id}",
            "price": 99.99,
            "category": "electronics",
            "description": f"High-quality product {product_id}",
            "stock": 50
        }

        # Cache for 1 hour with tags
        await cache_service.set(
            key=cache_key,
            value=product_data,
            namespace="products",
            ttl=3600,
            tags=["product", "catalog", product_data["category"]]
        )

        return Product(**product_data)

    async def update_product_price(self, product_id: int, new_price: float):
        """Update product price and invalidate cache"""
        # Update in database (simulated)
        await asyncio.sleep(0.05)

        # Invalidate cache
        await cache_service.delete(f"product_{product_id}", namespace="products")

        # Or update cache directly if you have the data
        product = await self.get_product(product_id)
        if product:
            product.price = new_price
            await cache_service.set(
                key=f"product_{product_id}",
                value=product.__dict__,
                namespace="products",
                ttl=3600,
                tags=["product", "catalog", product.category],
                strategy=CacheStrategy.WRITE_THROUGH
            )

    async def invalidate_category(self, category: str):
        """Invalidate all products in a category"""
        await cache_service.invalidate_by_tags([category])


# ============================================================================
# EXAMPLE 2: USER SESSION MANAGEMENT
# ============================================================================

class UserSessionService:
    """Example showing session caching with parameterized keys"""

    async def create_session(self, user_id: int, username: str) -> str:
        """Create user session with caching"""
        session_id = f"sess_{user_id}_{int(time.time())}"

        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "username": username,
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat(),
            "cart": [],
            "preferences": {}
        }

        # Cache session for 24 hours
        await cache_service.set(
            key="session",
            value=session_data,
            namespace="user_sessions",
            ttl=86400,  # 24 hours
            tags=["session", "active"],
            user_id=user_id,  # Parameterized key
            session_id=session_id
        )

        return session_id

    async def get_session(self, user_id: int, session_id: str) -> Optional[Dict]:
        """Get user session"""
        return await cache_service.get(
            key="session",
            namespace="user_sessions",
            user_id=user_id,
            session_id=session_id
        )

    async def update_cart(self, user_id: int, session_id: str, cart_items: List[Dict]):
        """Update user cart in session"""
        session = await self.get_session(user_id, session_id)
        if session:
            session["cart"] = cart_items
            session["last_activity"] = datetime.now().isoformat()

            await cache_service.set(
                key="session",
                value=session,
                namespace="user_sessions",
                ttl=86400,
                tags=["session", "active"],
                user_id=user_id,
                session_id=session_id,
                strategy=CacheStrategy.WRITE_THROUGH
            )


# ============================================================================
# EXAMPLE 3: BACKGROUND JOB PROCESSING
# ============================================================================

class OrderProcessingService:
    """Example showing background job processing for orders"""

    async def process_order_async(self, order_data: Dict[str, Any]) -> str:
        """Process order asynchronously"""

        # Schedule high-priority payment processing
        payment_job_id = await performance_service.schedule_job(
            "process_payment",
            self._process_payment,
            order_data["payment_info"],
            order_data["total_amount"],
            priority=JobPriority.CRITICAL,
            timeout_seconds=30
        )

        # Schedule inventory update
        inventory_job_id = await performance_service.schedule_job(
            "update_inventory",
            self._update_inventory,
            order_data["items"],
            priority=JobPriority.HIGH,
            timeout_seconds=60
        )

        # Schedule email notification (lower priority)
        email_job_id = await performance_service.schedule_job(
            "send_order_confirmation",
            self._send_order_email,
            order_data["customer_email"],
            order_data["order_id"],
            priority=JobPriority.NORMAL,
            timeout_seconds=120
        )

        return f"Order processing started: payment={payment_job_id}, inventory={inventory_job_id}, email={email_job_id}"

    async def _process_payment(self, payment_info: Dict, amount: float) -> Dict:
        """Process payment (simulated)"""
        await asyncio.sleep(0.5)  # Simulate payment gateway
        return {
            "transaction_id": f"txn_{int(time.time())}",
            "status": "approved",
            "amount": amount,
            "timestamp": datetime.now().isoformat()
        }

    async def _update_inventory(self, items: List[Dict]) -> Dict:
        """Update inventory (simulated)"""
        await asyncio.sleep(0.3)  # Simulate database updates
        return {
            "updated_items": len(items),
            "timestamp": datetime.now().isoformat(),
            "status": "completed"
        }

    def _send_order_email(self, email: str, order_id: str) -> Dict:
        """Send order confirmation email (simulated)"""
        time.sleep(0.2)  # Simulate email sending
        return {
            "email": email,
            "order_id": order_id,
            "sent_at": datetime.now().isoformat(),
            "status": "delivered"
        }


# ============================================================================
# EXAMPLE 4: ANALYTICS WITH BATCH PROCESSING
# ============================================================================

class AnalyticsService:
    """Example showing batch processing for analytics"""

    async def generate_user_analytics(self, user_ids: List[int]) -> Dict[str, Any]:
        """Generate analytics for multiple users using batch processing"""

        # Check cache first
        cache_key = f"user_analytics_{len(user_ids)}_users"
        cached_analytics = await cache_service.get(
            key=cache_key,
            namespace="analytics",
            user_count=len(user_ids)
        )

        if cached_analytics:
            return cached_analytics

        # Process in batches
        analytics_results = await performance_service.batch_process(
            items=user_ids,
            processor_function=self._calculate_user_metrics,
            batch_size=50,  # Process 50 users at a time
            max_workers=4   # Use 4 concurrent workers
        )

        # Aggregate results
        total_metrics = {
            "total_users": len(user_ids),
            "total_revenue": sum(result["revenue"] for result in analytics_results if result),
            "avg_order_value": 0,
            "active_users": sum(1 for result in analytics_results if result and result["is_active"]),
            "generated_at": datetime.now().isoformat()
        }

        if analytics_results:
            total_metrics["avg_order_value"] = total_metrics["total_revenue"] / len(analytics_results)

        # Cache for 1 hour
        await cache_service.set(
            key=cache_key,
            value=total_metrics,
            namespace="analytics",
            ttl=3600,
            tags=["analytics", "user_metrics"],
            user_count=len(user_ids)
        )

        return total_metrics

    def _calculate_user_metrics(self, user_batch: List[int]) -> List[Dict]:
        """Calculate metrics for a batch of users"""
        results = []
        for user_id in user_batch:
            # Simulate user metric calculation
            metrics = {
                "user_id": user_id,
                "revenue": user_id * 10.5,  # Simulated revenue
                "order_count": user_id % 20,
                "is_active": user_id % 3 == 0,
                "last_login": datetime.now().isoformat()
            }
            results.append(metrics)
        return results


# ============================================================================
# EXAMPLE 5: API RESPONSE CACHING DECORATOR
# ============================================================================

def cached_api_response(ttl: int = 300, namespace: str = "api_responses", tags: List[str] = None):
    """Decorator for caching API responses"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and parameters
            cache_key = f"{func.__name__}_{hash(str(args) + str(kwargs))}"

            # Try cache first
            cached_result = await cache_service.get(
                key=cache_key,
                namespace=namespace
            )

            if cached_result:
                return {"data": cached_result, "cached": True}

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            await cache_service.set(
                key=cache_key,
                value=result,
                namespace=namespace,
                ttl=ttl,
                tags=tags or ["api", func.__name__]
            )

            return {"data": result, "cached": False}

        return wrapper
    return decorator

# Usage example:
class APIService:
    @cached_api_response(ttl=600, tags=["user", "profile"])
    async def get_user_profile(self, user_id: int) -> Dict:
        """API endpoint with automatic caching"""
        await asyncio.sleep(0.1)  # Simulate database query
        return {
            "user_id": user_id,
            "name": f"User {user_id}",
            "email": f"user{user_id}@example.com",
            "profile_data": {"preferences": {}, "settings": {}}
        }


# ============================================================================
# EXAMPLE 6: QUERY OPTIMIZATION
# ============================================================================

class DatabaseService:
    """Example showing query optimization"""

    async def get_orders_optimized(
        self,
        user_id: int,
        limit: int = 10,
        use_cache: bool = True
    ) -> List[Dict]:
        """Get user orders with query optimization"""

        query = """
        SELECT o.id, o.total, o.status, o.created_at
        FROM orders o
        WHERE o.user_id = :user_id
        ORDER BY o.created_at DESC
        LIMIT :limit
        """

        params = {"user_id": user_id, "limit": limit}

        try:
            # Use performance service for query optimization
            result = await performance_service.optimize_query(
                query=query,
                params=params,
                use_cache=use_cache,
                optimization_type=QueryOptimizationType.CACHING
            )

            return result if isinstance(result, list) else []

        except Exception as e:
            print(f"Query optimization failed: {e}")
            # Fallback to direct query
            return []

    async def get_popular_products(self, category: str = None) -> List[Dict]:
        """Get popular products with aggressive caching"""

        # Complex analytics query
        query = """
        SELECT p.id, p.name, p.category, COUNT(oi.id) as order_count
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        WHERE (:category IS NULL OR p.category = :category)
        GROUP BY p.id, p.name, p.category
        ORDER BY order_count DESC
        LIMIT 50
        """

        params = {"category": category}

        # Use batch processing optimization for complex queries
        return await performance_service.optimize_query(
            query=query,
            params=params,
            use_cache=True,
            optimization_type=QueryOptimizationType.PAGINATION
        )


# ============================================================================
# EXAMPLE 7: PERFORMANCE MONITORING
# ============================================================================

class PerformanceMonitor:
    """Example showing how to monitor and optimize performance"""

    async def get_system_health(self) -> Dict[str, Any]:
        """Get comprehensive system health metrics"""

        # Get metrics from all services
        cache_metrics = await cache_service.get_metrics()
        perf_metrics = await performance_service.get_performance_metrics()

        return {
            "cache": {
                "hit_ratio": cache_metrics.get("hit_ratio_percent", 0),
                "operations": cache_metrics.get("hits", 0) + cache_metrics.get("misses", 0),
                "response_time": cache_metrics.get("avg_response_time_ms", 0),
                "status": "healthy" if cache_metrics.get("hit_ratio_percent", 0) > 70 else "degraded"
            },
            "background_jobs": {
                "success_rate": perf_metrics["background_jobs"]["success_rate"],
                "queue_size": perf_metrics["background_jobs"]["queue_size"],
                "completed": perf_metrics["background_jobs"]["completed"],
                "status": "healthy" if perf_metrics["background_jobs"]["success_rate"] > 95 else "degraded"
            },
            "queries": {
                "avg_time": perf_metrics["query_performance"]["avg_query_time_ms"],
                "total": perf_metrics["query_performance"]["total_queries"],
                "cache_hit_ratio": perf_metrics["query_performance"]["cache_hit_ratio"]
            }
        }

    async def optimize_system_performance(self) -> List[str]:
        """Analyze system and provide optimization recommendations"""
        health = await self.get_system_health()
        recommendations = []

        # Cache optimizations
        if health["cache"]["hit_ratio"] < 70:
            recommendations.append("Increase cache TTL values for static data")
            recommendations.append("Review cache key strategies for better hit rates")

        # Background job optimizations
        if health["background_jobs"]["queue_size"] > 20:
            recommendations.append("Add more background workers to handle queue")

        if health["background_jobs"]["success_rate"] < 95:
            recommendations.append("Review failed jobs and improve error handling")

        # Query optimizations
        if health["queries"]["avg_time"] > 100:
            recommendations.append("Optimize slow queries or add database indexes")

        return recommendations or ["System performance is optimal"]

    async def clear_performance_caches(self, cache_type: str = "all"):
        """Clear caches for performance testing"""
        if cache_type == "all" or cache_type == "api":
            await cache_service.clear_namespace("api_responses")

        if cache_type == "all" or cache_type == "analytics":
            await cache_service.clear_namespace("analytics")

        if cache_type == "all" or cache_type == "products":
            await cache_service.clear_namespace("products")


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

async def example_usage():
    """Example showing how to use all the performance features together"""

    print("🚀 Performance Examples Demo")
    print("=" * 40)

    # Initialize services
    await cache_service.initialize()
    await performance_service.initialize()

    # Example 1: Product service with caching
    product_service = ProductService()
    product = await product_service.get_product(123)
    print(f"✅ Product retrieved: {product.name} - ${product.price}")

    # Example 2: Session management
    session_service = UserSessionService()
    session_id = await session_service.create_session(456, "john_doe")
    print(f"✅ Session created: {session_id}")

    # Example 3: Background order processing
    order_service = OrderProcessingService()
    order_data = {
        "order_id": "ORD123",
        "customer_email": "customer@example.com",
        "total_amount": 199.99,
        "payment_info": {"card": "****1234"},
        "items": [{"product_id": 123, "quantity": 2}]
    }
    result = await order_service.process_order_async(order_data)
    print(f"✅ Order processing: {result}")

    # Example 4: Analytics with batch processing
    analytics_service = AnalyticsService()
    user_ids = list(range(1, 101))  # 100 users
    analytics = await analytics_service.generate_user_analytics(user_ids)
    print(f"✅ Analytics: {analytics['total_users']} users, ${analytics['total_revenue']:.2f} revenue")

    # Example 5: Cached API
    api_service = APIService()
    profile = await api_service.get_user_profile(789)
    print(f"✅ API response: {profile['data']['name']} (Cached: {profile['cached']})")

    # Example 6: Performance monitoring
    monitor = PerformanceMonitor()
    health = await monitor.get_system_health()
    recommendations = await monitor.optimize_system_performance()
    print(f"✅ System health: Cache {health['cache']['hit_ratio']:.1f}% hit ratio")
    print(f"✅ Recommendations: {len(recommendations)} items")

    print("\n🎉 All examples completed successfully!")

if __name__ == "__main__":
    asyncio.run(example_usage())
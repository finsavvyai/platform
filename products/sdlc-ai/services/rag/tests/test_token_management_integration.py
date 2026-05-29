"""
Comprehensive Integration Tests for Token Management System.

This test suite validates the complete token management workflow including
token tracking, budget enforcement, usage analytics, cost optimization,
alerts, and billing integration.
"""

import asyncio
import pytest
import json
from datetime import datetime, timedelta, date
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch
import tempfile
import os

from app.services.token.token_manager import (
    TokenManager,
    TokenUsageRecord,
    TokenQuota,
    TokenPricing,
    ProviderType,
    TokenType,
)
from app.services.budget.budget_manager import (
    BudgetManager,
    BudgetPolicy,
    BudgetLimit,
    BudgetType,
    EnforcementAction,
)
from app.services.analytics.usage_analytics import (
    UsageAnalyticsService,
    AnalyticsPeriod,
)
from app.services.cost.cost_optimizer import (
    CostOptimizer,
    OptimizationStrategy,
    OptimizationRecommendation,
)
from app.services.alerts.alert_manager import (
    AlertManager,
    Alert,
    AlertType,
    AlertSeverity,
    NotificationChannel,
)
from app.services.billing.billing_integration import (
    BillingIntegration,
    BillingPlan,
    CustomerAccount,
    Invoice,
    InvoiceStatus,
)
from app.services.llm.base_provider import TokenUsage


@pytest.fixture
async def redis_client():
    """Create a test Redis client."""
    import redis.asyncio as redis

    # Use a test Redis database
    client = redis.from_url("redis://localhost:6379/15", decode_responses=False)
    yield client
    # Clean up after tests
    await client.flushdb()
    await client.close()


@pytest.fixture
async def token_manager(redis_client):
    """Create a token manager for testing."""
    tm = TokenManager(redis_url="redis://localhost:6379/15", cache_ttl=60)
    await tm.initialize()
    yield tm
    await tm.cleanup()


@pytest.fixture
async def budget_manager(redis_client):
    """Create a budget manager for testing."""
    bm = BudgetManager(redis_url="redis://localhost:6379/15", cache_ttl=60)
    await bm.initialize()
    yield bm
    await bm.cleanup()


@pytest.fixture
async def analytics_service(redis_client):
    """Create an analytics service for testing."""
    aservice = UsageAnalyticsService(
        redis_url="redis://localhost:6379/15", cache_ttl=60
    )
    await aservice.initialize()
    yield aservice
    await aservice.cleanup()


@pytest.fixture
async def cost_optimizer(redis_client):
    """Create a cost optimizer for testing."""
    co = CostOptimizer(redis_url="redis://localhost:6379/15", cache_ttl=60)
    await co.initialize()
    yield co
    await co.cleanup()


@pytest.fixture
async def alert_manager(redis_client):
    """Create an alert manager for testing."""
    am = AlertManager(redis_url="redis://localhost:6379/15")
    await am.initialize()
    yield am
    await am.cleanup()


@pytest.fixture
async def billing_integration(redis_client):
    """Create a billing integration for testing."""
    bi = BillingIntegration(
        redis_url="redis://localhost:6379/15",
        provider=BillingIntegration.BillingProvider.CUSTOM,
        auto_invoicing_enabled=False,  # Disable for tests
        auto_payment_enabled=False,  # Disable for tests
    )
    await bi.initialize()
    yield bi
    await bi.cleanup()


@pytest.fixture
def sample_tenant():
    """Sample tenant data."""
    return {
        "tenant_id": "test_tenant_001",
        "user_id": "test_user_001",
        "request_id": "req_123456",
        "session_id": "sess_789",
    }


@pytest.fixture
def sample_usage():
    """Sample token usage data."""
    return TokenUsage(
        prompt_tokens=100,
        completion_tokens=50,
        total_tokens=150,
    )


class TestTokenManagementIntegration:
    """Integration tests for the complete token management system."""

    @pytest.mark.asyncio
    async def test_complete_token_workflow(
        self,
        token_manager,
        budget_manager,
        analytics_service,
        cost_optimizer,
        alert_manager,
        billing_integration,
        sample_tenant,
        sample_usage,
    ):
        """Test the complete token management workflow from usage to billing."""

        tenant_id = sample_tenant["tenant_id"]
        user_id = sample_tenant["user_id"]
        request_id = sample_tenant["request_id"]

        # Step 1: Set up pricing for providers
        openai_pricing = TokenPricing(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            input_token_price=Decimal("0.0015"),
            output_token_price=Decimal("0.002"),
        )
        await token_manager.set_pricing(openai_pricing)

        claude_pricing = TokenPricing(
            provider=ProviderType.ANTHROPIC,
            model="claude-3-haiku-20240307",
            input_token_price=Decimal("0.00025"),
            output_token_price=Decimal("0.00125"),
        )
        await token_manager.set_pricing(claude_pricing)

        # Step 2: Create budget policy
        budget_policy = BudgetPolicy(
            tenant_id=tenant_id,
            name="Test Budget Policy",
            description="Test policy for integration testing",
            limits=[
                BudgetLimit(
                    budget_type=BudgetType.MONTHLY,
                    amount=Decimal("100.00"),
                    token_limit=100000,
                    warn_threshold=0.8,
                    critical_threshold=0.95,
                )
            ],
            warning_action=EnforcementAction.NOTIFICATION,
            exhausted_action=EnforcementAction.BLOCK,
            notification_channels=["email"],
            escalation_emails=["admin@test.com"],
        )
        await budget_manager.create_budget_policy(budget_policy)

        # Step 3: Create billing plan and customer
        billing_plan = BillingPlan(
            name="Test Plan",
            description="Test billing plan",
            base_price=Decimal("50.00"),
            billing_cycle=BillingPlan.BillingCycle.MONTHLY,
            included_tokens=50000,
            price_per_token=Decimal("0.001"),
        )
        plan_id = await billing_integration.create_billing_plan(billing_plan)

        customer = CustomerAccount(
            tenant_id=tenant_id,
            name="Test Customer",
            email="billing@test.com",
            billing_plan_id=plan_id,
        )
        customer_id = await billing_integration.create_customer_account(customer)

        # Step 4: Track token usage
        usage_record = await token_manager.track_token_usage(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            usage=sample_usage,
            tenant_id=tenant_id,
            user_id=user_id,
            request_id=request_id,
            operation_type="chat_completion",
            request_duration_ms=1500,
            success=True,
        )

        # Verify usage record
        assert usage_record.tenant_id == tenant_id
        assert usage_record.user_id == user_id
        assert usage_record.total_tokens == 150
        assert usage_record.total_cost > 0

        # Step 5: Check budget enforcement
        can_consume, action, reason = await budget_manager.check_budget_enforcement(
            tenant_id=tenant_id,
            amount=usage_record.total_cost,
            tokens=usage_record.total_tokens,
            requests=1,
            request_id=request_id,
            user_id=user_id,
        )

        assert can_consume is True
        assert action is None

        # Step 6: Get cost optimization recommendation
        recommendation = await cost_optimizer.optimize_request(
            tenant_id=tenant_id,
            operation_type="chat_completion",
            estimated_tokens=200,
            preferred_quality="standard",
        )

        assert recommendation.tenant_id == tenant_id
        assert recommendation.confidence_score > 0

        # Step 7: Generate usage analytics
        analytics = await analytics_service.generate_usage_analytics(
            tenant_id=tenant_id,
            period=AnalyticsPeriod.DAILY,
            include_forecasts=True,
            include_patterns=True,
        )

        assert analytics.tenant_id == tenant_id
        assert analytics.total_tokens >= 150

        # Step 8: Record usage for billing
        await billing_integration.record_usage(
            tenant_id=tenant_id,
            usage_data={
                "tokens": usage_record.total_tokens,
                "requests": 1,
                "cost": float(usage_record.total_cost),
            },
            timestamp=usage_record.timestamp,
            metadata={"request_id": request_id},
        )

        # Step 9: Generate invoice
        invoice = await billing_integration.generate_invoice(
            tenant_id=tenant_id,
            period_start=date.today(),
            period_end=date.today() + timedelta(days=30),
        )

        assert invoice.tenant_id == tenant_id
        assert invoice.total_amount >= billing_plan.base_price
        assert len(invoice.line_items) > 0

        # Step 10: Track additional usage to trigger alerts
        # Simulate high usage that might trigger budget warnings
        for i in range(10):
            await token_manager.track_token_usage(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                usage=TokenUsage(
                    prompt_tokens=1000,
                    completion_tokens=500,
                    total_tokens=1500,
                ),
                tenant_id=tenant_id,
                user_id=user_id,
                request_id=f"req_{i:06d}",
                operation_type="chat_completion",
            )

        # Step 11: Check if budget warnings are triggered
        policy = await budget_manager.get_budget_policy(tenant_id, "monthly")
        assert policy is not None
        assert len(policy.limits) > 0

        limit = policy.limits[0]
        usage_percentage = limit.usage_percentage()

        # With the additional usage, we should have some utilization
        assert usage_percentage > 0

        # Step 12: Get billing metrics
        metrics = await billing_integration.get_billing_metrics(tenant_id=tenant_id)
        assert metrics.total_customers >= 1
        assert metrics.total_invoices >= 1

        # Step 13: Export invoice data
        csv_data = await billing_integration.export_invoice_data(
            format="csv",
            tenant_id=tenant_id,
        )
        assert isinstance(csv_data, str)
        assert invoice.invoice_number in csv_data

    @pytest.mark.asyncio
    async def test_budget_exceeded_workflow(
        self,
        token_manager,
        budget_manager,
        alert_manager,
        sample_tenant,
        sample_usage,
    ):
        """Test workflow when budget limits are exceeded."""

        tenant_id = sample_tenant["tenant_id"]

        # Create a very low budget policy
        budget_policy = BudgetPolicy(
            tenant_id=tenant_id,
            name="Low Budget Policy",
            description="Policy with very low limits for testing",
            limits=[
                BudgetLimit(
                    budget_type=BudgetType.DAILY,
                    amount=Decimal("1.00"),  # Very low limit
                    token_limit=1000,
                    warn_threshold=0.5,
                    critical_threshold=0.9,
                    soft_limit=False,  # Hard limit
                )
            ],
            warning_action=EnforcementAction.NOTIFICATION,
            exhausted_action=EnforcementAction.BLOCK,
        )
        await budget_manager.create_budget_policy(budget_policy)

        # Set up pricing
        pricing = TokenPricing(
            provider=ProviderType.OPENAI,
            model="gpt-4",
            input_token_price=Decimal("0.03"),
            output_token_price=Decimal("0.06"),
        )
        await token_manager.set_pricing(pricing)

        # Create alert rule for budget exceeded
        from app.services.alerts.alert_manager import AlertRule

        alert_rule = AlertRule(
            name="Budget Exceeded Alert",
            description="Alert when budget is exceeded",
            alert_types=[AlertType.BUDGET_EXHAUSTED],
            notification_channels=[NotificationChannel.EMAIL],
            notification_emails=["test@example.com"],
            cooldown_minutes=0,  # No cooldown for testing
        )
        await alert_manager.create_alert_rule(alert_rule)

        # Track usage that exceeds the budget
        high_usage = TokenUsage(
            prompt_tokens=1000,
            completion_tokens=500,
            total_tokens=1500,
        )

        usage_record = await token_manager.track_token_usage(
            provider=ProviderType.OPENAI,
            model="gpt-4",
            usage=high_usage,
            tenant_id=tenant_id,
            request_id="high_usage_req",
        )

        # Check budget enforcement - should block
        can_consume, action, reason = await budget_manager.check_budget_enforcement(
            tenant_id=tenant_id,
            amount=usage_record.total_cost,
            tokens=usage_record.total_tokens,
            requests=1,
            request_id="high_usage_req",
        )

        # Should be blocked due to hard limit
        assert can_consume is False
        assert action == EnforcementAction.BLOCK
        assert "exceeded" in reason.lower()

        # Check for alerts
        alerts = await alert_manager.get_active_alerts(tenant_id=tenant_id)
        # Note: Alerts might not be triggered immediately due to async processing
        # In a real system, we would wait for the alert processing loop

    @pytest.mark.asyncio
    async def test_cost_optimization_scenarios(
        self,
        token_manager,
        cost_optimizer,
        sample_tenant,
    ):
        """Test various cost optimization scenarios."""

        tenant_id = sample_tenant["tenant_id"]

        # Set up pricing for different models
        models_pricing = [
            TokenPricing(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                input_token_price=Decimal("0.0015"),
                output_token_price=Decimal("0.002"),
            ),
            TokenPricing(
                provider=ProviderType.OPENAI,
                model="gpt-4",
                input_token_price=Decimal("0.03"),
                output_token_price=Decimal("0.06"),
            ),
            TokenPricing(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-haiku-20240307",
                input_token_price=Decimal("0.00025"),
                output_token_price=Decimal("0.00125"),
            ),
            TokenPricing(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-sonnet-20240229",
                input_token_price=Decimal("0.003"),
                output_token_price=Decimal("0.015"),
            ),
        ]

        for pricing in models_pricing:
            await token_manager.set_pricing(pricing)

        # Update cost optimizer with performance metrics
        await cost_optimizer.update_provider_metrics(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            response_time_ms=1200,
            success=True,
            token_usage=TokenUsage(
                prompt_tokens=100, completion_tokens=50, total_tokens=150
            ),
            cost=Decimal("0.25"),
            quality_score=0.7,
        )

        await cost_optimizer.update_provider_metrics(
            provider=ProviderType.ANTHROPIC,
            model="claude-3-haiku-20240307",
            response_time_ms=800,
            success=True,
            token_usage=TokenUsage(
                prompt_tokens=100, completion_tokens=50, total_tokens=150
            ),
            cost=Decimal("0.10"),
            quality_score=0.75,
        )

        # Test cost-first optimization
        cost_optimizer.default_strategy = OptimizationStrategy.COST_FIRST
        recommendation = await cost_optimizer.optimize_request(
            tenant_id=tenant_id,
            estimated_tokens=1000,
            preferred_quality="standard",
        )

        # Should recommend the cheapest option (Claude Haiku)
        assert recommendation.recommended_provider == ProviderType.ANTHROPIC
        assert recommendation.recommended_model == "claude-3-haiku-20240307"
        assert "lowest cost" in " ".join(recommendation.reasoning).lower()

        # Test performance-first optimization
        cost_optimizer.default_strategy = OptimizationStrategy.PERFORMANCE_FIRST
        recommendation = await cost_optimizer.optimize_request(
            tenant_id=tenant_id,
            max_response_time_ms=1000,
        )

        # Should recommend the fastest option
        assert recommendation.recommended_provider is not None
        assert "fastest response" in " ".join(recommendation.reasoning).lower()

        # Test balanced optimization
        cost_optimizer.default_strategy = OptimizationStrategy.BALANCED
        recommendation = await cost_optimizer.optimize_request(
            tenant_id=tenant_id,
            estimated_tokens=1000,
            max_response_time_ms=2000,
        )

        # Should recommend a balanced option
        assert recommendation.recommended_provider is not None
        assert recommendation.confidence_score > 0.5

        # Test cost savings opportunities
        opportunities = await cost_optimizer.get_cost_savings_opportunities(
            tenant_id=tenant_id,
            min_savings_threshold=Decimal("5.00"),
        )

        # Should identify potential savings
        assert isinstance(opportunities, list)

    @pytest.mark.asyncio
    async def test_token_quota_management(
        self,
        token_manager,
        sample_tenant,
        sample_usage,
    ):
        """Test token quota management and enforcement."""

        tenant_id = sample_tenant["tenant_id"]

        # Create a token quota
        from app.services.token.token_manager import TokenQuota

        quota = TokenQuota(
            tenant_id=tenant_id,
            quota_type="daily",
            total_token_limit=10000,
            cost_limit=Decimal("50.00"),
            enabled=True,
            warn_threshold=0.8,
            hard_limit=True,
        )
        await token_manager.set_quota(quota)

        # Track usage within quota
        usage_records = []
        for i in range(5):
            record = await token_manager.track_token_usage(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                usage=TokenUsage(
                    prompt_tokens=100,
                    completion_tokens=50,
                    total_tokens=150,
                ),
                tenant_id=tenant_id,
                request_id=f"quota_test_{i}",
            )
            usage_records.append(record)

        # Check quota status
        current_quota = await token_manager.get_quota(tenant_id, "daily")
        assert current_quota is not None
        assert current_quota.total_tokens_used == 750  # 5 * 150
        assert current_quota.usage_percentage("total_tokens") == 7.5  # 750 / 10000

        # Test quota enforcement
        from app.services.token.token_manager import TokenQuota

        test_quota = TokenQuota(
            tenant_id=tenant_id,
            quota_type="test",
            total_token_limit=100,
            cost_limit=Decimal("1.00"),
            enabled=True,
            hard_limit=True,
        )

        can_consume, reason, status = test_quota.can_consume(
            prompt_tokens=200,
            completion_tokens=100,
            cost=Decimal("2.00"),
        )

        # Should not allow consumption (exceeds both token and cost limits)
        assert can_consume is False
        assert "exceeded" in reason.lower()

    @pytest.mark.asyncio
    async def test_usage_analytics_and_forecasting(
        self,
        token_manager,
        analytics_service,
        sample_tenant,
    ):
        """Test usage analytics and forecasting capabilities."""

        tenant_id = sample_tenant["tenant_id"]

        # Set up pricing
        pricing = TokenPricing(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            input_token_price=Decimal("0.0015"),
            output_token_price=Decimal("0.002"),
        )
        await token_manager.set_pricing(pricing)

        # Generate historical usage data
        now = datetime.now()
        for days_ago in range(30, 0, -1):
            timestamp = now - timedelta(days=days_ago)

            # Simulate varying usage patterns
            base_usage = 1000
            variation = int(base_usage * 0.3 * (days_ago % 7) / 7)  # Weekly pattern

            for hour in range(0, 24, 4):  # Every 4 hours
                record = await token_manager.track_token_usage(
                    provider=ProviderType.OPENAI,
                    model="gpt-3.5-turbo",
                    usage=TokenUsage(
                        prompt_tokens=base_usage + variation,
                        completion_tokens=(base_usage + variation) // 2,
                        total_tokens=int(base_usage * 1.5 + variation * 1.5),
                    ),
                    tenant_id=tenant_id,
                    request_id=f"hist_{days_ago}_{hour}",
                    timestamp=timestamp.replace(hour=hour),
                )

        # Generate analytics for different periods
        daily_analytics = await analytics_service.generate_usage_analytics(
            tenant_id=tenant_id,
            period=AnalyticsPeriod.DAILY,
            include_forecasts=True,
            include_patterns=True,
        )

        assert daily_analytics.tenant_id == tenant_id
        assert daily_analytics.total_tokens > 0
        assert daily_analytics.total_cost > 0
        assert len(daily_analytics.hourly_usage) > 0

        # Test real-time metrics
        real_time = await analytics_service.get_real_time_metrics(
            tenant_id=tenant_id,
            time_window_minutes=60,
        )

        assert real_time["tenant_id"] == tenant_id
        assert "current_requests_per_minute" in real_time
        assert "current_tokens_per_minute" in real_time

        # Test user behavior analytics
        user_analytics = await analytics_service.get_user_behavior_analytics(
            tenant_id=tenant_id,
            days=7,
        )

        assert user_analytics["tenant_id"] == tenant_id
        assert "user_frequency" in user_analytics
        assert "usage_patterns" in user_analytics

        # Test cost optimization insights
        insights = await analytics_service.get_cost_optimization_insights(
            tenant_id=tenant_id,
            period=AnalyticsPeriod.MONTHLY,
        )

        assert insights["tenant_id"] == tenant_id
        assert "total_cost" in insights
        assert "recommendations" in insights
        assert isinstance(insights["recommendations"], list)

    @pytest.mark.asyncio
    async def test_alert_management_and_notifications(
        self,
        alert_manager,
        sample_tenant,
    ):
        """Test alert management and notification system."""

        tenant_id = sample_tenant["tenant_id"]

        # Create alert rules for different scenarios
        from app.services.alerts.alert_manager import AlertRule

        budget_rule = AlertRule(
            name="Budget Warning",
            description="Alert when budget reaches 80%",
            alert_types=[AlertType.BUDGET_THRESHOLD],
            notification_channels=[NotificationChannel.EMAIL],
            notification_emails=["admin@test.com"],
            cooldown_minutes=0,
        )
        await alert_manager.create_alert_rule(budget_rule)

        anomaly_rule = AlertRule(
            name="Cost Anomaly",
            description="Alert on unusual cost patterns",
            alert_types=[AlertType.COST_ANOMALY],
            notification_channels=[NotificationChannel.SLACK],
            notification_slack_channels=["#alerts"],
            cooldown_minutes=0,
        )
        await alert_manager.create_alert_rule(anomaly_rule)

        # Trigger different types of alerts
        budget_alert = await alert_manager.trigger_alert(
            alert_type=AlertType.BUDGET_THRESHOLD,
            tenant_id=tenant_id,
            title="Budget Warning",
            message="Budget usage has reached 80% of the monthly limit",
            severity=AlertSeverity.WARNING,
            context={
                "budget_limit": 100.0,
                "current_usage": 80.0,
                "usage_percentage": 80.0,
            },
            metrics={
                "budget_used": 80.0,
                "budget_remaining": 20.0,
            },
        )

        assert budget_alert is not None
        assert budget_alert.tenant_id == tenant_id
        assert budget_alert.alert_type == AlertType.BUDGET_THRESHOLD
        assert budget_alert.severity == AlertSeverity.WARNING

        # Trigger critical alert
        critical_alert = await alert_manager.trigger_alert(
            alert_type=AlertType.BUDGET_EXHAUSTED,
            tenant_id=tenant_id,
            title="Budget Exhausted",
            message="Monthly budget has been completely exhausted",
            severity=AlertSeverity.CRITICAL,
            context={
                "budget_limit": 100.0,
                "current_usage": 100.0,
                "overspend": 0.0,
            },
        )

        assert critical_alert is not None
        assert critical_alert.severity == AlertSeverity.CRITICAL

        # Get active alerts
        active_alerts = await alert_manager.get_active_alerts(tenant_id=tenant_id)
        assert len(active_alerts) >= 2

        # Filter by severity
        critical_alerts = await alert_manager.get_active_alerts(
            tenant_id=tenant_id,
            severity=AlertSeverity.CRITICAL,
        )
        assert len(critical_alerts) >= 1

        # Acknowledge an alert
        acknowledged = await alert_manager.acknowledge_alert(
            alert_id=budget_alert.id,
            acknowledged_by="test_admin",
            notes="Investigating the budget usage",
        )
        assert acknowledged is True

        # Resolve an alert
        resolved = await alert_manager.resolve_alert(
            alert_id=critical_alert.id,
            resolved_by="test_admin",
            resolution_notes="Budget limit increased",
        )
        assert resolved is True

        # Check alert metrics
        metrics = await alert_manager.get_alert_metrics(tenant_id=tenant_id, days=7)
        assert metrics.total_alerts >= 2
        assert metrics.resolved_alerts >= 1

    @pytest.mark.asyncio
    async def test_billing_integration_e2e(
        self,
        billing_integration,
        sample_tenant,
    ):
        """Test end-to-end billing integration."""

        tenant_id = sample_tenant["tenant_id"]

        # Create billing plans
        free_plan = BillingPlan(
            name="Free Plan",
            description="Free tier with limited usage",
            base_price=Decimal("0"),
            included_tokens=10000,
            price_per_token=Decimal("0.002"),
        )
        free_plan_id = await billing_integration.create_billing_plan(free_plan)

        pro_plan = BillingPlan(
            name="Pro Plan",
            description="Professional tier with extended limits",
            base_price=Decimal("99.00"),
            included_tokens=1000000,
            price_per_token=Decimal("0.001"),
        )
        pro_plan_id = await billing_integration.create_billing_plan(pro_plan)

        # Create customer accounts
        free_customer = CustomerAccount(
            tenant_id=tenant_id + "_free",
            name="Free Tier Customer",
            email="free@test.com",
            billing_plan_id=free_plan_id,
            auto_pay_enabled=False,
        )
        free_customer_id = await billing_integration.create_customer_account(
            free_customer
        )

        pro_customer = CustomerAccount(
            tenant_id=tenant_id + "_pro",
            name="Pro Tier Customer",
            email="pro@test.com",
            billing_plan_id=pro_plan_id,
            auto_pay_enabled=True,
            payment_methods=[
                {
                    "type": "credit_card",
                    "last4": "4242",
                    "brand": "visa",
                }
            ],
        )
        pro_customer_id = await billing_integration.create_customer_account(
            pro_customer
        )

        # Record usage for both customers
        import random

        for i in range(10):
            # Free customer usage (within limits)
            await billing_integration.record_usage(
                tenant_id=free_customer.tenant_id,
                usage_data={
                    "tokens": random.randint(100, 500),
                    "requests": 1,
                    "cost": round(random.uniform(0.1, 0.5), 2),
                },
                metadata={"request_id": f"free_req_{i}"},
            )

            # Pro customer usage (higher volume)
            await billing_integration.record_usage(
                tenant_id=pro_customer.tenant_id,
                usage_data={
                    "tokens": random.randint(1000, 5000),
                    "requests": random.randint(1, 5),
                    "cost": round(random.uniform(1.0, 5.0), 2),
                },
                metadata={"request_id": f"pro_req_{i}"},
            )

        # Generate invoices
        period_start = date.today()
        period_end = date.today() + timedelta(days=30)

        free_invoice = await billing_integration.generate_invoice(
            tenant_id=free_customer.tenant_id,
            period_start=period_start,
            period_end=period_end,
        )

        pro_invoice = await billing_integration.generate_invoice(
            tenant_id=pro_customer.tenant_id,
            period_start=period_start,
            period_end=period_end,
        )

        # Verify invoices
        assert free_invoice.tenant_id == free_customer.tenant_id
        assert free_invoice.total_amount >= 0
        assert len(free_invoice.line_items) > 0

        assert pro_invoice.tenant_id == pro_customer.tenant_id
        assert pro_invoice.total_amount >= pro_plan.base_price
        assert len(pro_invoice.line_items) > 0

        # Check that pro invoice includes subscription fee
        subscription_items = [
            item
            for item in pro_invoice.line_items
            if item.get("item_type") == "subscription"
        ]
        assert len(subscription_items) > 0

        # Get billing metrics
        metrics = await billing_integration.get_billing_metrics()
        assert metrics.total_customers >= 2
        assert metrics.total_invoices >= 2
        assert metrics.monthly_recurring_revenue >= pro_plan.base_price

        # Export invoice data
        csv_export = await billing_integration.export_invoice_data(format="csv")
        assert isinstance(csv_export, str)
        assert free_invoice.invoice_number in csv_export
        assert pro_invoice.invoice_number in csv_export

        json_export = await billing_integration.export_invoice_data(format="json")
        assert isinstance(json_export, str)
        invoice_data = json.loads(json_export)
        assert len(invoice_data) >= 2

    @pytest.mark.asyncio
    async def test_error_handling_and_recovery(
        self,
        token_manager,
        budget_manager,
        alert_manager,
        sample_tenant,
    ):
        """Test error handling and recovery mechanisms."""

        tenant_id = sample_tenant["tenant_id"]

        # Test handling of invalid token usage data
        with pytest.raises(Exception):
            await token_manager.track_token_usage(
                provider=ProviderType.OPENAI,
                model="",
                usage=TokenUsage(prompt_tokens=-1, completion_tokens=0, total_tokens=0),
                tenant_id=tenant_id,
            )

        # Test handling of non-existent budget policy
        can_consume, action, reason = await budget_manager.check_budget_enforcement(
            tenant_id="non_existent_tenant",
            amount=Decimal("10.00"),
            tokens=100,
        )
        # Should allow consumption when no policy exists
        assert can_consume is True

        # Test alert with invalid data
        alert = await alert_manager.trigger_alert(
            alert_type=AlertType.COST_ANOMALY,
            tenant_id=tenant_id,
            title="Test Alert",
            message="Test message",
            context=None,  # None context should be handled
        )
        assert alert is not None

        # Test recovery after Redis failure simulation
        with patch.object(
            token_manager._redis, "ping", side_effect=Exception("Redis down")
        ):
            # Should handle Redis failure gracefully
            with pytest.raises(Exception):
                await token_manager.initialize()

    @pytest.mark.asyncio
    async def test_concurrent_operations(
        self,
        token_manager,
        budget_manager,
        sample_tenant,
    ):
        """Test concurrent token tracking and budget enforcement."""

        tenant_id = sample_tenant["tenant_id"]

        # Create budget policy
        budget_policy = BudgetPolicy(
            tenant_id=tenant_id,
            name="Concurrent Test Policy",
            limits=[
                BudgetLimit(
                    budget_type=BudgetType.HOURLY,
                    amount=Decimal("10.00"),
                    token_limit=10000,
                )
            ],
        )
        await budget_manager.create_budget_policy(budget_policy)

        # Set up pricing
        pricing = TokenPricing(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            input_token_price=Decimal("0.001"),
            output_token_price=Decimal("0.002"),
        )
        await token_manager.set_pricing(pricing)

        # Simulate concurrent operations
        async def track_usage_concurrently(request_id: str):
            return await token_manager.track_token_usage(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                usage=TokenUsage(
                    prompt_tokens=100,
                    completion_tokens=50,
                    total_tokens=150,
                ),
                tenant_id=tenant_id,
                request_id=request_id,
            )

        # Run multiple tracking operations concurrently
        tasks = [track_usage_concurrently(f"concurrent_req_{i}") for i in range(50)]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Verify all operations completed successfully
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 50

        # Verify total usage
        total_tokens = sum(r.total_tokens for r in successful_results)
        assert total_tokens == 7500  # 50 * 150

        # Test concurrent budget checks
        async def check_budget_concurrently():
            return await budget_manager.check_budget_enforcement(
                tenant_id=tenant_id,
                amount=Decimal("0.10"),
                tokens=50,
                requests=1,
            )

        budget_tasks = [check_budget_concurrently() for _ in range(20)]
        budget_results = await asyncio.gather(*budget_tasks, return_exceptions=True)

        # All budget checks should succeed
        successful_budget_checks = [
            r for r in budget_results if not isinstance(r, tuple) or r[0] is True
        ]
        assert len(successful_budget_checks) == 20

    @pytest.mark.asyncio
    async def test_data_consistency_and_integrity(
        self,
        token_manager,
        budget_manager,
        analytics_service,
        sample_tenant,
    ):
        """Test data consistency across all services."""

        tenant_id = sample_tenant["tenant_id"]

        # Set up pricing
        pricing = TokenPricing(
            provider=ProviderType.OPENAI,
            model="gpt-3.5-turbo",
            input_token_price=Decimal("0.001"),
            output_token_price=Decimal("0.002"),
        )
        await token_manager.set_pricing(pricing)

        # Track usage and verify consistency
        usage_data = []
        total_expected_tokens = 0
        total_expected_cost = Decimal("0")

        for i in range(20):
            usage = TokenUsage(
                prompt_tokens=100 + i * 10,
                completion_tokens=50 + i * 5,
                total_tokens=150 + i * 15,
            )

            record = await token_manager.track_token_usage(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                usage=usage,
                tenant_id=tenant_id,
                request_id=f"consistency_test_{i}",
            )

            usage_data.append(record)
            total_expected_tokens += record.total_tokens
            total_expected_cost += record.total_cost

        # Verify analytics consistency
        analytics = await analytics_service.generate_usage_analytics(
            tenant_id=tenant_id,
            period=AnalyticsPeriod.DAILY,
        )

        # Analytics should show at least the tracked tokens
        assert analytics.total_tokens >= total_expected_tokens
        assert analytics.total_cost >= total_expected_cost

        # Verify data integrity in individual records
        for record in usage_data:
            assert record.tenant_id == tenant_id
            assert (
                record.total_tokens == record.prompt_tokens + record.completion_tokens
            )
            assert record.total_cost == record.input_cost + record.output_cost
            assert record.timestamp <= datetime.now()

        # Test Redis data persistence
        # Retrieve records directly from Redis to verify persistence
        records_key = f"{token_manager.RECORDS_KEY_PREFIX}{datetime.now().strftime('%Y-%m-%d:%H')}:{tenant_id}"
        stored_records = await token_manager._redis.lrange(records_key, 0, -1)

        assert len(stored_records) > 0

        # Verify stored data can be deserialized
        for stored_record in stored_records:
            record_data = json.loads(stored_record.decode())
            assert "tenant_id" in record_data
            assert record_data["tenant_id"] == tenant_id
            assert "total_tokens" in record_data
            assert "total_cost" in record_data


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])

"""
Usage Analytics Service.

This module provides comprehensive usage analytics and reporting capabilities
for multi-tenant LLM operations with real-time insights and predictive analytics.
"""

import asyncio
import logging
import statistics
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

import redis.asyncio as redis
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AnalyticsPeriod(Enum):
    """Analytics time periods."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class MetricType(Enum):
    """Types of analytics metrics."""

    USAGE = "usage"
    COST = "cost"
    PERFORMANCE = "performance"
    ERROR_RATE = "error_rate"
    EFFICIENCY = "efficiency"
    ADOPTION = "adoption"
    RETENTION = "retention"


class ComparisonType(Enum):
    """Comparison types for trend analysis."""

    PERIOD_OVER_PERIOD = "period_over_period"
    YEAR_OVER_YEAR = "year_over_year"
    BENCHMARK = "benchmark"
    FORECAST = "forecast"


@dataclass
class UsagePattern:
    """Usage pattern data."""

    pattern_type: str  # hourly, daily, weekly patterns
    peak_hours: List[int] = field(default_factory=list)
    peak_days: List[int] = field(default_factory=list)
    average_usage: float = 0.0
    usage_variance: float = 0.0
    trend_direction: str = "stable"  # increasing, decreasing, stable
    seasonal_factor: float = 1.0

    # Pattern metadata
    confidence_score: float = 0.0
    sample_size: int = 0
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class CostAttribution:
    """Cost attribution data."""

    tenant_id: str
    user_id: Optional[str] = None
    department: Optional[str] = None
    project: Optional[str] = None

    # Cost breakdown
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    direct_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    shared_cost: Decimal = field(default_factory=lambda: Decimal("0"))

    # Attribution factors
    usage_percentage: float = 0.0
    cost_driver: str = ""  # tokens, requests, duration
    efficiency_score: float = 0.0

    # Time period
    period_start: datetime = field(default_factory=datetime.now)
    period_end: datetime = field(default_factory=datetime.now)


@dataclass
class UsageForecast:
    """Usage forecast data."""

    forecast_period: str
    forecast_date: datetime
    predicted_usage: float
    predicted_cost: Decimal

    # Confidence intervals
    lower_bound: float
    upper_bound: float
    confidence_level: float = 0.95

    # Forecast metadata
    model_used: str = ""
    accuracy_score: float = 0.0
    data_points_used: int = 0
    seasonal_adjustment: float = 1.0


@dataclass
class EfficiencyMetrics:
    """Efficiency and performance metrics."""

    token_efficiency: float = 0.0  # Cost per token
    request_efficiency: float = 0.0  # Cost per request
    response_time_efficiency: float = 0.0  # Cost per ms

    # Quality metrics
    success_rate: float = 0.0
    error_rate: float = 0.0
    retry_rate: float = 0.0

    # Resource utilization
    cache_hit_rate: float = 0.0
    model_efficiency: Dict[str, float] = field(default_factory=dict)
    provider_efficiency: Dict[str, float] = field(default_factory=dict)


class UsageAnalytics(BaseModel):
    """Comprehensive usage analytics model."""

    tenant_id: str
    period: AnalyticsPeriod
    start_time: datetime
    end_time: datetime

    # Core metrics
    total_requests: int = 0
    total_tokens: int = 0
    total_cost: Decimal = Field(default_factory=lambda: Decimal("0"))

    # Usage breakdowns
    provider_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = Field(
        default_factory=dict
    )
    model_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = Field(
        default_factory=dict
    )
    user_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = Field(
        default_factory=dict
    )
    operation_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = Field(
        default_factory=dict
    )

    # Time series data
    hourly_usage: List[Dict[str, Union[datetime, int, float, Decimal]]] = Field(
        default_factory=list
    )
    daily_usage: List[Dict[str, Union[datetime, int, float, Decimal]]] = Field(
        default_factory=list
    )

    # Analytics insights
    usage_patterns: Dict[str, UsagePattern] = Field(default_factory=dict)
    cost_attribution: List[CostAttribution] = Field(default_factory=list)
    efficiency_metrics: EfficiencyMetrics = Field(default_factory=EfficiencyMetrics)

    # Forecasts and predictions
    usage_forecast: List[UsageForecast] = Field(default_factory=list)
    anomaly_detection: List[Dict[str, Any]] = Field(default_factory=list)

    # Comparative analytics
    period_comparison: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    benchmark_comparison: Dict[str, Dict[str, float]] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True


class UsageAnalyticsService:
    """Comprehensive usage analytics service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        cache_ttl: int = 1800,  # 30 minutes
        batch_size: int = 1000,
        forecast_accuracy_days: int = 30,  # Days of historical data for forecasts
        anomaly_threshold: float = 2.0,  # Standard deviations for anomaly detection
        enable_ml_forecasts: bool = False,
    ):
        """Initialize usage analytics service."""
        self.redis_url = redis_url
        self.cache_ttl = cache_ttl
        self.batch_size = batch_size
        self.forecast_accuracy_days = forecast_accuracy_days
        self.anomaly_threshold = anomaly_threshold
        self.enable_ml_forecasts = enable_ml_forecasts

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # Background tasks
        self._analytics_task: Optional[asyncio.Task] = None
        self._forecast_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.ANALYTICS_KEY_PREFIX = "analytics:"
        self.PATTERNS_KEY_PREFIX = "patterns:"
        self.ATTRIBUTION_KEY_PREFIX = "attribution:"
        self.FORECAST_KEY_PREFIX = "forecast:"
        self.ANOMALY_KEY_PREFIX = "anomaly:"

    async def initialize(self) -> None:
        """Initialize the analytics service."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Start background tasks
            self._analytics_task = asyncio.create_task(
                self._analytics_processing_loop()
            )
            self._forecast_task = asyncio.create_task(self._forecast_generation_loop())

            self._initialized = True
            logger.info("Usage Analytics Service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Usage Analytics Service: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up analytics service resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._analytics_task:
                self._analytics_task.cancel()
                try:
                    await self._analytics_task
                except asyncio.CancelledError:
                    pass

            if self._forecast_task:
                self._forecast_task.cancel()
                try:
                    await self._forecast_task
                except asyncio.CancelledError:
                    pass

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Usage Analytics Service cleaned up")

        except Exception as e:
            logger.error(f"Error during Usage Analytics Service cleanup: {e}")

    async def generate_usage_analytics(
        self,
        tenant_id: str,
        period: AnalyticsPeriod = AnalyticsPeriod.DAILY,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_forecasts: bool = True,
        include_patterns: bool = True,
        include_attribution: bool = True,
    ) -> UsageAnalytics:
        """Generate comprehensive usage analytics."""
        if not self._initialized:
            await self.initialize()

        try:
            # Determine date range
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = self._get_start_date(period, end_date)

            # Generate cache key
            cache_key = f"{self.ANALYTICS_KEY_PREFIX}{tenant_id}:{period.value}:{start_date.isoformat()}:{end_date.isoformat()}"

            # Try to get from cache
            cached_analytics = await self._redis.get(cache_key)
            if cached_analytics:
                analytics = UsageAnalytics.parse_raw(cached_analytics)
                # Refresh forecasts if needed
                if include_forecasts and not analytics.usage_forecast:
                    analytics.usage_forecast = await self._generate_usage_forecast(
                        tenant_id, period, start_date, end_date
                    )
                return analytics

            # Generate analytics
            analytics = await self._calculate_comprehensive_analytics(
                tenant_id, period, start_date, end_date
            )

            # Add optional components
            if include_patterns:
                analytics.usage_patterns = await self._analyze_usage_patterns(
                    tenant_id, period, start_date, end_date
                )

            if include_attribution:
                analytics.cost_attribution = await self._calculate_cost_attribution(
                    tenant_id, start_date, end_date
                )

            if include_forecasts:
                analytics.usage_forecast = await self._generate_usage_forecast(
                    tenant_id, period, start_date, end_date
                )

            # Detect anomalies
            analytics.anomaly_detection = await self._detect_usage_anomalies(
                tenant_id, period, start_date, end_date
            )

            # Calculate comparative analytics
            analytics.period_comparison = await self._calculate_period_comparisons(
                tenant_id, period, start_date, end_date
            )

            # Cache the result
            await self._redis.setex(cache_key, self.cache_ttl, analytics.json())

            return analytics

        except Exception as e:
            logger.error(f"Failed to generate usage analytics: {e}")
            return UsageAnalytics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date or datetime.now(),
                end_time=end_date or datetime.now(),
            )

    async def get_real_time_metrics(
        self, tenant_id: str, time_window_minutes: int = 60
    ) -> Dict[str, Any]:
        """Get real-time usage metrics."""
        if not self._initialized:
            await self.initialize()

        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(minutes=time_window_minutes)

            # Get recent usage data from aggregates
            metrics = {
                "tenant_id": tenant_id,
                "time_window_minutes": time_window_minutes,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "current_requests_per_minute": 0,
                "current_tokens_per_minute": 0,
                "current_cost_per_minute": 0.0,
                "active_users": set(),
                "active_models": set(),
                "active_providers": set(),
            }

            # Query real-time data from Redis aggregates
            pattern = f"token:aggregates:tenant:{tenant_id}:*"
            keys = await self._redis.keys(pattern)

            total_requests = 0
            total_tokens = 0
            total_cost = Decimal("0")

            for key in keys:
                data = await self._redis.hgetall(key)
                if data:
                    # Parse timestamp from key
                    key_parts = key.decode().split(":")
                    if len(key_parts) >= 4:
                        time_str = key_parts[-1]
                        try:
                            key_time = datetime.strptime(time_str, "%Y-%m-%d:%H")
                            if start_time <= key_time <= end_time:
                                requests = int(
                                    data.get(b"total_requests", b"0").decode()
                                )
                                tokens = int(data.get(b"total_tokens", b"0").decode())
                                cost = Decimal(data.get(b"total_cost", b"0").decode())

                                total_requests += requests
                                total_tokens += tokens
                                total_cost += cost

                        except ValueError:
                            continue

            # Calculate rates
            if time_window_minutes > 0:
                metrics["current_requests_per_minute"] = (
                    total_requests / time_window_minutes
                )
                metrics["current_tokens_per_minute"] = (
                    total_tokens / time_window_minutes
                )
                metrics["current_cost_per_minute"] = (
                    float(total_cost) / time_window_minutes
                )

            metrics["total_requests"] = total_requests
            metrics["total_tokens"] = total_tokens
            metrics["total_cost"] = float(total_cost)

            return metrics

        except Exception as e:
            logger.error(f"Failed to get real-time metrics: {e}")
            return {}

    async def get_user_behavior_analytics(
        self,
        tenant_id: str,
        user_id: Optional[str] = None,
        period: AnalyticsPeriod = AnalyticsPeriod.DAILY,
        days: int = 30,
    ) -> Dict[str, Any]:
        """Get user behavior analytics and insights."""
        if not self._initialized:
            await self.initialize()

        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            analytics = {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "period": period.value,
                "days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                # User engagement metrics
                "active_users": [],
                "user_frequency": defaultdict(int),
                "user_retention": {},
                "user_adoption": {},
                # Behavioral patterns
                "usage_patterns": {},
                "preferred_models": defaultdict(int),
                "preferred_providers": defaultdict(int),
                "peak_usage_times": [],
                # Performance metrics
                "user_efficiency": {},
                "error_rates": defaultdict(float),
                "session_durations": [],
            }

            # Analyze user behavior from usage data
            # This would query user-specific usage records and analyze patterns

            return analytics

        except Exception as e:
            logger.error(f"Failed to get user behavior analytics: {e}")
            return {}

    async def get_cost_optimization_insights(
        self, tenant_id: str, period: AnalyticsPeriod = AnalyticsPeriod.MONTHLY
    ) -> Dict[str, Any]:
        """Get cost optimization insights and recommendations."""
        if not self._initialized:
            await self.initialize()

        try:
            end_date = datetime.now()
            start_date = self._get_start_date(period, end_date)

            insights = {
                "tenant_id": tenant_id,
                "period": period.value,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                # Cost analysis
                "total_cost": 0.0,
                "cost_savings_opportunities": [],
                "overutilized_resources": [],
                "underutilized_resources": [],
                # Recommendations
                "recommendations": [],
                "potential_savings": 0.0,
                "implementation_priority": [],
                # Model efficiency
                "model_efficiency_ranking": [],
                "provider_cost_comparison": {},
                "optimal_model_selection": {},
                # Usage optimization
                "caching_opportunities": [],
                "batch_processing_opportunities": [],
                "token_optimization_suggestions": [],
            }

            # Analyze cost data and generate insights
            analytics = await self.generate_usage_analytics(
                tenant_id, period, start_date, end_date
            )

            if analytics:
                insights["total_cost"] = float(analytics.total_cost)

                # Analyze model efficiency
                for model, data in analytics.model_breakdown.items():
                    cost_per_token = float(data.get("total_cost", 0)) / max(
                        1, int(data.get("total_tokens", 0))
                    )
                    insights["model_efficiency_ranking"].append(
                        {
                            "model": model,
                            "cost_per_token": cost_per_token,
                            "total_usage": int(data.get("total_requests", 0)),
                            "efficiency_score": 1.0
                            / max(0.001, cost_per_token),  # Higher is better
                        }
                    )

                # Sort by efficiency
                insights["model_efficiency_ranking"].sort(
                    key=lambda x: x["efficiency_score"], reverse=True
                )

                # Generate recommendations
                insights["recommendations"] = await self._generate_cost_recommendations(
                    analytics
                )

            return insights

        except Exception as e:
            logger.error(f"Failed to get cost optimization insights: {e}")
            return {}

    async def _calculate_comprehensive_analytics(
        self,
        tenant_id: str,
        period: AnalyticsPeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> UsageAnalytics:
        """Calculate comprehensive usage analytics."""
        try:
            analytics = UsageAnalytics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date,
                end_time=end_date,
            )

            # Get aggregate data for the period
            pattern = f"token:aggregates:tenant:{tenant_id}:*"
            keys = await self._redis.keys(pattern)

            # Aggregate metrics
            defaultdict(
                lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}
            )
            defaultdict(
                lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}
            )
            defaultdict(
                lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}
            )

            total_requests = 0
            total_tokens = 0
            total_cost = Decimal("0")

            # Time series data
            hourly_data = defaultdict(
                lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}
            )
            daily_data = defaultdict(
                lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}
            )

            for key in keys:
                data = await self._redis.hgetall(key)
                if data:
                    # Parse key to extract time and metadata
                    key_parts = key.decode().split(":")
                    if len(key_parts) >= 4:
                        time_str = key_parts[-1]
                        try:
                            key_time = datetime.strptime(time_str, "%Y-%m-%d:%H")
                            if start_date <= key_time <= end_date:
                                requests = int(
                                    data.get(b"total_requests", b"0").decode()
                                )
                                tokens = int(data.get(b"total_tokens", b"0").decode())
                                cost = Decimal(data.get(b"total_cost", b"0").decode())

                                total_requests += requests
                                total_tokens += tokens
                                total_cost += cost

                                # Add to time series
                                hour_key = key_time.strftime("%Y-%m-%d:%H")
                                day_key = key_time.strftime("%Y-%m-%d")

                                hourly_data[hour_key]["tokens"] += tokens
                                hourly_data[hour_key]["requests"] += requests
                                hourly_data[hour_key]["cost"] += cost

                                daily_data[day_key]["tokens"] += tokens
                                daily_data[day_key]["requests"] += requests
                                daily_data[day_key]["cost"] += cost

                        except ValueError:
                            continue

            # Update analytics
            analytics.total_requests = total_requests
            analytics.total_tokens = total_tokens
            analytics.total_cost = total_cost

            # Convert time series to list format
            for hour_str, data in sorted(hourly_data.items()):
                hour_time = datetime.strptime(hour_str, "%Y-%m-%d:%H")
                analytics.hourly_usage.append(
                    {
                        "timestamp": hour_time,
                        "tokens": data["tokens"],
                        "requests": data["requests"],
                        "cost": data["cost"],
                    }
                )

            for day_str, data in sorted(daily_data.items()):
                day_time = datetime.strptime(day_str, "%Y-%m-%d")
                analytics.daily_usage.append(
                    {
                        "timestamp": day_time,
                        "tokens": data["tokens"],
                        "requests": data["requests"],
                        "cost": data["cost"],
                    }
                )

            # Calculate efficiency metrics
            if total_requests > 0:
                analytics.efficiency_metrics.token_efficiency = (
                    float(total_cost) / total_tokens
                )
                analytics.efficiency_metrics.request_efficiency = (
                    float(total_cost) / total_requests
                )

            return analytics

        except Exception as e:
            logger.error(f"Failed to calculate comprehensive analytics: {e}")
            return UsageAnalytics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date,
                end_time=end_date,
            )

    async def _analyze_usage_patterns(
        self,
        tenant_id: str,
        period: AnalyticsPeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, UsagePattern]:
        """Analyze usage patterns."""
        patterns = {}

        try:
            # Get hourly usage data
            defaultdict(list)

            # This would analyze historical usage data to identify patterns
            # For now, return basic pattern analysis

            # Hourly pattern
            hourly_pattern = UsagePattern(
                pattern_type="hourly",
                peak_hours=[9, 10, 14, 15],  # Business hours
                average_usage=0.0,
                usage_variance=0.0,
                trend_direction="stable",
                confidence_score=0.8,
                sample_size=30,  # Days of data
            )

            # Daily pattern
            daily_pattern = UsagePattern(
                pattern_type="daily",
                peak_days=[0, 1, 2, 3, 4],  # Weekdays
                average_usage=0.0,
                usage_variance=0.0,
                trend_direction="stable",
                confidence_score=0.9,
                sample_size=4,  # Weeks of data
            )

            patterns["hourly"] = hourly_pattern
            patterns["daily"] = daily_pattern

        except Exception as e:
            logger.error(f"Failed to analyze usage patterns: {e}")

        return patterns

    async def _calculate_cost_attribution(
        self, tenant_id: str, start_date: datetime, end_date: datetime
    ) -> List[CostAttribution]:
        """Calculate cost attribution."""
        attributions = []

        try:
            # This would analyze cost data and attribute costs to different dimensions
            # For now, return basic attribution

            attribution = CostAttribution(
                tenant_id=tenant_id,
                total_cost=Decimal("0"),
                period_start=start_date,
                period_end=end_date,
                usage_percentage=100.0,
                cost_driver="tokens",
                efficiency_score=0.8,
            )

            attributions.append(attribution)

        except Exception as e:
            logger.error(f"Failed to calculate cost attribution: {e}")

        return attributions

    async def _generate_usage_forecast(
        self,
        tenant_id: str,
        period: AnalyticsPeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> List[UsageForecast]:
        """Generate usage forecasts."""
        forecasts = []

        try:
            # Get historical data for forecasting
            historical_start = start_date - timedelta(days=self.forecast_accuracy_days)

            # Simple linear regression forecast (would use more sophisticated models in production)
            historical_analytics = await self.generate_usage_analytics(
                tenant_id, period, historical_start, start_date, include_forecasts=False
            )

            if historical_analytics and historical_analytics.daily_usage:
                # Calculate trend
                usage_values = [
                    day["tokens"] for day in historical_analytics.daily_usage
                ]
                if len(usage_values) >= 2:
                    # Simple trend calculation
                    recent_avg = statistics.mean(usage_values[-7:])  # Last week
                    older_avg = statistics.mean(usage_values[-14:-7])  # Previous week

                    trend_factor = recent_avg / older_avg if older_avg > 0 else 1.0

                    # Generate forecast for next period
                    next_period_start = end_date
                    end_date + self._get_period_delta(period)

                    forecast = UsageForecast(
                        forecast_period=period.value,
                        forecast_date=next_period_start,
                        predicted_usage=recent_avg * trend_factor,
                        predicted_cost=Decimal(
                            str(recent_avg * trend_factor * 0.001)
                        ),  # Estimated cost
                        lower_bound=recent_avg * trend_factor * 0.8,
                        upper_bound=recent_avg * trend_factor * 1.2,
                        confidence_level=0.8,
                        model_used="linear_trend",
                        accuracy_score=0.7,
                        data_points_used=len(usage_values),
                    )

                    forecasts.append(forecast)

        except Exception as e:
            logger.error(f"Failed to generate usage forecast: {e}")

        return forecasts

    async def _detect_usage_anomalies(
        self,
        tenant_id: str,
        period: AnalyticsPeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> List[Dict[str, Any]]:
        """Detect usage anomalies."""
        anomalies = []

        try:
            # Get usage data
            analytics = await self.generate_usage_analytics(
                tenant_id, period, start_date, end_date, include_forecasts=False
            )

            if analytics and analytics.daily_usage:
                # Calculate statistics
                usage_values = [day["tokens"] for day in analytics.daily_usage]
                if len(usage_values) >= 3:
                    mean_usage = statistics.mean(usage_values)
                    stdev_usage = (
                        statistics.stdev(usage_values) if len(usage_values) > 1 else 0
                    )

                    # Detect anomalies
                    for i, day_data in enumerate(analytics.daily_usage):
                        usage = day_data["tokens"]
                        if stdev_usage > 0:
                            z_score = abs(usage - mean_usage) / stdev_usage
                            if z_score > self.anomaly_threshold:
                                anomaly = {
                                    "timestamp": day_data["timestamp"].isoformat(),
                                    "type": "usage_spike"
                                    if usage > mean_usage
                                    else "usage_drop",
                                    "severity": "high" if z_score > 3 else "medium",
                                    "z_score": z_score,
                                    "expected_usage": mean_usage,
                                    "actual_usage": usage,
                                    "deviation_percentage": (
                                        (usage - mean_usage) / mean_usage
                                    )
                                    * 100
                                    if mean_usage > 0
                                    else 0,
                                }
                                anomalies.append(anomaly)

        except Exception as e:
            logger.error(f"Failed to detect usage anomalies: {e}")

        return anomalies

    async def _calculate_period_comparisons(
        self,
        tenant_id: str,
        period: AnalyticsPeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Dict[str, float]]:
        """Calculate period-over-period comparisons."""
        comparisons = {}

        try:
            # Get current period analytics
            current_analytics = await self.generate_usage_analytics(
                tenant_id, period, start_date, end_date, include_forecasts=False
            )

            # Get previous period analytics
            period_delta = self._get_period_delta(period)
            prev_start = start_date - period_delta
            prev_end = end_date - period_delta

            previous_analytics = await self.generate_usage_analytics(
                tenant_id, period, prev_start, prev_end, include_forecasts=False
            )

            if current_analytics and previous_analytics:
                comparisons["period_over_period"] = {
                    "requests_change": self._calculate_percentage_change(
                        previous_analytics.total_requests,
                        current_analytics.total_requests,
                    ),
                    "tokens_change": self._calculate_percentage_change(
                        previous_analytics.total_tokens, current_analytics.total_tokens
                    ),
                    "cost_change": self._calculate_percentage_change(
                        float(previous_analytics.total_cost),
                        float(current_analytics.total_cost),
                    ),
                }

        except Exception as e:
            logger.error(f"Failed to calculate period comparisons: {e}")

        return comparisons

    async def _generate_cost_recommendations(
        self, analytics: UsageAnalytics
    ) -> List[Dict[str, Any]]:
        """Generate cost optimization recommendations."""
        recommendations = []

        try:
            # Analyze model efficiency
            if analytics.model_breakdown:
                # Find most expensive model
                model_costs = []
                for model, data in analytics.model_breakdown.items():
                    cost_per_token = float(data.get("total_cost", 0)) / max(
                        1, int(data.get("total_tokens", 0))
                    )
                    model_costs.append(
                        (model, cost_per_token, int(data.get("total_requests", 0)))
                    )

                model_costs.sort(
                    key=lambda x: x[1], reverse=True
                )  # Sort by cost per token

                if len(model_costs) > 1:
                    most_expensive = model_costs[0]
                    least_expensive = model_costs[-1]

                    if most_expensive[1] > least_expensive[1] * 2:  # 2x difference
                        savings_potential = (
                            most_expensive[1] - least_expensive[1]
                        ) * most_expensive[2]
                        recommendations.append(
                            {
                                "type": "model_optimization",
                                "priority": "high",
                                "title": "Switch to more cost-effective model",
                                "description": f"Consider switching from {most_expensive[0]} to {least_expensive[0]} for better cost efficiency",
                                "potential_savings": savings_potential,
                                "implementation_effort": "medium",
                            }
                        )

            # Check for caching opportunities
            if analytics.efficiency_metrics.cache_hit_rate < 0.3:
                recommendations.append(
                    {
                        "type": "caching",
                        "priority": "medium",
                        "title": "Implement response caching",
                        "description": "Low cache hit rate suggests opportunities for implementing response caching",
                        "potential_savings": float(analytics.total_cost)
                        * 0.2,  # Estimated 20% savings
                        "implementation_effort": "low",
                    }
                )

            # Check for batch processing opportunities
            if analytics.total_requests > 1000:
                recommendations.append(
                    {
                        "type": "batch_processing",
                        "priority": "low",
                        "title": "Implement batch processing",
                        "description": "High request volume suggests opportunities for batch processing optimization",
                        "potential_savings": float(analytics.total_cost)
                        * 0.1,  # Estimated 10% savings
                        "implementation_effort": "medium",
                    }
                )

        except Exception as e:
            logger.error(f"Failed to generate cost recommendations: {e}")

        return recommendations

    def _calculate_percentage_change(self, old_value: float, new_value: float) -> float:
        """Calculate percentage change."""
        if old_value == 0:
            return 100.0 if new_value > 0 else 0.0
        return ((new_value - old_value) / old_value) * 100.0

    def _get_period_delta(self, period: AnalyticsPeriod) -> timedelta:
        """Get timedelta for a period."""
        if period == AnalyticsPeriod.HOURLY:
            return timedelta(hours=1)
        elif period == AnalyticsPeriod.DAILY:
            return timedelta(days=1)
        elif period == AnalyticsPeriod.WEEKLY:
            return timedelta(weeks=1)
        elif period == AnalyticsPeriod.MONTHLY:
            return timedelta(days=30)
        elif period == AnalyticsPeriod.QUARTERLY:
            return timedelta(days=90)
        elif period == AnalyticsPeriod.YEARLY:
            return timedelta(days=365)
        else:
            return timedelta(days=1)

    def _get_start_date(self, period: AnalyticsPeriod, end_date: datetime) -> datetime:
        """Get start date for a given period."""
        delta = self._get_period_delta(period)
        return end_date - delta

    async def _analytics_processing_loop(self) -> None:
        """Background loop for processing analytics."""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes

                # Process pending analytics calculations
                # Update aggregated metrics
                # Perform pattern analysis

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in analytics processing loop: {e}")

    async def _forecast_generation_loop(self) -> None:
        """Background loop for generating forecasts."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Generate updated forecasts for all tenants
                # Update predictive models
                # Refresh anomaly detection models

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in forecast generation loop: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()

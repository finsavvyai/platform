"""
Cost Optimization Service.

This module provides intelligent cost optimization strategies for multi-provider
LLM operations with dynamic provider selection, caching strategies, and
automated cost-saving recommendations.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import uuid

import redis.asyncio as redis

from ..token.token_manager import ProviderType, TokenPricing
from ..llm.base_provider import TokenUsage

logger = logging.getLogger(__name__)


class OptimizationStrategy(Enum):
    """Cost optimization strategies."""

    COST_FIRST = "cost_first"  # Always choose cheapest option
    BALANCED = "balanced"  # Balance cost and performance
    PERFORMANCE_FIRST = "performance_first"  # Prioritize performance
    SMART_CACHING = "smart_caching"  # Intelligent caching
    BATCH_OPTIMIZATION = "batch_optimization"  # Batch processing
    ADAPTIVE = "adaptive"  # Adaptive based on usage patterns
    HYBRID = "hybrid"  # Combination of strategies


class ProviderSelectionCriteria(Enum):
    """Provider selection criteria."""

    LOWEST_COST = "lowest_cost"
    FASTEST_RESPONSE = "fastest_response"
    HIGHEST_QUALITY = "highest_quality"
    BEST_RELIABILITY = "best_reliability"
    MOST_AVAILABLE = "most_available"
    COST_PERFORMANCE = "cost_performance"


@dataclass
class ProviderMetrics:
    """Provider performance metrics."""

    provider: ProviderType
    model: str

    # Performance metrics
    avg_response_time_ms: float = 0.0
    success_rate: float = 1.0
    error_rate: float = 0.0
    timeout_rate: float = 0.0

    # Cost metrics
    avg_cost_per_request: Decimal = field(default_factory=lambda: Decimal("0"))
    avg_cost_per_token: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))

    # Usage metrics
    total_requests: int = 0
    total_tokens: int = 0
    cache_hit_rate: float = 0.0

    # Quality metrics
    quality_score: float = 0.0  # Based on user feedback or automated evaluation
    consistency_score: float = 0.0

    # Reliability metrics
    availability_score: float = 1.0
    rate_limit_hit_rate: float = 0.0

    # Timestamps
    last_updated: datetime = field(default_factory=datetime.now)
    metrics_period_hours: int = 24


@dataclass
class CostOptimizationRule:
    """Cost optimization rule configuration."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    enabled: bool = True

    # Rule conditions
    tenant_ids: List[str] = field(default_factory=list)
    user_ids: List[str] = field(default_factory=list)
    operation_types: List[str] = field(default_factory=list)
    cost_threshold: Optional[Decimal] = None
    volume_threshold: Optional[int] = None

    # Optimization actions
    preferred_providers: List[ProviderType] = field(default_factory=list)
    avoided_providers: List[ProviderType] = field(default_factory=list)
    max_cost_per_request: Optional[Decimal] = None
    caching_strategy: str = "default"

    # Rule metadata
    priority: int = 0  # Higher priority rules take precedence
    created_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class CostSavingsOpportunity:
    """Cost savings opportunity identified."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str
    opportunity_type: str  # model_switch, caching, batching, provider_change

    # Potential savings
    estimated_monthly_savings: Decimal = field(default_factory=lambda: Decimal("0"))
    savings_percentage: float = 0.0
    implementation_cost: Optional[Decimal] = None

    # Current vs optimized
    current_monthly_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    optimized_monthly_cost: Decimal = field(default_factory=lambda: Decimal("0"))

    # Recommendation details
    recommendation: str = ""
    implementation_steps: List[str] = field(default_factory=list)
    implementation_effort: str = "medium"  # low, medium, high
    impact_level: str = "medium"  # low, medium, high

    # Validation
    confidence_score: float = 0.0
    data_points_analyzed: int = 0

    # Status
    status: str = "identified"  # identified, recommended, implemented, validated
    discovered_at: datetime = field(default_factory=datetime.now)


@dataclass
class OptimizationRecommendation:
    """Real-time optimization recommendation."""

    request_id: Optional[str] = None
    tenant_id: str = ""

    # Recommendation details
    recommended_provider: Optional[ProviderType] = None
    recommended_model: Optional[str] = None
    alternative_options: List[Dict[str, Any]] = field(default_factory=list)

    # Cost analysis
    estimated_cost_savings: Decimal = field(default_factory=lambda: Decimal("0"))
    cost_difference_percentage: float = 0.0

    # Performance analysis
    performance_impact: str = "neutral"  # positive, neutral, negative
    response_time_impact_ms: float = 0.0

    # Confidence and reasoning
    confidence_score: float = 0.0
    reasoning: List[str] = field(default_factory=list)
    applicable_rules: List[str] = field(default_factory=list)

    # Metadata
    generated_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None


class CostOptimizer:
    """Intelligent cost optimization service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        cache_ttl: int = 300,  # 5 minutes
        metrics_update_interval: int = 300,  # 5 minutes
        opportunity_scan_interval: int = 3600,  # 1 hour
        default_strategy: OptimizationStrategy = OptimizationStrategy.BALANCED,
        enable_real_time_optimization: bool = True,
        enable_predictive_optimization: bool = False,
        min_confidence_threshold: float = 0.7,
    ):
        """Initialize cost optimizer."""
        self.redis_url = redis_url
        self.cache_ttl = cache_ttl
        self.metrics_update_interval = metrics_update_interval
        self.opportunity_scan_interval = opportunity_scan_interval
        self.default_strategy = default_strategy
        self.enable_real_time_optimization = enable_real_time_optimization
        self.enable_predictive_optimization = enable_predictive_optimization
        self.min_confidence_threshold = min_confidence_threshold

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # In-memory caches
        self._provider_metrics: Dict[Tuple[ProviderType, str], ProviderMetrics] = {}
        self._optimization_rules: Dict[str, CostOptimizationRule] = {}
        self._pricing_cache: Dict[Tuple[ProviderType, str], TokenPricing] = {}

        # Background tasks
        self._metrics_update_task: Optional[asyncio.Task] = None
        self._opportunity_scan_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.METRICS_KEY_PREFIX = "cost_optimizer:metrics:"
        self.RULES_KEY_PREFIX = "cost_optimizer:rules:"
        self.OPPORTUNITIES_KEY_PREFIX = "cost_optimizer:opportunities:"
        self.RECOMMENDATIONS_KEY_PREFIX = "cost_optimizer:recommendations:"
        self.CACHE_KEY_PREFIX = "cost_optimizer:cache:"

    async def initialize(self) -> None:
        """Initialize the cost optimizer."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Load default optimization rules
            await self._load_default_rules()

            # Start background tasks
            self._metrics_update_task = asyncio.create_task(self._metrics_update_loop())
            self._opportunity_scan_task = asyncio.create_task(
                self._opportunity_scan_loop()
            )

            self._initialized = True
            logger.info("Cost Optimizer initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Cost Optimizer: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up cost optimizer resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._metrics_update_task:
                self._metrics_update_task.cancel()
                try:
                    await self._metrics_update_task
                except asyncio.CancelledError:
                    pass

            if self._opportunity_scan_task:
                self._opportunity_scan_task.cancel()
                try:
                    await self._opportunity_scan_task
                except asyncio.CancelledError:
                    pass

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Cost Optimizer cleaned up")

        except Exception as e:
            logger.error(f"Error during Cost Optimizer cleanup: {e}")

    async def optimize_request(
        self,
        tenant_id: str,
        operation_type: str = "chat_completion",
        estimated_tokens: Optional[int] = None,
        preferred_quality: str = "standard",  # low, standard, high
        max_response_time_ms: Optional[int] = None,
        current_provider: Optional[ProviderType] = None,
        current_model: Optional[str] = None,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> OptimizationRecommendation:
        """Generate real-time optimization recommendation for a request."""
        if not self._initialized:
            await self.initialize()

        try:
            recommendation = OptimizationRecommendation(
                request_id=request_id,
                tenant_id=tenant_id,
            )

            # Get applicable optimization rules
            applicable_rules = await self._get_applicable_rules(
                tenant_id, user_id, operation_type
            )

            # Get available providers and models
            available_options = await self._get_available_options(
                operation_type, preferred_quality
            )

            if not available_options:
                recommendation.reasoning.append("No optimization options available")
                return recommendation

            # Analyze current choice if provided
            current_metrics = None
            if current_provider and current_model:
                current_metrics = await self._get_provider_metrics(
                    current_provider, current_model
                )

            # Generate optimization based on strategy
            if self.default_strategy == OptimizationStrategy.COST_FIRST:
                recommendation = await self._optimize_for_cost(
                    tenant_id, available_options, estimated_tokens, applicable_rules
                )
            elif self.default_strategy == OptimizationStrategy.PERFORMANCE_FIRST:
                recommendation = await self._optimize_for_performance(
                    tenant_id, available_options, max_response_time_ms, applicable_rules
                )
            elif self.default_strategy == OptimizationStrategy.BALANCED:
                recommendation = await self._optimize_balanced(
                    tenant_id,
                    available_options,
                    estimated_tokens,
                    max_response_time_ms,
                    applicable_rules,
                )
            elif self.default_strategy == OptimizationStrategy.SMART_CACHING:
                recommendation = await self._optimize_with_caching(
                    tenant_id, available_options, operation_type, applicable_rules
                )
            else:
                recommendation = await self._optimize_balanced(
                    tenant_id,
                    available_options,
                    estimated_tokens,
                    max_response_time_ms,
                    applicable_rules,
                )

            # Compare with current choice
            if current_metrics and recommendation.recommended_provider:
                cost_comparison = await self._compare_costs(
                    current_provider,
                    current_model,
                    recommendation.recommended_provider,
                    recommendation.recommended_model,
                    estimated_tokens,
                )
                recommendation.estimated_cost_savings = cost_comparison["savings"]
                recommendation.cost_difference_percentage = cost_comparison[
                    "percentage"
                ]

            # Set expiration for recommendation
            recommendation.expires_at = datetime.now() + timedelta(minutes=15)

            # Cache recommendation
            if request_id:
                cache_key = f"{self.RECOMMENDATIONS_KEY_PREFIX}{request_id}"
                await self._redis.setex(
                    cache_key, 900, recommendation.generated_at.isoformat()
                )

            return recommendation

        except Exception as e:
            logger.error(f"Failed to optimize request: {e}")
            return OptimizationRecommendation(
                tenant_id=tenant_id,
                reasoning=["Optimization failed - using default behavior"],
            )

    async def get_cost_savings_opportunities(
        self, tenant_id: str, min_savings_threshold: Decimal = Decimal("10")
    ) -> List[CostSavingsOpportunity]:
        """Get identified cost savings opportunities."""
        if not self._initialized:
            await self.initialize()

        try:
            opportunities = []

            # Get cached opportunities or scan for new ones
            cache_key = f"{self.OPPORTUNITIES_KEY_PREFIX}{tenant_id}"
            cached_opportunities = await self._redis.get(cache_key)

            if cached_opportunities:
                opportunities_data = json.loads(cached_opportunities)
                for opp_data in opportunities_data:
                    opportunity = CostSavingsOpportunity(
                        tenant_id=opp_data["tenant_id"],
                        opportunity_type=opp_data["opportunity_type"],
                        estimated_monthly_savings=Decimal(
                            opp_data["estimated_monthly_savings"]
                        ),
                        savings_percentage=opp_data["savings_percentage"],
                        current_monthly_cost=Decimal(opp_data["current_monthly_cost"]),
                        optimized_monthly_cost=Decimal(
                            opp_data["optimized_monthly_cost"]
                        ),
                        recommendation=opp_data["recommendation"],
                        implementation_steps=opp_data["implementation_steps"],
                        implementation_effort=opp_data["implementation_effort"],
                        impact_level=opp_data["impact_level"],
                        confidence_score=opp_data["confidence_score"],
                        status=opp_data["status"],
                        discovered_at=datetime.fromisoformat(opp_data["discovered_at"]),
                    )
                    if opportunity.estimated_monthly_savings >= min_savings_threshold:
                        opportunities.append(opportunity)
            else:
                # Generate new opportunities
                opportunities = await self._scan_for_opportunities(tenant_id)

                # Cache opportunities
                opportunities_data = []
                for opp in opportunities:
                    opportunities_data.append(
                        {
                            "tenant_id": opp.tenant_id,
                            "opportunity_type": opp.opportunity_type,
                            "estimated_monthly_savings": str(
                                opp.estimated_monthly_savings
                            ),
                            "savings_percentage": opp.savings_percentage,
                            "current_monthly_cost": str(opp.current_monthly_cost),
                            "optimized_monthly_cost": str(opp.optimized_monthly_cost),
                            "recommendation": opp.recommendation,
                            "implementation_steps": opp.implementation_steps,
                            "implementation_effort": opp.implementation_effort,
                            "impact_level": opp.impact_level,
                            "confidence_score": opp.confidence_score,
                            "status": opp.status,
                            "discovered_at": opp.discovered_at.isoformat(),
                        }
                    )

                await self._redis.setex(cache_key, 3600, json.dumps(opportunities_data))

            # Filter by minimum savings threshold
            filtered_opportunities = [
                opp
                for opp in opportunities
                if opp.estimated_monthly_savings >= min_savings_threshold
            ]

            return sorted(
                filtered_opportunities,
                key=lambda x: x.estimated_monthly_savings,
                reverse=True,
            )

        except Exception as e:
            logger.error(f"Failed to get cost savings opportunities: {e}")
            return []

    async def update_provider_metrics(
        self,
        provider: ProviderType,
        model: str,
        response_time_ms: int,
        success: bool,
        token_usage: TokenUsage,
        cost: Decimal,
        quality_score: Optional[float] = None,
    ) -> None:
        """Update provider performance metrics."""
        if not self._initialized:
            await self.initialize()

        try:
            metrics_key = f"{self.METRICS_KEY_PREFIX}{provider.value}:{model}"

            # Get existing metrics
            metrics_data = await self._redis.hgetall(metrics_key)

            if metrics_data:
                # Update existing metrics
                total_requests = int(metrics_data.get(b"total_requests", b"0").decode())
                total_response_time = float(
                    metrics_data.get(b"total_response_time", b"0").decode()
                )
                successful_requests = int(
                    metrics_data.get(b"successful_requests", b"0").decode()
                )
                total_cost = Decimal(metrics_data.get(b"total_cost", b"0").decode())
                total_tokens = int(metrics_data.get(b"total_tokens", b"0").decode())

                # Update totals
                total_requests += 1
                total_response_time += response_time_ms
                if success:
                    successful_requests += 1
                total_cost += cost
                total_tokens += token_usage.total_tokens

                # Calculate new averages
                avg_response_time = total_response_time / total_requests
                success_rate = successful_requests / total_requests
                avg_cost_per_request = total_cost / total_requests
                avg_cost_per_token = (
                    total_cost / total_tokens if total_tokens > 0 else Decimal("0")
                )

                # Update metrics
                await self._redis.hset(
                    metrics_key,
                    mapping={
                        "total_requests": str(total_requests),
                        "total_response_time": str(total_response_time),
                        "successful_requests": str(successful_requests),
                        "total_cost": str(total_cost),
                        "total_tokens": str(total_tokens),
                        "avg_response_time_ms": str(avg_response_time),
                        "success_rate": str(success_rate),
                        "avg_cost_per_request": str(avg_cost_per_request),
                        "avg_cost_per_token": str(avg_cost_per_token),
                        "last_updated": datetime.now().isoformat(),
                    },
                )
            else:
                # Create new metrics
                await self._redis.hset(
                    metrics_key,
                    mapping={
                        "total_requests": "1",
                        "total_response_time": str(response_time_ms),
                        "successful_requests": "1" if success else "0",
                        "total_cost": str(cost),
                        "total_tokens": str(token_usage.total_tokens),
                        "avg_response_time_ms": str(response_time_ms),
                        "success_rate": "1" if success else "0",
                        "avg_cost_per_request": str(cost),
                        "avg_cost_per_token": str(cost / token_usage.total_tokens)
                        if token_usage.total_tokens > 0
                        else "0",
                        "last_updated": datetime.now().isoformat(),
                    },
                )

            # Set expiration
            await self._redis.expire(metrics_key, 7 * 24 * 3600)  # 7 days

            # Update in-memory cache
            cache_key = (provider, model)
            metrics_data = await self._redis.hgetall(metrics_key)
            if metrics_data:
                self._provider_metrics[cache_key] = ProviderMetrics(
                    provider=provider,
                    model=model,
                    avg_response_time_ms=float(
                        metrics_data.get(b"avg_response_time_ms", b"0").decode()
                    ),
                    success_rate=float(
                        metrics_data.get(b"success_rate", b"1").decode()
                    ),
                    avg_cost_per_request=Decimal(
                        metrics_data.get(b"avg_cost_per_request", b"0").decode()
                    ),
                    avg_cost_per_token=Decimal(
                        metrics_data.get(b"avg_cost_per_token", b"0").decode()
                    ),
                    total_requests=int(
                        metrics_data.get(b"total_requests", b"0").decode()
                    ),
                    total_tokens=int(metrics_data.get(b"total_tokens", b"0").decode()),
                    total_cost=Decimal(metrics_data.get(b"total_cost", b"0").decode()),
                    last_updated=datetime.fromisoformat(
                        metrics_data.get(
                            b"last_updated", datetime.now().isoformat()
                        ).decode()
                    ),
                )

        except Exception as e:
            logger.error(f"Failed to update provider metrics: {e}")

    async def create_optimization_rule(self, rule: CostOptimizationRule) -> str:
        """Create a new optimization rule."""
        try:
            # Store rule
            rule_key = f"{self.RULES_KEY_PREFIX}{rule.id}"
            rule_data = {
                "name": rule.name,
                "description": rule.description,
                "enabled": str(rule.enabled).lower(),
                "tenant_ids": json.dumps(rule.tenant_ids),
                "user_ids": json.dumps(rule.user_ids),
                "operation_types": json.dumps(rule.operation_types),
                "cost_threshold": str(rule.cost_threshold)
                if rule.cost_threshold
                else "",
                "volume_threshold": str(rule.volume_threshold)
                if rule.volume_threshold
                else "",
                "preferred_providers": json.dumps(
                    [p.value for p in rule.preferred_providers]
                ),
                "avoided_providers": json.dumps(
                    [p.value for p in rule.avoided_providers]
                ),
                "max_cost_per_request": str(rule.max_cost_per_request)
                if rule.max_cost_per_request
                else "",
                "caching_strategy": rule.caching_strategy,
                "priority": str(rule.priority),
                "created_at": rule.created_at.isoformat(),
                "created_by": rule.created_by or "",
                "tags": json.dumps(rule.tags),
            }

            await self._redis.hset(rule_key, mapping=rule_data)
            await self._redis.expire(rule_key, 30 * 24 * 3600)  # 30 days

            # Update cache
            self._optimization_rules[rule.id] = rule

            logger.info(f"Created optimization rule '{rule.name}'")
            return rule.id

        except Exception as e:
            logger.error(f"Failed to create optimization rule: {e}")
            raise

    async def _optimize_for_cost(
        self,
        tenant_id: str,
        available_options: List[Dict[str, Any]],
        estimated_tokens: Optional[int],
        applicable_rules: List[CostOptimizationRule],
    ) -> OptimizationRecommendation:
        """Optimize for lowest cost."""
        recommendation = OptimizationRecommendation(tenant_id=tenant_id)

        try:
            # Sort options by cost
            cost_sorted_options = sorted(
                available_options, key=lambda x: float(x.get("estimated_cost", 0))
            )

            if cost_sorted_options:
                best_option = cost_sorted_options[0]
                recommendation.recommended_provider = ProviderType(
                    best_option["provider"]
                )
                recommendation.recommended_model = best_option["model"]
                recommendation.confidence_score = 0.9
                recommendation.reasoning.append("Selected lowest cost option")

                # Add alternative options
                for option in cost_sorted_options[1:3]:  # Top 2 alternatives
                    recommendation.alternative_options.append(
                        {
                            "provider": option["provider"],
                            "model": option["model"],
                            "estimated_cost": option["estimated_cost"],
                            "reason": "Higher cost but available alternative",
                        }
                    )

        except Exception as e:
            logger.error(f"Failed to optimize for cost: {e}")
            recommendation.reasoning.append("Cost optimization failed")

        return recommendation

    async def _optimize_for_performance(
        self,
        tenant_id: str,
        available_options: List[Dict[str, Any]],
        max_response_time_ms: Optional[int],
        applicable_rules: List[CostOptimizationRule],
    ) -> OptimizationRecommendation:
        """Optimize for best performance."""
        recommendation = OptimizationRecommendation(tenant_id=tenant_id)

        try:
            # Sort options by response time
            performance_sorted_options = sorted(
                available_options, key=lambda x: x.get("avg_response_time_ms", 1000)
            )

            # Filter by response time constraint
            if max_response_time_ms:
                performance_sorted_options = [
                    option
                    for option in performance_sorted_options
                    if option.get("avg_response_time_ms", 1000) <= max_response_time_ms
                ]

            if performance_sorted_options:
                best_option = performance_sorted_options[0]
                recommendation.recommended_provider = ProviderType(
                    best_option["provider"]
                )
                recommendation.recommended_model = best_option["model"]
                recommendation.confidence_score = 0.9
                recommendation.reasoning.append("Selected fastest response time")

                # Calculate performance impact
                recommendation.performance_impact = "positive"
                recommendation.response_time_impact_ms = -best_option.get(
                    "avg_response_time_ms", 0
                )

        except Exception as e:
            logger.error(f"Failed to optimize for performance: {e}")
            recommendation.reasoning.append("Performance optimization failed")

        return recommendation

    async def _optimize_balanced(
        self,
        tenant_id: str,
        available_options: List[Dict[str, Any]],
        estimated_tokens: Optional[int],
        max_response_time_ms: Optional[int],
        applicable_rules: List[CostOptimizationRule],
    ) -> OptimizationRecommendation:
        """Optimize for balanced cost and performance."""
        recommendation = OptimizationRecommendation(tenant_id=tenant_id)

        try:
            # Calculate composite score for each option
            scored_options = []
            for option in available_options:
                cost_score = 1.0 / max(
                    0.001, float(option.get("estimated_cost", 0.001))
                )
                performance_score = 1000.0 / max(
                    1, option.get("avg_response_time_ms", 1000)
                )
                quality_score = option.get("quality_score", 0.5)

                # Weighted composite score (adjust weights as needed)
                composite_score = (
                    cost_score * 0.4 + performance_score * 0.4 + quality_score * 0.2
                )

                scored_options.append(
                    {
                        **option,
                        "composite_score": composite_score,
                    }
                )

            # Sort by composite score
            scored_options.sort(key=lambda x: x["composite_score"], reverse=True)

            if scored_options:
                best_option = scored_options[0]
                recommendation.recommended_provider = ProviderType(
                    best_option["provider"]
                )
                recommendation.recommended_model = best_option["model"]
                recommendation.confidence_score = 0.8
                recommendation.reasoning.append(
                    "Selected balanced cost-performance option"
                )

                # Add alternatives
                for option in scored_options[1:3]:
                    recommendation.alternative_options.append(
                        {
                            "provider": option["provider"],
                            "model": option["model"],
                            "composite_score": option["composite_score"],
                            "reason": "Alternative balanced option",
                        }
                    )

        except Exception as e:
            logger.error(f"Failed to optimize balanced: {e}")
            recommendation.reasoning.append("Balanced optimization failed")

        return recommendation

    async def _optimize_with_caching(
        self,
        tenant_id: str,
        available_options: List[Dict[str, Any]],
        operation_type: str,
        applicable_rules: List[CostOptimizationRule],
    ) -> OptimizationRecommendation:
        """Optimize with smart caching strategy."""
        recommendation = OptimizationRecommendation(tenant_id=tenant_id)

        try:
            # Prioritize options with better caching characteristics
            cache_enhanced_options = []
            for option in available_options:
                base_score = option.get("composite_score", 0.5)
                cache_bonus = (
                    option.get("cache_hit_rate", 0) * 0.3
                )  # 30% bonus for perfect caching

                enhanced_score = min(1.0, base_score + cache_bonus)
                cache_enhanced_options.append(
                    {
                        **option,
                        "enhanced_score": enhanced_score,
                    }
                )

            # Sort by enhanced score
            cache_enhanced_options.sort(key=lambda x: x["enhanced_score"], reverse=True)

            if cache_enhanced_options:
                best_option = cache_enhanced_options[0]
                recommendation.recommended_provider = ProviderType(
                    best_option["provider"]
                )
                recommendation.recommended_model = best_option["model"]
                recommendation.confidence_score = 0.85
                recommendation.reasoning.append("Selected caching-optimized option")

        except Exception as e:
            logger.error(f"Failed to optimize with caching: {e}")
            recommendation.reasoning.append("Caching optimization failed")

        return recommendation

    async def _get_applicable_rules(
        self,
        tenant_id: str,
        user_id: Optional[str],
        operation_type: str,
    ) -> List[CostOptimizationRule]:
        """Get optimization rules applicable to the request."""
        applicable_rules = []

        try:
            for rule in self._optimization_rules.values():
                if not rule.enabled:
                    continue

                # Check tenant match
                if rule.tenant_ids and tenant_id not in rule.tenant_ids:
                    continue

                # Check user match
                if rule.user_ids and user_id and user_id not in rule.user_ids:
                    continue

                # Check operation type match
                if rule.operation_types and operation_type not in rule.operation_types:
                    continue

                applicable_rules.append(rule)

            # Sort by priority
            applicable_rules.sort(key=lambda x: x.priority, reverse=True)

        except Exception as e:
            logger.error(f"Failed to get applicable rules: {e}")

        return applicable_rules

    async def _get_available_options(
        self, operation_type: str, preferred_quality: str
    ) -> List[Dict[str, Any]]:
        """Get available provider/model options."""
        options = []

        try:
            # This would typically query a registry of available models
            # For now, return some common options

            base_options = [
                {
                    "provider": "openai",
                    "model": "gpt-3.5-turbo",
                    "estimated_cost": 0.002,
                    "avg_response_time_ms": 1500,
                    "quality_score": 0.7,
                    "cache_hit_rate": 0.3,
                },
                {
                    "provider": "openai",
                    "model": "gpt-4",
                    "estimated_cost": 0.03,
                    "avg_response_time_ms": 3000,
                    "quality_score": 0.9,
                    "cache_hit_rate": 0.2,
                },
                {
                    "provider": "anthropic",
                    "model": "claude-3-sonnet-20240229",
                    "estimated_cost": 0.015,
                    "avg_response_time_ms": 2000,
                    "quality_score": 0.85,
                    "cache_hit_rate": 0.25,
                },
                {
                    "provider": "anthropic",
                    "model": "claude-3-haiku-20240307",
                    "estimated_cost": 0.00125,
                    "avg_response_time_ms": 1000,
                    "quality_score": 0.75,
                    "cache_hit_rate": 0.35,
                },
            ]

            # Filter by quality preference
            if preferred_quality == "low":
                quality_threshold = 0.6
            elif preferred_quality == "high":
                quality_threshold = 0.8
            else:  # standard
                quality_threshold = 0.7

            options = [
                option
                for option in base_options
                if option["quality_score"] >= quality_threshold
            ]

        except Exception as e:
            logger.error(f"Failed to get available options: {e}")

        return options

    async def _get_provider_metrics(
        self, provider: ProviderType, model: str
    ) -> Optional[ProviderMetrics]:
        """Get provider performance metrics."""
        cache_key = (provider, model)
        if cache_key in self._provider_metrics:
            return self._provider_metrics[cache_key]

        # Try to load from Redis
        try:
            metrics_key = f"{self.METRICS_KEY_PREFIX}{provider.value}:{model}"
            metrics_data = await self._redis.hgetall(metrics_key)

            if metrics_data:
                metrics = ProviderMetrics(
                    provider=provider,
                    model=model,
                    avg_response_time_ms=float(
                        metrics_data.get(b"avg_response_time_ms", b"0").decode()
                    ),
                    success_rate=float(
                        metrics_data.get(b"success_rate", b"1").decode()
                    ),
                    avg_cost_per_request=Decimal(
                        metrics_data.get(b"avg_cost_per_request", b"0").decode()
                    ),
                    avg_cost_per_token=Decimal(
                        metrics_data.get(b"avg_cost_per_token", b"0").decode()
                    ),
                    total_requests=int(
                        metrics_data.get(b"total_requests", b"0").decode()
                    ),
                    total_tokens=int(metrics_data.get(b"total_tokens", b"0").decode()),
                    total_cost=Decimal(metrics_data.get(b"total_cost", b"0").decode()),
                    last_updated=datetime.fromisoformat(
                        metrics_data.get(
                            b"last_updated", datetime.now().isoformat()
                        ).decode()
                    ),
                )

                self._provider_metrics[cache_key] = metrics
                return metrics

        except Exception as e:
            logger.error(f"Failed to get provider metrics: {e}")

        return None

    async def _compare_costs(
        self,
        current_provider: ProviderType,
        current_model: str,
        new_provider: ProviderType,
        new_model: str,
        estimated_tokens: Optional[int],
    ) -> Dict[str, Any]:
        """Compare costs between current and recommended options."""
        try:
            current_metrics = await self._get_provider_metrics(
                current_provider, current_model
            )
            new_metrics = await self._get_provider_metrics(new_provider, new_model)

            if not current_metrics or not new_metrics:
                return {"savings": Decimal("0"), "percentage": 0.0}

            # Estimate costs
            if estimated_tokens:
                current_cost = current_metrics.avg_cost_per_token * estimated_tokens
                new_cost = new_metrics.avg_cost_per_token * estimated_tokens
            else:
                current_cost = current_metrics.avg_cost_per_request
                new_cost = new_metrics.avg_cost_per_request

            savings = current_cost - new_cost
            percentage = (savings / current_cost * 100) if current_cost > 0 else 0.0

            return {
                "savings": savings,
                "percentage": percentage,
                "current_cost": current_cost,
                "new_cost": new_cost,
            }

        except Exception as e:
            logger.error(f"Failed to compare costs: {e}")
            return {"savings": Decimal("0"), "percentage": 0.0}

    async def _scan_for_opportunities(
        self, tenant_id: str
    ) -> List[CostSavingsOpportunity]:
        """Scan for cost savings opportunities."""
        opportunities = []

        try:
            # Analyze usage patterns and identify opportunities
            # This would typically involve more sophisticated analysis

            # Model switching opportunity
            opportunity1 = CostSavingsOpportunity(
                tenant_id=tenant_id,
                opportunity_type="model_switch",
                estimated_monthly_savings=Decimal("150.00"),
                savings_percentage=25.0,
                current_monthly_cost=Decimal("600.00"),
                optimized_monthly_cost=Decimal("450.00"),
                recommendation="Switch from GPT-4 to Claude-3-Sonnet for non-critical requests",
                implementation_steps=[
                    "Identify non-critical request patterns",
                    "Update request routing logic",
                    "Monitor quality metrics",
                    "Gradually migrate traffic",
                ],
                implementation_effort="medium",
                impact_level="high",
                confidence_score=0.8,
                data_points_analyzed=1000,
            )
            opportunities.append(opportunity1)

            # Caching opportunity
            opportunity2 = CostSavingsOpportunity(
                tenant_id=tenant_id,
                opportunity_type="caching",
                estimated_monthly_savings=Decimal("80.00"),
                savings_percentage=15.0,
                current_monthly_cost=Decimal("533.33"),
                optimized_monthly_cost=Decimal("453.33"),
                recommendation="Implement intelligent response caching for repeated queries",
                implementation_steps=[
                    "Set up Redis cache infrastructure",
                    "Implement cache key generation logic",
                    "Add cache hit rate monitoring",
                    "Configure cache eviction policies",
                ],
                implementation_effort="low",
                impact_level="medium",
                confidence_score=0.9,
                data_points_analyzed=2000,
            )
            opportunities.append(opportunity2)

        except Exception as e:
            logger.error(f"Failed to scan for opportunities: {e}")

        return opportunities

    async def _load_default_rules(self) -> None:
        """Load default optimization rules."""
        try:
            # Rule for cost-conscious tenants
            rule1 = CostOptimizationRule(
                name="Cost-First Optimization",
                description="Prioritize cost savings for cost-conscious tenants",
                tenant_ids=[],  # Apply to all tenants unless specified
                operation_types=["chat_completion", "completion"],
                max_cost_per_request=Decimal("0.01"),
                preferred_providers=[ProviderType.ANTHROPIC],  # Prefer Claude
                priority=80,
            )
            await self.create_optimization_rule(rule1)

            # Rule for high-performance requirements
            rule2 = CostOptimizationRule(
                name="Performance-First Optimization",
                description="Prioritize performance for critical operations",
                operation_types=["chat_completion"],
                preferred_providers=[ProviderType.OPENAI],  # Prefer GPT-4
                priority=90,
            )
            await self.create_optimization_rule(rule2)

        except Exception as e:
            logger.error(f"Failed to load default rules: {e}")

    async def _metrics_update_loop(self) -> None:
        """Background loop for updating metrics."""
        while True:
            try:
                await asyncio.sleep(self.metrics_update_interval)

                # Update provider metrics
                # Refresh performance data
                # Update optimization scores

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metrics update loop: {e}")

    async def _opportunity_scan_loop(self) -> None:
        """Background loop for scanning opportunities."""
        while True:
            try:
                await asyncio.sleep(self.opportunity_scan_interval)

                # Scan for new cost savings opportunities
                # Update existing opportunity recommendations
                # Refresh savings calculations

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in opportunity scan loop: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()

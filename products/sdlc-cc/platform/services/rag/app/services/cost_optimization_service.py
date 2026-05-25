"""
Cost optimization service for intelligent embedding provider selection.

This module provides cost optimization capabilities including:
- Intelligent provider selection based on cost, performance, and availability
- Dynamic cost estimation and budget management
- Provider performance monitoring and ranking
- Cost-effective routing strategies
- Budget enforcement and alerting
- Usage analytics and cost tracking
- Multi-tenant cost allocation
- Performance-cost tradeoff optimization
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from ..core.config import get_settings
from .embedding_service import EmbeddingProvider, EmbeddingModel, get_embedding_service

logger = logging.getLogger(__name__)


class ProviderTier(str, Enum):
    """Provider cost tiers."""

    FREE = "free"
    LOW_COST = "low_cost"
    MEDIUM_COST = "medium_cost"
    HIGH_COST = "high_cost"
    PREMIUM = "premium"


class RoutingStrategy(str, Enum):
    """Provider routing strategies."""

    COST_OPTIMAL = "cost_optimal"  # Always choose cheapest available provider
    PERFORMANCE_OPTIMAL = "performance_optimal"  # Choose best performing provider
    BALANCED = "balanced"  # Balance between cost and performance
    AVAILABILITY_FIRST = "availability_first"  # Prioritize availability over cost
    BUDGET_AWARE = "budget_aware"  # Consider budget constraints


@dataclass
class ProviderPricing:
    """Pricing information for a provider."""

    provider: EmbeddingProvider
    model: str
    cost_per_1k_tokens: float
    cost_per_request: float = 0.0
    free_quota_tokens: int = 0
    free_quota_requests: int = 0
    tier: ProviderTier = ProviderTier.MEDIUM_COST
    currency: str = "USD"
    updated_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_free_tier(self) -> bool:
        """Check if provider has free tier."""
        return self.tier == ProviderTier.FREE or self.free_quota_tokens > 0

    def calculate_cost(self, tokens: int, requests: int = 1) -> float:
        """Calculate cost for given usage."""
        # Apply free quota if available
        if self.free_quota_tokens > 0:
            billable_tokens = max(0, tokens - self.free_quota_tokens)
        else:
            billable_tokens = tokens

        if self.free_quota_requests > 0:
            billable_requests = max(0, requests - self.free_quota_requests)
        else:
            billable_requests = requests

        # Calculate cost
        token_cost = (billable_tokens / 1000) * self.cost_per_1k_tokens
        request_cost = billable_requests * self.cost_per_request

        return token_cost + request_cost


@dataclass
class ProviderPerformance:
    """Performance metrics for a provider."""

    provider: EmbeddingProvider
    model: str
    avg_response_time_ms: float = 0.0
    success_rate: float = 1.0
    error_rate: float = 0.0
    cache_hit_rate: float = 0.0
    throughput_requests_per_second: float = 0.0
    availability_score: float = 1.0
    quality_score: float = 1.0
    total_requests: int = 0
    last_updated: datetime = field(default_factory=datetime.utcnow)

    def update_metrics(
        self,
        response_time_ms: float,
        success: bool,
        cache_hit: bool = False,
        quality_score: Optional[float] = None,
    ) -> None:
        """Update performance metrics."""
        self.total_requests += 1

        # Update response time (exponential moving average)
        alpha = 0.1  # Smoothing factor
        self.avg_response_time_ms = (
            alpha * response_time_ms + (1 - alpha) * self.avg_response_time_ms
        )

        # Update success/error rates
        if success:
            self.success_rate = alpha * 1.0 + (1 - alpha) * self.success_rate
            self.error_rate = (1 - alpha) * self.error_rate
        else:
            self.success_rate = (1 - alpha) * self.success_rate
            self.error_rate = alpha * 1.0 + (1 - alpha) * self.error_rate

        # Update cache hit rate
        if cache_hit:
            self.cache_hit_rate = alpha * 1.0 + (1 - alpha) * self.cache_hit_rate
        else:
            self.cache_hit_rate = (1 - alpha) * self.cache_hit_rate

        # Update quality score if provided
        if quality_score is not None:
            self.quality_score = (
                alpha * quality_score + (1 - alpha) * self.quality_score
            )

        self.last_updated = datetime.utcnow()

    def calculate_performance_score(self) -> float:
        """Calculate overall performance score (0-1)."""
        # Weight different factors
        weights = {
            "speed": 0.3,  # Response time
            "reliability": 0.4,  # Success rate
            "quality": 0.2,  # Quality score
            "cache": 0.1,  # Cache hit rate
        }

        # Normalize response time (lower is better, target < 100ms)
        speed_score = max(0, 1 - (self.avg_response_time_ms / 1000))

        # Calculate weighted score
        performance_score = (
            weights["speed"] * speed_score
            + weights["reliability"] * self.success_rate
            + weights["quality"] * self.quality_score
            + weights["cache"] * self.cache_hit_rate
        )

        return performance_score


@dataclass
class TenantBudget:
    """Budget configuration for a tenant."""

    tenant_id: UUID
    monthly_budget_usd: float
    daily_budget_usd: Optional[float] = None
    alert_threshold_percentage: float = 0.8  # Alert at 80% of budget
    strict_enforcement: bool = False  # Block requests when budget exceeded
    current_monthly_spend: float = 0.0
    current_daily_spend: float = 0.0
    last_reset_date: datetime = field(default_factory=datetime.utcnow)

    def should_reset_daily(self) -> bool:
        """Check if daily budget should be reset."""
        now = datetime.utcnow()
        return now.date() > self.last_reset_date.date()

    def should_reset_monthly(self) -> bool:
        """Check if monthly budget should be reset."""
        now = datetime.utcnow()
        return (
            now.month != self.last_reset_date.month
            or now.year != self.last_reset_date.year
        )

    def reset_daily(self) -> None:
        """Reset daily spending."""
        self.current_daily_spend = 0.0
        self.last_reset_date = datetime.utcnow()

    def reset_monthly(self) -> None:
        """Reset monthly spending."""
        self.current_monthly_spend = 0.0
        self.last_reset_date = datetime.utcnow()

    def can_spend(self, amount_usd: float) -> bool:
        """Check if tenant can spend the given amount."""
        if not self.strict_enforcement:
            return True

        # Check daily budget
        if self.daily_budget_usd:
            if self.current_daily_spend + amount_usd > self.daily_budget_usd:
                return False

        # Check monthly budget
        if self.current_monthly_spend + amount_usd > self.monthly_budget_usd:
            return False

        return True

    def record_spend(self, amount_usd: float) -> None:
        """Record spending against budget."""
        self.current_daily_spend += amount_usd
        self.current_monthly_spend += amount_usd

    def is_near_limit(self) -> bool:
        """Check if budget is near alert threshold."""
        if self.monthly_budget_usd > 0:
            monthly_percentage = self.current_monthly_spend / self.monthly_budget_usd
            if monthly_percentage >= self.alert_threshold_percentage:
                return True

        if self.daily_budget_usd and self.daily_budget_usd > 0:
            daily_percentage = self.current_daily_spend / self.daily_budget_usd
            if daily_percentage >= self.alert_threshold_percentage:
                return True

        return False

    def get_budget_status(self) -> Dict[str, Any]:
        """Get current budget status."""
        return {
            "tenant_id": str(self.tenant_id),
            "monthly_budget_usd": self.monthly_budget_usd,
            "daily_budget_usd": self.daily_budget_usd,
            "current_monthly_spend": self.current_monthly_spend,
            "current_daily_spend": self.current_daily_spend,
            "monthly_remaining": self.monthly_budget_usd - self.current_monthly_spend,
            "daily_remaining": (self.daily_budget_usd - self.current_daily_spend)
            if self.daily_budget_usd
            else None,
            "monthly_percentage": (self.current_monthly_spend / self.monthly_budget_usd)
            if self.monthly_budget_usd > 0
            else 0,
            "daily_percentage": (self.current_daily_spend / self.daily_budget_usd)
            if self.daily_budget_usd and self.daily_budget_usd > 0
            else 0,
            "near_limit": self.is_near_limit(),
            "strict_enforcement": self.strict_enforcement,
        }


@dataclass
class CostOptimizationDecision:
    """Decision made by the cost optimization service."""

    selected_provider: EmbeddingProvider
    selected_model: str
    estimated_cost_usd: float
    reasoning: str
    alternative_providers: List[
        Tuple[EmbeddingProvider, str, float]
    ]  # (provider, model, cost)
    confidence_score: float = 1.0
    budget_constraints: Optional[Dict[str, Any]] = None
    estimated_savings_usd: float = 0.0


class CostOptimizationService:
    """
    Intelligent cost optimization service for embedding providers.

    Features:
    - Multi-factor provider selection (cost, performance, availability)
    - Dynamic pricing updates and monitoring
    - Budget management and enforcement
    - Usage analytics and cost tracking
    - Provider performance monitoring
    - Intelligent routing strategies
    - Cost-saving recommendations
    - Multi-tenant cost allocation
    """

    def __init__(self, config: Dict[str, Any] = None):
        """Initialize cost optimization service."""
        self.settings = get_settings()
        self.config = config or {}

        # Provider pricing information
        self.provider_pricing: Dict[EmbeddingProvider, List[ProviderPricing]] = {}

        # Provider performance metrics
        self.provider_performance: Dict[
            EmbeddingProvider, Dict[str, ProviderPerformance]
        ] = {}

        # Tenant budgets
        self.tenant_budgets: Dict[UUID, TenantBudget] = {}

        # Usage tracking
        self.usage_history: List[Dict[str, Any]] = []

        # Configuration
        self.default_routing_strategy = RoutingStrategy(
            self.config.get("default_routing_strategy", "balanced")
        )
        self.performance_weight = self.config.get("performance_weight", 0.4)
        self.cost_weight = self.config.get("cost_weight", 0.3)
        self.availability_weight = self.config.get("availability_weight", 0.3)

        # Embedding service reference
        self._embedding_service = None

        # Initialize default pricing
        self._initialize_default_pricing()

    def _initialize_default_pricing(self) -> None:
        """Initialize default pricing for known providers."""

        # OpenAI pricing
        self.provider_pricing[EmbeddingProvider.OPENAI] = [
            ProviderPricing(
                provider=EmbeddingProvider.OPENAI,
                model=EmbeddingModel.OPENAI_ADA_002.value,
                cost_per_1k_tokens=0.0004,
                tier=ProviderTier.MEDIUM_COST,
            ),
            ProviderPricing(
                provider=EmbeddingProvider.OPENAI,
                model=EmbeddingModel.OPENAI_SMALL_3.value,
                cost_per_1k_tokens=0.00002,
                tier=ProviderTier.LOW_COST,
            ),
            ProviderPricing(
                provider=EmbeddingProvider.OPENAI,
                model=EmbeddingModel.OPENAI_LARGE_3.value,
                cost_per_1k_tokens=0.00013,
                tier=ProviderTier.MEDIUM_COST,
            ),
        ]

        # Cohere pricing
        self.provider_pricing[EmbeddingProvider.COHERE] = [
            ProviderPricing(
                provider=EmbeddingProvider.COHERE,
                model=EmbeddingModel.COHERE_EMBED_EN_V3.value,
                cost_per_1k_tokens=0.0001,
                tier=ProviderTier.LOW_COST,
            ),
            ProviderPricing(
                provider=EmbeddingProvider.COHERE,
                model=EmbeddingModel.COHERE_EMBED_MULTILANG_V3.value,
                cost_per_1k_tokens=0.0001,
                tier=ProviderTier.LOW_COST,
            ),
        ]

        # Sentence Transformers (free)
        self.provider_pricing[EmbeddingProvider.SENTENCE_TRANSFORMERS] = [
            ProviderPricing(
                provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
                model=EmbeddingModel.SENTENCE_MINILM_L6_V2.value,
                cost_per_1k_tokens=0.0,
                tier=ProviderTier.FREE,
            ),
            ProviderPricing(
                provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
                model=EmbeddingModel.SENTENCE_MPNET_BASE_V2.value,
                cost_per_1k_tokens=0.0,
                tier=ProviderTier.FREE,
            ),
        ]

        # ONNX (free)
        self.provider_pricing[EmbeddingProvider.ONNX] = [
            ProviderPricing(
                provider=EmbeddingProvider.ONNX,
                model=EmbeddingModel.ONNX_MINILM_L6_V2.value,
                cost_per_1k_tokens=0.0,
                tier=ProviderTier.FREE,
            ),
            ProviderPricing(
                provider=EmbeddingProvider.ONNX,
                model=EmbeddingModel.ONNX_MPNET_BASE_V2.value,
                cost_per_1k_tokens=0.0,
                tier=ProviderTier.FREE,
            ),
        ]

    async def initialize(self) -> None:
        """Initialize the cost optimization service."""
        logger.info("Initializing cost optimization service...")

        # Get embedding service reference
        self._embedding_service = await get_embedding_service()

        # Load tenant budgets from configuration or database
        await self._load_tenant_budgets()

        # Update provider pricing from external sources if configured
        await self._update_pricing_from_sources()

        logger.info("Cost optimization service initialized")

    async def _load_tenant_budgets(self) -> None:
        """Load tenant budgets from configuration."""
        # In a real implementation, this would load from a database
        # For now, we'll use configuration-based budgets

        default_budget_config = self.config.get(
            "default_budget",
            {
                "monthly_budget_usd": 100.0,
                "daily_budget_usd": 10.0,
                "alert_threshold_percentage": 0.8,
                "strict_enforcement": False,
            },
        )

        # Apply to all tenants or specific tenant configurations
        self.config.get("tenant_budgets", {})

        # This would typically come from your tenant management system
        # For now, we'll create a default tenant budget
        default_tenant_id = UUID(int=0)  # Default tenant
        self.tenant_budgets[default_tenant_id] = TenantBudget(
            tenant_id=default_tenant_id, **default_budget_config
        )

        logger.info(f"Loaded budgets for {len(self.tenant_budgets)} tenants")

    async def _update_pricing_from_sources(self) -> None:
        """Update pricing information from external sources."""
        # This could integrate with:
        # - Provider APIs for real-time pricing
        # - External pricing databases
        # - Custom pricing contracts

        # For now, we'll use static pricing
        logger.debug("Using static pricing configuration")

    async def select_optimal_provider(
        self,
        tenant_id: UUID,
        estimated_tokens: int,
        strategy: Optional[RoutingStrategy] = None,
        preferred_providers: Optional[List[EmbeddingProvider]] = None,
        excluded_providers: Optional[List[EmbeddingProvider]] = None,
        requirements: Optional[Dict[str, Any]] = None,
    ) -> CostOptimizationDecision:
        """
        Select the optimal provider based on cost, performance, and availability.

        Args:
            tenant_id: Tenant ID for budget considerations
            estimated_tokens: Estimated number of tokens to process
            strategy: Routing strategy to use
            preferred_providers: List of preferred providers
            excluded_providers: List of providers to exclude
            requirements: Special requirements (e.g., dimensions, quality)

        Returns:
            Cost optimization decision with selected provider and reasoning
        """
        strategy = strategy or self.default_routing_strategy
        requirements = requirements or {}

        # Get available providers
        embedding_service = await get_embedding_service()
        available_providers = embedding_service.providers

        # Filter providers based on preferences and exclusions
        candidate_providers = []
        for provider in available_providers:
            if excluded_providers and provider in excluded_providers:
                continue
            if preferred_providers and provider not in preferred_providers:
                continue
            candidate_providers.append(provider)

        if not candidate_providers:
            # Fallback to all available providers
            candidate_providers = list(available_providers.keys())

        # Get provider options with pricing
        provider_options = []
        for provider in candidate_providers:
            if provider not in self.provider_pricing:
                continue

            for pricing in self.provider_pricing[provider]:
                # Check if model meets requirements
                if self._meets_requirements(pricing.model, requirements):
                    cost = pricing.calculate_cost(estimated_tokens)
                    performance = self._get_provider_performance(
                        provider, pricing.model
                    )

                    provider_options.append(
                        {
                            "provider": provider,
                            "model": pricing.model,
                            "pricing": pricing,
                            "cost": cost,
                            "performance": performance,
                        }
                    )

        if not provider_options:
            raise ValueError("No suitable providers found")

        # Sort providers based on strategy
        sorted_options = self._sort_providers_by_strategy(
            provider_options, strategy, tenant_id, estimated_tokens
        )

        # Select best option
        best_option = sorted_options[0]

        # Calculate alternatives
        alternatives = []
        for option in sorted_options[1:3]:  # Top 2 alternatives
            alternatives.append((option["provider"], option["model"], option["cost"]))

        # Calculate estimated savings
        most_expensive = max(option["cost"] for option in sorted_options)
        estimated_savings = most_expensive - best_option["cost"]

        # Create decision
        decision = CostOptimizationDecision(
            selected_provider=best_option["provider"],
            selected_model=best_option["model"],
            estimated_cost_usd=best_option["cost"],
            reasoning=self._generate_reasoning(best_option, strategy, sorted_options),
            alternative_providers=alternatives,
            confidence_score=self._calculate_confidence_score(best_option),
            budget_constraints=self._get_budget_constraints(tenant_id),
            estimated_savings_usd=estimated_savings,
        )

        logger.info(
            f"Selected provider {best_option['provider']} with model {best_option['model']} "
            f"at estimated cost ${best_option['cost']:.6f}"
        )

        return decision

    def _meets_requirements(self, model: str, requirements: Dict[str, Any]) -> bool:
        """Check if model meets specified requirements."""
        # Check dimension requirements
        if "min_dimensions" in requirements:
            model_info = self._get_model_info(model)
            if model_info.get("dimensions", 0) < requirements["min_dimensions"]:
                return False

        # Check quality requirements
        if "min_quality_score" in requirements:
            performance = self._get_provider_performance_for_model(model)
            if performance.quality_score < requirements["min_quality_score"]:
                return False

        # Check performance requirements
        if "max_response_time_ms" in requirements:
            performance = self._get_provider_performance_for_model(model)
            if performance.avg_response_time_ms > requirements["max_response_time_ms"]:
                return False

        return True

    def _get_provider_performance(
        self, provider: EmbeddingProvider, model: str
    ) -> ProviderPerformance:
        """Get performance metrics for a provider-model combination."""
        if provider not in self.provider_performance:
            self.provider_performance[provider] = {}

        if model not in self.provider_performance[provider]:
            # Initialize with default performance
            self.provider_performance[provider][model] = ProviderPerformance(
                provider=provider, model=model
            )

        return self.provider_performance[provider][model]

    def _get_provider_performance_for_model(self, model: str) -> ProviderPerformance:
        """Get performance metrics for a model across all providers."""
        # Find the provider for this model
        for provider, models in self.provider_performance.items():
            if model in models:
                return models[model]

        # Return default performance if not found
        return ProviderPerformance(
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,  # Default
            model=model,
        )

    def _get_model_info(self, model: str) -> Dict[str, Any]:
        """Get model information."""
        # This would typically come from the embedding service
        model_configs = {
            EmbeddingModel.OPENAI_ADA_002.value: {"dimensions": 1536},
            EmbeddingModel.OPENAI_SMALL_3.value: {"dimensions": 1536},
            EmbeddingModel.OPENAI_LARGE_3.value: {"dimensions": 3072},
            EmbeddingModel.COHERE_EMBED_EN_V3.value: {"dimensions": 1024},
            EmbeddingModel.COHERE_EMBED_MULTILANG_V3.value: {"dimensions": 1024},
            EmbeddingModel.SENTENCE_MINILM_L6_V2.value: {"dimensions": 384},
            EmbeddingModel.SENTENCE_MPNET_BASE_V2.value: {"dimensions": 768},
            EmbeddingModel.ONNX_MINILM_L6_V2.value: {"dimensions": 384},
            EmbeddingModel.ONNX_MPNET_BASE_V2.value: {"dimensions": 768},
        }
        return model_configs.get(model, {})

    def _sort_providers_by_strategy(
        self,
        provider_options: List[Dict[str, Any]],
        strategy: RoutingStrategy,
        tenant_id: UUID,
        estimated_tokens: int,
    ) -> List[Dict[str, Any]]:
        """Sort provider options based on routing strategy."""

        if strategy == RoutingStrategy.COST_OPTIMAL:
            # Sort by cost (ascending)
            return sorted(provider_options, key=lambda x: x["cost"])

        elif strategy == RoutingStrategy.PERFORMANCE_OPTIMAL:
            # Sort by performance score (descending)
            return sorted(
                provider_options,
                key=lambda x: x["performance"].calculate_performance_score(),
                reverse=True,
            )

        elif strategy == RoutingStrategy.AVAILABILITY_FIRST:
            # Sort by availability (success rate)
            return sorted(
                provider_options,
                key=lambda x: x["performance"].success_rate,
                reverse=True,
            )

        elif strategy == RoutingStrategy.BUDGET_AWARE:
            # Consider budget constraints
            budget = self.tenant_budgets.get(tenant_id)
            if budget:
                # Filter providers that fit within budget
                affordable_options = [
                    option
                    for option in provider_options
                    if budget.can_spend(option["cost"])
                ]

                if affordable_options:
                    # Sort affordable options by cost
                    return sorted(affordable_options, key=lambda x: x["cost"])

            # Fallback to cost-optimal if no budget or all exceed budget
            return sorted(provider_options, key=lambda x: x["cost"])

        else:  # BALANCED
            # Calculate weighted score
            for option in provider_options:
                performance_score = option["performance"].calculate_performance_score()

                # Normalize cost (lower cost = higher score)
                max_cost = max(opt["cost"] for opt in provider_options)
                cost_score = 1 - (option["cost"] / max_cost) if max_cost > 0 else 1

                # Calculate weighted score
                option["score"] = (
                    self.performance_weight * performance_score
                    + self.cost_weight * cost_score
                    + self.availability_weight * option["performance"].success_rate
                )

            # Sort by combined score (descending)
            return sorted(provider_options, key=lambda x: x["score"], reverse=True)

    def _generate_reasoning(
        self,
        selected_option: Dict[str, Any],
        strategy: RoutingStrategy,
        all_options: List[Dict[str, Any]],
    ) -> str:
        """Generate reasoning for provider selection."""
        provider = selected_option["provider"]
        model = selected_option["model"]
        cost = selected_option["cost"]
        performance = selected_option["performance"]

        reasoning_parts = []

        # Strategy-specific reasoning
        if strategy == RoutingStrategy.COST_OPTIMAL:
            reasoning_parts.append(f"Selected lowest cost provider at ${cost:.6f}")
        elif strategy == RoutingStrategy.PERFORMANCE_OPTIMAL:
            reasoning_parts.append(
                f"Selected highest performance provider "
                f"(score: {performance.calculate_performance_score():.3f})"
            )
        elif strategy == RoutingStrategy.BALANCED:
            reasoning_parts.append(
                f"Selected balanced option considering cost, "
                f"performance ({performance.calculate_performance_score():.3f}), "
                f"and availability ({performance.success_rate:.3f})"
            )
        elif strategy == RoutingStrategy.BUDGET_AWARE:
            reasoning_parts.append(
                f"Selected provider within budget constraints at ${cost:.6f}"
            )

        # Additional details
        reasoning_parts.append(f"Provider: {provider.value}")
        reasoning_parts.append(f"Model: {model}")
        reasoning_parts.append(
            f"Estimated response time: {performance.avg_response_time_ms:.1f}ms"
        )
        reasoning_parts.append(f"Success rate: {performance.success_rate:.3f}")

        if selected_option.get("pricing").is_free_tier:
            reasoning_parts.append("Free tier provider")

        return " | ".join(reasoning_parts)

    def _calculate_confidence_score(self, option: Dict[str, Any]) -> float:
        """Calculate confidence score for the selection."""
        performance = option["performance"]

        # Base confidence on data availability
        data_confidence = min(
            1.0, performance.total_requests / 100
        )  # More data = higher confidence

        # Adjust based on performance consistency
        consistency_confidence = performance.success_rate

        # Consider availability
        availability_confidence = performance.availability_score

        # Combine factors
        confidence = (
            0.4 * data_confidence
            + 0.3 * consistency_confidence
            + 0.3 * availability_confidence
        )

        return confidence

    def _get_budget_constraints(self, tenant_id: UUID) -> Optional[Dict[str, Any]]:
        """Get budget constraints for a tenant."""
        budget = self.tenant_budgets.get(tenant_id)
        if not budget:
            return None

        return {
            "monthly_budget_usd": budget.monthly_budget_usd,
            "daily_budget_usd": budget.daily_budget_usd,
            "current_monthly_spend": budget.current_monthly_spend,
            "current_daily_spend": budget.current_daily_spend,
            "strict_enforcement": budget.strict_enforcement,
            "near_limit": budget.is_near_limit(),
        }

    async def record_usage(
        self,
        tenant_id: UUID,
        provider: EmbeddingProvider,
        model: str,
        tokens_used: int,
        cost_usd: float,
        response_time_ms: float,
        success: bool,
        cache_hit: bool = False,
        quality_score: Optional[float] = None,
    ) -> None:
        """Record usage for cost tracking and performance monitoring."""

        # Update tenant budget
        budget = self.tenant_budgets.get(tenant_id)
        if budget:
            # Reset budgets if needed
            if budget.should_reset_daily():
                budget.reset_daily()
            if budget.should_reset_monthly():
                budget.reset_monthly()

            # Record spending
            budget.record_spend(cost_usd)

        # Update provider performance
        performance = self._get_provider_performance(provider, model)
        performance.update_metrics(response_time_ms, success, cache_hit, quality_score)

        # Record usage history
        usage_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "tenant_id": str(tenant_id),
            "provider": provider.value,
            "model": model,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
            "response_time_ms": response_time_ms,
            "success": success,
            "cache_hit": cache_hit,
            "quality_score": quality_score,
        }

        self.usage_history.append(usage_record)

        # Keep only last 10000 records in memory
        if len(self.usage_history) > 10000:
            self.usage_history = self.usage_history[-10000:]

        # Log significant events
        if not success:
            logger.warning(f"Provider {provider} failed for tenant {tenant_id}")
        elif cost_usd > 1.0:  # Log expensive requests
            logger.info(f"High-cost request: ${cost_usd:.6f} for {tokens_used} tokens")

    def get_cost_analytics(
        self,
        tenant_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get cost analytics for a tenant or globally."""

        # Filter usage records
        filtered_usage = self.usage_history

        if tenant_id:
            filtered_usage = [
                record
                for record in filtered_usage
                if record["tenant_id"] == str(tenant_id)
            ]

        if start_date:
            start_iso = start_date.isoformat()
            filtered_usage = [
                record for record in filtered_usage if record["timestamp"] >= start_iso
            ]

        if end_date:
            end_iso = end_date.isoformat()
            filtered_usage = [
                record for record in filtered_usage if record["timestamp"] <= end_iso
            ]

        if not filtered_usage:
            return {"message": "No usage data found"}

        # Calculate analytics
        total_cost = sum(record["cost_usd"] for record in filtered_usage)
        total_tokens = sum(record["tokens_used"] for record in filtered_usage)
        total_requests = len(filtered_usage)
        successful_requests = sum(1 for record in filtered_usage if record["success"])

        # Provider breakdown
        provider_costs = {}
        provider_usage = {}

        for record in filtered_usage:
            provider = record["provider"]
            if provider not in provider_costs:
                provider_costs[provider] = 0
                provider_usage[provider] = 0

            provider_costs[provider] += record["cost_usd"]
            provider_usage[provider] += 1

        # Model breakdown
        model_costs = {}
        for record in filtered_usage:
            model = record["model"]
            if model not in model_costs:
                model_costs[model] = 0
            model_costs[model] += record["cost_usd"]

        # Time series data (daily)
        daily_costs = {}
        for record in filtered_usage:
            date = record["timestamp"][:10]  # Extract date
            if date not in daily_costs:
                daily_costs[date] = 0
            daily_costs[date] += record["cost_usd"]

        # Performance metrics
        avg_response_time = (
            sum(record["response_time_ms"] for record in filtered_usage)
            / total_requests
        )
        cache_hit_rate = (
            sum(1 for record in filtered_usage if record["cache_hit"]) / total_requests
        )

        return {
            "summary": {
                "total_cost_usd": total_cost,
                "total_tokens": total_tokens,
                "total_requests": total_requests,
                "successful_requests": successful_requests,
                "success_rate": successful_requests / total_requests,
                "avg_cost_per_1k_tokens": (total_cost / total_tokens) * 1000
                if total_tokens > 0
                else 0,
                "avg_response_time_ms": avg_response_time,
                "cache_hit_rate": cache_hit_rate,
            },
            "provider_breakdown": provider_costs,
            "model_breakdown": model_costs,
            "daily_costs": daily_costs,
            "usage_records_count": len(filtered_usage),
        }

    def set_tenant_budget(self, tenant_id: UUID, budget: TenantBudget) -> None:
        """Set budget for a tenant."""
        self.tenant_budgets[tenant_id] = budget
        logger.info(
            f"Set budget for tenant {tenant_id}: ${budget.monthly_budget_usd}/month"
        )

    def update_provider_pricing(self, pricing_updates: List[ProviderPricing]) -> None:
        """Update provider pricing information."""
        for pricing in pricing_updates:
            provider = pricing.provider

            if provider not in self.provider_pricing:
                self.provider_pricing[provider] = []

            # Find existing pricing for this model and update
            updated = False
            for i, existing_pricing in enumerate(self.provider_pricing[provider]):
                if existing_pricing.model == pricing.model:
                    self.provider_pricing[provider][i] = pricing
                    updated = True
                    break

            if not updated:
                self.provider_pricing[provider].append(pricing)

        logger.info(
            f"Updated pricing for {len(pricing_updates)} provider-model combinations"
        )

    def get_provider_rankings(self) -> List[Dict[str, Any]]:
        """Get provider rankings based on performance and cost."""
        rankings = []

        for provider, models in self.provider_performance.items():
            for model, performance in models.items():
                # Get pricing info
                pricing_info = None
                if provider in self.provider_pricing:
                    for pricing in self.provider_pricing[provider]:
                        if pricing.model == model:
                            pricing_info = pricing
                            break

                ranking = {
                    "provider": provider.value,
                    "model": model,
                    "performance_score": performance.calculate_performance_score(),
                    "avg_response_time_ms": performance.avg_response_time_ms,
                    "success_rate": performance.success_rate,
                    "cache_hit_rate": performance.cache_hit_rate,
                    "quality_score": performance.quality_score,
                    "total_requests": performance.total_requests,
                    "cost_per_1k_tokens": pricing_info.cost_per_1k_tokens
                    if pricing_info
                    else None,
                    "tier": pricing_info.tier.value if pricing_info else None,
                }

                rankings.append(ranking)

        # Sort by performance score
        rankings.sort(key=lambda x: x["performance_score"], reverse=True)

        return rankings

    async def get_cost_saving_recommendations(
        self, tenant_id: UUID
    ) -> List[Dict[str, Any]]:
        """Generate cost-saving recommendations for a tenant."""
        recommendations = []

        # Analyze usage patterns
        tenant_usage = [
            record
            for record in self.usage_history
            if record["tenant_id"] == str(tenant_id)
        ]

        if not tenant_usage:
            return [{"message": "No usage data available for recommendations"}]

        # Recommendation 1: Switch to cheaper providers
        provider_costs = {}
        for record in tenant_usage:
            provider = record["provider"]
            if provider not in provider_costs:
                provider_costs[provider] = 0
            provider_costs[provider] += record["cost_usd"]

        # Find most expensive provider
        if provider_costs:
            most_expensive_provider = max(provider_costs, key=provider_costs.get)
            most_expensive_cost = provider_costs[most_expensive_provider]

            # Check if there are cheaper alternatives
            cheaper_alternatives = [
                provider
                for provider, cost in provider_costs.items()
                if cost < most_expensive_cost * 0.8  # At least 20% cheaper
            ]

            if cheaper_alternatives:
                recommendations.append(
                    {
                        "type": "provider_switch",
                        "title": "Switch to cheaper provider",
                        "description": f"Consider switching from {most_expensive_provider} to {cheaper_alternatives[0]} "
                        f"to save approximately ${most_expensive_cost * 0.2:.2f}",
                        "potential_savings_usd": most_expensive_cost * 0.2,
                        "current_provider": most_expensive_provider,
                        "recommended_provider": cheaper_alternatives[0],
                    }
                )

        # Recommendation 2: Increase cache usage
        cache_hits = sum(1 for record in tenant_usage if record["cache_hit"])
        cache_hit_rate = cache_hits / len(tenant_usage)

        if cache_hit_rate < 0.5:  # Less than 50% cache hit rate
            recommendations.append(
                {
                    "type": "cache_optimization",
                    "title": "Improve cache utilization",
                    "description": f"Current cache hit rate is {cache_hit_rate:.1%}. "
                    f"Improving caching could save costs by reducing API calls.",
                    "potential_savings_percentage": (1 - cache_hit_rate) * 0.5,
                    "current_cache_hit_rate": cache_hit_rate,
                    "target_cache_hit_rate": 0.8,
                }
            )

        # Recommendation 3: Batch processing optimization
        # Check if many small requests are being made
        small_requests = [
            record
            for record in tenant_usage
            if record["tokens_used"] < 100  # Less than 100 tokens
        ]

        if len(small_requests) > len(tenant_usage) * 0.5:  # More than 50% are small
            recommendations.append(
                {
                    "type": "batch_optimization",
                    "title": "Optimize batch processing",
                    "description": f"{len(small_requests)} out of {len(tenant_usage)} requests are small. "
                    f"Consider batching small requests together for better efficiency.",
                    "small_requests_count": len(small_requests),
                    "total_requests": len(tenant_usage),
                    "batching_potential": len(small_requests) / len(tenant_usage),
                }
            )

        return recommendations


# Global instance
_cost_optimization_service: Optional[CostOptimizationService] = None


async def get_cost_optimization_service() -> CostOptimizationService:
    """Get global cost optimization service instance."""
    global _cost_optimization_service

    if _cost_optimization_service is None:
        _cost_optimization_service = CostOptimizationService()
        await _cost_optimization_service.initialize()

    return _cost_optimization_service


# Convenience functions
async def select_best_provider(
    tenant_id: UUID,
    estimated_tokens: int,
    strategy: Optional[RoutingStrategy] = None,
    **kwargs,
) -> CostOptimizationDecision:
    """Select the best provider for embedding generation."""
    service = await get_cost_optimization_service()
    return await service.select_optimal_provider(
        tenant_id, estimated_tokens, strategy, **kwargs
    )


async def record_embedding_usage(
    tenant_id: UUID,
    provider: EmbeddingProvider,
    model: str,
    tokens_used: int,
    cost_usd: float,
    response_time_ms: float,
    success: bool,
    **kwargs,
) -> None:
    """Record embedding usage for cost tracking."""
    service = await get_cost_optimization_service()
    await service.record_usage(
        tenant_id,
        provider,
        model,
        tokens_used,
        cost_usd,
        response_time_ms,
        success,
        **kwargs,
    )

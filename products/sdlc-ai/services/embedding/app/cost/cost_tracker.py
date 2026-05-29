"""
Cost tracking for embedding services.

This module provides comprehensive cost tracking with real-time monitoring,
budget enforcement, and detailed cost analysis per tenant and provider.
"""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from ..providers.base import ProviderCapabilities


@dataclass
class CostRecord:
    """Represents a cost record for embedding usage."""

    tenant_id: str
    provider: str
    model: str
    tokens: int
    cost_usd: Decimal
    timestamp: datetime
    job_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class CostTracker:
    """Tracks costs for embedding operations with detailed analytics."""

    def __init__(self):
        """Initialize cost tracker."""
        # Cost records storage (in production, this would be a database)
        self._cost_records: List[CostRecord] = []

        # Aggregated statistics
        self._tenant_costs: Dict[str, Decimal] = defaultdict(Decimal)
        self._provider_costs: Dict[str, Decimal] = defaultdict(Decimal)
        self._model_costs: Dict[str, Decimal] = defaultdict(Decimal)
        self._daily_costs: Dict[str, Decimal] = defaultdict(Decimal)

        # Provider pricing information
        self._provider_pricing: Dict[str, Dict[str, Decimal]] = {
            "openai": {
                "text-embedding-ada-002": Decimal("0.0004"),
                "text-embedding-3-small": Decimal("0.00002"),
                "text-embedding-3-large": Decimal("0.00013"),
            },
            "cohere": {
                "embed-english-v3.0": Decimal("0.0001"),
                "embed-multilingual-v3.0": Decimal("0.0001"),
                "embed-english-light-v3.0": Decimal("0.00003"),
                "embed-multilingual-light-v3.0": Decimal("0.00003"),
            },
            "local": {
                "all-MiniLM-L6-v2": Decimal("0.0"),
                "all-mpnet-base-v2": Decimal("0.0"),
                "paraphrase-multilingual-MiniLM-L12-v2": Decimal("0.0"),
            },
        }

        # Budget tracking
        self._tenant_budgets: Dict[str, Decimal] = {}
        self._budget_alerts: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def set_provider_pricing(
        self, provider: str, model_costs: Dict[str, Decimal]
    ) -> None:
        """
        Set pricing information for a provider.

        Args:
            provider: Provider name
            model_costs: Dictionary of model costs per 1M tokens
        """
        self._provider_pricing[provider] = model_costs

    def get_model_cost(self, provider: str, model: str) -> Decimal:
        """
        Get cost per 1M tokens for a specific model.

        Args:
            provider: Provider name
            model: Model name

        Returns:
            Cost per 1M tokens
        """
        return self._provider_pricing.get(provider, {}).get(model, Decimal("0.0"))

    def calculate_cost(self, provider: str, model: str, tokens: int) -> Decimal:
        """
        Calculate cost for embedding generation.

        Args:
            provider: Provider name
            model: Model name
            tokens: Number of tokens

        Returns:
            Total cost in USD
        """
        cost_per_million = self.get_model_cost(provider, model)
        return (Decimal(tokens) / Decimal(1_000_000)) * cost_per_million

    def track_cost(
        self,
        tenant_id: str,
        provider: str,
        model: str,
        tokens: int,
        job_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Decimal:
        """
        Track cost for embedding operation.

        Args:
            tenant_id: Tenant ID
            provider: Provider name
            model: Model name
            tokens: Number of tokens
            job_id: Job ID
            user_id: User ID
            metadata: Additional metadata

        Returns:
            Calculated cost
        """
        cost_usd = self.calculate_cost(provider, model, tokens)

        cost_record = CostRecord(
            tenant_id=tenant_id,
            provider=provider,
            model=model,
            tokens=tokens,
            cost_usd=cost_usd,
            timestamp=datetime.utcnow(),
            job_id=job_id,
            user_id=user_id,
            metadata=metadata or {},
        )

        # Store cost record
        self._cost_records.append(cost_record)

        # Update aggregated statistics
        self._tenant_costs[tenant_id] += cost_usd
        self._provider_costs[f"{provider}:{model}"] += cost_usd
        self._model_costs[model] += cost_usd

        # Update daily costs
        date_key = cost_record.timestamp.strftime("%Y-%m-%d")
        self._daily_costs[date_key] += cost_usd

        # Check budget alerts
        self._check_budget_alerts(tenant_id)

        return cost_usd

    def set_tenant_budget(self, tenant_id: str, monthly_budget_usd: Decimal) -> None:
        """
        Set monthly budget for a tenant.

        Args:
            tenant_id: Tenant ID
            monthly_budget_usd: Monthly budget in USD
        """
        self._tenant_budgets[tenant_id] = monthly_budget_usd

    def get_tenant_budget(self, tenant_id: str) -> Optional[Decimal]:
        """
        Get monthly budget for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Monthly budget or None if not set
        """
        return self._tenant_budgets.get(tenant_id)

    def get_tenant_monthly_spend(self, tenant_id: str) -> Decimal:
        """
        Get monthly spend for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Monthly spend
        """
        current_month = datetime.utcnow().strftime("%Y-%m")
        monthly_spend = Decimal("0.0")

        for record in self._cost_records:
            if record.tenant_id == tenant_id:
                record_month = record.timestamp.strftime("%Y-%m")
                if record_month == current_month:
                    monthly_spend += record.cost_usd

        return monthly_spend

    def get_tenant_budget_utilization(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get budget utilization for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Budget utilization information
        """
        budget = self.get_tenant_budget(tenant_id)
        if not budget:
            return {
                "has_budget": False,
                "monthly_spend": self.get_tenant_monthly_spend(tenant_id),
            }

        monthly_spend = self.get_tenant_monthly_spend(tenant_id)
        utilization = monthly_spend / budget if budget > 0 else Decimal("0.0")
        remaining = budget - monthly_spend

        return {
            "has_budget": True,
            "monthly_budget": float(budget),
            "monthly_spend": float(monthly_spend),
            "budget_utilization": float(utilization),
            "remaining_budget": float(remaining),
            "is_over_budget": monthly_spend > budget,
            "days_remaining_in_month": self._days_remaining_in_month(),
        }

    def get_cost_summary(
        self,
        tenant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get cost summary with optional filtering.

        Args:
            tenant_id: Filter by tenant ID
            start_date: Filter by start date
            end_date: Filter by end date

        Returns:
            Cost summary
        """
        filtered_records = self._cost_records

        # Apply filters
        if tenant_id:
            filtered_records = [r for r in filtered_records if r.tenant_id == tenant_id]

        if start_date:
            filtered_records = [
                r for r in filtered_records if r.timestamp >= start_date
            ]

        if end_date:
            filtered_records = [r for r in filtered_records if r.timestamp <= end_date]

        if not filtered_records:
            return {
                "total_cost": 0.0,
                "total_tokens": 0,
                "total_requests": 0,
                "average_cost_per_request": 0.0,
                "average_cost_per_token": 0.0,
                "provider_breakdown": {},
                "model_breakdown": {},
                "daily_breakdown": {},
            }

        # Calculate summary metrics
        total_cost = sum(r.cost_usd for r in filtered_records)
        total_tokens = sum(r.tokens for r in filtered_records)
        total_requests = len(filtered_records)

        # Provider and model breakdowns
        provider_costs = defaultdict(Decimal)
        model_costs = defaultdict(Decimal)
        daily_costs = defaultdict(Decimal)

        for record in filtered_records:
            provider_costs[record.provider] += record.cost_usd
            model_costs[f"{record.provider}:{record.model}"] += record.cost_usd

            date_key = record.timestamp.strftime("%Y-%m-%d")
            daily_costs[date_key] += record.cost_usd

        return {
            "total_cost": float(total_cost),
            "total_tokens": total_tokens,
            "total_requests": total_requests,
            "average_cost_per_request": float(total_cost / total_requests),
            "average_cost_per_token": float(total_cost / total_tokens)
            if total_tokens > 0
            else 0.0,
            "provider_breakdown": {k: float(v) for k, v in provider_costs.items()},
            "model_breakdown": {k: float(v) for k, v in model_costs.items()},
            "daily_breakdown": {k: float(v) for k, v in daily_costs.items()},
        }

    def get_cost_forecast(self, tenant_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Generate cost forecast based on historical data.

        Args:
            tenant_id: Tenant ID
            days: Number of days to forecast

        Returns:
            Cost forecast
        """
        # Get last 30 days of data for trend analysis
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)

        recent_costs = []
        for record in self._cost_records:
            if (
                record.tenant_id == tenant_id
                and start_date <= record.timestamp <= end_date
            ):
                date_key = record.timestamp.strftime("%Y-%m-%d")
                recent_costs.append((date_key, float(record.cost_usd)))

        if not recent_costs:
            return {
                "forecast_available": False,
                "reason": "No historical data available",
            }

        # Aggregate daily costs
        daily_costs = defaultdict(float)
        for date_key, cost in recent_costs:
            daily_costs[date_key] += cost

        # Calculate average daily cost
        if daily_costs:
            avg_daily_cost = sum(daily_costs.values()) / len(daily_costs)
        else:
            avg_daily_cost = 0.0

        # Simple linear forecast (could be enhanced with more sophisticated models)
        forecasted_cost = avg_daily_cost * days

        # Get current monthly budget for comparison
        budget_info = self.get_tenant_budget_utilization(tenant_id)

        return {
            "forecast_available": True,
            "period_days": days,
            "historical_days": len(daily_costs),
            "average_daily_cost": avg_daily_cost,
            "forecasted_cost": forecasted_cost,
            "monthly_budget": budget_info.get("monthly_budget"),
            "budget_forecast_utilization": (
                forecasted_cost / budget_info.get("monthly_budget", 1.0)
                if budget_info.get("monthly_budget")
                else None
            ),
            "confidence": "medium",  # Could be calculated based on data variance
        }

    def get_provider_cost_comparison(self, tokens: int) -> Dict[str, Dict[str, Any]]:
        """
        Compare costs across providers for a given token count.

        Args:
            tokens: Number of tokens to compare

        Returns:
            Provider cost comparison
        """
        comparison = {}

        for provider, model_costs in self._provider_pricing.items():
            provider_models = {}

            for model, cost_per_million in model_costs.items():
                total_cost = (Decimal(tokens) / Decimal(1_000_000)) * cost_per_million
                provider_models[model] = {
                    "cost_per_million_tokens": float(cost_per_million),
                    "total_cost": float(total_cost),
                    "cost_per_token": float(total_cost / tokens) if tokens > 0 else 0.0,
                }

            comparison[provider] = {
                "models": provider_models,
                "cheapest_model": min(
                    provider_models.items(), key=lambda x: x[1]["total_cost"]
                )[0]
                if provider_models
                else None,
                "cheapest_cost": min(
                    model["total_cost"] for model in provider_models.values()
                )
                if provider_models
                else 0.0,
            }

        return comparison

    def get_cost_optimization_recommendations(
        self,
        tenant_id: str,
        usage_pattern: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate cost optimization recommendations.

        Args:
            tenant_id: Tenant ID
            usage_pattern: Optional usage pattern data

        Returns:
            List of recommendations
        """
        recommendations = []

        # Analyze tenant's cost data
        tenant_records = [r for r in self._cost_records if r.tenant_id == tenant_id]

        if not tenant_records:
            return [
                {
                    "type": "no_data",
                    "priority": "low",
                    "title": "No usage data available",
                    "description": "Start using the embedding service to receive cost optimization recommendations.",
                }
            ]

        # Analyze provider usage
        provider_usage = defaultdict(lambda: {"cost": Decimal("0.0"), "tokens": 0})
        for record in tenant_records:
            provider_usage[record.provider]["cost"] += record.cost_usd
            provider_usage[record.provider]["tokens"] += record.tokens

        # Check if local models could be used
        local_cost = sum(r.cost_usd for r in tenant_records if r.provider == "local")
        api_cost = sum(r.cost_usd for r in tenant_records if r.provider != "local")

        if api_cost > 0 and local_cost == 0:
            recommendations.append(
                {
                    "type": "use_local_models",
                    "priority": "high",
                    "title": "Consider using local models",
                    "description": f"You could save ${float(api_cost):.2f} by using local embedding models.",
                    "potential_savings": float(api_cost),
                    "implementation_effort": "medium",
                }
            )

        # Check for overpriced models
        for provider, usage in provider_usage.items():
            if provider != "local" and usage["tokens"] > 0:
                avg_cost_per_token = usage["cost"] / usage["tokens"]

                # Compare with cheapest alternative
                comparison = self.get_provider_cost_comparison(
                    1000
                )  # 1K tokens for comparison
                cheapest_cost_per_token = min(
                    model["cost_per_token"]
                    for provider_data in comparison.values()
                    for model in provider_data["models"].values()
                    if model["cost_per_token"] > 0
                )

                if (
                    avg_cost_per_token > cheapest_cost_per_token * 2
                ):  # 2x more expensive
                    recommendations.append(
                        {
                            "type": "switch_provider",
                            "priority": "medium",
                            "title": f"Consider switching from {provider}",
                            "description": f"Your current average cost is ${float(avg_cost_per_token):.6f} per token, which is significantly higher than alternatives.",
                            "current_provider": provider,
                            "potential_savings": float(
                                (avg_cost_per_token - cheapest_cost_per_token)
                                * usage["tokens"]
                            ),
                            "implementation_effort": "low",
                        }
                    )

        # Budget recommendations
        budget_info = self.get_tenant_budget_utilization(tenant_id)
        if budget_info.get("has_budget"):
            utilization = budget_info.get("budget_utilization", 0.0)
            if utilization > 0.8:
                recommendations.append(
                    {
                        "type": "budget_management",
                        "priority": "high" if utilization > 1.0 else "medium",
                        "title": "Budget alert"
                        if utilization > 1.0
                        else "Budget warning",
                        "description": f"You've used {utilization:.1%} of your monthly budget.",
                        "current_utilization": utilization,
                        "remaining_budget": budget_info.get("remaining_budget", 0.0),
                        "implementation_effort": "low",
                    }
                )

        # Caching recommendations
        cache_hit_rate = (
            usage_pattern.get("cache_hit_rate", 0.0) if usage_pattern else 0.0
        )
        if cache_hit_rate < 0.5:
            potential_savings = float(api_cost * (1.0 - cache_hit_rate))
            if potential_savings > 1.0:  # More than $1 potential savings
                recommendations.append(
                    {
                        "type": "improve_caching",
                        "priority": "medium",
                        "title": "Improve cache utilization",
                        "description": f"Current cache hit rate is {cache_hit_rate:.1%}. Improving caching could save ${potential_savings:.2f}.",
                        "current_hit_rate": cache_hit_rate,
                        "potential_savings": potential_savings,
                        "implementation_effort": "low",
                    }
                )

        return sorted(
            recommendations,
            key=lambda x: (
                {"high": 3, "medium": 2, "low": 1}.get(x["priority"], 0),
                x.get("potential_savings", 0),
            ),
            reverse=True,
        )

    def _check_budget_alerts(self, tenant_id: str) -> None:
        """Check and generate budget alerts."""
        budget_info = self.get_tenant_budget_utilization(tenant_id)

        if not budget_info.get("has_budget"):
            return

        utilization = budget_info.get("budget_utilization", 0.0)

        # Generate alerts for different thresholds
        if utilization >= 1.0:
            alert = {
                "level": "critical",
                "message": f"Budget exceeded: {utilization:.1%} used",
                "utilization": utilization,
                "timestamp": datetime.utcnow(),
            }
            self._budget_alerts[tenant_id].append(alert)

        elif utilization >= 0.9:
            alert = {
                "level": "warning",
                "message": f"Budget warning: {utilization:.1%} used",
                "utilization": utilization,
                "timestamp": datetime.utcnow(),
            }
            self._budget_alerts[tenant_id].append(alert)

        elif utilization >= 0.8:
            alert = {
                "level": "info",
                "message": f"Budget notice: {utilization:.1%} used",
                "utilization": utilization,
                "timestamp": datetime.utcnow(),
            }
            self._budget_alerts[tenant_id].append(alert)

    def _days_remaining_in_month(self) -> int:
        """Calculate days remaining in current month."""
        now = datetime.utcnow()
        next_month = now.replace(day=28) + timedelta(days=4)  # Go to next month
        next_month = next_month - timedelta(
            days=next_month.day - 1
        )  # First day of next month
        return (next_month - now).days

    def get_budget_alerts(self, tenant_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get budget alerts for a tenant.

        Args:
            tenant_id: Tenant ID
            days: Number of days to look back

        Returns:
            List of budget alerts
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        alerts = self._budget_alerts.get(tenant_id, [])
        recent_alerts = [alert for alert in alerts if alert["timestamp"] >= cutoff_date]

        return sorted(recent_alerts, key=lambda x: x["timestamp"], reverse=True)

    def export_cost_data(
        self,
        tenant_id: Optional[str] = None,
        format: str = "json",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> str:
        """
        Export cost data for analysis.

        Args:
            tenant_id: Filter by tenant ID
            format: Export format (json, csv)
            start_date: Filter by start date
            end_date: Filter by end date

        Returns:
            Exported data as string
        """
        # Filter records
        records = self._cost_records

        if tenant_id:
            records = [r for r in records if r.tenant_id == tenant_id]

        if start_date:
            records = [r for r in records if r.timestamp >= start_date]

        if end_date:
            records = [r for r in records if r.timestamp <= end_date]

        if format.lower() == "json":
            import json

            return json.dumps(
                [
                    {
                        "tenant_id": r.tenant_id,
                        "provider": r.provider,
                        "model": r.model,
                        "tokens": r.tokens,
                        "cost_usd": float(r.cost_usd),
                        "timestamp": r.timestamp.isoformat(),
                        "job_id": r.job_id,
                        "user_id": r.user_id,
                        "metadata": r.metadata,
                    }
                    for r in records
                ],
                indent=2,
            )

        elif format.lower() == "csv":
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow(
                [
                    "tenant_id",
                    "provider",
                    "model",
                    "tokens",
                    "cost_usd",
                    "timestamp",
                    "job_id",
                    "user_id",
                ]
            )

            # Data
            for r in records:
                writer.writerow(
                    [
                        r.tenant_id,
                        r.provider,
                        r.model,
                        r.tokens,
                        float(r.cost_usd),
                        r.timestamp.isoformat(),
                        r.job_id or "",
                        r.user_id or "",
                    ]
                )

            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format: {format}")

    def get_provider_pricing_info(self) -> Dict[str, Dict[str, float]]:
        """
        Get current provider pricing information.

        Returns:
            Provider pricing information
        """
        return {
            provider: {model: float(cost) for model, cost in models.items()}
            for provider, models in self._provider_pricing.items()
        }

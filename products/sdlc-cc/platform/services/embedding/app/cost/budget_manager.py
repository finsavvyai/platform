"""
Budget management for embedding costs.

This module provides comprehensive budget management with tenant-specific
budgets, alerts, and enforcement policies.
"""

import time
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from .cost_tracker import CostTracker


class BudgetManager:
    """Manages budgets and spending limits for embedding services."""

    def __init__(
        self,
        cost_tracker: Optional[CostTracker] = None,
        default_monthly_budget: Decimal = Decimal("100.00"),
        alert_thresholds: List[float] = None,
        enforcement_strictness: str = "soft",  # soft, medium, hard
    ):
        """
        Initialize budget manager.

        Args:
            cost_tracker: Cost tracker instance
            default_monthly_budget: Default monthly budget for new tenants
            alert_thresholds: Budget utilization alert thresholds
            enforcement_strictness: Budget enforcement strictness
        """
        self.cost_tracker = cost_tracker or CostTracker()
        self.default_monthly_budget = default_monthly_budget
        self.alert_thresholds = alert_thresholds or [0.5, 0.8, 0.9, 1.0]
        self.enforcement_strictness = enforcement_strictness

        # Tenant budget storage
        self._tenant_budgets: Dict[str, Dict[str, Any]] = {}

        # Budget alerts storage
        self._budget_alerts: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        # Spending policies
        self._spending_policies: Dict[str, Dict[str, Any]] = {}

        # Alert history
        self._alert_history: List[Dict[str, Any]] = []

    def set_tenant_budget(
        self,
        tenant_id: str,
        monthly_budget: Decimal,
        billing_cycle_start: Optional[int] = None,  # Day of month (1-31)
        grace_period_days: int = 0,
        overage_policy: str = "block",  # block, allow_with_surcharge, allow
        custom_alert_thresholds: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """
        Set budget for a tenant.

        Args:
            tenant_id: Tenant ID
            monthly_budget: Monthly budget amount
            billing_cycle_start: Day of month when billing cycle starts
            grace_period_days: Grace period before budget enforcement
            overage_policy: Policy for handling overages
            custom_alert_thresholds: Custom alert thresholds

        Returns:
            Budget configuration
        """
        budget_config = {
            "monthly_budget": monthly_budget,
            "billing_cycle_start": billing_cycle_start or 1,
            "grace_period_days": grace_period_days,
            "overage_policy": overage_policy,
            "alert_thresholds": custom_alert_thresholds or self.alert_thresholds,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        self._tenant_budgets[tenant_id] = budget_config

        # Initialize cost tracker budget if needed
        self.cost_tracker.set_tenant_budget(tenant_id, monthly_budget)

        return budget_config

    def get_tenant_budget(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """
        Get budget configuration for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Budget configuration or None if not found
        """
        return self._tenant_budgets.get(tenant_id)

    def get_current_billing_period(self, tenant_id: str) -> Dict[str, datetime]:
        """
        Get current billing period for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Billing period start and end dates
        """
        budget_config = self.get_tenant_budget(tenant_id)
        if not budget_config:
            # Default to calendar month
            now = datetime.utcnow()
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            # Calculate end of month
            if now.month == 12:
                end_date = now.replace(year=now.year + 1, month=1, day=1)
            else:
                end_date = now.replace(month=now.month + 1, day=1)

            end_date = end_date - timedelta(microseconds=1)

            return {"start": start_date, "end": end_date}

        # Custom billing cycle
        cycle_start_day = budget_config["billing_cycle_start"]
        now = datetime.utcnow()

        # Find the start of current billing period
        if now.day >= cycle_start_day:
            start_date = now.replace(
                day=cycle_start_day, hour=0, minute=0, second=0, microsecond=0
            )
        else:
            # Previous month
            if now.month == 1:
                start_date = now.replace(
                    year=now.year - 1, month=12, day=cycle_start_day
                )
            else:
                start_date = now.replace(month=now.month - 1, day=cycle_start_day)
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

        # Calculate end date (start of next billing period - 1 microsecond)
        if start_date.month == 12:
            end_date = start_date.replace(year=start_date.year + 1, month=1, day=1)
        else:
            end_date = start_date.replace(month=start_date.month + 1, day=1)

        end_date = end_date - timedelta(microseconds=1)

        return {"start": start_date, "end": end_date}

    def get_tenant_spend(
        self,
        tenant_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get spending information for a tenant.

        Args:
            tenant_id: Tenant ID
            start_date: Start date for spending calculation
            end_date: End date for spending calculation

        Returns:
            Spending information
        """
        if not start_date or not end_date:
            billing_period = self.get_current_billing_period(tenant_id)
            start_date = start_date or billing_period["start"]
            end_date = end_date or billing_period["end"]

        # Get cost summary for the period
        cost_summary = self.cost_tracker.get_cost_summary(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date,
        )

        # Get budget information
        budget_config = self.get_tenant_budget(tenant_id)
        monthly_budget = (
            budget_config["monthly_budget"]
            if budget_config
            else self.default_monthly_budget
        )

        # Calculate remaining budget
        remaining_budget = monthly_budget - Decimal(str(cost_summary["total_cost"]))

        # Calculate days remaining in billing period
        billing_period = self.get_current_billing_period(tenant_id)
        days_remaining = (billing_period["end"] - datetime.utcnow()).days + 1

        return {
            "tenant_id": tenant_id,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days_total": (end_date - start_date).days + 1,
                "days_remaining": max(0, days_remaining),
            },
            "spending": {
                "total_cost": cost_summary["total_cost"],
                "total_tokens": cost_summary["total_tokens"],
                "total_requests": cost_summary["total_requests"],
                "average_cost_per_request": cost_summary["average_cost_per_request"],
                "average_cost_per_token": cost_summary["average_cost_per_token"],
            },
            "budget": {
                "monthly_budget": float(monthly_budget),
                "remaining_budget": float(remaining_budget),
                "budget_utilization": float(cost_summary["total_cost"])
                / float(monthly_budget),
                "is_over_budget": remaining_budget < 0,
                "projected_monthly_spend": self._project_monthly_spend(tenant_id),
            },
            "daily_average": {
                "average_daily_spend": cost_summary["total_cost"]
                / max(1, (end_date - start_date).days + 1),
                "recommended_daily_budget": float(monthly_budget)
                / 30,  # Assume 30-day month
            },
        }

    def check_budget_status(self, tenant_id: str) -> Dict[str, Any]:
        """
        Check current budget status for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Budget status information
        """
        spend_info = self.get_tenant_spend(tenant_id)
        budget_config = self.get_tenant_budget(tenant_id)

        utilization = spend_info["budget"]["budget_utilization"]
        remaining_budget = spend_info["budget"]["remaining_budget"]

        # Determine alert level
        alert_thresholds = (
            budget_config["alert_thresholds"]
            if budget_config
            else self.alert_thresholds
        )
        alert_level = None

        for i, threshold in enumerate(sorted(alert_thresholds, reverse=True)):
            if utilization >= threshold:
                alert_levels = ["critical", "warning", "caution", "notice"]
                alert_level = alert_levels[min(i, len(alert_levels) - 1)]
                break

        # Check grace period
        in_grace_period = False
        if budget_config and remaining_budget < 0:
            grace_period_days = budget_config["grace_period_days"]
            # Find when budget was exceeded
            # This is a simplified calculation - in practice, you'd track when the limit was hit
            billing_period = self.get_current_billing_period(tenant_id)
            days_in_period = (datetime.utcnow() - billing_period["start"]).days + 1
            in_grace_period = days_in_period <= grace_period_days

        # Determine if request should be allowed based on enforcement
        request_allowed = self._should_allow_request(
            tenant_id, spend_info, budget_config, in_grace_period
        )

        return {
            "tenant_id": tenant_id,
            "budget_utilization": utilization,
            "remaining_budget": remaining_budget,
            "is_over_budget": remaining_budget < 0,
            "alert_level": alert_level,
            "in_grace_period": in_grace_period,
            "request_allowed": request_allowed,
            "enforcement_reason": self._get_enforcement_reason(
                tenant_id, spend_info, budget_config, in_grace_period
            ),
            "next_billing_date": self.get_current_billing_period(tenant_id)["end"]
            + timedelta(microseconds=1),
        }

    def check_budget_alerts(self, tenant_id: str) -> List[Dict[str, Any]]:
        """
        Check for budget alerts and return active alerts.

        Args:
            tenant_id: Tenant ID

        Returns:
            List of active budget alerts
        """
        budget_status = self.check_budget_status(tenant_id)
        budget_config = self.get_tenant_budget(tenant_id)

        alerts = []

        # Check alert thresholds
        if budget_config:
            alert_thresholds = budget_config["alert_thresholds"]
            utilization = budget_status["budget_utilization"]

            for threshold in alert_thresholds:
                if utilization >= threshold:
                    alert_key = f"{tenant_id}_{threshold}"

                    # Check if we've already sent this alert recently
                    recent_alerts = [
                        alert
                        for alert in self._budget_alerts.get(tenant_id, [])
                        if (datetime.utcnow() - alert["timestamp"]).total_seconds()
                        < 3600  # 1 hour
                    ]

                    threshold_alerts = [
                        alert
                        for alert in recent_alerts
                        if alert.get("threshold") == threshold
                    ]

                    if not threshold_alerts:
                        # Create new alert
                        alert = {
                            "id": alert_key,
                            "tenant_id": tenant_id,
                            "type": "budget_threshold",
                            "threshold": threshold,
                            "current_utilization": utilization,
                            "severity": self._get_alert_severity(threshold),
                            "message": self._generate_alert_message(
                                tenant_id, threshold, utilization
                            ),
                            "timestamp": datetime.utcnow(),
                            "recommended_actions": self._get_recommended_actions(
                                threshold
                            ),
                        }

                        alerts.append(alert)
                        self._budget_alerts[tenant_id].append(alert)
                        self._alert_history.append(alert)

        # Check if over budget
        if budget_status["is_over_budget"] and not budget_status["in_grace_period"]:
            over_budget_alert = {
                "id": f"{tenant_id}_over_budget",
                "tenant_id": tenant_id,
                "type": "over_budget",
                "current_utilization": budget_status["budget_utilization"],
                "severity": "critical",
                "message": f"Budget exceeded by ${abs(budget_status['remaining_budget']):.2f}",
                "timestamp": datetime.utcnow(),
                "recommended_actions": [
                    "immediate_action_required",
                    "upgrade_plan",
                    "reduce_usage",
                ],
            }

            # Check if recently sent
            recent_over_budget = [
                alert
                for alert in self._budget_alerts.get(tenant_id, [])
                if (
                    alert["type"] == "over_budget"
                    and (datetime.utcnow() - alert["timestamp"]).total_seconds() < 1800
                )  # 30 minutes
            ]

            if not recent_over_budget:
                alerts.append(over_budget_alert)
                self._budget_alerts[tenant_id].append(over_budget_alert)
                self._alert_history.append(over_budget_alert)

        return alerts

    def update_tenant_preferences(
        self,
        tenant_id: str,
        preferences: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update tenant-specific budget preferences.

        Args:
            tenant_id: Tenant ID
            preferences: Preference settings

        Returns:
            Updated preferences
        """
        # Initialize preferences if not exists
        if tenant_id not in self._spending_policies:
            self._spending_policies[tenant_id] = {}

        # Update preferences
        self._spending_policies[tenant_id].update(preferences)
        self._spending_policies[tenant_id]["updated_at"] = datetime.utcnow()

        return self._spending_policies[tenant_id]

    def get_tenant_preferences(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get tenant-specific budget preferences.

        Args:
            tenant_id: Tenant ID

        Returns:
            Tenant preferences
        """
        return self._spending_policies.get(
            tenant_id,
            {
                "excluded_providers": [],
                "preferred_providers": [],
                "cost_optimization_enabled": True,
                "auto_budget_adjustment": False,
            },
        )

    def _should_allow_request(
        self,
        tenant_id: str,
        spend_info: Dict[str, Any],
        budget_config: Optional[Dict[str, Any]],
        in_grace_period: bool,
    ) -> bool:
        """Determine if a request should be allowed based on budget."""
        if self.enforcement_strictness == "soft":
            return True  # Always allow in soft mode

        if not budget_config:
            return True  # No budget configured, allow

        remaining_budget = spend_info["budget"]["remaining_budget"]

        if remaining_budget >= 0:
            return True  # Under budget, allow

        # Over budget scenarios
        if in_grace_period:
            return True  # In grace period, allow

        overage_policy = budget_config.get("overage_policy", "block")

        if overage_policy == "allow":
            return True
        elif overage_policy == "allow_with_surcharge":
            return True  # Could add surcharge logic here
        else:  # block
            if self.enforcement_strictness == "hard":
                return False
            elif self.enforcement_strictness == "medium":
                # Allow some overage but block excessive
                utilization = spend_info["budget"]["budget_utilization"]
                return utilization < 1.2  # Allow up to 20% overage

        return False

    def _get_enforcement_reason(
        self,
        tenant_id: str,
        spend_info: Dict[str, Any],
        budget_config: Optional[Dict[str, Any]],
        in_grace_period: bool,
    ) -> Optional[str]:
        """Get reason for budget enforcement decision."""
        if self.enforcement_strictness == "soft":
            return None

        remaining_budget = spend_info["budget"]["remaining_budget"]

        if remaining_budget >= 0:
            return None  # No enforcement needed

        if in_grace_period:
            return "within_grace_period"

        if not budget_config:
            return "no_budget_configured"

        overage_policy = budget_config.get("overage_policy", "block")
        return f"overage_policy_{overage_policy}"

    def _project_monthly_spend(self, tenant_id: str) -> float:
        """Project monthly spend based on current usage patterns."""
        # Get current billing period spend
        billing_period = self.get_current_billing_period(tenant_id)
        spend_info = self.get_tenant_spend(
            tenant_id,
            billing_period["start"],
            datetime.utcnow(),
        )

        days_elapsed = (datetime.utcnow() - billing_period["start"]).days + 1
        total_days = (billing_period["end"] - billing_period["start"]).days + 1

        if days_elapsed == 0:
            return 0.0

        # Simple linear projection
        daily_average = spend_info["spending"]["total_cost"] / days_elapsed
        projected_monthly = daily_average * total_days

        return projected_monthly

    def _get_alert_severity(self, threshold: float) -> str:
        """Get alert severity based on threshold."""
        if threshold >= 1.0:
            return "critical"
        elif threshold >= 0.9:
            return "high"
        elif threshold >= 0.8:
            return "medium"
        else:
            return "low"

    def _generate_alert_message(
        self, tenant_id: str, threshold: float, utilization: float
    ) -> str:
        """Generate alert message."""
        if threshold >= 1.0:
            return f"Budget exceeded: {utilization:.1%} used"
        elif threshold >= 0.9:
            return f"Budget warning: {utilization:.1%} used (approaching limit)"
        elif threshold >= 0.8:
            return f"Budget notice: {utilization:.1%} used"
        else:
            return f"Budget info: {utilization:.1%} used"

    def _get_recommended_actions(self, threshold: float) -> List[str]:
        """Get recommended actions based on threshold."""
        if threshold >= 1.0:
            return ["immediate_action_required", "upgrade_plan", "reduce_usage"]
        elif threshold >= 0.9:
            return ["monitor_closely", "consider_upgrade", "optimize_usage"]
        elif threshold >= 0.8:
            return ["monitor_usage", "cost_optimization"]
        else:
            return ["continue_monitoring"]

    def get_budget_summary(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get comprehensive budget summary for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Budget summary
        """
        spend_info = self.get_tenant_spend(tenant_id)
        budget_status = self.check_budget_status(tenant_id)
        preferences = self.get_tenant_preferences(tenant_id)
        alerts = self.check_budget_alerts(tenant_id)

        return {
            "tenant_id": tenant_id,
            "current_status": budget_status,
            "spending_analysis": spend_info,
            "preferences": preferences,
            "active_alerts": alerts,
            "recommendations": self.cost_tracker.get_cost_optimization_recommendations(
                tenant_id
            ),
            "generated_at": datetime.utcnow().isoformat(),
        }

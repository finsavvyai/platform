"""
Token Configuration.

This module provides comprehensive configuration management for token management,
cost tracking, and billing integration settings.
"""

import os
import json
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path

from pydantic import BaseModel, Field

from ..services.token.token_manager import ProviderType


class Currency(Enum):
    """Supported currencies."""

    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CAD = "CAD"
    AUD = "AUD"


class BillingCycle(Enum):
    """Billing cycles."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    USAGE_BASED = "usage_based"


@dataclass
class ProviderPricingConfig:
    """Pricing configuration for a provider."""

    provider: ProviderType
    model: str

    # Token pricing
    input_token_price: Decimal
    output_token_price: Decimal
    currency: Currency = Currency.USD

    # Context limits
    context_window: int
    max_output_tokens: int

    # Tier pricing (optional)
    tier_quantities: Optional[Dict[str, int]] = None
    tier_input_prices: Optional[Dict[str, Decimal]] = None
    tier_output_prices: Optional[Dict[str, Decimal]] = None

    # Additional costs
    request_fee: Optional[Decimal] = None
    function_calling_enabled: bool = True
    function_calling_fee: Optional[Decimal] = None
    vision_enabled: bool = False
    vision_fee: Optional[Decimal] = None

    # Effective dates
    effective_from: datetime = field(default_factory=datetime.now)
    effective_until: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "provider": self.provider.value,
            "currency": self.currency.value,
            "input_token_price": str(self.input_token_price),
            "output_token_price": str(self.output_token_price),
            "request_fee": str(self.request_fee) if self.request_fee else None,
            "function_calling_fee": str(self.function_calling_fee)
            if self.function_calling_fee
            else None,
            "vision_fee": str(self.vision_fee) if self.vision_fee else None,
            "effective_from": self.effective_from.isoformat(),
            "effective_until": self.effective_until.isoformat()
            if self.effective_until
            else None,
            "tier_input_prices": {k: str(v) for k, v in self.tier_input_prices.items()}
            if self.tier_input_prices
            else None,
            "tier_output_prices": {
                k: str(v) for k, v in self.tier_output_prices.items()
            }
            if self.tier_output_prices
            else None,
        }


@dataclass
class TokenQuotaConfig:
    """Token quota configuration."""

    tenant_id: str
    quota_type: str  # hourly, daily, weekly, monthly, yearly

    # Limits
    prompt_token_limit: Optional[int] = None
    completion_token_limit: Optional[int] = None
    total_token_limit: Optional[int] = None
    cost_limit: Optional[Decimal] = None

    # Settings
    enabled: bool = True
    warn_threshold: float = 0.8
    hard_limit: bool = True
    auto_renew: bool = False

    # Schedule
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    reset_day_of_month: int = 1  # For monthly quotas

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "cost_limit": str(self.cost_limit) if self.cost_limit else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
        }


@dataclass
class BudgetAlertConfig:
    """Budget alert configuration."""

    tenant_id: str

    # Alert thresholds
    warning_threshold: float = 0.8  # 80%
    critical_threshold: float = 0.95  # 95%

    # Notification settings
    email_enabled: bool = True
    email_recipients: List[str] = field(default_factory=list)
    slack_enabled: bool = False
    slack_webhook: Optional[str] = None
    webhook_enabled: bool = False
    webhook_urls: List[str] = field(default_factory=list)

    # Alert frequency
    cooldown_minutes: int = 60
    max_alerts_per_day: int = 10

    # Alert types
    budget_exceeded_enabled: bool = True
    usage_spike_enabled: bool = True
    cost_anomaly_enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class CostOptimizationConfig:
    """Cost optimization configuration."""

    enabled: bool = True
    strategy: str = "balanced"  # cost_first, balanced, performance_first

    # Provider preferences
    preferred_providers: List[ProviderType] = field(default_factory=list)
    avoided_providers: List[ProviderType] = field(default_factory=list)

    # Optimization settings
    max_cost_per_request: Optional[Decimal] = None
    max_response_time_ms: Optional[int] = None
    min_quality_score: float = 0.7

    # Caching settings
    caching_enabled: bool = True
    cache_ttl_seconds: int = 3600
    cache_hit_rate_threshold: float = 0.3

    # Batch optimization
    batch_processing_enabled: bool = True
    min_batch_size: int = 10
    batch_timeout_seconds: int = 30

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "preferred_providers": [p.value for p in self.preferred_providers],
            "avoided_providers": [p.value for p in self.avoided_providers],
            "max_cost_per_request": str(self.max_cost_per_request)
            if self.max_cost_per_request
            else None,
        }


@dataclass
class BillingConfig:
    """Billing configuration."""

    enabled: bool = True
    provider: str = "stripe"  # stripe, paypal, custom

    # Billing settings
    currency: Currency = Currency.USD
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    payment_terms_days: int = 30

    # Integration settings
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    webhook_secret: Optional[str] = None

    # Invoice settings
    auto_generate_invoices: bool = True
    invoice_template: str = "default"
    include_detailed_usage: bool = True
    include_cost_breakdown: bool = True

    # Tax settings
    tax_enabled: bool = True
    tax_rate: float = 0.0  # As decimal (e.g., 0.08 for 8%)
    tax_inclusive: bool = False

    # Late payment settings
    late_fee_enabled: bool = True
    late_fee_rate: float = 0.015  # 1.5% per month
    grace_period_days: int = 7

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "currency": self.currency.value,
            "billing_cycle": self.billing_cycle.value,
            "tax_rate": self.tax_rate,
            "late_fee_rate": self.late_fee_rate,
        }


class TokenConfig(BaseModel):
    """Main token management configuration."""

    # General settings
    enabled: bool = Field(default=True, description="Enable token management")
    default_currency: Currency = Field(
        default=Currency.USD, description="Default currency"
    )
    cost_precision: int = Field(default=6, description="Decimal precision for costs")

    # Provider pricing
    provider_pricing: List[ProviderPricingConfig] = Field(
        default_factory=list, description="Provider pricing configurations"
    )

    # Token quotas
    quotas: List[TokenQuotaConfig] = Field(
        default_factory=list, description="Token quota configurations"
    )

    # Budget alerts
    alerts: List[BudgetAlertConfig] = Field(
        default_factory=list, description="Budget alert configurations"
    )

    # Cost optimization
    optimization: CostOptimizationConfig = Field(
        default_factory=CostOptimizationConfig, description="Cost optimization settings"
    )

    # Billing
    billing: BillingConfig = Field(
        default_factory=BillingConfig, description="Billing configuration"
    )

    # Analytics and reporting
    analytics_retention_days: int = Field(
        default=90, description="Analytics retention period"
    )
    report_generation_enabled: bool = Field(
        default=True, description="Enable report generation"
    )
    monthly_report_day: int = Field(
        default=1, description="Day of month for monthly reports"
    )

    # Monitoring
    monitoring_enabled: bool = Field(default=True, description="Enable monitoring")
    metrics_collection_interval: int = Field(
        default=60, description="Metrics collection interval (seconds)"
    )

    # Security
    audit_logging_enabled: bool = Field(
        default=True, description="Enable audit logging"
    )
    data_encryption_enabled: bool = Field(
        default=True, description="Enable data encryption"
    )

    # Configuration metadata
    version: str = Field(default="1.0.0", description="Configuration version")
    last_updated: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )
    updated_by: Optional[str] = Field(default=None, description="Updated by")

    class Config:
        arbitrary_types_allowed = True
        use_enum_values = True


class TokenConfigManager:
    """Token configuration manager."""

    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager."""
        self.config_path = config_path or os.getenv(
            "TOKEN_CONFIG_PATH", "token_config.json"
        )
        self._config: Optional[TokenConfig] = None

    def load_config(self) -> TokenConfig:
        """Load configuration from file."""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    data = json.load(f)
                config = TokenConfig(**data)
            else:
                # Create default configuration
                config = self._create_default_config()
                self.save_config(config)

            return config

        except Exception as e:
            raise Exception(f"Failed to load token configuration: {e}")

    def save_config(self, config: TokenConfig) -> None:
        """Save configuration to file."""
        try:
            # Update metadata
            config.last_updated = datetime.now()

            # Ensure directory exists
            Path(self.config_path).parent.mkdir(parents=True, exist_ok=True)

            # Save to file
            with open(self.config_path, "w") as f:
                json.dump(config.dict(), f, indent=2, default=str)

        except Exception as e:
            raise Exception(f"Failed to save token configuration: {e}")

    def _create_default_config(self) -> TokenConfig:
        """Create default configuration."""
        # Default provider pricing
        default_pricing = [
            ProviderPricingConfig(
                provider=ProviderType.OPENAI,
                model="gpt-4",
                input_token_price=Decimal("0.03"),
                output_token_price=Decimal("0.06"),
                context_window=8192,
                max_output_tokens=4096,
            ),
            ProviderPricingConfig(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                input_token_price=Decimal("0.0015"),
                output_token_price=Decimal("0.002"),
                context_window=16384,
                max_output_tokens=4096,
            ),
            ProviderPricingConfig(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-opus-20240229",
                input_token_price=Decimal("0.015"),
                output_token_price=Decimal("0.075"),
                context_window=200000,
                max_output_tokens=4096,
            ),
            ProviderPricingConfig(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-sonnet-20240229",
                input_token_price=Decimal("0.003"),
                output_token_price=Decimal("0.015"),
                context_window=200000,
                max_output_tokens=4096,
            ),
        ]

        # Default quotas
        default_quotas = [
            TokenQuotaConfig(
                tenant_id="default",
                quota_type="monthly",
                total_token_limit=100000,
                cost_limit=Decimal("500"),
            ),
            TokenQuotaConfig(
                tenant_id="default",
                quota_type="daily",
                total_token_limit=5000,
                cost_limit=Decimal("25"),
            ),
        ]

        # Default alerts
        default_alerts = [
            BudgetAlertConfig(
                tenant_id="default",
                email_recipients=["admin@sdlc.cc"],
                cooldown_minutes=60,
            ),
        ]

        return TokenConfig(
            provider_pricing=default_pricing,
            quotas=default_quotas,
            alerts=default_alerts,
        )


# Global configuration instance
_config_manager: Optional[TokenConfigManager] = None


def get_config_manager(config_path: Optional[str] = None) -> TokenConfigManager:
    """Get global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = TokenConfigManager(config_path)
    return _config_manager


def get_token_config(config_path: Optional[str] = None) -> TokenConfig:
    """Get token configuration."""
    manager = get_config_manager(config_path)
    return manager.load_config()


# Environment variable configuration
def load_config_from_env() -> TokenConfig:
    """Load configuration from environment variables."""
    config = TokenConfig()

    # General settings
    config.enabled = os.getenv("TOKEN_MANAGEMENT_ENABLED", "true").lower() == "true"
    config.default_currency = Currency(os.getenv("DEFAULT_CURRENCY", "USD"))
    config.cost_precision = int(os.getenv("COST_PRECISION", "6"))

    # Redis settings
    os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Billing settings
    config.billing.enabled = os.getenv("BILLING_ENABLED", "true").lower() == "true"
    config.billing.provider = os.getenv("BILLING_PROVIDER", "stripe")
    config.billing.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
    config.billing.stripe_publishable_key = os.getenv("STRIPE_PUBLISHABLE_KEY")
    config.billing.webhook_secret = os.getenv("WEBHOOK_SECRET")

    # Notification settings
    config.billing.email_enabled = (
        os.getenv("BILLING_EMAIL_ENABLED", "true").lower() == "true"
    )

    smtp_server = os.getenv("SMTP_SERVER")
    if smtp_server:
        # Email settings are configured through environment variables
        pass

    # Monitoring settings
    config.monitoring_enabled = (
        os.getenv("MONITORING_ENABLED", "true").lower() == "true"
    )
    config.metrics_collection_interval = int(os.getenv("METRICS_INTERVAL", "60"))

    return config

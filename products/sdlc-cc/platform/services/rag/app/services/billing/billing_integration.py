"""
Billing Integration Service.

This module provides comprehensive billing integration capabilities for multi-tenant
LLM operations with support for multiple billing providers, automated invoicing,
usage-based billing, and financial reporting.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import uuid
import csv
import io

import redis.asyncio as redis
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BillingProvider(Enum):
    """Supported billing providers."""

    STRIPE = "stripe"
    CHARGEBEE = "chargebee"
    INVOICED = "invoiced"
    QUICKBOOKS = "quickbooks"
    XERO = "xero"
    CUSTOM = "custom"
    MANUAL = "manual"


class BillingCycle(Enum):
    """Billing cycles."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class InvoiceStatus(Enum):
    """Invoice status types."""

    DRAFT = "draft"
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(Enum):
    """Payment method types."""

    CREDIT_CARD = "credit_card"
    ACH_TRANSFER = "ach_transfer"
    WIRE_TRANSFER = "wire_transfer"
    CHECK = "check"
    CRYPTOCURRENCY = "cryptocurrency"
    STORED_CREDIT = "stored_credit"
    EXTERNAL_BILLING = "external_billing"


@dataclass
class BillingPlan:
    """Billing plan configuration."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    active: bool = True

    # Pricing model
    base_price: Decimal = field(default_factory=lambda: Decimal("0"))
    currency: str = "USD"
    billing_cycle: BillingCycle = BillingCycle.MONTHLY

    # Usage-based pricing
    price_per_token: Optional[Decimal] = None
    price_per_request: Optional[Decimal] = None
    price_per_minute: Optional[Decimal] = None
    included_tokens: Optional[int] = None
    included_requests: Optional[int] = None
    included_minutes: Optional[int] = None

    # Tiers
    pricing_tiers: List[Dict[str, Any]] = field(default_factory=list)

    # Billing rules
    billing_day: int = 1  # Day of month for billing
    proration_enabled: bool = True
    late_fee_percentage: float = 0.0
    tax_inclusive: bool = False

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CustomerAccount:
    """Customer billing account."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    customer_id: str = ""  # External provider customer ID

    # Contact information
    name: str = ""
    email: str = ""
    phone: Optional[str] = None
    address: Optional[Dict[str, str]] = None

    # Billing information
    billing_plan_id: str = ""
    payment_method_id: Optional[str] = None
    payment_methods: List[Dict[str, Any]] = field(default_factory=list)
    default_payment_method: Optional[str] = None

    # Billing settings
    auto_pay_enabled: bool = True
    billing_email: str = ""
    cc_emails: List[str] = field(default_factory=list)
    purchase_order_required: bool = False
    credit_limit: Optional[Decimal] = None

    # Tax information
    tax_exempt: bool = False
    tax_id: Optional[str] = None
    tax_region: Optional[str] = None

    # Status
    status: str = "active"  # active, inactive, suspended
    balance: Decimal = field(default_factory=lambda: Decimal("0"))
    credit_balance: Decimal = field(default_factory=lambda: Decimal("0"))

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Invoice:
    """Invoice representation."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    customer_id: str = ""
    tenant_id: str = ""

    # Invoice details
    status: InvoiceStatus = InvoiceStatus.DRAFT
    currency: str = "USD"
    subtotal: Decimal = field(default_factory=lambda: Decimal("0"))
    tax_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    total_amount: Decimal = field(default_factory=lambda: Decimal("0"))
    amount_paid: Decimal = field(default_factory=lambda: Decimal("0"))
    amount_due: Decimal = field(default_factory=lambda: Decimal("0"))

    # Dates
    issue_date: date = field(default_factory=date.today)
    due_date: date = field(default_factory=lambda: date.today() + timedelta(days=30))
    paid_date: Optional[date] = None

    # Period covered
    period_start: date = field(default_factory=date.today)
    period_end: date = field(default_factory=date.today)

    # Line items
    line_items: List[Dict[str, Any]] = field(default_factory=list)

    # Additional information
    notes: str = ""
    terms: str = ""
    memo: str = ""
    purchase_order: Optional[str] = None

    # Payment information
    payment_url: Optional[str] = None
    payment_intent_id: Optional[str] = None

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InvoiceLineItem:
    """Invoice line item."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    description: str = ""
    quantity: int = 1
    unit_price: Decimal = field(default_factory=lambda: Decimal("0"))
    amount: Decimal = field(default_factory=lambda: Decimal("0"))

    # Item details
    item_type: str = ""  # subscription, usage, fee, credit
    item_reference: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None

    # Tax information
    taxable: bool = True
    tax_rate: float = 0.0
    tax_amount: Decimal = field(default_factory=lambda: Decimal("0"))

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Payment:
    """Payment record."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str = ""
    customer_id: str = ""
    tenant_id: str = ""

    # Payment details
    amount: Decimal = field(default_factory=lambda: Decimal("0"))
    currency: str = "USD"
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD
    status: str = "pending"  # pending, processing, succeeded, failed, refunded

    # Payment information
    transaction_id: Optional[str] = None
    gateway_response: Optional[Dict[str, Any]] = None
    failure_reason: Optional[str] = None

    # Dates
    created_at: datetime = field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)


class BillingMetrics(BaseModel):
    """Billing system metrics."""

    total_customers: int = 0
    active_subscriptions: int = 0
    monthly_recurring_revenue: Decimal = Field(default_factory=lambda: Decimal("0"))
    average_revenue_per_customer: Decimal = Field(default_factory=lambda: Decimal("0"))

    # Invoice metrics
    total_invoices: int = 0
    paid_invoices: int = 0
    overdue_invoices: int = 0
    total_outstanding: Decimal = Field(default_factory=lambda: Decimal("0"))

    # Usage metrics
    total_usage_billed: Decimal = Field(default_factory=lambda: Decimal("0"))
    total_usage_revenue: Decimal = Field(default_factory=lambda: Decimal("0"))

    # Period
    period_start: datetime = Field(default_factory=datetime.now)
    period_end: datetime = Field(default_factory=datetime.now)

    class Config:
        arbitrary_types_allowed = True


class BillingIntegration:
    """Comprehensive billing integration service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        provider: BillingProvider = BillingProvider.STRIPE,
        api_key: Optional[str] = None,
        webhook_secret: Optional[str] = None,
        default_currency: str = "USD",
        tax_calculation_enabled: bool = True,
        auto_invoicing_enabled: bool = True,
        auto_payment_enabled: bool = True,
        retention_days: int = 2555,  # 7 years
        invoice_prefix: str = "INV-",
    ):
        """Initialize billing integration."""
        self.redis_url = redis_url
        self.provider = provider
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        self.default_currency = default_currency
        self.tax_calculation_enabled = tax_calculation_enabled
        self.auto_invoicing_enabled = auto_invoicing_enabled
        self.auto_payment_enabled = auto_payment_enabled
        self.retention_days = retention_days
        self.invoice_prefix = invoice_prefix

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # Provider-specific clients
        self._stripe_client = None
        self._chargebee_client = None

        # In-memory caches
        self._billing_plans: Dict[str, BillingPlan] = {}
        self._customer_accounts: Dict[str, CustomerAccount] = {}

        # Background tasks
        self._invoicing_task: Optional[asyncio.Task] = None
        self._payment_task: Optional[asyncio.Task] = None
        self._reporting_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.CUSTOMERS_KEY_PREFIX = "billing:customers:"
        self.PLANS_KEY_PREFIX = "billing:plans:"
        self.INVOICES_KEY_PREFIX = "billing:invoices:"
        self.PAYMENTS_KEY_PREFIX = "billing:payments:"
        self.USAGE_KEY_PREFIX = "billing:usage:"
        self.METRICS_KEY_PREFIX = "billing:metrics:"

    async def initialize(self) -> None:
        """Initialize the billing integration."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Initialize provider clients
            await self._initialize_provider_client()

            # Load default billing plans
            await self._load_default_plans()

            # Start background tasks
            if self.auto_invoicing_enabled:
                self._invoicing_task = asyncio.create_task(self._invoicing_loop())

            if self.auto_payment_enabled:
                self._payment_task = asyncio.create_task(
                    self._payment_processing_loop()
                )

            self._reporting_task = asyncio.create_task(self._reporting_loop())

            self._initialized = True
            logger.info("Billing Integration initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Billing Integration: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up billing integration resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._invoicing_task:
                self._invoicing_task.cancel()
                try:
                    await self._invoicing_task
                except asyncio.CancelledError:
                    pass

            if self._payment_task:
                self._payment_task.cancel()
                try:
                    await self._payment_task
                except asyncio.CancelledError:
                    pass

            if self._reporting_task:
                self._reporting_task.cancel()
                try:
                    await self._reporting_task
                except asyncio.CancelledError:
                    pass

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Billing Integration cleaned up")

        except Exception as e:
            logger.error(f"Error during Billing Integration cleanup: {e}")

    async def create_billing_plan(self, plan: BillingPlan) -> str:
        """Create a new billing plan."""
        try:
            # Store plan
            plan_key = f"{self.PLANS_KEY_PREFIX}{plan.id}"
            plan_data = asdict(plan)
            plan_data["created_at"] = plan.created_at.isoformat()
            plan_data["updated_at"] = plan.updated_at.isoformat()

            for field in [
                "base_price",
                "price_per_token",
                "price_per_request",
                "price_per_minute",
            ]:
                if plan_data[field] is not None:
                    plan_data[field] = str(plan_data[field])

            await self._redis.hset(plan_key, mapping=plan_data)
            await self._redis.expire(plan_key, self.retention_days * 24 * 3600)

            # Update cache
            self._billing_plans[plan.id] = plan

            # Sync with provider if needed
            if self.provider == BillingProvider.STRIPE:
                await self._create_stripe_plan(plan)

            logger.info(f"Created billing plan '{plan.name}'")
            return plan.id

        except Exception as e:
            logger.error(f"Failed to create billing plan: {e}")
            raise

    async def create_customer_account(self, customer: CustomerAccount) -> str:
        """Create a new customer account."""
        try:
            # Generate customer ID if not provided
            if not customer.customer_id:
                customer.customer_id = (
                    f"cust_{customer.tenant_id}_{uuid.uuid4().hex[:8]}"
                )

            # Store customer
            customer_key = f"{self.CUSTOMERS_KEY_PREFIX}{customer.id}"
            customer_data = asdict(customer)
            customer_data["created_at"] = customer.created_at.isoformat()
            customer_data["updated_at"] = customer.updated_at.isoformat()

            for field in ["credit_limit", "balance", "credit_balance"]:
                if customer_data[field] is not None:
                    customer_data[field] = str(customer_data[field])

            await self._redis.hset(customer_key, mapping=customer_data)
            await self._redis.expire(customer_key, self.retention_days * 24 * 3600)

            # Update cache
            self._customer_accounts[customer.id] = customer

            # Create customer in provider
            if self.provider == BillingProvider.STRIPE:
                customer.customer_id = await self._create_stripe_customer(customer)
                # Update stored customer ID
                await self._redis.hset(
                    customer_key, "customer_id", customer.customer_id
                )

            logger.info(f"Created customer account for tenant {customer.tenant_id}")
            return customer.id

        except Exception as e:
            logger.error(f"Failed to create customer account: {e}")
            raise

    async def record_usage(
        self,
        tenant_id: str,
        usage_data: Dict[str, Union[int, float, Decimal]],
        timestamp: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record usage for billing."""
        if not timestamp:
            timestamp = datetime.now()

        try:
            usage_key = (
                f"{self.USAGE_KEY_PREFIX}{tenant_id}:{timestamp.strftime('%Y-%m')}"
            )
            usage_record = {
                "timestamp": timestamp.isoformat(),
                "usage": usage_data,
                "metadata": metadata or {},
            }

            # Store usage
            await self._redis.lpush(usage_key, json.dumps(usage_record))
            await self._redis.expire(usage_key, self.retention_days * 24 * 3600)

        except Exception as e:
            logger.error(f"Failed to record usage: {e}")
            raise

    async def generate_invoice(
        self,
        tenant_id: str,
        period_start: date,
        period_end: date,
        due_date: Optional[date] = None,
        auto_send: bool = False,
    ) -> Invoice:
        """Generate an invoice for a tenant."""
        try:
            # Get customer account
            customer = await self._get_customer_by_tenant(tenant_id)
            if not customer:
                raise ValueError(f"Customer account not found for tenant {tenant_id}")

            # Get billing plan
            plan = self._billing_plans.get(customer.billing_plan_id)
            if not plan:
                raise ValueError(f"Billing plan not found for customer {customer.id}")

            # Create invoice
            invoice = Invoice(
                invoice_number=self._generate_invoice_number(),
                customer_id=customer.id,
                tenant_id=tenant_id,
                period_start=period_start,
                period_end=period_end,
                due_date=due_date or (period_end + timedelta(days=30)),
            )

            # Get usage for the period
            usage_records = await self._get_usage_for_period(
                tenant_id, period_start, period_end
            )

            # Add subscription line item
            if plan.base_price > 0:
                subscription_item = InvoiceLineItem(
                    description=f"{plan.name} - {period_start.strftime('%b %Y')}",
                    quantity=1,
                    unit_price=plan.base_price,
                    amount=plan.base_price,
                    item_type="subscription",
                    period_start=period_start,
                    period_end=period_end,
                )
                invoice.line_items.append(subscription_item)

            # Add usage-based line items
            total_usage = defaultdict(Decimal)
            for record in usage_records:
                usage = json.loads(record.decode())
                usage_data = usage.get("usage", {})

                for metric, value in usage_data.items():
                    if metric == "tokens" and plan.price_per_token:
                        total_usage["tokens"] += Decimal(str(value))
                    elif metric == "requests" and plan.price_per_request:
                        total_usage["requests"] += Decimal(str(value))
                    elif metric == "minutes" and plan.price_per_minute:
                        total_usage["minutes"] += Decimal(str(value))

            # Calculate usage charges
            for metric, total in total_usage.items():
                if metric == "tokens" and plan.price_per_token:
                    # Apply included tokens
                    included = plan.included_tokens or 0
                    billable = max(0, int(total) - included)
                    if billable > 0:
                        amount = Decimal(billable) * plan.price_per_token
                        usage_item = InvoiceLineItem(
                            description=f"Token usage - {billable:,} tokens",
                            quantity=billable,
                            unit_price=plan.price_per_token,
                            amount=amount,
                            item_type="usage",
                            period_start=period_start,
                            period_end=period_end,
                        )
                        invoice.line_items.append(usage_item)

                elif metric == "requests" and plan.price_per_request:
                    included = plan.included_requests or 0
                    billable = max(0, int(total) - included)
                    if billable > 0:
                        amount = Decimal(billable) * plan.price_per_request
                        usage_item = InvoiceLineItem(
                            description=f"API requests - {billable:,} requests",
                            quantity=billable,
                            unit_price=plan.price_per_request,
                            amount=amount,
                            item_type="usage",
                            period_start=period_start,
                            period_end=period_end,
                        )
                        invoice.line_items.append(usage_item)

            # Calculate totals
            invoice.subtotal = sum(item.amount for item in invoice.line_items)

            # Calculate tax
            if self.tax_calculation_enabled and not plan.tax_inclusive:
                invoice.tax_amount = await self._calculate_tax(invoice)
            elif plan.tax_inclusive:
                # Tax is included in subtotal
                pass

            invoice.total_amount = invoice.subtotal + invoice.tax_amount
            invoice.amount_due = invoice.total_amount - invoice.amount_paid

            # Store invoice
            await self._store_invoice(invoice)

            # Create invoice in provider
            if self.provider == BillingProvider.STRIPE:
                await self._create_stripe_invoice(invoice, customer)

            # Auto-send if enabled
            if auto_send:
                await self._send_invoice(invoice)

            logger.info(
                f"Generated invoice {invoice.invoice_number} for tenant {tenant_id}"
            )
            return invoice

        except Exception as e:
            logger.error(f"Failed to generate invoice: {e}")
            raise

    async def collect_payment(
        self, invoice_id: str, payment_method_id: Optional[str] = None
    ) -> Payment:
        """Collect payment for an invoice."""
        try:
            # Get invoice
            invoice = await self._get_invoice(invoice_id)
            if not invoice:
                raise ValueError(f"Invoice {invoice_id} not found")

            if invoice.status == InvoiceStatus.PAID:
                raise ValueError(f"Invoice {invoice_id} is already paid")

            # Get customer
            customer = self._customer_accounts.get(invoice.customer_id)
            if not customer:
                raise ValueError(f"Customer {invoice.customer_id} not found")

            # Create payment record
            payment = Payment(
                invoice_id=invoice_id,
                customer_id=customer.id,
                tenant_id=customer.tenant_id,
                amount=invoice.amount_due,
                payment_method=PaymentMethod.CREDIT_CARD,  # Default
            )

            # Process payment through provider
            if self.provider == BillingProvider.STRIPE:
                payment = await self._process_stripe_payment(invoice, customer, payment)

            # Update invoice status
            if payment.status == "succeeded":
                invoice.status = InvoiceStatus.PAID
                invoice.amount_paid += payment.amount
                invoice.amount_due = max(
                    Decimal("0"), invoice.amount_due - payment.amount
                )
                invoice.paid_date = date.today()
                await self._store_invoice(invoice)

            # Store payment
            await self._store_payment(payment)

            logger.info(f"Processed payment {payment.id} for invoice {invoice_id}")
            return payment

        except Exception as e:
            logger.error(f"Failed to collect payment: {e}")
            raise

    async def get_billing_metrics(
        self, tenant_id: Optional[str] = None, period: str = "monthly"
    ) -> BillingMetrics:
        """Get billing metrics."""
        try:
            # Calculate date range
            end_date = datetime.now()
            if period == "monthly":
                start_date = end_date - timedelta(days=30)
            elif period == "quarterly":
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=365)

            metrics = BillingMetrics(
                period_start=start_date,
                period_end=end_date,
            )

            # Get all invoices for the period
            invoices = await self._get_invoices_for_period(
                start_date.date(), end_date.date(), tenant_id
            )

            total_customers = set()
            total_mrr = Decimal("0")
            total_outstanding = Decimal("0")

            for invoice in invoices:
                if tenant_id and invoice.tenant_id != tenant_id:
                    continue

                total_customers.add(invoice.tenant_id)

                # Calculate MRR from subscription line items
                for item in invoice.line_items:
                    if item.item_type == "subscription":
                        # Assume monthly billing for MRR calculation
                        total_mrr += item.amount

                # Calculate outstanding amount
                if invoice.status in [
                    InvoiceStatus.PENDING,
                    InvoiceStatus.PROCESSING,
                    InvoiceStatus.OVERDUE,
                ]:
                    total_outstanding += invoice.amount_due

            metrics.total_customers = len(total_customers)
            metrics.active_subscriptions = len(
                [i for i in invoices if i.status == InvoiceStatus.PAID]
            )
            metrics.monthly_recurring_revenue = total_mrr
            metrics.average_revenue_per_customer = (
                total_mrr / len(total_customers)
                if total_customers > 0
                else Decimal("0")
            )
            metrics.total_invoices = len(invoices)
            metrics.paid_invoices = len(
                [i for i in invoices if i.status == InvoiceStatus.PAID]
            )
            metrics.overdue_invoices = len(
                [i for i in invoices if i.status == InvoiceStatus.OVERDUE]
            )
            metrics.total_outstanding = total_outstanding

            return metrics

        except Exception as e:
            logger.error(f"Failed to get billing metrics: {e}")
            return BillingMetrics()

    async def export_invoice_data(
        self,
        format: str = "csv",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tenant_id: Optional[str] = None,
    ) -> Union[str, bytes]:
        """Export invoice data."""
        try:
            if not start_date:
                start_date = date.today() - timedelta(days=30)
            if not end_date:
                end_date = date.today()

            invoices = await self._get_invoices_for_period(
                start_date, end_date, tenant_id
            )

            if format.lower() == "csv":
                output = io.StringIO()
                writer = csv.writer(output)

                # Write header
                writer.writerow(
                    [
                        "Invoice Number",
                        "Customer",
                        "Tenant ID",
                        "Issue Date",
                        "Due Date",
                        "Status",
                        "Subtotal",
                        "Tax",
                        "Total",
                        "Amount Paid",
                        "Amount Due",
                    ]
                )

                # Write data
                for invoice in invoices:
                    writer.writerow(
                        [
                            invoice.invoice_number,
                            invoice.customer_id,
                            invoice.tenant_id,
                            invoice.issue_date,
                            invoice.due_date,
                            invoice.status.value,
                            str(invoice.subtotal),
                            str(invoice.tax_amount),
                            str(invoice.total_amount),
                            str(invoice.amount_paid),
                            str(invoice.amount_due),
                        ]
                    )

                output.seek(0)
                return output.getvalue()

            else:
                # JSON format
                data = []
                for invoice in invoices:
                    data.append(
                        {
                            "invoice_number": invoice.invoice_number,
                            "customer_id": invoice.customer_id,
                            "tenant_id": invoice.tenant_id,
                            "issue_date": invoice.issue_date.isoformat(),
                            "due_date": invoice.due_date.isoformat(),
                            "status": invoice.status.value,
                            "subtotal": str(invoice.subtotal),
                            "tax_amount": str(invoice.tax_amount),
                            "total_amount": str(invoice.total_amount),
                            "amount_paid": str(invoice.amount_paid),
                            "amount_due": str(invoice.amount_due),
                            "line_items": [
                                {
                                    "description": item.description,
                                    "quantity": item.quantity,
                                    "unit_price": str(item.unit_price),
                                    "amount": str(item.amount),
                                    "item_type": item.item_type,
                                }
                                for item in invoice.line_items
                            ],
                        }
                    )

                return json.dumps(data, indent=2)

        except Exception as e:
            logger.error(f"Failed to export invoice data: {e}")
            raise

    async def _initialize_provider_client(self) -> None:
        """Initialize provider-specific client."""
        if self.provider == BillingProvider.STRIPE and self.api_key:
            import stripe

            self._stripe_client = stripe
            stripe.api_key = self.api_key

    async def _load_default_plans(self) -> None:
        """Load default billing plans."""
        try:
            # Free tier plan
            free_plan = BillingPlan(
                name="Free Tier",
                description="Free tier with limited usage",
                base_price=Decimal("0"),
                billing_cycle=BillingCycle.MONTHLY,
                included_tokens=10000,
                included_requests=100,
                price_per_token=Decimal("0.002"),
                price_per_request=Decimal("0.01"),
            )
            await self.create_billing_plan(free_plan)

            # Starter plan
            starter_plan = BillingPlan(
                name="Starter",
                description="Starter plan for small teams",
                base_price=Decimal("29"),
                billing_cycle=BillingCycle.MONTHLY,
                included_tokens=100000,
                included_requests=1000,
                price_per_token=Decimal("0.0015"),
                price_per_request=Decimal("0.008"),
            )
            await self.create_billing_plan(starter_plan)

            # Professional plan
            pro_plan = BillingPlan(
                name="Professional",
                description="Professional plan for growing teams",
                base_price=Decimal("99"),
                billing_cycle=BillingCycle.MONTHLY,
                included_tokens=1000000,
                included_requests=10000,
                price_per_token=Decimal("0.001"),
                price_per_request=Decimal("0.005"),
            )
            await self.create_billing_plan(pro_plan)

            # Enterprise plan
            enterprise_plan = BillingPlan(
                name="Enterprise",
                description="Enterprise plan with unlimited usage",
                base_price=Decimal("499"),
                billing_cycle=BillingCycle.MONTHLY,
                price_per_token=Decimal("0.0008"),
                price_per_request=Decimal("0.003"),
            )
            await self.create_billing_plan(enterprise_plan)

        except Exception as e:
            logger.error(f"Failed to load default plans: {e}")

    async def _generate_invoice_number(self) -> str:
        """Generate unique invoice number."""
        timestamp = datetime.now().strftime("%Y%m")
        counter_key = f"{self.INVOICES_KEY_PREFIX}counter:{timestamp}"
        counter = await self._redis.incr(counter_key)
        await self._redis.expire(counter_key, 366 * 24 * 3600)  # 1 year

        return f"{self.invoice_prefix}{timestamp}-{counter:06d}"

    async def _get_customer_by_tenant(
        self, tenant_id: str
    ) -> Optional[CustomerAccount]:
        """Get customer account by tenant ID."""
        # Check cache first
        for customer in self._customer_accounts.values():
            if customer.tenant_id == tenant_id:
                return customer

        # Search in Redis
        pattern = f"{self.CUSTOMERS_KEY_PREFIX}*"
        keys = await self._redis.keys(pattern)

        for key in keys:
            customer_data = await self._redis.hgetall(key)
            if customer_data:
                customer_tenant_id = customer_data.get(b"tenant_id", b"").decode()
                if customer_tenant_id == tenant_id:
                    # Reconstruct customer object
                    customer = CustomerAccount(
                        id=key.decode().split(":")[-1],
                        tenant_id=customer_tenant_id,
                        customer_id=customer_data.get(b"customer_id", b"").decode(),
                        name=customer_data.get(b"name", b"").decode(),
                        email=customer_data.get(b"email", b"").decode(),
                        phone=customer_data.get(b"phone", b"").decode() or None,
                        billing_plan_id=customer_data.get(
                            b"billing_plan_id", b""
                        ).decode(),
                        status=customer_data.get(b"status", b"").decode(),
                        balance=Decimal(customer_data.get(b"balance", b"0").decode()),
                        created_at=datetime.fromisoformat(
                            customer_data.get(b"created_at", b"").decode()
                        ),
                    )
                    self._customer_accounts[customer.id] = customer
                    return customer

        return None

    async def _get_usage_for_period(
        self, tenant_id: str, period_start: date, period_end: date
    ) -> List[bytes]:
        """Get usage records for a period."""
        usage_records = []

        # Generate date range keys
        current = date(period_start.year, period_start.month, 1)
        end = date(period_end.year, period_end.month, 1)

        while current <= end:
            usage_key = (
                f"{self.USAGE_KEY_PREFIX}{tenant_id}:{current.strftime('%Y-%m')}"
            )
            records = await self._redis.lrange(usage_key, 0, -1)
            usage_records.extend(records)

            # Move to next month
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)

        # Filter by date range
        filtered_records = []
        for record in usage_records:
            try:
                usage_data = json.loads(record.decode())
                record_date = datetime.fromisoformat(usage_data["timestamp"]).date()
                if period_start <= record_date <= period_end:
                    filtered_records.append(record)
            except (json.JSONDecodeError, KeyError):
                continue

        return filtered_records

    async def _calculate_tax(self, invoice: Invoice) -> Decimal:
        """Calculate tax for an invoice."""
        # This would integrate with a tax calculation service
        # For now, return a simple tax calculation
        tax_rate = 0.08  # 8% tax rate
        return invoice.subtotal * Decimal(str(tax_rate))

    async def _store_invoice(self, invoice: Invoice) -> None:
        """Store invoice in Redis."""
        invoice_key = f"{self.INVOICES_KEY_PREFIX}{invoice.id}"
        invoice_data = asdict(invoice)

        # Convert dates
        for date_field in [
            "issue_date",
            "due_date",
            "paid_date",
            "period_start",
            "period_end",
        ]:
            if invoice_data[date_field]:
                if isinstance(invoice_data[date_field], date):
                    invoice_data[date_field] = invoice_data[date_field].isoformat()
                elif isinstance(invoice_data[date_field], datetime):
                    invoice_data[date_field] = invoice_data[date_field].isoformat()

        # Convert decimals
        for field in [
            "subtotal",
            "tax_amount",
            "total_amount",
            "amount_paid",
            "amount_due",
        ]:
            invoice_data[field] = str(invoice_data[field])

        # Convert status enum
        invoice_data["status"] = invoice.status.value

        # Convert line items
        line_items = []
        for item in invoice.line_items:
            item_data = asdict(item)
            for field in ["unit_price", "amount", "tax_amount"]:
                item_data[field] = str(item_data[field])
            if item_data.get("period_start"):
                item_data["period_start"] = item_data["period_start"].isoformat()
            if item_data.get("period_end"):
                item_data["period_end"] = item_data["period_end"].isoformat()
            line_items.append(item_data)
        invoice_data["line_items"] = json.dumps(line_items)

        # Convert timestamps
        invoice_data["created_at"] = invoice.created_at.isoformat()
        invoice_data["updated_at"] = invoice.updated_at.isoformat()

        await self._redis.hset(invoice_key, mapping=invoice_data)
        await self._redis.expire(invoice_key, self.retention_days * 24 * 3600)

    async def _store_payment(self, payment: Payment) -> None:
        """Store payment in Redis."""
        payment_key = f"{self.PAYMENTS_KEY_PREFIX}{payment.id}"
        payment_data = asdict(payment)

        # Convert decimals
        payment_data["amount"] = str(payment_data["amount"])

        # Convert timestamps
        payment_data["created_at"] = payment.created_at.isoformat()
        if payment_data["processed_at"]:
            payment_data["processed_at"] = payment_data["processed_at"].isoformat()

        await self._redis.hset(payment_key, mapping=payment_data)
        await self._redis.expire(payment_key, self.retention_days * 24 * 3600)

    async def _get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        """Get invoice by ID."""
        invoice_key = f"{self.INVOICES_KEY_PREFIX}{invoice_id}"
        invoice_data = await self._redis.hgetall(invoice_key)

        if invoice_data:
            # Reconstruct invoice object
            return Invoice(
                id=invoice_id,
                invoice_number=invoice_data.get(b"invoice_number", b"").decode(),
                customer_id=invoice_data.get(b"customer_id", b"").decode(),
                tenant_id=invoice_data.get(b"tenant_id", b"").decode(),
                status=InvoiceStatus(invoice_data.get(b"status", b"").decode()),
                currency=invoice_data.get(b"currency", b"").decode(),
                subtotal=Decimal(invoice_data.get(b"subtotal", b"0").decode()),
                tax_amount=Decimal(invoice_data.get(b"tax_amount", b"0").decode()),
                total_amount=Decimal(invoice_data.get(b"total_amount", b"0").decode()),
                amount_paid=Decimal(invoice_data.get(b"amount_paid", b"0").decode()),
                amount_due=Decimal(invoice_data.get(b"amount_due", b"0").decode()),
                issue_date=date.fromisoformat(
                    invoice_data.get(b"issue_date", b"").decode()
                ),
                due_date=date.fromisoformat(
                    invoice_data.get(b"due_date", b"").decode()
                ),
                paid_date=date.fromisoformat(
                    invoice_data.get(b"paid_date", b"").decode()
                )
                if invoice_data.get(b"paid_date")
                else None,
                period_start=date.fromisoformat(
                    invoice_data.get(b"period_start", b"").decode()
                ),
                period_end=date.fromisoformat(
                    invoice_data.get(b"period_end", b"").decode()
                ),
                notes=invoice_data.get(b"notes", b"").decode(),
                terms=invoice_data.get(b"terms", b"").decode(),
                created_at=datetime.fromisoformat(
                    invoice_data.get(b"created_at", b"").decode()
                ),
                line_items=json.loads(invoice_data.get(b"line_items", b"[]").decode()),
            )

        return None

    async def _get_invoices_for_period(
        self, start_date: date, end_date: date, tenant_id: Optional[str] = None
    ) -> List[Invoice]:
        """Get invoices for a period."""
        invoices = []

        # Scan all invoice keys
        pattern = f"{self.INVOICES_KEY_PREFIX}*"
        keys = await self._redis.keys(pattern)

        for key in keys:
            invoice = await self._get_invoice(key.decode().split(":")[-1])
            if invoice:
                # Filter by date range and tenant
                if start_date <= invoice.issue_date <= end_date:
                    if not tenant_id or invoice.tenant_id == tenant_id:
                        invoices.append(invoice)

        return invoices

    # Provider-specific methods (placeholders for actual implementation)
    async def _create_stripe_plan(self, plan: BillingPlan) -> None:
        """Create plan in Stripe."""
        # Implementation for Stripe plan creation
        pass

    async def _create_stripe_customer(self, customer: CustomerAccount) -> str:
        """Create customer in Stripe."""
        # Implementation for Stripe customer creation
        return f"cus_{uuid.uuid4().hex[:14]}"

    async def _create_stripe_invoice(
        self, invoice: Invoice, customer: CustomerAccount
    ) -> None:
        """Create invoice in Stripe."""
        # Implementation for Stripe invoice creation
        pass

    async def _process_stripe_payment(
        self, invoice: Invoice, customer: CustomerAccount, payment: Payment
    ) -> Payment:
        """Process payment through Stripe."""
        # Implementation for Stripe payment processing
        payment.status = "succeeded"
        payment.transaction_id = f"ch_{uuid.uuid4().hex[:14]}"
        payment.processed_at = datetime.now()
        return payment

    async def _send_invoice(self, invoice: Invoice) -> None:
        """Send invoice to customer."""
        # Implementation for invoice sending
        pass

    # Background tasks
    async def _invoicing_loop(self) -> None:
        """Background loop for automatic invoicing."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Check for tenants that need invoicing
                # Generate invoices for billing cycles
                # Send invoices

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in invoicing loop: {e}")

    async def _payment_processing_loop(self) -> None:
        """Background loop for payment processing."""
        while True:
            try:
                await asyncio.sleep(600)  # Run every 10 minutes

                # Process automatic payments
                # Handle payment failures
                # Send payment reminders

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in payment processing loop: {e}")

    async def _reporting_loop(self) -> None:
        """Background loop for reporting."""
        while True:
            try:
                await asyncio.sleep(86400)  # Run daily

                # Generate billing reports
                # Calculate metrics
                # Update dashboards

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in reporting loop: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()

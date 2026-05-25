"""
Billing and Subscription Database Models

Provides database models for subscriptions, invoices, usage records, and payment methods.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from decimal import Decimal

from app.core.database import Base


class Subscription(Base):
    """Subscription model for user subscriptions"""

    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    
    # Subscription details
    tier = Column(String(50), nullable=False, index=True)  # free, starter, professional, business, enterprise
    status = Column(String(50), nullable=False, default="trial", index=True)  # active, trial, past_due, canceled, unpaid
    billing_period = Column(String(20), nullable=False)  # monthly, yearly
    
    # Billing period
    current_period_start = Column(DateTime(timezone=True), nullable=False)
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)
    
    # Stripe integration
    stripe_subscription_id = Column(String(255), unique=True, nullable=True, index=True)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_price_id = Column(String(255), nullable=True)
    
    # Metadata (renamed to avoid SQLAlchemy reserved word conflict)
    meta_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="subscriptions")
    organization = relationship("Organization", backref="subscriptions")
    invoices = relationship("Invoice", back_populates="subscription", cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="subscription", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_subscriptions_user_status", "user_id", "status"),
        Index("idx_subscriptions_stripe", "stripe_subscription_id"),
    )


class Invoice(Base):
    """Invoice model for billing"""

    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False, index=True)
    
    # Invoice details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="usd", nullable=False)
    status = Column(String(50), nullable=False, default="pending", index=True)  # paid, pending, failed, refunded
    
    # Billing period
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Breakdown
    base_amount = Column(Numeric(10, 2), nullable=False)  # Subscription base price
    usage_charges = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)  # Overage charges
    tax_amount = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    
    # Stripe integration
    stripe_invoice_id = Column(String(255), unique=True, nullable=True, index=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    
    # Payment details
    paid_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata (renamed to avoid SQLAlchemy reserved word conflict)
    line_items = Column(JSONB, default=list)  # Detailed line items
    meta_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    subscription = relationship("Subscription", back_populates="invoices")

    __table_args__ = (
        Index("idx_invoices_subscription_status", "subscription_id", "status"),
        Index("idx_invoices_stripe", "stripe_invoice_id"),
        Index("idx_invoices_period", "period_start", "period_end"),
    )


class UsageRecord(Base):
    """Usage record for tracking usage metrics"""

    __tablename__ = "usage_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Usage details
    metric = Column(String(50), nullable=False, index=True)  # api_requests, workflow_executions, etc.
    quantity = Column(Integer, nullable=False, default=0)
    
    # Period
    period_start = Column(DateTime(timezone=True), nullable=False, index=True)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Metadata (renamed to avoid SQLAlchemy reserved word conflict)
    meta_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    subscription = relationship("Subscription", back_populates="usage_records")
    user = relationship("User", backref="usage_records")

    __table_args__ = (
        Index("idx_usage_subscription_metric", "subscription_id", "metric", "period_start"),
        Index("idx_usage_user_metric", "user_id", "metric", "period_start"),
    )


class PaymentMethod(Base):
    """Payment method model for storing customer payment methods"""

    __tablename__ = "payment_methods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    
    # Payment method details
    type = Column(String(50), nullable=False)  # card, bank_account, etc.
    is_default = Column(Boolean, default=False, nullable=False)
    
    # Stripe integration
    stripe_payment_method_id = Column(String(255), unique=True, nullable=False, index=True)
    stripe_customer_id = Column(String(255), nullable=False, index=True)
    
    # Card details (last 4 digits only for security)
    last4 = Column(String(4), nullable=True)
    brand = Column(String(50), nullable=True)  # visa, mastercard, etc.
    exp_month = Column(Integer, nullable=True)
    exp_year = Column(Integer, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Metadata (renamed to avoid SQLAlchemy reserved word conflict)
    meta_data = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="payment_methods")
    organization = relationship("Organization", backref="payment_methods")

    __table_args__ = (
        Index("idx_payment_methods_user_default", "user_id", "is_default"),
        Index("idx_payment_methods_stripe", "stripe_payment_method_id"),
    )


class BillingEvent(Base):
    """Billing event log for audit trail"""

    __tablename__ = "billing_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=True, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)  # subscription.created, invoice.paid, etc.
    event_source = Column(String(50), nullable=False)  # api, stripe_webhook, system
    description = Column(Text, nullable=True)
    
    # Event data
    event_data = Column(JSONB, default=dict)
    
    # Status
    status = Column(String(50), nullable=False, default="success")  # success, failed, pending
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    subscription = relationship("Subscription", backref="billing_events")
    invoice = relationship("Invoice", backref="billing_events")
    user = relationship("User", backref="billing_events")

    __table_args__ = (
        Index("idx_billing_events_type_created", "event_type", "created_at"),
        Index("idx_billing_events_user_created", "user_id", "created_at"),
    )


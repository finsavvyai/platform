"""Add billing and subscription tables

Revision ID: 002_add_billing_tables
Revises: 001
Create Date: 2025-01-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_billing_tables'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create billing and subscription tables"""
    
    # Subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tier', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='trial'),
        sa.Column('billing_period', sa.String(length=20), nullable=False),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('stripe_subscription_id', sa.String(length=255), nullable=True),
        sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
        sa.Column('stripe_price_id', sa.String(length=255), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subscriptions_id'), 'subscriptions', ['id'], unique=False)
    op.create_index(op.f('ix_subscriptions_user_id'), 'subscriptions', ['user_id'], unique=False)
    op.create_index(op.f('ix_subscriptions_organization_id'), 'subscriptions', ['organization_id'], unique=False)
    op.create_index(op.f('ix_subscriptions_tier'), 'subscriptions', ['tier'], unique=False)
    op.create_index(op.f('ix_subscriptions_status'), 'subscriptions', ['status'], unique=False)
    op.create_index(op.f('ix_subscriptions_stripe_subscription_id'), 'subscriptions', ['stripe_subscription_id'], unique=True)
    op.create_index('idx_subscriptions_user_status', 'subscriptions', ['user_id', 'status'], unique=False)
    
    # Invoices table
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='usd'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('base_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('usage_charges', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('discount_amount', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('stripe_invoice_id', sa.String(length=255), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(length=255), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('line_items', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoices_id'), 'invoices', ['id'], unique=False)
    op.create_index(op.f('ix_invoices_subscription_id'), 'invoices', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'], unique=False)
    op.create_index(op.f('ix_invoices_stripe_invoice_id'), 'invoices', ['stripe_invoice_id'], unique=True)
    op.create_index('idx_invoices_subscription_status', 'invoices', ['subscription_id', 'status'], unique=False)
    op.create_index('idx_invoices_period', 'invoices', ['period_start', 'period_end'], unique=False)
    
    # Usage records table
    op.create_table(
        'usage_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('metric', sa.String(length=50), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usage_records_id'), 'usage_records', ['id'], unique=False)
    op.create_index(op.f('ix_usage_records_subscription_id'), 'usage_records', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_usage_records_user_id'), 'usage_records', ['user_id'], unique=False)
    op.create_index(op.f('ix_usage_records_metric'), 'usage_records', ['metric'], unique=False)
    op.create_index(op.f('ix_usage_records_period_start'), 'usage_records', ['period_start'], unique=False)
    op.create_index('idx_usage_subscription_metric', 'usage_records', ['subscription_id', 'metric', 'period_start'], unique=False)
    op.create_index('idx_usage_user_metric', 'usage_records', ['user_id', 'metric', 'period_start'], unique=False)
    
    # Payment methods table
    op.create_table(
        'payment_methods',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('stripe_payment_method_id', sa.String(length=255), nullable=False),
        sa.Column('stripe_customer_id', sa.String(length=255), nullable=False),
        sa.Column('last4', sa.String(length=4), nullable=True),
        sa.Column('brand', sa.String(length=50), nullable=True),
        sa.Column('exp_month', sa.Integer(), nullable=True),
        sa.Column('exp_year', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_methods_id'), 'payment_methods', ['id'], unique=False)
    op.create_index(op.f('ix_payment_methods_user_id'), 'payment_methods', ['user_id'], unique=False)
    op.create_index(op.f('ix_payment_methods_organization_id'), 'payment_methods', ['organization_id'], unique=False)
    op.create_index(op.f('ix_payment_methods_stripe_payment_method_id'), 'payment_methods', ['stripe_payment_method_id'], unique=True)
    op.create_index('idx_payment_methods_user_default', 'payment_methods', ['user_id', 'is_default'], unique=False)
    
    # Billing events table
    op.create_table(
        'billing_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_source', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='success'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_billing_events_id'), 'billing_events', ['id'], unique=False)
    op.create_index(op.f('ix_billing_events_subscription_id'), 'billing_events', ['subscription_id'], unique=False)
    op.create_index(op.f('ix_billing_events_invoice_id'), 'billing_events', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_billing_events_user_id'), 'billing_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_billing_events_event_type'), 'billing_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_billing_events_created_at'), 'billing_events', ['created_at'], unique=False)
    op.create_index('idx_billing_events_type_created', 'billing_events', ['event_type', 'created_at'], unique=False)
    op.create_index('idx_billing_events_user_created', 'billing_events', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Drop billing and subscription tables"""
    op.drop_table('billing_events')
    op.drop_table('payment_methods')
    op.drop_table('usage_records')
    op.drop_table('invoices')
    op.drop_table('subscriptions')


"""Add referral fields to users

Revision ID: 010_add_referral_fields
Revises: 009_add_workflow_persistence_models
Create Date: 2025-02-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010_add_referral_fields'
down_revision = '009_add_workflow_persistence_models'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('referral_code', sa.String(32), nullable=True))
    conn = op.get_bind()
    referred_type = postgresql.UUID(as_uuid=True) if conn.dialect.name == 'postgresql' else sa.String(36)
    op.add_column('users', sa.Column('referred_by_id', referred_type, nullable=True))
    op.create_index('idx_users_referral_code', 'users', ['referral_code'], unique=True)
    op.create_foreign_key(
        'fk_users_referred_by', 'users', 'users',
        ['referred_by_id'], ['id'], ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_users_referred_by', 'users', type_='foreignkey')
    op.drop_index('idx_users_referral_code', table_name='users')
    op.drop_column('users', 'referred_by_id')
    op.drop_column('users', 'referral_code')

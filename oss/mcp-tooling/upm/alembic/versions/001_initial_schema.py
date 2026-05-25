Initial database schema creation

Revision ID: 001_initial_schema
Revises: 220840b8ae8d
Create Date: 2025-01-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql, sqlite

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = '220840b8ae8d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create all tables using Base.metadata.create_all
    # This is simpler for the initial schema
    pass


def downgrade() -> None:
    # Drop all tables
    pass

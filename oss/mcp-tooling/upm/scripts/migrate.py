# -----------------------------------------------------------------------------
# UPM Database Migration Helper Script
# -----------------------------------------------------------------------------
# Helper utilities for database migrations and data management
# -----------------------------------------------------------------------------

"""
UPM Database Migration Helpers

This module provides utility functions for database migrations,
data seeding, and schema management.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Optional

import alembic.config
import click
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine


def get_alembic_config() -> alembic.config.Config:
    """Get Alembic configuration."""
    config = alembic.config.Config()
    config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))
    config.set_main_option(
        "script_location",
        str(
            Path(__file__).parent.parent / "src" / "udp" / "infrastructure" / "alembic"
        ),
    )
    return config


@click.group()
def migrate():
    """Database migration commands."""
    pass


@migrate.command()
@click.option("--revision", "-r", default="head", help="Revision target")
def upgrade(revision: str):
    """Upgrade database to a specific revision."""
    click.echo(f"Upgrading database to {revision}...")
    config = get_alembic_config()

    from alembic import command

    command.upgrade(config, revision)
    click.echo("Upgrade complete!")


@migrate.command()
@click.option("--revision", "-r", default="-1", help="Revision target")
@click.confirmation_option(prompt="Are you sure you want to downgrade?")
def downgrade(revision: str):
    """Downgrade database to a specific revision."""
    click.echo(f"Downgrading database to {revision}...")
    config = get_alembic_config()

    from alembic import command

    command.downgrade(config, revision)
    click.echo("Downgrade complete!")


@migrate.command()
def current():
    """Show current revision."""
    config = get_alembic_config()

    from alembic import command

    command.current(config)


@migrate.command()
def history():
    """Show migration history."""
    config = get_alembic_config()

    from alembic import command

    command.history(config)


@migrate.command()
@click.option("--message", "-m", required=True, help="Migration message")
@click.option("--empty", is_flag=True, help="Create empty migration")
def create(message: str, empty: bool):
    """Create a new migration."""
    click.echo(f"Creating migration: {message}")
    config = get_alembic_config()

    from alembic import command

    command.revision(config, message=message, head="head", autogenerate=not empty)
    click.echo("Migration created!")


@migrate.command()
@click.option("--sql", is_flag=True, help="Output SQL instead of executing")
def stamp(sql: bool):
    """Set database version without running migrations."""
    config = get_alembic_config()

    from alembic import command

    if sql:
        click.echo("SQL output mode")
        command.stamp(config, "head", sql=True)
    else:
        command.stamp(config, "head")
        click.echo("Database stamped!")


@migrate.command()
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation")
def reset(yes: bool):
    """Reset database (create all tables from scratch)."""
    if not yes:
        if not click.confirm("This will DROP ALL TABLES. Are you sure?"):
            click.echo("Aborted.")
            return

    from sqlalchemy.ext.asyncio import create_async_engine

    from udp.core.config import get_settings
    from udp.infrastructure.database import Base

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)

    async def do_reset():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(do_reset())
    click.echo("Database reset complete!")


@migrate.command()
@click.option("--count", "-c", default=10, help="Number of projects to create")
def seed(count: int):
    """Seed database with sample data for testing."""
    click.echo(f"Seeding database with {count} sample projects...")

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from udp.core.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async def do_seed():
        async with async_session() as session:
            # Create test organization
            from udp.core.models import Organization

            org = Organization(
                name="Test Organization", slug="test-org", settings={"auto_scan": True}
            )
            session.add(org)
            await session.flush()

            # Create test projects
            from udp.core.models import Project, User

            ecosystems = ["maven", "npm", "pypi", "cargo", "go"]

            for i in range(count):
                ecosystem = ecosystems[i % len(ecosystems)]
                project = Project(
                    name=f"Test Project {i}",
                    description=f"Auto-generated test project {i}",
                    ecosystem=ecosystem,
                    repository_url=f"https://github.com/test/project-{i}",
                    organization_id=org.id,
                )
                session.add(project)

            await session.commit()

    asyncio.run(do_seed())
    click.echo(f"Seeding complete! Created {count} projects.")


@migrate.command()
def check():
    """Check database for issues."""
    click.echo("Checking database...")

    from sqlalchemy.ext.asyncio import create_async_engine

    from udp.core.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)

    async def do_check():
        async with engine.begin() as conn:
            # Check connection
            await conn.execute(text("SELECT 1"))
            click.echo("✓ Database connection OK")

            # Check tables exist
            result = await conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            )
            tables = [row[0] for row in result]
            click.echo(f"✓ Found {len(tables)} tables")

            # Check for missing indexes
            result = await conn.execute(
                text("""
                SELECT
                    schemaname,
                    tablename,
                    attname,
                    n_distinct
                FROM pg_stats
                WHERE schemaname = 'public'
                AND n_distinct > 100
                AND attname NOT IN (
                    SELECT unnest(string_to_string(
                        regexp_replace(
                            regexp_replace(indexdef, 'CREATE.*? USING \\(.*?\\(', ''),
                            '\\)', ''
                        ),
                        ', ', ','
                    ))
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                    AND tablename = pg_stats.tablename
                )
                ORDER BY n_distinct DESC
                LIMIT 10
            """)
            )

            missing_indexes = list(result)
            if missing_indexes:
                click.echo("⚠ Potential missing indexes:")
                for row in missing_indexes:
                    click.echo(f"  - {row[1]}.{row[2]} (distinct: {row[3]})")
            else:
                click.echo("✓ No obvious missing indexes")

            # Check table sizes
            result = await conn.execute(
                text("""
                SELECT
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
                FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10
            """)
            )

            click.echo("\nTable sizes:")
            for row in result:
                click.echo(f"  {row[1]}.{row[2]}: {row[3]}")

    asyncio.run(do_check())
    click.echo("Check complete!")


@migrate.command()
def vacuum():
    """Run VACUUM ANALYZE on all tables."""
    click.echo("Running VACUUM ANALYZE...")

    from sqlalchemy.ext.asyncio import create_async_engine

    from udp.core.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)

    async def do_vacuum():
        async with engine.begin() as conn:
            await conn.execute(text("VACUUM ANALYZE"))

    asyncio.run(do_vacuum())
    click.echo("VACUUM ANALYZE complete!")


@migrate.command()
@click.argument("table")
@click.option("--columns", "-c", help="Columns to analyze (comma-separated)")
def analyze(table: str, columns: Optional[str]):
    """Analyze a specific table for optimization opportunities."""
    click.echo(f"Analyzing table: {table}")

    from sqlalchemy.ext.asyncio import create_async_engine

    from udp.core.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)

    async def do_analyze():
        async with engine.begin() as conn:
            # Table statistics
            result = await conn.execute(
                text(f"""
                SELECT
                    pg_size_pretty(pg_total_relation_size('{table}')) AS total_size,
                    pg_size_pretty(pg_relation_size('{table}')) AS table_size,
                    pg_size_pretty(pg_total_relation_size('{table}') - pg_relation_size('{table}')) AS index_size
            """)
            )
            click.echo("\nTable Size:")
            for row in result:
                click.echo(f"  Total: {row[0]}, Table: {row[1]}, Indexes: {row[2]}")

            # Row count
            result = await conn.execute(
                text(f"""
                SELECT COUNT(*) FROM {table}
            """)
            )
            count = result.scalar()
            click.echo(f"\nRows: {count:,}")

            # Index usage
            result = await conn.execute(
                text(f"""
                SELECT
                    indexrelname,
                    idx_scan,
                    idx_tup_read,
                    idx_tup_fetch
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public'
                AND relname = '{table}'
                ORDER BY idx_scan DESC
            """)
            )

            click.echo("\nIndex Usage:")
            for row in result:
                click.echo(f"  {row[0]}: scans={row[1]}, read={row[2]}, fetch={row[3]}")

            # Missing indexes analysis
            if columns:
                col_list = columns.split(",")
                for col in col_list:
                    result = await conn.execute(
                        text(f"""
                        SELECT
                            n_distinct,
                            most_common_vals,
                            most_common_freqs
                        FROM pg_stats
                        WHERE tablename = '{table}'
                        AND attname = '{col}'
                    """)
                    )
                    stats = result.fetchone()
                    if stats:
                        click.echo(f"\nColumn '{col}':")
                        click.echo(f"  Distinct values: {stats[0]}")

    asyncio.run(do_analyze())
    click.echo("\nAnalysis complete!")


if __name__ == "__main__":
    # Add src directory to path
    src_path = Path(__file__).parent.parent / "src"
    sys.path.insert(0, str(src_path))

    migrate()

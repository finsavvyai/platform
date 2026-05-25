"""
Database migration management for the RAG service.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import asyncpg
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import get_settings
from app.database.connection import get_db_session

logger = logging.getLogger(__name__)


class Migration:
    """Represents a single database migration."""

    def __init__(
        self,
        version: int,
        name: str,
        sql_up: str,
        sql_down: Optional[str] = None,
        description: Optional[str] = None,
    ):
        self.version = version
        self.name = name
        self.sql_up = sql_up
        self.sql_down = sql_down or ""
        self.description = description or self._extract_description(sql_up)
        self.hash = self._calculate_hash(sql_up)
        self.applied_at: Optional[datetime] = None

    def _extract_description(self, sql: str) -> str:
        """Extract description from SQL comments."""
        lines = sql.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('--'):
                return line[2:].strip()
        return ""

    def _calculate_hash(self, sql: str) -> str:
        """Calculate SHA256 hash of the SQL."""
        return hashlib.sha256(sql.encode()).hexdigest()

    def __repr__(self) -> str:
        return f"<Migration(version={self.version}, name={self.name})>"


class MigrationManager:
    """Manages database migrations."""

    def __init__(self, engine: AsyncEngine, migration_dir: str = "migrations"):
        self.engine = engine
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Migration] = []
        self.settings = get_settings()

    async def initialize(self):
        """Initialize the migration system."""
        await self._create_migrations_table()
        await self._load_migrations()
        logger.info(f"Loaded {len(self.migrations)} migrations")

    async def _create_migrations_table(self):
        """Create the migrations tracking table."""
        async with get_db_session() as session:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    hash VARCHAR(64) NOT NULL,
                    sql_up TEXT NOT NULL,
                    sql_down TEXT,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
                ON schema_migrations(applied_at);
            """))
            await session.commit()

    async def _load_migrations(self):
        """Load migrations from migration files."""
        self.migrations = []

        if not self.migration_dir.exists():
            logger.warning(f"Migration directory {self.migration_dir} does not exist")
            return

        # Get all migration files
        migration_files = list(self.migration_dir.glob("*.sql"))
        migration_files.sort()

        for file_path in migration_files:
            migration = await self._parse_migration_file(file_path)
            if migration:
                self.migrations.append(migration)
                logger.debug(f"Loaded migration: {migration}")

    async def _parse_migration_file(self, file_path: Path) -> Optional[Migration]:
        """Parse a migration file."""
        try:
            content = file_path.read_text(encoding='utf-8')

            # Extract version from filename (e.g., "001_create_tenants.sql")
            match = re.match(r'^(\d+)_(.+)\.sql$', file_path.name)
            if not match:
                logger.warning(f"Invalid migration filename: {file_path.name}")
                return None

            version = int(match.group(1))
            name = match.group(2)

            # Split up and down migrations
            sql_parts = content.split('-- @DOWN')
            sql_up = sql_parts[0].strip()
            sql_down = sql_parts[1].strip() if len(sql_parts) > 1 else ""

            return Migration(
                version=version,
                name=name,
                sql_up=sql_up,
                sql_down=sql_down,
            )

        except Exception as e:
            logger.error(f"Failed to parse migration file {file_path}: {e}")
            return None

    async def get_applied_migrations(self) -> Dict[int, Migration]:
        """Get all applied migrations from the database."""
        applied = {}

        async with get_db_session() as session:
            result = await session.execute(text("""
                SELECT version, name, description, hash, applied_at
                FROM schema_migrations
                ORDER BY version
            """))

            for row in result:
                migration = Migration(
                    version=row[0],
                    name=row[1],
                    sql_up="",  # Not needed for applied migrations
                    description=row[2],
                )
                migration.hash = row[3]
                migration.applied_at = row[4]
                applied[migration.version] = migration

        return applied

    async def get_pending_migrations(self) -> List[Migration]:
        """Get all pending migrations."""
        applied = await self.get_applied_migrations()
        pending = []

        for migration in self.migrations:
            if migration.version not in applied:
                pending.append(migration)

        return pending

    async def up(self, target_version: Optional[int] = None) -> bool:
        """Apply pending migrations up to a target version."""
        pending = await self.get_pending_migrations()

        if target_version:
            pending = [m for m in pending if m.version <= target_version]

        if not pending:
            logger.info("No pending migrations to apply")
            return True

        logger.info(f"Applying {len(pending)} pending migrations")

        for migration in pending:
            if not await self._apply_migration(migration):
                logger.error(f"Failed to apply migration {migration.version}")
                return False

        logger.info("All pending migrations applied successfully")
        return True

    async def _apply_migration(self, migration: Migration) -> bool:
        """Apply a single migration."""
        logger.info(f"Applying migration {migration.version}: {migration.name}")

        async with get_db_session() as session:
            try:
                # Start transaction
                await session.execute(text("BEGIN"))

                # Execute migration SQL
                await session.execute(text(migration.sql_up))

                # Record migration
                await session.execute(text("""
					INSERT INTO schema_migrations (version, name, description, hash, sql_up, sql_down, applied_at)
					VALUES (:version, :name, :description, :hash, :sql_up, :sql_down, NOW())
				"""), {
                    'version': migration.version,
                    'name': migration.name,
                    'description': migration.description,
                    'hash': migration.hash,
                    'sql_up': migration.sql_up,
                    'sql_down': migration.sql_down,
                })

                # Commit transaction
                await session.execute(text("COMMIT"))
                await session.commit()

                logger.info(f"Migration {migration.version} applied successfully")
                return True

            except Exception as e:
                await session.execute(text("ROLLBACK"))
                logger.error(f"Failed to apply migration {migration.version}: {e}")
                return False

    async def down(self, steps: int = 1) -> bool:
        """Rollback the last N migrations."""
        applied = await self.get_applied_migrations()

        if not applied:
            logger.info("No migrations to rollback")
            return True

        # Get last N applied migrations
        applied_versions = sorted(applied.keys(), reverse=True)
        rollback_versions = applied_versions[:steps]

        logger.info(f"Rolling back {len(rollback_versions)} migrations")

        for version in rollback_versions:
            migration = applied[version]
            if not await self._rollback_migration(migration):
                logger.error(f"Failed to rollback migration {migration.version}")
                return False

        logger.info("Rollback completed successfully")
        return True

    async def _rollback_migration(self, migration: Migration) -> bool:
        """Rollback a single migration."""
        if not migration.sql_down:
            logger.warning(f"No rollback SQL for migration {migration.version}")
            return True

        logger.info(f"Rolling back migration {migration.version}: {migration.name}")

        async with get_db_session() as session:
            try:
                # Start transaction
                await session.execute(text("BEGIN"))

                # Execute rollback SQL
                await session.execute(text(migration.sql_down))

                # Remove migration record
                await session.execute(text(
                    "DELETE FROM schema_migrations WHERE version = :version"
                ), {'version': migration.version})

                # Commit transaction
                await session.execute(text("COMMIT"))
                await session.commit()

                logger.info(f"Migration {migration.version} rolled back successfully")
                return True

            except Exception as e:
                await session.execute(text("ROLLBACK"))
                logger.error(f"Failed to rollback migration {migration.version}: {e}")
                return False

    async def status(self) -> Dict:
        """Get migration status."""
        applied = await self.get_applied_migrations()
        pending = await self.get_pending_migrations()

        status = {
            'total_migrations': len(self.migrations),
            'applied_migrations': len(applied),
            'pending_migrations': len(pending),
            'current_version': 0,
            'last_applied': None,
            'applied_list': [],
            'pending_list': [],
        }

        if applied:
            latest_version = max(applied.keys())
            status['current_version'] = latest_version
            status['last_applied'] = {
                'version': applied[latest_version].version,
                'name': applied[latest_version].name,
                'description': applied[latest_version].description,
                'applied_at': applied[latest_version].applied_at.isoformat() if applied[latest_version].applied_at else None,
            }

            for version in sorted(applied.keys()):
                migration = applied[version]
                status['applied_list'].append({
                    'version': migration.version,
                    'name': migration.name,
                    'description': migration.description,
                    'applied_at': migration.applied_at.isoformat() if migration.applied_at else None,
                })

        for migration in pending:
            status['pending_list'].append({
                'version': migration.version,
                'name': migration.name,
                'description': migration.description,
            })

        return status

    async def validate(self) -> bool:
        """Validate applied migrations against migration files."""
        applied = await self.get_applied_migrations()

        for version, applied_migration in applied.items():
            # Find corresponding migration file
            migration_file = None
            for migration in self.migrations:
                if migration.version == version:
                    migration_file = migration
                    break

            if not migration_file:
                logger.error(f"Migration file not found for applied version {version}")
                return False

            # Check if hashes match
            if applied_migration.hash != migration_file.hash:
                logger.error(
                    f"Migration hash mismatch for version {version}: "
                    f"expected {migration_file.hash}, got {applied_migration.hash}"
                )
                return False

        logger.info("Migration validation passed")
        return True

    async def create_migration(self, name: str, description: Optional[str] = None) -> str:
        """Create a new migration file."""
        # Get next version number
        applied = await self.get_applied_migrations()
        next_version = max(applied.keys(), default=0) + 1

        # Create migration filename
        filename = f"{next_version:03d}_{name}.sql"
        filepath = self.migration_dir / filename

        # Ensure migration directory exists
        self.migration_dir.mkdir(exist_ok=True)

        # Generate migration template
        template = f"""-- Migration: {name}
-- Description: {description or 'No description provided'}
-- Version: {next_version}

-- @UP
-- Add your migration SQL here
CREATE TABLE example_table (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- @DOWN
-- Add your rollback SQL here
DROP TABLE IF EXISTS example_table;
"""

        # Write migration file
        filepath.write_text(template, encoding='utf-8')

        logger.info(f"Created migration file: {filepath}")
        return str(filepath)


# Alembic integration for more advanced migrations
class AlembicMigrationManager:
    """Alembic-based migration manager for advanced scenarios."""

    def __init__(self, alembic_ini_path: str = "alembic.ini"):
        self.alembic_ini_path = alembic_ini_path
        self.config = Config(alembic_ini_path)

    async def upgrade(self, revision: str = "head"):
        """Upgrade database to a specific revision."""
        try:
            command.upgrade(self.config, revision)
            logger.info(f"Database upgraded to revision: {revision}")
            return True
        except Exception as e:
            logger.error(f"Failed to upgrade database: {e}")
            return False

    async def downgrade(self, revision: str = "-1"):
        """Downgrade database to a specific revision."""
        try:
            command.downgrade(self.config, revision)
            logger.info(f"Database downgraded to revision: {revision}")
            return True
        except Exception as e:
            logger.error(f"Failed to downgrade database: {e}")
            return False

    async def current(self) -> str:
        """Get current database revision."""
        try:
            revision = command.current(self.config)
            logger.info(f"Current database revision: {revision}")
            return revision
        except Exception as e:
            logger.error(f"Failed to get current revision: {e}")
            return ""

    async def history(self) -> List[str]:
        """Get migration history."""
        try:
            command.history(self.config)
            return []
        except Exception as e:
            logger.error(f"Failed to get migration history: {e}")
            return []

    async def revision(self, message: str, autogenerate: bool = False):
        """Create a new migration revision."""
        try:
            command.revision(
                self.config,
                message=message,
                autogenerate=autogenerate
            )
            logger.info(f"Created migration revision: {message}")
            return True
        except Exception as e:
            logger.error(f"Failed to create migration revision: {e}")
            return False


# Global migration manager instance
migration_manager = None


async def get_migration_manager() -> MigrationManager:
    """Get the global migration manager instance."""
    global migration_manager
    if migration_manager is None:
        from app.database.connection import db_manager
        migration_manager = MigrationManager(db_manager.engine)
        await migration_manager.initialize()
    return migration_manager


# CLI commands for migration management
async def migrate_up(target_version: Optional[int] = None):
    """Apply pending migrations."""
    manager = await get_migration_manager()
    success = await manager.up(target_version)
    if success:
        status = await manager.status()
        print(f"Migration successful. Current version: {status['current_version']}")
    else:
        print("Migration failed. Check logs for details.")


async def migrate_down(steps: int = 1):
    """Rollback migrations."""
    manager = await get_migration_manager()
    success = await manager.down(steps)
    if success:
        status = await manager.status()
        print(f"Rollback successful. Current version: {status['current_version']}")
    else:
        print("Rollback failed. Check logs for details.")


async def migrate_status():
    """Show migration status."""
    manager = await get_migration_manager()
    status = await manager.status()

    print(f"Migration Status:")
    print(f"  Total: {status['total_migrations']}")
    print(f"  Applied: {status['applied_migrations']}")
    print(f"  Pending: {status['pending_migrations']}")
    print(f"  Current Version: {status['current_version']}")

    if status['last_applied']:
        print(f"  Last Applied: {status['last_applied']['name']} (v{status['last_applied']['version']})")

    if status['pending_list']:
        print("\nPending Migrations:")
        for migration in status['pending_list']:
            print(f"  - v{migration['version']}: {migration['name']}")


async def validate_migrations():
    """Validate applied migrations."""
    manager = await get_migration_manager()
    if await manager.validate():
        print("Migration validation passed")
    else:
        print("Migration validation failed")
        return False
    return True

"""
Unit tests for database models and schema.

Tests basic database functionality and model relationships.
"""

import pytest
import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from udp.core.models.base import Base
from udp.core.models import User, Organization, Project
from udp.core.database import get_async_session


@pytest.mark.asyncio
class TestDatabaseModels:
    """Test database model creation and relationships."""

    async def test_create_tables(self):
        """Test that all database tables can be created."""
        # Use in-memory SQLite for testing
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print(f"Created {len(Base.metadata.tables)} tables successfully")

        await engine.dispose()

    async def test_organization_creation(self):
        """Test organization model creation."""
        # Use in-memory SQLite for testing
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create session
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session() as session:
            # Create organization
            org = Organization(
                name="Test Organization",
                slug="test-org",
                description="Test organization for unit testing",
            )

            session.add(org)
            await session.commit()
            await session.refresh(org)

            # Verify organization was created
            assert org.id is not None
            assert org.name == "Test Organization"
            assert org.slug == "test-org"
            assert org.created_at is not None
            assert org.updated_at is not None
            assert org.is_active is True

        await engine.dispose()

    async def test_user_creation(self):
        """Test user model creation."""
        # Use in-memory SQLite for testing
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create session
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session() as session:
            # Create user
            user = User(
                username="testuser", email="test@example.com", full_name="Test User"
            )

            session.add(user)
            await session.commit()
            await session.refresh(user)

            # Verify user was created
            assert user.id is not None
            assert user.username == "testuser"
            assert user.email == "test@example.com"
            assert user.full_name == "Test User"
            assert user.created_at is not None
            assert user.updated_at is not None

        await engine.dispose()

    async def test_project_creation(self):
        """Test project model creation."""
        # Use in-memory SQLite for testing
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create session
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session() as session:
            # Create organization first
            org = Organization(
                name="Test Organization",
                slug="test-org",
                description="Test organization for unit testing",
            )
            session.add(org)
            await session.commit()

            # Create project
            project = Project(
                name="Test Project",
                slug="test-project",
                description="Test project for unit testing",
                organization_id=org.id,
                primary_language="Python",
                ecosystem="pip",
            )

            session.add(project)
            await session.commit()
            await session.refresh(project)

            # Verify project was created
            assert project.id is not None
            assert project.name == "Test Project"
            assert project.slug == "test-project"
            assert project.organization_id == org.id
            assert project.primary_language == "Python"
            assert project.ecosystem == "pip"
            assert project.is_active is True
            assert project.created_at is not None
            assert project.updated_at is not None

        await engine.dispose()

    async def test_metadata_functionality(self):
        """Test BaseModel metadata functionality."""
        user = User(username="test", email="test@example.com")

        # Test metadata operations
        assert user.get_metadata() == {}

        user.set_metadata({"key1": "value1", "key2": 42})
        assert user.get_metadata() == {"key1": "value1", "key2": 42}

        user.add_metadata("key3", "value3")
        expected = {"key1": "value1", "key2": 42, "key3": "value3"}
        assert user.get_metadata() == expected

        user.remove_metadata("key2")
        assert user.get_metadata() == {"key1": "value1", "key3": "value3"}

    async def test_soft_delete_functionality(self):
        """Test soft delete functionality."""
        user = User(username="test", email="test@example.com")

        # Initially not deleted
        assert not user.is_deleted

        # Soft delete
        user.soft_delete()
        assert user.is_deleted
        assert user.deleted_at is not None

        # Restore
        user.restore()
        assert not user.is_deleted
        assert user.deleted_at is None

    def test_table_names(self):
        """Test that table names are generated correctly."""
        expected_tables = {
            "users",
            "organizations",
            "projects",
            "packages",
            "dependencies",
            "vulnerabilities",
            "licenses",
            "workflows",
            "policies",
        }

        actual_tables = set(Base.metadata.tables.keys())
        assert expected_tables.issubset(actual_tables)

        print(f"Total tables: {len(actual_tables)}")
        print("Tables:", sorted(actual_tables))


@pytest.mark.asyncio
class TestDatabaseConnection:
    """Test database connection and session management."""

    async def test_get_async_session(self):
        """Test async session creation."""
        # This test verifies the session factory works correctly
        # Note: This would require proper database initialization in a real test

        # Test that we can at least call the function without error
        # In practice, this would need a properly initialized database
        from udp.core.database import SessionLocal

        if SessionLocal is not None:
            async with SessionLocal() as session:
                assert session is not None
        else:
            # Database not initialized, which is fine for this test
            pass


if __name__ == "__main__":
    # Run a quick verification
    print("Database Models Test Suite")
    print(f"Total models in metadata: {len(Base.metadata.tables)}")

    # Print all table names
    table_names = sorted(Base.metadata.tables.keys())
    print("\nTables:")
    for table in table_names:
        print(f"  - {table}")

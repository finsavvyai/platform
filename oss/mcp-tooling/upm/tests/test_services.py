"""
Comprehensive tests for UPM core service layer architecture.

Tests base service functionality, dependency injection,
error handling, and business logic services.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.exc import SQLAlchemyError

from src.udp.core.models import User, Organization, Project
from src.udp.core.services import (
    BaseService,
    BaseAsyncService,
    ServiceRegistry,
    UserService,
    OrganizationService,
    ProjectService,
    DependencyInjectionContainer,
    ServiceException,
    NotFoundError,
    ValidationError,
    ConflictError,
)
from src.udp.core.config import get_settings


@pytest.fixture
async def db_session():
    """Create test database session."""
    # Use in-memory SQLite for testing
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create all tables
    from src.udp.core.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async with AsyncSession(engine) as session:
        yield session

    # Cleanup
    await engine.dispose()


@pytest.fixture
def service_registry():
    """Create and clean service registry."""
    registry = ServiceRegistry()
    registry._services.clear()
    registry._factories.clear()
    return registry


class TestService(BaseService):
    """Test service class for testing base functionality."""

    model_class = Project  # Use Project as test model

    async def get_service_dependencies(self) -> dict:
        return {"dependency_service": "DependencyService"}


@pytest.mark.asyncio
class TestBaseService:
    """Test cases for BaseService functionality."""

    async def test_get_by_id_success(self, db_session):
        """Test successful entity retrieval by ID."""
        service = TestService(db_session)

        # Create a test project
        project = Project(name="Test Project", slug="test-project")
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        # Test retrieval
        result = await service.get_by_id(str(project.id))
        assert result.id == project.id
        assert result.name == project.name

    async def test_get_by_id_not_found(self, db_session):
        """Test entity not found error."""
        service = TestService(db_session)

        non_existent_id = str(uuid4())

        with pytest.raises(NotFoundError) as exc:
            await service.get_by_id(non_existent_id)

        assert "not found" in str(exc)

    async def test_get_by_id_invalid_uuid(self, db_session):
        """Test invalid UUID format."""
        service = TestService(db_session)

        with pytest.raises(ValidationError) as exc:
            await service.get_by_id("invalid-uuid")

        assert "Invalid UUID format" in str(exc)

    async def test_list_all_no_filters(self, db_session):
        """Test listing all entities without filters."""
        service = TestService(db_session)

        # Create multiple test projects
        for i in range(3):
            project = Project(name=f"Project {i}", slug=f"project-{i}")
            db_session.add(project)
        await db_session.commit()

        # Test listing
        results = await service.list_all()
        assert len(results) == 3

    async def test_list_all_with_filters(self, db_session):
        """Test listing entities with filters."""
        service = TestService(db_session)

        # Create test projects
        project1 = Project(name="Active Project", slug="active-project")
        project2 = Project(
            name="Inactive Project", slug="inactive-project", status="inactive"
        )
        project3 = Project(
            name="Test Project", slug="test-project", description="Test description"
        )

        for project in [project1, project2, project3]:
            db_session.add(project)
        await db_session.commit()

        # Test filtering by status
        active_results = await service.list_all(filters={"status": "active"})
        assert len(active_results) == 2

        # Test filtering by search term
        search_results = await service.list_all(filters={"search_term": "%Test%"})
        assert len(search_results) == 1

        # Test filtering by multiple criteria
        combined_results = await service.list_all(
            filters={"status": "active", "search_term": "%Project%"}
        )
        assert len(combined_results) == 1

    async def test_create_success(self, db_session):
        """Test successful entity creation."""
        service = TestService(db_session)

        data = {"name": "New Project", "slug": "new-project"}
        created_by = uuid4()

        result = await service.create(data, created_by)

        assert result.name == "New Project"
        assert result.slug == "new-project"
        assert result.created_by == created_by
        assert result.id is not None

    async def test_create_database_error(self, db_session):
        """Test database error during creation."""
        service = TestService(db_session)

        data = {"name": "Test Project", "slug": "test-project"}

        # Mock database session to raise error
        with patch.object(
            service.db_session, "add", side_effect=SQLAlchemyError("DB Error")
        ):
            with patch.object(
                service.db_session,
                "commit",
                side_effect=SQLAlchemyError("Commit Error"),
            ):
                with pytest.raises(ServiceException) as exc:
                    await service.create(data, uuid4())

                assert "Failed to create" in str(exc)
                assert "error_code" in exc.details

    async def test_update_success(self, db_session):
        """Test successful entity update."""
        service = TestService(db_session)

        # Create initial project
        project = Project(name="Original", slug="original")
        db_session.add(project)
        await db_session.commit()

        # Update project
        update_data = {"name": "Updated"}
        updated_by = uuid4()

        result = await service.update(str(project.id), update_data, updated_by)

        assert result.name == "Updated"
        assert result.updated_by == updated_by

    async def test_update_not_found(self, db_session):
        """Test update of non-existent entity."""
        service = TestService(db_session)

        non_existent_id = str(uuid4())
        update_data = {"name": "Updated"}

        with pytest.raises(NotFoundError) as exc:
            await service.update(non_existent_id, update_data, uuid4())

        assert "not found" in str(exc)

    async def test_delete_success(self, db_session):
        """Test successful entity soft delete."""
        service = TestService(db_session)

        # Create project to delete
        project = Project(name="To Delete", slug="to-delete")
        db_session.add(project)
        await db_session.commit()

        deleted_by = uuid4()

        result = await service.delete(str(project.id), deleted_by)

        assert result.deleted_at is not None
        assert result.updated_by == deleted_by

    async def test_delete_not_found(self, db_session):
        """Test delete of non-existent entity."""
        service = TestService(db_session)

        non_existent_id = str(uuid4())

        with pytest.raises(NotFoundError) as exc:
            await service.delete(non_existent_id, uuid4())

        assert "not found" in str(exc)

    async def test_count(self, db_session):
        """Test entity counting."""
        service = TestService(db_session)

        # Create test projects
        for i in range(3):
            project = Project(name=f"Project {i}", slug=f"project-{i}")
            db_session.add(project)

        # Create one inactive project
        inactive_project = Project(name="Inactive", slug="inactive", status="inactive")
        db_session.add(inactive_project)

        await db_session.commit()

        # Test count
        count = await service.count()
        assert count == 3  # Should only count active projects

        # Test count with filters
        search_count = await service.count(filters={"search_term": "%Project%"})
        assert search_count == 1

    async def test_exists(self, db_session):
        """Test entity existence check."""
        service = TestService(db_session)

        # Create test project
        project = Project(name="Test", slug="test")
        db_session.add(project)
        await db_session.commit()

        # Test existence
        exists = await service.exists(str(project.id))
        assert exists is True

        # Test non-existence
        non_existent = await service.exists(str(uuid4()))
        assert non_existent is False


@pytest.mark.asyncio
class TestUserService:
    """Test cases for UserService functionality."""

    async def test_create_user_success(self, db_session):
        """Test successful user creation."""
        service = UserService(db_session)

        user_data = {
            "email": "test@example.com",
            "username": "testuser",
            "password": "testpassword123",
            "name": "Test User",
        }

        user = await service.create_user(**user_data)

        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.name == "Test User"
        assert user.status == "pending"

    async def test_create_user_duplicate_email(self, db_session):
        """Test user creation with duplicate email."""
        service = UserService(db_session)

        # Create first user
        user1 = await service.create_user(
            email="test@example.com",
            username="user1",
            password="pass123",
            name="User 1",
        )

        # Try to create second user with same email
        with pytest.raises(ConflictError) as exc:
            await service.create_user(
                email="test@example.com",
                username="user2",
                password="pass123",
                name="User 2",
            )

        assert "already exists" in str(exc)

    async def test_authenticate_user_success(self, db_session):
        """Test successful user authentication."""
        service = UserService(db_session)

        # Create and activate user
        user_data = {
            "email": "auth@test.com",
            "username": "authuser",
            "password": "correctpass",
            "name": "Auth User",
        }
        user = await service.create_user(**user_data)
        user.status = "active"
        await db_session.commit()

        # Test authentication
        result = await service.authenticate_user("auth@test.com", "correctpass")
        assert result.email == "auth@test.com"
        assert result.last_login_at is not None

    async def test_authenticate_user_invalid_password(self, db_session):
        """Test authentication with invalid password."""
        service = UserService(db_session)

        # Create user
        user = await service.create_user(
            email="auth@test.com",
            username="authuser",
            password="correctpass",
            name="Auth User",
        )
        user.status = "active"
        await db_session.commit()

        # Test authentication
        with pytest.raises(ValidationError) as exc:
            await service.authenticate_user("auth@test.com", "wrongpass")

        assert "Invalid email or password" in str(exc)

    async def test_authenticate_user_not_found(self, db_session):
        """Test authentication with non-existent user."""
        service = UserService(db_session)

        with pytest.raises(ValidationError) as exc:
            await service.authenticate_user("nonexistent@test.com", "anypassword")

        assert "Invalid email or password" in str(exc)

    async def test_update_user_success(self, db_session):
        """Test successful user update."""
        service = UserService(db_session)

        # Create user
        user = await service.create_user(
            email="update@test.com",
            username="updateuser",
            password="pass123",
            name="Update User",
        )

        # Update user
        update_data = {"name": "Updated Name"}
        result = await service.update_user(str(user.id), update_data)

        assert result.name == "Updated Name"
        assert result.updated_by == user.id  # User updating themselves

    async def test_change_password_success(self, db_session):
        """Test successful password change."""
        service = UserService(db_session)

        # Create user
        user = await service.create_user(
            email="password@test.com",
            username="passworduser",
            password="oldpass",
            name="Password User",
        )

        # Change password
        new_password = await service.change_password(
            str(user.id), "oldpass", "newpass123"
        )

        # Verify new password works
        assert new_password.check_password("newpass123")
        assert new_password.updated_by == user.id


@pytest.mark.asyncio
class TestOrganizationService:
    """Test cases for OrganizationService functionality."""

    async def test_create_organization_success(self, db_session):
        """Test successful organization creation."""
        user_service = UserService(db_session)
        org_service = OrganizationService(db_session)

        # Create owner user
        owner = await user_service.create_user(
            email="owner@test.com",
            username="owner",
            password="pass123",
            name="Owner User",
        )
        owner.status = "active"
        await db_session.commit()

        # Create organization
        org_data = {
            "name": "Test Organization",
            "slug": "test-org",
            "owner_user_id": owner.id,
        }

        org = await org_service.create_organization(**org_data)

        assert org.name == "Test Organization"
        assert org.slug == "test-org"

        # Verify owner was added as member
        from src.udp.core.models.organization import OrganizationMember

        members = await db_session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org.id,
                OrganizationMember.user_id == owner.id,
            )
        )
        assert members.scalar_one_or_none() is not None

    async def test_create_organization_duplicate_slug(self, db_session):
        """Test organization creation with duplicate slug."""
        user_service = UserService(db_session)
        org_service = OrganizationService(db_session)

        owner = await user_service.create_user(
            email="owner@test.com",
            username="owner",
            password="pass123",
            name="Owner User",
        )
        owner.status = "active"
        await db_session.commit()

        # Create first organization
        await org_service.create_organization(
            name="First Org", slug="duplicate-slug", owner_user_id=owner.id
        )

        # Try to create second organization with same slug
        with pytest.raises(ConflictError) as exc:
            await org_service.create_organization(
                name="Second Org", slug="duplicate-slug", owner_user_id=owner.id
            )

        assert "already exists" in str(exc)

    async def test_add_member_success(self, db_session):
        """Test successful member addition."""
        user_service = UserService(db_session)
        org_service = OrganizationService(db_session)

        # Create organization and owner
        owner = await user_service.create_user(
            email="owner@test.com",
            username="owner",
            password="pass123",
            name="Owner User",
        )
        org = await org_service.create_organization(
            name="Test Org", slug="test-org", owner_user_id=owner.id
        )

        # Create new user
        new_user = await user_service.create_user(
            email="member@test.com",
            username="member",
            password="pass123",
            name="Member User",
        )

        # Add member
        member = await org_service.add_member(
            organization_id=str(org.id), user_id=str(new_user.id), role="member"
        )

        assert member.organization_id == org.id
        assert member.user_id == new_user.id
        assert member.role == "member"
        assert member.is_active is False

    async def test_has_permission_owner(self, db_session):
        """Test permission checking for organization owner."""
        user_service = UserService(db_session)
        org_service = OrganizationService(db_session)

        # Create organization with owner
        owner = await user_service.create_user(
            email="owner@test.com",
            username="owner",
            password="pass123",
            name="Owner User",
        )
        org = await org_service.create_organization(
            name="Owner Org", slug="owner-org", owner_user_id=owner.id
        )

        # Test permissions
        assert (
            await org_service.has_permission(str(org.id), str(owner.id), "manage_users")
            is True
        )
        assert (
            await org_service.has_permission(
                str(org.id), str(owner.id), "delete_organization"
            )
            is True
        )
        assert (
            await org_service.has_permission(
                str(org.id), str(owner.id), "nonexistent_permission"
            )
            is False
        )


@pytest.mark.asyncio
class TestDependencyInjection:
    """Test cases for dependency injection container."""

    async def test_service_registration(self, service_registry):
        """Test service registration."""

        # Register a test service
        service_registry.register(TestService)

        # Test retrieval
        service_class = service_registry.get_service_class(TestService)
        assert service_class == TestService

    async def test_service_factory_registration(self, service_registry):
        """Test service factory registration."""

        def create_service():
            return TestService()

        # Register factory
        service_registry.register_factory(TestService, create_service)

        # Test retrieval and instantiation
        service1 = service_registry.get(TestService)
        service2 = service_registry.get(TestService)

        assert service1 is not None
        assert service2 is not None
        assert service1 != service2  # Should create new instances

    async def test_service_not_registered(self, service_registry):
        """Test error when service not registered."""

        with pytest.raises(ServiceException) as exc:
            service_registry.get(NonExistentService)

        assert "not registered" in str(exc)

    async def test_clear_services(self, service_registry):
        """Test clearing all services."""

        # Register and get service
        service_registry.register(TestService)
        service1 = service_registry.get(TestService)

        # Clear services
        service_registry.clear()

        # Should recreate service
        service2 = service_registry.get(TestService)
        assert service2 is not None
        assert service1 != service2  # Should be new instance


@pytest.mark.asyncio
class TestServiceRegistry:
    """Test cases for ServiceRegistry."""

    async def test_register_services(self, service_registry):
        """Test service registration."""
        # Register test services
        from src.udp.services.user import UserService
        from src.udp.services.organization import OrganizationService

        service_registry.register("user_service", UserService)
        service_registry.register("organization_service", OrganizationService)
        service_registry.mark_initialized()

        # Test retrieval
        user_class = service_registry.get_service_class("user_service")
        org_class = service_registry.get_service_class("organization_service")

        assert user_class == UserService
        assert org_class == OrganizationService

    async def test_is_initialized(self, service_registry):
        """Test initialization status."""
        assert not service_registry.is_initialized()

        # Register and mark as initialized
        from src.udp.services.user import UserService

        service_registry.register("user_service", UserService)
        service_registry.mark_initialized()

        assert service_registry.is_initialized()

    async def test_list_services(self, service_registry):
        """Test listing all services."""
        from src.udp.services.user import UserService
        from src.udp.services.organization import OrganizationService

        # Register services
        service_registry.register("user_service", UserService)
        service_registry.register("organization_service", OrganizationService)
        service_registry.mark_initialized()

        # List services
        services = service_registry.list_services()

        assert len(services) == 2
        assert "user_service" in services
        assert "organization_service" in services


@pytest.mark.asyncio
async def test_service_dependency_resolution(db_session, service_registry):
    """Test service dependency resolution."""

    # Mock the _get_dependency method
    async def mock_get_dependency(service, interface):
        if interface.__name__ == "UserService":
            return UserService(db_session)
        elif interface.__name__ == "OrganizationService":
            return OrganizationService(db_session)
        else:
            return None

    with patch.object(
        BaseAsyncService, "_get_dependency", side_effect=mock_get_dependency
    ):
        # Create a service that has dependencies
        class DependentService(BaseAsyncService):
            model_class = Project

            async def get_service_dependencies(self):
                return {
                    "user_service": UserService,
                    "organization_service": OrganizationService,
                }

        service = DependentService(db_session)

        # Manually resolve dependencies
        user_service = await service._get_dependency(UserService)
        org_service = await service._get_dependency(OrganizationService)

        assert isinstance(user_service, UserService)
        assert isinstance(org_service, OrganizationService)

        # Dependencies should be stored as instance attributes
        assert hasattr(service, "_user_service_service")
        assert hasattr(service, "_organization_service_service")


if __name__ == "__main__":
    # Run tests directly for debugging
    import asyncio

    asyncio.run(pytest.main(["-v", __file__]))

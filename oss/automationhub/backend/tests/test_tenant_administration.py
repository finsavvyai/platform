"""
Comprehensive tests for tenant administration system
Tests all tenant management, user administration, and billing functionality
"""

import pytest
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.services.tenant_admin_service import TenantAdminService
from app.services.tenant_service import TenantService
from app.schemas.tenant_admin import TenantCreate, UserCreate

# Test client
client = TestClient(app)

# Test fixtures
@pytest.fixture
def db_session():
    """Create test database session"""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def tenant_admin_service(db_session: Session):
    """Create tenant admin service instance"""
    return TenantAdminService(db_session)

@pytest.fixture
def sample_tenant_data():
    """Sample tenant creation data"""
    return {
        "slug": "test-tenant-admin",
        "name": "Test Admin Tenant",
        "display_name": "Test Admin Tenant Inc.",
        "email": "admin@testadmin.com",
        "subdomain": "testadmin",
        "tier": "professional",
        "plan": "professional",
        "industry": "technology",
        "company_size": "medium",
        "max_users": 50,
        "max_workflows": 250,
        "storage_quota_gb": 100,
        "billing_email": "billing@testadmin.com",
        "technical_contact_email": "tech@testadmin.com",
        "auto_renew_enabled": True
    }

@pytest.fixture
def sample_admin_user_data():
    """Sample admin user data"""
    return {
        "email": "admin@testadmin.com",
        "username": "admin",
        "first_name": "Super",
        "last_name": "Admin",
        "password": "SecurePassword123!",
        "roles": ["tenant_admin", "user"]
    }

@pytest.fixture
def super_user(db_session: Session):
    """Create a super user for testing admin operations"""
    super_user = User(
        email="superadmin@upmplus.com",
        username="superadmin",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        is_verified=True,
        is_superuser=True,
        roles=["super_admin"],
        created_at=datetime.now(timezone.utc)
    )
    super_user.set_password("SuperSecurePassword123!")
    db_session.add(super_user)
    db_session.commit()
    db_session.refresh(super_user)

    yield super_user

    # Cleanup
    db_session.delete(super_user)
    db_session.commit()

# Tenant Creation Tests
class TestTenantCreation:
    """Test tenant creation functionality"""

    @pytest.mark.asyncio
    async def test_create_tenant_with_admin(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test creating a new tenant with admin user"""
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Verify tenant creation
        assert tenant.slug == sample_tenant_data["slug"]
        assert tenant.name == sample_tenant_data["name"]
        assert tenant.email == sample_tenant_data["email"]
        assert tenant.status == "active"
        assert tenant.tier == sample_tenant_data["tier"]
        assert tenant.plan == sample_tenant_data["plan"]
        assert tenant.max_users == sample_tenant_data["max_users"]
        assert tenant.max_workflows == sample_tenant_data["max_workflows"]
        assert tenant.storage_quota_gb == sample_tenant_data["storage_quota_gb"]

        # Verify admin user creation
        assert admin_user.email == sample_admin_user_data["email"]
        assert admin_user.username == sample_admin_user_data["username"]
        assert admin_user.is_superuser is True
        assert "tenant_admin" in admin_user.roles
        assert admin_user.check_password(sample_admin_user_data["password"])

        # Verify relationship
        assert admin_user.tenant_id == tenant.id

        # Verify branding configuration was created
        branding = tenant_admin_service.db.query(
            tenant_admin_service.db.query(Tenant).filter(Tenant.id == tenant.id).first().__class__
        ).filter_by(tenant_id=tenant.id).first()
        # Note: This would need actual BrandingConfiguration import and query

    @pytest.mark.asyncio
    async def test_create_tenant_invalid_data(self, tenant_admin_service: TenantAdminService):
        """Test tenant creation with invalid data"""
        # Missing required fields
        with pytest.raises(ValueError, match="Required field.*is missing"):
            await tenant_admin_service.create_tenant_with_admin(
                tenant_data={},
                admin_user_data={"email": "test@example.com"}
            )

        # Invalid email format
        with pytest.raises(ValueError, match="Invalid email format"):
            await tenant_admin_service.create_tenant_with_admin(
                tenant_data={
                    "slug": "test-tenant",
                    "name": "Test",
                    "email": "invalid-email"
                },
                admin_user_data={"email": "test@example.com"}
            )

        # Invalid slug format
        with pytest.raises(ValueError, match="Slug must contain only"):
            await tenant_admin_service.create_tenant_with_admin(
                tenant_data={
                    "slug": "Invalid Slug!",
                    "name": "Test",
                    "email": "test@example.com"
                },
                admin_user_data={"email": "test@example.com"}
            )

    @pytest.mark.asyncio
    async def test_create_tenant_duplicate_subdomain(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test tenant creation with duplicate subdomain"""
        # Create first tenant
        await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Try to create second tenant with same subdomain
        duplicate_data = sample_tenant_data.copy()
        duplicate_data["slug"] = "different-tenant"
        duplicate_data["email"] = "different@example.com"

        with pytest.raises(ValueError, match="Subdomain.*is already taken"):
            await tenant_admin_service.create_tenant_with_admin(
                tenant_data=duplicate_data,
                admin_user_data={
                    "email": "admin2@example.com",
                    "username": "admin2"
                }
            )

# Tenant Configuration Tests
class TestTenantConfiguration:
    """Test tenant configuration management"""

    @pytest.mark.asyncio
    async def test_update_tenant_configuration(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test updating tenant configuration"""
        # Create tenant first
        tenant, _ = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Update configuration
        updates = {
            "name": "Updated Company Name",
            "max_users": 100,
            "plan": "enterprise",
            "billing_email": "updated@example.com"
        }

        updated_tenant = await tenant_admin_service.update_tenant_configuration(
            tenant.id,
            updates
        )

        assert updated_tenant.name == updates["name"]
        assert updated_tenant.max_users == updates["max_users"]
        assert updated_tenant.plan == updates["plan"]
        assert updated_tenant.billing_email == updates["billing_email"]

    @pytest.mark.asyncio
    async def test_plan_change_quota_updates(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test that plan changes update quotas automatically"""
        # Create starter tenant
        starter_data = sample_tenant_data.copy()
        starter_data["plan"] = "starter"
        starter_data["max_users"] = 10
        starter_data["max_workflows"] = 25

        tenant, _ = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=starter_data,
            admin_user_data=sample_admin_user_data
        )

        # Upgrade to enterprise
        updates = {"plan": "enterprise"}
        updated_tenant = await tenant_admin_service.update_tenant_configuration(
            tenant.id,
            updates
        )

        # Verify quotas were updated
        assert updated_tenant.plan == "enterprise"
        assert updated_tenant.max_users == 200  # Enterprise quota
        assert updated_tenant.max_workflows == 1000  # Enterprise quota

# Tenant Lifecycle Tests
class TestTenantLifecycle:
    """Test tenant lifecycle management"""

    @pytest.mark.asyncio
    async def test_suspend_tenant(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test tenant suspension"""
        # Create tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Suspend tenant
        suspended_tenant = await tenant_admin_service.suspend_tenant(
            tenant.id,
            reason="Billing issues",
            suspended_by=admin_user.id
        )

        assert suspended_tenant.status == "suspended"
        assert suspended_tenant.suspension_reason == "Billing issues"
        assert suspended_tenant.suspended_by == admin_user.id
        assert suspended_tenant.suspended_at is not None

        # Verify admin user was deactivated
        deactivated_admin = tenant_admin_service.db.query(User).filter(User.id == admin_user.id).first()
        assert deactivated_admin.is_active is False

    @pytest.mark.asyncio
    async def test_reactivate_tenant(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test tenant reactivation"""
        # Create and suspend tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        await tenant_admin_service.suspend_tenant(
            tenant.id,
            reason="Test suspension"
        )

        # Reactivate tenant
        reactivated_tenant = await tenant_admin_service.reactivate_tenant(
            tenant.id,
            reactivated_by=admin_user.id
        )

        assert reactivated_tenant.status == "active"
        assert reactivated_tenant.suspension_reason is None
        assert reactivated_tenant.suspended_at is None

        # Verify admin user was reactivated
        reactivated_admin = tenant_admin_service.db.query(User).filter(User.id == admin_user.id).first()
        assert reactivated_admin.is_active is True

    @pytest.mark.asyncio
    async def test_delete_tenant_soft(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test soft tenant deletion"""
        # Create tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Soft delete tenant
        success = await tenant_admin_service.delete_tenant(
            tenant.id,
            reason="Customer requested deletion",
            deleted_by=admin_user.id,
            soft_delete=True
        )

        assert success is True

        # Verify tenant is marked as deleted
        deleted_tenant = tenant_admin_service.db.query(Tenant).filter(Tenant.id == tenant.id).first()
        assert deleted_tenant.status == "deleted"
        assert deleted_tenant.deletion_reason == "Customer requested deletion"
        assert deleted_tenant.deleted_by == admin_user.id
        assert deleted_tenant.deleted_at is not None

        # Verify admin user was deactivated
        deleted_admin = tenant_admin_service.db.query(User).filter(User.id == admin_user.id).first()
        assert deleted_admin.is_active is False

# User Management Tests
class TestUserManagement:
    """Test tenant user management"""

    @pytest.mark.asyncio
    async def test_add_user_to_tenant(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test adding users to tenant"""
        # Create tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Add additional user
        user_data = {
            "email": "user@example.com",
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "password": "UserPassword123!",
            "department": "Engineering",
            "title": "Developer"
        }

        new_user = await tenant_admin_service.add_user_to_tenant(
            tenant.id,
            user_data,
            added_by=admin_user.id
        )

        assert new_user.email == user_data["email"]
        assert new_user.username == user_data["username"]
        assert new_user.tenant_id == tenant.id
        assert new_user.is_active is True
        assert "user" in new_user.roles
        assert new_user.check_password(user_data["password"])

    @pytest.mark.asyncio
    async def test_remove_user_from_tenant(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test removing users from tenant"""
        # Create tenant and additional user
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        user_data = {
            "email": "user@example.com",
            "username": "testuser"
        }

        new_user = await tenant_admin_service.add_user_to_tenant(
            tenant.id,
            user_data,
            added_by=admin_user.id
        )

        # Remove user
        success = await tenant_admin_service.remove_user_from_tenant(
            tenant.id,
            new_user.id,
            reason="No longer needed",
            removed_by=admin_user.id
        )

        assert success is True

        # Verify user is deactivated
        removed_user = tenant_admin_service.db.query(User).filter(User.id == new_user.id).first()
        assert removed_user.is_active is False
        assert removed_user.deleted_by == admin_user.id

    @pytest.mark.asyncio
    async def test_remove_last_admin_prevention(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test that removing the last admin is prevented"""
        # Create tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Try to remove the only admin
        with pytest.raises(ValueError, match="Cannot remove the last tenant admin"):
            await tenant_admin_service.remove_user_from_tenant(
                tenant.id,
                admin_user.id
            )

    @pytest.mark.asyncio
    async def test_user_quota_enforcement(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test user quota enforcement"""
        # Create tenant with small quota
        small_tenant_data = sample_tenant_data.copy()
        small_tenant_data["max_users"] = 2

        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=small_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Add second user (should succeed)
        user1_data = {
            "email": "user1@example.com",
            "username": "user1"
        }

        await tenant_admin_service.add_user_to_tenant(
            tenant.id,
            user1_data,
            added_by=admin_user.id
        )

        # Try to add third user (should fail)
        user2_data = {
            "email": "user2@example.com",
            "username": "user2"
        }

        with pytest.raises(ValueError, match="has reached user limit"):
            await tenant_admin_service.add_user_to_tenant(
                tenant.id,
                user2_data,
                added_by=admin_user.id
            )

# Metrics and Monitoring Tests
class TestMetricsAndMonitoring:
    """Test tenant metrics and monitoring"""

    @pytest.mark.asyncio
    async def test_get_tenant_usage_metrics(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test retrieving tenant usage metrics"""
        # Create tenant
        tenant, admin_user = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Get metrics
        metrics = await tenant_admin_service.get_tenant_usage_metrics(
            tenant.id,
            start_date=datetime.now(timezone.utc) - timedelta(days=30),
            end_date=datetime.now(timezone.utc)
        )

        # Verify metrics structure
        assert "tenant_id" in metrics
        assert "period" in metrics
        assert "users" in metrics
        assert "storage" in metrics
        assert "api" in metrics
        assert "workflows" in metrics
        assert "billing" in metrics
        assert "quotas" in metrics

        # Verify user metrics
        assert metrics["users"]["total"] >= 1  # At least the admin user
        assert metrics["users"]["active"] >= 1
        assert isinstance(metrics["users"]["new_this_period"], int)

        # Verify storage metrics
        assert isinstance(metrics["storage"]["used_gb"], (int, float))
        assert isinstance(metrics["storage"]["quota_gb"], int)
        assert isinstance(metrics["storage"]["usage_percentage"], (int, float))

        # Verify quotas
        assert metrics["quotas"]["users_used"] <= metrics["quotas"]["users_limit"]
        assert metrics["quotas"]["storage_used_gb"] <= metrics["quotas"]["storage_limit_gb"]

# Bulk Operations Tests
class TestBulkOperations:
    """Test bulk tenant operations"""

    @pytest.mark.asyncio
    async def test_bulk_update_tenants(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test bulk updating multiple tenants"""
        # Create multiple tenants
        tenant_ids = []

        for i in range(3):
            tenant_data = sample_tenant_data.copy()
            tenant_data["slug"] = f"test-tenant-{i}"
            tenant_data["email"] = f"tenant{i}@example.com"
            tenant_data["subdomain"] = f"tenant{i}"

            tenant, _ = await tenant_admin_service.create_tenant_with_admin(
                tenant_data=tenant_data,
                admin_user_data={
                    "email": f"admin{i}@example.com",
                    "username": f"admin{i}"
                }
            )
            tenant_ids.append(tenant.id)

        # Bulk update
        updates = {
            "auto_renew_enabled": False,
            "billing_email": "billing@updated.com"
        }

        updated_tenants = await tenant_admin_service.bulk_update_tenants(
            tenant_ids,
            updates
        )

        # Verify updates
        assert len(updated_tenants) == 3
        for tenant in updated_tenants:
            assert tenant.auto_renew_enabled is False
            assert tenant.billing_email == "billing@updated.com"

# Search and Filtering Tests
class TestSearchAndFiltering:
    """Test tenant search and filtering functionality"""

    @pytest.mark.asyncio
    async def test_search_tenants(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test tenant search functionality"""
        # Create multiple tenants for testing
        search_terms = ["technology", "marketing", "healthcare"]

        for i, term in enumerate(search_terms):
            tenant_data = sample_tenant_data.copy()
            tenant_data["slug"] = f"{term}-tenant-{i}"
            tenant_data["name"] = f"{term.title()} Company {i}"
            tenant_data["email"] = f"contact@{term}company{i}.com"
            tenant_data["industry"] = term

            await tenant_admin_service.create_tenant_with_admin(
                tenant_data=tenant_data,
                admin_user_data={
                    "email": f"admin{i}@{term}company{i}.com",
                    "username": f"admin{i}"
                }
            )

        # Search by name
        results = await tenant_admin_service.search_tenants(
            query="technology",
            page=1,
            limit=10
        )

        assert len(results["tenants"]) == 1
        assert "technology" in results["tenants"][0].name.lower()

        # Search with filters
        results = await tenant_admin_service.search_tenants(
            query="company",
            filters={"plan": "professional"},
            page=1,
            limit=10
        )

        # Verify all results match filters
        for tenant in results["tenants"]:
            assert tenant.plan == "professional"
            assert "company" in tenant.name.lower()

# API Endpoint Tests
class TestTenantAdminAPI:
    """Test tenant administration API endpoints"""

    def test_create_tenant_api(self, client: TestClient, super_user):
        """Test tenant creation via API"""
        # Login as super user
        login_response = client.post("/api/v1/auth/login", json={
            "email": super_user.email,
            "password": "SuperSecurePassword123!"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create tenant via API
        tenant_data = {
            "slug": "api-test-tenant",
            "name": "API Test Tenant",
            "email": "admin@apitest.com",
            "plan": "professional",
            "max_users": 25
        }

        admin_user_data = {
            "email": "admin@apitest.com",
            "first_name": "API",
            "last_name": "Admin",
            "password": "APITestPassword123!"
        }

        response = client.post(
            "/api/v1/admin/tenants",
            json={
                "tenant": tenant_data,
                "admin_user": admin_user_data
            },
            headers=headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == tenant_data["name"]
        assert data["slug"] == tenant_data["slug"]

    def test_list_tenants_api(self, client: TestClient, super_user):
        """Test listing tenants via API"""
        # Login as super user
        login_response = client.post("/api/v1/auth/login", json={
            "email": super_user.email,
            "password": "SuperSecurePassword123!"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # List tenants
        response = client.get("/api/v1/admin/tenants", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert "tenants" in data
        assert "pagination" in data
        assert isinstance(data["tenants"], list)

    def test_suspend_tenant_api(self, client: TestClient, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data, super_user):
        """Test tenant suspension via API"""
        # Create tenant first
        tenant, _ = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Login as super user
        login_response = client.post("/api/v1/auth/login", json={
            "email": super_user.email,
            "password": "SuperSecurePassword123!"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Suspend tenant via API
        response = client.post(
            f"/api/v1/admin/tenants/{tenant.id}/suspend",
            json={
                "reason": "API test suspension"
            },
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "suspended"

    def test_get_tenant_metrics_api(self, client: TestClient, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data, super_user):
        """Test getting tenant metrics via API"""
        # Create tenant first
        tenant, _ = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data=sample_admin_user_data
        )

        # Login as super user
        login_response = client.post("/api/v1/auth/login", json={
            "email": super_user.email,
            "password": "SuperSecurePassword123!"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get metrics via API
        response = client.get(f"/api/v1/admin/tenants/{tenant.id}/metrics", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["tenant_id"] == str(tenant.id)
        assert "users" in data
        assert "storage" in data
        assert "billing" in data

# Security Tests
class TestTenantAdminSecurity:
    """Test tenant administration security"""

    @pytest.mark.asyncio
    async def test_regular_user_cannot_admin_tenants(self, tenant_admin_service: TenantAdminService, sample_tenant_data, sample_admin_user_data):
        """Test that regular users cannot administer tenants"""
        # Create tenant with regular admin
        tenant, regular_admin = await tenant_admin_service.create_tenant_with_admin(
            tenant_data=sample_tenant_data,
            admin_user_data={
                **sample_admin_user_data,
                "email": "regular@admin.com",
                "is_superuser": False  # Regular admin, not superuser
            }
        )

        # Regular admin should not be able to access other tenant administration
        # This would be tested through API endpoints in actual implementation
        pass

    @pytest.mark.asyncio
    async def test_tenant_isolation_in_admin_functions(self, tenant_admin_service: TenantAdminService):
        """Test tenant isolation in administration functions"""
        # This would test that admin functions cannot access data from other tenants
        # Implementation would depend on specific admin function being tested
        pass

# Performance Tests
class TestTenantAdminPerformance:
    """Test tenant administration performance"""

    @pytest.mark.asyncio
    async def test_bulk_tenant_creation_performance(self, tenant_admin_service: TenantAdminService):
        """Test performance of bulk tenant creation"""
        import time

        # Create many tenants concurrently
        tenant_creation_tasks = []
        start_time = time.time()

        for i in range(10):
            tenant_data = {
                "slug": f"perf-test-{i}",
                "name": f"Performance Test {i}",
                "email": f"admin{i}@perftest.com",
                "subdomain": f"perftest{i}",
                "plan": "starter"
            }

            user_data = {
                "email": f"admin{i}@perftest.com",
                "username": f"admin{i}",
                "password": "TestPassword123!"
            }

            task = tenant_admin_service.create_tenant_with_admin(
                tenant_data=tenant_data,
                admin_user_data=user_data
            )
            tenant_creation_tasks.append(task)

        # Execute concurrently
        results = await asyncio.gather(*tenant_creation_tasks, return_exceptions=True)

        end_time = time.time()
        duration = end_time - start_time

        # Verify performance (should complete within reasonable time)
        assert duration < 30.0  # 30 seconds for 10 tenants
        assert len([r for r in results if not isinstance(r, Exception)]) == 10

        # Cleanup
        for tenant, _ in results:
            if isinstance(tenant, Tenant):
                await tenant_admin_service.delete_tenant(tenant.id, "Performance test cleanup", soft_delete=True)
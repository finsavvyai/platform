"""
Comprehensive tests for branding and white-labeling system
Tests all branding functionality including themes, assets, and custom domains
"""

import pytest
import uuid
import tempfile
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.database import get_db
from app.models.tenant import Tenant
from app.models.branding import BrandingConfiguration, BrandAsset, EmailTemplate, ThemePreset, DomainVerification
from app.services.branding_service import BrandingService
from app.middleware.tenant import get_current_tenant_id, tenant_context

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
def test_tenant(db_session: Session):
    """Create test tenant"""
    tenant = Tenant(
        slug="test-tenant",
        name="Test Tenant",
        display_name="Test Tenant Inc.",
        email="test@tenant.com",
        subdomain="testtenant",
        status="active",
        tier="professional",
        plan="professional"
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    # Set tenant context for tests
    tenant_context.set(tenant)

    yield tenant

    # Cleanup
    db_session.delete(tenant)
    db_session.commit()

@pytest.fixture
def branding_service(db_session: Session):
    """Create branding service instance"""
    return BrandingService(db_session)

@pytest.fixture
def sample_branding_data():
    """Sample branding configuration data"""
    return {
        "theme_name": "modern-theme",
        "company_name": "Test Company",
        "tagline": "Innovating Tomorrow",
        "description": "A test company for demonstration",
        "primary_color": "#3B82F6",
        "secondary_color": "#10B981",
        "accent_color": "#F59E0B",
        "background_color": "#FFFFFF",
        "surface_color": "#F9FAFB",
        "text_color": "#1F2937",
        "text_secondary_color": "#6B7280",
        "error_color": "#EF4444",
        "warning_color": "#F59E0B",
        "success_color": "#10B981",
        "info_color": "#3B82F6",
        "font_family_primary": "Inter, sans-serif",
        "font_family_secondary": "Inter, sans-serif",
        "font_family_mono": "JetBrains Mono, monospace",
        "font_size_base": 16,
        "font_scale": 1.0,
        "border_radius": 8,
        "spacing": 8,
        "sidebar_width": 280,
        "sidebar_style": "sidebar",
        "header_height": 64,
        "layout_style": "default"
    }

@pytest.fixture
def sample_asset_data():
    """Sample brand asset data"""
    return {
        "asset_type": "logo",
        "name": "company-logo",
        "description": "Main company logo",
        "file_name": "logo.png",
        "file_path": "/assets/logos/logo.png",
        "file_url": "https://example.com/assets/logo.png",
        "file_size": 24576,
        "mime_type": "image/png",
        "width": 200,
        "height": 100,
        "alt_text": "Company Logo",
        "usage_context": "header"
    }

@pytest.fixture
def sample_email_template_data():
    """Sample email template data"""
    return {
        "template_type": "welcome",
        "name": "Welcome Email",
        "subject": "Welcome to {{company_name}}!",
        "html_content": "<h1>Welcome {{user_name}}!</h1><p>Thank you for joining {{company_name}}.</p>",
        "text_content": "Welcome {{user_name}}! Thank you for joining {{company_name}}.",
        "variables": {"company_name": "string", "user_name": "string"},
        "language": "en"
    }

# Branding Configuration Tests
class TestBrandingConfiguration:
    """Test branding configuration management"""

    @pytest.mark.asyncio
    async def test_create_branding_configuration(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test creating a new branding configuration"""
        branding = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        assert branding.tenant_id == test_tenant.id
        assert branding.theme_name == sample_branding_data["theme_name"]
        assert branding.company_name == sample_branding_data["company_name"]
        assert branding.primary_color == sample_branding_data["primary_color"]
        assert branding.is_active is True
        assert branding.is_default is True

    @pytest.mark.asyncio
    async def test_get_branding_configuration(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test retrieving branding configuration"""
        # Create configuration first
        created = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Retrieve configuration
        retrieved = await branding_service.get_configuration_by_tenant(test_tenant.id)

        assert retrieved.id == created.id
        assert retrieved.company_name == sample_branding_data["company_name"]
        assert retrieved.primary_color == sample_branding_data["primary_color"]

    @pytest.mark.asyncio
    async def test_update_branding_configuration(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test updating branding configuration"""
        # Create configuration first
        branding = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Update configuration
        updates = {
            "company_name": "Updated Company Name",
            "primary_color": "#FF0000",
            "custom_css": "body { background: #f0f0f0; }"
        }
        updated = await branding_service.update_configuration(branding.id, updates)

        assert updated.company_name == updates["company_name"]
        assert updated.primary_color == updates["primary_color"]
        assert updated.custom_css == updates["custom_css"]

    @pytest.mark.asyncio
    async def test_create_multiple_themes(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test creating multiple themes for a tenant"""
        # Create first theme (default)
        theme1 = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )
        assert theme1.is_default is True

        # Create second theme (non-default)
        theme2_data = sample_branding_data.copy()
        theme2_data["theme_name"] = "dark-theme"
        theme2_data["primary_color"] = "#000000"
        theme2_data["background_color"] = "#1a1a1a"

        theme2 = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **theme2_data
        )

        assert theme2.is_default is False
        assert theme2.theme_name == "dark-theme"

        # Verify tenant can have multiple themes
        themes = await branding_service.get_all_themes(test_tenant.id)
        assert len(themes) == 2

    @pytest.mark.asyncio
    async def test_switch_default_theme(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test switching default theme"""
        # Create first theme
        theme1 = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Create second theme
        theme2_data = sample_branding_data.copy()
        theme2_data["theme_name"] = "dark-theme"
        theme2 = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **theme2_data
        )

        # Switch default theme
        success = await branding_service.set_default_theme(test_tenant.id, theme2.id)
        assert success is True

        # Verify theme2 is now default and theme1 is not
        updated_theme1 = await branding_service.get_configuration_by_id(theme1.id)
        updated_theme2 = await branding_service.get_configuration_by_id(theme2.id)

        assert updated_theme1.is_default is False
        assert updated_theme2.is_default is True

# Brand Asset Tests
class TestBrandAssets:
    """Test brand asset management"""

    @pytest.mark.asyncio
    async def test_upload_brand_asset(self, branding_service: BrandingService, test_tenant: Tenant, sample_asset_data):
        """Test uploading a brand asset"""
        asset = await branding_service.upload_asset(
            tenant_id=test_tenant.id,
            **sample_asset_data
        )

        assert asset.tenant_id == test_tenant.id
        assert asset.asset_type == sample_asset_data["asset_type"]
        assert asset.name == sample_asset_data["name"]
        assert asset.file_size == sample_asset_data["file_size"]
        assert asset.is_active is True

    @pytest.mark.asyncio
    async def test_get_assets_by_type(self, branding_service: BrandingService, test_tenant: Tenant, sample_asset_data):
        """Test retrieving assets by type"""
        # Upload logo asset
        logo_data = sample_asset_data.copy()
        logo_data["asset_type"] = "logo"
        logo_data["name"] = "main-logo"
        await branding_service.upload_asset(tenant_id=test_tenant.id, **logo_data)

        # Upload favicon asset
        favicon_data = sample_asset_data.copy()
        favicon_data["asset_type"] = "favicon"
        favicon_data["name"] = "site-favicon"
        favicon_data["file_size"] = 1024
        await branding_service.upload_asset(tenant_id=test_tenant.id, **favicon_data)

        # Get logo assets
        logo_assets = await branding_service.get_assets_by_type(test_tenant.id, "logo")
        assert len(logo_assets) == 1
        assert logo_assets[0].asset_type == "logo"

        # Get favicon assets
        favicon_assets = await branding_service.get_assets_by_type(test_tenant.id, "favicon")
        assert len(favicon_assets) == 1
        assert favicon_assets[0].asset_type == "favicon"

    @pytest.mark.asyncio
    async def test_set_default_asset(self, branding_service: BrandingService, test_tenant: Tenant, sample_asset_data):
        """Test setting default asset for a type"""
        # Upload first logo
        logo1 = await branding_service.upload_asset(
            tenant_id=test_tenant.id,
            **sample_asset_data
        )

        # Upload second logo
        logo2_data = sample_asset_data.copy()
        logo2_data["name"] "alternative-logo"
        logo2_data["file_name"] = "logo-alt.png"
        logo2_data["file_path"] = "/assets/logos/logo-alt.png"
        logo2 = await branding_service.upload_asset(
            tenant_id=test_tenant.id,
            **logo2_data
        )

        # Set second logo as default
        success = await branding_service.set_default_asset(test_tenant.id, "logo", logo2.id)
        assert success is True

        # Verify default status
        assets = await branding_service.get_assets_by_type(test_tenant.id, "logo")
        default_assets = [a for a in assets if a.is_default]
        non_default_assets = [a for a in assets if not a.is_default]

        assert len(default_assets) == 1
        assert default_assets[0].id == logo2.id
        assert len(non_default_assets) == 1
        assert non_default_assets[0].id == logo1.id

    @pytest.mark.asyncio
    async def test_delete_asset(self, branding_service: BrandingService, test_tenant: Tenant, sample_asset_data):
        """Test deleting a brand asset"""
        # Upload asset
        asset = await branding_service.upload_asset(
            tenant_id=test_tenant.id,
            **sample_asset_data
        )

        # Delete asset
        success = await branding_service.delete_asset(test_tenant.id, asset.id)
        assert success is True

        # Verify asset is deleted (soft delete - marked as inactive)
        deleted_asset = await branding_service.get_asset_by_id(asset.id)
        assert deleted_asset.is_active is False

# Email Template Tests
class TestEmailTemplates:
    """Test email template management"""

    @pytest.mark.asyncio
    async def test_create_email_template(self, branding_service: BrandingService, test_tenant: Tenant, sample_email_template_data):
        """Test creating an email template"""
        template = await branding_service.create_email_template(
            tenant_id=test_tenant.id,
            **sample_email_template_data
        )

        assert template.tenant_id == test_tenant.id
        assert template.template_type == sample_email_template_data["template_type"]
        assert template.name == sample_email_template_data["name"]
        assert template.language == sample_email_template_data["language"]
        assert template.is_active is True
        assert template.version == 1

    @pytest.mark.asyncio
    async def test_render_email_template(self, branding_service: BrandingService, test_tenant: Tenant, sample_email_template_data):
        """Test rendering an email template with variables"""
        # Create template
        template = await branding_service.create_email_template(
            tenant_id=test_tenant.id,
            **sample_email_template_data
        )

        # Render template with variables
        variables = {
            "company_name": "Test Company",
            "user_name": "John Doe"
        }
        rendered = await branding_service.render_email_template(
            template_id=template.id,
            variables=variables
        )

        assert "Test Company" in rendered["html_content"]
        assert "John Doe" in rendered["html_content"]
        assert "Test Company" in rendered["text_content"]
        assert "John Doe" in rendered["text_content"]

    @pytest.mark.asyncio
    async def test_template_versioning(self, branding_service: BrandingService, test_tenant: Tenant, sample_email_template_data):
        """Test email template versioning"""
        # Create initial template
        template_v1 = await branding_service.create_email_template(
            tenant_id=test_tenant.id,
            **sample_email_template_data
        )
        assert template_v1.version == 1

        # Update template (should create new version)
        updates = {
            "subject": "Updated Welcome Subject",
            "html_content": "<h1>Updated Content</h1>"
        }
        template_v2 = await branding_service.update_email_template(
            template_id=template_v1.id,
            updates=updates
        )

        assert template_v2.version == 2
        assert template_v2.subject == updates["subject"]

        # Verify both versions exist
        all_versions = await branding_service.get_template_versions(
            test_tenant.id,
            sample_email_template_data["template_type"],
            sample_email_template_data["language"]
        )
        assert len(all_versions) == 2

    @pytest.mark.asyncio
    async def test_template_localization(self, branding_service: BrandingService, test_tenant: Tenant, sample_email_template_data):
        """Test email template localization"""
        # Create English template
        en_template = await branding_service.create_email_template(
            tenant_id=test_tenant.id,
            **sample_email_template_data
        )

        # Create Spanish template
        es_template_data = sample_email_template_data.copy()
        es_template_data["language"] = "es"
        es_template_data["subject"] = "¡Bienvenido a {{company_name}}!"
        es_template_data["html_content"] = "<h1>¡Bienvenido {{user_name}}!</h1><p>Gracias por unirte a {{company_name}}.</p>"
        es_template_data["text_content"] = "¡Bienvenido {{user_name}}! Gracias por unirte a {{company_name}}."

        es_template = await branding_service.create_email_template(
            tenant_id=test_tenant.id,
            **es_template_data
        )

        # Get templates for different languages
        en_retrieved = await branding_service.get_email_template(
            test_tenant.id,
            sample_email_template_data["template_type"],
            "en"
        )
        es_retrieved = await branding_service.get_email_template(
            test_tenant.id,
            sample_email_template_data["template_type"],
            "es"
        )

        assert en_retrieved.language == "en"
        assert es_retrieved.language == "es"
        assert "Welcome" in en_retrieved.subject
        assert "¡Bienvenido" in es_retrieved.subject

# Theme Preset Tests
class TestThemePresets:
    """Test theme preset management"""

    @pytest.mark.asyncio
    async def test_get_builtin_presets(self, branding_service: BrandingService):
        """Test retrieving built-in theme presets"""
        presets = await branding_service.get_builtin_presets()

        assert len(presets) > 0
        for preset in presets:
            assert preset.is_builtin is True
            assert preset.tenant_id is None
            assert preset.colors is not None
            assert preset.typography is not None

    @pytest.mark.asyncio
    async def test_create_custom_preset(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test creating a custom theme preset"""
        preset_data = {
            "name": "custom-theme",
            "display_name": "Custom Theme",
            "description": "A custom theme preset",
            "category": "custom",
            "colors": {
                "primary": "#FF0000",
                "secondary": "#00FF00",
                "accent": "#0000FF",
                "background": "#FFFFFF",
                "surface": "#F5F5F5"
            },
            "typography": {
                "font_family_primary": "Arial, sans-serif",
                "font_size_base": 16
            }
        }

        preset = await branding_service.create_custom_preset(
            tenant_id=test_tenant.id,
            **preset_data
        )

        assert preset.tenant_id == test_tenant.id
        assert preset.name == preset_data["name"]
        assert preset.is_builtin is False
        assert preset.category == "custom"

    @pytest.mark.asyncio
    async def test_apply_theme_preset(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test applying a theme preset to branding configuration"""
        # Create branding configuration
        branding = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Get a built-in preset
        presets = await branding_service.get_builtin_presets()
        preset = presets[0]

        # Apply preset
        updated_branding = await branding_service.apply_theme_preset(
            branding_id=branding.id,
            preset_id=preset.id
        )

        # Verify colors were updated
        assert updated_branding.primary_color == preset.colors["primary"]
        assert updated_branding.secondary_color == preset.colors["secondary"]
        assert updated_branding.font_family_primary == preset.typography["font_family_primary"]

# Domain Verification Tests
class TestDomainVerification:
    """Test custom domain verification"""

    @pytest.mark.asyncio
    async def test_initiate_domain_verification(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test initiating domain verification"""
        domain_data = {
            "domain": "custom.example.com",
            "verification_method": "dns"
        }

        verification = await branding_service.initiate_domain_verification(
            tenant_id=test_tenant.id,
            **domain_data
        )

        assert verification.tenant_id == test_tenant.id
        assert verification.domain == domain_data["domain"]
        assert verification.verification_method == domain_data["verification_method"]
        assert verification.verification_status == "pending"
        assert verification.verification_token is not None
        assert verification.dns_record_name is not None
        assert verification.dns_record_value is not None

    @pytest.mark.asyncio
    async def test_verify_domain_dns(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test DNS-based domain verification"""
        # Initiate verification
        verification = await branding_service.initiate_domain_verification(
            tenant_id=test_tenant.id,
            domain="test.example.com",
            verification_method="dns"
        )

        # Mock DNS lookup success
        with patch('dns.resolver.resolve') as mock_dns:
            mock_dns.return_value = [MockDNSRecord(verification.dns_record_value)]

            # Verify domain
            result = await branding_service.verify_domain(verification.id)

            assert result.verification_status == "verified"
            assert result.verified_at is not None

    @pytest.mark.asyncio
    async def test_ssl_certificate_management(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test SSL certificate management"""
        # Create verified domain
        verification = await branding_service.initiate_domain_verification(
            tenant_id=test_tenant.id,
            domain="secure.example.com",
            verification_method="dns"
        )

        # Mock verification success
        verification.verification_status = "verified"
        verification.verified_at = datetime.now(timezone.utc)

        # Mock SSL certificate issuance
        with patch('cryptography.x509.load_pem_x509_certificate') as mock_cert:
            mock_cert.return_value = MockSSLCertificate()

            # Issue SSL certificate
            result = await branding_service.issue_ssl_certificate(verification.id)

            assert result.ssl_enabled is True
            assert result.ssl_certificate is not None
            assert result.ssl_expires_at is not None

# API Endpoint Tests
class TestBrandingAPI:
    """Test branding API endpoints"""

    def test_create_branding_config_api(self, client: TestClient, test_tenant: Tenant, sample_branding_data):
        """Test creating branding configuration via API"""
        # Set tenant context in headers
        headers = {"X-Tenant-ID": str(test_tenant.id)}

        response = client.post(
            "/api/v1/branding/configuration",
            json=sample_branding_data,
            headers=headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["company_name"] == sample_branding_data["company_name"]
        assert data["primary_color"] == sample_branding_data["primary_color"]

    def test_get_branding_config_api(self, client: TestClient, test_tenant: Tenant, sample_branding_data):
        """Test retrieving branding configuration via API"""
        headers = {"X-Tenant-ID": str(test_tenant.id)}

        # Create configuration first
        client.post("/api/v1/branding/configuration", json=sample_branding_data, headers=headers)

        # Retrieve configuration
        response = client.get("/api/v1/branding/configuration", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["company_name"] == sample_branding_data["company_name"]

    def test_upload_asset_api(self, client: TestClient, test_tenant: Tenant):
        """Test uploading brand asset via API"""
        headers = {"X-Tenant-ID": str(test_tenant.id)}

        # Create a temporary file for testing
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
            tmp_file.write(b"fake png content")
            tmp_file_path = tmp_file.name

        try:
            with open(tmp_file_path, "rb") as f:
                files = {"file": ("logo.png", f, "image/png")}
                data = {
                    "asset_type": "logo",
                    "name": "company-logo",
                    "alt_text": "Company Logo"
                }

                response = client.post(
                    "/api/v1/branding/assets/upload",
                    files=files,
                    data=data,
                    headers=headers
                )

                assert response.status_code == 201
                result = response.json()
                assert result["asset_type"] == "logo"
                assert result["name"] == "company-logo"
        finally:
            os.unlink(tmp_file_path)

    def test_get_theme_presets_api(self, client: TestClient):
        """Test retrieving theme presets via API"""
        response = client.get("/api/v1/branding/theme-presets")

        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert all(preset["is_builtin"] for preset in data)

    def test_domain_verification_api(self, client: TestClient, test_tenant: Tenant):
        """Test domain verification via API"""
        headers = {"X-Tenant-ID": str(test_tenant.id)}

        domain_data = {
            "domain": "api-test.example.com",
            "verification_method": "dns"
        }

        response = client.post(
            "/api/v1/branding/domains/verify",
            json=domain_data,
            headers=headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["domain"] == domain_data["domain"]
        assert data["verification_status"] == "pending"
        assert "dns_record_name" in data
        assert "dns_record_value" in data

# Security Tests
class TestBrandingSecurity:
    """Test branding security and tenant isolation"""

    @pytest.mark.asyncio
    async def test_tenant_isolation_branding(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test that branding configurations are properly isolated by tenant"""
        # Create configuration for test tenant
        branding1 = await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Create another tenant
        tenant2 = Tenant(
            slug="test-tenant-2",
            name="Test Tenant 2",
            display_name="Test Tenant 2 Inc.",
            email="test2@tenant.com",
            subdomain="testtenant2",
            status="active",
            tier="professional",
            plan="professional"
        )
        branding_service.db.add(tenant2)
        branding_service.db.commit()
        branding_service.db.refresh(tenant2)

        try:
            # Create configuration for second tenant
            branding2 = await branding_service.create_configuration(
                tenant_id=tenant2.id,
                company_name="Different Company",
                primary_color="#FF0000"
            )

            # Verify isolation: each tenant should only see their own configuration
            config1 = await branding_service.get_configuration_by_tenant(test_tenant.id)
            config2 = await branding_service.get_configuration_by_tenant(tenant2.id)

            assert config1.id == branding1.id
            assert config1.company_name == sample_branding_data["company_name"]

            assert config2.id == branding2.id
            assert config2.company_name == "Different Company"
        finally:
            # Cleanup second tenant
            branding_service.db.delete(tenant2)
            branding_service.db.commit()

    @pytest.mark.asyncio
    async def test_asset_access_control(self, branding_service: BrandingService, test_tenant: Tenant, sample_asset_data):
        """Test that tenants can only access their own assets"""
        # Upload asset for test tenant
        asset = await branding_service.upload_asset(
            tenant_id=test_tenant.id,
            **sample_asset_data
        )

        # Create another tenant
        tenant2 = Tenant(
            slug="test-tenant-2",
            name="Test Tenant 2",
            display_name="Test Tenant 2 Inc.",
            email="test2@tenant.com",
            subdomain="testtenant2",
            status="active",
            tier="professional",
            plan="professional"
        )
        branding_service.db.add(tenant2)
        branding_service.db.commit()
        branding_service.db.refresh(tenant2)

        try:
            # Verify tenant2 cannot access tenant1's assets
            assets = await branding_service.get_assets_by_type(tenant2.id, "logo")
            assert len(assets) == 0  # Should be empty for tenant2

            # Verify tenant1 can access their assets
            tenant1_assets = await branding_service.get_assets_by_type(test_tenant.id, "logo")
            assert len(tenant1_assets) == 1
            assert tenant1_assets[0].id == asset.id
        finally:
            # Cleanup second tenant
            branding_service.db.delete(tenant2)
            branding_service.db.commit()

    @pytest.mark.asyncio
    async def test_input_validation_branding(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test input validation for branding operations"""
        # Test invalid color format
        with pytest.raises(ValueError, match="Invalid color format"):
            await branding_service.create_configuration(
                tenant_id=test_tenant.id,
                theme_name="test",
                company_name="Test",
                primary_color="invalid-color"  # Invalid color format
            )

        # Test invalid font size
        with pytest.raises(ValueError, match="Font size must be between"):
            await branding_service.create_configuration(
                tenant_id=test_tenant.id,
                theme_name="test",
                company_name="Test",
                primary_color="#FF0000",
                font_size_base=50  # Invalid font size
            )

        # Test invalid domain format
        with pytest.raises(ValueError, match="Invalid domain format"):
            await branding_service.initiate_domain_verification(
                tenant_id=test_tenant.id,
                domain="invalid..domain",  # Invalid domain format
                verification_method="dns"
            )

# Performance Tests
class TestBrandingPerformance:
    """Test branding system performance"""

    @pytest.mark.asyncio
    async def test_branding_config_cache(self, branding_service: BrandingService, test_tenant: Tenant, sample_branding_data):
        """Test branding configuration caching"""
        # Create configuration
        await branding_service.create_configuration(
            tenant_id=test_tenant.id,
            **sample_branding_data
        )

        # Test multiple retrievals (should hit cache after first)
        import time
        start_time = time.time()

        for _ in range(10):
            await branding_service.get_configuration_by_tenant(test_tenant.id)

        end_time = time.time()
        total_time = end_time - start_time

        # Should be fast due to caching (less than 1 second for 10 retrievals)
        assert total_time < 1.0

    @pytest.mark.asyncio
    async def test_bulk_asset_operations(self, branding_service: BrandingService, test_tenant: Tenant):
        """Test bulk asset operations performance"""
        # Upload multiple assets
        asset_data = {
            "asset_type": "icon",
            "name": "test-icon",
            "file_name": "icon.png",
            "file_path": "/assets/icons/icon.png",
            "file_size": 1024,
            "mime_type": "image/png"
        }

        start_time = time.time()

        # Upload 50 assets
        for i in range(50):
            asset_data["name"] = f"test-icon-{i}"
            asset_data["file_name"] = f"icon-{i}.png"
            asset_data["file_path"] = f"/assets/icons/icon-{i}.png"
            await branding_service.upload_asset(tenant_id=test_tenant.id, **asset_data)

        end_time = time.time()
        upload_time = end_time - start_time

        # Should complete uploads within reasonable time
        assert upload_time < 5.0

        # Test retrieval performance
        start_time = time.time()
        assets = await branding_service.get_assets_by_type(test_tenant.id, "icon")
        end_time = time.time()
        retrieval_time = end_time - start_time

        assert len(assets) == 50
        assert retrieval_time < 1.0

# Mock classes for testing
class MockDNSRecord:
    def __init__(self, value):
        self.value = value
        self.to_text = lambda: value

class MockSSLCertificate:
    def __init__(self):
        self.issuer = "Mock CA"
        self.not_valid_before = datetime.now(timezone.utc)
        self.not_valid_after = datetime.now(timezone.utc) + timedelta(days=90)
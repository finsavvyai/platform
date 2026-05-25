"""
Branding Service - Business logic for tenant branding and white-labeling
Handles custom branding, theme management, and white-labeling operations
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from fastapi import HTTPException, status, UploadFile
import uuid
import os
import json
import logging
import re
from PIL import Image
import io
import base64

from ..models.branding import TenantBrand, BrandAsset, EmailTemplate, ThemePreset, BrandElementType, BrandThemeType
from ..models.tenant import Tenant
from ..database import get_db
from ..core.config import settings

logger = logging.getLogger(__name__)

class BrandingService:
    """Service for managing tenant branding and white-labeling"""

    def __init__(self, db: Session):
        self.db = db
        self.asset_storage_path = getattr(settings, 'BRAND_ASSETS_PATH', '/app/static/brand-assets')
        self.allowed_image_types = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
        self.max_file_size = 10 * 1024 * 1024  # 10MB

    async def get_tenant_brand(self, tenant_id: uuid.UUID) -> Optional[TenantBrand]:
        """Get tenant's branding configuration"""
        return self.db.query(TenantBrand)\
            .options(joinedload(TenantBrand.brand_assets))\
            .options(joinedload(TenantBrand.email_templates))\
            .options(joinedload(TenantBrand.theme_presets))\
            .filter(TenantBrand.tenant_id == tenant_id)\
            .first()

    async def create_tenant_brand(
        self,
        tenant_id: uuid.UUID,
        branding_data: Dict[str, Any],
        created_by: Optional[uuid.UUID] = None
    ) -> TenantBrand:
        """Create tenant branding configuration"""

        # Check if branding already exists
        existing_brand = await self.get_tenant_brand(tenant_id)
        if existing_brand:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Branding configuration already exists for this tenant"
            )

        # Validate tenant exists
        tenant = self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        # Create branding configuration
        brand = TenantBrand(tenant_id=tenant_id, **branding_data)

        # Set default values for required fields
        if not brand.company_name:
            brand.company_name = tenant.display_name

        self.db.add(brand)
        self.db.commit()
        self.db.refresh(brand)

        logger.info(f"Created branding configuration for tenant {tenant_id}")
        return brand

    async def update_tenant_brand(
        self,
        tenant_id: uuid.UUID,
        update_data: Dict[str, Any],
        updated_by: Optional[uuid.UUID] = None
    ) -> TenantBrand:
        """Update tenant branding configuration"""

        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branding configuration not found"
            )

        # Validate color formats
        color_fields = [
            'primary_color', 'secondary_color', 'accent_color', 'text_color',
            'text_secondary_color', 'background_color', 'surface_color',
            'border_color', 'error_color', 'warning_color', 'success_color', 'info_color'
        ]

        for field in color_fields:
            if field in update_data and update_data[field]:
                if not re.match(r'^#[0-9A-Fa-f]{6}$', update_data[field]):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid color format for {field}"
                    )

        # Validate domain if provided
        if 'custom_domain' in update_data and update_data['custom_domain']:
            await self._validate_domain_availability(update_data['custom_domain'], tenant_id)

        # Update fields
        for key, value in update_data.items():
            if hasattr(brand, key):
                setattr(brand, key, value)

        brand.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(brand)

        logger.info(f"Updated branding configuration for tenant {tenant_id}")
        return brand

    async def get_branding_config(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Get complete branding configuration as JSON"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            # Return default branding if no custom branding exists
            return self._get_default_branding_config()

        return brand.get_branding_config()

    async def upload_brand_asset(
        self,
        tenant_id: uuid.UUID,
        asset_type: BrandElementType,
        file: UploadFile,
        name: Optional[str] = None,
        description: Optional[str] = None,
        is_primary: bool = False
    ) -> BrandAsset:
        """Upload brand asset (logo, favicon, etc.)"""

        # Validate file type
        if file.content_type not in self.allowed_image_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file.content_type} is not allowed"
            )

        # Validate file size
        file_content = await file.read()
        if len(file_content) > self.max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 10MB"
            )

        # Get or create tenant brand
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branding configuration not found"
            )

        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{tenant_id}_{asset_type.value}_{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(self.asset_storage_path, unique_filename)

        # Ensure storage directory exists
        os.makedirs(self.asset_storage_path, exist_ok=True)

        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)

        # Get image dimensions
        width, height = await self._get_image_dimensions(file_content)

        # If this is marked as primary, unset other primary assets of same type
        if is_primary:
            self.db.query(BrandAsset)\
                .filter(
                    and_(
                        BrandAsset.tenant_brand_id == brand.id,
                        BrandAsset.asset_type == asset_type,
                        BrandAsset.is_primary == True
                    )
                )\
                .update({"is_primary": False})

        # Create brand asset record
        asset = BrandAsset(
            tenant_brand_id=brand.id,
            asset_type=asset_type,
            name=name or file.filename,
            description=description,
            file_url=f"/static/brand-assets/{unique_filename}",
            file_name=file.filename,
            file_size=len(file_content),
            mime_type=file.content_type,
            width=width,
            height=height,
            is_primary=is_primary
        )

        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)

        logger.info(f"Uploaded {asset_type.value} asset for tenant {tenant_id}")
        return asset

    async def get_brand_assets(
        self,
        tenant_id: uuid.UUID,
        asset_type: Optional[BrandElementType] = None
    ) -> List[BrandAsset]:
        """Get tenant's brand assets"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return []

        query = self.db.query(BrandAsset).filter(BrandAsset.tenant_brand_id == brand.id)

        if asset_type:
            query = query.filter(BrandAsset.asset_type == asset_type)

        return query.order_by(BrandAsset.is_primary.desc(), BrandAsset.created_at.desc()).all()

    async def delete_brand_asset(self, tenant_id: uuid.UUID, asset_id: uuid.UUID) -> bool:
        """Delete brand asset"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return False

        asset = self.db.query(BrandAsset)\
            .filter(
                and_(
                    BrandAsset.id == asset_id,
                    BrandAsset.tenant_brand_id == brand.id
                )
            )\
            .first()

        if not asset:
            return False

        # Delete file from storage
        try:
            file_path = os.path.join(self.asset_storage_path, os.path.basename(asset.file_url))
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            logger.error(f"Failed to delete asset file: {str(e)}")

        # Delete database record
        self.db.delete(asset)
        self.db.commit()

        logger.info(f"Deleted brand asset {asset_id} for tenant {tenant_id}")
        return True

    async def create_email_template(
        self,
        tenant_id: uuid.UUID,
        template_data: Dict[str, Any]
    ) -> EmailTemplate:
        """Create custom email template"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branding configuration not found"
            )

        # Check if template already exists
        existing_template = self.db.query(EmailTemplate)\
            .filter(
                and_(
                    EmailTemplate.tenant_brand_id == brand.id,
                    EmailTemplate.template_name == template_data['template_name']
                )
            )\
            .first()

        if existing_template:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email template with this name already exists"
            )

        template = EmailTemplate(tenant_brand_id=brand.id, **template_data)
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)

        logger.info(f"Created email template {template.template_name} for tenant {tenant_id}")
        return template

    async def get_email_templates(
        self,
        tenant_id: uuid.UUID,
        template_name: Optional[str] = None
    ) -> List[EmailTemplate]:
        """Get tenant's email templates"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return []

        query = self.db.query(EmailTemplate).filter(EmailTemplate.tenant_brand_id == brand.id)

        if template_name:
            query = query.filter(EmailTemplate.template_name == template_name)

        return query.filter(EmailTemplate.is_active == True).all()

    async def render_email_template(
        self,
        tenant_id: uuid.UUID,
        template_name: str,
        variables: Dict[str, Any]
    ) -> Dict[str, str]:
        """Render email template with variables"""
        templates = await self.get_email_templates(tenant_id, template_name)

        if not templates:
            # Use default template
            return await self._render_default_email_template(template_name, variables)

        template = templates[0]  # Use first template (should be primary)

        rendered_html = await self._render_template_string(template.html_template, variables)
        rendered_text = await self._render_template_string(template.text_template, variables)

        return {
            'subject': await self._render_template_string(template.subject, variables),
            'html': rendered_html,
            'text': rendered_text
        }

    async def create_theme_preset(
        self,
        tenant_id: uuid.UUID,
        preset_data: Dict[str, Any]
    ) -> ThemePreset:
        """Create theme preset"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branding configuration not found"
            )

        preset = ThemePreset(tenant_brand_id=brand.id, **preset_data)
        self.db.add(preset)
        self.db.commit()
        self.db.refresh(preset)

        logger.info(f"Created theme preset {preset.name} for tenant {tenant_id}")
        return preset

    async def get_theme_presets(self, tenant_id: uuid.UUID) -> List[ThemePreset]:
        """Get tenant's theme presets"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return []

        return self.db.query(ThemePreset)\
            .filter(
                and_(
                    ThemePreset.tenant_brand_id == brand.id,
                    ThemePreset.is_active == True
                )
            )\
            .order_by(ThemePreset.created_at.desc())\
            .all()

    async def apply_theme_preset(
        self,
        tenant_id: uuid.UUID,
        preset_id: uuid.UUID
    ) -> TenantBrand:
        """Apply theme preset to tenant's branding"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branding configuration not found"
            )

        preset = self.db.query(ThemePreset)\
            .filter(
                and_(
                    ThemePreset.id == preset_id,
                    ThemePreset.tenant_brand_id == brand.id
                )
            )\
            .first()

        if not preset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme preset not found"
            )

        # Apply preset colors
        if preset.color_scheme:
            for key, value in preset.color_scheme.items():
                if hasattr(brand, f"{key}_color"):
                    setattr(brand, f"{key}_color", value)

        # Apply preset typography
        if preset.typography:
            if 'font_family_primary' in preset.typography:
                brand.font_family_primary = preset.typography['font_family_primary']
            if 'font_family_secondary' in preset.typography:
                brand.font_family_secondary = preset.typography['font_family_secondary']
            if 'font_family_mono' in preset.typography:
                brand.font_family_mono = preset.typography['font_family_mono']
            if 'font_size_base' in preset.typography:
                brand.font_size_base = preset.typography['font_size_base']
            if 'font_scale' in preset.typography:
                brand.font_scale = preset.typography['font_scale']

        # Apply preset layout
        if preset.layout:
            if 'border_radius' in preset.layout:
                brand.border_radius = preset.layout['border_radius']
            if 'spacing_unit' in preset.layout:
                brand.spacing_unit = preset.layout['spacing_unit']
            if 'sidebar_width' in preset.layout:
                brand.sidebar_width = preset.layout['sidebar_width']
            if 'header_height' in preset.layout:
                brand.header_height = preset.layout['header_height']

        brand.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(brand)

        logger.info(f"Applied theme preset {preset_id} to tenant {tenant_id}")
        return brand

    async def get_css_variables(self, tenant_id: uuid.UUID) -> str:
        """Get CSS custom properties for tenant"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return self._get_default_css_variables()

        return brand.get_css_variables()

    async def validate_custom_domain(
        self,
        tenant_id: uuid.UUID,
        domain: str
    ) -> Dict[str, Any]:
        """Validate custom domain configuration"""
        # Check domain format
        domain_pattern = re.compile(
            r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
        )
        if not domain_pattern.match(domain):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid domain format"
            )

        # Check availability
        is_available = await self._validate_domain_availability(domain, tenant_id)
        if not is_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Domain is already in use"
            )

        return {
            "domain": domain,
            "available": True,
            "verification_required": True,
            "dns_records": await self._generate_dns_records(domain)
        }

    async def verify_custom_domain(
        self,
        tenant_id: uuid.UUID,
        domain: str
    ) -> Dict[str, Any]:
        """Verify custom domain ownership"""
        # This would integrate with DNS verification service
        # For now, simulate verification
        verification_result = {
            "domain": domain,
            "verified": True,
            "dns_configured": True,
            "ssl_ready": True,
            "verification_token": str(uuid.uuid4())
        }

        # Update brand with verification status
        brand = await self.get_tenant_brand(tenant_id)
        if brand and brand.custom_domain == domain:
            brand.is_domain_verified = verification_result["verified"]
            self.db.commit()

        return verification_result

    async def generate_branding_package(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Generate complete branding package for tenant"""
        brand = await self.get_tenant_brand(tenant_id)
        if not brand:
            return self._get_default_branding_package()

        assets = await self.get_brand_assets(tenant_id)
        templates = await self.get_email_templates(tenant_id)
        presets = await self.get_theme_presets(tenant_id)

        return {
            "branding": brand.get_branding_config(),
            "css_variables": brand.get_css_variables(),
            "assets": {
                asset_type.value: [
                    {
                        "id": str(asset.id),
                        "name": asset.name,
                        "url": asset.file_url,
                        "is_primary": asset.is_primary,
                        "dimensions": {"width": asset.width, "height": asset.height}
                    }
                    for asset in assets if asset.asset_type == asset_type
                ]
                for asset_type in set(asset.asset_type for asset in assets)
            },
            "email_templates": [
                {
                    "name": template.template_name,
                    "displayName": template.display_name,
                    "subject": template.subject
                }
                for template in templates
            ],
            "theme_presets": [
                {
                    "id": str(preset.id),
                    "name": preset.name,
                    "category": preset.category,
                    "colorScheme": preset.color_scheme
                }
                for preset in presets
            ]
        }

    # Private Helper Methods
    async def _validate_domain_availability(self, domain: str, tenant_id: uuid.UUID) -> bool:
        """Check if domain is available for tenant"""
        # Check if domain is already used by another tenant
        existing_brand = self.db.query(TenantBrand)\
            .filter(
                and_(
                    TenantBrand.custom_domain == domain,
                    TenantBrand.tenant_id != tenant_id
                )
            )\
            .first()

        return existing_brand is None

    async def _get_image_dimensions(self, file_content: bytes) -> Tuple[int, int]:
        """Get image dimensions from file content"""
        try:
            with Image.open(io.BytesIO(file_content)) as img:
                return img.size
        except Exception as e:
            logger.error(f"Failed to get image dimensions: {str(e)}")
            return 0, 0

    async def _render_template_string(self, template: str, variables: Dict[str, Any]) -> str:
        """Render template string with variables"""
        # Simple template rendering - in production, use a proper template engine
        for key, value in variables.items():
            template = template.replace(f"{{{{{key}}}}}", str(value))
        return template

    async def _render_default_email_template(self, template_name: str, variables: Dict[str, Any]) -> Dict[str, str]:
        """Render default email template"""
        default_templates = {
            "welcome": {
                "subject": "Welcome to UPM.Plus AutomationHub",
                "text": "Welcome {{user_name}}! Your account has been created successfully.",
                "html": "<h1>Welcome {{user_name}}!</h1><p>Your account has been created successfully.</p>"
            },
            "password_reset": {
                "subject": "Password Reset Request",
                "text": "Reset your password: {{reset_link}}",
                "html": "<h1>Reset Password</h1><p>Click here to reset: <a href=\"{{reset_link}}\">Reset</a></p>"
            }
        }

        template = default_templates.get(template_name, default_templates["welcome"])
        rendered = {
            'subject': await self._render_template_string(template['subject'], variables),
            'text': await self._render_template_string(template['text'], variables),
            'html': await self._render_template_string(template['html'], variables)
        }

        return rendered

    def _get_default_branding_config(self) -> Dict[str, Any]:
        """Get default branding configuration"""
        return {
            "identity": {
                "companyName": "UPM.Plus AutomationHub",
                "tagline": "Autonomous Digital Ecosystem Orchestrator"
            },
            "theme": {
                "type": "light",
                "enableSwitcher": True,
                "colors": {
                    "primary": "#3B82F6",
                    "secondary": "#10B981",
                    "accent": "#F59E0B",
                    "text": "#1F2937",
                    "textSecondary": "#6B7280",
                    "background": "#FFFFFF",
                    "surface": "#F9FAFB",
                    "border": "#E5E7EB"
                }
            },
            "features": {
                "whiteLabelMode": False,
                "hideUpmBranding": False,
                "customLoginPage": False
            }
        }

    def _get_default_css_variables(self) -> str:
        """Get default CSS variables"""
        return """
  --color-primary: #3B82F6;
  --color-secondary: #10B981;
  --color-accent: #F59E0B;
  --color-text: #1F2937;
  --color-textSecondary: #6B7280;
  --color-background: #FFFFFF;
  --color-surface: #F9FAFB;
  --color-border: #E5E7EB;
  --font-family-primary: Inter, system-ui, sans-serif;
  --font-family-secondary: Inter, system-ui, sans-serif;
  --font-family-mono: JetBrains Mono, monospace;
  --font-size-base: 16px;
  --font-scale: 1.0;
  --border-radius: 8px;
  --spacing-unit: 8px;
  --sidebar-width: 280px;
  --header-height: 64px;
        """

    def _get_default_branding_package(self) -> Dict[str, Any]:
        """Get default branding package"""
        return {
            "branding": self._get_default_branding_config(),
            "css_variables": self._get_default_css_variables(),
            "assets": {},
            "email_templates": [],
            "theme_presets": []
        }

    async def _generate_dns_records(self, domain: str) -> List[Dict[str, Any]]:
        """Generate DNS records for domain verification"""
        return [
            {
                "type": "CNAME",
                "name": domain,
                "value": "upm.plus",
                "description": "Domain verification record"
            },
            {
                "type": "TXT",
                "name": f"_upm-challenge.{domain}",
                "value": str(uuid.uuid4()),
                "description": "Domain ownership verification"
            }
        ]
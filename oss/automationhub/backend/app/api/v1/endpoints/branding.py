"""
Branding API Endpoints
REST API for tenant branding, white-labeling, and custom themes
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
import uuid
import logging

from ...database import get_db
from ...models.branding import TenantBrand, BrandAsset, EmailTemplate, ThemePreset, BrandElementType, BrandThemeType
from ...services.branding_service import BrandingService
from ...middleware.tenant import get_current_tenant, require_active_tenant, tenant_required
from ...middleware.tenant import get_current_tenant_id

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic Models for Request/Response
class BrandingBase(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    support_url: Optional[str] = None
    custom_domain: Optional[str] = None
    subdomain: Optional[str] = None
    primary_theme: Optional[BrandThemeType] = BrandThemeType.LIGHT
    enable_theme_switcher: Optional[bool] = True

    @validator('custom_domain')
    def validate_domain(cls, v):
        if v:
            import re
            domain_pattern = re.compile(
                r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
            )
            if not domain_pattern.match(v):
                raise ValueError('Invalid domain format')
        return v.lower() if v else v

class ColorScheme(BaseModel):
    primary_color: str = "#3B82F6"
    secondary_color: str = "#10B981"
    accent_color: str = "#F59E0B"
    text_color: Optional[str] = "#1F2937"
    text_secondary_color: Optional[str] = "#6B7280"
    background_color: Optional[str] = "#FFFFFF"
    surface_color: Optional[str] = "#F9FAFB"
    border_color: Optional[str] = "#E5E7EB"
    error_color: Optional[str] = "#EF4444"
    warning_color: Optional[str] = "#F59E0B"
    success_color: Optional[str] = "#10B981"
    info_color: Optional[str] = "#3B82F6"

    @validator('*')
    def validate_color(cls, v, field):
        if isinstance(v, str) and not v.startswith('#'):
            raise ValueError(f'{field.name} must be a hex color code starting with #')
        if isinstance(v, str) and len(v) != 7:
            raise ValueError(f'{field.name} must be a valid hex color code (#RRGGBB)')
        return v

class Typography(BaseModel):
    font_family_primary: Optional[str] = "Inter, system-ui, sans-serif"
    font_family_secondary: Optional[str] = "Inter, system-ui, sans-serif"
    font_family_mono: Optional[str] = "JetBrains Mono, monospace"
    font_size_base: Optional[int] = 16
    font_scale: Optional[float] = 1.0

class LayoutConfig(BaseModel):
    border_radius: Optional[int] = 8
    spacing_unit: Optional[int] = 8
    sidebar_width: Optional[int] = 280
    header_height: Optional[int] = 64
    navigation_style: Optional[str] = "sidebar"

class UIConfig(BaseModel):
    show_logo: Optional[bool] = True
    show_tagline: Optional[bool] = True
    show_footer: Optional[bool] = True
    show_powered_by: Optional[bool] = True
    custom_css: Optional[str] = None
    custom_js: Optional[str] = None

class EmailBranding(BaseModel):
    logo_url: Optional[str] = None
    header_color: Optional[str] = None
    footer_text: Optional[str] = None
    signature: Optional[str] = None

class LandingPageConfig(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None

class MobileBranding(BaseModel):
    app_name: Optional[str] = None
    icon_url: Optional[str] = None
    splash_screen_url: Optional[str] = None
    app_store_url: Optional[str] = None
    play_store_url: Optional[str] = None

class BrandingCreate(BrandingBase):
    color_scheme: Optional[ColorScheme] = ColorScheme()
    typography: Optional[Typography] = Typography()
    layout: Optional[LayoutConfig] = LayoutConfig()
    ui: Optional[UIConfig] = UIConfig()
    email: Optional[EmailBranding] = EmailBranding()
    landing_page: Optional[LandingPageConfig] = LandingPageConfig()
    mobile: Optional[MobileBranding] = MobileBranding()
    features: Optional[Dict[str, bool]] = {}

class BrandingUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    support_url: Optional[str] = None
    custom_domain: Optional[str] = None
    subdomain: Optional[str] = None
    primary_theme: Optional[BrandThemeType] = None
    enable_theme_switcher: Optional[bool] = None
    color_scheme: Optional[ColorScheme] = None
    typography: Optional[Typography] = None
    layout: Optional[LayoutConfig] = None
    ui: Optional[UIConfig] = None
    email: Optional[EmailBranding] = None
    landing_page: Optional[LandingPageConfig] = None
    mobile: Optional[MobileBranding] = None
    features: Optional[Dict[str, bool]] = None

class BrandingResponse(BaseModel):
    id: str
    tenant_id: str
    company_name: Optional[str]
    tagline: Optional[str]
    description: Optional[str]
    support_email: Optional[str]
    custom_domain: Optional[str]
    subdomain: Optional[str]
    is_domain_verified: bool
    ssl_enabled: bool
    primary_theme: str
    enable_theme_switcher: bool
    is_white_labeled: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    branding_config: Dict[str, Any]

    class Config:
        from_attributes = True

class BrandAssetResponse(BaseModel):
    id: str
    asset_type: str
    name: str
    description: Optional[str]
    file_url: str
    file_name: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    is_primary: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class EmailTemplateCreate(BaseModel):
    template_name: str
    display_name: str
    description: Optional[str] = None
    subject: str
    html_template: str
    text_template: str
    variables: Optional[Dict[str, Any]] = {}

class EmailTemplateResponse(BaseModel):
    id: str
    template_name: str
    display_name: str
    description: Optional[str]
    subject: str
    is_active: bool
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ThemePresetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    color_scheme: Dict[str, str]
    typography: Optional[Dict[str, Any]] = None
    layout: Optional[Dict[str, Any]] = None

class ThemePresetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    color_scheme: Dict[str, str]
    is_active: bool
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True

class DomainValidationResponse(BaseModel):
    domain: str
    available: bool
    verification_required: bool
    dns_records: List[Dict[str, str]]

# Tenant-specific branding endpoints (require tenant context)
@router.get("/branding", response_model=BrandingResponse)
@tenant_required
async def get_tenant_branding():
    """Get tenant's branding configuration"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(get_db())
    branding = await branding_service.get_tenant_brand(tenant_id)

    if not branding:
        # Return default branding
        return BrandingResponse(
            id=str(uuid.uuid4()),
            tenant_id=str(tenant_id),
            branding_config=branding_service._get_default_branding_config(),
            is_white_labeled=False,
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

    return BrandingResponse.from_orm(branding)

@router.post("/branding", response_model=BrandingResponse, status_code=status.HTTP_201_CREATED)
@tenant_required
async def create_tenant_branding(
    branding_data: BrandingCreate,
    db: Session = Depends(get_db)
):
    """Create tenant branding configuration"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)

        # Convert pydantic models to dict
        branding_dict = branding_data.dict(exclude_unset=True)

        # Handle nested objects
        if branding_data.color_scheme:
            branding_dict.update({
                f"{key}_color": value for key, value in branding_data.color_scheme.dict().items()
            })

        if branding_data.typography:
            branding_dict.update(branding_data.typography.dict())

        if branding_data.layout:
            branding_dict.update(branding_data.layout.dict())

        if branding_data.ui:
            branding_dict.update({
                f"show_{key}": value for key, value in branding_data.ui.dict().items()
            })

        if branding_data.email:
            branding_dict.update({
                f"email_{key}": value for key, value in branding_data.email.dict().items() if value
            })

        if branding_data.landing_page:
            branding_dict.update({
                f"landing_page_{key}": value for key, value in branding_data.landing_page.dict().items() if value
            })

        if branding_data.mobile:
            branding_dict.update({
                f"mobile_{key}": value for key, value in branding_data.mobile.dict().items() if value
            })

        if branding_data.features:
            branding_dict.update(branding_data.features)

        branding = await branding_service.create_tenant_brand(tenant_id, branding_dict)
        return BrandingResponse.from_orm(branding)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating tenant branding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create branding configuration"
        )

@router.put("/branding", response_model=BrandingResponse)
@tenant_required
async def update_tenant_branding(
    branding_data: BrandingUpdate,
    db: Session = Depends(get_db)
):
    """Update tenant branding configuration"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)

        # Convert pydantic models to dict
        branding_dict = branding_data.dict(exclude_unset=True)

        # Handle nested objects
        if branding_data.color_scheme:
            branding_dict.update({
                f"{key}_color": value for key, value in branding_data.color_scheme.dict().items()
            })

        if branding_data.typography:
            branding_dict.update(branding_data.typography.dict())

        if branding_data.layout:
            branding_dict.update(branding_data.layout.dict())

        if branding_data.ui:
            branding_dict.update({
                f"show_{key}": value for key, value in branding_data.ui.dict().items()
            })

        if branding_data.email:
            branding_dict.update({
                f"email_{key}": value for key, value in branding_data.email.dict().items() if value
            })

        if branding_data.landing_page:
            branding_dict.update({
                f"landing_page_{key}": value for key, value in branding_data.landing_page.dict().items() if value
            })

        if branding_data.mobile:
            branding_dict.update({
                f"mobile_{key}": value for key, value in branding_data.mobile.dict().items() if value
            })

        if branding_data.features:
            branding_dict.update(branding_data.features)

        branding = await branding_service.update_tenant_brand(tenant_id, branding_dict)
        return BrandingResponse.from_orm(branding)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating tenant branding: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update branding configuration"
        )

@router.get("/branding/config", response_model=Dict[str, Any])
@tenant_required
async def get_branding_config():
    """Get complete branding configuration as JSON"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(get_db())
    config = await branding_service.get_branding_config(tenant_id)
    return config

@router.get("/branding/css", response_class=str)
@tenant_required
async def get_css_variables():
    """Get CSS custom properties for the tenant"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(get_db())
    css_vars = await branding_service.get_css_variables(tenant_id)
    return Response(
        content=f":root {{\n{css_vars}\n}}",
        media_type="text/css"
    )

@router.post("/branding/assets/upload", response_model=BrandAssetResponse)
@tenant_required
async def upload_brand_asset(
    asset_type: BrandElementType,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_primary: bool = Form(False),
    db: Session = Depends(get_db)
):
    """Upload brand asset (logo, favicon, etc.)"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        asset = await branding_service.upload_brand_asset(
            tenant_id, asset_type, file, name, description, is_primary
        )
        return BrandAssetResponse.from_orm(asset)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading brand asset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload brand asset"
        )

@router.get("/branding/assets", response_model=List[BrandAssetResponse])
@tenant_required
async def get_brand_assets(
    asset_type: Optional[BrandElementType] = Query(None),
    db: Session = Depends(get_db)
):
    """Get tenant's brand assets"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(db)
    assets = await branding_service.get_brand_assets(tenant_id, asset_type)
    return [BrandAssetResponse.from_orm(asset) for asset in assets]

@router.delete("/branding/assets/{asset_id}")
@tenant_required
async def delete_brand_asset(
    asset_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Delete brand asset"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        success = await branding_service.delete_brand_asset(tenant_id, asset_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brand asset not found"
            )

        return {"message": "Brand asset deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting brand asset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete brand asset"
        )

@router.get("/branding/package", response_model=Dict[str, Any])
@tenant_required
async def get_branding_package():
    """Get complete branding package"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(get_db())
    package = await branding_service.generate_branding_package(tenant_id)
    return package

# Email Template endpoints
@router.post("/branding/email-templates", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
@tenant_required
async def create_email_template(
    template_data: EmailTemplateCreate,
    db: Session = Depends(get_db)
):
    """Create custom email template"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        template = await branding_service.create_email_template(tenant_id, template_data.dict())
        return EmailTemplateResponse.from_orm(template)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating email template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create email template"
        )

@router.get("/branding/email-templates", response_model=List[EmailTemplateResponse])
@tenant_required
async def get_email_templates(
    template_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get tenant's email templates"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(db)
    templates = await branding_service.get_email_templates(tenant_id, template_name)
    return [EmailTemplateResponse.from_orm(template) for template in templates]

@router.post("/branding/email-templates/render", response_model=Dict[str, str])
@tenant_required
async def render_email_template(
    template_name: str = Query(...),
    variables: Dict[str, Any] = {},
    db: Session = Depends(get_db)
):
    """Render email template with variables"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        rendered = await branding_service.render_email_template(tenant_id, template_name, variables)
        return rendered
    except Exception as e:
        logger.error(f"Error rendering email template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to render email template"
        )

# Theme Preset endpoints
@router.post("/branding/theme-presets", response_model=ThemePresetResponse, status_code=status.HTTP_201_CREATED)
@tenant_required
async def create_theme_preset(
    preset_data: ThemePresetCreate,
    db: Session = Depends(get_db)
):
    """Create theme preset"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        preset = await branding_service.create_theme_preset(tenant_id, preset_data.dict())
        return ThemePresetResponse.from_orm(preset)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating theme preset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create theme preset"
        )

@router.get("/branding/theme-presets", response_model=List[ThemePresetResponse])
@tenant_required
async def get_theme_presets(db: Session = Depends(get_db)):
    """Get tenant's theme presets"""
    tenant_id = get_current_tenant_id()
    branding_service = BrandingService(db)
    presets = await branding_service.get_theme_presets(tenant_id)
    return [ThemePresetResponse.from_orm(preset) for preset in presets]

@router.post("/branding/theme-presets/{preset_id}/apply", response_model=BrandingResponse)
@tenant_required
async def apply_theme_preset(
    preset_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Apply theme preset to tenant's branding"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        brand = await branding_service.apply_theme_preset(tenant_id, preset_id)
        return BrandingResponse.from_orm(brand)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying theme preset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply theme preset"
        )

# Domain Management endpoints
@router.post("/branding/domain/validate", response_model=DomainValidationResponse)
@tenant_required
async def validate_custom_domain(
    domain: str = Query(...),
    db: Session = Depends(get_db)
):
    """Validate custom domain availability"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        validation = await branding_service.validate_custom_domain(tenant_id, domain)
        return DomainValidationResponse(**validation)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating domain: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate domain"
        )

@router.post("/branding/domain/verify", response_model=Dict[str, Any])
@tenant_required
async def verify_custom_domain(
    domain: str = Query(...),
    db: Session = Depends(get_db)
):
    """Verify custom domain ownership"""
    try:
        tenant_id = get_current_tenant_id()
        branding_service = BrandingService(db)
        verification = await branding_service.verify_custom_domain(tenant_id, domain)
        return verification
    except Exception as e:
        logger.error(f"Error verifying domain: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify domain"
        )
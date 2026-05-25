"""
Branding Models for Multi-Tenant Custom Branding
Supports white-labeling, custom themes, and tenant-specific branding
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, JSON, ForeignKey, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from enum import Enum
import uuid
import re

from app.core.database import Base

def _branding_table_args(comment: str = ""):
    from app.core.config import settings
    opts = {}
    if comment:
        opts["comment"] = comment
    if not (settings.DATABASE_URL and "sqlite" in settings.DATABASE_URL.lower()):
        opts["schema"] = "public"
    return opts

class BrandThemeType(str, Enum):
    """Brand theme types"""
    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"

class BrandElementType(str, Enum):
    """Brand element types"""
    LOGO = "logo"
    FAVICON = "favicon"
    BANNER = "banner"
    BACKGROUND = "background"
    WATERMARK = "watermark"

class TenantBrand(Base):
    """
    Tenant Branding Configuration
    Stores comprehensive branding settings for each tenant
    """
    __tablename__ = "tenant_brands"
    __table_args__ = _branding_table_args("Tenant branding and white-labeling configuration")

    # Primary Keys
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True)

    # Brand Identity
    company_name = Column(String(255), nullable=True, comment="Display company name")
    tagline = Column(String(500), nullable=True, comment="Company tagline or slogan")
    description = Column(Text, nullable=True, comment="Company description for branding")

    # Contact Information
    support_email = Column(String(255), nullable=True, comment="Customer support email")
    support_phone = Column(String(50), nullable=True, comment="Customer support phone")
    support_url = Column(String(500), nullable=True, comment="Support portal URL")

    # Domain Configuration
    custom_domain = Column(String(255), unique=True, nullable=True, comment="Custom white-label domain")
    subdomain = Column(String(100), nullable=True, comment="Custom subdomain")
    is_domain_verified = Column(Boolean, nullable=False, default=False, comment="Domain verification status")
    ssl_enabled = Column(Boolean, nullable=False, default=True, comment="SSL certificate status")

    # Theme Configuration
    primary_theme = Column(SQLEnum(BrandThemeType), nullable=False, default=BrandThemeType.LIGHT)
    enable_theme_switcher = Column(Boolean, nullable=False, default=True, comment="Allow users to switch themes")

    # Color Scheme
    primary_color = Column(String(7), nullable=False, default="#3B82F6", comment="Primary brand color (hex)")
    secondary_color = Column(String(7), nullable=False, default="#10B981", comment="Secondary brand color (hex)")
    accent_color = Column(String(7), nullable=False, default="#F59E0B", comment="Accent color (hex)")
    text_color = Column(String(7), nullable=True, comment="Primary text color")
    text_secondary_color = Column(String(7), nullable=True, comment="Secondary text color")
    background_color = Column(String(7), nullable=True, comment="Background color")
    surface_color = Column(String(7), nullable=True, comment="Surface color for cards/panels")
    border_color = Column(String(7), nullable=True, comment="Border color")
    error_color = Column(String(7), nullable=True, comment="Error state color")
    warning_color = Column(String(7), nullable=True, comment="Warning state color")
    success_color = Column(String(7), nullable=True, comment="Success state color")
    info_color = Column(String(7), nullable=True, comment="Info state color")

    # Typography
    font_family_primary = Column(String(100), nullable=True, comment="Primary font family")
    font_family_secondary = Column(String(100), nullable=True, comment="Secondary font family")
    font_family_mono = Column(String(100), nullable=True, comment="Monospace font family")
    font_size_base = Column(Integer, nullable=True, default=16, comment="Base font size in pixels")
    font_scale = Column(Float, nullable=True, default=1.0, comment="Font scaling factor")

    # Layout and Spacing
    border_radius = Column(Integer, nullable=True, default=8, comment="Border radius in pixels")
    spacing_unit = Column(Integer, nullable=True, default=8, comment="Base spacing unit in pixels")
    sidebar_width = Column(Integer, nullable=True, default=280, comment="Sidebar width in pixels")
    header_height = Column(Integer, nullable=True, default=64, comment="Header height in pixels")

    # UI Customizations
    show_logo = Column(Boolean, nullable=False, default=True, comment="Show logo in header")
    show_tagline = Column(Boolean, nullable=False, default=True, comment="Show tagline in header")
    show_footer = Column(Boolean, nullable=False, default=True, comment="Show footer")
    show_powered_by = Column(Boolean, nullable=False, default=True, comment="Show powered by branding")
    custom_css = Column(Text, nullable=True, comment="Custom CSS for additional styling")
    custom_js = Column(Text, nullable=True, comment="Custom JavaScript for functionality")

    # Navigation Customization
    navigation_style = Column(String(50), nullable=True, default="sidebar", comment="Navigation style: sidebar, topbar, hybrid")
    hide_navigation_items = Column(ARRAY(String), nullable=True, comment="Navigation items to hide")
    custom_navigation_items = Column(JSON, nullable=True, default=list, comment="Custom navigation items")

    # Dashboard Customization
    dashboard_layout = Column(JSON, nullable=True, default=dict, comment="Dashboard layout configuration")
    default_dashboard = Column(String(100), nullable=True, comment="Default dashboard page")
    hide_dashboard_widgets = Column(ARRAY(String), nullable=True, comment="Dashboard widgets to hide")

    # Email Branding
    email_logo_url = Column(String(500), nullable=True, comment="Logo URL for email templates")
    email_header_color = Column(String(7), nullable=True, comment="Email header background color")
    email_footer_text = Column(Text, nullable=True, comment="Custom email footer text")
    email_signature = Column(Text, nullable=True, comment="Email signature")

    # Landing Page
    custom_landing_page = Column(Boolean, nullable=False, default=False, comment="Use custom landing page")
    landing_page_title = Column(String(255), nullable=True, comment="Landing page title")
    landing_page_subtitle = Column(String(500), nullable=True, comment="Landing page subtitle")
    landing_page_description = Column(Text, nullable=True, comment="Landing page description")
    landing_page_cta_text = Column(String(100), nullable=True, comment="Call-to-action button text")
    landing_page_cta_url = Column(String(500), nullable=True, comment="Call-to-action URL")

    # API and Integration Branding
    api_documentation_branding = Column(Boolean, nullable=False, default=True, comment="Apply branding to API docs")
    webhook_branding = Column(Boolean, nullable=False, default=True, comment="Apply branding to webhook payloads")
    export_watermarks = Column(Boolean, nullable=False, default=False, comment="Add watermarks to exports")

    # Feature Flags for Branding
    enable_white_label_mode = Column(Boolean, nullable=False, default=False, comment="Complete white-label mode")
    hide_upm_branding = Column(Boolean, nullable=False, default=False, comment="Hide all UPM.Plus branding")
    custom_login_page = Column(Boolean, nullable=False, default=False, comment="Custom login page")
    custom_error_pages = Column(Boolean, nullable=False, default=False, comment="Custom error pages")

    # Mobile App Branding
    mobile_app_name = Column(String(100), nullable=True, comment="Mobile app display name")
    mobile_app_icon = Column(String(500), nullable=True, comment="Mobile app icon URL")
    mobile_splash_screen = Column(String(500), nullable=True, comment="Mobile splash screen URL")
    app_store_url = Column(String(500), nullable=True, comment="App Store URL")
    play_store_url = Column(String(500), nullable=True, comment="Google Play Store URL")

    # Analytics and Tracking
    google_analytics_id = Column(String(50), nullable=True, comment="Google Analytics tracking ID")
    facebook_pixel_id = Column(String(50), nullable=True, comment="Facebook Pixel ID")
    custom_tracking_scripts = Column(Text, nullable=True, comment="Custom tracking scripts")

    # Status and Timestamps
    is_active = Column(Boolean, nullable=False, default=True, comment="Whether branding is active")
    is_default = Column(Boolean, nullable=False, default=False, comment="Default branding for tenant")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="branding")
    brand_assets = relationship("BrandAsset", back_populates="tenant_brand", cascade="all, delete-orphan")
    email_templates = relationship("EmailTemplate", back_populates="tenant_brand", cascade="all, delete-orphan")
    theme_presets = relationship("ThemePreset", back_populates="tenant_brand", cascade="all, delete-orphan")

    # Validations
    @validates('custom_domain')
    def validate_custom_domain(self, key, domain):
        if domain:
            # Basic domain validation
            domain_pattern = re.compile(
                r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
            )
            if not domain_pattern.match(domain):
                raise ValueError('Invalid domain format')
        return domain.lower()

    @validates('primary_color', 'secondary_color', 'accent_color')
    def validate_color(self, key, color):
        if color:
            # Validate hex color format
            if not re.match(r'^#[0-9A-Fa-f]{6}$', color):
                raise ValueError(f'Invalid color format for {key}')
        return color

    @validates('email')
    def validate_email(self, key, email):
        if email and '@' not in email:
            raise ValueError('Invalid email address')
        return email.lower()

    # Properties and Methods
    @property
    def is_white_labeled(self) -> bool:
        """Check if tenant is using white-label mode"""
        return self.enable_white_label_mode or self.custom_domain is not None

    @property
    def get_theme_colors(self) -> Dict[str, str]:
        """Get complete color theme dictionary"""
        return {
            'primary': self.primary_color,
            'secondary': self.secondary_color,
            'accent': self.accent_color,
            'text': self.text_color or '#1F2937',
            'textSecondary': self.text_secondary_color or '#6B7280',
            'background': self.background_color or '#FFFFFF',
            'surface': self.surface_color or '#F9FAFB',
            'border': self.border_color or '#E5E7EB',
            'error': self.error_color or '#EF4444',
            'warning': self.warning_color or '#F59E0B',
            'success': self.success_color or '#10B981',
            'info': self.info_color or '#3B82F6'
        }

    @property
    def get_typography(self) -> Dict[str, Any]:
        """Get typography configuration"""
        return {
            'fontFamily': {
                'primary': self.font_family_primary or 'Inter, system-ui, sans-serif',
                'secondary': self.font_family_secondary or 'Inter, system-ui, sans-serif',
                'mono': self.font_family_mono or 'JetBrains Mono, monospace'
            },
            'fontSize': {
                'base': self.font_size_base or 16,
                'scale': self.font_scale or 1.0
            }
        }

    @property
    def get_layout_config(self) -> Dict[str, Any]:
        """Get layout configuration"""
        return {
            'borderRadius': self.border_radius or 8,
            'spacing': self.spacing_unit or 8,
            'sidebar': {
                'width': self.sidebar_width or 280,
                'style': self.navigation_style or 'sidebar'
            },
            'header': {
                'height': self.header_height or 64,
                'showLogo': self.show_logo,
                'showTagline': self.show_tagline
            },
            'footer': {
                'show': self.show_footer,
                'showPoweredBy': self.show_powered_by
            }
        }

    def get_css_variables(self) -> str:
        """Generate CSS custom properties for the theme"""
        colors = self.get_theme_colors()
        typography = self.get_typography()
        layout = self.get_layout_config()

        css_vars = []

        # Color variables
        for key, value in colors.items():
            css_vars.append(f'  --color-{key}: {value};')

        # Typography variables
        for family, value in typography['fontFamily'].items():
            css_vars.append(f'  --font-family-{family}: {value};')

        css_vars.append(f'  --font-size-base: {typography["fontSize"]["base"]}px;')
        css_vars.append(f'  --font-scale: {typography["fontSize"]["scale"]};')

        # Layout variables
        css_vars.append(f'  --border-radius: {layout["borderRadius"]}px;')
        css_vars.append(f'  --spacing-unit: {layout["spacing"]}px;')
        css_vars.append(f'  --sidebar-width: {layout["sidebar"]["width"]}px;')
        css_vars.append(f'  --header-height: {layout["header"]["height"]}px;')

        return '\\n'.join(css_vars)

    def get_branding_config(self) -> Dict[str, Any]:
        """Get complete branding configuration"""
        return {
            'identity': {
                'companyName': self.company_name,
                'tagline': self.tagline,
                'description': self.description
            },
            'domain': {
                'customDomain': self.custom_domain,
                'subdomain': self.subdomain,
                'isVerified': self.is_domain_verified,
                'sslEnabled': self.ssl_enabled
            },
            'theme': {
                'type': self.primary_theme.value,
                'enableSwitcher': self.enable_theme_switcher,
                'colors': self.get_theme_colors(),
                'typography': self.get_typography(),
                'layout': self.get_layout_config()
            },
            'ui': {
                'showLogo': self.show_logo,
                'showTagline': self.show_tagline,
                'showFooter': self.show_footer,
                'showPoweredBy': self.show_powered_by,
                'customCSS': self.custom_css,
                'customJS': self.custom_js
            },
            'navigation': {
                'style': self.navigation_style,
                'hiddenItems': self.hide_navigation_items or [],
                'customItems': self.custom_navigation_items or []
            },
            'dashboard': {
                'layout': self.dashboard_layout or {},
                'defaultPage': self.default_dashboard,
                'hiddenWidgets': self.hide_dashboard_widgets or []
            },
            'email': {
                'logoUrl': self.email_logo_url,
                'headerColor': self.email_header_color,
                'footerText': self.email_footer_text,
                'signature': self.email_signature
            },
            'landing': {
                'custom': self.custom_landing_page,
                'title': self.landing_page_title,
                'subtitle': self.landing_page_subtitle,
                'description': self.landing_page_description,
                'ctaText': self.landing_page_cta_text,
                'ctaUrl': self.landing_page_cta_url
            },
            'mobile': {
                'appName': self.mobile_app_name,
                'iconUrl': self.mobile_app_icon,
                'splashScreenUrl': self.mobile_splash_screen,
                'appStoreUrl': self.app_store_url,
                'playStoreUrl': self.play_store_url
            },
            'analytics': {
                'googleAnalyticsId': self.google_analytics_id,
                'facebookPixelId': self.facebook_pixel_id,
                'customScripts': self.custom_tracking_scripts
            },
            'features': {
                'whiteLabelMode': self.enable_white_label_mode,
                'hideUpmBranding': self.hide_upm_branding,
                'customLoginPage': self.custom_login_page,
                'customErrorPages': self.custom_error_pages,
                'apiDocBranding': self.api_documentation_branding,
                'webhookBranding': self.webhook_branding,
                'exportWatermarks': self.export_watermarks
            }
        }

    def apply_theme_to_class(self, base_class: str) -> str:
        """Generate CSS class with theme variables"""
        css_vars = self.get_css_variables()

        return f'''
.{base_class} {{
{css_vars}
}}
        '''

    def __repr__(self) -> str:
        return f"<TenantBrand(id={self.id}, tenant_id={self.tenant_id}, custom_domain={self.custom_domain})>"

    def __str__(self) -> str:
        return f"Branding for tenant {self.tenant_id}"


class BrandAsset(Base):
    """
    Brand Assets Storage
    Stores logos, images, and other brand assets
    """
    __tablename__ = "brand_assets"
    __table_args__ = _branding_table_args("Brand assets storage")

    # Primary Keys
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_brand_id = Column(UUID(as_uuid=True), ForeignKey('tenant_brands.id', ondelete='CASCADE'), nullable=False, index=True)

    # Asset Information
    asset_type = Column(SQLEnum(BrandElementType), nullable=False)
    name = Column(String(255), nullable=False, comment="Asset name")
    description = Column(Text, nullable=True, comment="Asset description")

    # File Information
    file_url = Column(String(500), nullable=False, comment="Asset file URL")
    file_name = Column(String(255), nullable=True, comment="Original file name")
    file_size = Column(Integer, nullable=True, comment="File size in bytes")
    mime_type = Column(String(100), nullable=True, comment="MIME type")

    # Asset Dimensions
    width = Column(Integer, nullable=True, comment="Width in pixels")
    height = Column(Integer, nullable=True, comment="Height in pixels")

    # Asset Variants
    variants = Column(JSON, nullable=True, default=dict, comment="Different size variants")

    # Usage
    is_primary = Column(Boolean, nullable=False, default=False, comment="Primary asset of this type")
    is_active = Column(Boolean, nullable=False, default=True, comment="Whether asset is active")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant_brand = relationship("TenantBrand", back_populates="brand_assets")

    def __repr__(self) -> str:
        return f"<BrandAsset(id={self.id}, type={self.asset_type}, name={self.name})>"


class EmailTemplate(Base):
    """
    Custom Email Templates
    Tenant-specific email templates with branding
    """
    __tablename__ = "email_templates"
    __table_args__ = _branding_table_args("Tenant email templates")

    # Primary Keys
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_brand_id = Column(UUID(as_uuid=True), ForeignKey('tenant_brands.id', ondelete='CASCADE'), nullable=False, index=True)

    # Template Information
    template_name = Column(String(100), nullable=False, comment="Template identifier")
    display_name = Column(String(255), nullable=False, comment="Human-readable name")
    description = Column(Text, nullable=True, comment="Template description")

    # Template Content
    subject = Column(String(500), nullable=False, comment="Email subject line")
    html_template = Column(Text, nullable=False, comment="HTML email template")
    text_template = Column(Text, nullable=False, comment="Plain text email template")

    # Template Variables
    variables = Column(JSON, nullable=True, default=dict, comment="Available template variables")

    # Status
    is_active = Column(Boolean, nullable=False, default=True, comment="Whether template is active")
    is_default = Column(Boolean, nullable=False, default=False, comment="Default template for this type")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant_brand = relationship("TenantBrand", back_populates="email_templates")

    def __repr__(self) -> str:
        return f"<EmailTemplate(id={self.id}, name={self.template_name}, tenant={self.tenant_brand_id})>"


class ThemePreset(Base):
    """
    Theme Presets
    Pre-defined theme configurations that tenants can apply
    """
    __tablename__ = "theme_presets"
    __table_args__ = _branding_table_args("Theme presets for tenant branding")

    # Primary Keys
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_brand_id = Column(UUID(as_uuid=True), ForeignKey('tenant_brands.id', ondelete='CASCADE'), nullable=False, index=True)

    # Preset Information
    name = Column(String(100), nullable=False, comment="Preset name")
    description = Column(Text, nullable=True, comment="Preset description")
    category = Column(String(50), nullable=True, comment="Preset category")

    # Theme Configuration
    color_scheme = Column(JSON, nullable=False, comment="Color scheme configuration")
    typography = Column(JSON, nullable=True, comment="Typography configuration")
    layout = Column(JSON, nullable=True, comment="Layout configuration")

    # Status
    is_active = Column(Boolean, nullable=False, default=True, comment="Whether preset is active")
    is_public = Column(Boolean, nullable=False, default=False, comment="Whether preset is public")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant_brand = relationship("TenantBrand", back_populates="theme_presets")

    def __repr__(self) -> str:
        return f"<ThemePreset(id={self.id}, name={self.name}, tenant={self.tenant_brand_id})>"


class DomainVerification(Base):
    """
    Domain Verification Records
    """
    __tablename__ = "domain_verifications"
    __table_args__ = _branding_table_args()

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_brand_id = Column(UUID(as_uuid=True), ForeignKey('tenant_brands.id', ondelete='CASCADE'), nullable=False, index=True)
    domain = Column(String(255), nullable=False)
    verification_token = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    tenant_brand = relationship("TenantBrand")


# Alias for compatibility
BrandingConfiguration = TenantBrand

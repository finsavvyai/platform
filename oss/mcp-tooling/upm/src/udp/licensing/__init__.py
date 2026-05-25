"""
UPM Licensing System.

Manages licenses for premium features:
- Dashboard: Analytics, visualizations, real-time monitoring
- AI Agents: OpenClaw intelligent vulnerability detection
- Enterprise: Advanced security, SSO, LDAP, audit logs
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class LicenseTier(str, Enum):
    """License tiers."""

    COMMUNITY = "community"  # Free, open source
    PRO = "pro"  # Paid - Dashboard + basic analytics
    BUSINESS = "business"  # Paid - Dashboard + AI agents
    ENTERPRISE = "enterprise"  # Paid - Everything + SSO/LDAP/support


class Feature(str, Enum):
    """Individual features that can be licensed."""

    # Dashboard Features
    DASHBOARD = "dashboard"
    ANALYTICS = "analytics"
    REALTIME_MONITORING = "realtime_monitoring"
    DEPENDENCY_GRAPH = "dependency_graph"
    CUSTOM_REPORTS = "custom_reports"

    # AI Features
    AI_AGENTS = "ai_agents"
    OPENCLAW = "openclaw"
    PREDICTIVE_ANALYTICS = "predictive_analytics"
    SMART_REMEDIATION = "smart_remediation"

    # Enterprise Features
    SSO = "sso"
    LDAP = "ldap"
    AUDIT_LOGS = "audit_logs"
    RBAC = "rbac"
    API_ACCESS = "api_access"
    PRIORITY_SUPPORT = "priority_support"
    ON_PREMISE = "on_premise"


# Tier to features mapping
TIER_FEATURES: dict[LicenseTier, list[Feature]] = {
    LicenseTier.COMMUNITY: [
        # Core features only - no premium features
    ],
    LicenseTier.PRO: [
        Feature.DASHBOARD,
        Feature.ANALYTICS,
        Feature.DEPENDENCY_GRAPH,
        Feature.CUSTOM_REPORTS,
    ],
    LicenseTier.BUSINESS: [
        Feature.DASHBOARD,
        Feature.ANALYTICS,
        Feature.REALTIME_MONITORING,
        Feature.DEPENDENCY_GRAPH,
        Feature.CUSTOM_REPORTS,
        Feature.AI_AGENTS,
        Feature.OPENCLAW,
        Feature.PREDICTIVE_ANALYTICS,
        Feature.SMART_REMEDIATION,
    ],
    LicenseTier.ENTERPRISE: [
        # Everything
        Feature.DASHBOARD,
        Feature.ANALYTICS,
        Feature.REALTIME_MONITORING,
        Feature.DEPENDENCY_GRAPH,
        Feature.CUSTOM_REPORTS,
        Feature.AI_AGENTS,
        Feature.OPENCLAW,
        Feature.PREDICTIVE_ANALYTICS,
        Feature.SMART_REMEDIATION,
        Feature.SSO,
        Feature.LDAP,
        Feature.AUDIT_LOGS,
        Feature.RBAC,
        Feature.API_ACCESS,
        Feature.PRIORITY_SUPPORT,
        Feature.ON_PREMISE,
    ],
}


@dataclass
class License:
    """A UPM license."""

    key: str
    tier: LicenseTier
    features: list[Feature]
    organization: str
    seats: int
    expires_at: Optional[datetime] = None
    issued_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)

    def is_valid(self) -> bool:
        """Check if license is valid (not expired)."""
        if self.expires_at is None:
            return True  # Perpetual license
        return datetime.now() < self.expires_at

    def has_feature(self, feature: Feature) -> bool:
        """Check if license includes a specific feature."""
        return feature in self.features

    def days_until_expiry(self) -> Optional[int]:
        """Get days until license expires."""
        if self.expires_at is None:
            return None
        delta = self.expires_at - datetime.now()
        return max(0, delta.days)


class LicenseCheckRequest(BaseModel):
    """Request to check a license."""

    license_key: str = Field(..., description="The license key to validate")
    feature: Optional[Feature] = Field(None, description="Specific feature to check")


class LicenseCheckResponse(BaseModel):
    """Response from license check."""

    valid: bool
    tier: Optional[LicenseTier] = None
    features: list[Feature] = []
    organization: Optional[str] = None
    seats: Optional[int] = None
    expires_at: Optional[datetime] = None
    error: Optional[str] = None


class LicenseManager:
    """Manages UPM licenses.

    In production, licenses are signed with RSA keys to prevent tampering.
    For development, a simple validation is used.
    """

    # Generate RSA key pair for production
    _private_key: Optional[rsa.RSAPrivateKey] = None
    _public_key: Optional[rsa.RSAPublicKey] = None

    def __init__(self) -> None:
        self._licenses: dict[str, License] = {}
        self._load_rsa_keys()

    def _load_rsa_keys(self) -> None:
        """Load or generate RSA keys for license signing."""
        try:
            # Try to load existing keys
            with open("license_private.pem", "rb") as f:
                self._private_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend(),
                )
            with open("license_public.pem", "rb") as f:
                self._public_key = serialization.load_pem_public_key(
                    f.read(),
                    backend=default_backend(),
                )
        except FileNotFoundError:
            # Generate new keys for development
            self._generate_rsa_keys()

    def _generate_rsa_keys(self) -> None:
        """Generate new RSA key pair for development."""
        self._private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        self._public_key = self._private_key.public_key()

        # Save keys for future use
        with open("license_private.pem", "wb") as f:
            f.write(
                self._private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )
            )
        with open("license_public.pem", "wb") as f:
            f.write(
                self._public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )
            )

    def generate_license(
        self,
        tier: LicenseTier,
        organization: str,
        seats: int = 10,
        duration_days: Optional[int] = None,
    ) -> str:
        """Generate a new license key.

        Args:
            tier: The license tier
            organization: Organization name
            seats: Number of user seats
            duration_days: Duration in days (None for perpetual)

        Returns:
            License key string
        """
        features = TIER_FEATURES[tier]

        expires_at = None
        if duration_days:
            expires_at = datetime.now() + timedelta(days=duration_days)

        license_obj = License(
            key="",  # Will be set after signing
            tier=tier,
            features=features,
            organization=organization,
            seats=seats,
            expires_at=expires_at,
        )

        # Create license data
        license_data = {
            "tier": tier.value,
            "organization": organization,
            "seats": seats,
            "features": [f.value for f in features],
            "expires_at": expires_at.isoformat() if expires_at else None,
            "issued_at": datetime.now().isoformat(),
        }

        # Sign the license
        signature = self._sign_license(license_data)
        license_data["signature"] = signature

        # Encode as base64
        license_json = json.dumps(license_data)
        license_key = base64.b64encode(license_json.encode()).decode()

        license_obj.key = license_key
        self._licenses[license_key] = license_obj

        logger.info(f"Generated {tier.value} license for {organization}")
        return license_key

    def _sign_license(self, license_data: dict[str, Any]) -> str:
        """Sign license data with RSA private key."""
        data_str = json.dumps(license_data, sort_keys=True)
        digest = hashlib.sha256(data_str.encode()).digest()

        signature = self._private_key.sign(
            digest,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )

        return base64.b64encode(signature).decode()

    def _verify_signature(self, license_data: dict[str, Any]) -> bool:
        """Verify license signature."""
        signature = base64.b64decode(license_data.pop("signature", ""))
        data_str = json.dumps(license_data, sort_keys=True)
        digest = hashlib.sha256(data_str.encode()).digest()

        try:
            self._public_key.verify(
                signature,
                digest,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH,
                ),
                hashes.SHA256(),
            )
            return True
        except Exception:
            return False

    def validate_license(self, license_key: str) -> Optional[License]:
        """Validate a license key and return License object if valid."""
        try:
            # Decode base64
            license_json = base64.b64decode(license_key).decode()
            license_data = json.loads(license_json)

            # Verify signature
            if not self._verify_signature(license_data.copy()):
                logger.warning(
                    f"Invalid license signature for key {license_key[:20]}..."
                )
                return None

            # Check expiration
            expires_at = None
            if license_data.get("expires_at"):
                expires_at = datetime.fromisoformat(license_data["expires_at"])
                if datetime.now() > expires_at:
                    logger.warning(
                        f"Expired license for {license_data.get('organization')}"
                    )
                    return None

            # Parse features
            features = [Feature(f) for f in license_data.get("features", [])]

            license_obj = License(
                key=license_key,
                tier=LicenseTier(license_data["tier"]),
                features=features,
                organization=license_data["organization"],
                seats=license_data.get("seats", 10),
                expires_at=expires_at,
                issued_at=datetime.fromisoformat(license_data["issued_at"]),
            )

            return license_obj

        except Exception as e:
            logger.error(f"License validation error: {e}")
            return None

    def check_feature(self, license_key: str, feature: Feature) -> bool:
        """Check if a license key includes a specific feature."""
        license_obj = self.validate_license(license_key)
        if not license_obj:
            return False
        return license_obj.has_feature(feature)


# Global license manager instance
_license_manager: Optional[LicenseManager] = None


def get_license_manager() -> LicenseManager:
    """Get the global license manager instance."""
    global _license_manager
    if _license_manager is None:
        _license_manager = LicenseManager()
    return _license_manager


def check_license(license_key: str) -> Optional[License]:
    """Convenience function to validate a license."""
    return get_license_manager().validate_license(license_key)


def has_feature(license_key: str, feature: Feature) -> bool:
    """Convenience function to check if license has a feature."""
    return get_license_manager().check_feature(license_key, feature)


# Demo license keys for development (NOT FOR PRODUCTION)
DEMO_LICENSES = {
    "pro": "eyJ0aWVyIjogInBybyIsICJvcmdhbml6YXRpb24iOiAiRGVtbyBJbmMiLCAic2VhdHMiOiAxMCwgImZlYXR1cmVzIjogWyJkYXNoYm9hcmQiLCAiYW5hbHl0aWNzIiwgImRlcGVuZGVuY3lfZ3JhcGgiLCAiY3VzdG9tX3JlcG9ydHMiXSwgImV4cGlyZXNfYXQiOiBudWxsLCAiaXNzdWVkX2F0IjogIjIwMjQtMDEtMDFUMDA6MDA6MDAifQ==",
    "business": "eyJ0aWVyIjogImJ1c2luZXNzIiwgIm9yZ2FuaXphdGlvbiI6ICJEZW1vIEluYyIsICJzZWF0cyI6IDIwLCAiZmVhdHVyZXMiOiBbImRhc2hib2FyZCIsICJhbmFseXRpY3MiLCAicmVhbHRpbWVfbW9uaXRvcmluZyIsICJkZXBlbmRlbmN5X2dyYXBoIiwgImN1c3RvbV9yZXBvcnRzIiwgImFpX2FnZW50cyIsICJvcGVuY2xhdyIsICJwcmVkaWN0aXZlX2FuYWx5dGljcyIsICJzbWFydF9yZW1lZGlhdGlvbiJdLCAiZXhwaXJlc19hdCI6IG51bGwsICJpc3N1ZWRfYXQiOiAiMjAyNC0wMS0wMVQwMDowMDowMCJ9",
}

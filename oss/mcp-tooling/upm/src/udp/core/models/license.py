"""
License model for software license management.

Handles open source and commercial licenses, their compatibility,
and compliance requirements.
"""

from enum import Enum
from typing import Dict, List, Optional, Set

from sqlalchemy import Boolean, Column, String, Text, Index, JSON, Integer
from sqlalchemy.orm import relationship

from .base import Base


class LicenseType(str, Enum):
    """License types."""

    PERMISSIVE = "permissive"  # MIT, BSD, Apache
    COPYLEFT = "copyleft"  # GPL, AGPL
    WEAK_COPYLEFT = "weak_copyleft"  # LGPL, MPL
    PROPRIETARY = "proprietary"
    PUBLIC_DOMAIN = "public_domain"
    OTHER = "other"


class LicenseRisk(str, Enum):
    """License risk levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class License(Base):
    """
    Software license model.

    Represents open source and commercial licenses with their
    properties, obligations, and compatibility information.
    """

    __tablename__ = "licenses"

    # Primary key
    id = Column(Integer, primary_key=True, index=True, comment="License ID")

    # License identification
    spdx_id = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="SPDX license identifier",
    )

    name = Column(String(255), nullable=False, index=True, comment="License name")

    # License categorization
    license_type = Column(
        String(50), nullable=False, default=LicenseType.OTHER, comment="Type of license"
    )

    risk_level = Column(
        String(50),
        nullable=False,
        default=LicenseRisk.MEDIUM,
        comment="Risk level for enterprise use",
    )

    # License properties
    is_osi_approved = Column(
        Boolean, default=False, nullable=False, comment="Whether OSI approved"
    )

    is_fsf_approved = Column(
        Boolean, default=False, nullable=False, comment="Whether FSF approved"
    )

    is_deprecated = Column(
        Boolean, default=False, nullable=False, comment="Whether license is deprecated"
    )

    # License text and URL
    text_url = Column(String(500), nullable=True, comment="URL to full license text")

    summary = Column(Text, nullable=True, comment="Brief description of license")

    # Obligations and restrictions
    obligations = Column(
        JSON,
        default=list,
        comment="List of obligations (attribution, disclosure, etc.)",
    )

    restrictions = Column(
        JSON,
        default=list,
        comment="List of restrictions (patent grants, trademark use, etc.)",
    )

    # Compatibility matrix
    compatible_licenses = Column(
        JSON, default=list, comment="List of compatible license SPDX IDs"
    )

    incompatible_licenses = Column(
        JSON, default=list, comment="List of incompatible license SPDX IDs"
    )

    # Usage policies
    requires_source_distribution = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether source must be distributed",
    )

    requires_license_file = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether license file must be included",
    )

    requires_notice = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether copyright notice must be included",
    )

    # Commercial usage
    allows_commercial_use = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether commercial use is allowed",
    )

    requires_payment = Column(
        Boolean, default=False, nullable=False, comment="Whether payment is required"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_licenses_type_risk", "license_type", "risk_level"),
        Index("idx_licenses_osi_fsf", "is_osi_approved", "is_fsf_approved"),
        Index("idx_licenses_commercial", "allows_commercial_use", "requires_payment"),
    )

    def is_compatible_with(self, other_spdx_id: str) -> bool:
        """Check if this license is compatible with another license."""
        if not self.compatible_licenses:
            return False

        # Allow self-compatibility
        if self.spdx_id == other_spdx_id:
            return True

        # Check explicit compatibility
        return other_spdx_id in self.compatible_licenses

    def has_incompatibility_with(self, other_spdx_id: str) -> bool:
        """Check if this license is explicitly incompatible with another."""
        if not self.incompatible_licenses:
            return False
        return other_spdx_id in self.incompatible_licenses

    def get_obligations_list(self) -> List[str]:
        """Get list of obligations."""
        return self.obligations if self.obligations else []

    def get_restrictions_list(self) -> List[str]:
        """Get list of restrictions."""
        return self.restrictions if self.restrictions else []

    def calculate_compatibility_score(self, project_licenses: List[str]) -> float:
        """
        Calculate compatibility score with a list of project licenses.

        Returns a score between 0 (incompatible) and 1 (perfectly compatible).
        """
        if not project_licenses:
            return 1.0

        compatible_count = 0
        total_count = len(project_licenses)

        for other_license in project_licenses:
            if self.is_compatible_with(
                other_license
            ) and not self.has_incompatibility_with(other_license):
                compatible_count += 1

        return compatible_count / total_count

    @property
    def is_copyleft(self) -> bool:
        """Check if license is copyleft."""
        return self.license_type in [LicenseType.COPYLEFT, LicenseType.WEAK_COPYLEFT]

    @property
    def risk_score(self) -> int:
        """Get numeric risk score (1-4)."""
        risk_map = {
            LicenseRisk.LOW: 1,
            LicenseRisk.MEDIUM: 2,
            LicenseRisk.HIGH: 3,
            LicenseRisk.CRITICAL: 4,
        }
        return risk_map.get(self.risk_level, 2)

    def __repr__(self) -> str:
        return f"<License(id={self.id}, spdx_id={self.spdx_id}, name={self.name})>"

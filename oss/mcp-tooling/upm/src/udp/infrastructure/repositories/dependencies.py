"""Dependency repository for data access operations."""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from udp.domain.models import EcosystemType, SecurityLevel
from udp.infrastructure.models import (
    DependencyGraphModel,
    LicenseModel,
    PackageModel,
    PackageVulnerabilityModel,
    PolicyModel,
    VulnerabilityModel,
)


class DependencyRepository:
    """Repository for dependency/package data access operations."""

    async def count(
        self,
        db: AsyncSession,
        ecosystem: Optional[EcosystemType] = None,
        language: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Count packages with optional filters."""
        query = select(func.count()).select_from(PackageModel)

        conditions = []
        if ecosystem:
            conditions.append(PackageModel.ecosystem == ecosystem)
        if language:
            conditions.append(PackageModel.tags.contains([language]))
        if is_active is not None:
            conditions.append(PackageModel.is_deleted == (not is_active))

        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query)
        return int(result.scalar() or 0)

    async def list(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        ecosystem: Optional[EcosystemType] = None,
        language: Optional[str] = None,
        sort_by: str = "created_at",
        sort_desc: bool = True,
        include_vulnerabilities: bool = False,
    ) -> list[PackageModel]:
        """List packages with pagination and filtering."""
        query = select(PackageModel)

        # Apply filters
        conditions = []
        if ecosystem:
            conditions.append(PackageModel.ecosystem == ecosystem)
        if language:
            conditions.append(PackageModel.tags.contains([language]))
        conditions.append(PackageModel.is_deleted == False)

        if conditions:
            query = query.where(and_(*conditions))

        # Apply sorting
        if hasattr(PackageModel, sort_by):
            order_column = getattr(PackageModel, sort_by)
            if sort_desc:
                query = query.order_by(order_column.desc())
            else:
                query = query.order_by(order_column.asc())

        # Apply pagination
        query = query.offset(max(skip, 0)).limit(limit)

        # Eager load relationships if needed
        if include_vulnerabilities:
            query = query.options(selectinload(PackageModel.vulnerabilities))

        result = await db.execute(query)
        return list(result.scalars().all())

    async def get(self, db: AsyncSession, package_id: UUID) -> Optional[PackageModel]:
        """Get a package by ID."""
        result = await db.execute(
            select(PackageModel)
            .where(PackageModel.id == package_id)
            .where(PackageModel.is_deleted == False)
            .options(selectinload(PackageModel.vulnerabilities))
        )
        return result.scalars().first()

    async def get_by_name(
        self,
        db: AsyncSession,
        name: str,
        version: Optional[str] = None,
        ecosystem: Optional[EcosystemType] = None,
        namespace: Optional[str] = None,
    ) -> Optional[PackageModel]:
        """Get a package by name and optional version/ecosystem."""
        conditions = [
            PackageModel.name == name,
            PackageModel.is_deleted == False,
        ]

        if version:
            conditions.append(PackageModel.version == version)
        if ecosystem:
            conditions.append(PackageModel.ecosystem == ecosystem)
        if namespace:
            conditions.append(PackageModel.namespace == namespace)

        result = await db.execute(
            select(PackageModel)
            .where(and_(*conditions))
            .options(selectinload(PackageModel.vulnerabilities))
        )
        return result.scalars().first()

    async def get_by_registry_key(
        self, db: AsyncSession, registry_key: str
    ) -> Optional[PackageModel]:
        """Get a package by its unique registry key."""
        result = await db.execute(
            select(PackageModel)
            .where(PackageModel.registry_key == registry_key)
            .where(PackageModel.is_deleted == False)
            .options(selectinload(PackageModel.vulnerabilities))
        )
        return result.scalars().first()

    async def search(
        self,
        db: AsyncSession,
        query: str,
        skip: int = 0,
        limit: int = 50,
        ecosystem: Optional[EcosystemType] = None,
    ) -> List[PackageModel]:
        """Search packages by name, description, or tags."""
        search_conditions = [
            or_(
                PackageModel.name.ilike(f"%{query}%"),
                PackageModel.description.ilike(f"%{query}%"),
                PackageModel.tags.contains([query]),
            )
        ]

        if ecosystem:
            search_conditions.append(PackageModel.ecosystem == ecosystem)

        search_conditions.append(PackageModel.is_deleted == False)

        result = await db.execute(
            select(PackageModel)
            .where(and_(*search_conditions))
            .order_by(PackageModel.name.asc())
            .offset(max(skip, 0))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, data: dict[str, Any]) -> PackageModel:
        """Create a new package."""
        package = PackageModel(**data)
        db.add(package)
        await db.commit()
        await db.refresh(package)
        return package

    async def update(
        self, db: AsyncSession, package: PackageModel, data: dict[str, Any]
    ) -> PackageModel:
        """Update a package."""
        for key, value in data.items():
            if hasattr(package, key):
                setattr(package, key, value)

        package.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(package)
        return package

    async def soft_delete(
        self, db: AsyncSession, package: PackageModel
    ) -> PackageModel:
        """Soft delete a package."""
        package.is_deleted = True
        package.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(package)
        return package

    async def get_vulnerabilities(
        self,
        db: AsyncSession,
        package_id: UUID,
        severity: Optional[SecurityLevel] = None,
        include_fixed: bool = False,
    ) -> List[tuple[VulnerabilityModel, PackageVulnerabilityModel]]:
        """Get vulnerabilities for a package."""
        conditions = [
            PackageVulnerabilityModel.package_id == package_id,
        ]

        if severity:
            conditions.append(VulnerabilityModel.severity == severity)
        if not include_fixed:
            conditions.append(PackageVulnerabilityModel.is_fixed == False)

        result = await db.execute(
            select(VulnerabilityModel, PackageVulnerabilityModel)
            .join(PackageVulnerabilityModel)
            .where(and_(*conditions))
            .order_by(VulnerabilityModel.cvss_score.desc().nullslast())
        )
        return list(result.all())

    async def get_vulnerability_summary(
        self,
        db: AsyncSession,
        package_ids: List[UUID],
    ) -> dict[str, Any]:
        """Get vulnerability summary for multiple packages."""
        # Count by severity
        severity_counts = (
            select(
                VulnerabilityModel.severity,
                func.count(VulnerabilityModel.id).label("count"),
            )
            .join(PackageVulnerabilityModel)
            .where(
                and_(
                    PackageVulnerabilityModel.package_id.in_(package_ids),
                    PackageVulnerabilityModel.is_fixed == False,
                )
            )
            .group_by(VulnerabilityModel.severity)
        )

        severity_result = await db.execute(severity_counts)
        severity_summary = {
            row.severity.value: row.count for row in severity_result.all()
        }

        # Count total vulnerabilities
        total_vulns = (
            select(func.count(VulnerabilityModel.id))
            .join(PackageVulnerabilityModel)
            .where(
                and_(
                    PackageVulnerabilityModel.package_id.in_(package_ids),
                    PackageVulnerabilityModel.is_fixed == False,
                )
            )
        )

        total_result = await db.execute(total_vulns)
        total_count = int(total_result.scalar() or 0)

        return {
            "total_vulnerabilities": total_count,
            "by_severity": severity_summary,
            "critical_count": severity_summary.get("CRITICAL", 0),
            "high_count": severity_summary.get("HIGH", 0),
            "medium_count": severity_summary.get("MEDIUM", 0),
            "low_count": severity_summary.get("LOW", 0),
        }

    async def get_dependency_graph(
        self,
        db: AsyncSession,
        graph_id: UUID,
        organization_id: Optional[UUID] = None,
    ) -> Optional[DependencyGraphModel]:
        """Get a dependency graph by ID."""
        conditions = [DependencyGraphModel.id == graph_id]

        if organization_id:
            conditions.append(DependencyGraphModel.organization_id == organization_id)

        result = await db.execute(
            select(DependencyGraphModel)
            .where(and_(*conditions))
            .options(joinedload(DependencyGraphModel.root_package))
        )
        return result.scalars().first()

    async def create_dependency_graph(
        self,
        db: AsyncSession,
        data: dict[str, Any],
    ) -> DependencyGraphModel:
        """Create a new dependency graph."""
        graph = DependencyGraphModel(**data)
        db.add(graph)
        await db.commit()
        await db.refresh(graph)
        return graph

    async def update_dependency_graph(
        self,
        db: AsyncSession,
        graph: DependencyGraphModel,
        data: dict[str, Any],
    ) -> DependencyGraphModel:
        """Update a dependency graph."""
        for key, value in data.items():
            if hasattr(graph, key):
                setattr(graph, key, value)

        graph.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(graph)
        return graph

    async def list_dependency_graphs(
        self,
        db: AsyncSession,
        organization_id: UUID,
        skip: int = 0,
        limit: int = 50,
        has_vulnerabilities: Optional[bool] = None,
        min_risk_score: Optional[float] = None,
        is_resolved: Optional[bool] = None,
    ) -> List[DependencyGraphModel]:
        """List dependency graphs for an organization."""
        conditions = [DependencyGraphModel.organization_id == organization_id]

        if has_vulnerabilities is not None:
            if has_vulnerabilities:
                conditions.append(DependencyGraphModel.total_vulnerabilities > 0)
            else:
                conditions.append(DependencyGraphModel.total_vulnerabilities == 0)

        if min_risk_score is not None:
            conditions.append(DependencyGraphModel.risk_score >= min_risk_score)

        if is_resolved is not None:
            conditions.append(DependencyGraphModel.is_resolved == is_resolved)

        result = await db.execute(
            select(DependencyGraphModel)
            .where(and_(*conditions))
            .order_by(DependencyGraphModel.created_at.desc())
            .offset(max(skip, 0))
            .limit(limit)
            .options(joinedload(DependencyGraphModel.root_package))
        )
        return list(result.scalars().all())

    async def get_licenses(
        self,
        db: AsyncSession,
        spdx_ids: Optional[List[str]] = None,
        is_osi_approved: Optional[bool] = None,
        allows_commercial: Optional[bool] = None,
    ) -> List[LicenseModel]:
        """Get licenses with optional filters."""
        conditions = []

        if spdx_ids:
            conditions.append(LicenseModel.spdx_id.in_(spdx_ids))
        if is_osi_approved is not None:
            conditions.append(LicenseModel.is_osi_approved == is_osi_approved)
        if allows_commercial is not None:
            conditions.append(LicenseModel.allows_commercial_use == allows_commercial)

        query = select(LicenseModel)
        if conditions:
            query = query.where(and_(*conditions))

        result = await db.execute(query.order_by(LicenseModel.name.asc()))
        return list(result.scalars().all())

    async def get_policies_for_organization(
        self,
        db: AsyncSession,
        organization_id: UUID,
        policy_type: Optional[str] = None,
        is_active: bool = True,
    ) -> List[PolicyModel]:
        """Get policies for an organization."""
        conditions = [
            PolicyModel.organization_id == organization_id,
            PolicyModel.is_active == is_active,
        ]

        if policy_type:
            conditions.append(PolicyModel.policy_type == policy_type)

        result = await db.execute(
            select(PolicyModel)
            .where(and_(*conditions))
            .order_by(PolicyModel.priority.asc(), PolicyModel.created_at.desc())
        )
        return list(result.scalars().all())

    async def bulk_create_or_update_packages(
        self,
        db: AsyncSession,
        packages_data: List[dict[str, Any]],
    ) -> List[PackageModel]:
        """Bulk create or update packages."""
        created_packages = []

        for package_data in packages_data:
            # Try to find existing package
            existing = await self.get_by_registry_key(
                db, package_data.get("registry_key", "")
            )

            if existing:
                # Update existing
                package = await self.update(db, existing, package_data)
            else:
                # Create new
                package = await self.create(db, package_data)

            created_packages.append(package)

        return created_packages

    async def get_popular_packages(
        self,
        db: AsyncSession,
        ecosystem: Optional[EcosystemType] = None,
        limit: int = 50,
        days: int = 30,
    ) -> List[PackageModel]:
        """Get popular packages based on recent activity."""
        # This is a simplified version - in practice, you might track downloads
        # or usage metrics in a separate table
        conditions = [PackageModel.is_deleted == False]

        if ecosystem:
            conditions.append(PackageModel.ecosystem == ecosystem)

        # For now, sort by published_at as a proxy for popularity
        result = await db.execute(
            select(PackageModel)
            .where(and_(*conditions))
            .order_by(PackageModel.published_at.desc().nullslast())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_package_dependencies(
        self,
        db: AsyncSession,
        package_id: UUID,
        depth: int = 1,
    ) -> dict[str, Any]:
        """Get dependency tree for a package."""
        # This is a simplified implementation
        # In practice, you might have a separate dependencies table
        package = await self.get(db, package_id)
        if not package:
            return {}

        # Get dependency graphs where this package is the root
        graphs = await db.execute(
            select(DependencyGraphModel)
            .where(DependencyGraphModel.root_package_id == package_id)
            .order_by(DependencyGraphModel.created_at.desc())
            .limit(1)
        )

        graph = graphs.scalars().first()
        if graph:
            return {
                "package_id": str(package_id),
                "dependencies": graph.dependencies,
                "total_packages": graph.total_packages,
                "depth": depth,
            }

        return {
            "package_id": str(package_id),
            "dependencies": [],
            "total_packages": 0,
            "depth": depth,
        }

    async def check_license_compatibility(
        self,
        db: AsyncSession,
        package_ids: List[UUID],
        organization_id: UUID,
    ) -> dict[str, Any]:
        """Check license compatibility for packages against organization policies."""
        # Get packages
        packages_result = await db.execute(
            select(PackageModel)
            .where(PackageModel.id.in_(package_ids))
            .where(PackageModel.is_deleted == False)
        )
        packages = packages_result.scalars().all()

        # Get organization policies
        policies = await self.get_policies_for_organization(
            db, organization_id, "license"
        )

        # Get organization settings (simplified)
        org_result = await db.execute(
            select(DependencyGraphModel.organization_id)
            .where(DependencyGraphModel.organization_id == organization_id)
            .limit(1)
        )

        # Check each package
        incompatible_packages = []
        compatible_packages = []

        for package in packages:
            is_compatible = True
            issues = []

            # Check license type
            if package.license and not package.license.allows_commercial_use:
                is_compatible = False
                issues.append("License does not allow commercial use")

            # Check if license is blocked
            # This would need to be implemented based on organization settings

            if is_compatible:
                compatible_packages.append(
                    {
                        "id": str(package.id),
                        "name": package.name,
                        "license": package.license.spdx_id if package.license else None,
                    }
                )
            else:
                incompatible_packages.append(
                    {
                        "id": str(package.id),
                        "name": package.name,
                        "license": package.license.spdx_id if package.license else None,
                        "issues": issues,
                    }
                )

        return {
            "total_packages": len(packages),
            "compatible_count": len(compatible_packages),
            "incompatible_count": len(incompatible_packages),
            "compatible_packages": compatible_packages,
            "incompatible_packages": incompatible_packages,
        }

"""
Dependency service for Universal Dependency Platform.
"""

from typing import Any, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from udp.core.models.dependency import (
    Dependency,
    DependencyAnalysis,
)
from udp.core.schemas.dependency import (
    DependencyAnalysis as DependencyAnalysisSchema,
)
from udp.core.schemas.dependency import (
    DependencyCreate,
    DependencySearch,
    DependencyUpdate,
    Vulnerability,
    VulnerabilitySeverity,
)


class DependencyService:
    """Dependency service class."""

    def __init__(self, db: AsyncSession):
        """Initialize dependency service."""
        self.db = db

    async def create(self, dependency_data: DependencyCreate) -> Dependency:
        """Create a new dependency."""
        db_dependency = Dependency(
            name=dependency_data.name,
            version=dependency_data.version,
            language=dependency_data.language.value,
            framework=dependency_data.framework.value
            if dependency_data.framework
            else None,
            description=dependency_data.description,
            repository_url=dependency_data.repository_url,
            license=dependency_data.license.value if dependency_data.license else None,
            is_active=dependency_data.is_active,
            metadata=dependency_data.metadata,
            created_by=dependency_data.created_by
            if hasattr(dependency_data, "created_by")
            else None,
        )

        self.db.add(db_dependency)
        await self.db.commit()
        await self.db.refresh(db_dependency)

        return db_dependency

    async def get(self, dependency_id: str) -> Optional[Dependency]:
        """Get dependency by ID."""
        from uuid import UUID

        try:
            dependency_uuid = UUID(dependency_id)
        except ValueError:
            return None

        result = await self.db.execute(
            select(Dependency).where(Dependency.id == dependency_uuid)
        )
        return result.scalar_one_or_none()

    async def get_by_name_version(
        self, name: str, version: str, language: str
    ) -> Optional[Dependency]:
        """Get dependency by name, version, and language."""
        result = await self.db.execute(
            select(Dependency).where(
                and_(
                    Dependency.name == name,
                    Dependency.version == version,
                    Dependency.language == language,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self, skip: int = 0, limit: int = 100, filters: Optional[dict[str, Any]] = None
    ) -> list[Dependency]:
        """List dependencies with filtering and pagination."""
        query = select(Dependency)

        if filters:
            if "language" in filters:
                query = query.where(Dependency.language == filters["language"])
            if "framework" in filters:
                query = query.where(Dependency.framework == filters["framework"])
            if "search" in filters:
                search_term = f"%{filters['search']}%"
                query = query.where(
                    or_(
                        Dependency.name.ilike(search_term),
                        Dependency.description.ilike(search_term),
                    )
                )

        query = query.offset(skip).limit(limit).order_by(Dependency.created_at.desc())

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(
        self, dependency_id: str, dependency_data: DependencyUpdate
    ) -> Optional[Dependency]:
        """Update dependency."""
        db_dependency = await self.get(dependency_id)
        if not db_dependency:
            return None

        update_data = dependency_data.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(value, "value"):  # Handle enum values
                setattr(db_dependency, field, value.value)
            else:
                setattr(db_dependency, field, value)

        await self.db.commit()
        await self.db.refresh(db_dependency)

        return db_dependency

    async def delete(self, dependency_id: str) -> bool:
        """Delete dependency."""
        db_dependency = await self.get(dependency_id)
        if not db_dependency:
            return False

        await self.db.delete(db_dependency)
        await self.db.commit()

        return True

    async def search(self, search_query: DependencySearch) -> List[Dependency]:
        """Search dependencies with advanced filters."""
        query = select(Dependency)

        if search_query.query:
            search_term = f"%{search_query.query}%"
            query = query.where(
                or_(
                    Dependency.name.ilike(search_term),
                    Dependency.description.ilike(search_term),
                )
            )

        if search_query.language:
            query = query.where(Dependency.language == search_query.language.value)

        if search_query.framework:
            query = query.where(Dependency.framework == search_query.framework.value)

        if search_query.license:
            query = query.where(Dependency.license == search_query.license.value)

        if search_query.min_version:
            query = query.where(Dependency.version >= search_query.min_version)

        if search_query.max_version:
            query = query.where(Dependency.version <= search_query.max_version)

        # Sorting
        if search_query.sort_by == "name":
            order_field = Dependency.name
        elif search_query.sort_by == "version":
            order_field = Dependency.version
        else:
            order_field = Dependency.created_at

        if search_query.sort_order == "asc":
            query = query.order_by(order_field.asc())
        else:
            query = query.order_by(order_field.desc())

        query = query.offset(search_query.offset).limit(search_query.limit)

        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_popular(self, language: str, limit: int = 10) -> List[Dependency]:
        """Get popular dependencies for a language."""
        # This is a simplified implementation
        # In a real system, you'd track usage statistics
        query = (
            select(Dependency)
            .where(Dependency.language == language)
            .order_by(Dependency.created_at.desc())
            .limit(limit)
        )

        result = await self.db.execute(query)
        return result.scalars().all()

    async def analyze(self, dependency_id: str) -> DependencyAnalysisSchema:
        """Analyze dependency for security vulnerabilities and compatibility."""
        dependency = await self.get(dependency_id)
        if not dependency:
            raise ValueError("Dependency not found")

        # Mock analysis - in a real implementation, you would:
        # 1. Query vulnerability databases (CVE, OSV, etc.)
        # 2. Check compatibility with your project
        # 3. Analyze maintenance status
        # 4. Check license compatibility

        vulnerabilities = [
            Vulnerability(
                id="CVE-2023-1234",
                title="Mock Vulnerability",
                description="This is a mock vulnerability for demonstration",
                severity=VulnerabilitySeverity.MEDIUM,
                cvss_score=6.5,
                cve_id="CVE-2023-1234",
                patched_versions=["1.2.3", "1.2.4"],
            )
        ]

        analysis = DependencyAnalysisSchema(
            dependency_id=dependency_id,
            vulnerabilities=vulnerabilities,
            compatibility_score=0.85,
            maintenance_score=0.90,
            popularity_score=0.75,
            license_compatible=True,
            recommendations=[
                "Update to latest version",
                "Review license terms",
                "Check for known vulnerabilities",
            ],
            analyzed_at=dependency.updated_at,
        )

        # Save analysis to database
        db_analysis = DependencyAnalysis(
            dependency_id=dependency.id,
            vulnerabilities=[v.dict() for v in vulnerabilities],
            compatibility_score=str(analysis.compatibility_score),
            maintenance_score=str(analysis.maintenance_score),
            popularity_score=str(analysis.popularity_score),
            license_compatible=analysis.license_compatible,
            recommendations=analysis.recommendations,
            analyzed_at=analysis.analyzed_at,
        )

        self.db.add(db_analysis)
        await self.db.commit()

        return analysis

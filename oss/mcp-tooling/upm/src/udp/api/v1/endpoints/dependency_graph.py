"""Dependency Graph API endpoints for visualization."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.models.user import User
from ....infrastructure.database import get_async_session
from ....security.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dependency-graph", tags=["dependency-graph"])


class NodeData(BaseModel):
    """Data for a node in the dependency graph."""

    id: str
    name: str
    version: str
    ecosystem: str
    vulnerabilities: int = 0
    highest_severity: Optional[str] = None
    is_direct: bool = False
    is_deprecated: bool = False
    license: Optional[str] = None


class LinkData(BaseModel):
    """Data for a link in the dependency graph."""

    source: str
    target: str
    type: str = "depends_on"  # depends_on, dev_depends_on, peer_depends_on


class DependencyGraphResponse(BaseModel):
    """Response model for dependency graph."""

    nodes: list[dict[str, Any]]
    links: list[dict[str, Any]]
    stats: dict[str, Any]


class VulnerableDependenciesResponse(BaseModel):
    """Response model for vulnerable dependencies in graph view."""

    vulnerable_packages: list[dict[str, Any]]
    total_affected: int
    critical_count: int
    high_count: int


@router.get("/{project_id}", response_model=DependencyGraphResponse)
async def get_dependency_graph(
    project_id: str,
    include_transitive: bool = Query(
        True, description="Include transitive dependencies"
    ),
    max_depth: int = Query(
        3, ge=1, le=5, description="Maximum depth of dependency tree"
    ),
    include_vulnerabilities: bool = Query(
        True, description="Include vulnerability data"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> DependencyGraphResponse:
    """Get dependency graph for a project.

    Returns a graph structure suitable for D3.js force-directed visualization.

    The graph includes:
    - Nodes: Each dependency as a node with metadata
    - Links: Relationships between dependencies
    - Stats: Summary statistics about the graph
    """
    # Generate mock dependency graph data
    # In production, this would query the actual dependency data from the database

    nodes, links = _generate_mock_graph_data(
        project_id=project_id,
        include_transitive=include_transitive,
        max_depth=max_depth,
        include_vulnerabilities=include_vulnerabilities,
    )

    stats = _calculate_graph_stats(nodes, links)

    return DependencyGraphResponse(
        nodes=nodes,
        links=links,
        stats=stats,
    )


@router.get("/{project_id}/vulnerable", response_model=VulnerableDependenciesResponse)
async def get_vulnerable_dependencies(
    project_id: str,
    min_severity: str = Query("medium", description="Minimum severity level"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> VulnerableDependenciesResponse:
    """Get vulnerable dependencies for a project.

    Returns a list of dependencies with vulnerabilities, suitable for
    highlighting in the dependency graph visualization.
    """
    # Mock data
    vulnerable_packages = [
        {
            "id": "maven:org.apache.logging.log4j:log4j-core:2.14.1",
            "name": "log4j-core",
            "ecosystem": "maven",
            "version": "2.14.1",
            "vulnerabilities": [
                {
                    "id": "CVE-2021-44228",
                    "severity": "critical",
                    "cvss_score": 9.8,
                    "description": "Remote code execution via JNDI",
                },
            ],
            "affected_paths": [
                ["payment-service", "log4j-core"],
                ["user-auth-api", "log4j-core"],
            ],
            "fix_available": True,
            "fixed_version": "2.17.1",
            "is_transitive": False,
        },
        {
            "id": "npm:lodash:4.17.15",
            "name": "lodash",
            "ecosystem": "npm",
            "version": "4.17.15",
            "vulnerabilities": [
                {
                    "id": "CVE-2021-23337",
                    "severity": "high",
                    "cvss_score": 7.5,
                    "description": "Command injection via template",
                },
            ],
            "affected_paths": [
                ["frontend-app", "lodash"],
                ["admin-panel", "lodash"],
            ],
            "fix_available": True,
            "fixed_version": "4.17.21",
            "is_transitive": False,
        },
        {
            "id": "pypi:requests:2.25.0",
            "name": "requests",
            "ecosystem": "pypi",
            "version": "2.25.0",
            "vulnerabilities": [
                {
                    "id": "CVE-2023-32681",
                    "severity": "medium",
                    "cvss_score": 5.3,
                    "description": "Potential certificate verification bypass",
                },
            ],
            "affected_paths": [
                ["api-gateway", "urllib3", "requests"],
            ],
            "fix_available": True,
            "fixed_version": "2.31.0",
            "is_transitive": True,
        },
    ]

    # Filter by severity
    severity_order = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    min_sev_level = severity_order.get(min_severity.lower(), 2)

    filtered = [
        p
        for p in vulnerable_packages
        if any(
            severity_order.get(v["severity"].lower(), 0) >= min_sev_level
            for v in p["vulnerabilities"]
        )
    ]

    critical_count = sum(
        1
        for p in filtered
        if any(v["severity"] == "critical" for v in p["vulnerabilities"])
    )
    high_count = sum(
        1
        for p in filtered
        if any(v["severity"] == "high" for v in p["vulnerabilities"])
    )

    return VulnerableDependenciesResponse(
        vulnerable_packages=filtered,
        total_affected=len(filtered),
        critical_count=critical_count,
        high_count=high_count,
    )


@router.get("/{project_id}/path-to-root/{package_id}")
async def get_path_to_root(
    project_id: str,
    package_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Get all paths from a transitive dependency back to the project root.

    Useful for understanding why a specific vulnerable dependency is included
    and which direct dependencies bring it in.
    """
    # Mock paths
    paths = [
        {
            "path": ["payment-service", "spring-boot-starter", "log4j-core"],
            "length": 3,
            "via": "spring-boot-starter",
        },
        {
            "path": ["user-auth-api", "spring-security", "log4j-core"],
            "length": 3,
            "via": "spring-security",
        },
    ]

    return {
        "package_id": package_id,
        "project_id": project_id,
        "paths": paths,
        "total_paths": len(paths),
        "shortest_path_length": min(p["length"] for p in paths) if paths else 0,
    }


@router.get("/{project_id}/impact-analysis/{package_id}")
async def get_impact_analysis(
    project_id: str,
    package_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Analyze the impact of updating a specific dependency.

    Returns information about what would break if the dependency is updated,
    including downstream dependencies and potential compatibility issues.
    """
    return {
        "package_id": package_id,
        "project_id": project_id,
        "current_version": "2.14.1",
        "suggested_version": "2.17.1",
        "impact": {
            "breaking_changes": True,
            "affected_dependents": [
                {
                    "name": "spring-boot-starter",
                    "constraint": "2.14.x",
                    "compatible": False,
                },
            ],
            "test_coverage": "85%",
            "estimated_effort": "2-4 hours",
        },
        "recommendations": [
            "Update spring-boot-starter to latest version first",
            "Run full test suite after update",
            "Check for API changes in log4j 2.17.x",
        ],
    }


def _generate_mock_graph_data(
    project_id: str,
    include_transitive: bool,
    max_depth: int,
    include_vulnerabilities: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Generate mock dependency graph data."""
    # Root node (the project itself)
    nodes = [
        {
            "id": f"project:{project_id}",
            "name": project_id,
            "type": "project",
            "ecosystem": "multi",
            "version": "1.0.0",
            "vulnerabilities": 0,
            "highest_severity": None,
            "depth": 0,
            "is_direct": True,
        }
    ]

    links = []

    # Direct dependencies
    direct_deps = [
        ("maven", "org.springframework.boot", "spring-boot-starter", "2.7.0"),
        ("maven", "org.apache.logging.log4j", "log4j-core", "2.14.1"),
        ("npm", "lodash", "lodash", "4.17.15"),
        ("npm", "react", "react", "18.2.0"),
        ("pypi", "requests", "requests", "2.28.0"),
    ]

    for i, (eco, group, name, ver) in enumerate(direct_deps, 1):
        dep_id = f"{eco}:{group}:{name}:{ver}"
        vulns = 1 if name == "log4j-core" else (2 if name == "lodash" else 0)
        severity = (
            "critical"
            if name == "log4j-core"
            else ("high" if name == "lodash" else None)
        )

        nodes.append(
            {
                "id": dep_id,
                "name": name,
                "type": "dependency",
                "ecosystem": eco,
                "group": group,
                "version": ver,
                "vulnerabilities": vulns if include_vulnerabilities else 0,
                "highest_severity": severity if include_vulnerabilities else None,
                "depth": 1,
                "is_direct": True,
            }
        )

        links.append(
            {
                "source": f"project:{project_id}",
                "target": dep_id,
                "type": "depends_on",
            }
        )

        # Add transitive dependencies if requested
        if include_transitive and max_depth > 1:
            if name == "spring-boot-starter":
                transitive = [
                    ("maven", "org.springframework", "spring-context", "5.3.20"),
                    ("maven", "org.apache.tomcat.embed", "tomcat-core", "9.0.63"),
                ]
            elif name == "react":
                transitive = [
                    ("npm", "", "react-dom", "18.2.0"),
                    ("npm", "", "scheduler", "0.23.0"),
                ]
            elif name == "requests":
                transitive = [
                    ("pypi", "", "urllib3", "1.26.9"),
                    ("pypi", "", "certifi", "2022.12.7"),
                ]
            else:
                transitive = []

            for j, (t_eco, t_group, t_name, t_ver) in enumerate(transitive, 2):
                t_id = (
                    f"{t_eco}:{t_group}:{t_name}:{t_ver}"
                    if t_group
                    else f"{t_eco}:{t_name}:{t_ver}"
                )

                nodes.append(
                    {
                        "id": t_id,
                        "name": t_name,
                        "type": "dependency",
                        "ecosystem": t_eco,
                        "group": t_group,
                        "version": t_ver,
                        "vulnerabilities": 0,
                        "highest_severity": None,
                        "depth": j,
                        "is_direct": False,
                    }
                )

                links.append(
                    {
                        "source": dep_id,
                        "target": t_id,
                        "type": "depends_on",
                    }
                )

    return nodes, links


def _calculate_graph_stats(
    nodes: list[dict[str, Any]],
    links: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate statistics about the dependency graph."""
    direct_count = sum(1 for n in nodes if n.get("is_direct"))
    transitive_count = len(nodes) - direct_count - 1  # -1 for project node

    vulnerable_count = sum(1 for n in nodes if n.get("vulnerabilities", 0) > 0)
    critical_count = sum(1 for n in nodes if n.get("highest_severity") == "critical")
    high_count = sum(1 for n in nodes if n.get("highest_severity") == "high")

    ecosystems = set(n.get("ecosystem") for n in nodes if n.get("ecosystem") != "multi")

    max_depth = max((n.get("depth", 0) for n in nodes), default=0)

    return {
        "total_nodes": len(nodes),
        "total_links": len(links),
        "direct_dependencies": direct_count,
        "transitive_dependencies": transitive_count,
        "vulnerable_dependencies": vulnerable_count,
        "critical_vulnerabilities": critical_count,
        "high_vulnerabilities": high_count,
        "ecosystems": list(ecosystems),
        "max_depth": max_depth,
    }

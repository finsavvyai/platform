"""Training data collection for UPM ML models.

Collects package usage data from public sources (PyPI, Maven Central, npm)
to train recommendation and risk prediction models.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import aiohttp
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class PackageUsageRecord:
    """A single record of package usage data."""

    package_id: str
    package_name: str
    ecosystem: str
    version: str
    download_count: int
    timestamp: datetime
    project_count: int
    popularity_score: float
    security_score: float
    maintainer_count: int
    open_issues: int
    closed_issues: int
    forks: int
    stars: int
    last_commit_days: int
    license_type: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data


@dataclass
class VulnerabilityRecord:
    """A single record of vulnerability data for training."""

    cve_id: str
    package_id: str
    ecosystem: str
    severity: str
    cvss_score: float
    published_date: datetime
    modified_date: Optional[datetime] = None
    description: str = ""
    affected_versions: list[str] = field(default_factory=list)
    fixed_versions: list[str] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)  # For classification

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data["published_date"] = self.published_date.isoformat()
        if self.modified_date:
            data["modified_date"] = self.modified_date.isoformat()
        return data


class DataSource(ABC):
    """Abstract base class for data sources."""

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self._session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args):
        if self._session:
            await self._session.close()

    @abstractmethod
    async def fetch_package_stats(
        self, package_name: str, ecosystem: str
    ) -> Optional[dict[str, Any]]:
        """Fetch statistics for a single package."""
        pass

    @abstractmethod
    async def search_packages(
        self, query: str, ecosystem: str, limit: int = 100
    ) -> AsyncIterator[dict[str, Any]]:
        """Search for packages matching a query."""
        pass

    @abstractmethod
    async def fetch_vulnerabilities(
        self, ecosystem: str, since: Optional[datetime] = None
    ) -> AsyncIterator[VulnerabilityRecord]:
        """Fetch vulnerability data."""
        pass


class MavenCentralDataSource(DataSource):
    """Data source for Maven Central packages."""

    BASE_URL = "https://search.maven.org/solrsearch/select"
    SONATYPE_URL = "https://oss.sonatype.org"

    async def fetch_package_stats(
        self, package_name: str, ecosystem: str
    ) -> Optional[dict[str, Any]]:
        """Fetch Maven package statistics from Maven Central."""
        if not self._session:
            return None

        try:
            # Search for the package
            params = {
                "q": f"g:{package_name.split(':')[0]} AND a:{package_name.split(':')[1]}",
                "rows": 1,
                "wt": "json",
            }

            async with self._session.get(self.BASE_URL, params=params) as response:
                if response.status != 200:
                    return None

                data = await response.json()

                if not data.get("response", {}).get("docs"):
                    return None

                doc = data["response"]["docs"][0]

                return {
                    "package_id": f"{doc.get('g')}:{doc.get('a')}",
                    "package_name": f"{doc.get('g')}:{doc.get('a')}",
                    "ecosystem": "maven",
                    "version": doc.get("v", ""),
                    "download_count": doc.get("p", 0),  # Not directly available
                    "timestamp": datetime.now().isoformat(),
                    "popularity_score": doc.get("timestamp", 0) / 1e9
                    if "timestamp" in doc
                    else 0.5,
                }
        except Exception as e:
            logger.warning(f"Failed to fetch Maven stats for {package_name}: {e}")
            return None

    async def search_packages(
        self, query: str, ecosystem: str, limit: int = 100
    ) -> AsyncIterator[dict[str, Any]]:
        """Search Maven Central for packages."""
        if not self._session or ecosystem != "maven":
            return

        params = {
            "q": query,
            "rows": min(limit, 100),
            "wt": "json",
        }

        try:
            async with self._session.get(self.BASE_URL, params=params) as response:
                if response.status != 200:
                    return

                data = await response.json()
                docs = data.get("response", {}).get("docs", [])

                for doc in docs:
                    yield {
                        "package_id": f"{doc.get('g')}:{doc.get('a')}",
                        "package_name": f"{doc.get('g')}:{doc.get('a')}",
                        "ecosystem": "maven",
                        "version": doc.get("v", ""),
                    }
        except Exception as e:
            logger.error(f"Failed to search Maven Central: {e}")

    async def fetch_vulnerabilities(
        self, ecosystem: str, since: Optional[datetime] = None
    ) -> AsyncIterator[VulnerabilityRecord]:
        """Fetch vulnerability data from Maven Central/OSV."""
        # Maven Central doesn't have vulnerability data directly
        # We'll use OSV.dev for this
        if not self._session or ecosystem != "maven":
            return

        osv_url = "https://api.osv.dev/v1/query"

        # Query for recent Maven vulnerabilities
        query = {
            "ecosystem": "Maven",
        }

        try:
            async with self._session.post(osv_url, json=query) as response:
                if response.status != 200:
                    return

                data = await response.json()
                vulns = data.get("items", [])

                for vuln in vulns[:100]:  # Limit for demo
                    yield self._parse_osv_vulnerability(vuln)
        except Exception as e:
            logger.error(f"Failed to fetch Maven vulnerabilities: {e}")

    def _parse_osv_vulnerability(self, vuln: dict[str, Any]) -> VulnerabilityRecord:
        """Parse OSV vulnerability data."""
        id_str = vuln.get("id", "")
        severity = "UNKNOWN"
        cvss_score = 0.0

        # Extract severity
        for affected in vuln.get("affected", []):
            for sev in affected.get("database_specific", {}).get("severity", []):
                if sev.get("type") == "CVSS_V3":
                    cvss_score = sev.get("score", 0.0)
                    if cvss_score >= 9.0:
                        severity = "CRITICAL"
                    elif cvss_score >= 7.0:
                        severity = "HIGH"
                    elif cvss_score >= 4.0:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    break

        # Get affected package
        affected = vuln.get("affected", [{}])[0]
        package = affected.get("package", {})
        ecosystem = package.get("ecosystem", "")
        name = package.get("name", "")

        # Get versions
        affected_versions = []
        for affected_item in vuln.get("affected", []):
            for rng in affected_item.get("versions", []):
                affected_versions.append(rng)

        return VulnerabilityRecord(
            cve_id=id_str,
            package_id=f"maven:{name}",
            ecosystem=ecosystem,
            severity=severity,
            cvss_score=cvss_score,
            published_date=datetime.fromisoformat(
                vuln.get("published", "2020-01-01").replace("Z", "+00:00")
            ),
            modified_date=None,
            description=vuln.get("summary", "") or vuln.get("details", ""),
            affected_versions=affected_versions,
            fixed_versions=[],
            references=[],
            labels=[severity.lower()],
        )


class PyPIDataSource(DataSource):
    """Data source for PyPI packages."""

    BASE_URL = "https://pypi.org/pypi"
    PYPI_STATS_URL = "https://pypistats.org/api"

    async def fetch_package_stats(
        self, package_name: str, ecosystem: str
    ) -> Optional[dict[str, Any]]:
        """Fetch PyPI package statistics."""
        if not self._session or ecosystem != "pypi":
            return None

        try:
            url = f"{self.BASE_URL}/{package_name}/json"
            async with self._session.get(url) as response:
                if response.status != 200:
                    return None

                data = await response.json()

                info = data.get("info", {})
                release_info = data.get("releases", {})

                return {
                    "package_id": f"pypi:{package_name}",
                    "package_name": package_name,
                    "ecosystem": "pypi",
                    "version": info.get("version", ""),
                    "download_count": 0,  # PyPI stats require separate API
                    "timestamp": datetime.now().isoformat(),
                    "popularity_score": self._calculate_pypi_popularity(data),
                    "license_type": info.get("license"),
                    "summary": info.get("summary", ""),
                    "author": info.get("author", ""),
                    "classifiers": info.get("classifiers", []),
                }
        except Exception as e:
            logger.warning(f"Failed to fetch PyPI stats for {package_name}: {e}")
            return None

    def _calculate_pypi_popularity(self, package_data: dict[str, Any]) -> float:
        """Calculate a normalized popularity score from PyPI data."""
        info = package_data.get("info", {})
        upload_time = info.get("upload_time")

        score = 0.5  # Base score

        # Factors that increase popularity
        if info.get("project_url"):
            score += 0.1
        if info.get("docs_url"):
            score += 0.1
        if len(package_data.get("releases", {})) > 5:
            score += 0.2

        return min(score, 1.0)

    async def search_packages(
        self, query: str, ecosystem: str, limit: int = 100
    ) -> AsyncIterator[dict[str, Any]]:
        """Search PyPI for packages."""
        if not self._session or ecosystem != "pypi":
            return

        url = f"{self.BASE_URL}/pypi"
        params = {
            "q": query,
            "limit": str(min(limit, 100)),
        }

        try:
            async with self._session.get(url, params=params) as response:
                if response.status != 200:
                    return

                data = await response.json()

                for item in data.get("results", [])[:limit]:
                    yield {
                        "package_id": f"pypi:{item.get('name')}",
                        "package_name": item.get("name"),
                        "ecosystem": "pypi",
                        "version": item.get("version", ""),
                        "summary": item.get("summary", ""),
                    }
        except Exception as e:
            logger.error(f"Failed to search PyPI: {e}")

    async def fetch_vulnerabilities(
        self, ecosystem: str, since: Optional[datetime] = None
    ) -> AsyncIterator[VulnerabilityRecord]:
        """Fetch vulnerability data from OSV for PyPI."""
        if not self._session or ecosystem != "pypi":
            return

        osv_url = "https://api.osv.dev/v1/query"
        query = {"ecosystem": "PyPI"}

        try:
            async with self._session.post(osv_url, json=query) as response:
                if response.status != 200:
                    return

                data = await response.json()
                vulns = data.get("items", [])

                for vuln in vulns[:100]:
                    yield self._parse_osv_vulnerability(vuln)
        except Exception as e:
            logger.error(f"Failed to fetch PyPI vulnerabilities: {e}")

    def _parse_osv_vulnerability(self, vuln: dict[str, Any]) -> VulnerabilityRecord:
        """Parse OSV vulnerability data."""
        id_str = vuln.get("id", "")
        severity = "UNKNOWN"
        cvss_score = 0.0

        for affected in vuln.get("affected", []):
            for sev in affected.get("database_specific", {}).get("severity", []):
                if sev.get("type") == "CVSS_V3":
                    cvss_score = sev.get("score", 0.0)
                    if cvss_score >= 9.0:
                        severity = "CRITICAL"
                    elif cvss_score >= 7.0:
                        severity = "HIGH"
                    elif cvss_score >= 4.0:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    break

        affected = vuln.get("affected", [{}])[0]
        package = affected.get("package", {})
        name = package.get("name", "")

        return VulnerabilityRecord(
            cve_id=id_str,
            package_id=f"pypi:{name}",
            ecosystem="PyPI",
            severity=severity,
            cvss_score=cvss_score,
            published_date=datetime.fromisoformat(
                vuln.get("published", "2020-01-01").replace("Z", "+00:00")
            ),
            description=vuln.get("summary", "") or vuln.get("details", ""),
            affected_versions=affected.get("versions", []),
            fixed_versions=[],
            references=[],
            labels=[severity.lower()],
        )


class NPMDataSource(DataSource):
    """Data source for npm packages."""

    REGISTRY_URL = "https://registry.npmjs.org"

    async def fetch_package_stats(
        self, package_name: str, ecosystem: str
    ) -> Optional[dict[str, Any]]:
        """Fetch npm package statistics."""
        if not self._session or ecosystem != "npm":
            return None

        try:
            url = f"{self.REGISTRY_URL}/{package_name}"
            async with self._session.get(url) as response:
                if response.status != 200:
                    return None

                data = await response.json()

                latest = data.get("dist-tags", {}).get("latest", {})
                version_info = data.get("versions", {}).get(latest, {})

                return {
                    "package_id": f"npm:{package_name}",
                    "package_name": package_name,
                    "ecosystem": "npm",
                    "version": latest,
                    "download_count": 0,
                    "timestamp": datetime.now().isoformat(),
                    "popularity_score": self._calculate_npm_popularity(data),
                    "license_type": version_info.get("license"),
                    "description": version_info.get("description", ""),
                    "keywords": version_info.get("keywords", []),
                    "homepage": version_info.get("homepage", ""),
                }
        except Exception as e:
            logger.warning(f"Failed to fetch npm stats for {package_name}: {e}")
            return None

    def _calculate_npm_popularity(self, package_data: dict[str, Any]) -> float:
        """Calculate npm popularity score."""
        score = 0.5

        # Check for GitHub repository
        latest = package_data.get("dist-tags", {}).get("latest", "")
        version_info = package_data.get("versions", {}).get(latest, {})

        if version_info.get("repository"):
            score += 0.2
        if version_info.get("homepage"):
            score += 0.1
        if version_info.get("keywords"):
            score += 0.1

        # Time since last update
        time = version_info.get("time", {})
        if time:
            modified = datetime.fromisoformat(time.replace("Z", "+00:00"))
            days_old = (datetime.now() - modified).days
            if days_old < 30:
                score += 0.1

        return min(score, 1.0)

    async def search_packages(
        self, query: str, ecosystem: str, limit: int = 100
    ) -> AsyncIterator[dict[str, Any]]:
        """Search npm registry for packages."""
        if not self._session or ecosystem != "npm":
            return

        url = f"{self.REGISTRY_URL}/-/v1/search"
        params = {
            "text": query,
            "size": min(limit, 100),
        }

        try:
            async with self._session.get(url, params=params) as response:
                if response.status != 200:
                    return

                data = await response.json()

                for obj in data.get("objects", [])[:limit]:
                    package = obj.get("package", {})
                    yield {
                        "package_id": f"npm:{package.get('name')}",
                        "package_name": package.get("name"),
                        "ecosystem": "npm",
                        "version": package.get("version", ""),
                        "description": package.get("description", ""),
                        "keywords": package.get("keywords", []),
                    }
        except Exception as e:
            logger.error(f"Failed to search npm: {e}")

    async def fetch_vulnerabilities(
        self, ecosystem: str, since: Optional[datetime] = None
    ) -> AsyncIterator[VulnerabilityRecord]:
        """Fetch npm vulnerability data from OSV."""
        if not self._session or ecosystem != "npm":
            return

        osv_url = "https://api.osv.dev/v1/query"
        query = {"ecosystem": "npm"}

        try:
            async with self._session.post(osv_url, json=query) as response:
                if response.status != 200:
                    return

                data = await response.json()
                vulns = data.get("items", [])

                for vuln in vulns[:100]:
                    yield self._parse_osv_vulnerability(vuln)
        except Exception as e:
            logger.error(f"Failed to fetch npm vulnerabilities: {e}")

    def _parse_osv_vulnerability(self, vuln: dict[str, Any]) -> VulnerabilityRecord:
        """Parse OSV vulnerability data."""
        id_str = vuln.get("id", "")
        severity = "UNKNOWN"
        cvss_score = 0.0

        for affected in vuln.get("affected", []):
            for sev in affected.get("database_specific", {}).get("severity", []):
                if sev.get("type") == "CVSS_V3":
                    cvss_score = sev.get("score", 0.0)
                    if cvss_score >= 9.0:
                        severity = "CRITICAL"
                    elif cvss_score >= 7.0:
                        severity = "HIGH"
                    elif cvss_score >= 4.0:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    break

        affected = vuln.get("affected", [{}])[0]
        package = affected.get("package", {})
        name = package.get("name", "")

        return VulnerabilityRecord(
            cve_id=id_str,
            package_id=f"npm:{name}",
            ecosystem="npm",
            severity=severity,
            cvss_score=cvss_score,
            published_date=datetime.fromisoformat(
                vuln.get("published", "2020-01-01").replace("Z", "+00:00")
            ),
            description=vuln.get("summary", "") or vuln.get("details", ""),
            affected_versions=affected.get("versions", []),
            fixed_versions=[],
            references=[],
            labels=[severity.lower()],
        )


class TrainingDataCollector:
    """Collects training data from multiple sources for UPM ML models."""

    def __init__(self, output_dir: str = "./data/training"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.sources: dict[str, DataSource] = {
            "maven": MavenCentralDataSource(),
            "pypi": PyPIDataSource(),
            "npm": NPMDataSource(),
        }

    async def collect_package_usage_data(
        self,
        ecosystems: list[str] = ["maven", "pypi", "npm"],
        sample_size: int = 1000,
        queries: Optional[list[str]] = None,
    ) -> list[PackageUsageRecord]:
        """Collect package usage data from public sources.

        Args:
            ecosystems: List of ecosystems to collect data from
            sample_size: Target number of records per ecosystem
            queries: Search queries for finding packages

        Returns:
            List of package usage records
        """
        if queries is None:
            queries = [
                "spring",
                "logging",
                "json",
                "web",
                "data",
                "utils",
                "http",
                "test",
                "security",
                "database",
            ]

        records: list[PackageUsageRecord] = []

        for ecosystem in ecosystems:
            source = self.sources.get(ecosystem)
            if not source:
                logger.warning(f"No data source for ecosystem: {ecosystem}")
                continue

            logger.info(f"Collecting data from {ecosystem}...")

            async with source:
                collected = 0
                for query in queries:
                    if collected >= sample_size:
                        break

                    async for pkg_data in source.search_packages(
                        query, ecosystem, limit=100
                    ):
                        if collected >= sample_size:
                            break

                        # Get detailed stats
                        stats = await source.fetch_package_stats(
                            pkg_data["package_name"],
                            ecosystem,
                        )

                        if stats:
                            record = PackageUsageRecord(
                                package_id=stats["package_id"],
                                package_name=stats["package_name"],
                                ecosystem=ecosystem,
                                version=stats.get("version", "0.0.0"),
                                download_count=stats.get("download_count", 0),
                                timestamp=datetime.now(),
                                project_count=0,
                                popularity_score=stats.get("popularity_score", 0.5),
                                security_score=0.5,  # Will be updated with vulnerability data
                                maintainer_count=1,
                                open_issues=0,
                                closed_issues=0,
                                forks=0,
                                stars=0,
                                last_commit_days=0,
                                license_type=stats.get("license_type"),
                            )
                            records.append(record)
                            collected += 1

                logger.info(f"Collected {collected} records from {ecosystem}")

        # Save to file
        self._save_usage_records(records)

        return records

    async def collect_vulnerability_data(
        self,
        ecosystems: list[str] = ["maven", "pypi", "npm"],
        limit: int = 500,
    ) -> list[VulnerabilityRecord]:
        """Collect vulnerability data for training risk prediction models.

        Args:
            ecosystems: List of ecosystems to collect data from
            limit: Maximum number of vulnerabilities per ecosystem

        Returns:
            List of vulnerability records
        """
        records: list[VulnerabilityRecord] = []

        for ecosystem in ecosystems:
            source = self.sources.get(ecosystem)
            if not source:
                continue

            logger.info(f"Collecting vulnerabilities from {ecosystem}...")

            async with source:
                collected = 0
                async for vuln in source.fetch_vulnerabilities(ecosystem):
                    if collected >= limit:
                        break
                    records.append(vuln)
                    collected += 1

                logger.info(f"Collected {collected} vulnerabilities from {ecosystem}")

        # Save to file
        self._save_vulnerability_records(records)

        return records

    def _save_usage_records(self, records: list[PackageUsageRecord]) -> None:
        """Save usage records to file."""
        output_file = self.output_dir / "package_usage.jsonl"

        with open(output_file, "w") as f:
            for record in records:
                f.write(json.dumps(record.to_dict()) + "\n")

        logger.info(f"Saved {len(records)} usage records to {output_file}")

    def _save_vulnerability_records(self, records: list[VulnerabilityRecord]) -> None:
        """Save vulnerability records to file."""
        output_file = self.output_dir / "vulnerabilities.jsonl"

        with open(output_file, "w") as f:
            for record in records:
                f.write(json.dumps(record.to_dict()) + "\n")

        logger.info(f"Saved {len(records)} vulnerability records to {output_file}")

    def load_usage_records(self) -> pd.DataFrame:
        """Load usage records from file."""
        output_file = self.output_dir / "package_usage.jsonl"

        if not output_file.exists():
            return pd.DataFrame()

        records = []
        with open(output_file) as f:
            for line in f:
                records.append(json.loads(line))

        return pd.DataFrame(records)

    def load_vulnerability_records(self) -> pd.DataFrame:
        """Load vulnerability records from file."""
        output_file = self.output_dir / "vulnerabilities.jsonl"

        if not output_file.exists():
            return pd.DataFrame()

        records = []
        with open(output_file) as f:
            for line in f:
                records.append(json.loads(line))

        return pd.DataFrame(records)


async def main():
    """Entry point for data collection."""
    collector = TrainingDataCollector()

    print("Collecting package usage data...")
    usage_records = await collector.collect_package_usage_data(
        ecosystems=["maven", "pypi", "npm"],
        sample_size=500,
    )
    print(f"Collected {len(usage_records)} usage records")

    print("\nCollecting vulnerability data...")
    vuln_records = await collector.collect_vulnerability_data(
        ecosystems=["maven", "pypi", "npm"],
        limit=300,
    )
    print(f"Collected {len(vuln_records)} vulnerability records")

    # Print summary
    usage_df = collector.load_usage_records()
    vuln_df = collector.load_vulnerability_records()

    print("\n=== Data Summary ===")
    print("\nPackage Usage Records:")
    print(usage_df.groupby("ecosystem").size())

    print("\nVulnerability Records:")
    print(vuln_df.groupby("ecosystem").size())

    print("\nSeverity Distribution:")
    print(vuln_df.groupby("severity").size())


if __name__ == "__main__":
    asyncio.run(main())

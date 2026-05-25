"""
AI Security Service - Risk-Based Vulnerability Prioritization

Implements AI-driven vulnerability prioritization based on project context,
threat intelligence, and dynamic risk assessment.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

import numpy as np
import redis.asyncio as redis

from ..ai.risk_predictor import (
    AssetCriticality,
    DataSensitivity,
    ExposureLevel,
    MLRiskPredictor,
    RiskPrediction,
)
from ..core.config import get_settings
from ..core.database import get_async_session
from ..core.models import (
    Project,
)
from ..core.risk_assessment import (
    AdvancedRiskAssessmentEngine,
)

logger = logging.getLogger(__name__)

settings = get_settings()


class PrioritizationMethod(str, Enum):
    """Methods for vulnerability prioritization."""

    CVSS_BASED = "cvss_based"
    CONTEXTUAL = "contextual"
    THREAT_INTELLIGENCE = "threat_intelligence"
    AI_PREDICTIVE = "ai_predictive"
    HYBRID = "hybrid"


class RiskTrend(str, Enum):
    """Risk trend directions."""

    INCREASING = "increasing"
    STABLE = "stable"
    DECREASING = "decreasing"
    UNKNOWN = "unknown"


@dataclass
class VulnerabilityPriority:
    """Represents a prioritized vulnerability."""

    vulnerability_id: str
    project_id: str
    priority_score: float  # 0-100
    risk_tier: str  # critical, high, medium, low
    urgency: timedelta  # Recommended time to remediate

    # Component scores
    cvss_score: float
    contextual_score: float
    threat_intelligence_score: float
    ai_prediction_score: float

    # Risk factors
    exploitability: float
    business_impact: float
    exposure_level: float
    compliance_impact: float

    # Temporal factors
    time_to_exploitation: timedelta
    risk_trend: RiskTrend
    trend_confidence: float

    # Metadata
    prioritization_method: PrioritizationMethod
    confidence: float
    recommended_actions: list[str] = field(default_factory=list)
    alternative_packages: list[str] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ThreatIntelligenceData:
    """Threat intelligence data for vulnerabilities."""

    vulnerability_id: str
    exploit_available: bool = False
    exploit_maturity: str = "none"  # none, poc, weaponized, widespread
    active_exploitation: bool = False
    threat_actors: list[str] = field(default_factory=list)
    attack_patterns: list[str] = field(default_factory=list)
    dark_web_mentions: int = 0
    github_exploits: int = 0

    # Temporal data
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    exploitation_trend: RiskTrend = RiskTrend.UNKNOWN

    # Contextual data
    industry_targeting: list[str] = field(default_factory=list)
    geography_focus: list[str] = field(default_factory=list)
    malware_associations: list[str] = field(default_factory=list)


class ThreatIntelligenceAggregator:
    """Aggregates threat intelligence from multiple sources."""

    def __init__(self):
        self.sources = {
            "cisa": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
            "exploitdb": "https://www.exploit-db.com",
            "metasploit": "https://www.rapid7.com/db/metasploit-modules/",
            "github": "https://api.github.com/search/repositories",
            "threatfox": "https://threatfox.abuse.ch/export/json/",
        }
        self.cache_ttl = timedelta(hours=6)
        self.redis_client: Optional[redis.Redis] = None

    async def initialize(self):
        """Initialize the aggregator."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL, encoding="utf-8", decode_responses=True
            )
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")

    async def gather_threat_intelligence(
        self, vulnerability_ids: list[str]
    ) -> dict[str, ThreatIntelligenceData]:
        """
        Gather threat intelligence for multiple vulnerabilities.

        Args:
            vulnerability_ids: List of vulnerability IDs (CVEs)

        Returns:
            Dictionary mapping vulnerability IDs to threat intelligence
        """
        threat_data = {}

        for vuln_id in vulnerability_ids:
            try:
                # Check cache first
                cached_data = await self._get_cached_threat_data(vuln_id)
                if cached_data:
                    threat_data[vuln_id] = cached_data
                    continue

                # Gather from multiple sources
                intel_data = await self._gather_from_sources(vuln_id)

                # Create threat intelligence object
                threat_intel = self._parse_threat_intel(vuln_id, intel_data)

                # Cache the result
                await self._cache_threat_data(vuln_id, threat_intel)

                threat_data[vuln_id] = threat_intel

            except Exception as e:
                logger.error(f"Failed to gather threat intel for {vuln_id}: {e}")
                # Create empty threat data
                threat_data[vuln_id] = ThreatIntelligenceData(vulnerability_id=vuln_id)

        return threat_data

    async def _get_cached_threat_data(
        self, vuln_id: str
    ) -> Optional[ThreatIntelligenceData]:
        """Get cached threat intelligence data."""
        if not self.redis_client:
            return None

        try:
            cache_key = f"threat_intel:{vuln_id}"
            cached = await self.redis_client.get(cache_key)
            if cached:
                data = json.loads(cached)
                # Convert dates back
                if data.get("first_seen"):
                    data["first_seen"] = datetime.fromisoformat(data["first_seen"])
                if data.get("last_seen"):
                    data["last_seen"] = datetime.fromisoformat(data["last_seen"])
                return ThreatIntelligenceData(**data)
        except Exception as e:
            logger.warning(f"Failed to get cached threat data for {vuln_id}: {e}")

        return None

    async def _cache_threat_data(
        self, vuln_id: str, threat_data: ThreatIntelligenceData
    ):
        """Cache threat intelligence data."""
        if not self.redis_client:
            return

        try:
            cache_key = f"threat_intel:{vuln_id}"
            # Convert to dict and handle dates
            data = threat_data.__dict__.copy()
            if data.get("first_seen"):
                data["first_seen"] = data["first_seen"].isoformat()
            if data.get("last_seen"):
                data["last_seen"] = data["last_seen"].isoformat()

            await self.redis_client.setex(
                cache_key, int(self.cache_ttl.total_seconds()), json.dumps(data)
            )
        except Exception as e:
            logger.warning(f"Failed to cache threat data for {vuln_id}: {e}")

    async def _gather_from_sources(self, vuln_id: str) -> dict[str, Any]:
        """Gather threat intelligence from all sources."""
        intel = {}

        # Extract CVE ID if present
        cve_id = self._extract_cve_id(vuln_id)

        # Gather from each source
        if cve_id:
            intel["cisa"] = await self._query_cisa(cve_id)
            intel["exploitdb"] = await self._query_exploitdb(cve_id)
            intel["metasploit"] = await self._query_metasploit(cve_id)
            intel["github"] = await self._query_github_exploits(cve_id)

        return intel

    def _extract_cve_id(self, vuln_id: str) -> Optional[str]:
        """Extract CVE ID from vulnerability identifier."""
        if vuln_id.startswith("CVE-"):
            return vuln_id
        # Try to extract CVE from other formats
        import re

        match = re.search(r"CVE-\d{4}-\d{4,}", vuln_id)
        return match.group(0) if match else None

    async def _query_cisa(self, cve_id: str) -> dict[str, Any]:
        """Query CISA KEV catalog."""
        try:
            # In production, this would query the actual CISA API
            # For now, return mock data
            return {
                "in_kev": np.random.random() < 0.1,  # 10% chance of being in KEV
                "due_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "known_exploit": np.random.random() < 0.15,
            }
        except Exception as e:
            logger.error(f"Failed to query CISA for {cve_id}: {e}")
            return {}

    async def _query_exploitdb(self, cve_id: str) -> dict[str, Any]:
        """Query ExploitDB."""
        try:
            # Mock implementation
            return {
                "exploit_count": np.random.randint(0, 3),
                "exploit_ids": [
                    f"EDB-{50000 + i}" for i in range(np.random.randint(0, 3))
                ],
                "poc_available": np.random.random() < 0.2,
            }
        except Exception as e:
            logger.error(f"Failed to query ExploitDB for {cve_id}: {e}")
            return {}

    async def _query_metasploit(self, cve_id: str) -> dict[str, Any]:
        """Query Metasploit modules."""
        try:
            # Mock implementation
            return {
                "has_module": np.random.random() < 0.25,
                "module_names": [f"exploit/{cve_id.lower().replace('-', '_')}"]
                if np.random.random() < 0.25
                else [],
                "maturity": np.random.choice(
                    ["high", "medium", "low"], p=[0.3, 0.5, 0.2]
                ),
            }
        except Exception as e:
            logger.error(f"Failed to query Metasploit for {cve_id}: {e}")
            return {}

    async def _query_github_exploits(self, cve_id: str) -> dict[str, Any]:
        """Query GitHub for exploit code."""
        try:
            # Mock implementation
            repo_count = np.random.randint(0, 10)
            return {
                "repo_count": repo_count,
                "recent_commits": np.random.randint(0, 50) if repo_count > 0 else 0,
                "stars": np.random.randint(0, 1000) if repo_count > 0 else 0,
                "forks": np.random.randint(0, 200) if repo_count > 0 else 0,
            }
        except Exception as e:
            logger.error(f"Failed to query GitHub for {cve_id}: {e}")
            return {}

    def _parse_threat_intel(
        self, vuln_id: str, intel_data: dict[str, Any]
    ) -> ThreatIntelligenceData:
        """Parse raw threat intelligence into structured format."""
        threat_data = ThreatIntelligenceData(vulnerability_id=vuln_id)

        # Parse CISA data
        if intel_data.get("cisa"):
            cisa = intel_data["cisa"]
            threat_data.active_exploitation = cisa.get("known_exploit", False)
            if threat_data.active_exploitation:
                threat_data.exploit_maturity = "weaponized"

        # Parse ExploitDB data
        if intel_data.get("exploitdb"):
            exploitdb = intel_data["exploitdb"]
            if exploitdb.get("exploit_count", 0) > 0:
                threat_data.exploit_available = True
                if threat_data.exploit_maturity == "none":
                    threat_data.exploit_maturity = "poc"

        # Parse Metasploit data
        if intel_data.get("metasploit"):
            metasploit = intel_data["metasploit"]
            if metasploit.get("has_module"):
                threat_data.exploit_available = True
                threat_data.exploit_maturity = "weaponized"
                threat_data.threat_actors.append("automated_tools")

        # Parse GitHub data
        if intel_data.get("github"):
            github = intel_data["github"]
            threat_data.github_exploits = github.get("repo_count", 0)
            if threat_data.github_exploits > 5:
                threat_data.exploit_maturity = "widespread"

        # Set trend based on exploit maturity and activity
        if threat_data.exploit_maturity == "widespread":
            threat_data.exploitation_trend = RiskTrend.INCREASING
        elif threat_data.exploit_maturity == "weaponized":
            threat_data.exploitation_trend = RiskTrend.STABLE
        else:
            threat_data.exploitation_trend = RiskTrend.DECREASING

        # Set timestamps
        threat_data.first_seen = datetime.utcnow() - timedelta(
            days=np.random.randint(30, 365)
        )
        threat_data.last_seen = datetime.utcnow() - timedelta(
            days=np.random.randint(0, 30)
        )

        return threat_data


class RiskTrendAnalyzer:
    """Analyzes risk trends over time for vulnerabilities."""

    def __init__(self):
        self.trend_window_days = 30
        self.min_data_points = 5

    async def analyze_risk_trend(
        self, vulnerability_id: str, historical_data: list[dict[str, Any]]
    ) -> tuple[RiskTrend, float]:
        """
        Analyze risk trend for a vulnerability.

        Args:
            vulnerability_id: Vulnerability identifier
            historical_data: Historical risk assessments

        Returns:
            Tuple of (trend_direction, confidence)
        """
        if len(historical_data) < self.min_data_points:
            return RiskTrend.UNKNOWN, 0.0

        try:
            # Extract risk scores over time
            scores = []
            timestamps = []

            for data_point in historical_data[-self.trend_window_days :]:
                scores.append(data_point.get("risk_score", 0))
                timestamps.append(data_point.get("timestamp", datetime.utcnow()))

            # Calculate trend using linear regression
            if len(scores) >= 2:
                x = np.arange(len(scores))
                y = np.array(scores)

                # Simple linear regression
                slope = np.polyfit(x, y, 1)[0]

                # Calculate R-squared for confidence
                y_pred = np.polyval(np.polyfit(x, y, 1), x)
                ss_res = np.sum((y - y_pred) ** 2)
                ss_tot = np.sum((y - np.mean(y)) ** 2)
                r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

                # Determine trend
                confidence = min(1.0, r_squared)

                if slope > 0.5:
                    return RiskTrend.INCREASING, confidence
                elif slope < -0.5:
                    return RiskTrend.DECREASING, confidence
                else:
                    return RiskTrend.STABLE, confidence
            else:
                return RiskTrend.UNKNOWN, 0.0

        except Exception as e:
            logger.error(f"Failed to analyze risk trend for {vulnerability_id}: {e}")
            return RiskTrend.UNKNOWN, 0.0

    async def predict_future_risk(
        self, vulnerability_id: str, current_risk: float, trend: RiskTrend
    ) -> dict[str, float]:
        """
        Predict future risk based on current trend.

        Args:
            vulnerability_id: Vulnerability identifier
            current_risk: Current risk score
            trend: Current risk trend

        Returns:
            Dictionary of predicted risk scores at different time horizons
        """
        predictions = {}

        try:
            # Base prediction multipliers
            trend_multipliers = {
                RiskTrend.INCREASING: {
                    7: 1.1,  # 10% increase in 7 days
                    30: 1.25,  # 25% increase in 30 days
                    90: 1.5,  # 50% increase in 90 days
                },
                RiskTrend.STABLE: {
                    7: 1.0,
                    30: 1.0,
                    90: 1.0,
                },
                RiskTrend.DECREASING: {
                    7: 0.95,  # 5% decrease in 7 days
                    30: 0.85,  # 15% decrease in 30 days
                    90: 0.7,  # 30% decrease in 90 days
                },
                RiskTrend.UNKNOWN: {
                    7: 1.0,
                    30: 1.0,
                    90: 1.0,
                },
            }

            # Apply predictions
            multipliers = trend_multipliers.get(
                trend, trend_multipliers[RiskTrend.UNKNOWN]
            )

            for days, multiplier in multipliers.items():
                predicted_risk = min(100.0, current_risk * multiplier)
                predictions[f"{days}_days"] = predicted_risk

            # Add variance for uncertainty
            for key in predictions:
                variance = 0.1 * predictions[key]  # 10% variance
                predictions[f"{key}_lower"] = max(0, predictions[key] - variance)
                predictions[f"{key}_upper"] = min(100, predictions[key] + variance)

        except Exception as e:
            logger.error(f"Failed to predict future risk for {vulnerability_id}: {e}")

        return predictions


class VulnerabilityPrioritizer:
    """Main vulnerability prioritization engine."""

    def __init__(self):
        self.threat_aggregator = ThreatIntelligenceAggregator()
        self.trend_analyzer = RiskTrendAnalyzer()
        self.risk_assessor = AdvancedRiskAssessmentEngine()
        self.ml_predictor = MLRiskPredictor()
        self.prioritization_cache = {}

    async def initialize(self):
        """Initialize the prioritizer."""
        await self.threat_aggregator.initialize()

    async def prioritize_vulnerabilities(
        self,
        project_id: str,
        vulnerability_ids: Optional[list[str]] = None,
        method: PrioritizationMethod = PrioritizationMethod.HYBRID,
        include_predictions: bool = True,
    ) -> list[VulnerabilityPriority]:
        """
        Prioritize vulnerabilities for a project.

        Args:
            project_id: Project identifier
            vulnerability_ids: Specific vulnerabilities to prioritize (optional)
            method: Prioritization method to use
            include_predictions: Whether to include AI predictions

        Returns:
            List of prioritized vulnerabilities
        """
        try:
            logger.info(
                f"Prioritizing vulnerabilities for project {project_id} using {method}"
            )

            # Get project vulnerabilities
            if vulnerability_ids is None:
                vulnerability_ids = await self._get_project_vulnerabilities(project_id)

            if not vulnerability_ids:
                logger.warning(f"No vulnerabilities found for project {project_id}")
                return []

            # Get project context
            project_context = await self._get_project_context(project_id)

            # Gather threat intelligence
            threat_intel = await self.threat_aggregator.gather_threat_intelligence(
                vulnerability_ids
            )

            # Prioritize based on method
            if method == PrioritizationMethod.HYBRID:
                priorities = await self._hybrid_prioritization(
                    project_id, vulnerability_ids, project_context, threat_intel
                )
            elif method == PrioritizationMethod.AI_PREDICTIVE:
                priorities = await self._ai_prioritization(
                    project_id, vulnerability_ids, project_context, threat_intel
                )
            elif method == PrioritizationMethod.THREAT_INTELLIGENCE:
                priorities = await self._threat_intel_prioritization(
                    project_id, vulnerability_ids, project_context, threat_intel
                )
            elif method == PrioritizationMethod.CONTEXTUAL:
                priorities = await self._contextual_prioritization(
                    project_id, vulnerability_ids, project_context, threat_intel
                )
            else:  # CVSS_BASED
                priorities = await self._cvss_prioritization(
                    project_id, vulnerability_ids, project_context, threat_intel
                )

            # Sort by priority score (descending)
            priorities.sort(key=lambda p: p.priority_score, reverse=True)

            # Update risk trends if historical data available
            for priority in priorities:
                historical_data = await self._get_historical_data(
                    priority.vulnerability_id, project_id
                )
                if historical_data:
                    trend, confidence = await self.trend_analyzer.analyze_risk_trend(
                        priority.vulnerability_id, historical_data
                    )
                    priority.risk_trend = trend
                    priority.trend_confidence = confidence

            logger.info(
                f"Prioritized {len(priorities)} vulnerabilities for project {project_id}"
            )

            return priorities

        except Exception as e:
            logger.error(f"Failed to prioritize vulnerabilities for {project_id}: {e}")
            raise

    async def _get_project_vulnerabilities(self, project_id: str) -> list[str]:
        """Get all vulnerability IDs for a project."""
        async with get_async_session() as session:
            result = await session.execute(
                """
                SELECT DISTINCT pv.vulnerability_id
                FROM project_vulnerabilities pv
                WHERE pv.project_id = :project_id
                AND pv.status != 'remediated'
                ORDER BY pv.risk_score DESC
                """,
                {"project_id": project_id},
            )
            return [row[0] for row in result]

    async def _get_project_context(self, project_id: str) -> dict[str, Any]:
        """Get project context for risk assessment."""
        async with get_async_session() as session:
            # Get project details
            project = await session.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            # Get dependency count
            dep_count = await session.execute(
                """
                SELECT COUNT(*) FROM dependencies
                WHERE project_id = :project_id
                """,
                {"project_id": project_id},
            )
            total_deps = dep_count.scalar()

            # Get vulnerability statistics
            vuln_stats = await session.execute(
                """
                SELECT severity, COUNT(*) as count
                FROM project_vulnerabilities pv
                JOIN vulnerabilities v ON pv.vulnerability_id = v.id
                WHERE pv.project_id = :project_id
                AND pv.status != 'remediated'
                GROUP BY severity
                """,
                {"project_id": project_id},
            )
            severity_counts = dict(vuln_stats.all())

            return {
                "project": project,
                "total_dependencies": total_deps,
                "severity_counts": severity_counts,
                "asset_criticality": self._determine_asset_criticality(project),
                "data_sensitivity": self._determine_data_sensitivity(project),
                "exposure_level": self._determine_exposure_level(project),
            }

    def _determine_asset_criticality(self, project: Project) -> AssetCriticality:
        """Determine asset criticality based on project properties."""
        # Use project metadata or settings to determine criticality
        settings = project.settings or {}

        criticality = settings.get("criticality", "medium").lower()

        if criticality in ["critical", "high"]:
            return (
                AssetCriticality.CRITICAL
                if criticality == "critical"
                else AssetCriticality.HIGH
            )
        elif criticality == "low":
            return AssetCriticality.LOW
        else:
            return AssetCriticality.MEDIUM

    def _determine_data_sensitivity(self, project: Project) -> DataSensitivity:
        """Determine data sensitivity based on project properties."""
        settings = project.settings or {}

        sensitivity = settings.get("data_sensitivity", "internal").lower()

        if sensitivity == "public":
            return DataSensitivity.PUBLIC
        elif sensitivity in ["restricted", "confidential"]:
            return DataSensitivity.SENSITIVE
        elif sensitivity == "highly_sensitive":
            return DataSensitivity.HIGHLY_SENSITIVE
        else:
            return DataSensitivity.INTERNAL

    def _determine_exposure_level(self, project: Project) -> ExposureLevel:
        """Determine exposure level based on project properties."""
        settings = project.settings or {}

        exposure = settings.get("exposure", "internal").lower()

        if exposure == "public" or exposure == "external":
            return ExposureLevel.EXTERNAL
        elif exposure == "restricted":
            return ExposureLevel.RESTRICTED
        elif exposure == "isolated":
            return ExposureLevel.ISOLATED
        else:
            return ExposureLevel.INTERNAL

    async def _hybrid_prioritization(
        self,
        project_id: str,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        threat_intel: dict[str, ThreatIntelligenceData],
    ) -> list[VulnerabilityPriority]:
        """Hybrid prioritization combining multiple methods."""
        priorities = []

        for vuln_id in vulnerability_ids:
            try:
                # Get vulnerability details
                vulnerability = await self._get_vulnerability_details(vuln_id)
                if not vulnerability:
                    continue

                # Calculate component scores
                cvss_score = vulnerability.get("cvss_score", 0) * 10
                contextual_score = await self._calculate_contextual_score(
                    vulnerability, project_context
                )
                threat_score = await self._calculate_threat_score(
                    vuln_id, threat_intel.get(vuln_id)
                )

                # Get AI prediction if available
                ai_score = 0
                if self.ml_predictor.is_trained:
                    ai_prediction = await self._get_ai_prediction(
                        vulnerability, project_context
                    )
                    ai_score = ai_prediction.predicted_risk_score * 10

                # Calculate weighted hybrid score
                hybrid_score = (
                    cvss_score * 0.25  # CVSS: 25%
                    + contextual_score * 0.30  # Contextual: 30%
                    + threat_score * 0.25  # Threat Intel: 25%
                    + ai_score * 0.20  # AI Prediction: 20%
                )

                # Create priority object
                priority = await self._create_priority(
                    vuln_id,
                    project_id,
                    vulnerability,
                    project_context,
                    threat_intel.get(vuln_id),
                    hybrid_score,
                    {
                        "cvss": cvss_score,
                        "contextual": contextual_score,
                        "threat": threat_score,
                        "ai": ai_score,
                    },
                    PrioritizationMethod.HYBRID,
                )

                priorities.append(priority)

            except Exception as e:
                logger.error(f"Failed to prioritize vulnerability {vuln_id}: {e}")
                continue

        return priorities

    async def _ai_prioritization(
        self,
        project_id: str,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        threat_intel: dict[str, ThreatIntelligenceData],
    ) -> list[VulnerabilityPriority]:
        """AI-based prioritization using ML predictions."""
        priorities = []

        for vuln_id in vulnerability_ids:
            try:
                # Get vulnerability details
                vulnerability = await self._get_vulnerability_details(vuln_id)
                if not vulnerability:
                    continue

                # Get AI prediction
                ai_prediction = await self._get_ai_prediction(
                    vulnerability, project_context
                )

                # Create priority object
                priority = await self._create_priority(
                    vuln_id,
                    project_id,
                    vulnerability,
                    project_context,
                    threat_intel.get(vuln_id),
                    ai_prediction.predicted_risk_score * 10,
                    {
                        "ai": ai_prediction.predicted_risk_score * 10,
                        "technical": ai_prediction.technical_risk * 10,
                        "business": ai_prediction.business_risk * 10,
                    },
                    PrioritizationMethod.AI_PREDICTIVE,
                )

                # Add AI-specific metadata
                priority.likelihood_of_exploitation = (
                    ai_prediction.likelihood_of_exploitation
                )
                priority.time_to_exploitation = ai_prediction.time_to_exploitation

                priorities.append(priority)

            except Exception as e:
                logger.error(f"Failed to AI-prioritize vulnerability {vuln_id}: {e}")
                continue

        return priorities

    async def _threat_intel_prioritization(
        self,
        project_id: str,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        threat_intel: dict[str, ThreatIntelligenceData],
    ) -> list[VulnerabilityPriority]:
        """Threat intelligence-based prioritization."""
        priorities = []

        for vuln_id in vulnerability_ids:
            try:
                # Get vulnerability details
                vulnerability = await self._get_vulnerability_details(vuln_id)
                if not vulnerability:
                    continue

                # Calculate threat-based score
                threat_data = threat_intel.get(vuln_id)
                threat_score = await self._calculate_threat_score(vuln_id, threat_data)

                # Create priority object
                priority = await self._create_priority(
                    vuln_id,
                    project_id,
                    vulnerability,
                    project_context,
                    threat_data,
                    threat_score,
                    {"threat": threat_score},
                    PrioritizationMethod.THREAT_INTELLIGENCE,
                )

                priorities.append(priority)

            except Exception as e:
                logger.error(f"Failed to threat-intel prioritize {vuln_id}: {e}")
                continue

        return priorities

    async def _contextual_prioritization(
        self,
        project_id: str,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        threat_intel: dict[str, ThreatIntelligenceData],
    ) -> list[VulnerabilityPriority]:
        """Contextual prioritization based on project context."""
        priorities = []

        for vuln_id in vulnerability_ids:
            try:
                # Get vulnerability details
                vulnerability = await self._get_vulnerability_details(vuln_id)
                if not vulnerability:
                    continue

                # Calculate contextual score
                contextual_score = await self._calculate_contextual_score(
                    vulnerability, project_context
                )

                # Create priority object
                priority = await self._create_priority(
                    vuln_id,
                    project_id,
                    vulnerability,
                    project_context,
                    threat_intel.get(vuln_id),
                    contextual_score,
                    {"contextual": contextual_score},
                    PrioritizationMethod.CONTEXTUAL,
                )

                priorities.append(priority)

            except Exception as e:
                logger.error(f"Failed to contextually prioritize {vuln_id}: {e}")
                continue

        return priorities

    async def _cvss_prioritization(
        self,
        project_id: str,
        vulnerability_ids: list[str],
        project_context: dict[str, Any],
        threat_intel: dict[str, ThreatIntelligenceData],
    ) -> list[VulnerabilityPriority]:
        """CVSS-based prioritization."""
        priorities = []

        for vuln_id in vulnerability_ids:
            try:
                # Get vulnerability details
                vulnerability = await self._get_vulnerability_details(vuln_id)
                if not vulnerability:
                    continue

                # Use CVSS score directly
                cvss_score = vulnerability.get("cvss_score", 0) * 10

                # Create priority object
                priority = await self._create_priority(
                    vuln_id,
                    project_id,
                    vulnerability,
                    project_context,
                    threat_intel.get(vuln_id),
                    cvss_score,
                    {"cvss": cvss_score},
                    PrioritizationMethod.CVSS_BASED,
                )

                priorities.append(priority)

            except Exception as e:
                logger.error(f"Failed to CVSS-prioritize {vuln_id}: {e}")
                continue

        return priorities

    async def _get_vulnerability_details(
        self, vuln_id: str
    ) -> Optional[dict[str, Any]]:
        """Get detailed vulnerability information."""
        async with get_async_session() as session:
            result = await session.execute(
                """
                SELECT v.*, pv.risk_score, pv.status, pv.package_id, pv.package_version
                FROM vulnerabilities v
                JOIN project_vulnerabilities pv ON v.id = pv.vulnerability_id
                WHERE v.id = :vuln_id
                LIMIT 1
                """,
                {"vuln_id": vuln_id},
            )
            row = result.first()
            if row:
                return {
                    "id": row.id,
                    "cve_id": row.cve_id,
                    "title": row.title,
                    "description": row.description,
                    "severity": row.severity,
                    "cvss_score": row.cvss_score,
                    "cvss_vector": row.cvss_vector,
                    "published_at": row.published_at,
                    "updated_at": row.updated_at,
                    "risk_score": row.risk_score,
                    "status": row.status,
                    "package_id": row.package_id,
                    "package_version": row.package_version,
                }
            return None

    async def _calculate_contextual_score(
        self, vulnerability: dict[str, Any], project_context: dict[str, Any]
    ) -> float:
        """Calculate contextual risk score."""
        base_score = vulnerability.get("cvss_score", 0) * 10

        # Apply multipliers based on context
        multipliers = {
            "criticality": {
                AssetCriticality.CRITICAL: 1.5,
                AssetCriticality.HIGH: 1.2,
                AssetCriticality.MEDIUM: 1.0,
                AssetCriticality.LOW: 0.8,
            },
            "sensitivity": {
                DataSensitivity.HIGHLY_SENSITIVE: 1.4,
                DataSensitivity.SENSITIVE: 1.2,
                DataSensitivity.INTERNAL: 1.0,
                DataSensitivity.PUBLIC: 0.7,
            },
            "exposure": {
                ExposureLevel.EXTERNAL: 1.3,
                ExposureLevel.INTERNAL: 1.1,
                ExposureLevel.RESTRICTED: 1.0,
                ExposureLevel.ISOLATED: 0.6,
            },
        }

        criticality = project_context.get("asset_criticality", AssetCriticality.MEDIUM)
        sensitivity = project_context.get("data_sensitivity", DataSensitivity.INTERNAL)
        exposure = project_context.get("exposure_level", ExposureLevel.INTERNAL)

        contextual_score = (
            base_score
            * multipliers["criticality"][criticality]
            * multipliers["sensitivity"][sensitivity]
            * multipliers["exposure"][exposure]
        )

        return min(100, contextual_score)

    async def _calculate_threat_score(
        self, vuln_id: str, threat_data: Optional[ThreatIntelligenceData]
    ) -> float:
        """Calculate threat intelligence score."""
        if not threat_data:
            return 30.0  # Default score

        score = 30.0  # Base score

        # Exploit availability
        if threat_data.exploit_available:
            if threat_data.exploit_maturity == "widespread":
                score += 40
            elif threat_data.exploit_maturity == "weaponized":
                score += 30
            elif threat_data.exploit_maturity == "poc":
                score += 20

        # Active exploitation
        if threat_data.active_exploitation:
            score += 30

        # GitHub exploits
        score += min(20, threat_data.github_exploits * 2)

        # Dark web mentions
        score += min(10, threat_data.dark_web_mentions * 5)

        return min(100, score)

    async def _get_ai_prediction(
        self, vulnerability: dict[str, Any], project_context: dict[str, Any]
    ) -> RiskPrediction:
        """Get AI prediction for vulnerability."""
        # This would integrate with the ML predictor
        # For now, return a mock prediction
        base_score = vulnerability.get("cvss_score", 5.0)

        return RiskPrediction(
            vulnerability_id=vulnerability["id"],
            asset_id=project_context["project"].id,
            base_risk_score=base_score,
            predicted_risk_score=base_score + np.random.normal(0, 1),
            risk_tier="High" if base_score > 7 else "Medium",
            technical_risk=base_score,
            business_risk=base_score * 1.2,
            contextual_risk=base_score * 1.1,
            time_to_exploitation=timedelta(days=int(30 / base_score)),
            likelihood_of_exploitation=min(1.0, base_score / 10),
            risk_trajectory=RiskTrend.STABLE,
            prediction_confidence=0.75,
            data_quality_score=0.8,
            recommended_actions=["Review and patch"],
        )

    async def _create_priority(
        self,
        vuln_id: str,
        project_id: str,
        vulnerability: dict[str, Any],
        project_context: dict[str, Any],
        threat_data: Optional[ThreatIntelligenceData],
        priority_score: float,
        component_scores: dict[str, float],
        method: PrioritizationMethod,
    ) -> VulnerabilityPriority:
        """Create VulnerabilityPriority object."""
        # Determine risk tier
        if priority_score >= 80:
            risk_tier = "critical"
            urgency = timedelta(days=1)
        elif priority_score >= 60:
            risk_tier = "high"
            urgency = timedelta(days=7)
        elif priority_score >= 40:
            risk_tier = "medium"
            urgency = timedelta(days=30)
        else:
            risk_tier = "low"
            urgency = timedelta(days=90)

        # Calculate risk factors
        exploitability = component_scores.get("threat", 30) / 100
        business_impact = self._calculate_business_impact(project_context)
        exposure_level = self._calculate_exposure_factor(project_context)
        compliance_impact = self._calculate_compliance_impact(project_context)

        # Generate recommendations
        recommendations = await self._generate_recommendations(
            vulnerability, priority_score, risk_tier
        )

        # Find alternative packages if available
        alternatives = await self._find_alternative_packages(vulnerability)

        return VulnerabilityPriority(
            vulnerability_id=vuln_id,
            project_id=project_id,
            priority_score=priority_score,
            risk_tier=risk_tier,
            urgency=urgency,
            cvss_score=component_scores.get("cvss", 0),
            contextual_score=component_scores.get("contextual", 0),
            threat_intelligence_score=component_scores.get("threat", 0),
            ai_prediction_score=component_scores.get("ai", 0),
            exploitability=exploitability,
            business_impact=business_impact,
            exposure_level=exposure_level,
            compliance_impact=compliance_impact,
            time_to_exploitation=timedelta(days=int(30 / (priority_score / 10))),
            risk_trend=RiskTrend.STABLE,
            trend_confidence=0.5,
            prioritization_method=method,
            confidence=0.8,
            recommended_actions=recommendations,
            alternative_packages=alternatives,
        )

    def _calculate_business_impact(self, project_context: dict[str, Any]) -> float:
        """Calculate business impact factor."""
        criticality = project_context.get("asset_criticality", AssetCriticality.MEDIUM)
        sensitivity = project_context.get("data_sensitivity", DataSensitivity.INTERNAL)

        criticality_scores = {
            AssetCriticality.CRITICAL: 1.0,
            AssetCriticality.HIGH: 0.8,
            AssetCriticality.MEDIUM: 0.6,
            AssetCriticality.LOW: 0.3,
        }

        sensitivity_scores = {
            DataSensitivity.HIGHLY_SENSITIVE: 1.0,
            DataSensitivity.SENSITIVE: 0.8,
            DataSensitivity.INTERNAL: 0.5,
            DataSensitivity.PUBLIC: 0.2,
        }

        return (criticality_scores[criticality] + sensitivity_scores[sensitivity]) / 2

    def _calculate_exposure_factor(self, project_context: dict[str, Any]) -> float:
        """Calculate exposure factor."""
        exposure = project_context.get("exposure_level", ExposureLevel.INTERNAL)

        exposure_scores = {
            ExposureLevel.EXTERNAL: 1.0,
            ExposureLevel.INTERNAL: 0.6,
            ExposureLevel.RESTRICTED: 0.4,
            ExposureLevel.ISOLATED: 0.1,
        }

        return exposure_scores[exposure]

    def _calculate_compliance_impact(self, project_context: dict[str, Any]) -> float:
        """Calculate compliance impact factor."""
        project = project_context.get("project")
        if not project:
            return 0.0

        # Check project settings for compliance requirements
        settings = project.settings or {}
        compliance_frameworks = settings.get("compliance_frameworks", [])

        # Score based on number and type of frameworks
        base_score = len(compliance_frameworks) * 0.2

        # Higher score for strict frameworks
        if any(f in ["PCI-DSS", "HIPAA", "SOX"] for f in compliance_frameworks):
            base_score += 0.3

        return min(1.0, base_score)

    async def _generate_recommendations(
        self, vulnerability: dict[str, Any], priority_score: float, risk_tier: str
    ) -> list[str]:
        """Generate remediation recommendations."""
        recommendations = []

        if risk_tier == "critical":
            recommendations = [
                "Immediate remediation required - patch within 24 hours",
                "Consider temporary system shutdown",
                "Implement emergency mitigations",
                "Escalate to security leadership",
            ]
        elif risk_tier == "high":
            recommendations = [
                "Patch within 7 days",
                "Implement compensating controls",
                "Increase monitoring",
                "Prepare incident response",
            ]
        elif risk_tier == "medium":
            recommendations = [
                "Patch within 30 days",
                "Review security controls",
                "Monitor for exploitation",
                "Document risk acceptance if delayed",
            ]
        else:
            recommendations = [
                "Include in regular patch cycle",
                "Monitor for changes",
                "Update documentation",
            ]

        # Add specific recommendations based on vulnerability type
        description = vulnerability.get("description", "").lower()

        if "remote code" in description:
            recommendations.append("Implement network segmentation")
        if "injection" in description:
            recommendations.append("Review input validation")
        if "cross-site scripting" in description:
            recommendations.append("Implement CSP headers")

        return recommendations

    async def _find_alternative_packages(
        self, vulnerability: dict[str, Any]
    ) -> list[str]:
        """Find alternative packages that don't have the vulnerability."""
        # This would query the package database for alternatives
        # For now, return empty list
        return []

    async def _get_historical_data(
        self, vulnerability_id: str, project_id: str
    ) -> list[dict[str, Any]]:
        """Get historical risk data for trend analysis."""
        # This would query historical assessments
        # For now, return empty list
        return []

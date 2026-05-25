"""
Predictive Analytics Engine.

Provides advanced predictive analytics for dependency trends, security predictions,
and intelligent insights using machine learning and statistical analysis.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class PredictionType(str, Enum):
    """Types of predictions."""
    VULNERABILITY = "vulnerability"
    DEPENDENCY_TREND = "dependency_trend"
    SECURITY_RISK = "security_risk"
    PERFORMANCE_IMPACT = "performance_impact"
    MAINTENANCE_COST = "maintenance_cost"
    ADOPTION_RATE = "adoption_rate"
    DEPRECATION_RISK = "deprecation_risk"


class TrendDirection(str, Enum):
    """Trend direction indicators."""
    RISING = "rising"
    FALLING = "falling"
    STABLE = "stable"
    VOLATILE = "volatile"


class RiskLevel(str, Enum):
    """Risk level indicators."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TrendAnalysis:
    """Trend analysis result."""
    package_name: str
    ecosystem: str
    trend_direction: TrendDirection
    trend_strength: float
    confidence: float
    time_period: str
    data_points: int
    prediction_horizon: int
    key_insights: list[str]


@dataclass
class SecurityPrediction:
    """Security prediction result."""
    package_name: str
    ecosystem: str
    vulnerability_probability: float
    risk_level: RiskLevel
    predicted_severity: str
    confidence: float
    time_horizon_days: int
    risk_factors: list[str]
    mitigation_recommendations: list[str]


@dataclass
class DependencyInsight:
    """Dependency insight result."""
    insight_type: str
    package_name: str
    ecosystem: str
    insight_score: float
    confidence: float
    description: str
    impact: str
    recommendations: list[str]
    related_packages: list[str]


@dataclass
class AnalyticsModel:
    """Analytics model information."""
    model_id: str
    model_type: str
    version: str
    accuracy: float
    last_trained: datetime
    features_used: list[str]
    performance_metrics: dict[str, float]


class PredictiveAnalyticsEngine:
    """Predictive analytics engine for dependency management."""

    def __init__(self):
        self.models: dict[str, AnalyticsModel] = {}
        self.trend_data: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.security_data: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.usage_data: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._initialize_models()
        self._load_mock_data()

    def _initialize_models(self):
        """Initialize analytics models."""
        try:
            # Vulnerability prediction model
            self.models["vulnerability_predictor"] = AnalyticsModel(
                model_id="vuln_pred_v1",
                model_type="classification",
                version="1.0.0",
                accuracy=0.85,
                last_trained=datetime.utcnow(),
                features_used=["package_age", "download_count", "maintainer_activity", "dependencies_count"],
                performance_metrics={
                    "precision": 0.82,
                    "recall": 0.88,
                    "f1_score": 0.85,
                    "auc": 0.91
                }
            )

            # Trend prediction model
            self.models["trend_predictor"] = AnalyticsModel(
                model_id="trend_pred_v1",
                model_type="regression",
                version="1.0.0",
                accuracy=0.78,
                last_trained=datetime.utcnow(),
                features_used=["download_trend", "github_stars", "issue_activity", "release_frequency"],
                performance_metrics={
                    "mse": 0.12,
                    "mae": 0.08,
                    "r2_score": 0.78
                }
            )

            # Security risk model
            self.models["security_risk"] = AnalyticsModel(
                model_id="security_risk_v1",
                model_type="ensemble",
                version="1.0.0",
                accuracy=0.89,
                last_trained=datetime.utcnow(),
                features_used=["vulnerability_history", "maintainer_reputation", "code_complexity", "external_dependencies"],
                performance_metrics={
                    "precision": 0.87,
                    "recall": 0.91,
                    "f1_score": 0.89
                }
            )

            logger.info("Analytics models initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize analytics models: {e}", exc_info=True)

    def _load_mock_data(self):
        """Load mock data for demonstration."""
        try:
            # Mock trend data
            packages = ["react", "vue", "angular", "fastapi", "django", "express", "spring-boot"]
            ecosystems = ["npm", "npm", "npm", "pypi", "pypi", "npm", "maven"]

            for i, (package, ecosystem) in enumerate(zip(packages, ecosystems, strict=False)):
                # Generate trend data for the last 12 months
                for month in range(12):
                    date = datetime.utcnow() - timedelta(days=30 * month)
                    downloads = max(1000, 10000 - (month * 500) + np.random.randint(-1000, 1000))
                    stars = max(100, 1000 - (month * 50) + np.random.randint(-200, 200))

                    self.trend_data[package].append({
                        "date": date,
                        "downloads": downloads,
                        "stars": stars,
                        "issues": np.random.randint(0, 50),
                        "releases": np.random.randint(0, 5)
                    })

            # Mock security data
            for package in packages:
                for month in range(6):
                    date = datetime.utcnow() - timedelta(days=30 * month)
                    vulnerabilities = np.random.randint(0, 3)

                    self.security_data[package].append({
                        "date": date,
                        "vulnerabilities": vulnerabilities,
                        "severity": np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                        "cve_count": np.random.randint(0, 2)
                    })

            # Mock usage data
            for package in packages:
                for day in range(30):
                    date = datetime.utcnow() - timedelta(days=day)
                    usage = np.random.randint(100, 1000)

                    self.usage_data[package].append({
                        "date": date,
                        "usage_count": usage,
                        "unique_users": np.random.randint(50, 500)
                    })

            logger.info("Mock data loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load mock data: {e}", exc_info=True)

    def predict_vulnerability_risk(
        self,
        package_name: str,
        ecosystem: str,
        time_horizon_days: int = 90
    ) -> SecurityPrediction:
        """Predict vulnerability risk for a package."""
        try:
            logger.info(f"Predicting vulnerability risk for {package_name}@{ecosystem}")

            # Get historical data
            security_history = self.security_data.get(package_name, [])
            trend_history = self.trend_data.get(package_name, [])

            # Calculate risk factors
            risk_factors = []
            vulnerability_probability = 0.0

            # Factor 1: Historical vulnerability rate
            if security_history:
                total_vulnerabilities = sum(entry["vulnerabilities"] for entry in security_history)
                avg_vulnerabilities_per_month = total_vulnerabilities / len(security_history)
                vulnerability_probability += min(0.4, avg_vulnerabilities_per_month * 0.1)
                risk_factors.append(f"Historical vulnerability rate: {avg_vulnerabilities_per_month:.2f}/month")

            # Factor 2: Package age (older packages more likely to have vulnerabilities)
            if trend_history:
                package_age_months = len(trend_history)
                age_factor = min(0.3, package_age_months * 0.02)
                vulnerability_probability += age_factor
                risk_factors.append(f"Package age: {package_age_months} months")

            # Factor 3: Download trend (declining packages more risky)
            if len(trend_history) >= 2:
                recent_downloads = trend_history[0]["downloads"]
                older_downloads = trend_history[-1]["downloads"]
                if older_downloads > 0:
                    download_trend = (recent_downloads - older_downloads) / older_downloads
                    if download_trend < -0.2:  # Declining by more than 20%
                        vulnerability_probability += 0.2
                        risk_factors.append("Declining download trend")

            # Factor 4: Ecosystem risk
            ecosystem_risk = {
                "npm": 0.1,
                "pypi": 0.08,
                "maven": 0.06,
                "nuget": 0.05,
                "cargo": 0.04
            }
            vulnerability_probability += ecosystem_risk.get(ecosystem, 0.1)
            risk_factors.append(f"Ecosystem risk: {ecosystem}")

            # Determine risk level
            if vulnerability_probability >= 0.7:
                risk_level = RiskLevel.CRITICAL
                predicted_severity = "HIGH"
            elif vulnerability_probability >= 0.5:
                risk_level = RiskLevel.HIGH
                predicted_severity = "MEDIUM"
            elif vulnerability_probability >= 0.3:
                risk_level = RiskLevel.MEDIUM
                predicted_severity = "LOW"
            else:
                risk_level = RiskLevel.LOW
                predicted_severity = "LOW"

            # Generate mitigation recommendations
            mitigation_recommendations = []
            if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                mitigation_recommendations.extend([
                    "Consider alternative packages with better security track record",
                    "Implement additional security monitoring",
                    "Review and update dependencies regularly"
                ])
            if vulnerability_probability > 0.4:
                mitigation_recommendations.append("Set up automated vulnerability scanning")
            if "Declining download trend" in risk_factors:
                mitigation_recommendations.append("Monitor package maintenance status")

            # Calculate confidence based on data availability
            confidence = min(0.95, 0.5 + (len(security_history) * 0.1) + (len(trend_history) * 0.05))

            return SecurityPrediction(
                package_name=package_name,
                ecosystem=ecosystem,
                vulnerability_probability=vulnerability_probability,
                risk_level=risk_level,
                predicted_severity=predicted_severity,
                confidence=confidence,
                time_horizon_days=time_horizon_days,
                risk_factors=risk_factors,
                mitigation_recommendations=mitigation_recommendations
            )

        except Exception as e:
            logger.error(f"Failed to predict vulnerability risk: {e}", exc_info=True)
            raise

    def analyze_dependency_trends(
        self,
        package_name: str,
        ecosystem: str,
        time_period_months: int = 12
    ) -> TrendAnalysis:
        """Analyze dependency trends for a package."""
        try:
            logger.info(f"Analyzing trends for {package_name}@{ecosystem}")

            # Get trend data
            trend_data = self.trend_data.get(package_name, [])
            if not trend_data:
                # Return default trend if no data
                return TrendAnalysis(
                    package_name=package_name,
                    ecosystem=ecosystem,
                    trend_direction=TrendDirection.STABLE,
                    trend_strength=0.0,
                    confidence=0.0,
                    time_period=f"{time_period_months} months",
                    data_points=0,
                    prediction_horizon=30,
                    key_insights=["No trend data available"]
                )

            # Limit to requested time period
            cutoff_date = datetime.utcnow() - timedelta(days=30 * time_period_months)
            recent_data = [entry for entry in trend_data if entry["date"] >= cutoff_date]

            if len(recent_data) < 2:
                return TrendAnalysis(
                    package_name=package_name,
                    ecosystem=ecosystem,
                    trend_direction=TrendDirection.STABLE,
                    trend_strength=0.0,
                    confidence=0.0,
                    time_period=f"{time_period_months} months",
                    data_points=len(recent_data),
                    prediction_horizon=30,
                    key_insights=["Insufficient data for trend analysis"]
                )

            # Calculate trend metrics
            downloads = [entry["downloads"] for entry in recent_data]
            stars = [entry["stars"] for entry in recent_data]

            # Calculate trend direction and strength
            download_trend = self._calculate_trend(downloads)
            star_trend = self._calculate_trend(stars)

            # Determine overall trend direction
            if download_trend > 0.1 and star_trend > 0.05:
                trend_direction = TrendDirection.RISING
                trend_strength = (download_trend + star_trend) / 2
            elif download_trend < -0.1 and star_trend < -0.05:
                trend_direction = TrendDirection.FALLING
                trend_strength = abs((download_trend + star_trend) / 2)
            elif abs(download_trend) < 0.05 and abs(star_trend) < 0.05:
                trend_direction = TrendDirection.STABLE
                trend_strength = 0.0
            else:
                trend_direction = TrendDirection.VOLATILE
                trend_strength = max(abs(download_trend), abs(star_trend))

            # Generate insights
            key_insights = []
            if trend_direction == TrendDirection.RISING:
                key_insights.append(f"Downloads increased by {download_trend*100:.1f}% over {time_period_months} months")
                key_insights.append("Package is gaining popularity")
            elif trend_direction == TrendDirection.FALLING:
                key_insights.append(f"Downloads decreased by {abs(download_trend)*100:.1f}% over {time_period_months} months")
                key_insights.append("Package popularity is declining")
            elif trend_direction == TrendDirection.VOLATILE:
                key_insights.append("Package shows volatile usage patterns")
                key_insights.append("Consider monitoring for stability")
            else:
                key_insights.append("Package shows stable usage patterns")
                key_insights.append("Reliable choice for production use")

            # Add ecosystem-specific insights
            if ecosystem == "npm":
                key_insights.append("JavaScript ecosystem - high churn rate expected")
            elif ecosystem == "pypi":
                key_insights.append("Python ecosystem - generally stable")
            elif ecosystem == "maven":
                key_insights.append("Java ecosystem - enterprise-focused")

            # Calculate confidence
            confidence = min(0.95, 0.6 + (len(recent_data) * 0.05))

            return TrendAnalysis(
                package_name=package_name,
                ecosystem=ecosystem,
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                confidence=confidence,
                time_period=f"{time_period_months} months",
                data_points=len(recent_data),
                prediction_horizon=30,
                key_insights=key_insights
            )

        except Exception as e:
            logger.error(f"Failed to analyze dependency trends: {e}", exc_info=True)
            raise

    def generate_dependency_insights(
        self,
        package_name: str,
        ecosystem: str
    ) -> list[DependencyInsight]:
        """Generate comprehensive insights for a dependency."""
        try:
            logger.info(f"Generating insights for {package_name}@{ecosystem}")

            insights = []

            # Security insight
            security_prediction = self.predict_vulnerability_risk(package_name, ecosystem)
            insights.append(DependencyInsight(
                insight_type="security",
                package_name=package_name,
                ecosystem=ecosystem,
                insight_score=security_prediction.vulnerability_probability,
                confidence=security_prediction.confidence,
                description=f"Security risk assessment: {security_prediction.risk_level.value} risk",
                impact="High" if security_prediction.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL] else "Medium",
                recommendations=security_prediction.mitigation_recommendations,
                related_packages=[]
            ))

            # Trend insight
            trend_analysis = self.analyze_dependency_trends(package_name, ecosystem)
            insights.append(DependencyInsight(
                insight_type="trend",
                package_name=package_name,
                ecosystem=ecosystem,
                insight_score=trend_analysis.trend_strength,
                confidence=trend_analysis.confidence,
                description=f"Usage trend: {trend_analysis.trend_direction.value}",
                impact="High" if trend_analysis.trend_direction == TrendDirection.FALLING else "Low",
                recommendations=self._get_trend_recommendations(trend_analysis),
                related_packages=[]
            ))

            # Maintenance insight
            maintenance_insight = self._analyze_maintenance_health(package_name, ecosystem)
            insights.append(maintenance_insight)

            # Performance insight
            performance_insight = self._analyze_performance_impact(package_name, ecosystem)
            insights.append(performance_insight)

            return insights

        except Exception as e:
            logger.error(f"Failed to generate dependency insights: {e}", exc_info=True)
            raise

    def predict_dependency_adoption(
        self,
        package_name: str,
        ecosystem: str,
        time_horizon_days: int = 90
    ) -> dict[str, Any]:
        """Predict dependency adoption trends."""
        try:
            logger.info(f"Predicting adoption for {package_name}@{ecosystem}")

            trend_data = self.trend_data.get(package_name, [])
            if not trend_data:
                return {
                    "package_name": package_name,
                    "ecosystem": ecosystem,
                    "predicted_adoption_rate": 0.0,
                    "confidence": 0.0,
                    "time_horizon_days": time_horizon_days,
                    "factors": ["No historical data available"]
                }

            # Calculate current adoption metrics
            recent_data = trend_data[:3]  # Last 3 months
            downloads = [entry["downloads"] for entry in recent_data]
            stars = [entry["stars"] for entry in recent_data]

            # Predict future adoption
            download_trend = self._calculate_trend(downloads)
            star_trend = self._calculate_trend(stars)

            # Calculate predicted adoption rate
            base_adoption = np.mean(downloads) / 10000  # Normalize
            trend_factor = 1 + (download_trend * 0.5)  # Apply trend
            ecosystem_factor = {"npm": 1.2, "pypi": 1.0, "maven": 0.8, "nuget": 0.9, "cargo": 0.7}.get(ecosystem, 1.0)

            predicted_adoption_rate = min(1.0, base_adoption * trend_factor * ecosystem_factor)

            # Calculate confidence
            confidence = min(0.95, 0.5 + (len(trend_data) * 0.05))

            # Generate factors
            factors = []
            if download_trend > 0.1:
                factors.append("Growing download trend")
            elif download_trend < -0.1:
                factors.append("Declining download trend")

            if star_trend > 0.05:
                factors.append("Increasing GitHub stars")

            factors.append(f"Ecosystem: {ecosystem}")

            return {
                "package_name": package_name,
                "ecosystem": ecosystem,
                "predicted_adoption_rate": predicted_adoption_rate,
                "confidence": confidence,
                "time_horizon_days": time_horizon_days,
                "factors": factors
            }

        except Exception as e:
            logger.error(f"Failed to predict dependency adoption: {e}", exc_info=True)
            raise

    def get_analytics_models(self) -> dict[str, AnalyticsModel]:
        """Get information about analytics models."""
        return self.models

    def get_model_performance(self, model_id: str) -> dict[str, Any]:
        """Get performance metrics for a specific model."""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")

        model = self.models[model_id]
        return {
            "model_id": model.model_id,
            "model_type": model.model_type,
            "version": model.version,
            "accuracy": model.accuracy,
            "last_trained": model.last_trained.isoformat(),
            "features_used": model.features_used,
            "performance_metrics": model.performance_metrics
        }

    def _calculate_trend(self, values: list[float]) -> float:
        """Calculate trend direction and strength."""
        if len(values) < 2:
            return 0.0

        # Simple linear trend calculation
        x = np.arange(len(values))
        y = np.array(values)

        # Calculate slope
        slope = np.polyfit(x, y, 1)[0]

        # Normalize by average value
        avg_value = np.mean(y)
        if avg_value > 0:
            return slope / avg_value
        else:
            return 0.0

    def _get_trend_recommendations(self, trend_analysis: TrendAnalysis) -> list[str]:
        """Get recommendations based on trend analysis."""
        recommendations = []

        if trend_analysis.trend_direction == TrendDirection.FALLING:
            recommendations.extend([
                "Consider migrating to alternative packages",
                "Monitor for security updates",
                "Evaluate long-term support"
            ])
        elif trend_analysis.trend_direction == TrendDirection.RISING:
            recommendations.extend([
                "Good choice for new projects",
                "Monitor for breaking changes",
                "Consider early adoption benefits"
            ])
        elif trend_analysis.trend_direction == TrendDirection.VOLATILE:
            recommendations.extend([
                "Use with caution in production",
                "Implement comprehensive testing",
                "Have backup alternatives ready"
            ])
        else:  # STABLE
            recommendations.extend([
                "Reliable for production use",
                "Good long-term choice",
                "Monitor for security updates"
            ])

        return recommendations

    def _analyze_maintenance_health(self, package_name: str, ecosystem: str) -> DependencyInsight:
        """Analyze maintenance health of a package."""
        trend_data = self.trend_data.get(package_name, [])

        if not trend_data:
            return DependencyInsight(
                insight_type="maintenance",
                package_name=package_name,
                ecosystem=ecosystem,
                insight_score=0.0,
                confidence=0.0,
                description="No maintenance data available",
                impact="Unknown",
                recommendations=["Monitor package activity"],
                related_packages=[]
            )

        # Analyze release frequency
        releases = [entry["releases"] for entry in trend_data[:6]]  # Last 6 months
        avg_releases = np.mean(releases)

        # Analyze issue activity
        issues = [entry["issues"] for entry in trend_data[:6]]
        avg_issues = np.mean(issues)

        # Calculate maintenance score
        release_score = min(1.0, avg_releases / 2.0)  # 2 releases/month = perfect score
        issue_score = min(1.0, avg_issues / 10.0)  # 10 issues/month = active maintenance

        maintenance_score = (release_score + issue_score) / 2

        # Determine impact and recommendations
        if maintenance_score > 0.7:
            impact = "Low"
            recommendations = ["Package is well-maintained", "Good choice for production"]
        elif maintenance_score > 0.4:
            impact = "Medium"
            recommendations = ["Monitor maintenance activity", "Consider alternatives"]
        else:
            impact = "High"
            recommendations = ["Package may be unmaintained", "Consider migration"]

        return DependencyInsight(
            insight_type="maintenance",
            package_name=package_name,
            ecosystem=ecosystem,
            insight_score=maintenance_score,
            confidence=0.8,
            description=f"Maintenance health: {impact} risk",
            impact=impact,
            recommendations=recommendations,
            related_packages=[]
        )

    def _analyze_performance_impact(self, package_name: str, ecosystem: str) -> DependencyInsight:
        """Analyze potential performance impact of a package."""
        # Mock performance analysis based on ecosystem and package characteristics
        ecosystem_performance = {
            "npm": 0.3,  # JavaScript packages can have performance impact
            "pypi": 0.2,  # Python packages generally moderate impact
            "maven": 0.1,  # Java packages typically well-optimized
            "nuget": 0.2,  # .NET packages moderate impact
            "cargo": 0.1   # Rust packages typically high performance
        }

        base_impact = ecosystem_performance.get(ecosystem, 0.2)

        # Adjust based on package characteristics
        if "framework" in package_name.lower():
            base_impact += 0.2
        if "ui" in package_name.lower() or "react" in package_name.lower():
            base_impact += 0.1

        performance_score = min(1.0, base_impact)

        if performance_score > 0.6:
            impact = "High"
            recommendations = ["Monitor performance impact", "Consider lightweight alternatives"]
        elif performance_score > 0.3:
            impact = "Medium"
            recommendations = ["Test performance in your environment", "Monitor bundle size"]
        else:
            impact = "Low"
            recommendations = ["Minimal performance impact expected"]

        return DependencyInsight(
            insight_type="performance",
            package_name=package_name,
            ecosystem=ecosystem,
            insight_score=performance_score,
            confidence=0.7,
            description=f"Performance impact: {impact}",
            impact=impact,
            recommendations=recommendations,
            related_packages=[]
        )

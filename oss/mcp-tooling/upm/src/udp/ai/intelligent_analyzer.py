"""
Intelligent analyzer for dependency insights and recommendations.

Provides AI-powered analysis of dependency patterns, security trends,
and optimization recommendations based on historical data and best practices.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AnalysisType(str, Enum):
    """Types of intelligent analysis."""
    SECURITY_TREND = "security_trend"
    DEPENDENCY_PATTERN = "dependency_pattern"
    PERFORMANCE_OPTIMIZATION = "performance_optimization"
    COMPLIANCE_RISK = "compliance_risk"
    MAINTENANCE_BURDEN = "maintenance_burden"
    COST_ANALYSIS = "cost_analysis"


class RiskLevel(str, Enum):
    """Risk levels for analysis results."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnalysisResult:
    """Result of an intelligent analysis."""
    analysis_type: AnalysisType
    risk_level: RiskLevel
    title: str
    description: str
    recommendations: List[str]
    confidence_score: float
    data_points: Dict[str, Any]
    generated_at: datetime


@dataclass
class DependencyInsight:
    """Insight about a specific dependency."""
    package_name: str
    ecosystem: str
    current_version: str
    latest_version: str
    insight_type: str
    description: str
    impact: str
    recommendation: str
    confidence: float


class IntelligentAnalyzer:
    """Provides intelligent analysis and insights for dependency management."""
    
    def __init__(self):
        self.analysis_patterns = self._load_analysis_patterns()
        self.recommendation_engine = self._load_recommendation_engine()
    
    def analyze_dependency_health(
        self, 
        dependencies: List[Dict[str, Any]],
        organization_id: str
    ) -> List[AnalysisResult]:
        """
        Analyze overall dependency health and provide insights.
        
        Args:
            dependencies: List of dependency information
            organization_id: Organization identifier
            
        Returns:
            List of analysis results
        """
        try:
            logger.info(f"Analyzing dependency health for {len(dependencies)} dependencies")
            
            results = []
            
            # Security trend analysis
            security_result = self._analyze_security_trends(dependencies)
            if security_result:
                results.append(security_result)
            
            # Dependency pattern analysis
            pattern_result = self._analyze_dependency_patterns(dependencies)
            if pattern_result:
                results.append(pattern_result)
            
            # Performance optimization analysis
            performance_result = self._analyze_performance_optimization(dependencies)
            if performance_result:
                results.append(performance_result)
            
            # Compliance risk analysis
            compliance_result = self._analyze_compliance_risks(dependencies)
            if compliance_result:
                results.append(compliance_result)
            
            # Maintenance burden analysis
            maintenance_result = self._analyze_maintenance_burden(dependencies)
            if maintenance_result:
                results.append(maintenance_result)
            
            logger.info(f"Generated {len(results)} analysis results")
            return results
            
        except Exception as e:
            logger.error(f"Failed to analyze dependency health: {e}", exc_info=True)
            raise
    
    def generate_dependency_insights(
        self, 
        package_name: str, 
        ecosystem: str,
        current_version: str,
        latest_version: str
    ) -> List[DependencyInsight]:
        """
        Generate specific insights for a dependency.
        
        Args:
            package_name: Name of the package
            ecosystem: Package ecosystem (npm, pypi, etc.)
            current_version: Current version being used
            latest_version: Latest available version
            
        Returns:
            List of dependency insights
        """
        try:
            logger.info(f"Generating insights for {package_name} {current_version}")
            
            insights = []
            
            # Version gap analysis
            version_insight = self._analyze_version_gap(
                package_name, ecosystem, current_version, latest_version
            )
            if version_insight:
                insights.append(version_insight)
            
            # Security insight
            security_insight = self._analyze_security_insight(
                package_name, ecosystem, current_version
            )
            if security_insight:
                insights.append(security_insight)
            
            # Performance insight
            performance_insight = self._analyze_performance_insight(
                package_name, ecosystem, current_version, latest_version
            )
            if performance_insight:
                insights.append(performance_insight)
            
            # Maintenance insight
            maintenance_insight = self._analyze_maintenance_insight(
                package_name, ecosystem, current_version
            )
            if maintenance_insight:
                insights.append(maintenance_insight)
            
            logger.info(f"Generated {len(insights)} insights for {package_name}")
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate dependency insights: {e}", exc_info=True)
            raise
    
    def predict_dependency_risks(
        self, 
        dependencies: List[Dict[str, Any]],
        time_horizon_days: int = 90
    ) -> List[AnalysisResult]:
        """
        Predict potential risks for dependencies over a time horizon.
        
        Args:
            dependencies: List of dependency information
            time_horizon_days: Number of days to predict ahead
            
        Returns:
            List of predicted risk analysis results
        """
        try:
            logger.info(f"Predicting dependency risks for {time_horizon_days} days ahead")
            
            predictions = []
            
            # Predict security vulnerabilities
            security_prediction = self._predict_security_vulnerabilities(
                dependencies, time_horizon_days
            )
            if security_prediction:
                predictions.append(security_prediction)
            
            # Predict maintenance issues
            maintenance_prediction = self._predict_maintenance_issues(
                dependencies, time_horizon_days
            )
            if maintenance_prediction:
                predictions.append(maintenance_prediction)
            
            # Predict performance degradation
            performance_prediction = self._predict_performance_degradation(
                dependencies, time_horizon_days
            )
            if performance_prediction:
                predictions.append(performance_prediction)
            
            logger.info(f"Generated {len(predictions)} risk predictions")
            return predictions
            
        except Exception as e:
            logger.error(f"Failed to predict dependency risks: {e}", exc_info=True)
            raise
    
    def _analyze_security_trends(self, dependencies: List[Dict[str, Any]]) -> Optional[AnalysisResult]:
        """Analyze security trends in dependencies."""
        try:
            # Count dependencies with known vulnerabilities
            vulnerable_count = sum(1 for dep in dependencies if dep.get('vulnerabilities', []))
            total_count = len(dependencies)
            vulnerability_rate = vulnerable_count / total_count if total_count > 0 else 0
            
            # Determine risk level
            if vulnerability_rate > 0.3:
                risk_level = RiskLevel.CRITICAL
            elif vulnerability_rate > 0.15:
                risk_level = RiskLevel.HIGH
            elif vulnerability_rate > 0.05:
                risk_level = RiskLevel.MEDIUM
            else:
                risk_level = RiskLevel.LOW
            
            # Generate recommendations
            recommendations = []
            if vulnerability_rate > 0.1:
                recommendations.append("Implement automated vulnerability scanning in CI/CD pipeline")
                recommendations.append("Set up security alerts for new vulnerabilities")
            if vulnerability_rate > 0.2:
                recommendations.append("Conduct security audit of all dependencies")
                recommendations.append("Consider using dependency pinning for critical packages")
            
            return AnalysisResult(
                analysis_type=AnalysisType.SECURITY_TREND,
                risk_level=risk_level,
                title="Security Vulnerability Analysis",
                description=f"Found {vulnerable_count} out of {total_count} dependencies with known vulnerabilities ({vulnerability_rate:.1%})",
                recommendations=recommendations,
                confidence_score=0.85,
                data_points={
                    "vulnerable_count": vulnerable_count,
                    "total_count": total_count,
                    "vulnerability_rate": vulnerability_rate
                },
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze security trends: {e}")
            return None
    
    def _analyze_dependency_patterns(self, dependencies: List[Dict[str, Any]]) -> Optional[AnalysisResult]:
        """Analyze dependency usage patterns."""
        try:
            # Analyze ecosystem distribution
            ecosystems = {}
            for dep in dependencies:
                ecosystem = dep.get('ecosystem', 'unknown')
                ecosystems[ecosystem] = ecosystems.get(ecosystem, 0) + 1
            
            # Find dominant ecosystem
            dominant_ecosystem = max(ecosystems.items(), key=lambda x: x[1]) if ecosystems else None
            
            # Analyze version patterns
            outdated_count = sum(1 for dep in dependencies if dep.get('is_outdated', False))
            total_count = len(dependencies)
            outdated_rate = outdated_count / total_count if total_count > 0 else 0
            
            # Determine risk level
            if outdated_rate > 0.5:
                risk_level = RiskLevel.HIGH
            elif outdated_rate > 0.3:
                risk_level = RiskLevel.MEDIUM
            else:
                risk_level = RiskLevel.LOW
            
            # Generate recommendations
            recommendations = []
            if outdated_rate > 0.3:
                recommendations.append("Implement automated dependency updates")
                recommendations.append("Set up regular dependency review process")
            if len(ecosystems) > 3:
                recommendations.append("Consider consolidating package ecosystems")
                recommendations.append("Evaluate if all ecosystems are necessary")
            
            return AnalysisResult(
                analysis_type=AnalysisType.DEPENDENCY_PATTERN,
                risk_level=risk_level,
                title="Dependency Pattern Analysis",
                description=f"Found {outdated_count} outdated dependencies ({outdated_rate:.1%}). Dominant ecosystem: {dominant_ecosystem[0] if dominant_ecosystem else 'None'}",
                recommendations=recommendations,
                confidence_score=0.80,
                data_points={
                    "ecosystems": ecosystems,
                    "outdated_count": outdated_count,
                    "outdated_rate": outdated_rate,
                    "dominant_ecosystem": dominant_ecosystem[0] if dominant_ecosystem else None
                },
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze dependency patterns: {e}")
            return None
    
    def _analyze_performance_optimization(self, dependencies: List[Dict[str, Any]]) -> Optional[AnalysisResult]:
        """Analyze performance optimization opportunities."""
        try:
            # Find large dependencies
            large_deps = [dep for dep in dependencies if dep.get('size_mb', 0) > 10]
            total_size = sum(dep.get('size_mb', 0) for dep in dependencies)
            
            # Find duplicate functionality
            duplicate_groups = self._find_duplicate_functionality(dependencies)
            
            # Determine risk level
            risk_level = RiskLevel.LOW
            if len(large_deps) > 5 or total_size > 100:
                risk_level = RiskLevel.MEDIUM
            if len(duplicate_groups) > 3:
                risk_level = RiskLevel.HIGH
            
            # Generate recommendations
            recommendations = []
            if large_deps:
                recommendations.append(f"Consider alternatives to {len(large_deps)} large dependencies")
                recommendations.append("Implement bundle size monitoring")
            if duplicate_groups:
                recommendations.append("Consolidate duplicate functionality across packages")
                recommendations.append("Review package selection for overlapping features")
            
            return AnalysisResult(
                analysis_type=AnalysisType.PERFORMANCE_OPTIMIZATION,
                risk_level=risk_level,
                title="Performance Optimization Analysis",
                description=f"Found {len(large_deps)} large dependencies and {len(duplicate_groups)} duplicate functionality groups",
                recommendations=recommendations,
                confidence_score=0.75,
                data_points={
                    "large_dependencies": len(large_deps),
                    "total_size_mb": total_size,
                    "duplicate_groups": len(duplicate_groups)
                },
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze performance optimization: {e}")
            return None
    
    def _analyze_compliance_risks(self, dependencies: List[Dict[str, Any]]) -> Optional[AnalysisResult]:
        """Analyze compliance risks in dependencies."""
        try:
            # Check for problematic licenses
            problematic_licenses = []
            for dep in dependencies:
                license_info = dep.get('license', '')
                if any(problematic in license_info.lower() for problematic in ['gpl', 'copyleft', 'agpl']):
                    problematic_licenses.append(dep)
            
            # Check for unlicensed packages
            unlicensed = [dep for dep in dependencies if not dep.get('license')]
            
            # Determine risk level
            risk_level = RiskLevel.LOW
            if problematic_licenses or unlicensed:
                risk_level = RiskLevel.MEDIUM
            if len(problematic_licenses) > 3 or len(unlicensed) > 5:
                risk_level = RiskLevel.HIGH
            
            # Generate recommendations
            recommendations = []
            if problematic_licenses:
                recommendations.append("Review licenses of problematic dependencies")
                recommendations.append("Consider alternatives to GPL-licensed packages")
            if unlicensed:
                recommendations.append("Contact maintainers of unlicensed packages")
                recommendations.append("Consider replacing unlicensed dependencies")
            
            return AnalysisResult(
                analysis_type=AnalysisType.COMPLIANCE_RISK,
                risk_level=risk_level,
                title="Compliance Risk Analysis",
                description=f"Found {len(problematic_licenses)} problematic licenses and {len(unlicensed)} unlicensed packages",
                recommendations=recommendations,
                confidence_score=0.90,
                data_points={
                    "problematic_licenses": len(problematic_licenses),
                    "unlicensed_packages": len(unlicensed)
                },
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze compliance risks: {e}")
            return None
    
    def _analyze_maintenance_burden(self, dependencies: List[Dict[str, Any]]) -> Optional[AnalysisResult]:
        """Analyze maintenance burden of dependencies."""
        try:
            # Find unmaintained packages
            unmaintained = [dep for dep in dependencies if dep.get('last_updated_days', 0) > 365]
            
            # Find packages with many open issues
            high_issue_count = [dep for dep in dependencies if dep.get('open_issues', 0) > 50]
            
            # Find packages with few maintainers
            few_maintainers = [dep for dep in dependencies if dep.get('maintainer_count', 0) < 2]
            
            # Determine risk level
            risk_level = RiskLevel.LOW
            if unmaintained or high_issue_count or few_maintainers:
                risk_level = RiskLevel.MEDIUM
            if len(unmaintained) > 5 or len(high_issue_count) > 3:
                risk_level = RiskLevel.HIGH
            
            # Generate recommendations
            recommendations = []
            if unmaintained:
                recommendations.append("Consider replacing unmaintained dependencies")
                recommendations.append("Fork and maintain critical unmaintained packages")
            if high_issue_count:
                recommendations.append("Monitor packages with high issue counts")
                recommendations.append("Consider alternatives to problematic packages")
            if few_maintainers:
                recommendations.append("Evaluate bus factor risk for single-maintainer packages")
                recommendations.append("Consider contributing to packages with few maintainers")
            
            return AnalysisResult(
                analysis_type=AnalysisType.MAINTENANCE_BURDEN,
                risk_level=risk_level,
                title="Maintenance Burden Analysis",
                description=f"Found {len(unmaintained)} unmaintained, {len(high_issue_count)} high-issue, and {len(few_maintainers)} few-maintainer packages",
                recommendations=recommendations,
                confidence_score=0.80,
                data_points={
                    "unmaintained_count": len(unmaintained),
                    "high_issue_count": len(high_issue_count),
                    "few_maintainers_count": len(few_maintainers)
                },
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze maintenance burden: {e}")
            return None
    
    def _analyze_version_gap(
        self, 
        package_name: str, 
        ecosystem: str, 
        current_version: str, 
        latest_version: str
    ) -> Optional[DependencyInsight]:
        """Analyze version gap for a dependency."""
        try:
            # Calculate version gap (simplified)
            version_gap = self._calculate_version_gap(current_version, latest_version)
            
            if version_gap <= 1:
                return None  # No significant gap
            
            # Determine impact
            if version_gap > 5:
                impact = "High - Major version behind, may miss critical features and security fixes"
            elif version_gap > 2:
                impact = "Medium - Several versions behind, may miss important updates"
            else:
                impact = "Low - Minor version behind, mostly bug fixes and minor features"
            
            # Generate recommendation
            if version_gap > 5:
                recommendation = "Plan major upgrade with thorough testing"
            elif version_gap > 2:
                recommendation = "Schedule upgrade to latest version"
            else:
                recommendation = "Update to latest version when convenient"
            
            return DependencyInsight(
                package_name=package_name,
                ecosystem=ecosystem,
                current_version=current_version,
                latest_version=latest_version,
                insight_type="version_gap",
                description=f"Package is {version_gap} versions behind latest",
                impact=impact,
                recommendation=recommendation,
                confidence=0.85
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze version gap: {e}")
            return None
    
    def _analyze_security_insight(
        self, 
        package_name: str, 
        ecosystem: str, 
        current_version: str
    ) -> Optional[DependencyInsight]:
        """Analyze security insight for a dependency."""
        # This would integrate with real vulnerability databases
        # For now, return a mock insight
        return DependencyInsight(
            package_name=package_name,
            ecosystem=ecosystem,
            current_version=current_version,
            latest_version=current_version,
            insight_type="security",
            description="No known vulnerabilities in current version",
            impact="Low - Package appears secure",
            recommendation="Continue monitoring for new vulnerabilities",
            confidence=0.70
        )
    
    def _analyze_performance_insight(
        self, 
        package_name: str, 
        ecosystem: str, 
        current_version: str, 
        latest_version: str
    ) -> Optional[DependencyInsight]:
        """Analyze performance insight for a dependency."""
        # This would analyze performance metrics
        # For now, return a mock insight
        return DependencyInsight(
            package_name=package_name,
            ecosystem=ecosystem,
            current_version=current_version,
            latest_version=latest_version,
            insight_type="performance",
            description="Latest version includes performance improvements",
            impact="Medium - Upgrading may improve application performance",
            recommendation="Consider upgrading for performance benefits",
            confidence=0.60
        )
    
    def _analyze_maintenance_insight(
        self, 
        package_name: str, 
        ecosystem: str, 
        current_version: str
    ) -> Optional[DependencyInsight]:
        """Analyze maintenance insight for a dependency."""
        # This would analyze maintenance metrics
        # For now, return a mock insight
        return DependencyInsight(
            package_name=package_name,
            ecosystem=ecosystem,
            current_version=current_version,
            latest_version=current_version,
            insight_type="maintenance",
            description="Package is actively maintained",
            impact="Low - Good maintenance status",
            recommendation="Continue using, monitor for changes",
            confidence=0.75
        )
    
    def _predict_security_vulnerabilities(
        self, 
        dependencies: List[Dict[str, Any]], 
        time_horizon_days: int
    ) -> Optional[AnalysisResult]:
        """Predict security vulnerabilities over time horizon."""
        # This would use machine learning models to predict vulnerabilities
        # For now, return a mock prediction
        return AnalysisResult(
            analysis_type=AnalysisType.SECURITY_TREND,
            risk_level=RiskLevel.MEDIUM,
            title="Predicted Security Vulnerabilities",
            description=f"Predicted 2-3 new vulnerabilities in next {time_horizon_days} days",
            recommendations=[
                "Implement automated vulnerability monitoring",
                "Set up security alerts for critical packages"
            ],
            confidence_score=0.65,
            data_points={"predicted_vulnerabilities": 2.5, "time_horizon_days": time_horizon_days},
            generated_at=datetime.utcnow()
        )
    
    def _predict_maintenance_issues(
        self, 
        dependencies: List[Dict[str, Any]], 
        time_horizon_days: int
    ) -> Optional[AnalysisResult]:
        """Predict maintenance issues over time horizon."""
        # This would predict maintenance issues
        # For now, return a mock prediction
        return AnalysisResult(
            analysis_type=AnalysisType.MAINTENANCE_BURDEN,
            risk_level=RiskLevel.LOW,
            title="Predicted Maintenance Issues",
            description=f"Predicted 1-2 maintenance issues in next {time_horizon_days} days",
            recommendations=[
                "Monitor packages with high maintenance risk",
                "Prepare contingency plans for critical dependencies"
            ],
            confidence_score=0.60,
            data_points={"predicted_issues": 1.5, "time_horizon_days": time_horizon_days},
            generated_at=datetime.utcnow()
        )
    
    def _predict_performance_degradation(
        self, 
        dependencies: List[Dict[str, Any]], 
        time_horizon_days: int
    ) -> Optional[AnalysisResult]:
        """Predict performance degradation over time horizon."""
        # This would predict performance issues
        # For now, return a mock prediction
        return AnalysisResult(
            analysis_type=AnalysisType.PERFORMANCE_OPTIMIZATION,
            risk_level=RiskLevel.LOW,
            title="Predicted Performance Issues",
            description=f"Predicted minimal performance impact in next {time_horizon_days} days",
            recommendations=[
                "Continue monitoring performance metrics",
                "Consider performance testing for large dependencies"
            ],
            confidence_score=0.55,
            data_points={"predicted_degradation": 0.1, "time_horizon_days": time_horizon_days},
            generated_at=datetime.utcnow()
        )
    
    def _find_duplicate_functionality(self, dependencies: List[Dict[str, Any]]) -> List[List[str]]:
        """Find dependencies with duplicate functionality."""
        # This would use more sophisticated analysis
        # For now, return empty list
        return []
    
    def _calculate_version_gap(self, current_version: str, latest_version: str) -> int:
        """Calculate version gap between current and latest versions."""
        # Simplified version gap calculation
        # In reality, this would parse semantic versions properly
        try:
            current_parts = current_version.split('.')
            latest_parts = latest_version.split('.')
            
            # Compare major version numbers
            current_major = int(current_parts[0]) if current_parts[0].isdigit() else 0
            latest_major = int(latest_parts[0]) if latest_parts[0].isdigit() else 0
            
            return latest_major - current_major
        except:
            return 0
    
    def _load_analysis_patterns(self) -> Dict[str, Any]:
        """Load analysis patterns and rules."""
        return {
            "security_patterns": {
                "vulnerability_keywords": ["vulnerability", "security", "exploit", "cve"],
                "risk_indicators": ["unmaintained", "deprecated", "outdated"]
            },
            "performance_patterns": {
                "size_thresholds": {"large": 10, "huge": 50},
                "duplicate_indicators": ["similar_name", "same_functionality"]
            }
        }
    
    def _load_recommendation_engine(self) -> Dict[str, Any]:
        """Load recommendation engine rules."""
        return {
            "security_recommendations": [
                "Implement automated vulnerability scanning",
                "Set up security alerts",
                "Regular security audits"
            ],
            "performance_recommendations": [
                "Bundle size optimization",
                "Dependency consolidation",
                "Performance monitoring"
            ]
        }

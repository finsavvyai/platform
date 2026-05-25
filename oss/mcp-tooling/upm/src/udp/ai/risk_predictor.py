"""
Advanced Risk Prediction Engine

Implements ML-based risk prediction, contextual vulnerability assessment,
and enterprise-grade vulnerability intelligence integration.
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set, Union
from dataclasses import dataclass, field
from enum import Enum
from uuid import UUID, uuid4
import json
import hashlib
import statistics
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingRegressor,
    IsolationForest,
)
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN

from .vulnerability_analyzer import (
    CVSSMetrics,
    ExploitabilityAnalysis,
    ContextualRiskAssessment,
    VulnerabilityCorrelation,
    CVSSCalculator,
    ExploitabilityAnalyzer,
)

from ..core.models.vulnerability import (
    Vulnerability,
    ProjectVulnerability,
    VulnerabilitySeverity,
    VulnerabilityStatus,
)

logger = logging.getLogger(__name__)


class AssetCriticality(str, Enum):
    """Asset criticality levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DataSensitivity(str, Enum):
    """Data sensitivity levels."""

    HIGHLY_SENSITIVE = "highly_sensitive"
    SENSITIVE = "sensitive"
    INTERNAL = "internal"
    PUBLIC = "public"


class ExposureLevel(str, Enum):
    """Exposure levels."""

    EXTERNAL = "external"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    ISOLATED = "isolated"


class RegulatoryFramework(str, Enum):
    """Regulatory frameworks."""

    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci_dss"
    SOX = "sox"
    NIST = "nist"
    ISO_27001 = "iso_27001"


@dataclass
class AssetContext:
    """Asset context information for risk assessment."""

    asset_id: str
    asset_name: str
    asset_type: str
    criticality: AssetCriticality
    data_sensitivity: DataSensitivity
    exposure_level: ExposureLevel
    user_base_size: int
    business_function: str
    compliance_frameworks: List[RegulatoryFramework] = field(default_factory=list)

    # Usage metrics
    daily_active_users: int = 0
    transaction_volume: int = 0
    revenue_impact: float = 0.0

    # Technical context
    internet_facing: bool = False
    handles_pii: bool = False
    handles_financial_data: bool = False
    handles_health_data: bool = False

    # Security controls
    authentication_mechanisms: List[str] = field(default_factory=list)
    encryption_level: str = "none"
    monitoring_level: str = "basic"
    backup_frequency: str = "daily"


@dataclass
class ThreatIntelligence:
    """Threat intelligence data for risk prediction."""

    threat_actors: List[Dict[str, Any]] = field(default_factory=list)
    attack_patterns: List[Dict[str, Any]] = field(default_factory=list)
    campaign_indicators: List[Dict[str, Any]] = field(default_factory=list)
    exploit_availability: Dict[str, Any] = field(default_factory=dict)
    dark_web_mentions: int = 0
    github_exploits: int = 0
    exploit_kit_usage: int = 0
    recent_attacks: List[Dict[str, Any]] = field(default_factory=list)

    # Temporal factors
    time_since_disclosure: timedelta = field(default_factory=lambda: timedelta(days=0))
    time_since_patch: Optional[timedelta] = None
    exploitation_trend: str = "stable"  # increasing, stable, decreasing


@dataclass
class RiskPrediction:
    """Risk prediction results."""

    vulnerability_id: str
    asset_id: str
    base_risk_score: float  # 0-10
    predicted_risk_score: float  # 0-10
    risk_tier: str  # Critical, High, Medium, Low

    # Component scores
    technical_risk: float  # 0-10
    business_risk: float  # 0-10
    contextual_risk: float  # 0-10

    # Time-based predictions
    time_to_exploitation: timedelta
    likelihood_of_exploitation: float  # 0-1
    risk_trajectory: str  # increasing, stable, decreasing

    # Confidence metrics
    prediction_confidence: float  # 0-1
    data_quality_score: float  # 0-1

    # Risk factors
    risk_factors: Dict[str, float] = field(default_factory=dict)
    mitigation_factors: Dict[str, float] = field(default_factory=dict)

    # Recommendations
    recommended_actions: List[str] = field(default_factory=list)
    remediation_priority: int = 1

    prediction_timestamp: datetime = field(default_factory=datetime.utcnow)


class FeatureExtractor:
    """Extracts features for ML-based risk prediction."""

    def __init__(self):
        self.text_vectorizer = TfidfVectorizer(max_features=100, stop_words="english")
        self.label_encoders = {}
        self.feature_names = []

    def extract_vulnerability_features(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
    ) -> Dict[str, float]:
        """Extract features from vulnerability data."""
        features = {}

        # CVSS-based features
        if hasattr(vulnerability, "cvss_score") and vulnerability.cvss_score:
            features["cvss_base_score"] = vulnerability.cvss_score
        else:
            # Calculate from metrics
            calculator = CVSSCalculator()
            features["cvss_base_score"] = calculator.calculate_base_score(cvss_metrics)

        # CVSS metric encodings
        features["attack_vector_network"] = (
            1.0 if cvss_metrics.attack_vector.value == "N" else 0.0
        )
        features["attack_vector_adjacent"] = (
            1.0 if cvss_metrics.attack_vector.value == "A" else 0.0
        )
        features["attack_vector_local"] = (
            1.0 if cvss_metrics.attack_vector.value == "L" else 0.0
        )
        features["attack_vector_physical"] = (
            1.0 if cvss_metrics.attack_vector.value == "P" else 0.0
        )

        features["attack_complexity_low"] = (
            1.0 if cvss_metrics.attack_complexity.value == "L" else 0.0
        )
        features["attack_complexity_high"] = (
            1.0 if cvss_metrics.attack_complexity.value == "H" else 0.0
        )

        features["privileges_none"] = (
            1.0 if cvss_metrics.privileges_required.value == "N" else 0.0
        )
        features["privileges_low"] = (
            1.0 if cvss_metrics.privileges_required.value == "L" else 0.0
        )
        features["privileges_high"] = (
            1.0 if cvss_metrics.privileges_required.value == "H" else 0.0
        )

        features["user_interaction_none"] = (
            1.0 if cvss_metrics.user_interaction.value == "N" else 0.0
        )
        features["user_interaction_required"] = (
            1.0 if cvss_metrics.user_interaction.value == "R" else 0.0
        )

        features["scope_unchanged"] = 1.0 if cvss_metrics.scope.value == "U" else 0.0
        features["scope_changed"] = 1.0 if cvss_metrics.scope.value == "C" else 0.0

        # Impact features
        features["confidentiality_impact_high"] = (
            1.0 if cvss_metrics.confidentiality_impact.value == "H" else 0.0
        )
        features["confidentiality_impact_low"] = (
            1.0 if cvss_metrics.confidentiality_impact.value == "L" else 0.0
        )
        features["confidentiality_impact_none"] = (
            1.0 if cvss_metrics.confidentiality_impact.value == "N" else 0.0
        )

        features["integrity_impact_high"] = (
            1.0 if cvss_metrics.integrity_impact.value == "H" else 0.0
        )
        features["integrity_impact_low"] = (
            1.0 if cvss_metrics.integrity_impact.value == "L" else 0.0
        )
        features["integrity_impact_none"] = (
            1.0 if cvss_metrics.integrity_impact.value == "N" else 0.0
        )

        features["availability_impact_high"] = (
            1.0 if cvss_metrics.availability_impact.value == "H" else 0.0
        )
        features["availability_impact_low"] = (
            1.0 if cvss_metrics.availability_impact.value == "L" else 0.0
        )
        features["availability_impact_none"] = (
            1.0 if cvss_metrics.availability_impact.value == "N" else 0.0
        )

        # Exploitability features
        features["exploitability_score"] = exploitability_analysis.exploitability_score
        features["time_to_exploit_days"] = exploitability_analysis.time_to_exploit.days
        features["exploit_likelihood"] = exploitability_analysis.likelihood_of_exploit

        # Complexity encoding
        complexity_map = {"Low": 1.0, "Medium": 2.0, "High": 3.0}
        features["exploit_complexity_numeric"] = complexity_map.get(
            exploitability_analysis.exploit_complexity, 2.0
        )

        # Resource requirements count
        features["required_resources_count"] = len(
            exploitability_analysis.required_resources
        )
        features["attack_prerequisites_count"] = len(
            exploitability_analysis.attack_prerequisites
        )

        # Binary features
        features["internet_exposure"] = (
            1.0 if exploitability_analysis.internet_exposure else 0.0
        )
        features["user_interaction_required"] = (
            1.0 if exploitability_analysis.user_interaction_required else 0.0
        )

        # Vulnerability type features
        vuln_type = getattr(vulnerability, "vulnerability_type", "").lower()
        features["is_remote_code_execution"] = (
            1.0 if "rce" in vuln_type or "remote code" in vuln_type else 0.0
        )
        features["is_sql_injection"] = (
            1.0 if "sql injection" in vuln_type or "sqli" in vuln_type else 0.0
        )
        features["is_cross_site_scripting"] = (
            1.0 if "xss" in vuln_type or "cross-site scripting" in vuln_type else 0.0
        )
        features["is_buffer_overflow"] = (
            1.0
            if "buffer overflow" in vuln_type or "memory corruption" in vuln_type
            else 0.0
        )
        features["is_denial_of_service"] = (
            1.0 if "dos" in vuln_type or "denial of service" in vuln_type else 0.0
        )
        features["is_privilege_escalation"] = (
            1.0 if "privilege escalation" in vuln_type else 0.0
        )

        # Temporal features
        if hasattr(vulnerability, "published_at") and vulnerability.published_at:
            try:
                published_date = datetime.fromisoformat(
                    vulnerability.published_at.replace("Z", "+00:00")
                )
                features["days_since_disclosure"] = (
                    datetime.utcnow() - published_date
                ).days
            except:
                features["days_since_disclosure"] = 0
        else:
            features["days_since_disclosure"] = 0

        # Count-based features
        features["reference_count"] = len(getattr(vulnerability, "references", []))
        features["affected_packages_count"] = len(
            getattr(vulnerability, "affected_packages", [])
        )

        # CVE ID features
        if hasattr(vulnerability, "cve_id") and vulnerability.cve_id:
            features["has_cve_id"] = 1.0
            cve_year = (
                vulnerability.cve_id.split("-")[1]
                if len(vulnerability.cve_id.split("-")) > 1
                else "2020"
            )
            features["cve_year"] = int(cve_year) if cve_year.isdigit() else 2020
        else:
            features["has_cve_id"] = 0.0
            features["cve_year"] = 2020

        # Source features
        source = getattr(vulnerability, "source", "").lower()
        features["source_nvd"] = 1.0 if "nvd" in source else 0.0
        features["source_github"] = 1.0 if "github" in source else 0.0
        features["source_osv"] = 1.0 if "osv" in source else 0.0
        features["source_snyk"] = 1.0 if "snyk" in source else 0.0

        return features

    def extract_asset_features(self, asset_context: AssetContext) -> Dict[str, float]:
        """Extract features from asset context."""
        features = {}

        # Criticality encoding
        criticality_map = {
            AssetCriticality.CRITICAL: 4.0,
            AssetCriticality.HIGH: 3.0,
            AssetCriticality.MEDIUM: 2.0,
            AssetCriticality.LOW: 1.0,
        }
        features["asset_criticality_numeric"] = criticality_map[
            asset_context.criticality
        ]

        features["asset_critical_critical"] = (
            1.0 if asset_context.criticality == AssetCriticality.CRITICAL else 0.0
        )
        features["asset_critical_high"] = (
            1.0 if asset_context.criticality == AssetCriticality.HIGH else 0.0
        )
        features["asset_critical_medium"] = (
            1.0 if asset_context.criticality == AssetCriticality.MEDIUM else 0.0
        )
        features["asset_critical_low"] = (
            1.0 if asset_context.criticality == AssetCriticality.LOW else 0.0
        )

        # Data sensitivity encoding
        sensitivity_map = {
            DataSensitivity.HIGHLY_SENSITIVE: 4.0,
            DataSensitivity.SENSITIVE: 3.0,
            DataSensitivity.INTERNAL: 2.0,
            DataSensitivity.PUBLIC: 1.0,
        }
        features["data_sensitivity_numeric"] = sensitivity_map[
            asset_context.data_sensitivity
        ]

        features["data_highly_sensitive"] = (
            1.0
            if asset_context.data_sensitivity == DataSensitivity.HIGHLY_SENSITIVE
            else 0.0
        )
        features["data_sensitive"] = (
            1.0 if asset_context.data_sensitivity == DataSensitivity.SENSITIVE else 0.0
        )
        features["data_internal"] = (
            1.0 if asset_context.data_sensitivity == DataSensitivity.INTERNAL else 0.0
        )
        features["data_public"] = (
            1.0 if asset_context.data_sensitivity == DataSensitivity.PUBLIC else 0.0
        )

        # Exposure encoding
        exposure_map = {
            ExposureLevel.EXTERNAL: 4.0,
            ExposureLevel.INTERNAL: 3.0,
            ExposureLevel.RESTRICTED: 2.0,
            ExposureLevel.ISOLATED: 1.0,
        }
        features["exposure_level_numeric"] = exposure_map[asset_context.exposure_level]

        features["exposure_external"] = (
            1.0 if asset_context.exposure_level == ExposureLevel.EXTERNAL else 0.0
        )
        features["exposure_internal"] = (
            1.0 if asset_context.exposure_level == ExposureLevel.INTERNAL else 0.0
        )
        features["exposure_restricted"] = (
            1.0 if asset_context.exposure_level == ExposureLevel.RESTRICTED else 0.0
        )
        features["exposure_isolated"] = (
            1.0 if asset_context.exposure_level == ExposureLevel.ISOLATED else 0.0
        )

        # User and usage metrics
        features["user_base_size"] = float(asset_context.user_base_size)
        features["daily_active_users"] = float(asset_context.daily_active_users)
        features["transaction_volume"] = float(asset_context.transaction_volume)
        features["revenue_impact"] = asset_context.revenue_impact

        # Log-transformed features for skewed distributions
        features["log_user_base_size"] = np.log1p(asset_context.user_base_size)
        features["log_daily_active_users"] = np.log1p(asset_context.daily_active_users)
        features["log_transaction_volume"] = np.log1p(asset_context.transaction_volume)

        # Business function encoding (simplified)
        business_functions = [
            "authentication",
            "authorization",
            "payment",
            "analytics",
            "logging",
            "database",
            "api",
            "ui",
            "monitoring",
            "backup",
        ]
        for func in business_functions:
            features[f"business_function_{func}"] = (
                1.0 if func in asset_context.business_function.lower() else 0.0
            )

        # Compliance frameworks
        features["compliance_gdpr"] = (
            1.0
            if RegulatoryFramework.GDPR in asset_context.compliance_frameworks
            else 0.0
        )
        features["compliance_hipaa"] = (
            1.0
            if RegulatoryFramework.HIPAA in asset_context.compliance_frameworks
            else 0.0
        )
        features["compliance_pci_dss"] = (
            1.0
            if RegulatoryFramework.PCI_DSS in asset_context.compliance_frameworks
            else 0.0
        )
        features["compliance_sox"] = (
            1.0
            if RegulatoryFramework.SOX in asset_context.compliance_frameworks
            else 0.0
        )
        features["compliance_count"] = len(asset_context.compliance_frameworks)

        # Technical context
        features["internet_facing"] = 1.0 if asset_context.internet_facing else 0.0
        features["handles_pii"] = 1.0 if asset_context.handles_pii else 0.0
        features["handles_financial_data"] = (
            1.0 if asset_context.handles_financial_data else 0.0
        )
        features["handles_health_data"] = (
            1.0 if asset_context.handles_health_data else 0.0
        )

        # Security controls
        features["authentication_mechanisms_count"] = len(
            asset_context.authentication_mechanisms
        )

        # Encryption level encoding
        encryption_map = {"none": 0.0, "basic": 1.0, "strong": 2.0, "military": 3.0}
        features["encryption_level_numeric"] = encryption_map.get(
            asset_context.encryption_level.lower(), 0.0
        )

        # Monitoring level encoding
        monitoring_map = {
            "none": 0.0,
            "basic": 1.0,
            "advanced": 2.0,
            "comprehensive": 3.0,
        }
        features["monitoring_level_numeric"] = monitoring_map.get(
            asset_context.monitoring_level.lower(), 1.0
        )

        # Backup frequency encoding
        backup_map = {
            "none": 0.0,
            "weekly": 1.0,
            "daily": 2.0,
            "hourly": 3.0,
            "realtime": 4.0,
        }
        features["backup_frequency_numeric"] = backup_map.get(
            asset_context.backup_frequency.lower(), 2.0
        )

        return features

    def extract_threat_intelligence_features(
        self, threat_intel: ThreatIntelligence
    ) -> Dict[str, float]:
        """Extract features from threat intelligence."""
        features = {}

        # Threat actor features
        features["threat_actors_count"] = len(threat_intel.threat_actors)
        features["advanced_threat_actors"] = sum(
            1
            for ta in threat_intel.threat_actors
            if ta.get("sophistication", "").lower() in ["advanced", "apt"]
        )

        # Attack pattern features
        features["attack_patterns_count"] = len(threat_intel.attack_patterns)
        features["high_severity_patterns"] = sum(
            1
            for ap in threat_intel.attack_patterns
            if ap.get("severity", "").lower() in ["high", "critical"]
        )

        # Campaign indicators
        features["campaign_indicators_count"] = len(threat_intel.campaign_indicators)
        features["active_campaigns"] = sum(
            1
            for ci in threat_intel.campaign_indicators
            if ci.get("status", "").lower() == "active"
        )

        # Exploit availability
        features["exploit_kit_usage"] = float(threat_intel.exploit_kit_usage)
        features["github_exploits"] = float(threat_intel.github_exploits)
        features["dark_web_mentions"] = float(threat_intel.dark_web_mentions)
        features["has_public_exploit"] = (
            1.0
            if (threat_intel.github_exploits > 0 or threat_intel.exploit_kit_usage > 0)
            else 0.0
        )

        # Temporal features
        features["days_since_disclosure"] = threat_intel.time_since_disclosure.days
        features["has_patch_available"] = (
            1.0 if threat_intel.time_since_patch is not None else 0.0
        )
        if threat_intel.time_since_patch:
            features["days_since_patch"] = threat_intel.time_since_patch.days
        else:
            features["days_since_patch"] = -1  # Indicates no patch

        # Trend encoding
        trend_map = {"increasing": 3.0, "stable": 2.0, "decreasing": 1.0}
        features["exploitation_trend_numeric"] = trend_map.get(
            threat_intel.exploitation_trend.lower(), 2.0
        )
        features["trend_increasing"] = (
            1.0 if threat_intel.exploitation_trend.lower() == "increasing" else 0.0
        )
        features["trend_stable"] = (
            1.0 if threat_intel.exploitation_trend.lower() == "stable" else 0.0
        )
        features["trend_decreasing"] = (
            1.0 if threat_intel.exploitation_trend.lower() == "decreasing" else 0.0
        )

        # Recent attacks
        features["recent_attacks_count"] = len(threat_intel.recent_attacks)
        features["successful_recent_attacks"] = sum(
            1 for ra in threat_intel.recent_attacks if ra.get("success", False)
        )

        return features

    def extract_combined_features(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
        asset_context: AssetContext,
        threat_intel: Optional[ThreatIntelligence] = None,
    ) -> Dict[str, float]:
        """Extract combined feature vector for ML model."""
        # Extract feature sets
        vuln_features = self.extract_vulnerability_features(
            vulnerability, cvss_metrics, exploitability_analysis
        )
        asset_features = self.extract_asset_features(asset_context)

        # Combine features
        combined_features = {**vuln_features, **asset_features}

        # Add threat intelligence if available
        if threat_intel:
            threat_features = self.extract_threat_intelligence_features(threat_intel)
            combined_features = {**combined_features, **threat_features}

        return combined_features


class MLRiskPredictor:
    """Machine learning-based risk prediction model."""

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.scaler = StandardScaler()
        self.risk_model = None
        self.exploit_model = None
        self.anomaly_detector = None

        # Feature tracking
        self.feature_names = []
        self.is_trained = False

        # Model performance metrics
        self.training_metrics = {}

    def prepare_training_data(
        self, historical_data: List[Dict[str, Any]]
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prepare training data from historical vulnerability data.

        Args:
            historical_data: List of historical vulnerability records

        Returns:
            Tuple of (features, labels, feature_names)
        """
        features_list = []
        labels = []

        for record in historical_data:
            try:
                # Extract features from record
                feature_dict = self._extract_features_from_record(record)

                # Add to feature list
                features_list.append(list(feature_dict.values()))

                # Extract label (risk score or risk category)
                if "risk_score" in record:
                    labels.append(record["risk_score"])
                elif "risk_category" in record:
                    # Map risk category to numeric
                    category_map = {
                        "low": 1.0,
                        "medium": 5.0,
                        "high": 7.5,
                        "critical": 9.0,
                    }
                    labels.append(
                        category_map.get(record["risk_category"].lower(), 5.0)
                    )
                else:
                    # Default to medium risk
                    labels.append(5.0)

            except Exception as e:
                logger.warning(
                    f"Failed to process record {record.get('id', 'unknown')}: {e}"
                )
                continue

        if not features_list:
            raise ValueError("No valid training data found")

        # Convert to numpy arrays
        X = np.array(features_list)
        y = np.array(labels)

        # Store feature names
        feature_names = list(feature_dict.keys())

        logger.info(
            f"Prepared training data: {X.shape[0]} samples, {X.shape[1]} features"
        )

        return X, y, feature_names

    def train_risk_prediction_model(
        self, historical_data: List[Dict[str, Any]], validation_split: float = 0.2
    ) -> Dict[str, float]:
        """
        Train the risk prediction model.

        Args:
            historical_data: Historical vulnerability data
            validation_split: Fraction of data to use for validation

        Returns:
            Training metrics
        """
        try:
            logger.info(
                f"Training risk prediction model with {len(historical_data)} records"
            )

            # Prepare training data
            X, y, feature_names = self.prepare_training_data(historical_data)

            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=validation_split, random_state=42
            )

            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_val_scaled = self.scaler.transform(X_val)

            # Train model (Gradient Boosting Regressor for better performance)
            self.risk_model = GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.1,
                max_depth=6,
                random_state=42,
                subsample=0.8,
            )

            self.risk_model.fit(X_train_scaled, y_train)

            # Make predictions
            y_train_pred = self.risk_model.predict(X_train_scaled)
            y_val_pred = self.risk_model.predict(X_val_scaled)

            # Calculate metrics
            train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
            val_rmse = np.sqrt(mean_squared_error(y_val, y_val_pred))
            train_r2 = r2_score(y_train, y_train_pred)
            val_r2 = r2_score(y_val, y_val_pred)

            # Cross-validation
            cv_scores = cross_val_score(
                self.risk_model,
                X_train_scaled,
                y_train,
                cv=5,
                scoring="neg_mean_squared_error",
            )
            cv_rmse = np.sqrt(-cv_scores.mean())

            # Store metrics
            self.training_metrics = {
                "train_rmse": train_rmse,
                "val_rmse": val_rmse,
                "train_r2": train_r2,
                "val_r2": val_r2,
                "cv_rmse": cv_rmse,
                "training_samples": len(X_train),
                "validation_samples": len(X_val),
                "feature_count": len(feature_names),
            }

            # Store feature names
            self.feature_names = feature_names
            self.is_trained = True

            logger.info(
                f"Model trained successfully. "
                f"Validation RMSE: {val_rmse:.3f}, R²: {val_r2:.3f}"
            )

            return self.training_metrics

        except Exception as e:
            logger.error(f"Failed to train risk prediction model: {e}")
            raise

    def train_exploit_prediction_model(
        self, exploit_data: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Train exploit prediction model.

        Args:
            exploit_data: Historical exploit data

        Returns:
            Training metrics
        """
        try:
            logger.info(
                f"Training exploit prediction model with {len(exploit_data)} records"
            )

            # Prepare data
            features_list = []
            labels = []

            for record in exploit_data:
                try:
                    feature_dict = self._extract_exploit_features_from_record(record)
                    features_list.append(list(feature_dict.values()))
                    labels.append(int(record.get("exploited", False)))
                except Exception as e:
                    logger.warning(f"Failed to process exploit record: {e}")
                    continue

            if len(features_list) < 50:
                logger.warning("Insufficient exploit data for training")
                return {}

            X = np.array(features_list)
            y = np.array(labels)

            # Split data
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            # Train classifier
            self.exploit_model = RandomForestClassifier(
                n_estimators=100, max_depth=10, random_state=42, class_weight="balanced"
            )

            self.exploit_model.fit(X_train, y_train)

            # Make predictions
            y_train_pred = self.exploit_model.predict(X_train)
            y_val_pred = self.exploit_model.predict(X_val)
            y_val_proba = self.exploit_model.predict_proba(X_val)[:, 1]

            # Calculate metrics
            train_accuracy = accuracy_score(y_train, y_train_pred)
            val_accuracy = accuracy_score(y_val, y_val_pred)
            val_precision = precision_score(
                y_val, y_val_pred, average="weighted", zero_division=0
            )
            val_recall = recall_score(
                y_val, y_val_pred, average="weighted", zero_division=0
            )
            val_f1 = f1_score(y_val, y_val_pred, average="weighted", zero_division=0)
            val_auc = (
                roc_auc_score(y_val, y_val_proba) if len(np.unique(y_val)) > 1 else 0.5
            )

            logger.info(
                f"Exploit model trained. "
                f"Accuracy: {val_accuracy:.3f}, F1: {val_f1:.3f}, AUC: {val_auc:.3f}"
            )

            return {
                "train_accuracy": train_accuracy,
                "val_accuracy": val_accuracy,
                "val_precision": val_precision,
                "val_recall": val_recall,
                "val_f1": val_f1,
                "val_auc": val_auc,
            }

        except Exception as e:
            logger.error(f"Failed to train exploit prediction model: {e}")
            return {}

    def predict_risk(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
        asset_context: AssetContext,
        threat_intel: Optional[ThreatIntelligence] = None,
    ) -> RiskPrediction:
        """
        Predict risk for a vulnerability.

        Args:
            vulnerability: Vulnerability to predict risk for
            cvss_metrics: CVSS metrics
            exploitability_analysis: Exploitability analysis
            asset_context: Asset context
            threat_intel: Optional threat intelligence

        Returns:
            Risk prediction
        """
        try:
            if not self.is_trained or not self.risk_model:
                # Return basic prediction if model not trained
                return self._create_basic_prediction(
                    vulnerability, cvss_metrics, exploitability_analysis, asset_context
                )

            # Extract features
            features = self.feature_extractor.extract_combined_features(
                vulnerability,
                cvss_metrics,
                exploitability_analysis,
                asset_context,
                threat_intel,
            )

            # Ensure feature order matches training data
            feature_vector = []
            for feature_name in self.feature_names:
                feature_vector.append(features.get(feature_name, 0.0))

            X = np.array([feature_vector])
            X_scaled = self.scaler.transform(X)

            # Predict risk score
            predicted_score = float(self.risk_model.predict(X_scaled)[0])
            predicted_score = max(0.0, min(10.0, predicted_score))  # Clamp to 0-10

            # Predict exploit probability if model available
            exploit_likelihood = 0.5  # Default
            if self.exploit_model:
                exploit_features = self._extract_exploit_features(
                    vulnerability, cvss_metrics, exploitability_analysis, asset_context
                )
                try:
                    exploit_prob = self.exploit_model.predict_proba([exploit_features])[
                        0
                    ][1]
                    exploit_likelihood = float(exploit_prob)
                except:
                    exploit_likelihood = 0.5

            # Determine risk tier
            if predicted_score >= 8.0:
                risk_tier = "Critical"
            elif predicted_score >= 6.0:
                risk_tier = "High"
            elif predicted_score >= 4.0:
                risk_tier = "Medium"
            else:
                risk_tier = "Low"

            # Calculate component scores
            base_score = getattr(vulnerability, "cvss_score", 5.0)
            technical_risk = min(
                10.0, base_score + exploitability_analysis.exploitability_score / 10.0
            )
            business_risk = self._calculate_business_risk(asset_context)
            contextual_risk = predicted_score

            # Estimate time to exploitation
            time_to_exploitation = self._estimate_time_to_exploitation(
                predicted_score, exploit_likelihood, exploitability_analysis
            )

            # Determine risk trajectory
            risk_trajectory = self._determine_risk_trajectory(
                vulnerability, threat_intel, exploit_likelihood
            )

            # Calculate confidence
            prediction_confidence = self._calculate_prediction_confidence(
                vulnerability, asset_context, threat_intel
            )
            data_quality_score = self._calculate_data_quality(
                vulnerability, asset_context, threat_intel
            )

            # Analyze risk factors
            risk_factors, mitigation_factors = self._analyze_risk_factors(
                vulnerability, cvss_metrics, exploitability_analysis, asset_context
            )

            # Generate recommendations
            recommended_actions = self._generate_recommendations(
                predicted_score, risk_tier, vulnerability, asset_context
            )

            # Set remediation priority
            remediation_priority = self._calculate_remediation_priority(
                predicted_score, exploit_likelihood, asset_context
            )

            return RiskPrediction(
                vulnerability_id=vulnerability.id,
                asset_id=asset_context.asset_id,
                base_risk_score=base_score,
                predicted_risk_score=predicted_score,
                risk_tier=risk_tier,
                technical_risk=technical_risk,
                business_risk=business_risk,
                contextual_risk=contextual_risk,
                time_to_exploitation=time_to_exploitation,
                likelihood_of_exploitation=exploit_likelihood,
                risk_trajectory=risk_trajectory,
                prediction_confidence=prediction_confidence,
                data_quality_score=data_quality_score,
                risk_factors=risk_factors,
                mitigation_factors=mitigation_factors,
                recommended_actions=recommended_actions,
                remediation_priority=remediation_priority,
            )

        except Exception as e:
            logger.error(
                f"Failed to predict risk for vulnerability {vulnerability.id}: {e}"
            )
            # Return fallback prediction
            return self._create_basic_prediction(
                vulnerability, cvss_metrics, exploitability_analysis, asset_context
            )

    def _extract_features_from_record(self, record: Dict[str, Any]) -> Dict[str, float]:
        """Extract features from historical record."""
        # This would need to be implemented based on the structure of historical data
        # For now, return a basic feature set
        features = {
            "cvss_base_score": record.get("cvss_score", 5.0),
            "days_since_disclosure": record.get("days_old", 30),
            "asset_criticality_numeric": record.get("asset_criticality", 2.0),
            "exposure_level_numeric": record.get("exposure_level", 2.0),
            "internet_facing": 1.0 if record.get("internet_exposed", False) else 0.0,
            "has_public_exploit": 1.0
            if record.get("exploit_available", False)
            else 0.0,
            "data_sensitivity_numeric": record.get("data_sensitivity", 2.0),
            "compliance_count": record.get("compliance_frameworks_count", 0),
        }

        # Add more features as needed based on available data
        return features

    def _extract_exploit_features_from_record(
        self, record: Dict[str, Any]
    ) -> Dict[str, float]:
        """Extract exploit features from record."""
        return {
            "cvss_base_score": record.get("cvss_score", 5.0),
            "days_since_disclosure": record.get("days_old", 30),
            "has_public_exploit": 1.0
            if record.get("exploit_available", False)
            else 0.0,
            "attack_vector_network": 1.0 if record.get("attack_vector") == "N" else 0.0,
            "attack_complexity_low": 1.0
            if record.get("attack_complexity") == "L"
            else 0.0,
            "privileges_none": 1.0 if record.get("privileges_required") == "N" else 0.0,
            "user_interaction_none": 1.0
            if record.get("user_interaction") == "N"
            else 0.0,
            "scope_changed": 1.0 if record.get("scope") == "C" else 0.0,
        }

    def _extract_exploit_features(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
        asset_context: AssetContext,
    ) -> List[float]:
        """Extract features for exploit prediction."""
        return [
            getattr(vulnerability, "cvss_score", 5.0),
            exploitability_analysis.exploitability_score,
            1.0 if cvss_metrics.attack_vector.value == "N" else 0.0,
            1.0 if cvss_metrics.attack_complexity.value == "L" else 0.0,
            1.0 if cvss_metrics.privileges_required.value == "N" else 0.0,
            1.0 if cvss_metrics.user_interaction.value == "N" else 0.0,
            1.0 if cvss_metrics.scope.value == "C" else 0.0,
            1.0 if asset_context.internet_facing else 0.0,
            len(getattr(vulnerability, "references", [])),
            1.0 if getattr(vulnerability, "exploit_available", False) else 0.0,
        ]

    def _create_basic_prediction(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
        asset_context: AssetContext,
    ) -> RiskPrediction:
        """Create basic prediction without ML model."""
        base_score = getattr(vulnerability, "cvss_score", 5.0)

        # Simple risk calculation
        asset_multiplier = {
            AssetCriticality.CRITICAL: 1.5,
            AssetCriticality.HIGH: 1.2,
            AssetCriticality.MEDIUM: 1.0,
            AssetCriticality.LOW: 0.8,
        }[asset_context.criticality]

        exposure_multiplier = {
            ExposureLevel.EXTERNAL: 1.3,
            ExposureLevel.INTERNAL: 1.1,
            ExposureLevel.RESTRICTED: 1.0,
            ExposureLevel.ISOLATED: 0.7,
        }[asset_context.exposure_level]

        predicted_score = min(10.0, base_score * asset_multiplier * exposure_multiplier)

        if predicted_score >= 8.0:
            risk_tier = "Critical"
        elif predicted_score >= 6.0:
            risk_tier = "High"
        elif predicted_score >= 4.0:
            risk_tier = "Medium"
        else:
            risk_tier = "Low"

        return RiskPrediction(
            vulnerability_id=vulnerability.id,
            asset_id=asset_context.asset_id,
            base_risk_score=base_score,
            predicted_risk_score=predicted_score,
            risk_tier=risk_tier,
            technical_risk=base_score,
            business_risk=base_score * asset_multiplier,
            contextual_risk=predicted_score,
            time_to_exploitation=timedelta(days=30),
            likelihood_of_exploitation=0.3,
            risk_trajectory="stable",
            prediction_confidence=0.5,
            data_quality_score=0.5,
            recommended_actions=["Review and assess manually"],
            remediation_priority=1,
        )

    def _calculate_business_risk(self, asset_context: AssetContext) -> float:
        """Calculate business risk component."""
        criticality_scores = {
            AssetCriticality.CRITICAL: 9.0,
            AssetCriticality.HIGH: 7.0,
            AssetCriticality.MEDIUM: 5.0,
            AssetCriticality.LOW: 3.0,
        }

        sensitivity_scores = {
            DataSensitivity.HIGHLY_SENSITIVE: 4.0,
            DataSensitivity.SENSITIVE: 3.0,
            DataSensitivity.INTERNAL: 2.0,
            DataSensitivity.PUBLIC: 1.0,
        }

        exposure_scores = {
            ExposureLevel.EXTERNAL: 4.0,
            ExposureLevel.INTERNAL: 3.0,
            ExposureLevel.RESTRICTED: 2.0,
            ExposureLevel.ISOLATED: 1.0,
        }

        criticality_score = criticality_scores[asset_context.criticality]
        sensitivity_score = sensitivity_scores[asset_context.data_sensitivity]
        exposure_score = exposure_scores[asset_context.exposure_level]

        # Compliance impact
        compliance_impact = min(3.0, len(asset_context.compliance_frameworks) * 0.5)

        # User impact
        user_impact = min(3.0, np.log1p(asset_context.user_base_size) / 2)

        # Revenue impact
        revenue_impact = min(
            3.0, asset_context.revenue_impact / 1000000
        )  # Normalize by million

        # Combine scores
        business_risk = (
            criticality_score * 0.3
            + sensitivity_score * 0.2
            + exposure_score * 0.2
            + compliance_impact * 0.1
            + user_impact * 0.1
            + revenue_impact * 0.1
        )

        return min(10.0, business_risk)

    def _estimate_time_to_exploitation(
        self,
        predicted_score: float,
        exploit_likelihood: float,
        exploitability_analysis: ExploitabilityAnalysis,
    ) -> timedelta:
        """Estimate time to exploitation."""
        # Base time from exploitability analysis
        base_time = exploitability_analysis.time_to_exploit.days

        # Adjust based on predicted risk and exploit likelihood
        risk_adjustment = (
            10.0 - predicted_score
        ) / 10.0  # Higher risk = faster exploitation
        likelihood_adjustment = (
            1.0 - exploit_likelihood
        )  # Higher likelihood = faster exploitation

        adjusted_time = base_time * risk_adjustment * likelihood_adjustment

        # Add some bounds
        adjusted_time = max(1, min(365, adjusted_time))  # Between 1 day and 1 year

        return timedelta(days=int(adjusted_time))

    def _determine_risk_trajectory(
        self,
        vulnerability: Vulnerability,
        threat_intel: Optional[ThreatIntelligence],
        exploit_likelihood: float,
    ) -> str:
        """Determine risk trajectory over time."""
        if threat_intel:
            return threat_intel.exploitation_trend

        # Simple heuristic based on exploit likelihood
        if exploit_likelihood > 0.7:
            return "increasing"
        elif exploit_likelihood < 0.3:
            return "decreasing"
        else:
            return "stable"

    def _calculate_prediction_confidence(
        self,
        vulnerability: Vulnerability,
        asset_context: AssetContext,
        threat_intel: Optional[ThreatIntelligence],
    ) -> float:
        """Calculate confidence in prediction."""
        confidence = 0.5  # Base confidence

        # Increase confidence with more data
        if hasattr(vulnerability, "cvss_score") and vulnerability.cvss_score:
            confidence += 0.1

        if threat_intel:
            confidence += 0.1
            if threat_intel.github_exploits > 0:
                confidence += 0.1

        if hasattr(vulnerability, "references") and vulnerability.references:
            confidence += 0.05

        if asset_context.compliance_frameworks:
            confidence += 0.05

        return min(1.0, confidence)

    def _calculate_data_quality(
        self,
        vulnerability: Vulnerability,
        asset_context: AssetContext,
        threat_intel: Optional[ThreatIntelligence],
    ) -> float:
        """Calculate quality of input data."""
        quality = 0.3  # Base quality

        # Vulnerability data quality
        if hasattr(vulnerability, "cvss_score"):
            quality += 0.1
        if hasattr(vulnerability, "cve_id") and vulnerability.cve_id:
            quality += 0.1
        if hasattr(vulnerability, "description") and vulnerability.description:
            quality += 0.1

        # Asset data quality
        if asset_context.user_base_size > 0:
            quality += 0.1
        if asset_context.business_function:
            quality += 0.1

        # Threat intel quality
        if threat_intel and threat_intel.threat_actors:
            quality += 0.1

        return min(1.0, quality)

    def _analyze_risk_factors(
        self,
        vulnerability: Vulnerability,
        cvss_metrics: CVSSMetrics,
        exploitability_analysis: ExploitabilityAnalysis,
        asset_context: AssetContext,
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        """Analyze risk factors and mitigation factors."""
        risk_factors = {}
        mitigation_factors = {}

        # Risk factors
        risk_factors["cvss_severity"] = getattr(vulnerability, "cvss_score", 5.0) / 10.0
        risk_factors["exploitability"] = (
            exploitability_analysis.exploitability_score / 10.0
        )
        risk_factors["asset_criticality"] = {
            AssetCriticality.CRITICAL: 1.0,
            AssetCriticality.HIGH: 0.8,
            AssetCriticality.MEDIUM: 0.6,
            AssetCriticality.LOW: 0.4,
        }[asset_context.criticality]
        risk_factors["internet_exposure"] = (
            1.0 if asset_context.internet_facing else 0.3
        )
        risk_factors["data_sensitivity"] = {
            DataSensitivity.HIGHLY_SENSITIVE: 1.0,
            DataSensitivity.SENSITIVE: 0.8,
            DataSensitivity.INTERNAL: 0.6,
            DataSensitivity.PUBLIC: 0.3,
        }[asset_context.data_sensitivity]

        # Mitigation factors
        mitigation_factors["authentication_controls"] = min(
            1.0, len(asset_context.authentication_mechanisms) * 0.3
        )
        mitigation_factors["encryption_level"] = {
            "none": 0.0,
            "basic": 0.3,
            "strong": 0.7,
            "military": 1.0,
        }.get(asset_context.encryption_level.lower(), 0.3)
        mitigation_factors["monitoring_level"] = {
            "none": 0.0,
            "basic": 0.3,
            "advanced": 0.7,
            "comprehensive": 1.0,
        }.get(asset_context.monitoring_level.lower(), 0.3)
        mitigation_factors["backup_frequency"] = {
            "none": 0.0,
            "weekly": 0.3,
            "daily": 0.6,
            "hourly": 0.8,
            "realtime": 1.0,
        }.get(asset_context.backup_frequency.lower(), 0.6)

        return risk_factors, mitigation_factors

    def _generate_recommendations(
        self,
        predicted_score: float,
        risk_tier: str,
        vulnerability: Vulnerability,
        asset_context: AssetContext,
    ) -> List[str]:
        """Generate remediation recommendations."""
        recommendations = []

        if risk_tier == "Critical":
            recommendations.extend(
                [
                    "Immediate remediation required - patch within 24 hours",
                    "Consider taking affected systems offline until patched",
                    "Implement compensating controls immediately",
                    "Escalate to senior management and security team",
                ]
            )
        elif risk_tier == "High":
            recommendations.extend(
                [
                    "Patch within 7 days",
                    "Implement additional monitoring and logging",
                    "Review access controls and authentication mechanisms",
                    "Prepare incident response procedures",
                ]
            )
        elif risk_tier == "Medium":
            recommendations.extend(
                [
                    "Patch within 30 days",
                    "Review and update security controls",
                    "Monitor for exploitation attempts",
                    "Consider temporary workarounds if patch not available",
                ]
            )
        else:  # Low
            recommendations.extend(
                [
                    "Include in regular patching cycle",
                    "Document risk acceptance if deferring remediation",
                    "Monitor for changes in exploit availability",
                ]
            )

        # Asset-specific recommendations
        if asset_context.internet_facing:
            recommendations.append(
                "Implement additional network segmentation and filtering"
            )

        if asset_context.handles_pii or asset_context.handles_financial_data:
            recommendations.append(
                "Review compliance requirements and notify relevant stakeholders"
            )

        if len(asset_context.compliance_frameworks) > 0:
            recommendations.append(
                "Update compliance documentation and risk assessments"
            )

        return recommendations

    def _calculate_remediation_priority(
        self,
        predicted_score: float,
        exploit_likelihood: float,
        asset_context: AssetContext,
    ) -> int:
        """Calculate remediation priority (1=highest priority)."""
        base_priority = 1  # Start with highest priority

        # Adjust based on risk score (higher score = higher priority = lower number)
        if predicted_score >= 8.0:
            priority = 1
        elif predicted_score >= 6.0:
            priority = 2
        elif predicted_score >= 4.0:
            priority = 3
        else:
            priority = 4

        # Adjust based on asset criticality
        if asset_context.criticality == AssetCriticality.CRITICAL:
            priority = min(1, priority - 1)
        elif asset_context.criticality == AssetCriticality.LOW:
            priority += 1

        # Adjust based on exploit likelihood
        if exploit_likelihood > 0.7:
            priority = min(1, priority - 1)
        elif exploit_likelihood < 0.3:
            priority += 1

        return max(1, min(10, priority))

    def get_model_performance(self) -> Dict[str, Any]:
        """Get model performance metrics."""
        return {
            "is_trained": self.is_trained,
            "training_metrics": self.training_metrics,
            "feature_count": len(self.feature_names) if self.feature_names else 0,
            "has_risk_model": self.risk_model is not None,
            "has_exploit_model": self.exploit_model is not None,
            "has_anomaly_detector": self.anomaly_detector is not None,
        }

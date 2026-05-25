"""
Feature Engineering Module.

Advanced feature extraction, engineering, and preprocessing for ML models
in dependency management and risk prediction.
"""

import logging
import re
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class FeatureSet:
    """Container for feature data."""
    features: np.ndarray
    feature_names: list[str]
    metadata: dict[str, Any]
    created_at: datetime


class BaseFeatureExtractor(ABC):
    """Base class for feature extractors."""

    def __init__(self, name: str):
        self.name = name
        self.feature_names = []
        self.is_fitted = False

    @abstractmethod
    def fit(self, data: Any) -> 'BaseFeatureExtractor':
        """Fit the feature extractor to data."""
        pass

    @abstractmethod
    def transform(self, data: Any) -> np.ndarray:
        """Transform data into features."""
        pass

    def fit_transform(self, data: Any) -> np.ndarray:
        """Fit and transform data."""
        return self.fit(data).transform(data)


class PackageFeatureExtractor(BaseFeatureExtractor):
    """Extract features from package metadata."""

    def __init__(self):
        super().__init__("package_features")
        self.ecosystem_encodings = {}
        self.version_patterns = {}

    def fit(self, packages: list[dict[str, Any]]) -> 'PackageFeatureExtractor':
        """Fit the extractor to package data."""
        try:
            logger.info(f"Fitting package feature extractor with {len(packages)} packages")

            # Extract ecosystem encodings
            ecosystems = [pkg.get('ecosystem', 'unknown') for pkg in packages]
            unique_ecosystems = list(set(ecosystems))
            self.ecosystem_encodings = {ecosystem: i for i, ecosystem in enumerate(unique_ecosystems)}

            # Extract version patterns
            versions = [pkg.get('version', '0.0.0') for pkg in packages]
            self.version_patterns = self._analyze_version_patterns(versions)

            # Define feature names
            self.feature_names = [
                'ecosystem_encoded',
                'version_major',
                'version_minor',
                'version_patch',
                'version_length',
                'has_prerelease',
                'has_build_metadata',
                'package_name_length',
                'package_name_entropy',
                'has_hyphens',
                'has_underscores',
                'has_numbers',
                'download_count_log',
                'star_count_log',
                'fork_count_log',
                'issue_count_log',
                'release_count_log',
                'days_since_last_release',
                'days_since_first_release',
                'release_frequency',
                'maintainer_count',
                'dependency_count',
                'dependent_count',
                'license_risk_score',
                'security_score',
                'popularity_score'
            ]

            self.is_fitted = True
            logger.info(f"Package feature extractor fitted with {len(self.feature_names)} features")
            return self

        except Exception as e:
            logger.error(f"Failed to fit package feature extractor: {e}", exc_info=True)
            raise

    def transform(self, packages: list[dict[str, Any]]) -> np.ndarray:
        """Transform packages into feature vectors."""
        try:
            if not self.is_fitted:
                raise ValueError("Feature extractor must be fitted before transform")

            features = []
            for pkg in packages:
                feature_vector = self._extract_package_features(pkg)
                features.append(feature_vector)

            return np.array(features)

        except Exception as e:
            logger.error(f"Failed to transform package features: {e}", exc_info=True)
            raise

    def _extract_package_features(self, pkg: dict[str, Any]) -> list[float]:
        """Extract features from a single package."""
        features = []

        # Ecosystem encoding
        ecosystem = pkg.get('ecosystem', 'unknown')
        features.append(self.ecosystem_encodings.get(ecosystem, 0))

        # Version features
        version = pkg.get('version', '0.0.0')
        version_parts = self._parse_version(version)
        features.extend([
            version_parts['major'],
            version_parts['minor'],
            version_parts['patch'],
            len(version),
            float('-' in version or 'alpha' in version or 'beta' in version or 'rc' in version),
            float('+' in version)
        ])

        # Package name features
        name = pkg.get('name', '')
        features.extend([
            len(name),
            self._calculate_entropy(name),
            float('-' in name),
            float('_' in name),
            float(any(c.isdigit() for c in name))
        ])

        # Usage statistics (log-transformed)
        features.extend([
            np.log1p(pkg.get('download_count', 0)),
            np.log1p(pkg.get('star_count', 0)),
            np.log1p(pkg.get('fork_count', 0)),
            np.log1p(pkg.get('issue_count', 0)),
            np.log1p(pkg.get('release_count', 0))
        ])

        # Time-based features
        last_release = pkg.get('last_release_date')
        first_release = pkg.get('first_release_date')
        now = datetime.utcnow()

        days_since_last = (now - last_release).days if last_release else 365
        days_since_first = (now - first_release).days if first_release else 365
        release_freq = pkg.get('release_count', 1) / max(days_since_first / 365, 1)

        features.extend([
            days_since_last,
            days_since_first,
            release_freq
        ])

        # Social features
        features.extend([
            pkg.get('maintainer_count', 1),
            pkg.get('dependency_count', 0),
            pkg.get('dependent_count', 0)
        ])

        # Risk and quality scores
        features.extend([
            self._calculate_license_risk(pkg.get('license', '')),
            self._calculate_security_score(pkg),
            self._calculate_popularity_score(pkg)
        ])

        return features

    def _parse_version(self, version: str) -> dict[str, int]:
        """Parse version string into components."""
        # Simple version parsing
        parts = re.findall(r'\d+', version)
        return {
            'major': int(parts[0]) if len(parts) > 0 else 0,
            'minor': int(parts[1]) if len(parts) > 1 else 0,
            'patch': int(parts[2]) if len(parts) > 2 else 0
        }

    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of text."""
        if not text:
            return 0.0

        counts = Counter(text.lower())
        total = len(text)
        entropy = -sum((count / total) * np.log2(count / total) for count in counts.values())
        return entropy

    def _analyze_version_patterns(self, versions: list[str]) -> dict[str, Any]:
        """Analyze version patterns in the dataset."""
        patterns = {
            'semantic_versions': 0,
            'date_versions': 0,
            'simple_versions': 0,
            'complex_versions': 0
        }

        for version in versions:
            if re.match(r'^\d+\.\d+\.\d+', version):
                patterns['semantic_versions'] += 1
            elif re.match(r'^\d{4}\.\d{2}\.\d{2}', version):
                patterns['date_versions'] += 1
            elif re.match(r'^\d+\.\d+$', version):
                patterns['simple_versions'] += 1
            else:
                patterns['complex_versions'] += 1

        return patterns

    def _calculate_license_risk(self, license: str) -> float:
        """Calculate license risk score."""
        high_risk_licenses = ['GPL-3.0', 'AGPL-3.0', 'LGPL-3.0']
        medium_risk_licenses = ['GPL-2.0', 'LGPL-2.1', 'MPL-2.0']
        low_risk_licenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC']

        if license in high_risk_licenses:
            return 0.8
        elif license in medium_risk_licenses:
            return 0.5
        elif license in low_risk_licenses:
            return 0.1
        else:
            return 0.3  # Unknown license

    def _calculate_security_score(self, pkg: dict[str, Any]) -> float:
        """Calculate security score based on various factors."""
        score = 1.0

        # Reduce score for known vulnerabilities
        vuln_count = pkg.get('vulnerability_count', 0)
        score -= min(vuln_count * 0.1, 0.5)

        # Reduce score for outdated packages
        days_since_last = pkg.get('days_since_last_release', 0)
        if days_since_last > 365:
            score -= 0.3
        elif days_since_last > 180:
            score -= 0.1

        # Reduce score for unmaintained packages
        if pkg.get('maintainer_count', 0) == 0:
            score -= 0.4

        return max(score, 0.0)

    def _calculate_popularity_score(self, pkg: dict[str, Any]) -> float:
        """Calculate popularity score."""
        downloads = pkg.get('download_count', 0)
        stars = pkg.get('star_count', 0)
        dependents = pkg.get('dependent_count', 0)

        # Normalize and combine metrics
        download_score = min(np.log1p(downloads) / 10, 1.0)
        star_score = min(np.log1p(stars) / 8, 1.0)
        dependent_score = min(np.log1p(dependents) / 6, 1.0)

        return (download_score * 0.5 + star_score * 0.3 + dependent_score * 0.2)


class VulnerabilityFeatureExtractor(BaseFeatureExtractor):
    """Extract features from vulnerability data."""

    def __init__(self):
        super().__init__("vulnerability_features")
        self.severity_encodings = {}
        self.cwe_encodings = {}

    def fit(self, vulnerabilities: list[dict[str, Any]]) -> 'VulnerabilityFeatureExtractor':
        """Fit the extractor to vulnerability data."""
        try:
            logger.info(f"Fitting vulnerability feature extractor with {len(vulnerabilities)} vulnerabilities")

            # Extract severity encodings
            severities = [vuln.get('severity', 'UNKNOWN') for vuln in vulnerabilities]
            unique_severities = list(set(severities))
            self.severity_encodings = {severity: i for i, severity in enumerate(unique_severities)}

            # Extract CWE encodings
            cwes = [vuln.get('cwe_id', 'UNKNOWN') for vuln in vulnerabilities]
            unique_cwes = list(set(cwes))
            self.cwe_encodings = {cwe: i for i, cwe in enumerate(unique_cwes)}

            # Define feature names
            self.feature_names = [
                'severity_encoded',
                'cwe_encoded',
                'cvss_score',
                'cvss_vector_length',
                'has_cve_id',
                'has_cwe_id',
                'description_length',
                'description_entropy',
                'days_since_published',
                'days_since_updated',
                'reference_count',
                'exploit_count',
                'patch_count',
                'affected_package_count',
                'affected_version_count',
                'has_exploit_available',
                'has_patch_available',
                'is_publicly_disclosed',
                'is_zero_day',
                'complexity_score'
            ]

            self.is_fitted = True
            logger.info(f"Vulnerability feature extractor fitted with {len(self.feature_names)} features")
            return self

        except Exception as e:
            logger.error(f"Failed to fit vulnerability feature extractor: {e}", exc_info=True)
            raise

    def transform(self, vulnerabilities: list[dict[str, Any]]) -> np.ndarray:
        """Transform vulnerabilities into feature vectors."""
        try:
            if not self.is_fitted:
                raise ValueError("Feature extractor must be fitted before transform")

            features = []
            for vuln in vulnerabilities:
                feature_vector = self._extract_vulnerability_features(vuln)
                features.append(feature_vector)

            return np.array(features)

        except Exception as e:
            logger.error(f"Failed to transform vulnerability features: {e}", exc_info=True)
            raise

    def _extract_vulnerability_features(self, vuln: dict[str, Any]) -> list[float]:
        """Extract features from a single vulnerability."""
        features = []

        # Severity encoding
        severity = vuln.get('severity', 'UNKNOWN')
        features.append(self.severity_encodings.get(severity, 0))

        # CWE encoding
        cwe = vuln.get('cwe_id', 'UNKNOWN')
        features.append(self.cwe_encodings.get(cwe, 0))

        # CVSS features
        cvss_score = vuln.get('cvss_score', 0.0)
        cvss_vector = vuln.get('cvss_vector', '')
        features.extend([
            cvss_score,
            len(cvss_vector)
        ])

        # ID features
        features.extend([
            float('CVE-' in vuln.get('id', '')),
            float('CWE-' in vuln.get('cwe_id', ''))
        ])

        # Description features
        description = vuln.get('description', '')
        features.extend([
            len(description),
            self._calculate_entropy(description)
        ])

        # Time features
        published = vuln.get('published_date')
        updated = vuln.get('updated_date')
        now = datetime.utcnow()

        days_since_published = (now - published).days if published else 0
        days_since_updated = (now - updated).days if updated else 0

        features.extend([
            days_since_published,
            days_since_updated
        ])

        # Reference and exploit features
        features.extend([
            len(vuln.get('references', [])),
            vuln.get('exploit_count', 0),
            len(vuln.get('patches', [])),
            len(vuln.get('affected_packages', [])),
            sum(len(pkg.get('versions', [])) for pkg in vuln.get('affected_packages', []))
        ])

        # Boolean features
        features.extend([
            float(vuln.get('has_exploit_available', False)),
            float(vuln.get('has_patch_available', False)),
            float(vuln.get('is_publicly_disclosed', False)),
            float(vuln.get('is_zero_day', False))
        ])

        # Complexity score
        complexity = self._calculate_complexity_score(vuln)
        features.append(complexity)

        return features

    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of text."""
        if not text:
            return 0.0

        counts = Counter(text.lower())
        total = len(text)
        entropy = -sum((count / total) * np.log2(count / total) for count in counts.values())
        return entropy

    def _calculate_complexity_score(self, vuln: dict[str, Any]) -> float:
        """Calculate complexity score for vulnerability."""
        score = 0.0

        # Base complexity from CVSS
        cvss_score = vuln.get('cvss_score', 0.0)
        score += cvss_score * 0.3

        # Complexity from affected packages
        affected_packages = len(vuln.get('affected_packages', []))
        score += min(affected_packages * 0.1, 0.3)

        # Complexity from exploit availability
        if vuln.get('has_exploit_available', False):
            score += 0.2

        # Complexity from zero-day status
        if vuln.get('is_zero_day', False):
            score += 0.3

        return min(score, 1.0)


class TrendFeatureExtractor(BaseFeatureExtractor):
    """Extract features from time series trend data."""

    def __init__(self, window_size: int = 30):
        super().__init__("trend_features")
        self.window_size = window_size
        self.trend_indicators = {}

    def fit(self, time_series_data: list[dict[str, Any]]) -> 'TrendFeatureExtractor':
        """Fit the extractor to time series data."""
        try:
            logger.info(f"Fitting trend feature extractor with {len(time_series_data)} data points")

            # Define feature names
            self.feature_names = [
                'downloads_trend',
                'downloads_volatility',
                'downloads_momentum',
                'downloads_acceleration',
                'stars_trend',
                'stars_volatility',
                'stars_momentum',
                'stars_acceleration',
                'issues_trend',
                'issues_volatility',
                'issues_momentum',
                'issues_acceleration',
                'releases_trend',
                'releases_volatility',
                'releases_momentum',
                'releases_acceleration',
                'overall_trend_strength',
                'trend_consistency',
                'seasonality_score',
                'cyclical_pattern_score',
                'growth_rate',
                'volatility_index',
                'momentum_index',
                'acceleration_index'
            ]

            self.is_fitted = True
            logger.info(f"Trend feature extractor fitted with {len(self.feature_names)} features")
            return self

        except Exception as e:
            logger.error(f"Failed to fit trend feature extractor: {e}", exc_info=True)
            raise

    def transform(self, time_series_data: list[dict[str, Any]]) -> np.ndarray:
        """Transform time series data into feature vectors."""
        try:
            if not self.is_fitted:
                raise ValueError("Feature extractor must be fitted before transform")

            # Sort data by date
            sorted_data = sorted(time_series_data, key=lambda x: x.get('date', datetime.min))

            features = []
            for i in range(len(sorted_data)):
                feature_vector = self._extract_trend_features(sorted_data, i)
                features.append(feature_vector)

            return np.array(features)

        except Exception as e:
            logger.error(f"Failed to transform trend features: {e}", exc_info=True)
            raise

    def _extract_trend_features(self, data: list[dict[str, Any]], index: int) -> list[float]:
        """Extract trend features for a specific time point."""
        features = []

        # Get window of data
        start_idx = max(0, index - self.window_size + 1)
        window_data = data[start_idx:index + 1]

        if len(window_data) < 2:
            # Return zero features if insufficient data
            return [0.0] * len(self.feature_names)

        # Extract metrics
        metrics = ['downloads', 'stars', 'issues', 'releases']

        for metric in metrics:
            values = [point.get(metric, 0) for point in window_data]

            # Trend (slope)
            trend = self._calculate_trend(values)
            features.append(trend)

            # Volatility (standard deviation)
            volatility = np.std(values) if len(values) > 1 else 0.0
            features.append(volatility)

            # Momentum (recent change)
            momentum = (values[-1] - values[0]) / max(values[0], 1) if values[0] > 0 else 0.0
            features.append(momentum)

            # Acceleration (change in trend)
            if len(values) >= 3:
                first_half = values[:len(values)//2]
                second_half = values[len(values)//2:]
                first_trend = self._calculate_trend(first_half)
                second_trend = self._calculate_trend(second_half)
                acceleration = second_trend - first_trend
            else:
                acceleration = 0.0
            features.append(acceleration)

        # Overall trend features
        all_values = [point.get('downloads', 0) for point in window_data]
        features.extend([
            self._calculate_trend_strength(all_values),
            self._calculate_trend_consistency(all_values),
            self._calculate_seasonality_score(all_values),
            self._calculate_cyclical_pattern_score(all_values),
            self._calculate_growth_rate(all_values),
            self._calculate_volatility_index(all_values),
            self._calculate_momentum_index(all_values),
            self._calculate_acceleration_index(all_values)
        ])

        return features

    def _calculate_trend(self, values: list[float]) -> float:
        """Calculate linear trend (slope) of values."""
        if len(values) < 2:
            return 0.0

        x = np.arange(len(values))
        y = np.array(values)

        # Calculate slope using least squares
        slope = np.polyfit(x, y, 1)[0]
        return slope

    def _calculate_trend_strength(self, values: list[float]) -> float:
        """Calculate strength of trend."""
        if len(values) < 2:
            return 0.0

        trend = self._calculate_trend(values)
        volatility = np.std(values)

        if volatility == 0:
            return 0.0

        return abs(trend) / volatility

    def _calculate_trend_consistency(self, values: list[float]) -> float:
        """Calculate consistency of trend direction."""
        if len(values) < 3:
            return 0.0

        # Calculate rolling trends
        window_size = min(7, len(values) - 1)
        trends = []

        for i in range(len(values) - window_size):
            window = values[i:i + window_size + 1]
            trend = self._calculate_trend(window)
            trends.append(trend)

        if not trends:
            return 0.0

        # Calculate consistency (how often trend direction is the same)
        positive_trends = sum(1 for t in trends if t > 0)
        negative_trends = sum(1 for t in trends if t < 0)

        total_trends = len(trends)
        consistency = max(positive_trends, negative_trends) / total_trends

        return consistency

    def _calculate_seasonality_score(self, values: list[float]) -> float:
        """Calculate seasonality score."""
        if len(values) < 12:  # Need at least 12 data points
            return 0.0

        # Simple seasonality detection using autocorrelation
        # This is a simplified version
        return 0.0  # Placeholder for complex seasonality calculation

    def _calculate_cyclical_pattern_score(self, values: list[float]) -> float:
        """Calculate cyclical pattern score."""
        if len(values) < 6:
            return 0.0

        # Simple cyclical pattern detection
        # This is a simplified version
        return 0.0  # Placeholder for complex cyclical analysis

    def _calculate_growth_rate(self, values: list[float]) -> float:
        """Calculate growth rate."""
        if len(values) < 2 or values[0] == 0:
            return 0.0

        return (values[-1] - values[0]) / values[0]

    def _calculate_volatility_index(self, values: list[float]) -> float:
        """Calculate volatility index."""
        if len(values) < 2:
            return 0.0

        mean_val = np.mean(values)
        if mean_val == 0:
            return 0.0

        volatility = np.std(values)
        return volatility / mean_val

    def _calculate_momentum_index(self, values: list[float]) -> float:
        """Calculate momentum index."""
        if len(values) < 2:
            return 0.0

        recent_change = values[-1] - values[-2] if len(values) >= 2 else 0
        return recent_change

    def _calculate_acceleration_index(self, values: list[float]) -> float:
        """Calculate acceleration index."""
        if len(values) < 3:
            return 0.0

        recent_change = values[-1] - values[-2]
        previous_change = values[-2] - values[-3]

        return recent_change - previous_change


class FeatureEngineering:
    """Advanced feature engineering pipeline."""

    def __init__(self):
        self.extractors = {}
        self.feature_sets = {}
        self.is_fitted = False

    def add_extractor(self, name: str, extractor: BaseFeatureExtractor):
        """Add a feature extractor to the pipeline."""
        self.extractors[name] = extractor

    def fit(self, data: dict[str, Any]) -> 'FeatureEngineering':
        """Fit all feature extractors."""
        try:
            logger.info("Fitting feature engineering pipeline")

            for name, extractor in self.extractors.items():
                if name in data:
                    extractor.fit(data[name])
                    logger.info(f"Fitted extractor: {name}")

            self.is_fitted = True
            logger.info("Feature engineering pipeline fitted successfully")
            return self

        except Exception as e:
            logger.error(f"Failed to fit feature engineering pipeline: {e}", exc_info=True)
            raise

    def transform(self, data: dict[str, Any]) -> dict[str, FeatureSet]:
        """Transform data using all fitted extractors."""
        try:
            if not self.is_fitted:
                raise ValueError("Feature engineering pipeline must be fitted before transform")

            feature_sets = {}

            for name, extractor in self.extractors.items():
                if name in data and extractor.is_fitted:
                    features = extractor.transform(data[name])

                    feature_set = FeatureSet(
                        features=features,
                        feature_names=extractor.feature_names,
                        metadata={
                            "extractor_name": name,
                            "feature_count": len(extractor.feature_names),
                            "sample_count": len(features)
                        },
                        created_at=datetime.utcnow()
                    )

                    feature_sets[name] = feature_set
                    logger.info(f"Transformed features for {name}: {features.shape}")

            return feature_sets

        except Exception as e:
            logger.error(f"Failed to transform features: {e}", exc_info=True)
            raise

    def get_combined_features(self, feature_sets: dict[str, FeatureSet]) -> FeatureSet:
        """Combine multiple feature sets into one."""
        try:
            if not feature_sets:
                raise ValueError("No feature sets provided")

            combined_features = []
            combined_names = []
            metadata = {}

            for name, feature_set in feature_sets.items():
                combined_features.append(feature_set.features)
                combined_names.extend([f"{name}_{fn}" for fn in feature_set.feature_names])
                metadata[name] = feature_set.metadata

            # Concatenate features
            combined_array = np.concatenate(combined_features, axis=1)

            return FeatureSet(
                features=combined_array,
                feature_names=combined_names,
                metadata={
                    "combined_from": list(feature_sets.keys()),
                    "total_features": len(combined_names),
                    "sample_count": len(combined_array),
                    "extractors_metadata": metadata
                },
                created_at=datetime.utcnow()
            )

        except Exception as e:
            logger.error(f"Failed to combine features: {e}", exc_info=True)
            raise


class DataPreprocessor:
    """Advanced data preprocessing pipeline."""

    def __init__(self):
        self.scalers = {}
        self.encoders = {}
        self.is_fitted = False

    def fit(self, X: np.ndarray, feature_names: list[str]) -> 'DataPreprocessor':
        """Fit preprocessing transformations."""
        try:
            logger.info(f"Fitting data preprocessor with {X.shape[0]} samples, {X.shape[1]} features")

            # Simple preprocessing - in production would use sklearn transformers
            self.feature_names = feature_names
            self.feature_means = np.mean(X, axis=0)
            self.feature_stds = np.std(X, axis=0)
            self.feature_mins = np.min(X, axis=0)
            self.feature_maxs = np.max(X, axis=0)

            # Handle zero standard deviation
            self.feature_stds = np.where(self.feature_stds == 0, 1, self.feature_stds)

            self.is_fitted = True
            logger.info("Data preprocessor fitted successfully")
            return self

        except Exception as e:
            logger.error(f"Failed to fit data preprocessor: {e}", exc_info=True)
            raise

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transform data using fitted preprocessing."""
        try:
            if not self.is_fitted:
                raise ValueError("Data preprocessor must be fitted before transform")

            # Z-score normalization
            X_normalized = (X - self.feature_means) / self.feature_stds

            # Clip outliers (3 standard deviations)
            X_clipped = np.clip(X_normalized, -3, 3)

            logger.info(f"Transformed data shape: {X_clipped.shape}")
            return X_clipped

        except Exception as e:
            logger.error(f"Failed to transform data: {e}", exc_info=True)
            raise

    def inverse_transform(self, X: np.ndarray) -> np.ndarray:
        """Inverse transform normalized data."""
        try:
            if not self.is_fitted:
                raise ValueError("Data preprocessor must be fitted before inverse transform")

            # Reverse normalization
            X_original = X * self.feature_stds + self.feature_means

            return X_original

        except Exception as e:
            logger.error(f"Failed to inverse transform data: {e}", exc_info=True)
            raise


class FeatureSelector:
    """Advanced feature selection using various methods."""

    def __init__(self, method: str = "correlation"):
        self.method = method
        self.selected_features = []
        self.feature_scores = {}
        self.is_fitted = False

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: list[str],
            max_features: int = 50) -> 'FeatureSelector':
        """Fit feature selector."""
        try:
            logger.info(f"Fitting feature selector with method: {self.method}")

            self.feature_names = feature_names

            if self.method == "correlation":
                self._correlation_selection(X, y, max_features)
            elif self.method == "variance":
                self._variance_selection(X, max_features)
            elif self.method == "mutual_info":
                self._mutual_info_selection(X, y, max_features)
            else:
                # Default: select all features
                self.selected_features = list(range(len(feature_names)))
                self.feature_scores = {name: 1.0 for name in feature_names}

            self.is_fitted = True
            logger.info(f"Feature selector fitted. Selected {len(self.selected_features)} features")
            return self

        except Exception as e:
            logger.error(f"Failed to fit feature selector: {e}", exc_info=True)
            raise

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transform data using selected features."""
        try:
            if not self.is_fitted:
                raise ValueError("Feature selector must be fitted before transform")

            return X[:, self.selected_features]

        except Exception as e:
            logger.error(f"Failed to transform features: {e}", exc_info=True)
            raise

    def _correlation_selection(self, X: np.ndarray, y: np.ndarray, max_features: int):
        """Select features based on correlation with target."""
        try:
            correlations = []
            for i in range(X.shape[1]):
                corr = np.corrcoef(X[:, i], y)[0, 1]
                correlations.append(abs(corr) if not np.isnan(corr) else 0)

            # Select top features
            feature_indices = np.argsort(correlations)[::-1][:max_features]
            self.selected_features = feature_indices.tolist()

            # Store scores
            for i, idx in enumerate(feature_indices):
                self.feature_scores[self.feature_names[idx]] = correlations[idx]

        except Exception as e:
            logger.error(f"Failed correlation selection: {e}")
            # Fallback to all features
            self.selected_features = list(range(len(self.feature_names)))
            self.feature_scores = {name: 1.0 for name in self.feature_names}

    def _variance_selection(self, X: np.ndarray, max_features: int):
        """Select features based on variance."""
        try:
            variances = np.var(X, axis=0)
            feature_indices = np.argsort(variances)[::-1][:max_features]
            self.selected_features = feature_indices.tolist()

            for i, idx in enumerate(feature_indices):
                self.feature_scores[self.feature_names[idx]] = variances[idx]

        except Exception as e:
            logger.error(f"Failed variance selection: {e}")
            self.selected_features = list(range(len(self.feature_names)))
            self.feature_scores = {name: 1.0 for name in self.feature_names}

    def _mutual_info_selection(self, X: np.ndarray, y: np.ndarray, max_features: int):
        """Select features based on mutual information."""
        try:
            # Simplified mutual information calculation
            mutual_info_scores = []
            for i in range(X.shape[1]):
                # Simple approximation of mutual information
                score = np.corrcoef(X[:, i], y)[0, 1]
                mutual_info_scores.append(abs(score) if not np.isnan(score) else 0)

            feature_indices = np.argsort(mutual_info_scores)[::-1][:max_features]
            self.selected_features = feature_indices.tolist()

            for i, idx in enumerate(feature_indices):
                self.feature_scores[self.feature_names[idx]] = mutual_info_scores[idx]

        except Exception as e:
            logger.error(f"Failed mutual info selection: {e}")
            self.selected_features = list(range(len(self.feature_names)))
            self.feature_scores = {name: 1.0 for name in self.feature_names}

    def get_selected_feature_names(self) -> list[str]:
        """Get names of selected features."""
        return [self.feature_names[i] for i in self.selected_features]

    def get_feature_scores(self) -> dict[str, float]:
        """Get feature selection scores."""
        return self.feature_scores

"""
Machine Learning Module.

Advanced ML models for dependency risk prediction, trend analysis,
and intelligent insights generation.
"""

from .features import (
    DataPreprocessor,
    FeatureEngineering,
    FeatureSelector,
    PackageFeatureExtractor,
    TrendFeatureExtractor,
    VulnerabilityFeatureExtractor,
)
from .models import (
    AnomalyDetector,
    DependencyRecommender,
    ModelManager,
    RiskPredictionModel,
    TrendAnalysisModel,
    VulnerabilityClassifier,
)
from .training import (
    CrossValidator,
    HyperparameterOptimizer,
    ModelEvaluator,
    ModelTrainer,
)

__all__ = [
    "RiskPredictionModel",
    "TrendAnalysisModel",
    "VulnerabilityClassifier",
    "DependencyRecommender",
    "AnomalyDetector",
    "ModelManager",
    "PackageFeatureExtractor",
    "VulnerabilityFeatureExtractor",
    "TrendFeatureExtractor",
    "FeatureEngineering",
    "DataPreprocessor",
    "FeatureSelector",
    "ModelTrainer",
    "HyperparameterOptimizer",
    "CrossValidator",
    "ModelEvaluator"
]

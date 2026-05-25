"""
Unit tests for ML models.

Tests for RiskPredictionModel, TrendAnalysisModel, VulnerabilityClassifier,
DependencyRecommender, AnomalyDetector, and ModelManager.
"""

import pytest
import numpy as np
from datetime import datetime
from unittest.mock import Mock, patch

from udp.ml.models import (
    RiskPredictionModel, TrendAnalysisModel, VulnerabilityClassifier,
    DependencyRecommender, AnomalyDetector, ModelManager,
    ModelMetrics, PredictionResult
)
from udp.ml.features import (
    PackageFeatureExtractor, VulnerabilityFeatureExtractor,
    TrendFeatureExtractor, FeatureEngineering, DataPreprocessor
)
from udp.ml.training import (
    ModelTrainer, TrainingConfig, HyperparameterOptimizer,
    CrossValidator, ModelEvaluator
)


class TestRiskPredictionModel:
    """Test RiskPredictionModel."""
    
    def test_model_initialization(self):
        """Test model initialization."""
        model = RiskPredictionModel()
        
        assert model.model_name == "risk_prediction"
        assert model.version == "2.0.0"
        assert model.is_trained is False
        assert model.metrics is None
        assert model.feature_names == []
        assert model.training_data_size == 0
        assert model.last_trained is None
    
    def test_model_training(self):
        """Test model training."""
        model = RiskPredictionModel()
        
        # Create sample training data
        X = np.random.random((100, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        
        # Train model
        metrics = model.train(X, y)
        
        assert model.is_trained is True
        assert model.metrics is not None
        assert model.training_data_size == 100
        assert model.last_trained is not None
        assert len(model.feature_names) == 25
        assert isinstance(metrics, ModelMetrics)
        assert metrics.accuracy > 0
        assert metrics.precision > 0
        assert metrics.recall > 0
        assert metrics.f1_score > 0
    
    def test_model_prediction(self):
        """Test model prediction."""
        model = RiskPredictionModel()
        
        # Train model first
        X_train = np.random.random((100, 25))
        y_train = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        model.train(X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 25))
        result = model.predict(X_test)
        
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
        assert result.model_version == "2.0.0"
        assert result.features_importance is not None
        assert len(result.features_importance) == 25
    
    def test_model_prediction_without_training(self):
        """Test model prediction without training."""
        model = RiskPredictionModel()
        X = np.random.random((10, 25))
        
        with pytest.raises(ValueError, match="Model must be trained"):
            model.predict(X)
    
    def test_model_save_load(self, temp_dir):
        """Test model save and load."""
        model = RiskPredictionModel()
        
        # Train model
        X = np.random.random((100, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        model.train(X, y)
        
        # Save model
        filepath = f"{temp_dir}/test_model.json"
        success = model.save_model(filepath)
        assert success is True
        
        # Create new model and load
        new_model = RiskPredictionModel()
        success = new_model.load_model(filepath)
        assert success is True
        assert new_model.is_trained is True
        assert new_model.training_data_size == 100
        assert len(new_model.feature_names) == 25


class TestTrendAnalysisModel:
    """Test TrendAnalysisModel."""
    
    def test_model_initialization(self):
        """Test model initialization."""
        model = TrendAnalysisModel()
        
        assert model.model_name == "trend_analysis"
        assert model.version == "2.0.0"
        assert model.is_trained is False
        assert model.forecast_horizon == 30
    
    def test_model_training(self):
        """Test model training."""
        model = TrendAnalysisModel()
        
        # Create sample training data
        X = np.random.random((100, 24))
        y = np.random.choice(["RISING", "FALLING", "STABLE", "VOLATILE"], 100)
        
        # Train model
        metrics = model.train(X, y)
        
        assert model.is_trained is True
        assert model.metrics is not None
        assert model.training_data_size == 100
        assert isinstance(metrics, ModelMetrics)
        assert metrics.r2_score is not None
    
    def test_model_prediction(self):
        """Test model prediction."""
        model = TrendAnalysisModel()
        
        # Train model first
        X_train = np.random.random((100, 24))
        y_train = np.random.choice(["RISING", "FALLING", "STABLE", "VOLATILE"], 100)
        model.train(X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 24))
        result = model.predict(X_test)
        
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
        assert result.probabilities is not None


class TestVulnerabilityClassifier:
    """Test VulnerabilityClassifier."""
    
    def test_model_initialization(self):
        """Test model initialization."""
        model = VulnerabilityClassifier()
        
        assert model.model_name == "vulnerability_classifier"
        assert model.version == "2.0.0"
        assert model.is_trained is False
        assert "CVE" in model.vulnerability_types
        assert "CWE" in model.vulnerability_types
    
    def test_model_training(self):
        """Test model training."""
        model = VulnerabilityClassifier()
        
        # Create sample training data
        X = np.random.random((100, 20))
        y = np.random.choice(["CVE", "CWE", "CUSTOM", "UNKNOWN"], 100)
        
        # Train model
        metrics = model.train(X, y)
        
        assert model.is_trained is True
        assert model.metrics is not None
        assert model.training_data_size == 100
        assert isinstance(metrics, ModelMetrics)
    
    def test_model_prediction(self):
        """Test model prediction."""
        model = VulnerabilityClassifier()
        
        # Train model first
        X_train = np.random.random((100, 20))
        y_train = np.random.choice(["CVE", "CWE", "CUSTOM", "UNKNOWN"], 100)
        model.train(X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 20))
        result = model.predict(X_test)
        
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
        assert result.probabilities is not None


class TestDependencyRecommender:
    """Test DependencyRecommender."""
    
    def test_model_initialization(self):
        """Test model initialization."""
        model = DependencyRecommender()
        
        assert model.model_name == "dependency_recommender"
        assert model.version == "2.0.0"
        assert model.is_trained is False
        assert "ALTERNATIVE" in model.recommendation_types
        assert "UPGRADE" in model.recommendation_types
    
    def test_model_training(self):
        """Test model training."""
        model = DependencyRecommender()
        
        # Create sample training data
        X = np.random.random((100, 30))
        y = np.random.choice(["ALTERNATIVE", "UPGRADE", "SECURITY_FIX", "PERFORMANCE"], 100)
        
        # Train model
        metrics = model.train(X, y)
        
        assert model.is_trained is True
        assert model.metrics is not None
        assert model.training_data_size == 100
        assert isinstance(metrics, ModelMetrics)
    
    def test_model_prediction(self):
        """Test model prediction."""
        model = DependencyRecommender()
        
        # Train model first
        X_train = np.random.random((100, 30))
        y_train = np.random.choice(["ALTERNATIVE", "UPGRADE", "SECURITY_FIX", "PERFORMANCE"], 100)
        model.train(X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 30))
        result = model.predict(X_test)
        
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
        assert result.probabilities is not None


class TestAnomalyDetector:
    """Test AnomalyDetector."""
    
    def test_model_initialization(self):
        """Test model initialization."""
        model = AnomalyDetector()
        
        assert model.model_name == "anomaly_detector"
        assert model.version == "2.0.0"
        assert model.is_trained is False
        assert "SECURITY" in model.anomaly_types
        assert "PERFORMANCE" in model.anomaly_types
    
    def test_model_training(self):
        """Test model training."""
        model = AnomalyDetector()
        
        # Create sample training data
        X = np.random.random((100, 20))
        y = np.random.choice([True, False], 100, p=[0.05, 0.95])  # 5% anomalies
        
        # Train model
        metrics = model.train(X, y)
        
        assert model.is_trained is True
        assert model.metrics is not None
        assert model.training_data_size == 100
        assert isinstance(metrics, ModelMetrics)
    
    def test_model_prediction(self):
        """Test model prediction."""
        model = AnomalyDetector()
        
        # Train model first
        X_train = np.random.random((100, 20))
        y_train = np.random.choice([True, False], 100, p=[0.05, 0.95])
        model.train(X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 20))
        result = model.predict(X_test)
        
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
        assert result.probabilities is not None


class TestModelManager:
    """Test ModelManager."""
    
    def test_manager_initialization(self):
        """Test model manager initialization."""
        manager = ModelManager()
        
        assert len(manager.models) == 5
        assert "risk_prediction" in manager.models
        assert "trend_analysis" in manager.models
        assert "vulnerability_classifier" in manager.models
        assert "dependency_recommender" in manager.models
        assert "anomaly_detector" in manager.models
    
    def test_get_model(self):
        """Test getting a specific model."""
        manager = ModelManager()
        
        model = manager.get_model("risk_prediction")
        assert model is not None
        assert isinstance(model, RiskPredictionModel)
        
        model = manager.get_model("nonexistent")
        assert model is None
    
    def test_train_model(self):
        """Test training a model through manager."""
        manager = ModelManager()
        
        # Create sample training data
        X = np.random.random((100, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        
        # Train model
        metrics = manager.train_model("risk_prediction", X, y)
        
        assert metrics is not None
        assert isinstance(metrics, ModelMetrics)
        assert metrics.accuracy > 0
    
    def test_predict_with_model(self):
        """Test making predictions through manager."""
        manager = ModelManager()
        
        # Train model first
        X_train = np.random.random((100, 25))
        y_train = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        manager.train_model("risk_prediction", X_train, y_train)
        
        # Make prediction
        X_test = np.random.random((10, 25))
        result = manager.predict("risk_prediction", X_test)
        
        assert result is not None
        assert isinstance(result, PredictionResult)
        assert result.confidence > 0
    
    def test_get_model_info(self):
        """Test getting model information."""
        manager = ModelManager()
        
        info = manager.get_model_info("risk_prediction")
        assert info is not None
        assert info["model_name"] == "risk_prediction"
        assert info["version"] == "2.0.0"
        assert info["is_trained"] is False
        
        info = manager.get_model_info("nonexistent")
        assert info is None
    
    def test_get_all_models_info(self):
        """Test getting all models information."""
        manager = ModelManager()
        
        all_info = manager.get_all_models_info()
        assert len(all_info) == 5
        assert "risk_prediction" in all_info
        assert "trend_analysis" in all_info
        assert "vulnerability_classifier" in all_info
        assert "dependency_recommender" in all_info
        assert "anomaly_detector" in all_info
    
    def test_save_load_all_models(self, temp_dir):
        """Test saving and loading all models."""
        manager = ModelManager()
        
        # Train a model first
        X = np.random.random((100, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        manager.train_model("risk_prediction", X, y)
        
        # Save all models
        results = manager.save_all_models(temp_dir)
        assert len(results) == 5
        assert results["risk_prediction"] is True  # Trained model
        assert results["trend_analysis"] is False  # Untrained model
        
        # Load all models
        new_manager = ModelManager()
        results = new_manager.load_all_models(temp_dir)
        assert len(results) == 5


class TestFeatureExtractors:
    """Test feature extractors."""
    
    def test_package_feature_extractor(self):
        """Test PackageFeatureExtractor."""
        extractor = PackageFeatureExtractor()
        
        # Sample package data
        packages = [
            {
                "name": "requests",
                "version": "2.28.1",
                "ecosystem": "pypi",
                "download_count": 1000000,
                "star_count": 50000,
                "license": "Apache-2.0",
                "maintainer_count": 5,
                "dependency_count": 4,
                "dependent_count": 100000
            }
        ]
        
        # Fit extractor
        extractor.fit(packages)
        assert extractor.is_fitted is True
        assert len(extractor.feature_names) == 25
        
        # Transform data
        features = extractor.transform(packages)
        assert features.shape == (1, 25)
        assert np.all(np.isfinite(features))
    
    def test_vulnerability_feature_extractor(self):
        """Test VulnerabilityFeatureExtractor."""
        extractor = VulnerabilityFeatureExtractor()
        
        # Sample vulnerability data
        vulnerabilities = [
            {
                "id": "CVE-2023-12345",
                "severity": "HIGH",
                "cvss_score": 7.5,
                "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
                "cwe_id": "CWE-79",
                "description": "Test vulnerability",
                "published_date": datetime.utcnow(),
                "updated_date": datetime.utcnow(),
                "references": ["https://example.com"],
                "affected_packages": [{"name": "requests", "versions": ["<2.28.2"]}]
            }
        ]
        
        # Fit extractor
        extractor.fit(vulnerabilities)
        assert extractor.is_fitted is True
        assert len(extractor.feature_names) == 20
        
        # Transform data
        features = extractor.transform(vulnerabilities)
        assert features.shape == (1, 20)
        assert np.all(np.isfinite(features))
    
    def test_trend_feature_extractor(self):
        """Test TrendFeatureExtractor."""
        extractor = TrendFeatureExtractor()
        
        # Sample time series data
        time_series_data = [
            {"date": datetime.utcnow(), "downloads": 1000, "stars": 100, "issues": 10, "releases": 1},
            {"date": datetime.utcnow(), "downloads": 1100, "stars": 110, "issues": 12, "releases": 1},
            {"date": datetime.utcnow(), "downloads": 1200, "stars": 120, "issues": 15, "releases": 2}
        ]
        
        # Fit extractor
        extractor.fit(time_series_data)
        assert extractor.is_fitted is True
        assert len(extractor.feature_names) == 24
        
        # Transform data
        features = extractor.transform(time_series_data)
        assert features.shape == (3, 24)
        assert np.all(np.isfinite(features))


class TestFeatureEngineering:
    """Test FeatureEngineering."""
    
    def test_feature_engineering_pipeline(self):
        """Test feature engineering pipeline."""
        engineering = FeatureEngineering()
        
        # Add extractors
        engineering.add_extractor("packages", PackageFeatureExtractor())
        engineering.add_extractor("vulnerabilities", VulnerabilityFeatureExtractor())
        
        # Sample data
        data = {
            "packages": [
                {
                    "name": "requests",
                    "version": "2.28.1",
                    "ecosystem": "pypi",
                    "download_count": 1000000,
                    "star_count": 50000,
                    "license": "Apache-2.0"
                }
            ],
            "vulnerabilities": [
                {
                    "id": "CVE-2023-12345",
                    "severity": "HIGH",
                    "cvss_score": 7.5,
                    "description": "Test vulnerability"
                }
            ]
        }
        
        # Fit pipeline
        engineering.fit(data)
        assert engineering.is_fitted is True
        
        # Transform data
        feature_sets = engineering.transform(data)
        assert len(feature_sets) == 2
        assert "packages" in feature_sets
        assert "vulnerabilities" in feature_sets
        
        # Combine features
        combined = engineering.get_combined_features(feature_sets)
        assert combined.features.shape[1] == 45  # 25 + 20 features
        assert len(combined.feature_names) == 45


class TestDataPreprocessor:
    """Test DataPreprocessor."""
    
    def test_data_preprocessing(self):
        """Test data preprocessing."""
        preprocessor = DataPreprocessor()
        
        # Create sample data
        X = np.random.random((100, 10))
        feature_names = [f"feature_{i}" for i in range(10)]
        
        # Fit preprocessor
        preprocessor.fit(X, feature_names)
        assert preprocessor.is_fitted is True
        
        # Transform data
        X_transformed = preprocessor.transform(X)
        assert X_transformed.shape == X.shape
        assert np.all(np.isfinite(X_transformed))
        
        # Test inverse transform
        X_inverse = preprocessor.inverse_transform(X_transformed)
        assert X_inverse.shape == X.shape
        assert np.allclose(X, X_inverse, rtol=1e-10)


class TestModelTraining:
    """Test model training components."""
    
    def test_training_config(self):
        """Test TrainingConfig."""
        config = TrainingConfig(
            model_name="test_model",
            validation_split=0.2,
            test_split=0.1,
            random_state=42,
            max_iterations=1000,
            early_stopping_patience=10,
            learning_rate=0.01,
            batch_size=32,
            cross_validation_folds=5,
            hyperparameter_tuning=True,
            save_best_model=True,
            verbose=True
        )
        
        assert config.model_name == "test_model"
        assert config.validation_split == 0.2
        assert config.test_split == 0.1
        assert config.random_state == 42
        assert config.max_iterations == 1000
        assert config.early_stopping_patience == 10
        assert config.learning_rate == 0.01
        assert config.batch_size == 32
        assert config.cross_validation_folds == 5
        assert config.hyperparameter_tuning is True
        assert config.save_best_model is True
        assert config.verbose is True
    
    def test_model_trainer(self):
        """Test ModelTrainer."""
        config = TrainingConfig(model_name="test_model")
        trainer = ModelTrainer(config)
        
        assert trainer.config.model_name == "test_model"
        assert trainer.is_trained is False
        assert trainer.best_model is None
        assert trainer.best_metrics is None
    
    def test_hyperparameter_optimizer(self):
        """Test HyperparameterOptimizer."""
        optimizer = HyperparameterOptimizer("random_search")
        
        assert optimizer.optimization_method == "random_search"
        assert optimizer.best_params is None
        assert optimizer.best_score is None
    
    def test_cross_validator(self):
        """Test CrossValidator."""
        cv = CrossValidator(cv_folds=5, random_state=42)
        
        assert cv.cv_folds == 5
        assert cv.random_state == 42
        assert len(cv.cv_results) == 0
    
    def test_model_evaluator(self):
        """Test ModelEvaluator."""
        evaluator = ModelEvaluator()
        
        assert len(evaluator.evaluation_results) == 0
        assert len(evaluator.benchmark_models) == 0


class TestModelMetrics:
    """Test ModelMetrics."""
    
    def test_model_metrics_creation(self):
        """Test ModelMetrics creation."""
        metrics = ModelMetrics(
            accuracy=0.92,
            precision=0.89,
            recall=0.91,
            f1_score=0.90,
            auc_roc=0.94,
            mse=0.08,
            mae=0.06,
            r2_score=0.88
        )
        
        assert metrics.accuracy == 0.92
        assert metrics.precision == 0.89
        assert metrics.recall == 0.91
        assert metrics.f1_score == 0.90
        assert metrics.auc_roc == 0.94
        assert metrics.mse == 0.08
        assert metrics.mae == 0.06
        assert metrics.r2_score == 0.88
    
    def test_model_metrics_defaults(self):
        """Test ModelMetrics with default values."""
        metrics = ModelMetrics(
            accuracy=0.92,
            precision=0.89,
            recall=0.91,
            f1_score=0.90,
            auc_roc=0.94
        )
        
        assert metrics.accuracy == 0.92
        assert metrics.precision == 0.89
        assert metrics.recall == 0.91
        assert metrics.f1_score == 0.90
        assert metrics.auc_roc == 0.94
        assert metrics.mse is None
        assert metrics.mae is None
        assert metrics.r2_score is None


class TestPredictionResult:
    """Test PredictionResult."""
    
    def test_prediction_result_creation(self):
        """Test PredictionResult creation."""
        result = PredictionResult(
            prediction="LOW",
            confidence=0.85,
            probabilities={"LOW": 0.85, "MEDIUM": 0.10, "HIGH": 0.05},
            features_importance={"feature_1": 0.3, "feature_2": 0.7},
            model_version="1.0.0"
        )
        
        assert result.prediction == "LOW"
        assert result.confidence == 0.85
        assert result.probabilities["LOW"] == 0.85
        assert result.features_importance["feature_1"] == 0.3
        assert result.model_version == "1.0.0"
    
    def test_prediction_result_defaults(self):
        """Test PredictionResult with default values."""
        result = PredictionResult(
            prediction="LOW",
            confidence=0.85
        )
        
        assert result.prediction == "LOW"
        assert result.confidence == 0.85
        assert result.probabilities is None
        assert result.features_importance is None
        assert result.model_version == "1.0.0"


class TestMLIntegration:
    """Test ML system integration."""
    
    def test_end_to_end_ml_pipeline(self):
        """Test end-to-end ML pipeline."""
        # Initialize components
        manager = ModelManager()
        engineering = FeatureEngineering()
        
        # Add feature extractor
        engineering.add_extractor("packages", PackageFeatureExtractor())
        
        # Create sample data
        packages = [
            {
                "name": "requests",
                "version": "2.28.1",
                "ecosystem": "pypi",
                "download_count": 1000000,
                "star_count": 50000,
                "license": "Apache-2.0"
            }
        ]
        
        # Feature engineering
        engineering.fit({"packages": packages})
        feature_sets = engineering.transform({"packages": packages})
        combined_features = engineering.get_combined_features(feature_sets)
        
        # Create training data
        X = np.random.random((100, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 100)
        
        # Train model
        metrics = manager.train_model("risk_prediction", X, y)
        assert metrics is not None
        assert metrics.accuracy > 0
        
        # Make prediction
        X_test = np.random.random((10, 25))
        result = manager.predict("risk_prediction", X_test)
        assert result is not None
        assert result.confidence > 0
        
        # Get model info
        info = manager.get_model_info("risk_prediction")
        assert info is not None
        assert info["is_trained"] is True
        assert info["training_data_size"] == 100

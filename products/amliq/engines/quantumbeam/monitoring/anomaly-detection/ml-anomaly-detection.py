#!/usr/bin/env python3
"""
ML-based Anomaly Detection System for QuantumBeam Production
Implements machine learning models for advanced anomaly detection
"""

import asyncio
import json
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import aiohttp
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import Dense, LSTM, RepeatVector, TimeDistributed
from tensorflow.keras.optimizers import Adam
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus Metrics
ML_ANOMALIES_DETECTED = Counter('ml_anomalies_detected_total', 'Total ML anomalies detected', ['model_type', 'metric'])
ML_MODEL_TRAININGS = Counter('ml_model_trainings_total', 'Total ML model trainings', ['model_type'])
ML_DETECTION_LATENCY = Histogram('ml_detection_duration_seconds', 'ML anomaly detection processing time')
ACTIVE_ML_MODELS = Gauge('ml_active_models', 'Number of active ML models')

@dataclass
class MLAnomaly:
    """ML anomaly detection result"""
    timestamp: datetime
    metric_name: str
    current_value: float
    predicted_value: float
    anomaly_score: float
    confidence: float
    severity: str  # 'low', 'medium', 'high', 'critical'
    model_type: str
    model_version: str
    features: Dict[str, float] = None
    explanation: Dict[str, Any] = None

    def __post_init__(self):
        if self.features is None:
            self.features = {}
        if self.explanation is None:
            self.explanation = {}

@dataclass
class MLModel:
    """ML model configuration and state"""
    name: str
    model_type: str  # 'isolation_forest', 'lstm', 'autoencoder', 'pca', 'dbscan'
    metric_name: str
    features: List[str]
    hyperparameters: Dict[str, Any]
    model: Any = None
    scaler: Any = None
    is_trained: bool = False
    model_version: int = 1
    training_data: List[Dict[str, Any]] = None
    last_trained: datetime = None
    performance_metrics: Dict[str, float] = None

    def __post_init__(self):
        if self.training_data is None:
            self.training_data = []
        if self.performance_metrics is None:
            self.performance_metrics = {}

class MLAnomalyDetector:
    """ML-based Anomaly Detection Engine"""

    def __init__(self, redis_url: str, prometheus_url: str):
        self.redis_url = redis_url
        self.prometheus_url = prometheus_url
        self.redis_client: Optional[redis.Redis] = None
        self.session: Optional[aiohttp.ClientSession] = None

        # Active models
        self.models: Dict[str, MLModel] = {}

        # Configuration
        self.config = self._load_default_config()

        # Feature engineering
        self.feature_extractors = self._initialize_feature_extractors()

        # Alert thresholds
        self.alert_thresholds = {
            'low': 0.6,
            'medium': 0.7,
            'high': 0.8,
            'critical': 0.9
        }

    async def start(self):
        """Start the ML anomaly detection engine"""
        logger.info("Starting ML Anomaly Detection Engine")

        # Initialize Redis
        self.redis_client = redis.from_url(self.redis_url)

        # Initialize HTTP session
        self.session = aiohttp.ClientSession()

        # Load existing models
        await self._load_models()

        # Start background tasks
        asyncio.create_task(self._model_training_task())
        asyncio.create_task(self._detection_task())
        asyncio.create_task(self._model_retention_task())

        # Start metrics server
        start_http_server(9097)

        logger.info("ML Anomaly Detection Engine started successfully")

    async def stop(self):
        """Stop the anomaly detection engine"""
        logger.info("Stopping ML Anomaly Detection Engine")

        if self.session:
            await self.session.close()
        if self.redis_client:
            await self.redis_client.close()

    def _load_default_config(self) -> Dict:
        """Load default configuration"""
        return {
            'min_training_samples': 1000,
            'max_training_samples': 10000,
            'training_interval_hours': 24,
            'detection_interval_seconds': 60,
            'model_retention_days': 30,
            'feature_window_size': 24,  # hours
            'alert_cooldown_minutes': 30,
            'model_validation_split': 0.2,
            'early_stopping_patience': 10
        }

    def _initialize_feature_extractors(self) -> Dict:
        """Initialize feature extractors for different metric types"""
        return {
            'time_based': {
                'hour_of_day': lambda ts: ts.hour,
                'day_of_week': lambda ts: ts.weekday(),
                'day_of_month': lambda ts: ts.day,
                'month': lambda ts: ts.month,
                'is_weekend': lambda ts: ts.weekday() >= 5,
                'is_business_hours': lambda ts: 9 <= ts.hour <= 17 and ts.weekday() < 5
            },
            'statistical': {
                'rolling_mean_1h': lambda values: np.mean(values[-60:]) if len(values) >= 60 else np.mean(values),
                'rolling_std_1h': lambda values: np.std(values[-60:]) if len(values) >= 60 else 0.0,
                'rolling_mean_24h': lambda values: np.mean(values[-1440:]) if len(values) >= 1440 else np.mean(values),
                'rolling_std_24h': lambda values: np.std(values[-1440:]) if len(values) >= 1440 else 0.0,
                'trend_1h': lambda values: self._calculate_trend(values[-60:]) if len(values) >= 60 else 0.0,
                'trend_24h': lambda values: self._calculate_trend(values[-1440:]) if len(values) >= 1440 else 0.0,
                'volatility': lambda values: np.std(values) / np.mean(values) if np.mean(values) != 0 else 0.0
            },
            'derivative': {
                'first_derivative': lambda values: values[-1] - values[-2] if len(values) >= 2 else 0.0,
                'second_derivative': lambda values: (values[-1] - 2*values[-2] + values[-3]) if len(values) >= 3 else 0.0,
                'rate_of_change': lambda values: (values[-1] / values[-2] - 1) if len(values) >= 2 and values[-2] != 0 else 0.0
            }
        }

    def _calculate_trend(self, values: np.ndarray) -> float:
        """Calculate linear trend of values"""
        if len(values) < 2:
            return 0.0

        x = np.arange(len(values))
        y = np.array(values)

        # Simple linear regression
        slope = np.polyfit(x, y, 1)[0]
        return slope

    async def _load_models(self):
        """Load ML models from Redis"""
        try:
            model_keys = await self.redis_client.keys("ml:model:*")

            for key in model_keys:
                model_data = await self.redis_client.get(key)
                if model_data:
                    model_dict = json.loads(model_data.decode())

                    # Reconstruct ML model
                    model = MLModel(**model_dict)

                    # Load actual model if it exists
                    model_file = f"/tmp/ml_models/{model.name}.joblib"
                    if os.path.exists(model_file):
                        model.model = joblib.load(model_file)

                    # Load scaler if it exists
                    scaler_file = f"/tmp/ml_models/{model.name}_scaler.joblib"
                    if os.path.exists(scaler_file):
                        model.scaler = joblib.load(scaler_file)

                    self.models[model.name] = model

            ACTIVE_ML_MODELS.set(len(self.models))
            logger.info(f"Loaded {len(self.models)} ML models")

        except Exception as e:
            logger.error(f"Error loading ML models from Redis: {e}")

    async def save_model(self, model: MLModel):
        """Save ML model to Redis and filesystem"""
        try:
            # Save model metadata to Redis
            model_dict = asdict(model)
            model_dict['last_trained'] = model.last_trained.isoformat() if model.last_trained else None

            await self.redis_client.set(
                f"ml:model:{model.name}",
                json.dumps(model_dict)
            )

            # Set expiration
            await self.redis_client.expire(
                f"ml:model:{model.name}",
                self.config['model_retention_days'] * 24 * 3600
            )

            # Save model to filesystem
            os.makedirs("/tmp/ml_models", exist_ok=True)

            if model.model is not None:
                joblib.dump(model.model, f"/tmp/ml_models/{model.name}.joblib")

            if model.scaler is not None:
                joblib.dump(model.scaler, f"/tmp/ml_models/{model.name}_scaler.joblib")

        except Exception as e:
            logger.error(f"Error saving model {model.name}: {e}")

    async def create_model(self, model_config: Dict) -> MLModel:
        """Create a new ML anomaly detection model"""
        model = MLModel(
            name=model_config['name'],
            model_type=model_config['model_type'],
            metric_name=model_config['metric_name'],
            features=model_config['features'],
            hyperparameters=model_config.get('hyperparameters', {}),
            model_version=1
        )

        # Initialize model based on type
        if model.model_type == 'isolation_forest':
            model.model = IsolationForest(
                contamination=model.hyperparameters.get('contamination', 0.1),
                random_state=42,
                n_estimators=model.hyperparameters.get('n_estimators', 100)
            )
            model.scaler = StandardScaler()

        elif model.model_type == 'lstm':
            model.model = self._create_lstm_model(model.hyperparameters)
            model.scaler = StandardScaler()

        elif model.model_type == 'autoencoder':
            model.model = self._create_autoencoder_model(model.hyperparameters)
            model.scaler = StandardScaler()

        elif model.model_type == 'pca':
            model.model = PCA(
                n_components=model.hyperparameters.get('n_components', 2),
                random_state=42
            )
            model.scaler = StandardScaler()

        self.models[model.name] = model
        await self.save_model(model)
        ACTIVE_ML_MODELS.set(len(self.models))

        logger.info(f"Created new ML model: {model.name} using {model.model_type} algorithm")
        return model

    def _create_lstm_model(self, hyperparams: Dict) -> Model:
        """Create LSTM autoencoder for time series anomaly detection"""
        sequence_length = hyperparams.get('sequence_length', 24)
        n_features = hyperparams.get('n_features', 5)

        model = Sequential([
            LSTM(64, activation='relu', input_shape=(sequence_length, n_features), return_sequences=True),
            LSTM(32, activation='relu', return_sequences=False),
            RepeatVector(sequence_length),
            LSTM(32, activation='relu', return_sequences=True),
            LSTM(64, activation='relu', return_sequences=False),
            Dense(n_features)
        ])

        model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
        return model

    def _create_autoencoder_model(self, hyperparams: Dict) -> Model:
        """Create autoencoder for anomaly detection"""
        input_dim = hyperparams.get('input_dim', 10)
        encoding_dim = hyperparams.get('encoding_dim', 3)

        # Encoder
        input_layer = tf.keras.layers.Input(shape=(input_dim,))
        encoded = tf.keras.layers.Dense(64, activation='relu')(input_layer)
        encoded = tf.keras.layers.Dense(32, activation='relu')(encoded)
        encoded = tf.keras.layers.Dense(encoding_dim, activation='relu')(encoded)

        # Decoder
        decoded = tf.keras.layers.Dense(32, activation='relu')(encoded)
        decoded = tf.keras.layers.Dense(64, activation='relu')(decoded)
        decoded = tf.keras.layers.Dense(input_dim, activation='linear')(decoded)

        model = tf.keras.Model(inputs=input_layer, outputs=decoded)
        model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
        return model

    async def detect_anomalies(self, metric_name: str, value: float, timestamp: datetime = None) -> List[MLAnomaly]:
        """Detect anomalies using ML models for a given metric value"""
        if timestamp is None:
            timestamp = datetime.utcnow()

        anomalies = []

        for model in self.models.values():
            if model.metric_name != metric_name or not model.is_trained:
                continue

            try:
                    anomaly = await self._detect_anomaly_with_ml_model(model, value, timestamp)
                    if anomaly:
                        anomalies.append(anomaly)
                        ML_ANOMALIES_DETECTED.labels(model_type=model.model_type, metric=metric_name).inc()

            except Exception as e:
                logger.error(f"Error detecting anomaly with ML model {model.name}: {e}")

        return anomalies

    @ML_DETECTION_LATENCY.time()
    async def _detect_anomaly_with_ml_model(self, model: MLModel, value: float, timestamp: datetime) -> Optional[MLAnomaly]:
        """Detect anomaly using specific ML model"""
        if not model.is_trained:
            return None

        # Get recent data for feature extraction
        recent_data = await self._get_metric_history(model.metric_name, self.config['feature_window_size'])
        if len(recent_data) < 10:
            return None

        # Extract features
        features = self._extract_features(recent_data, timestamp)
        if not features:
            return None

        # Prepare input for model
        X = np.array([list(features.values())]).reshape(1, -1)

        # Scale features
        X_scaled = model.scaler.transform(X)

        anomaly_score = 0.0
        predicted_value = 0.0
        explanation = {}

        if model.model_type == 'isolation_forest':
            anomaly_score = -model.model.decision_function(X_scaled)[0]
            predicted_value = self._get_predicted_value(model, recent_data)

        elif model.model_type == 'lstm':
            # LSTM requires sequence data
            if len(model.training_data) >= 24:
                sequence_data = self._prepare_sequence_data(model.training_data[-100:], model.features)
                if len(sequence_data) > 0:
                    prediction = model.model.predict(sequence_data)
                    predicted_value = prediction[-1][0]
                    reconstruction_error = np.mean((prediction - sequence_data[-1]) ** 2)
                    anomaly_score = reconstruction_error / np.var(sequence_data[-1])

        elif model.model_type == 'autoencoder':
            reconstruction = model.model.predict(X_scaled)
            reconstruction_error = np.mean((X_scaled - reconstruction) ** 2, axis=1)[0]
            predicted_value = self._get_predicted_value(model, recent_data)
            anomaly_score = reconstruction_error

        elif model.model_type == 'pca':
            X_pca = model.model.transform(X_scaled)
            reconstruction = model.model.inverse_transform(X_pca)
            reconstruction_error = np.mean((X_scaled - reconstruction) ** 2, axis=1)[0]
            predicted_value = self._get_predicted_value(model, recent_data)
            anomaly_score = reconstruction_error

        # Apply threshold based on model performance
        threshold = self._get_dynamic_threshold(model, anomaly_score)
        if anomaly_score < threshold:
            return None

        # Determine severity
        severity = self._calculate_ml_severity(anomaly_score, threshold)

        # Check alert cooldown
        if await self._is_in_ml_alert_cooldown(model.name, metric_name):
            return None

        # Update last alert time
        await self._update_ml_alert_cooldown(model.name, metric_name)

        return MLAnomaly(
            timestamp=timestamp,
            metric_name=model.metric_name,
            current_value=value,
            predicted_value=predicted_value,
            anomaly_score=anomaly_score,
            confidence=self._calculate_ml_confidence(anomaly_score, model),
            severity=severity,
            model_type=model.model_type,
            model_version=f"v{model.model_version}",
            features=features,
            explanation=explanation
        )

    def _extract_features(self, data: List[Dict], timestamp: datetime) -> Dict[str, float]:
        """Extract features from time series data"""
        features = {}

        # Time-based features
        for name, extractor in self.feature_extractors['time_based'].items():
            features[name] = extractor(timestamp)

        # Statistical features
        values = np.array([d['value'] for d in data])
        for name, extractor in self.feature_extractors['statistical'].items():
            try:
                features[name] = extractor(values)
            except:
                features[name] = 0.0

        # Derivative features
        for name, extractor in self.feature_extractors['derivative'].items():
            try:
                features[name] = extractor(values)
            except:
                features[name] = 0.0

        return features

    def _get_predicted_value(self, model: MLModel, data: List[Dict]) -> float:
        """Get predicted value using simple methods"""
        if model.model_type in ['isolation_forest', 'pca']:
            # Use moving average as fallback
            return np.mean([d['value'] for d in data[-10:]])
        else:
            # Use last value as fallback
            return data[-1]['value']

    def _prepare_sequence_data(self, training_data: List[Dict], features: List[str], sequence_length: int = 24) -> np.ndarray:
        """Prepare sequence data for LSTM training"""
        # Extract feature matrix
        feature_matrix = []
        for data_point in training_data:
            row = [data_point.get(feat, 0.0) for feat in features]
            feature_matrix.append(row)

        feature_matrix = np.array(feature_matrix)

        # Create sequences
        sequences = []
        for i in range(len(feature_matrix) - sequence_length + 1):
            sequences.append(feature_matrix[i:i + sequence_length])

        return np.array(sequences)

    def _get_dynamic_threshold(self, model: MLModel, score: float) -> float:
        """Get dynamic threshold based on model performance"""
        base_threshold = model.hyperparameters.get('threshold', 0.1)

        # Adjust threshold based on model performance
        if model.performance_metrics.get('precision', 0.9) > 0.95:
            # High precision model can use lower threshold
            return base_threshold * 0.8
        elif model.performance_metrics.get('precision', 0.9) < 0.8:
            # Lower precision model needs higher threshold
            return base_threshold * 1.2

        return base_threshold

    def _calculate_ml_severity(self, anomaly_score: float, threshold: float) -> str:
        """Calculate anomaly severity for ML models"""
        # Normalize score relative to threshold
        normalized_score = min((anomaly_score - threshold) / threshold, 1.0) if threshold > 0 else 0.0

        if normalized_score >= self.alert_thresholds['critical']:
            return 'critical'
        elif normalized_score >= self.alert_thresholds['high']:
            return 'high'
        elif normalized_score >= self.alert_thresholds['medium']:
            return 'medium'
        else:
            return 'low'

    def _calculate_ml_confidence(self, anomaly_score: float, model: MLModel) -> float:
        """Calculate confidence in ML anomaly detection"""
        # Confidence based on anomaly score and model performance
        score_factor = min(anomaly_score, 1.0)
        performance_factor = model.performance_metrics.get('f1_score', 0.8) / 1.0

        confidence = (score_factor * 0.7) + (performance_factor * 0.3)
        return min(confidence, 1.0)

    async def _is_in_ml_alert_cooldown(self, model_name: str, metric_name: str) -> bool:
        """Check if metric is in ML alert cooldown period"""
        cooldown_key = f"ml:cooldown:{model_name}:{metric_name}"
        return await self.redis_client.exists(cooldown_key) > 0

    async def _update_ml_alert_cooldown(self, model_name: str, metric_name: str):
        """Update ML alert cooldown"""
        cooldown_key = f"ml:cooldown:{model_name}:{metric_name}"
        cooldown_seconds = self.config['alert_cooldown_minutes'] * 60

        await self.redis_client.setex(cooldown_key, cooldown_seconds, "1")

    async def _model_training_task(self):
        """Background task to train ML models"""
        while True:
            try:
                await asyncio.sleep(self.config['training_interval_hours'] * 3600)

                for model in self.models.values():
                    try:
                        await self._train_ml_model(model)
                    except Exception as e:
                        logger.error(f"Error training ML model {model.name}: {e}")

            except Exception as e:
                logger.error(f"Error in ML model training task: {e}")

    async def _train_ml_model(self, model: MLModel):
        """Train an ML model with recent data"""
        # Get training data
        training_data = await self._get_training_data(model.metric_name, model.features)
        if len(training_data) < self.config['min_training_samples']:
            logger.warning(f"Insufficient training data for ML model {model.name}: {len(training_data)} < {self.config['min_training_samples']}")
            return

        # Limit training data size
        if len(training_data) > self.config['max_training_samples']:
            training_data = training_data[-self.config['max_training_samples']:]

        # Prepare training data
        X = np.array([list(d['features']) for d in training_data])

        # Train model based on type
        if model.model_type in ['isolation_forest', 'pca']:
            # Unsupervised learning
            X_scaled = model.scaler.fit_transform(X)
            model.model.fit(X_scaled)

        elif model.model_type == 'autoencoder':
            # Neural network
            X_scaled = model.scaler.fit_transform(X)
            model.model.fit(X_scaled, X_scaled, epochs=50, batch_size=32, verbose=0)

        elif model.model_type == 'lstm':
            # Time series
            sequences = self._prepare_sequence_data(training_data, model.features)
            if len(sequences) > 0:
                X_scaled = model.scaler.fit_transform(sequences.reshape(-1, sequences.shape[-1]))
                model.model.fit(X_scaled, X_scaled, epochs=100, batch_size=32, verbose=0,
                               validation_split=self.config['model_validation_split'],
                               callbacks=[
                                   tf.keras.callbacks.EarlyStopping(patience=self.config['early_stopping_patience'])
                               ])

        # Update model metadata
        model.is_trained = True
        model.last_trained = datetime.utcnow()
        model.model_version += 1

        # Calculate performance metrics
        model.performance_metrics = self._evaluate_model_performance(model, X_scaled)

        # Update training data
        model.training_data = training_data

        await self.save_model(model)
        ML_MODEL_TRAININGS.labels(model_type=model.model_type).inc()
        logger.info(f"Trained ML model {model.name} (v{model.model_version}) with {len(training_data)} samples")

    def _evaluate_model_performance(self, model: MLModel, X_scaled: np.ndarray) -> Dict[str, float]:
        """Evaluate model performance metrics"""
        metrics = {}

        if model.model_type == 'isolation_forest':
            # For isolation forest, use anomaly detection metrics
            predictions = model.model.predict(X_scaled)
            anomaly_rate = np.mean(predictions == -1)
            metrics['anomaly_rate'] = anomaly_rate
            metrics['contamination'] = model.hyperparameters.get('contamination', 0.1)

        # Add more sophisticated evaluation for other model types as needed
        return metrics

    async def _get_training_data(self, metric_name: str, features: List[str]) -> List[Dict]:
        """Get training data for ML model"""
        try:
            # Get historical data from Prometheus
            query = f'rate({metric_name}[1m])'
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=self.config['max_training_samples'] / 60)

            url = f"{self.prometheus_url}/api/v1/query_range"
            params = {
                'query': query,
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'step': '60s'
            }

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    training_data = []

                    if 'data' in data and 'result' in data['data']:
                        for result in data['data']['result']:
                            for value in result.get('values', []):
                                if len(value) >= 2:
                                    timestamp = datetime.fromisoformat(value[0].replace('Z', '+00:00'))
                                    metric_value = float(value[1])

                                    # Extract features
                                    recent_data = await self._get_metric_history(metric_name, self.config['feature_window_size'])
                                    if len(recent_data) > 0:
                                        feature_data = self._extract_features(recent_data, timestamp)
                                        feature_data['value'] = metric_value
                                        training_data.append(feature_data)

                    return training_data

        except Exception as e:
            logger.error(f"Error getting training data from Prometheus: {e}")

        return []

    async def _get_metric_history(self, metric_name: str, hours: int) -> List[Dict]:
        """Get metric history from Prometheus"""
        try:
            query = f'rate({metric_name}[1m])'
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)

            url = f"{self.prometheus_url}/api/v1/query_range"
            params = {
                'query': query,
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'step': '60s'
            }

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    history = []

                    if 'data' in data and 'result' in data['data']:
                        for result in data['data']['result']:
                            for value in result.get('values', []):
                                if len(value) >= 2:
                                    timestamp = datetime.fromisoformat(value[0].replace('Z', '+00:00'))
                                    metric_value = float(value[1])
                                    history.append({
                                        'timestamp': timestamp,
                                        'value': metric_value
                                    })

                    return history

        except Exception as e:
            logger.error(f"Error getting metric history: {e}")

        return []

    async def _detection_task(self):
        """Background task to run ML anomaly detection"""
        while True:
            try:
                await asyncio.sleep(self.config['detection_interval_seconds'])

                # Get all metric names from models
                metric_names = list(set(model.metric_name for model in self.models.values() if model.is_trained))

                for metric_name in metric_names:
                    try:
                        # Get current value
                        current_value = await self._get_current_metric_value(metric_name)
                        if current_value is not None:
                            anomalies = await self.detect_anomalies(metric_name, current_value)

                            for anomaly in anomalies:
                                await self._handle_ml_anomaly(anomaly)

                    except Exception as e:
                        logger.error(f"Error processing metric {metric_name}: {e}")

            except Exception as e:
                logger.error(f"Error in ML detection task: {e}")

    async def _get_current_metric_value(self, metric_name: str) -> Optional[float]:
        """Get current metric value from Prometheus"""
        try:
            query = f'rate({metric_name}[1m])'
            url = f"{self.prometheus_url}/api/v1/query"
            params = {'query': query}

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'data' in data and 'result' in data['data']:
                        for result in data['data']['result']:
                            for value in result.get('value', []):
                                if len(value) >= 2:
                                    return float(value[1])
                return None

        except Exception as e:
            logger.error(f"Error getting current metric value: {e}")
            return None

    async def _handle_ml_anomaly(self, anomaly: MLAnomaly):
        """Handle ML-detected anomaly"""
        # Send alert
        await self._send_ml_anomaly_alert(anomaly)

        # Store anomaly in Redis
        anomaly_data = {
            'timestamp': anomaly.timestamp.isoformat(),
            'metric_name': anomaly.metric_name,
            'current_value': anomaly.current_value,
            'predicted_value': anomaly.predicted_value,
            'anomaly_score': anomaly.anomaly_score,
            'confidence': anomaly.confidence,
            'severity': anomaly.severity,
            'model_type': anomaly.model_type,
            'model_version': anomaly.model_version,
            'features': anomaly.features,
            'explanation': anomaly.explanation
        }

        await self.redis_client.lpush(
            f"ml:recent:{anomaly.metric_name}",
            json.dumps(anomaly_data)
        )

        # Keep only last 100 anomalies per metric
        await self.redis_client.ltrim(f"ml:recent:{anomaly.metric_name}", 0, 100)

        logger.warning(f"ML Anomaly detected: {anomaly.metric_name} = {anomaly.current_value:.2f} "
                      f"(predicted: {anomaly.predicted_value:.2f}, score: {anomaly.anomaly_score:.2f}, "
                      f"severity: {anomaly.severity}, model: {anomaly.model_type})")

    async def _send_ml_anomaly_alert(self, anomaly: MLAnomaly):
        """Send ML anomaly alert to external systems"""
        alert_data = {
            'alertname': f'MLAnomaly_{anomaly.metric_name}',
            'severity': anomaly.severity,
            'instance': 'ml-detector',
            'metric_name': anomaly.metric_name,
            'current_value': anomaly.current_value,
            'predicted_value': anomaly.predicted_value,
            'anomaly_score': anomaly.anomaly_score,
            'model_type': anomaly.model_type,
            'model_version': anomaly.model_version,
            'confidence': anomaly.confidence,
            'timestamp': anomaly.timestamp.isoformat(),
            'description': f'ML anomaly detected in {anomaly.metric_name}: '
                           f'current={anomaly.current_value:.2f}, predicted={anomaly.predicted_value:.2f}, '
                           f'score={anomaly.anomaly_score:.2f}, model={anomaly.model_type}',
            'annotations': {
                'summary': f'ML Anomaly: {anomaly.metric_name}',
                'description': f'Current value {anomaly.current_value:.2f} deviates from ML prediction {anomaly.predicted_value:.2f}',
                'runbook_url': 'https://kb.quantumbeam.io/ml-anomaly-detection',
                'severity': anomaly.severity,
                'model_type': anomaly.model_type,
                'model_version': anomaly.model_version,
                'confidence': anomaly.confidence
            }
        }

        # Send to AlertManager via webhook
        try:
            webhook_url = os.getenv('ALERTMANAGER_WEBHOOK_URL', 'http://alertmanager:9093/api/v1/alerts')

            async with self.session.post(webhook_url, json=[alert_data]) as response:
                if response.status != 200:
                    logger.error(f"Failed to send ML anomaly alert to AlertManager: {response.status}")

        except Exception as e:
            logger.error(f"Error sending ML anomaly alert: {e}")

    async def _model_retention_task(self):
        """Background task to manage model retention"""
        while True:
            try:
                await asyncio.sleep(7 * 24 * 3600)  # Run weekly

                # Remove old models
                current_time = datetime.utcnow()
                for model_name, model in list(self.models.items()):
                    if model.last_trained:
                        age_days = (current_time - model.last_trained).days
                        if age_days > self.config['model_retention_days']:
                            del self.models[model_name]

                            # Remove from Redis
                            await self.redis_client.delete(f"ml:model:{model_name}")

                            # Remove model files
                            model_file = f"/tmp/ml_models/{model_name}.joblib"
                            if os.path.exists(model_file):
                                os.remove(model_file)

                            scaler_file = f"/tmp/ml_models/{model_name}_scaler.joblib"
                            if os.path.exists(scaler_file):
                                os.remove(scaler_file)

                ACTIVE_ML_MODELS.set(len(self.models))
                logger.info(f"Completed model retention cleanup. Active models: {len(self.models)}")

            except Exception as e:
                logger.error(f"Error in model retention task: {e}")

    async def get_ml_anomaly_summary(self, hours: int = 24) -> Dict:
        """Get ML anomaly summary for specified time period"""
        summary = {
            'total_anomalies': 0,
            'by_severity': defaultdict(int),
            'by_model_type': defaultdict(int),
            'by_metric': defaultdict(int),
            'recent_anomalies': []
        }

        try:
            # Get recent anomalies from all metrics
            for model in self.models.values():
                anomaly_data = await self.redis_client.lrange(
                    f"ml:recent:{model.metric_name}", 0, 50
                )

                for data in anomaly_data:
                    anomaly = json.loads(data.decode())
                    timestamp = datetime.fromisoformat(anomaly['timestamp'])

                    if datetime.utcnow() - timestamp <= timedelta(hours=hours):
                        summary['total_anomalies'] += 1
                        summary['by_severity'][anomaly['severity']] += 1
                        summary['by_model_type'][anomaly['model_type']] += 1
                        summary['by_metric'][anomaly['metric_name']] += 1

                        if len(summary['recent_anomalies']) < 20:
                            summary['recent_anomalies'].append(anomaly)

        except Exception as e:
            logger.error(f"Error getting ML anomaly summary: {e}")

        return summary

    async def get_ml_model_status(self) -> Dict:
        """Get status of all ML models"""
        status = {
            'total_models': len(self.models),
            'trained_models': sum(1 for m in self.models.values() if m.is_trained),
            'models': {}
        }

        for name, model in self.models.items():
            status['models'][name] = {
                'model_type': model.model_type,
                'metric_name': model.metric_name,
                'features': model.features,
                'hyperparameters': model.hyperparameters,
                'is_trained': model.is_trained,
                'model_version': model.model_version,
                'training_samples': len(model.training_data),
                'last_trained': model.last_trained.isoformat() if model.last_trained else None,
                'performance_metrics': model.performance_metrics
            }

        return status

# API Server for ML Anomaly Detection
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

app = FastAPI(title="ML Anomaly Detection API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global ML anomaly detector
ml_anomaly_detector: Optional[MLAnomalyDetector] = None

class MLModelConfig(BaseModel):
    name: str
    model_type: str  # 'isolation_forest', 'lstm', 'autoencoder', 'pca', 'dbscan'
    metric_name: str
    features: List[str]
    hyperparameters: Dict[str, Any] = {}
    thresholds: Dict[str, float] = {}
    sensitivity: float = 0.8
    window_size: int = 100

class MLAnomalyRequest(BaseModel):
    metric_name: str
    value: float
    timestamp: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    global ml_anomaly_detector
    # Configuration from environment variables
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")

    ml_anomaly_detector = MLAnomalyDetector(redis_url, prometheus_url)
    await ml_anomaly_detector.start()

@app.on_event("shutdown")
async def shutdown_event():
    global ml_anomaly_detector
    if ml_anomaly_detector:
        await ml_anomaly_detector.stop()

@app.post("/ml-models")
async def create_ml_model(config: MLModelConfig):
    """Create a new ML anomaly detection model"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    try:
        model = await ml_anomaly_detector.create_model(config.dict())
        return {"message": f"ML model {config.name} created successfully", "model": model.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create ML model: {str(e)}")

@app.post("/ml-detect")
async def detect_ml_anomalies(request: MLAnomalyRequest):
    """Detect anomalies using ML models for a metric value"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    timestamp = None
    if request.timestamp:
        timestamp = datetime.fromisoformat(request.timestamp)

    anomalies = await ml_anomaly_detector.detect_anomalies(request.metric_name, request.value, timestamp)

    return {
        "anomalies": [
            {
                "timestamp": anomaly.timestamp.isoformat(),
                "metric_name": anomaly.metric_name,
                "current_value": anomaly.current_value,
                "predicted_value": anomaly.predicted_value,
                "anomaly_score": anomaly.anomaly_score,
                "confidence": anomaly.confidence,
                "severity": anomaly.severity,
                "model_type": anomaly.model_type,
                "model_version": anomaly.model_version,
                "features": anomaly.features,
                "explanation": anomaly.explanation
            }
            for anomaly in anomalies
        ]
    }

@app.get("/ml-models")
async def list_ml_models():
    """List all ML anomaly detection models"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    status = await ml_anomaly_detector.get_ml_model_status()
    return status

@app.get("/ml-models/{model_name}")
async def get_ml_model(model_name: str):
    """Get details of a specific ML model"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    if model_name not in ml_anomaly_detector.models:
        raise HTTPException(status_code=404, detail=f"ML model {model_name} not found")

    model = ml_anomaly_detector.models[model_name]
    return {
        "name": model.name,
        "model_type": model.model_type,
        "metric_name": model.metric_name,
        "features": model.features,
        "hyperparameters": model.hyperparameters,
        "is_trained": model.is_trained,
        "model_version": model.model_version,
        "training_samples": len(model.training_data) if model.training_data else 0,
        "last_trained": model.last_trained.isoformat() if model.last_trained else None,
        "performance_metrics": model.performance_metrics
    }

@app.delete("/ml-models/{model_name}")
async def delete_ml_model(model_name: str):
    """Delete an ML anomaly detection model"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    if model_name not in ml_anomaly_detector.models:
        raise HTTPException(status_code=404, detail=f"ML model {model_name} not found")

    del ml_anomaly_detector.models[model_name]

    # Remove from Redis
    await ml_anomaly_detector.redis_client.delete(f"ml:model:{model_name}")
    ACTIVE_ML_MODELS.set(len(ml_anomaly_detector.models))

    return {"message": f"ML model {model_name} deleted successfully"}

@app.post("/ml-models/{model_name}/train")
async def train_ml_model(model_name: str):
    """Manually trigger training for an ML model"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    if model_name not in ml_anomaly_detector.models:
        raise HTTPException(status_code=404, detail=f"ML model {model_name} not found")

    model = ml_anomaly_detector.models[model_name]
    await ml_anomaly_detector._train_ml_model(model)

    return {"message": f"ML model {model_name} training triggered"}

@app.get("/ml-summary")
async def get_ml_anomaly_summary(hours: int = 24):
    """Get ML anomaly summary"""
    if not ml_anomaly_detector:
        raise HTTPException(status_code=503, detail="ML anomaly detector not available")

    summary = await ml_anomaly_detector.get_ml_anomaly_summary(hours)
    return summary

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    import os

    uvicorn.run(
        "ml_anomaly_detection:app",
        host="0.0.0.0",
        port=8082,
        reload=False
    )
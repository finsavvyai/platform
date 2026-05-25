#!/usr/bin/env python3
"""
Advanced ML-based Anomaly Detection System for QuantumBeam
Comprehensive anomaly detection with multiple ML models, real-time analysis, and automated responses
"""

import asyncio
import json
import logging
import os
import sys
import pickle
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union

import aiohttp
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, RepeatVector, TimeDistributed
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
ANOMALY_DETECTIONS = Counter('ml_anomaly_detections_total', 'Total anomaly detections', ['model', 'severity'])
MODEL_ACCURACY = Gauge('ml_model_accuracy', 'Model accuracy score', ['model'])
MODEL_TRAINING_TIME = Histogram('ml_model_training_duration_seconds', 'Model training duration')
FEATURE_PROCESSING_TIME = Histogram('feature_processing_duration_seconds', 'Feature processing duration')
ACTIVE_MODELS = Gauge('active_ml_models', 'Number of active ML models')

class FeatureEngineer:
    """Advanced feature engineering for anomaly detection"""

    def __init__(self, config: Dict):
        self.config = config
        self.scalers = {}
        self.feature_columns = []
        self.time_windows = config.get('time_windows', [5, 15, 30, 60])  # minutes
        self.feature_cache = defaultdict(lambda: deque(maxlen=1000))

    def extract_features(self, metrics_data: Dict, metric_name: str) -> np.ndarray:
        """Extract comprehensive features from metrics data"""
        start_time = datetime.now()

        try:
            if not metrics_data or metric_name not in metrics_data:
                return np.array([])

            # Convert to DataFrame for easier manipulation
            df = pd.DataFrame(metrics_data[metric_name], columns=['timestamp', 'value'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp').set_index('timestamp')

            # Resample to regular intervals if needed
            if len(df) > 100:
                df = df.resample('1T').mean().interpolate()

            features = []

            # 1. Statistical features
            features.extend(self._extract_statistical_features(df))

            # 2. Time-based features
            features.extend(self._extract_time_features(df))

            # 3. Rolling window features
            features.extend(self._extract_rolling_features(df))

            # 4. Lag features
            features.extend(self._extract_lag_features(df))

            # 5. Trend and seasonality features
            features.extend(self._extract_trend_features(df))

            # 6. Volatility features
            features.extend(self._extract_volatility_features(df))

            # 7. Rate of change features
            features.extend(self._extract_rate_of_change_features(df))

            # 8. Anomaly history features
            features.extend(self._extract_anomaly_history_features(metric_name))

            feature_vector = np.array(features)

            # Cache features for future use
            self.feature_cache[metric_name].append({
                'timestamp': datetime.utcnow(),
                'features': feature_vector.copy(),
                'raw_value': df['value'].iloc[-1] if not df.empty else 0
            })

            # Update processing time metric
            processing_time = (datetime.now() - start_time).total_seconds()
            FEATURE_PROCESSING_TIME.observe(processing_time)

            return feature_vector

        except Exception as e:
            logger.error(f"Error extracting features for {metric_name}: {e}")
            return np.array([])

    def _extract_statistical_features(self, df: pd.DataFrame) -> List[float]:
        """Extract statistical features"""
        if len(df) < 2:
            return [0.0] * 10

        values = df['value'].dropna()
        if len(values) == 0:
            return [0.0] * 10

        return [
            np.mean(values),                    # Mean
            np.std(values),                     # Standard deviation
            np.median(values),                  # Median
            np.percentile(values, 25),           # 25th percentile
            np.percentile(values, 75),           # 75th percentile
            np.min(values),                     # Minimum
            np.max(values),                     # Maximum
            np.ptp(values),                     # Peak-to-peak range
            len(values),                       # Count
            len(values[values > np.mean(values)]) / len(values)  # Percentage above mean
        ]

    def _extract_time_features(self, df: pd.DataFrame) -> List[float]:
        """Extract time-based features"""
        if len(df) == 0:
            return [0.0] * 8

        latest_timestamp = df.index[-1]

        return [
            latest_timestamp.hour / 24.0,                # Hour of day (normalized)
            latest_timestamp.dayofweek / 6.0,              # Day of week (normalized)
            latest_timestamp.day / 31.0,                  # Day of month (normalized)
            latest_timestamp.month / 12.0,                 # Month (normalized)
            int(latest_timestamp.hour >= 9 and latest_timestamp.hour <= 17),  # Business hours
            int(latest_timestamp.weekday() < 5),           # Weekday
            int(latest_timestamp.hour in [12, 13]),         # Lunch hours
            (latest_timestamp.hour * 60 + latest_timestamp.minute) / 1440.0  # Time of day (normalized)
        ]

    def _extract_rolling_features(self, df: pd.DataFrame) -> List[float]:
        """Extract rolling window features"""
        features = []

        for window in self.time_windows:
            if len(df) >= window:
                rolling_mean = df['value'].rolling(f'{window}T').mean().iloc[-1]
                rolling_std = df['value'].rolling(f'{window}T').std().iloc[-1]
                rolling_min = df['value'].rolling(f'{window}T').min().iloc[-1]
                rolling_max = df['value'].rolling(f'{window}T').max().iloc[-1]

                features.extend([
                    rolling_mean if not np.isnan(rolling_mean) else 0,
                    rolling_std if not np.isnan(rolling_std) else 0,
                    rolling_min if not np.isnan(rolling_min) else 0,
                    rolling_max if not np.isnan(rolling_max) else 0,
                ])
            else:
                features.extend([0.0, 0.0, 0.0, 0.0])

        return features

    def _extract_lag_features(self, df: pd.DataFrame) -> List[float]:
        """Extract lag features"""
        lags = [1, 5, 10, 20, 50]
        features = []

        for lag in lags:
            if len(df) > lag:
                lag_value = df['value'].iloc[-lag - 1] if not np.isnan(df['value'].iloc[-lag - 1]) else 0
                features.append(lag_value)
            else:
                features.append(0.0)

        return features

    def _extract_trend_features(self, df: pd.DataFrame) -> List[float]:
        """Extract trend features"""
        if len(df) < 10:
            return [0.0] * 6

        # Simple linear trend
        x = np.arange(len(df))
        y = df['value'].values

        if len(y) > 1:
            slope = np.polyfit(x, y, 1)[0]
            intercept = np.polyfit(x, y, 1)[1]

            # R-squared
            y_pred = slope * x + intercept
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        else:
            slope = 0
            intercept = y[0] if len(y) > 0 else 0
            r_squared = 0

        # Recent trend (last 10 points vs previous 10 points)
        if len(df) >= 20:
            recent_values = df['value'].iloc[-10:].values
            previous_values = df['value'].iloc[-20:-10].values

            recent_mean = np.mean(recent_values)
            previous_mean = np.mean(previous_values)

            trend_change = (recent_mean - previous_mean) / previous_mean if previous_mean != 0 else 0
        else:
            trend_change = 0

        return [
            slope,
            intercept,
            r_squared,
            trend_change,
            df['value'].iloc[-1] - df['value'].iloc[0] if len(df) > 0 else 0,  # Total change
            (df['value'].iloc[-1] - df['value'].iloc[-2]) / df['value'].iloc[-2] if len(df) > 1 and df['value'].iloc[-2] != 0 else 0  # Latest change
        ]

    def _extract_volatility_features(self, df: pd.DataFrame) -> List[float]:
        """Extract volatility features"""
        if len(df) < 5:
            return [0.0] * 4

        values = df['value'].dropna()
        if len(values) == 0:
            return [0.0] * 4

        # Calculate returns (percentage changes)
        returns = values.pct_change().dropna()

        return [
            returns.std() if len(returns) > 0 else 0,                    # Volatility
            returns.mean() if len(returns) > 0 else 0,                   # Mean return
            (values.iloc[-1] - values.mean()) / values.std() if values.std() > 0 else 0,  # Z-score of latest value
            len(returns[returns > 0]) / len(returns) if len(returns) > 0 else 0  # Percentage of positive changes
        ]

    def _extract_rate_of_change_features(self, df: pd.DataFrame) -> List[float]:
        """Extract rate of change features"""
        if len(df) < 3:
            return [0.0] * 4

        values = df['value'].values

        return [
            (values[-1] - values[-2]) if len(values) >= 2 else 0,           # Last change
            (values[-1] - values[-3]) / 2 if len(values) >= 3 else 0,       # 2-period average change
            (values[-1] - values[0]) / len(values) if len(values) > 0 else 0,  # Average rate of change
            np.mean(np.diff(values)) if len(values) > 1 else 0                # Mean rate of change
        ]

    def _extract_anomaly_history_features(self, metric_name: str) -> List[float]:
        """Extract features from recent anomaly history"""
        cache_data = self.feature_cache[metric_name]

        if len(cache_data) < 10:
            return [0.0] * 8

        # Extract recent anomaly scores and patterns
        recent_data = list(cache_data)[-10:]

        # Count anomalies in recent history (simulated)
        recent_anomalies = sum(1 for data in recent_data if np.random.random() < 0.05)  # Simulated
        anomaly_rate = recent_anomalies / len(recent_data)

        # Time since last anomaly (simulated)
        time_since_last = np.random.randint(1, 100)

        return [
            recent_anomalies,
            anomaly_rate,
            time_since_last / 100.0,  # Normalized
            len(cache_data),
            len([d for d in recent_data if d['raw_value'] > np.mean([d['raw_value'] for d in recent_data])]) / len(recent_data),
            np.std([d['raw_value'] for d in recent_data]) if recent_data else 0,
            np.mean([d['raw_value'] for d in recent_data]) if recent_data else 0,
            len([d for d in recent_data if d['raw_value'] > 0]) / len(recent_data)
        ]

    def get_feature_names(self) -> List[str]:
        """Get names of all features"""
        names = []

        # Statistical features (10)
        names.extend(['mean', 'std', 'median', 'p25', 'p75', 'min', 'max', 'range', 'count', 'above_mean_pct'])

        # Time features (8)
        names.extend(['hour', 'dayofweek', 'day', 'month', 'business_hours', 'weekday', 'lunch_hours', 'time_of_day'])

        # Rolling features (4 per window)
        for window in self.time_windows:
            names.extend([f'rolling_mean_{window}m', f'rolling_std_{window}m', f'rolling_min_{window}m', f'rolling_max_{window}m'])

        # Lag features
        names.extend([f'lag_{lag}' for lag in [1, 5, 10, 20, 50]])

        # Trend features (6)
        names.extend(['slope', 'intercept', 'r_squared', 'trend_change', 'total_change', 'latest_change'])

        # Volatility features (4)
        names.extend(['volatility', 'mean_return', 'z_score_latest', 'positive_change_pct'])

        # Rate of change features (4)
        names.extend(['last_change', 'avg_change_2', 'avg_rate_of_change', 'mean_rate_of_change'])

        # Anomaly history features (8)
        names.extend(['recent_anomalies', 'anomaly_rate', 'time_since_last', 'cache_size', 'above_mean_count', 'value_std', 'mean_value', 'positive_value_count'])

        return names


class ModelManager:
    """Manages multiple ML models for anomaly detection"""

    def __init__(self, config: Dict):
        self.config = config
        self.models = {}
        self.model_metadata = {}
        self.scalers = {}
        self.feature_engineer = FeatureEngineer(config.get('feature_engineering', {}))
        self.model_directory = config.get('model_directory', '/app/models')
        self.training_lock = threading.Lock()

        # Create model directory if it doesn't exist
        os.makedirs(self.model_directory, exist_ok=True)

    def initialize_models(self, feature_names: List[str]):
        """Initialize all ML models"""
        logger.info("Initializing ML models")

        try:
            # Isolation Forest
            self.models['isolation_forest'] = IsolationForest(
                n_estimators=100,
                contamination=0.1,
                random_state=42,
                n_jobs=-1
            )
            self.model_metadata['isolation_forest'] = {
                'type': 'isolation_forest',
                'features_required': len(feature_names),
                'trained': False,
                'accuracy': 0.0
            }

            # LSTM Autoencoder
            self.models['lstm_autoencoder'] = self._create_lstm_model(len(feature_names))
            self.model_metadata['lstm_autoencoder'] = {
                'type': 'lstm_autoencoder',
                'features_required': len(feature_names),
                'sequence_length': 50,
                'trained': False,
                'accuracy': 0.0
            }

            # Random Forest
            self.models['random_forest'] = RandomForestClassifier(
                n_estimators=100,
                random_state=42,
                n_jobs=-1
            )
            self.model_metadata['random_forest'] = {
                'type': 'random_forest',
                'features_required': len(feature_names),
                'trained': False,
                'accuracy': 0.0
            }

            # Logistic Regression
            self.models['logistic_regression'] = LogisticRegression(
                random_state=42,
                max_iter=1000
            )
            self.model_metadata['logistic_regression'] = {
                'type': 'logistic_regression',
                'features_required': len(feature_names),
                'trained': False,
                'accuracy': 0.0
            }

            # Initialize scalers
            self.scalers['standard'] = StandardScaler()
            self.scalers['minmax'] = MinMaxScaler()

            # Load pre-trained models if available
            self._load_models()

            ACTIVE_MODELS.set(len(self.models))

            logger.info(f"Initialized {len(self.models)} ML models")

        except Exception as e:
            logger.error(f"Error initializing models: {e}")

    def _create_lstm_model(self, input_dim: int) -> tf.keras.Model:
        """Create LSTM autoencoder model"""
        sequence_length = 50
        encoding_dim = 16

        model = Sequential([
            LSTM(64, activation='relu', input_shape=(sequence_length, input_dim), return_sequences=True),
            LSTM(32, activation='relu', return_sequences=False),
            RepeatVector(sequence_length),
            LSTM(32, activation='relu', return_sequences=True),
            LSTM(64, activation='relu', return_sequences=True),
            TimeDistributed(Dense(input_dim))
        ])

        model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
        return model

    def _load_models(self):
        """Load pre-trained models from disk"""
        for model_name in list(self.models.keys()):
            model_path = os.path.join(self.model_directory, f"{model_name}.pkl")
            metadata_path = os.path.join(self.model_directory, f"{model_name}_metadata.json")
            scaler_path = os.path.join(self.model_directory, f"{model_name}_scaler.pkl")

            try:
                # Load model
                if model_name == 'lstm_autoencoder':
                    model_path = os.path.join(self.model_directory, f"{model_name}.h5")
                    self.models[model_name] = load_model(model_path)
                else:
                    self.models[model_name] = joblib.load(model_path)

                # Load metadata
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        self.model_metadata[model_name] = json.load(f)

                # Load scaler
                if os.path.exists(scaler_path):
                    self.scalers[model_name] = joblib.load(scaler_path)

                logger.info(f"Loaded pre-trained model: {model_name}")

            except Exception as e:
                logger.warning(f"Could not load model {model_name}: {e}")

    def save_model(self, model_name: str):
        """Save trained model to disk"""
        if model_name not in self.models:
            logger.error(f"Model {model_name} not found")
            return

        try:
            # Save model
            if model_name == 'lstm_autoencoder':
                model_path = os.path.join(self.model_directory, f"{model_name}.h5")
                self.models[model_name].save(model_path)
            else:
                model_path = os.path.join(self.model_directory, f"{model_name}.pkl")
                joblib.dump(self.models[model_name], model_path)

            # Save metadata
            metadata_path = os.path.join(self.model_directory, f"{model_name}_metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(self.model_metadata[model_name], f, indent=2)

            # Save scaler
            if model_name in self.scalers:
                scaler_path = os.path.join(self.model_directory, f"{model_name}_scaler.pkl")
                joblib.dump(self.scalers[model_name], scaler_path)

            logger.info(f"Saved model: {model_name}")

        except Exception as e:
            logger.error(f"Error saving model {model_name}: {e}")

    def train_models(self, training_data: Dict[str, List[Tuple]]) -> Dict[str, Dict]:
        """Train all models with provided data"""
        training_results = {}

        with self.training_lock:
            try:
                # Prepare training data
                all_features = []
                all_labels = []

                for metric_name, data in training_data.items():
                    # Generate synthetic labels for training (0 = normal, 1 = anomaly)
                    labels = self._generate_training_labels(data)

                    # Extract features for each data point
                    for i, (timestamp, value) in enumerate(data):
                        # Create temporary metrics data for feature extraction
                        temp_metrics = {metric_name: [(timestamp, value)]}
                        features = self.feature_engineer.extract_features(temp_metrics, metric_name)

                        if len(features) > 0:
                            all_features.append(features)
                            all_labels.append(labels[i])

                if len(all_features) == 0:
                    logger.error("No valid features extracted for training")
                    return training_results

                # Convert to numpy arrays
                X = np.array(all_features)
                y = np.array(all_labels)

                logger.info(f"Training with {len(X)} samples, {X.shape[1]} features")

                # Split data for evaluation
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42, stratify=y
                )

                # Train Isolation Forest
                training_results['isolation_forest'] = self._train_isolation_forest(
                    X_train, X_test, y_test
                )

                # Train Random Forest
                training_results['random_forest'] = self._train_random_forest(
                    X_train, X_test, y_test
                )

                # Train Logistic Regression
                training_results['logistic_regression'] = self._train_logistic_regression(
                    X_train, X_test, y_test
                )

                # Train LSTM Autoencoder (requires sequence data)
                training_results['lstm_autoencoder'] = self._train_lstm_autoencoder(
                    X_train, X_test, y_train, y_test
                )

                # Save trained models
                for model_name in self.models.keys():
                    if model_name in training_results and training_results[model_name]['success']:
                        self.save_model(model_name)

                logger.info("Model training completed")
                return training_results

            except Exception as e:
                logger.error(f"Error during model training: {e}")
                return training_results

    def _generate_training_labels(self, data: List[Tuple]) -> List[int]:
        """Generate training labels (synthetic for demonstration)"""
        labels = []

        for i, (timestamp, value) in enumerate(data):
            # Simple rule-based labeling for demonstration
            # In a real implementation, you would use actual anomaly labels
            if i > 0:
                prev_value = data[i-1][1]
                change_ratio = abs(value - prev_value) / prev_value if prev_value != 0 else 0

                # Label as anomaly if change is significant
                labels.append(1 if change_ratio > 0.5 else 0)
            else:
                labels.append(0)  # First point is normal

        return labels

    def _train_isolation_forest(self, X_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Train Isolation Forest model"""
        try:
            start_time = datetime.now()

            # Scale features
            X_train_scaled = self.scalers['standard'].fit_transform(X_train)
            X_test_scaled = self.scalers['standard'].transform(X_test)

            # Train model
            self.models['isolation_forest'].fit(X_train_scaled)

            # Predict on test set
            y_pred = self.models['isolation_forest'].predict(X_test_scaled)
            y_pred = (y_pred == -1).astype(int)  # Convert -1 to 1 (anomaly)

            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary', zero_division=0)

            training_time = (datetime.now() - start_time).total_seconds()
            MODEL_TRAINING_TIME.observe(training_time)

            self.model_metadata['isolation_forest'].update({
                'trained': True,
                'accuracy': accuracy,
                'training_time': training_time,
                'training_samples': len(X_train),
                'test_samples': len(X_test)
            })

            MODEL_ACCURACY.labels(model='isolation_forest').set(accuracy)

            return {
                'success': True,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'training_time': training_time
            }

        except Exception as e:
            logger.error(f"Error training Isolation Forest: {e}")
            return {'success': False, 'error': str(e)}

    def _train_random_forest(self, X_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Train Random Forest model"""
        try:
            start_time = datetime.now()

            # Scale features
            X_train_scaled = self.scalers['standard'].fit_transform(X_train)
            X_test_scaled = self.scalers['standard'].transform(X_test)

            # Train model
            self.models['random_forest'].fit(X_train_scaled, y_train)

            # Predict on test set
            y_pred = self.models['random_forest'].predict(X_test_scaled)

            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary', zero_division=0)

            training_time = (datetime.now() - start_time).total_seconds()
            MODEL_TRAINING_TIME.observe(training_time)

            self.model_metadata['random_forest'].update({
                'trained': True,
                'accuracy': accuracy,
                'training_time': training_time,
                'training_samples': len(X_train),
                'test_samples': len(X_test)
            })

            MODEL_ACCURACY.labels(model='random_forest').set(accuracy)

            return {
                'success': True,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'training_time': training_time
            }

        except Exception as e:
            logger.error(f"Error training Random Forest: {e}")
            return {'success': False, 'error': str(e)}

    def _train_logistic_regression(self, X_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Train Logistic Regression model"""
        try:
            start_time = datetime.now()

            # Scale features
            X_train_scaled = self.scalers['minmax'].fit_transform(X_train)
            X_test_scaled = self.scalers['minmax'].transform(X_test)

            # Train model
            self.models['logistic_regression'].fit(X_train_scaled, y_train)

            # Predict on test set
            y_pred = self.models['logistic_regression'].predict(X_test_scaled)

            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary', zero_division=0)

            training_time = (datetime.now() - start_time).total_seconds()
            MODEL_TRAINING_TIME.observe(training_time)

            self.model_metadata['logistic_regression'].update({
                'trained': True,
                'accuracy': accuracy,
                'training_time': training_time,
                'training_samples': len(X_train),
                'test_samples': len(X_test)
            })

            MODEL_ACCURACY.labels(model='logistic_regression').set(accuracy)

            return {
                'success': True,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'training_time': training_time
            }

        except Exception as e:
            logger.error(f"Error training Logistic Regression: {e}")
            return {'success': False, 'error': str(e)}

    def _train_lstm_autoencoder(self, X_train: np.ndarray, X_test: np.ndarray, y_train: np.ndarray, y_test: np.ndarray) -> Dict:
        """Train LSTM Autoencoder model"""
        try:
            start_time = datetime.now()

            # Scale features
            self.scalers['minmax'].fit(X_train)
            X_train_scaled = self.scalers['minmax'].transform(X_train)
            X_test_scaled = self.scalers['minmax'].transform(X_test)

            # Prepare sequences
            sequence_length = 50
            n_features = X_train_scaled.shape[1]

            X_train_sequences = self._create_sequences(X_train_scaled, sequence_length)
            X_test_sequences = self._create_sequences(X_test_scaled, sequence_length)

            if len(X_train_sequences) == 0:
                return {'success': False, 'error': 'Insufficient data for LSTM training'}

            # Train model
            callbacks = [
                EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True),
                ModelCheckpoint(
                    filepath=os.path.join(self.model_directory, 'lstm_autoencoder_best.h5'),
                    monitor='val_loss',
                    save_best_only=True
                )
            ]

            history = self.models['lstm_autoencoder'].fit(
                X_train_sequences, X_train_sequences,
                epochs=100,
                batch_size=32,
                validation_split=0.2,
                callbacks=callbacks,
                verbose=0
            )

            # Calculate reconstruction error
            X_pred = self.models['lstm_autoencoder'].predict(X_test_sequences)
            reconstruction_error = np.mean(np.square(X_test_sequences - X_pred), axis=(1, 2))

            # Determine threshold based on training error
            X_train_pred = self.models['lstm_autoencoder'].predict(X_train_sequences)
            train_error = np.mean(np.square(X_train_sequences - X_train_pred), axis=(1, 2))
            threshold = np.percentile(train_error, 95)

            # Predict anomalies
            y_pred = (reconstruction_error > threshold).astype(int)

            # Calculate metrics
            accuracy = accuracy_score(y_test, y_pred)
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary', zero_division=0)

            training_time = (datetime.now() - start_time).total_seconds()
            MODEL_TRAINING_TIME.observe(training_time)

            self.model_metadata['lstm_autoencoder'].update({
                'trained': True,
                'accuracy': accuracy,
                'threshold': threshold,
                'training_time': training_time,
                'training_samples': len(X_train_sequences),
                'test_samples': len(X_test_sequences)
            })

            MODEL_ACCURACY.labels(model='lstm_autoencoder').set(accuracy)

            return {
                'success': True,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'threshold': threshold,
                'training_time': training_time
            }

        except Exception as e:
            logger.error(f"Error training LSTM Autoencoder: {e}")
            return {'success': False, 'error': str(e)}

    def _create_sequences(self, data: np.ndarray, sequence_length: int) -> np.ndarray:
        """Create sequences for LSTM training"""
        sequences = []

        for i in range(len(data) - sequence_length + 1):
            sequences.append(data[i:i + sequence_length])

        return np.array(sequences)

    def predict_anomaly(self, features: np.ndarray, model_name: str = 'ensemble') -> Dict:
        """Predict anomaly using specified model"""
        if len(features) == 0:
            return {'anomaly': False, 'score': 0.0, 'error': 'No features provided'}

        try:
            if model_name == 'ensemble':
                # Use ensemble of all models
                predictions = []
                model_scores = []

                for name, model in self.models.items():
                    if self.model_metadata[name]['trained']:
                        pred = self._predict_single_model(features, name)
                        predictions.append(pred['anomaly'])
                        model_scores.append(pred['score'])

                # Ensemble decision (majority vote with confidence)
                anomaly_count = sum(predictions)
                avg_score = np.mean(model_scores)

                ensemble_result = {
                    'anomaly': anomaly_count > len(predictions) / 2,
                    'score': avg_score,
                    'confidence': abs(anomaly_count - len(predictions) / 2) / (len(predictions) / 2),
                    'model_votes': {name: pred['anomaly'] for name, pred in zip(self.models.keys(), predictions)},
                    'model_scores': {name: score for name, score in zip(self.models.keys(), model_scores)}
                }

                # Log detection
                if ensemble_result['anomaly']:
                    ANOMALY_DETECTIONS.labels(model='ensemble', severity='high').inc()

                return ensemble_result

            else:
                # Use specific model
                if model_name in self.models and self.model_metadata[model_name]['trained']:
                    result = self._predict_single_model(features, model_name)

                    if result['anomaly']:
                        severity = 'high' if result['score'] > 0.8 else 'medium'
                        ANOMALY_DETECTIONS.labels(model=model_name, severity=severity).inc()

                    return result
                else:
                    return {'anomaly': False, 'score': 0.0, 'error': f'Model {model_name} not trained'}

        except Exception as e:
            logger.error(f"Error predicting anomaly: {e}")
            return {'anomaly': False, 'score': 0.0, 'error': str(e)}

    def _predict_single_model(self, features: np.ndarray, model_name: str) -> Dict:
        """Predict anomaly using a single model"""
        try:
            if model_name == 'lstm_autoencoder':
                return self._predict_lstm(features)
            elif model_name in ['isolation_forest', 'random_forest', 'logistic_regression']:
                return self._predict_sklearn_model(features, model_name)
            else:
                return {'anomaly': False, 'score': 0.0, 'error': f'Unknown model: {model_name}'}

        except Exception as e:
            logger.error(f"Error predicting with {model_name}: {e}")
            return {'anomaly': False, 'score': 0.0, 'error': str(e)}

    def _predict_sklearn_model(self, features: np.ndarray, model_name: str) -> Dict:
        """Predict using sklearn model"""
        try:
            # Scale features
            scaler_name = 'standard' if model_name != 'logistic_regression' else 'minmax'
            features_scaled = self.scalers[scaler_name].transform(features.reshape(1, -1))

            if model_name == 'isolation_forest':
                # Isolation Forest returns -1 for anomalies
                prediction = self.models[model_name].predict(features_scaled)[0]
                anomaly = prediction == -1
                score = -prediction if anomaly else abs(prediction)  # Convert to anomaly score
            else:
                # Classification models
                prediction = self.models[model_name].predict(features_scaled)[0]
                probability = self.models[model_name].predict_proba(features_scaled)[0]
                anomaly = prediction == 1
                score = probability[1] if len(probability) > 1 else probability[0]

            return {
                'anomaly': anomaly,
                'score': float(score),
                'model': model_name,
                'probability': probability if model_name != 'isolation_forest' else None
            }

        except Exception as e:
            logger.error(f"Error predicting with sklearn model {model_name}: {e}")
            return {'anomaly': False, 'score': 0.0, 'error': str(e)}

    def _predict_lstm(self, features: np.ndarray) -> Dict:
        """Predict using LSTM autoencoder"""
        try:
            # Scale features
            features_scaled = self.scalers['minmax'].transform(features.reshape(1, -1))

            # Create sequence (use last value repeated)
            sequence_length = 50
            sequence = np.tile(features_scaled, (1, sequence_length, 1))

            # Predict
            reconstruction = self.models['lstm_autoencoder'].predict(sequence)
            reconstruction_error = np.mean(np.square(sequence - reconstruction))

            # Check if it's an anomaly
            threshold = self.model_metadata['lstm_autoencoder'].get('threshold', 0.1)
            anomaly = reconstruction_error > threshold

            return {
                'anomaly': anomaly,
                'score': float(reconstruction_error[0, 0]),
                'threshold': threshold,
                'model': 'lstm_autoencoder'
            }

        except Exception as e:
            logger.error(f"Error predicting with LSTM: {e}")
            return {'anomaly': False, 'score': 0.0, 'error': str(e)}

    def get_model_status(self) -> Dict:
        """Get status of all models"""
        status = {}

        for model_name, model in self.models.items():
            status[model_name] = {
                'loaded': True,
                'metadata': self.model_metadata.get(model_name, {}),
                'type': type(model).__name__
            }

        return status

    def retrain_model(self, model_name: str, training_data: Dict[str, List[Tuple]]) -> bool:
        """Retrain a specific model"""
        if model_name not in self.models:
            logger.error(f"Model {model_name} not found")
            return False

        try:
            logger.info(f"Retraining model: {model_name}")

            # Temporarily remove the model from the models dict
            temp_model = self.models.pop(model_name)
            temp_metadata = self.model_metadata.pop(model_name)

            # Re-initialize and train the model
            if model_name == 'isolation_forest':
                self.models[model_name] = IsolationForest(
                    n_estimators=100,
                    contamination=0.1,
                    random_state=42,
                    n_jobs=-1
                )
            elif model_name == 'random_forest':
                self.models[model_name] = RandomForestClassifier(
                    n_estimators=100,
                    random_state=42,
                    n_jobs=-1
                )
            elif model_name == 'logistic_regression':
                self.models[model_name] = LogisticRegression(
                    random_state=42,
                    max_iter=1000
                )
            elif model_name == 'lstm_autoencoder':
                feature_names = self.feature_engineer.get_feature_names()
                self.models[model_name] = self._create_lstm_model(len(feature_names))

            # Train the model
            training_results = self.train_models(training_data)

            # Update metadata
            if model_name in training_results and training_results[model_name]['success']:
                self.model_metadata[model_name] = temp_metadata
                self.model_metadata[model_name]['trained'] = True
                self.model_metadata[model_name]['accuracy'] = training_results[model_name]['accuracy']
                self.model_metadata[model_name]['last_retrained'] = datetime.utcnow().isoformat()

                logger.info(f"Successfully retrained model: {model_name}")
                return True
            else:
                # Restore original model if training failed
                self.models[model_name] = temp_model
                self.model_metadata[model_name] = temp_metadata
                logger.error(f"Failed to retrain model {model_name}")
                return False

        except Exception as e:
            logger.error(f"Error retraining model {model_name}: {e}")
            return False


# Main ML Anomaly Detection System
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI(
    title="ML Anomaly Detection API",
    description="Advanced ML-based anomaly detection system",
    version="1.0.0"
)

model_manager = None
anomaly_history = defaultdict(list)

class AnomalyDetectionRequest(BaseModel):
    metric_name: str
    metrics_data: Dict[str, List[Tuple]]
    model_name: str = "ensemble"

class AnomalyDetectionResponse(BaseModel):
    success: bool
    result: Optional[Dict] = None
    message: str
    timestamp: str

class ModelStatusResponse(BaseModel):
    success: bool
    models: Dict = None
    message: str
    timestamp: str

@app.on_event("startup")
async def startup_event():
    global model_manager
    config = {
        'model_directory': '/app/models',
        'feature_engineering': {
            'time_windows': [5, 15, 30, 60]
        }
    }

    model_manager = ModelManager(config)

    # Initialize models with feature names
    feature_engineer = FeatureEngineer(config.get('feature_engineering', {}))
    feature_names = feature_engineer.get_feature_names()
    model_manager.initialize_models(feature_names)

    # Start Prometheus metrics server
    start_http_server(8081)

    logger.info("ML Anomaly Detection System started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/ready")
async def ready_check():
    """Ready check endpoint"""
    try:
        if model_manager:
            return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}
        else:
            return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}
    except Exception:
        return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}

@app.post("/detect", response_model=AnomalyDetectionResponse)
async def detect_anomaly(request: AnomalyDetectionRequest):
    """Detect anomalies using ML models"""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not initialized")

    try:
        # Extract features
        features = model_manager.feature_engineer.extract_features(
            request.metrics_data,
            request.metric_name
        )

        if len(features) == 0:
            return AnomalyDetectionResponse(
                success=False,
                result=None,
                message="No features extracted",
                timestamp=datetime.utcnow().isoformat()
            )

        # Predict anomaly
        result = model_manager.predict_anomaly(features, request.model_name)

        # Store in history
        anomaly_history[request.metric_name].append({
            'timestamp': datetime.utcnow().isoformat(),
            'result': result,
            'model_used': request.model_name
        })

        # Keep only last 100 entries per metric
        if len(anomaly_history[request.metric_name]) > 100:
            anomaly_history[request.metric_name] = anomaly_history[request.metric_name][-100:]

        return AnomalyDetectionResponse(
            success=True,
            result=result,
            message="Anomaly detection completed",
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models/status", response_model=ModelStatusResponse)
async def get_model_status():
    """Get status of all ML models"""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not initialized")

    try:
        status = model_manager.get_model_status()

        return ModelStatusResponse(
            success=True,
            models=status,
            message=f"Retrieved status for {len(status)} models",
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to get model status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/train")
async def train_models(background_tasks: BackgroundTasks):
    """Train ML models with historical data"""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not initialized")

    try:
        # Start training in background
        background_tasks.add_task(
            train_models_background_task
        )

        return {
            "success": True,
            "message": "Model training started in background",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to start model training: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/retrain/{model_name}")
async def retrain_model(model_name: str, background_tasks: BackgroundTasks):
    """Retrain a specific ML model"""
    if not model_manager:
        raise HTTPException(status_code=503, detail="Model manager not initialized")

    try:
        # Generate synthetic training data for demonstration
        training_data = generate_synthetic_training_data()

        # Start retraining in background
        background_tasks.add_task(
            retrain_model_background_task,
            model_name,
            training_data
        )

        return {
            "success": True,
            "message": f"Model {model_name} retraining started",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to start model retraining: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{metric_name}")
async def get_anomaly_history(metric_name: str, limit: int = 50):
    """Get anomaly detection history for a metric"""
    try:
        history = anomaly_history.get(metric_name, [])

        return {
            "success": True,
            "metric_name": metric_name,
            "history": history[-limit:] if len(history) > limit else history,
            "total_entries": len(history),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get anomaly history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Get internal metrics"""
    return {
        "anomaly_detections_total": ANOMALY_DETECTIONS._value.get(),
        "model_accuracy": MODEL_ACCURACY._value.get(),
        "active_models": ACTIVE_MODELS._value.get()
    }


def generate_synthetic_training_data() -> Dict[str, List[Tuple]]:
    """Generate synthetic training data for demonstration"""
    import random

    metrics = ['cpu_usage', 'memory_usage', 'network_in', 'network_out']
    training_data = {}

    for metric in metrics:
        data = []
        base_value = random.uniform(20, 80)

        # Generate 1000 data points over 1 hour
        for i in range(1000):
            timestamp = datetime.now() - timedelta(hours=1) + timedelta(minutes=i * 0.06)

            # Add some variation
            value = base_value + random.gauss(0, 10)

            # Occasionally add anomalies
            if random.random() < 0.05:  # 5% anomaly rate
                value = base_value + random.choice([random.uniform(30, 100), random.uniform(-50, -20)])

            data.append((timestamp, max(0, value)))
            base_value = value * 0.9 + random.gauss(0, 5)  # Slight trend

        training_data[metric] = data

    return training_data


async def train_models_background_task():
    """Background task to train models"""
    try:
        logger.info("Starting model training background task")

        training_data = generate_synthetic_training_data()
        results = model_manager.train_models(training_data)

        logger.info(f"Background model training completed: {results}")

    except Exception as e:
        logger.error(f"Background model training failed: {e}")


async def retrain_model_background_task(model_name: str, training_data: Dict[str, List[Tuple]]):
    """Background task to retrain a specific model"""
    try:
        logger.info(f"Starting retraining task for model: {model_name}")

        success = model_manager.retrain_model(model_name, training_data)

        if success:
            logger.info(f"Successfully retrained model: {model_name}")
        else:
            logger.error(f"Failed to retrain model: {model_name}")

    except Exception as e:
        logger.error(f"Model retraining task failed: {e}")


if __name__ == "__main__":
    uvicorn.run(
        "ml_anomaly_detection_advanced:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )
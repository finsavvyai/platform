#!/usr/bin/env python3
"""
Statistical Anomaly Detection System for QuantumBeam Production
Implements various statistical algorithms to detect anomalies in time series data
"""

import asyncio
import json
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import aiohttp
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, start_http_server
from scipy import stats
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus Metrics
ANOMALIES_DETECTED = Counter('statistical_anomalies_detected_total', 'Total statistical anomalies detected', ['algorithm', 'metric'])
ANOMALY_ALERTS_SENT = Counter('statistical_anomaly_alerts_sent_total', 'Total anomaly alerts sent', ['severity'])
DETECTION_LATENCY = Histogram('statistical_detection_duration_seconds', 'Anomaly detection processing time')
ACTIVE_MODELS = Gauge('statistical_active_models', 'Number of active statistical models')

@dataclass
class Anomaly:
    """Anomaly detection result"""
    timestamp: datetime
    metric_name: str
    current_value: float
    expected_value: float
    anomaly_score: float
    severity: str  # 'low', 'medium', 'high', 'critical'
    algorithm: str
    threshold: float
    confidence: float
    context: Dict[str, Any] = None

    def __post_init__(self):
        if self.context is None:
            self.context = {}

@dataclass
class StatisticalModel:
    """Statistical model configuration"""
    name: str
    algorithm: str  # 'zscore', 'iqr', 'ewma', 'moving_average', 'seasonal_decompose'
    metric_name: str
    parameters: Dict[str, Any]
    thresholds: Dict[str, float]
    sensitivity: float  # 0.0 to 1.0
    window_size: int
    training_data: deque = None
    is_trained: bool = False
    last_updated: datetime = None

    def __post_init__(self):
        if self.training_data is None:
            self.training_data = deque(maxlen=self.window_size)

class StatisticalAnomalyDetector:
    """Statistical Anomaly Detection Engine"""

    def __init__(self, redis_url: str, prometheus_url: str):
        self.redis_url = redis_url
        self.prometheus_url = prometheus_url
        self.redis_client: Optional[redis.Redis] = None
        self.session: Optional[aiohttp.ClientSession] = None

        # Active models
        self.models: Dict[str, StatisticalModel] = {}

        # Configuration
        self.config = self._load_default_config()

        # Alert thresholds
        self.alert_thresholds = {
            'low': 0.7,
            'medium': 0.8,
            'high': 0.9,
            'critical': 0.95
        }

    async def start(self):
        """Start the anomaly detection engine"""
        logger.info("Starting Statistical Anomaly Detection Engine")

        # Initialize Redis
        self.redis_client = redis.from_url(self.redis_url)

        # Initialize HTTP session
        self.session = aiohttp.ClientSession()

        # Load existing models
        await self._load_models()

        # Start background tasks
        asyncio.create_task(self._model_training_task())
        asyncio.create_task(self._detection_task())
        asyncio.create_task(self._cleanup_task())

        # Start metrics server
        start_http_server(9096)

        logger.info("Statistical Anomaly Detection Engine started successfully")

    async def stop(self):
        """Stop the anomaly detection engine"""
        logger.info("Stopping Statistical Anomaly Detection Engine")

        if self.session:
            await self.session.close()
        if self.redis_client:
            await self.redis_client.close()

    def _load_default_config(self) -> Dict:
        """Load default configuration"""
        return {
            'default_window_size': 100,
            'default_sensitivity': 0.8,
            'training_interval_minutes': 60,
            'detection_interval_seconds': 30,
            'model_retention_days': 30,
            'alert_cooldown_minutes': 15
        }

    async def _load_models(self):
        """Load anomaly detection models from Redis"""
        try:
            model_keys = await self.redis_client.keys("anomaly:model:*")

            for key in model_keys:
                model_data = await self.redis_client.get(key)
                if model_data:
                    model_dict = json.loads(model_data.decode())

                    # Reconstruct deque from list
                    if 'training_data' in model_dict and model_dict['training_data']:
                        model_dict['training_data'] = deque(
                            model_dict['training_data'],
                            maxlen=model_dict['window_size']
                        )

                    model = StatisticalModel(**model_dict)
                    self.models[model.name] = model

            ACTIVE_MODELS.set(len(self.models))
            logger.info(f"Loaded {len(self.models)} anomaly detection models")

        except Exception as e:
            logger.error(f"Error loading models from Redis: {e}")

    async def save_model(self, model: StatisticalModel):
        """Save model to Redis"""
        try:
            model_dict = asdict(model)
            # Convert deque to list for JSON serialization
            if model_dict['training_data']:
                model_dict['training_data'] = list(model_dict['training_data'])

            model_dict['last_updated'] = datetime.utcnow().isoformat()

            await self.redis_client.set(
                f"anomaly:model:{model.name}",
                json.dumps(model_dict)
            )

            # Set expiration
            await self.redis_client.expire(
                f"anomaly:model:{model.name}",
                self.config['model_retention_days'] * 24 * 3600
            )

        except Exception as e:
            logger.error(f"Error saving model {model.name}: {e}")

    async def create_model(self, model_config: Dict) -> StatisticalModel:
        """Create a new anomaly detection model"""
        model = StatisticalModel(
            name=model_config['name'],
            algorithm=model_config['algorithm'],
            metric_name=model_config['metric_name'],
            parameters=model_config.get('parameters', {}),
            thresholds=model_config.get('thresholds', {}),
            sensitivity=model_config.get('sensitivity', self.config['default_sensitivity']),
            window_size=model_config.get('window_size', self.config['default_window_size'])
        )

        self.models[model.name] = model
        await self.save_model(model)
        ACTIVE_MODELS.set(len(self.models))

        logger.info(f"Created new model: {model.name} using {model.algorithm} algorithm")
        return model

    @DETECTION_LATENCY.time()
    async def detect_anomalies(self, metric_name: str, value: float, timestamp: datetime = None) -> List[Anomaly]:
        """Detect anomalies for a given metric value"""
        if timestamp is None:
            timestamp = datetime.utcnow()

        anomalies = []

        for model in self.models.values():
            if model.metric_name != metric_name or not model.is_trained:
                continue

            try:
                anomaly = await self._detect_anomaly_with_model(model, value, timestamp)
                if anomaly:
                    anomalies.append(anomaly)
                    ANOMALIES_DETECTED.labels(algorithm=model.algorithm, metric=metric_name).inc()

            except Exception as e:
                logger.error(f"Error detecting anomaly with model {model.name}: {e}")

        return anomalies

    async def _detect_anomaly_with_model(self, model: StatisticalModel, value: float, timestamp: datetime) -> Optional[Anomaly]:
        """Detect anomaly using specific model"""
        anomaly_score = 0.0
        expected_value = 0.0

        if model.algorithm == 'zscore':
            anomaly_score, expected_value = self._detect_zscore_anomaly(model, value)
        elif model.algorithm == 'iqr':
            anomaly_score, expected_value = self._detect_iqr_anomaly(model, value)
        elif model.algorithm == 'ewma':
            anomaly_score, expected_value = self._detect_ewma_anomaly(model, value)
        elif model.algorithm == 'moving_average':
            anomaly_score, expected_value = self._detect_moving_average_anomaly(model, value)
        elif model.algorithm == 'seasonal_decompose':
            anomaly_score, expected_value = self._detect_seasonal_anomaly(model, value, timestamp)
        else:
            logger.warning(f"Unknown algorithm: {model.algorithm}")
            return None

        # Apply sensitivity threshold
        if anomaly_score < model.sensitivity:
            return None

        # Determine severity
        severity = self._calculate_severity(anomaly_score, model.sensitivity)

        # Check alert cooldown
        if await self._is_in_alert_cooldown(model.name, metric_name):
            return None

        # Update last alert time
        await self._update_alert_cooldown(model.name, metric_name)

        return Anomaly(
            timestamp=timestamp,
            metric_name=model.metric_name,
            current_value=value,
            expected_value=expected_value,
            anomaly_score=anomaly_score,
            severity=severity,
            algorithm=model.algorithm,
            threshold=model.sensitivity,
            confidence=self._calculate_confidence(anomaly_score, model),
            context={
                'model_name': model.name,
                'window_size': len(model.training_data),
                'model_parameters': model.parameters
            }
        )

    def _detect_zscore_anomaly(self, model: StatisticalModel, value: float) -> Tuple[float, float]:
        """Detect anomaly using Z-score method"""
        if len(model.training_data) < 10:
            return 0.0, 0.0

        data_array = np.array(list(model.training_data))
        mean = np.mean(data_array)
        std = np.std(data_array)

        if std == 0:
            return 0.0, mean

        zscore = abs((value - mean) / std)
        # Convert Z-score to 0-1 range (3-sigma rule)
        anomaly_score = min(zscore / 3.0, 1.0)

        return anomaly_score, mean

    def _detect_iqr_anomaly(self, model: StatisticalModel, value: float) -> Tuple[float, float]:
        """Detect anomaly using Interquartile Range method"""
        if len(model.training_data) < 4:
            return 0.0, 0.0

        data_array = np.array(list(model.training_data))
        q1 = np.percentile(data_array, 25)
        q3 = np.percentile(data_array, 75)
        iqr = q3 - q1

        if iqr == 0:
            return 0.0, np.median(data_array)

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        if value < lower_bound:
            anomaly_score = abs((lower_bound - value) / iqr)
        elif value > upper_bound:
            anomaly_score = abs((value - upper_bound) / iqr)
        else:
            anomaly_score = 0.0

        # Convert to 0-1 range
        anomaly_score = min(anomaly_score / 3.0, 1.0)
        expected_value = (q1 + q3) / 2

        return anomaly_score, expected_value

    def _detect_ewma_anomaly(self, model: StatisticalModel, value: float) -> Tuple[float, float]:
        """Detect anomaly using Exponentially Weighted Moving Average"""
        alpha = model.parameters.get('alpha', 0.2)

        if len(model.training_data) < 5:
            return 0.0, value

        # Calculate EWMA
        ewma = list(model.training_data)[-1]
        for val in list(model.training_data)[-5:]:
            ewma = alpha * val + (1 - alpha) * ewma

        # Calculate deviation
        deviation = abs(value - ewma)

        # Estimate standard deviation from recent data
        recent_data = np.array(list(model.training_data)[-10:])
        if len(recent_data) > 1:
            std = np.std(recent_data)
            if std > 0:
                anomaly_score = min(deviation / (2 * std), 1.0)
            else:
                anomaly_score = 0.0
        else:
            anomaly_score = 0.0

        return anomaly_score, ewma

    def _detect_moving_average_anomaly(self, model: StatisticalModel, value: float) -> Tuple[float, float]:
        """Detect anomaly using Moving Average method"""
        window = model.parameters.get('ma_window', 20)

        if len(model.training_data) < window:
            return 0.0, value

        recent_data = list(model.training_data)[-window:]
        moving_avg = np.mean(recent_data)
        moving_std = np.std(recent_data)

        if moving_std == 0:
            return 0.0, moving_avg

        zscore = abs((value - moving_avg) / moving_std)
        anomaly_score = min(zscore / 3.0, 1.0)

        return anomaly_score, moving_avg

    def _detect_seasonal_anomaly(self, model: StatisticalModel, value: float, timestamp: datetime) -> Tuple[float, float]:
        """Detect anomaly using Seasonal Decomposition"""
        # Simplified seasonal detection (hourly pattern)
        if len(model.training_data) < 24 * 7:  # Need at least one week of hourly data
            return 0.0, value

        # Get historical values for same hour of day
        hour_of_day = timestamp.hour
        day_of_week = timestamp.weekday()

        historical_values = []
        # Look back at training data for similar patterns
        for i, hist_val in enumerate(model.training_data):
            # Assuming hourly data, calculate corresponding hour
            hist_hour = (len(model.training_data) - i) % 24
            if hist_hour == hour_of_day:
                historical_values.append(hist_val)

        if len(historical_values) < 3:
            return 0.0, value

        # Calculate expected value and deviation
        expected_value = np.mean(historical_values)
        std = np.std(historical_values)

        if std == 0:
            return 0.0, expected_value

        zscore = abs((value - expected_value) / std)
        anomaly_score = min(zscore / 2.5, 1.0)  # More lenient for seasonal patterns

        return anomaly_score, expected_value

    def _calculate_severity(self, anomaly_score: float, sensitivity: float) -> str:
        """Calculate anomaly severity"""
        adjusted_score = anomaly_score * (1.0 - sensitivity) + sensitivity

        if adjusted_score >= self.alert_thresholds['critical']:
            return 'critical'
        elif adjusted_score >= self.alert_thresholds['high']:
            return 'high'
        elif adjusted_score >= self.alert_thresholds['medium']:
            return 'medium'
        else:
            return 'low'

    def _calculate_confidence(self, anomaly_score: float, model: StatisticalModel) -> float:
        """Calculate confidence in anomaly detection"""
        # Higher confidence with more data and higher anomaly scores
        data_factor = min(len(model.training_data) / model.window_size, 1.0)
        score_factor = anomaly_score

        confidence = (data_factor * 0.6) + (score_factor * 0.4)
        return min(confidence, 1.0)

    async def _is_in_alert_cooldown(self, model_name: str, metric_name: str) -> bool:
        """Check if metric is in alert cooldown period"""
        cooldown_key = f"anomaly:cooldown:{model_name}:{metric_name}"
        return await self.redis_client.exists(cooldown_key) > 0

    async def _update_alert_cooldown(self, model_name: str, metric_name: str):
        """Update alert cooldown"""
        cooldown_key = f"anomaly:cooldown:{model_name}:{metric_name}"
        cooldown_seconds = self.config['alert_cooldown_minutes'] * 60

        await self.redis_client.setex(cooldown_key, cooldown_seconds, "1")

    async def _model_training_task(self):
        """Background task to train models"""
        while True:
            try:
                await asyncio.sleep(self.config['training_interval_minutes'] * 60)

                for model in self.models.values():
                    try:
                        await self._train_model(model)
                    except Exception as e:
                        logger.error(f"Error training model {model.name}: {e}")

            except Exception as e:
                logger.error(f"Error in model training task: {e}")

    async def _train_model(self, model: StatisticalModel):
        """Train a statistical model with recent data"""
        # Get recent data from Prometheus
        recent_data = await self._get_metric_data(model.metric_name, model.window_size)

        if len(recent_data) < model.window_size:
            logger.warning(f"Insufficient data for model {model.name}: {len(recent_data)} < {model.window_size}")
            return

        # Update training data
        for value in recent_data:
            model.training_data.append(value)

        model.is_trained = True
        model.last_updated = datetime.utcnow()

        await self.save_model(model)
        logger.info(f"Trained model {model.name} with {len(model.training_data)} data points")

    async def _get_metric_data(self, metric_name: str, count: int) -> List[float]:
        """Get recent metric data from Prometheus"""
        try:
            # Build Prometheus query
            query = f'rate({metric_name}[1m])'
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=count)

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
                    values = []

                    if 'data' in data and 'result' in data['data']:
                        for result in data['data']['result']:
                            for value in result.get('values', []):
                                if len(value) >= 2:
                                    values.append(float(value[1]))

                    return values[-count:] if len(values) > count else values
                else:
                    logger.error(f"Failed to get metric data: {response.status}")
                    return []

        except Exception as e:
            logger.error(f"Error getting metric data from Prometheus: {e}")
            return []

    async def _detection_task(self):
        """Background task to run anomaly detection"""
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
                                await self._handle_anomaly(anomaly)

                    except Exception as e:
                        logger.error(f"Error processing metric {metric_name}: {e}")

            except Exception as e:
                logger.error(f"Error in detection task: {e}")

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

    async def _handle_anomaly(self, anomaly: Anomaly):
        """Handle detected anomaly"""
        # Send alert
        await self._send_anomaly_alert(anomaly)
        ANOMALY_ALERTS_SENT.labels(severity=anomaly.severity).inc()

        # Store anomaly in Redis
        anomaly_data = {
            'timestamp': anomaly.timestamp.isoformat(),
            'metric_name': anomaly.metric_name,
            'current_value': anomaly.current_value,
            'expected_value': anomaly.expected_value,
            'anomaly_score': anomaly.anomaly_score,
            'severity': anomaly.severity,
            'algorithm': anomaly.algorithm,
            'threshold': anomaly.threshold,
            'confidence': anomaly.confidence,
            'context': anomaly.context
        }

        await self.redis_client.lpush(
            f"anomaly:recent:{anomaly.metric_name}",
            json.dumps(anomaly_data)
        )

        # Keep only last 100 anomalies per metric
        await self.redis_client.ltrim(f"anomaly:recent:{anomaly.metric_name}", 0, 100)

        logger.warning(f"Anomaly detected: {anomaly.metric_name} = {anomaly.current_value} "
                      f"(expected: {anomaly.expected_value:.2f}, score: {anomaly.anomaly_score:.2f}, "
                      f"severity: {anomaly.severity}, algorithm: {anomaly.algorithm})")

    async def _send_anomaly_alert(self, anomaly: Anomaly):
        """Send anomaly alert to external systems"""
        alert_data = {
            'alertname': f'StatisticalAnomaly_{anomaly.metric_name}',
            'severity': anomaly.severity,
            'instance': 'statistical-detector',
            'metric_name': anomaly.metric_name,
            'current_value': anomaly.current_value,
            'expected_value': anomaly.expected_value,
            'anomaly_score': anomaly.anomaly_score,
            'algorithm': anomaly.algorithm,
            'confidence': anomaly.confidence,
            'timestamp': anomaly.timestamp.isoformat(),
            'description': f'Statistical anomaly detected in {anomaly.metric_name}: '
                           f'current={anomaly.current_value:.2f}, expected={anomaly.expected_value:.2f}, '
                           f'score={anomaly.anomaly_score:.2f}',
            'annotations': {
                'summary': f'Statistical Anomaly: {anomaly.metric_name}',
                'description': f'Current value {anomaly.current_value:.2f} deviates from expected {anomaly.expected_value:.2f}',
                'runbook_url': 'https://kb.quantumbeam.io/anomaly-detection',
                'severity': anomaly.severity
            }
        }

        # Send to AlertManager via webhook
        try:
            webhook_url = os.getenv('ALERTMANAGER_WEBHOOK_URL', 'http://alertmanager:9093/api/v1/alerts')

            async with self.session.post(webhook_url, json=[alert_data]) as response:
                if response.status != 200:
                    logger.error(f"Failed to send anomaly alert to AlertManager: {response.status}")

        except Exception as e:
            logger.error(f"Error sending anomaly alert: {e}")

    async def _cleanup_task(self):
        """Background task to cleanup old data"""
        while True:
            try:
                await asyncio.sleep(24 * 3600)  # Run daily

                # Clean up old anomalies
                for model in self.models.values():
                    # Remove old anomalies from Redis
                    pattern = f"anomaly:recent:{model.metric_name}"
                    await self.redis_client.ltrim(pattern, 0, 100)

                logger.info("Completed anomaly data cleanup")

            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def get_anomaly_summary(self, hours: int = 24) -> Dict:
        """Get anomaly summary for specified time period"""
        summary = {
            'total_anomalies': 0,
            'by_severity': defaultdict(int),
            'by_algorithm': defaultdict(int),
            'by_metric': defaultdict(int),
            'recent_anomalies': []
        }

        try:
            # Get recent anomalies from all metrics
            for model in self.models.values():
                anomaly_data = await self.redis_client.lrange(
                    f"anomaly:recent:{model.metric_name}", 0, 50
                )

                for data in anomaly_data:
                    anomaly = json.loads(data.decode())
                    timestamp = datetime.fromisoformat(anomaly['timestamp'])

                    if datetime.utcnow() - timestamp <= timedelta(hours=hours):
                        summary['total_anomalies'] += 1
                        summary['by_severity'][anomaly['severity']] += 1
                        summary['by_algorithm'][anomaly['algorithm']] += 1
                        summary['by_metric'][anomaly['metric_name']] += 1

                        if len(summary['recent_anomalies']) < 20:
                            summary['recent_anomalies'].append(anomaly)

        except Exception as e:
            logger.error(f"Error getting anomaly summary: {e}")

        return summary

    async def get_model_status(self) -> Dict:
        """Get status of all anomaly detection models"""
        status = {
            'total_models': len(self.models),
            'trained_models': sum(1 for m in self.models.values() if m.is_trained),
            'models': {}
        }

        for name, model in self.models.items():
            status['models'][name] = {
                'algorithm': model.algorithm,
                'metric_name': model.metric_name,
                'is_trained': model.is_trained,
                'window_size': model.window_size,
                'current_window_size': len(model.training_data),
                'sensitivity': model.sensitivity,
                'last_updated': model.last_updated.isoformat() if model.last_updated else None,
                'parameters': model.parameters
            }

        return status

# API Server for Statistical Anomaly Detection
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

app = FastAPI(title="Statistical Anomaly Detection API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global anomaly detector
anomaly_detector: Optional[StatisticalAnomalyDetector] = None

class ModelConfig(BaseModel):
    name: str
    algorithm: str  # 'zscore', 'iqr', 'ewma', 'moving_average', 'seasonal_decompose'
    metric_name: str
    parameters: Dict[str, Any] = {}
    thresholds: Dict[str, float] = {}
    sensitivity: float = 0.8
    window_size: int = 100

class AnomalyRequest(BaseModel):
    metric_name: str
    value: float
    timestamp: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    global anomaly_detector
    # Configuration from environment variables
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")

    anomaly_detector = StatisticalAnomalyDetector(redis_url, prometheus_url)
    await anomaly_detector.start()

@app.on_event("shutdown")
async def shutdown_event():
    global anomaly_detector
    if anomaly_detector:
        await anomaly_detector.stop()

@app.post("/models")
async def create_model(config: ModelConfig):
    """Create a new anomaly detection model"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    try:
        model = await anomaly_detector.create_model(config.dict())
        return {"message": f"Model {config.name} created successfully", "model": model.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create model: {str(e)}")

@app.post("/detect")
async def detect_anomalies(request: AnomalyRequest):
    """Detect anomalies for a metric value"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    timestamp = None
    if request.timestamp:
        timestamp = datetime.fromisoformat(request.timestamp)

    anomalies = await anomaly_detector.detect_anomalies(request.metric_name, request.value, timestamp)

    return {
        "anomalies": [
            {
                "timestamp": anomaly.timestamp.isoformat(),
                "metric_name": anomaly.metric_name,
                "current_value": anomaly.current_value,
                "expected_value": anomaly.expected_value,
                "anomaly_score": anomaly.anomaly_score,
                "severity": anomaly.severity,
                "algorithm": anomaly.algorithm,
                "threshold": anomaly.threshold,
                "confidence": anomaly.confidence,
                "context": anomaly.context
            }
            for anomaly in anomalies
        ]
    }

@app.get("/models")
async def list_models():
    """List all anomaly detection models"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    status = await anomaly_detector.get_model_status()
    return status

@app.get("/models/{model_name}")
async def get_model(model_name: str):
    """Get details of a specific model"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    if model_name not in anomaly_detector.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

    model = anomaly_detector.models[model_name]
    return {
        "name": model.name,
        "algorithm": model.algorithm,
        "metric_name": model.metric_name,
        "parameters": model.parameters,
        "thresholds": model.thresholds,
        "sensitivity": model.sensitivity,
        "window_size": model.window_size,
        "is_trained": model.is_trained,
        "current_window_size": len(model.training_data),
        "last_updated": model.last_updated.isoformat() if model.last_updated else None
    }

@app.delete("/models/{model_name}")
async def delete_model(model_name: str):
    """Delete an anomaly detection model"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    if model_name not in anomaly_detector.models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")

    del anomaly_detector.models[model_name]

    # Remove from Redis
    await anomaly_detector.redis_client.delete(f"anomaly:model:{model_name}")
    ACTIVE_MODELS.set(len(anomaly_detector.models))

    return {"message": f"Model {model_name} deleted successfully"}

@app.get("/summary")
async def get_anomaly_summary(hours: int = 24):
    """Get anomaly summary"""
    if not anomaly_detector:
        raise HTTPException(status_code=503, detail="Anomaly detector not available")

    summary = await anomaly_detector.get_anomaly_summary(hours)
    return summary

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    import os

    uvicorn.run(
        "statistical_anomaly_detection:app",
        host="0.0.0.0",
        port=8081,
        reload=False
    )
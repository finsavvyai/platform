"""
Advanced Analytics & Intelligence Service
AI-powered analytics, predictive intelligence, and advanced monitoring
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from uuid import UUID, uuid4
from enum import Enum
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.cluster import KMeans
from scipy import stats
import plotly.graph_objects as go
import plotly.express as px

from app.core.config import get_settings
from app.core.database import get_db
from app.models.advanced_analytics import (
    AnalyticsMetric, AnomalyDetection, PredictiveModel,
    IntelligenceReport, InsightPattern, PerformanceForecast
)
from app.services.multi_cloud_service import multi_cloud_service
from app.services.cloudflare_service import CloudflareService

logger = logging.getLogger(__name__)

class MetricType(str, Enum):
    """Analytics metric types"""
    PERFORMANCE = "performance"
    COST = "cost"
    SECURITY = "security"
    AVAILABILITY = "availability"
    USER_BEHAVIOR = "user_behavior"
    BUSINESS = "business"
    OPERATIONAL = "operational"

class AnalysisType(str, Enum):
    """Analysis types"""
    TREND = "trend"
    ANOMALY = "anomaly"
    PREDICTION = "prediction"
    CORRELATION = "correlation"
    CLUSTERING = "clustering"
    SENTIMENT = "sentiment"

class AnomalySeverity(str, Enum):
    """Anomaly severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class IntelligenceType(str, Enum):
    """Intelligence report types"""
    PERFORMANCE_INSIGHT = "performance_insight"
    COST_OPTIMIZATION = "cost_optimization"
    SECURITY_THREAT = "security_threat"
    CAPACITY_PLANNING = "capacity_planning"
    USER_ENGAGEMENT = "user_engagement"
    BUSINESS_IMPACT = "business_impact"

class AdvancedAnalyticsService:
    """Advanced analytics and intelligence service"""

    def __init__(self):
        self.settings = get_settings()
        self.ml_models = {}
        self.scalers = {}
        self.cache = {}
        self.background_tasks = []

    async def collect_metrics(
        self,
        metric_type: MetricType,
        time_range: str = "24h",
        providers: Optional[List[str]] = None,
        resources: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Collect metrics from multiple sources for analysis

        Args:
            metric_type: Type of metrics to collect
            time_range: Time range for data collection
            providers: Specific providers to include
            resources: Specific resources to include

        Returns:
            Collected metrics data
        """
        try:
            # Parse time range
            end_time = datetime.now(timezone.utc)
            start_time = self._parse_time_range(time_range, end_time)

            metrics_data = {
                "metric_type": metric_type,
                "time_range": time_range,
                "start_time": start_time,
                "end_time": end_time,
                "data_sources": []
            }

            # Collect from multi-cloud providers
            if metric_type in [MetricType.PERFORMANCE, MetricType.COST, MetricType.AVAILABILITY]:
                cloud_metrics = await self._collect_cloud_metrics(
                    metric_type, start_time, end_time, providers, resources
                )
                metrics_data["data_sources"].append(cloud_metrics)

            # Collect from application logs
            if metric_type in [MetricType.USER_BEHAVIOR, MetricType.OPERATIONAL]:
                app_metrics = await self._collect_application_metrics(
                    metric_type, start_time, end_time
                )
                metrics_data["data_sources"].append(app_metrics)

            # Collect from business systems
            if metric_type in [MetricType.BUSINESS]:
                business_metrics = await self._collect_business_metrics(
                    metric_type, start_time, end_time
                )
                metrics_data["data_sources"].append(business_metrics)

            # Collect from security systems
            if metric_type in [MetricType.SECURITY]:
                security_metrics = await self._collect_security_metrics(
                    start_time, end_time
                )
                metrics_data["data_sources"].append(security_metrics)

            return metrics_data

        except Exception as e:
            logger.error(f"Failed to collect metrics for {metric_type}: {str(e)}")
            raise

    async def _collect_cloud_metrics(
        self,
        metric_type: MetricType,
        start_time: datetime,
        end_time: datetime,
        providers: Optional[List[str]] = None,
        resources: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Collect metrics from cloud providers"""
        try:
            metrics = {
                "source": "multi_cloud",
                "providers": {},
                "aggregated_metrics": {}
            }

            # Get all cloud resources
            cloud_resources = await multi_cloud_service.list_resources(
                provider_id=None,
                resource_type=None,
                tenant_id=None
            )

            # Group by provider
            provider_groups = {}
            for resource in cloud_resources:
                if providers and resource['provider_id'] not in providers:
                    continue
                if resources and resource['id'] not in resources:
                    continue

                provider_id = resource['provider_id']
                if provider_id not in provider_groups:
                    provider_groups[provider_id] = []
                provider_groups[provider_id].append(resource)

            # Collect metrics for each provider
            for provider_id, provider_resources in provider_groups.items():
                provider_metrics = {
                    "provider_id": provider_id,
                    "resources": {},
                    "summary": {}
                }

                total_cost = 0
                active_resources = 0
                healthy_resources = 0

                for resource in provider_resources:
                    resource_metrics = {
                        "resource_id": resource['id'],
                        "name": resource['name'],
                        "type": resource['type'],
                        "status": resource['status'],
                        "health_status": resource['health_status'],
                        "metrics": {}
                    }

                    # Get detailed metrics for this resource
                    try:
                        detailed_metrics = await multi_cloud_service.get_resource_metrics(
                            resource['id'],
                            "1h",  # 1 hour granularity
                            self._get_default_metrics_for_type(resource['type'])
                        )
                        resource_metrics["metrics"] = detailed_metrics
                    except Exception as e:
                        logger.warning(f"Failed to get metrics for resource {resource['id']}: {str(e)}")

                    # Update summary statistics
                    if resource.get('cost_monthly'):
                        total_cost += resource['cost_monthly']
                    if resource['status'] == 'active':
                        active_resources += 1
                    if resource['health_status'] == 'healthy':
                        healthy_resources += 1

                    provider_metrics["resources"][resource['id']] = resource_metrics

                # Provider summary
                provider_metrics["summary"] = {
                    "total_resources": len(provider_resources),
                    "active_resources": active_resources,
                    "healthy_resources": healthy_resources,
                    "total_monthly_cost": total_cost,
                    "health_percentage": (healthy_resources / len(provider_resources)) * 100 if provider_resources else 0
                }

                metrics["providers"][provider_id] = provider_metrics

            # Calculate aggregated metrics across all providers
            all_resources = []
            total_monthly_cost = 0
            total_active = 0
            total_healthy = 0

            for provider_data in metrics["providers"].values():
                all_resources.extend(provider_data["resources"].values())
                total_monthly_cost += provider_data["summary"]["total_monthly_cost"]
                total_active += provider_data["summary"]["active_resources"]
                total_healthy += provider_data["summary"]["healthy_resources"]

            metrics["aggregated_metrics"] = {
                "total_resources": len(all_resources),
                "total_active_resources": total_active,
                "total_healthy_resources": total_healthy,
                "total_monthly_cost": total_monthly_cost,
                "overall_health_percentage": (total_healthy / len(all_resources)) * 100 if all_resources else 0,
                "resource_type_distribution": self._calculate_resource_distribution(all_resources),
                "status_distribution": self._calculate_status_distribution(all_resources)
            }

            return metrics

        except Exception as e:
            logger.error(f"Failed to collect cloud metrics: {str(e)}")
            raise

    async def _collect_application_metrics(
        self,
        metric_type: MetricType,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, Any]:
        """Collect metrics from application logs and monitoring"""
        # This would integrate with application monitoring systems
        return {
            "source": "application",
            "user_sessions": 1250,
            "active_users": 340,
            "page_views": 8900,
            "error_rate": 0.02,
            "avg_response_time": 145,
            "throughput": 125
        }

    async def _collect_business_metrics(
        self,
        metric_type: MetricType,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, Any]:
        """Collect business metrics"""
        # This would integrate with business intelligence systems
        return {
            "source": "business",
            "revenue": 125000,
            "conversion_rate": 0.035,
            "customer_satisfaction": 4.6,
            "churn_rate": 0.012,
            "lifetime_value": 5600
        }

    async def _collect_security_metrics(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, Any]:
        """Collect security metrics"""
        # This would integrate with security monitoring systems
        return {
            "source": "security",
            "security_events": 45,
            "blocked_threats": 23,
            "vulnerabilities": 12,
            "compliance_score": 92
        }

    def _get_default_metrics_for_type(self, resource_type: str) -> List[str]:
        """Get default metrics for a resource type"""
        metrics_map = {
            'compute': ['cpu_utilization', 'memory_utilization', 'network_in', 'network_out'],
            'storage': ['bucket_size', 'object_count', 'request_count', 'latency'],
            'database': ['cpu_utilization', 'memory_utilization', 'connections', 'read_iops', 'write_iops'],
            'network': ['bandwidth_in', 'bandwidth_out', 'packet_loss', 'latency'],
            'serverless': ['invocations', 'duration', 'errors', 'throttles']
        }
        return metrics_map.get(resource_type, ['availability'])

    def _calculate_resource_distribution(self, resources: List[Dict]) -> Dict[str, int]:
        """Calculate distribution by resource type"""
        distribution = {}
        for resource in resources:
            resource_type = resource.get('type', 'unknown')
            distribution[resource_type] = distribution.get(resource_type, 0) + 1
        return distribution

    def _calculate_status_distribution(self, resources: List[Dict]) -> Dict[str, int]:
        """Calculate distribution by status"""
        distribution = {}
        for resource in resources:
            status = resource.get('status', 'unknown')
            distribution[status] = distribution.get(status, 0) + 1
        return distribution

    async def detect_anomalies(
        self,
        metrics_data: Dict[str, Any],
        sensitivity: float = 0.1,
        analysis_window: str = "7d"
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies in metrics data using machine learning

        Args:
            metrics_data: Metrics data to analyze
            sensitivity: Anomaly detection sensitivity (0.0 to 1.0)
            analysis_window: Time window for baseline calculation

        Returns:
            List of detected anomalies
        """
        try:
            anomalies = []

            # Get historical data for baseline
            historical_data = await self._get_historical_metrics(
                metrics_data['metric_type'],
                analysis_window
            )

            # Prepare data for anomaly detection
            current_data = self._prepare_anomaly_data(metrics_data, historical_data)

            if not current_data:
                return anomalies

            # Train or load anomaly detection model
            model = await self._get_or_train_anomaly_model(
                metrics_data['metric_type'],
                historical_data
            )

            # Detect anomalies
            anomaly_predictions = model.predict(current_data)

            # Process and categorize anomalies
            for i, (data_point, is_anomaly) in enumerate(zip(current_data, anomaly_predictions)):
                if is_anomaly == -1:  # -1 indicates anomaly in IsolationForest
                    anomaly = {
                        "id": str(uuid4()),
                        "timestamp": data_point.get('timestamp', datetime.now(timezone.utc)),
                        "metric_type": metrics_data['metric_type'],
                        "metric_name": data_point.get('metric_name', 'unknown'),
                        "value": data_point.get('value', 0),
                        "baseline": data_point.get('baseline', 0),
                        "severity": self._calculate_anomaly_severity(
                            data_point.get('value', 0),
                            data_point.get('baseline', 0),
                            sensitivity
                        ),
                        "confidence": min(abs(model.decision_function([data_point])[0]), 3),
                        "context": data_point.get('context', {}),
                        "detected_at": datetime.now(timezone.utc)
                    }
                    anomalies.append(anomaly)

            # Store anomalies in database
            await self._store_anomalies(anomalies)

            return anomalies

        except Exception as e:
            logger.error(f"Failed to detect anomalies: {str(e)}")
            raise

    async def _get_historical_metrics(
        self,
        metric_type: MetricType,
        time_range: str
    ) -> pd.DataFrame:
        """Get historical metrics for baseline calculation"""
        try:
            # This would query the database for historical metrics
            # For now, return sample data
            dates = pd.date_range(
                end=datetime.now(timezone.utc),
                periods=30,  # 30 days of data
                freq='H'
            )

            # Generate sample historical data based on metric type
            if metric_type == MetricType.PERFORMANCE:
                data = {
                    'timestamp': dates,
                    'cpu_utilization': np.random.normal(45, 15, len(dates)),
                    'memory_utilization': np.random.normal(60, 20, len(dates)),
                    'response_time': np.random.normal(150, 50, len(dates))
                }
            elif metric_type == MetricType.COST:
                data = {
                    'timestamp': dates,
                    'daily_cost': np.random.normal(500, 100, len(dates)),
                    'resource_count': np.random.normal(45, 10, len(dates))
                }
            else:
                data = {'timestamp': dates, 'value': np.random.normal(100, 30, len(dates))}

            return pd.DataFrame(data)

        except Exception as e:
            logger.error(f"Failed to get historical metrics: {str(e)}")
            return pd.DataFrame()

    def _prepare_anomaly_data(
        self,
        metrics_data: Dict[str, Any],
        historical_data: pd.DataFrame
    ) -> List[Dict]:
        """Prepare data for anomaly detection"""
        prepared_data = []

        # Extract current metrics from metrics_data
        if 'aggregated_metrics' in metrics_data:
            agg_metrics = metrics_data['aggregated_metrics']

            # Create data points for each metric
            current_time = datetime.now(timezone.utc)

            if 'total_monthly_cost' in agg_metrics:
                baseline_cost = historical_data['daily_cost'].mean() if 'daily_cost' in historical_data.columns else agg_metrics['total_monthly_cost']
                prepared_data.append({
                    'timestamp': current_time,
                    'metric_name': 'total_monthly_cost',
                    'value': agg_metrics['total_monthly_cost'],
                    'baseline': baseline_cost,
                    'context': {'metric_type': 'cost'}
                })

            if 'overall_health_percentage' in agg_metrics:
                baseline_health = historical_data['cpu_utilization'].mean() if 'cpu_utilization' in historical_data.columns else agg_metrics['overall_health_percentage']
                prepared_data.append({
                    'timestamp': current_time,
                    'metric_name': 'overall_health_percentage',
                    'value': agg_metrics['overall_health_percentage'],
                    'baseline': baseline_health,
                    'context': {'metric_type': 'performance'}
                })

        return prepared_data

    async def _get_or_train_anomaly_model(
        self,
        metric_type: MetricType,
        historical_data: pd.DataFrame
    ) -> IsolationForest:
        """Get existing or train new anomaly detection model"""
        model_key = f"anomaly_{metric_type}"

        if model_key in self.ml_models:
            return self.ml_models[model_key]

        # Train new model
        if historical_data.empty:
            # Create default model
            model = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100
            )
        else:
            # Prepare features for training
            feature_cols = [col for col in historical_data.columns if col != 'timestamp' and historical_data[col].dtype in ['float64', 'int64']]

            if feature_cols:
                X = historical_data[feature_cols].fillna(0)

                # Standardize features
                scaler_key = f"scaler_{metric_type}"
                if scaler_key not in self.scalers:
                    self.scalers[scaler_key] = StandardScaler()
                    X_scaled = self.scalers[scaler_key].fit_transform(X)
                else:
                    X_scaled = self.scalers[scaler_key].transform(X)

                # Train model
                model = IsolationForest(
                    contamination=0.1,
                    random_state=42,
                    n_estimators=100
                )
                model.fit(X_scaled)
            else:
                model = IsolationForest(
                    contamination=0.1,
                    random_state=42,
                    n_estimators=100
                )

        self.ml_models[model_key] = model
        return model

    def _calculate_anomaly_severity(
        self,
        current_value: float,
        baseline: float,
        sensitivity: float
    ) -> AnomalySeverity:
        """Calculate anomaly severity based on deviation"""
        if baseline == 0:
            return AnomalySeverity.MEDIUM

        deviation_percentage = abs((current_value - baseline) / baseline) * 100

        if deviation_percentage > 50:
            return AnomalySeverity.CRITICAL
        elif deviation_percentage > 30:
            return AnomalySeverity.HIGH
        elif deviation_percentage > 15:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW

    async def _store_anomalies(self, anomalies: List[Dict[str, Any]]) -> None:
        """Store detected anomalies in database"""
        try:
            async with get_db_session() as db:
                for anomaly_data in anomalies:
                    anomaly = AnomalyDetection(
                        id=UUID(anomaly_data['id']),
                        tenant_id=UUID("default-tenant-id"),  # Would get from context
                        metric_type=anomaly_data['metric_type'],
                        metric_name=anomaly_data['metric_name'],
                        timestamp=anomaly_data['timestamp'],
                        value=anomaly_data['value'],
                        baseline=anomaly_data['baseline'],
                        severity=anomaly_data['severity'],
                        confidence=anomaly_data['confidence'],
                        context=anomaly_data['context'],
                        detected_at=anomaly_data['detected_at'],
                        status="active"
                    )
                    db.add(anomaly)

                db.commit()
                logger.info(f"Stored {len(anomalies)} anomalies in database")

        except Exception as e:
            logger.error(f"Failed to store anomalies: {str(e)}")

    async def generate_predictions(
        self,
        metric_type: MetricType,
        prediction_horizon: str = "7d",
        confidence_threshold: float = 0.8
    ) -> Dict[str, Any]:
        """
        Generate predictions using machine learning models

        Args:
            metric_type: Type of metric to predict
            prediction_horizon: How far to predict into the future
            confidence_threshold: Minimum confidence for predictions

        Returns:
            Prediction results with confidence intervals
        """
        try:
            predictions = {
                "metric_type": metric_type,
                "prediction_horizon": prediction_horizon,
                "generated_at": datetime.now(timezone.utc),
                "predictions": [],
                "model_performance": {}
            }

            # Get historical data for training
            historical_data = await self._get_historical_metrics(metric_type, "30d")

            if historical_data.empty:
                return predictions

            # Train prediction model
            model, scaler, performance = await self._train_prediction_model(
                metric_type, historical_data
            )

            predictions["model_performance"] = performance

            # Generate predictions
            future_predictions = self._generate_future_predictions(
                model, scaler, historical_data, prediction_horizon
            )

            predictions["predictions"] = future_predictions

            # Store predictions in database
            await self._store_predictions(predictions)

            return predictions

        except Exception as e:
            logger.error(f"Failed to generate predictions: {str(e)}")
            raise

    async def _train_prediction_model(
        self,
        metric_type: MetricType,
        data: pd.DataFrame
    ) -> Tuple[Any, Any, Dict]:
        """Train prediction model for the given metric type"""
        try:
            # Prepare features
            feature_cols = [col for col in data.columns if col != 'timestamp' and data[col].dtype in ['float64', 'int64']]

            if len(feature_cols) < 2:
                # Not enough features for meaningful prediction
                return None, None, {"mae": 0, "rmse": 0, "r2": 0}

            # Create time-based features
            data['hour'] = pd.to_datetime(data['timestamp']).dt.hour
            data['day_of_week'] = pd.to_datetime(data['timestamp']).dt.dayofweek
            data['day_of_month'] = pd.to_datetime(data['timestamp']).dt.day
            data['month'] = pd.to_datetime(data['timestamp']).dt.month

            # Select target variable
            target_col = feature_cols[0]  # Use first numeric column as target
            feature_cols = [col for col in data.columns if col != target_col and col != 'timestamp']

            X = data[feature_cols].fillna(0)
            y = data[target_col].fillna(0)

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )

            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)

            # Train model
            model = RandomForestRegressor(
                n_estimators=100,
                random_state=42,
                max_depth=10
            )
            model.fit(X_train_scaled, y_train)

            # Evaluate model
            y_pred = model.predict(X_test_scaled)

            performance = {
                "mae": mean_absolute_error(y_test, y_pred),
                "rmse": np.sqrt(mean_squared_error(y_test, y_pred)),
                "r2": model.score(X_test_scaled, y_test),
                "samples_trained": len(X_train)
            }

            return model, scaler, performance

        except Exception as e:
            logger.error(f"Failed to train prediction model: {str(e)}")
            return None, None, {"mae": 0, "rmse": 0, "r2": 0}

    def _generate_future_predictions(
        self,
        model: Any,
        scaler: Any,
        historical_data: pd.DataFrame,
        prediction_horizon: str
    ) -> List[Dict]:
        """Generate future predictions using the trained model"""
        try:
            if model is None:
                return []

            # Parse prediction horizon
            horizon_days = int(prediction_horizon[:-1]) if prediction_horizon.endswith('d') else 7
            predictions_per_day = 24  # Hourly predictions

            total_predictions = horizon_days * predictions_per_day
            future_predictions = []

            # Get the last known timestamp
            last_timestamp = pd.to_datetime(historical_data['timestamp']).iloc[-1]

            # Generate future timestamps
            for i in range(total_predictions):
                future_time = last_timestamp + timedelta(hours=i+1)

                # Create features for prediction
                hour = future_time.hour
                day_of_week = future_time.weekday()
                day_of_month = future_time.day
                month = future_time.month

                # Use the last known values for other features
                last_values = {}
                for col in historical_data.columns:
                    if col != 'timestamp' and historical_data[col].dtype in ['float64', 'int64']:
                        last_values[col] = historical_data[col].iloc[-1]

                # Prepare feature vector
                feature_vector = [
                    hour, day_of_week, day_of_month, month
                ] + list(last_values.values())

                # Make prediction
                if len(feature_vector) > 0:
                    try:
                        feature_array = np.array(feature_vector).reshape(1, -1)

                        # Scale features if scaler exists
                        if scaler:
                            # Pad or truncate feature array to match scaler dimensions
                            if feature_array.shape[1] != scaler.n_features_in_:
                                # Pad with zeros or truncate
                                if feature_array.shape[1] < scaler.n_features_in_:
                                    padding = np.zeros((1, scaler.n_features_in_ - feature_array.shape[1]))
                                    feature_array = np.hstack([feature_array, padding])
                                else:
                                    feature_array = feature_array[:, :scaler.n_features_in_]

                            feature_array_scaled = scaler.transform(feature_array)
                            prediction = model.predict(feature_array_scaled)[0]
                        else:
                            prediction = model.predict(feature_array)[0]

                        future_predictions.append({
                            "timestamp": future_time,
                            "predicted_value": float(prediction),
                            "confidence": 0.85,  # Would calculate actual confidence
                            "features_used": feature_vector[:4]  # Time-based features
                        })
                    except Exception as e:
                        logger.warning(f"Failed to make prediction for {future_time}: {str(e)}")

            return future_predictions

        except Exception as e:
            logger.error(f"Failed to generate future predictions: {str(e)}")
            return []

    async def _store_predictions(self, predictions: Dict[str, Any]) -> None:
        """Store predictions in database"""
        try:
            async with get_db_session() as db:
                for prediction_data in predictions["predictions"]:
                    forecast = PerformanceForecast(
                        id=str(uuid4()),
                        tenant_id=UUID("default-tenant-id"),
                        metric_type=predictions["metric_type"],
                        timestamp=prediction_data["timestamp"],
                        predicted_value=prediction_data["predicted_value"],
                        confidence=prediction_data["confidence"],
                        model_version="1.0",
                        prediction_horizon=predictions["prediction_horizon"],
                        created_at=predictions["generated_at"]
                    )
                    db.add(forecast)

                db.commit()
                logger.info(f"Stored {len(predictions['predictions'])} predictions in database")

        except Exception as e:
            logger.error(f"Failed to store predictions: {str(e)}")

    async def generate_intelligence_report(
        self,
        report_type: IntelligenceType,
        time_range: str = "7d",
        include_recommendations: bool = True
    ) -> Dict[str, Any]:
        """
        Generate comprehensive intelligence report

        Args:
            report_type: Type of intelligence report
            time_range: Time range for analysis
            include_recommendations: Whether to include actionable recommendations

        Returns:
            Comprehensive intelligence report
        """
        try:
            report = {
                "id": str(uuid4()),
                "report_type": report_type,
                "time_range": time_range,
                "generated_at": datetime.now(timezone.utc),
                "executive_summary": {},
                "key_insights": [],
                "recommendations": [],
                "detailed_analysis": {},
                "charts": [],
                "appendix": {}
            }

            # Collect relevant metrics
            if report_type == IntelligenceType.PERFORMANCE_INSIGHT:
                metrics_data = await self.collect_metrics(MetricType.PERFORMANCE, time_range)
                anomalies = await self.detect_anomalies(metrics_data)
                predictions = await self.generate_predictions(MetricType.PERFORMANCE, "7d")

                report["executive_summary"] = {
                    "overall_health": self._calculate_overall_health(metrics_data),
                    "active_anomalies": len(anomalies),
                    "performance_trend": self._calculate_performance_trend(metrics_data),
                    "prediction_confidence": predictions.get("model_performance", {}).get("r2", 0)
                }

                report["key_insights"] = self._extract_performance_insights(
                    metrics_data, anomalies, predictions
                )

                if include_recommendations:
                    report["recommendations"] = await self._generate_performance_recommendations(
                        metrics_data, anomalies
                    )

                report["detailed_analysis"] = {
                    "metrics_breakdown": metrics_data,
                    "anomaly_analysis": anomalies,
                    "prediction_analysis": predictions
                }

            elif report_type == IntelligenceType.COST_OPTIMIZATION:
                cost_metrics = await self.collect_metrics(MetricType.COST, time_range)
                cost_anomalies = await self.detect_anomalies(cost_metrics)
                cost_predictions = await self.generate_predictions(MetricType.COST, "7d")

                report["executive_summary"] = {
                    "total_monthly_cost": cost_metrics.get("aggregated_metrics", {}).get("total_monthly_cost", 0),
                    "cost_trend": self._calculate_cost_trend(cost_metrics),
                    "optimization_opportunities": len(cost_anomalies),
                    "predicted_savings": self._calculate_potential_savings(cost_anomalies)
                }

                report["key_insights"] = self._extract_cost_insights(
                    cost_metrics, cost_anomalies, cost_predictions
                )

                if include_recommendations:
                    report["recommendations"] = await self._generate_cost_recommendations(
                        cost_metrics, cost_anomalies
                    )

            # Generate charts
            report["charts"] = await self._generate_report_charts(report_type, report["detailed_analysis"])

            # Store report in database
            await self._store_intelligence_report(report)

            return report

        except Exception as e:
            logger.error(f"Failed to generate intelligence report: {str(e)}")
            raise

    def _calculate_overall_health(self, metrics_data: Dict) -> float:
        """Calculate overall health score"""
        try:
            agg_metrics = metrics_data.get("aggregated_metrics", {})
            health_percentage = agg_metrics.get("overall_health_percentage", 0)
            return min(health_percentage, 100)
        except:
            return 0

    def _calculate_performance_trend(self, metrics_data: Dict) -> str:
        """Calculate performance trend"""
        # Simplified trend calculation
        return "stable"  # Would implement actual trend analysis

    def _extract_performance_insights(
        self,
        metrics_data: Dict,
        anomalies: List[Dict],
        predictions: Dict
    ) -> List[Dict]:
        """Extract key performance insights"""
        insights = []

        # Add anomaly insights
        if anomalies:
            critical_anomalies = [a for a in anomalies if a['severity'] == AnomalySeverity.CRITICAL]
            if critical_anomalies:
                insights.append({
                    "type": "anomaly",
                    "severity": "critical",
                    "title": f"Critical anomalies detected",
                    "description": f"{len(critical_anomalies)} critical performance anomalies detected",
                    "impact": "high"
                })

        # Add prediction insights
        if predictions.get("model_performance", {}).get("r2", 0) > 0.8:
            insights.append({
                "type": "prediction",
                "severity": "info",
                "title": "High prediction accuracy",
                "description": f"Performance predictions have {predictions['model_performance']['r2']:.2f} R² score",
                "impact": "positive"
            })

        return insights

    async def _generate_performance_recommendations(
        self,
        metrics_data: Dict,
        anomalies: List[Dict]
    ) -> List[Dict]:
        """Generate performance optimization recommendations"""
        recommendations = []

        # Analyze resource utilization
        agg_metrics = metrics_data.get("aggregated_metrics", {})
        health_percentage = agg_metrics.get("overall_health_percentage", 0)

        if health_percentage < 80:
            recommendations.append({
                "category": "optimization",
                "priority": "high",
                "title": "Improve resource health",
                "description": "Overall resource health is below optimal levels",
                "actions": [
                    "Review underperforming resources",
                    "Implement health checks",
                    "Scale underutilized resources"
                ],
                "estimated_impact": "Improve overall system reliability by 15-25%"
            })

        # Analyze cost anomalies
        cost_anomalies = [a for a in anomalies if a['metric_type'] == MetricType.COST]
        if cost_anomalies:
            recommendations.append({
                "category": "cost",
                "priority": "medium",
                "title": "Optimize cost anomalies",
                "description": f"{len(cost_anomalies)} cost anomalies detected",
                "actions": [
                    "Review resource scaling policies",
                    "Implement cost alerts",
                    "Consider reserved instances"
                ],
                "estimated_impact": "Reduce monthly costs by 10-20%"
            })

        return recommendations

    async def _store_intelligence_report(self, report: Dict) -> None:
        """Store intelligence report in database"""
        try:
            async with get_db_session() as db:
                intelligence_report = IntelligenceReport(
                    id=UUID(report["id"]),
                    tenant_id=UUID("default-tenant-id"),
                    report_type=report["report_type"],
                    time_range=report["time_range"],
                    executive_summary=report["executive_summary"],
                    key_insights=report["key_insights"],
                    recommendations=report["recommendations"],
                    detailed_analysis=report["detailed_analysis"],
                    charts=report["charts"],
                    generated_at=report["generated_at"]
                )
                db.add(intelligence_report)
                db.commit()
                logger.info(f"Stored intelligence report {report['id']} in database")

        except Exception as e:
            logger.error(f"Failed to store intelligence report: {str(e)}")

    async def _generate_report_charts(self, report_type: IntelligenceType, analysis_data: Dict) -> List[Dict]:
        """Generate charts for the intelligence report"""
        charts = []

        try:
            if report_type == IntelligenceType.PERFORMANCE_INSIGHT:
                # Performance trend chart
                charts.append({
                    "type": "line",
                    "title": "Performance Trend",
                    "data": self._create_performance_trend_chart(analysis_data)
                })

                # Resource health distribution
                charts.append({
                    "type": "pie",
                    "title": "Resource Health Distribution",
                    "data": self._create_health_distribution_chart(analysis_data)
                })

            elif report_type == IntelligenceType.COST_OPTIMIZATION:
                # Cost trend chart
                charts.append({
                    "type": "line",
                    "title": "Cost Trend",
                    "data": self._create_cost_trend_chart(analysis_data)
                })

                # Cost breakdown chart
                charts.append({
                    "type": "bar",
                    "title": "Cost by Resource Type",
                    "data": self._create_cost_breakdown_chart(analysis_data)
                })

        except Exception as e:
            logger.error(f"Failed to generate charts: {str(e)}")

        return charts

    def _create_performance_trend_chart(self, analysis_data: Dict) -> Dict:
        """Create performance trend chart data"""
        return {
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "datasets": [
                {
                    "label": "CPU Utilization",
                    "data": [65, 70, 62, 75, 68, 71, 69],
                    "borderColor": "#3b82f6",
                    "backgroundColor": "rgba(59, 130, 246, 0.1)"
                },
                {
                    "label": "Memory Utilization",
                    "data": [72, 68, 75, 70, 73, 69, 74],
                    "borderColor": "#10b981",
                    "backgroundColor": "rgba(16, 185, 129, 0.1)"
                }
            ]
        }

    def _create_health_distribution_chart(self, analysis_data: Dict) -> Dict:
        """Create health distribution pie chart"""
        return {
            "labels": ["Healthy", "Warning", "Critical"],
            "datasets": [{
                "data": [75, 20, 5],
                "backgroundColor": ["#10b981", "#f59e0b", "#ef4444"]
            }]
        }

    def _create_cost_trend_chart(self, analysis_data: Dict) -> Dict:
        """Create cost trend chart data"""
        return {
            "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            "datasets": [{
                "label": "Monthly Cost",
                "data": [12000, 13500, 12800, 14200, 13800, 14500],
                "borderColor": "#8b5cf6",
                "backgroundColor": "rgba(139, 92, 246, 0.1)"
            }]
        }

    def _create_cost_breakdown_chart(self, analysis_data: Dict) -> Dict:
        """Create cost breakdown chart data"""
        return {
            "labels": ["Compute", "Storage", "Network", "Database", "Other"],
            "datasets": [{
                "label": "Monthly Cost",
                "data": [8500, 2200, 1800, 1200, 800],
                "backgroundColor": ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
            }]
        }

    def _parse_time_range(self, time_range: str, end_time: datetime) -> datetime:
        """Parse time range string to start time"""
        if time_range.endswith('h'):
            hours = int(time_range[:-1])
            return end_time - timedelta(hours=hours)
        elif time_range.endswith('d'):
            days = int(time_range[:-1])
            return end_time - timedelta(days=days)
        elif time_range.endswith('w'):
            weeks = int(time_range[:-1])
            return end_time - timedelta(weeks=weeks)
        else:
            # Default to 24 hours
            return end_time - timedelta(hours=24)

# Global service instance
advanced_analytics_service = AdvancedAnalyticsService()
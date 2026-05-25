#!/usr/bin/env python3
"""
Capacity Planning System for QuantumBeam
Automated capacity monitoring, forecasting, and optimization recommendations
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

import aiohttp
import numpy as np
import pandas as pd
import yaml
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
CAPACITY_CHECKS = Counter('capacity_planning_checks_total', 'Total capacity checks', ['result'])
FORECAST_ACCURACY = Histogram('capacity_forecast_accuracy_mae', 'Forecast accuracy (MAE)')
RESOURCE_UTILIZATION = Gauge('resource_utilization_percent', 'Current resource utilization', ['resource', 'namespace'])
CAPACITY_ALERTS = Counter('capacity_alerts_total', 'Total capacity alerts', ['severity'])


class CapacityMetricsCollector:
    """Collects capacity metrics from Prometheus and other sources"""

    def __init__(self, prometheus_url: str):
        self.prometheus_url = prometheus_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def query_prometheus(self, query: str) -> Dict:
        """Execute Prometheus query and return results"""
        try:
            url = f"{self.prometheus_url}/api/v1/query"
            params = {'query': query}

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    logger.error(f"Prometheus query failed: {response.status}")
                    return {}
        except Exception as e:
            logger.error(f"Error querying Prometheus: {e}")
            return {}

    async def get_resource_metrics(self, namespace: str = "production") -> Dict:
        """Collect current resource utilization metrics"""
        metrics = {
            'cpu': {},
            'memory': {},
            'storage': {},
            'network': {}
        }

        try:
            # CPU utilization
            cpu_query = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{namespace}"}}[5m])) by (pod)'
            cpu_data = await self.query_prometheus(cpu_query)
            if cpu_data.get('data', {}).get('result'):
                for item in cpu_data['data']['result']:
                    pod = item['metric']['pod']
                    value = float(item['value'][1])
                    metrics['cpu'][pod] = value

            # Memory utilization
            memory_query = f'sum(container_memory_working_set_bytes{{namespace="{namespace}"}}) by (pod) / 1024 / 1024'  # MB
            memory_data = await self.query_prometheus(memory_query)
            if memory_data.get('data', {}).get('result'):
                for item in memory_data['data']['result']:
                    pod = item['metric']['pod']
                    value = float(item['value'][1])
                    metrics['memory'][pod] = value

            # Storage utilization
            storage_query = f'sum(kubelet_volume_stats_used_bytes{{namespace="{namespace}"}}) by (persistentvolumeclaim) / 1024 / 1024 / 1024'  # GB
            storage_data = await self.query_prometheus(storage_query)
            if storage_data.get('data', {}).get('result'):
                for item in storage_data['data']['result']:
                    pvc = item['metric']['persistentvolumeclaim']
                    value = float(item['value'][1])
                    metrics['storage'][pvc] = value

            # Network metrics
            network_tx_query = f'sum(rate(container_network_transmit_bytes_total{{namespace="{namespace}"}}[5m])) by (pod)'
            network_rx_query = f'sum(rate(container_network_receive_bytes_total{{namespace="{namespace}"}}[5m])) by (pod)'

            network_tx_data = await self.query_prometheus(network_tx_query)
            network_rx_data = await self.query_prometheus(network_rx_query)

            if network_tx_data.get('data', {}).get('result') and network_rx_data.get('data', {}).get('result'):
                for item in network_tx_data['data']['result']:
                    pod = item['metric']['pod']
                    tx_value = float(item['value'][1])
                    rx_value = 0.0

                    # Find corresponding RX value
                    for rx_item in network_rx_data['data']['result']:
                        if rx_item['metric']['pod'] == pod:
                            rx_value = float(rx_item['value'][1])
                            break

                    metrics['network'][pod] = {'tx': tx_value, 'rx': rx_value}

        except Exception as e:
            logger.error(f"Error collecting resource metrics: {e}")

        return metrics

    async def get_business_metrics(self) -> Dict:
        """Collect business-related metrics"""
        metrics = {}

        try:
            # Transaction volume
            tx_query = 'sum(rate(transaction_requests_total[5m]))'
            tx_data = await self.query_prometheus(tx_query)
            if tx_data.get('data', {}).get('result'):
                metrics['transaction_rate'] = float(tx_data['data']['result'][0]['value'][1])

            # Active users
            users_query = 'sum(active_users_total)'
            users_data = await self.query_prometheus(users_query)
            if users_data.get('data', {}).get('result'):
                metrics['active_users'] = float(users_data['data']['result'][0]['value'][1])

            # Fraud detection rate
            fraud_query = 'sum(rate(fraud_detection_requests_total[5m]))'
            fraud_data = await self.query_prometheus(fraud_query)
            if fraud_data.get('data', {}).get('result'):
                metrics['fraud_detection_rate'] = float(fraud_data['data']['result'][0]['value'][1])

        except Exception as e:
            logger.error(f"Error collecting business metrics: {e}")

        return metrics

    async def get_historical_data(self, query: str, hours: int = 168) -> List[Tuple]:
        """Get historical time series data"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)

            url = f"{self.prometheus_url}/api/v1/query_range"
            params = {
                'query': query,
                'start': start_time.timestamp(),
                'end': end_time.timestamp(),
                'step': '300'  # 5-minute intervals
            }

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []

                    for item in data.get('data', {}).get('result', []):
                        for timestamp, value in item['values']:
                            results.append((datetime.fromtimestamp(float(timestamp)), float(value)))

                    return sorted(results)
                else:
                    logger.error(f"Historical query failed: {response.status}")
                    return []

        except Exception as e:
            logger.error(f"Error getting historical data: {e}")
            return []


class CapacityForecaster:
    """Forecasts future capacity needs using machine learning"""

    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.forecast_horizon = 30  # days

    def prepare_data(self, historical_data: List[Tuple]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for ML model training"""
        if len(historical_data) < 10:
            raise ValueError("Insufficient historical data for forecasting")

        # Convert to pandas DataFrame
        df = pd.DataFrame(historical_data, columns=['timestamp', 'value'])
        df.set_index('timestamp', inplace=True)

        # Create features
        df['hour'] = df.index.hour
        df['day_of_week'] = df.index.dayofweek
        df['day_of_month'] = df.index.day
        df['month'] = df.index.month

        # Create lag features
        for lag in [1, 6, 12, 24, 48]:  # hours
            df[f'lag_{lag}'] = df['value'].shift(lag)

        # Create rolling statistics
        for window in [6, 12, 24]:
            df[f'rolling_mean_{window}'] = df['value'].rolling(window=window).mean()
            df[f'rolling_std_{window}'] = df['value'].rolling(window=window).std()

        # Drop NaN values
        df = df.dropna()

        if len(df) < 10:
            raise ValueError("Insufficient data after feature engineering")

        # Prepare features and target
        feature_columns = [col for col in df.columns if col != 'value']
        X = df[feature_columns].values
        y = df['value'].values

        return X, y

    def train_model(self, resource_name: str, historical_data: List[Tuple]):
        """Train forecasting model for a specific resource"""
        try:
            X, y = self.prepare_data(historical_data)

            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            # Train multiple models and ensemble them
            models = {
                'linear': LinearRegression(),
                'random_forest': RandomForestRegressor(n_estimators=100, random_state=42)
            }

            trained_models = {}
            for name, model in models.items():
                model.fit(X_scaled, y)
                trained_models[name] = model

            # Store models and scaler
            self.models[resource_name] = trained_models
            self.scalers[resource_name] = scaler

            logger.info(f"Trained forecasting models for {resource_name}")

        except Exception as e:
            logger.error(f"Error training model for {resource_name}: {e}")

    def forecast(self, resource_name: str, days_ahead: int = 30) -> Dict:
        """Generate capacity forecast"""
        if resource_name not in self.models:
            return {'error': f'No trained model for {resource_name}'}

        try:
            models = self.models[resource_name]
            scaler = self.scalers[resource_name]

            # Get the most recent data point as base
            # In a real implementation, this would come from current metrics
            base_timestamp = datetime.now()
            forecast_data = []

            # Generate forecasts for each model
            forecasts = {}
            for name, model in models.items():
                model_forecast = []

                # Simple recursive forecasting
                for days in range(1, days_ahead + 1):
                    future_time = base_timestamp + timedelta(days=days)

                    # Create features for future prediction
                    features = np.array([[
                        future_time.hour,
                        future_time.weekday(),
                        future_time.day,
                        future_time.month,
                        # Use last known values for lags (simplified)
                        0.0, 0.0, 0.0, 0.0, 0.0,  # lags
                        0.0, 0.0, 0.0, 0.0, 0.0, 0.0  # rolling stats
                    ]]).reshape(1, -1)

                    # Scale features
                    features_scaled = scaler.transform(features)

                    # Make prediction
                    prediction = model.predict(features_scaled)[0]
                    model_forecast.append(prediction)

                forecasts[name] = model_forecast

            # Ensemble predictions (average of all models)
            ensemble_forecast = []
            for i in range(days_ahead):
                day_predictions = [forecasts[name][i] for name in forecasts.keys()]
                ensemble_forecast.append(np.mean(day_predictions))

            # Calculate confidence intervals (simplified)
            confidence_intervals = []
            for i in range(days_ahead):
                day_values = [forecasts[name][i] for name in forecasts.keys()]
                mean_val = np.mean(day_values)
                std_val = np.std(day_values)
                confidence_intervals.append({
                    'lower': max(0, mean_val - 1.96 * std_val),
                    'upper': mean_val + 1.96 * std_val,
                    'mean': mean_val
                })

            return {
                'forecast': ensemble_forecast,
                'confidence_intervals': confidence_intervals,
                'model_predictions': forecasts,
                'days_ahead': days_ahead
            }

        except Exception as e:
            logger.error(f"Error forecasting for {resource_name}: {e}")
            return {'error': str(e)}


class CapacityAnalyzer:
    """Analyzes current capacity and generates recommendations"""

    def __init__(self, config: Dict):
        self.config = config
        self.thresholds = config.get('thresholds', {})
        self.recommendations = []

    def analyze_resource_utilization(self, metrics: Dict) -> Dict:
        """Analyze current resource utilization"""
        analysis = {
            'cpu': {},
            'memory': {},
            'storage': {},
            'network': {}
        }

        # CPU Analysis
        if 'cpu' in metrics:
            cpu_values = list(metrics['cpu'].values())
            if cpu_values:
                cpu_stats = {
                    'avg': np.mean(cpu_values),
                    'max': np.max(cpu_values),
                    'min': np.min(cpu_values),
                    'p95': np.percentile(cpu_values, 95),
                    'count': len(cpu_values)
                }
                analysis['cpu'] = cpu_stats

                # Check thresholds
                high_cpu_threshold = self.thresholds.get('cpu', {}).get('high_utilization', 80)
                if cpu_stats['p95'] > high_cpu_threshold:
                    self.recommendations.append({
                        'type': 'scaling',
                        'resource': 'cpu',
                        'severity': 'high',
                        'message': f"High CPU utilization detected: {cpu_stats['p95']:.1f}%",
                        'action': 'Consider scaling up or optimizing CPU usage'
                    })

        # Memory Analysis
        if 'memory' in metrics:
            memory_values = list(metrics['memory'].values())
            if memory_values:
                memory_stats = {
                    'avg': np.mean(memory_values),
                    'max': np.max(memory_values),
                    'min': np.min(memory_values),
                    'p95': np.percentile(memory_values, 95),
                    'count': len(memory_values)
                }
                analysis['memory'] = memory_stats

                high_memory_threshold = self.thresholds.get('memory', {}).get('high_utilization', 85)
                if memory_stats['p95'] > high_memory_threshold:
                    self.recommendations.append({
                        'type': 'scaling',
                        'resource': 'memory',
                        'severity': 'high',
                        'message': f"High memory utilization detected: {memory_stats['p95']:.1f}%",
                        'action': 'Consider scaling up memory or optimizing memory usage'
                    })

        # Storage Analysis
        if 'storage' in metrics:
            storage_values = list(metrics['storage'].values())
            if storage_values:
                storage_stats = {
                    'total': np.sum(storage_values),
                    'max': np.max(storage_values),
                    'count': len(storage_values)
                }
                analysis['storage'] = storage_stats

                storage_threshold = self.thresholds.get('storage', {}).get('high_utilization', 80)
                # This would need storage capacity info for proper analysis
                if storage_stats['total'] > 100:  # Simplified threshold
                    self.recommendations.append({
                        'type': 'storage',
                        'resource': 'storage',
                        'severity': 'medium',
                        'message': f"Storage usage: {storage_stats['total']:.1f} GB",
                        'action': 'Monitor storage growth and plan capacity expansion'
                    })

        return analysis

    def analyze_growth_trends(self, business_metrics: Dict, historical_metrics: Dict) -> Dict:
        """Analyze growth trends and predict future needs"""
        trends = {}

        try:
            # Transaction growth rate
            if 'transaction_rate' in business_metrics:
                current_tx_rate = business_metrics['transaction_rate']

                # Calculate growth rate (simplified - would use historical data)
                monthly_growth_rate = self.config.get('growth_rates', {}).get('transactions', 0.1)

                trends['transactions'] = {
                    'current_rate': current_tx_rate,
                    'monthly_growth_rate': monthly_growth_rate,
                    'projected_monthly_rate': current_tx_rate * (1 + monthly_growth_rate)
                }

                # Generate recommendations based on growth
                if monthly_growth_rate > 0.2:  # 20% monthly growth
                    self.recommendations.append({
                        'type': 'growth',
                        'resource': 'capacity',
                        'severity': 'medium',
                        'message': f"High transaction growth rate: {monthly_growth_rate:.1%}/month",
                        'action': 'Plan capacity expansion for scaling services'
                    })

            # User growth
            if 'active_users' in business_metrics:
                current_users = business_metrics['active_users']
                user_growth_rate = self.config.get('growth_rates', {}).get('users', 0.05)

                trends['users'] = {
                    'current_users': current_users,
                    'monthly_growth_rate': user_growth_rate,
                    'projected_monthly_users': current_users * (1 + user_growth_rate)
                }

        except Exception as e:
            logger.error(f"Error analyzing growth trends: {e}")

        return trends

    def generate_cost_optimization_recommendations(self, metrics: Dict) -> List[Dict]:
        """Generate cost optimization recommendations"""
        cost_recommendations = []

        try:
            # Check for underutilized resources
            if 'cpu' in metrics:
                cpu_values = list(metrics['cpu'].values())
                if cpu_values:
                    avg_cpu = np.mean(cpu_values)
                    low_cpu_threshold = self.thresholds.get('cpu', {}).get('low_utilization', 20)

                    if avg_cpu < low_cpu_threshold:
                        cost_recommendations.append({
                            'type': 'cost_optimization',
                            'resource': 'cpu',
                            'severity': 'low',
                            'message': f"Low CPU utilization: {avg_cpu:.1f}%",
                            'action': 'Consider scaling down CPU resources'
                        })

            if 'memory' in metrics:
                memory_values = list(metrics['memory'].values())
                if memory_values:
                    avg_memory = np.mean(memory_values)
                    low_memory_threshold = self.thresholds.get('memory', {}).get('low_utilization', 30)

                    if avg_memory < low_memory_threshold:
                        cost_recommendations.append({
                            'type': 'cost_optimization',
                            'resource': 'memory',
                            'severity': 'low',
                            'message': f"Low memory utilization: {avg_memory:.1f}%",
                            'action': 'Consider scaling down memory resources'
                        })

            # Check pod count efficiency
            pod_count = len(metrics.get('cpu', {}))
            if pod_count > 0:
                avg_cpu_per_pod = np.mean(list(metrics['cpu'].values()))

                if pod_count > 10 and avg_cpu_per_pod < 0.5:
                    cost_recommendations.append({
                        'type': 'cost_optimization',
                        'resource': 'pods',
                        'severity': 'medium',
                        'message': f"Many underutilized pods: {pod_count} pods with avg CPU {avg_cpu_per_pod:.2f}",
                        'action': 'Consider pod consolidation or reducing replica count'
                    })

        except Exception as e:
            logger.error(f"Error generating cost optimization recommendations: {e}")

        return cost_recommendations


class CapacityPlanner:
    """Main capacity planning system"""

    def __init__(self, config_path: str = "/app/config/config.yaml"):
        self.config = self._load_config(config_path)
        self.metrics_collector = CapacityMetricsCollector(
            self.config['prometheus']['url']
        )
        self.forecaster = CapacityForecaster()
        self.analyzer = CapacityAnalyzer(self.config)

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            # Return default configuration
            return {
                'prometheus': {'url': 'http://prometheus.observability.svc.cluster.local:9090'},
                'thresholds': {
                    'cpu': {'high_utilization': 80, 'low_utilization': 20},
                    'memory': {'high_utilization': 85, 'low_utilization': 30},
                    'storage': {'high_utilization': 80}
                },
                'growth_rates': {
                    'transactions': 0.1,
                    'users': 0.05
                }
            }

    async def run_capacity_analysis(self) -> Dict:
        """Run complete capacity analysis"""
        start_time = datetime.now()
        logger.info("Starting capacity analysis")

        try:
            async with self.metrics_collector:
                # Collect current metrics
                resource_metrics = await self.metrics_collector.get_resource_metrics()
                business_metrics = await self.metrics_collector.get_business_metrics()

                # Update Prometheus metrics
                for resource, values in resource_metrics.items():
                    if values:
                        avg_value = np.mean(list(values.values()))
                        RESOURCE_UTILIZATION.labels(resource=resource, namespace='production').set(avg_value)

                # Analyze current utilization
                utilization_analysis = self.analyzer.analyze_resource_utilization(resource_metrics)

                # Analyze growth trends
                # Get some historical data for trend analysis
                tx_history = await self.metrics_collector.get_historical_data(
                    'sum(rate(transaction_requests_total[5m]))',
                    hours=168  # 1 week
                )

                historical_metrics = {'transactions': tx_history}
                growth_analysis = self.analyzer.analyze_growth_trends(business_metrics, historical_metrics)

                # Generate cost optimization recommendations
                cost_recommendations = self.analyzer.generate_cost_optimization_recommendations(resource_metrics)

                # Collect all recommendations
                all_recommendations = (
                    self.analyzer.recommendations +
                    cost_recommendations
                )

                # Sort recommendations by severity
                severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
                all_recommendations.sort(key=lambda x: severity_order.get(x['severity'], 3))

                # Generate forecasts for key metrics
                forecasts = {}
                if tx_history:
                    self.forecaster.train_model('transactions', tx_history)
                    forecasts['transactions'] = self.forecaster.forecast('transactions', days_ahead=30)

                # Calculate analysis duration
                duration = (datetime.now() - start_time).total_seconds()

                # Update metrics
                CAPACITY_CHECKS.labels(result='success').inc()

                # Generate report
                report = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'duration_seconds': duration,
                    'resource_metrics': resource_metrics,
                    'business_metrics': business_metrics,
                    'utilization_analysis': utilization_analysis,
                    'growth_analysis': growth_analysis,
                    'forecasts': forecasts,
                    'recommendations': all_recommendations,
                    'summary': {
                        'total_recommendations': len(all_recommendations),
                        'critical_recommendations': len([r for r in all_recommendations if r['severity'] == 'critical']),
                        'high_recommendations': len([r for r in all_recommendations if r['severity'] == 'high']),
                        'resource_health': 'healthy' if len([r for r in all_recommendations if r['severity'] in ['critical', 'high']]) == 0 else 'attention_needed'
                    }
                }

                logger.info(f"Capacity analysis completed in {duration:.2f}s")
                return report

        except Exception as e:
            logger.error(f"Capacity analysis failed: {e}")
            CAPACITY_CHECKS.labels(result='failure').inc()
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'status': 'failed'
            }

    async def run_forecast_training(self):
        """Train forecasting models with historical data"""
        logger.info("Starting forecast model training")

        try:
            async with self.metrics_collector:
                # Get historical data for key metrics
                metrics_to_forecast = [
                    ('transactions', 'sum(rate(transaction_requests_total[5m]))'),
                    ('cpu_usage', 'sum(rate(container_cpu_usage_seconds_total{namespace="production"}[5m]))'),
                    ('memory_usage', 'sum(container_memory_working_set_bytes{namespace="production"}) / 1024 / 1024')
                ]

                for metric_name, query in metrics_to_forecast:
                    historical_data = await self.metrics_collector.get_historical_data(query, hours=720)  # 30 days

                    if len(historical_data) >= 100:  # Need sufficient data
                        self.forecaster.train_model(metric_name, historical_data)
                        logger.info(f"Trained forecast model for {metric_name}")
                    else:
                        logger.warning(f"Insufficient data for {metric_name} forecast model")

        except Exception as e:
            logger.error(f"Forecast training failed: {e}")

    async def get_capacity_alerts(self) -> List[Dict]:
        """Generate capacity alerts based on current metrics"""
        alerts = []

        try:
            async with self.metrics_collector:
                resource_metrics = await self.metrics_collector.get_resource_metrics()
                business_metrics = await self.metrics_collector.get_business_metrics()

                # Check for critical utilization
                if 'cpu' in resource_metrics:
                    cpu_values = list(resource_metrics['cpu'].values())
                    if cpu_values:
                        max_cpu = np.max(cpu_values)
                        if max_cpu > 90:
                            alerts.append({
                                'severity': 'critical',
                                'type': 'resource_utilization',
                                'resource': 'cpu',
                                'message': f"Critical CPU utilization: {max_cpu:.1f}%",
                                'timestamp': datetime.utcnow().isoformat()
                            })
                            CAPACITY_ALERTS.labels(severity='critical').inc()

                if 'memory' in resource_metrics:
                    memory_values = list(resource_metrics['memory'].values())
                    if memory_values:
                        max_memory = np.max(memory_values)
                        # This would need total memory capacity for proper percentage
                        if max_memory > 8000:  # 8GB threshold
                            alerts.append({
                                'severity': 'high',
                                'type': 'resource_utilization',
                                'resource': 'memory',
                                'message': f"High memory usage: {max_memory:.1f} MB",
                                'timestamp': datetime.utcnow().isoformat()
                            })
                            CAPACITY_ALERTS.labels(severity='high').inc()

                # Check for unusual patterns in business metrics
                if 'transaction_rate' in business_metrics:
                    tx_rate = business_metrics['transaction_rate']
                    if tx_rate < 10:  # Low transaction rate threshold
                        alerts.append({
                            'severity': 'medium',
                            'type': 'business_metrics',
                            'resource': 'transactions',
                            'message': f"Low transaction rate: {tx_rate:.1f}/sec",
                            'timestamp': datetime.utcnow().isoformat()
                        })
                        CAPACITY_ALERTS.labels(severity='medium').inc()

        except Exception as e:
            logger.error(f"Error generating capacity alerts: {e}")

        return alerts


# FastAPI application for HTTP endpoints
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="Capacity Planning API",
    description="API for capacity planning and optimization",
    version="1.0.0"
)

planner = None

class AnalysisResponse(BaseModel):
    success: bool
    report: Optional[Dict] = None
    message: str
    timestamp: str

class AlertsResponse(BaseModel):
    success: bool
    alerts: List[Dict] = []
    message: str
    timestamp: str

@app.on_event("startup")
async def startup_event():
    global planner
    planner = CapacityPlanner()

    # Start Prometheus metrics server
    start_http_server(8081)

    # Start background task for model training
    asyncio.create_task(background_model_training())

    logger.info("Capacity planning system started")

async def background_model_training():
    """Background task to periodically retrain models"""
    while True:
        try:
            await planner.run_forecast_training()
            await asyncio.sleep(24 * 3600)  # Train daily
        except Exception as e:
            logger.error(f"Background model training failed: {e}")
            await asyncio.sleep(3600)  # Retry in 1 hour

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/ready")
async def ready_check():
    """Ready check endpoint"""
    try:
        if planner and planner.metrics_collector:
            return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}
        else:
            return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}
    except Exception:
        return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}

@app.get("/analyze", response_model=AnalysisResponse)
async def run_capacity_analysis(background_tasks: BackgroundTasks):
    """Run capacity analysis and return report"""
    if not planner:
        raise HTTPException(status_code=503, detail="Planner not initialized")

    try:
        report = await planner.run_capacity_analysis()

        # Send notifications if there are critical recommendations
        critical_recs = [r for r in report.get('recommendations', []) if r['severity'] in ['critical', 'high']]
        if critical_recs:
            background_tasks.add_task(send_capacity_alerts, critical_recs)

        return AnalysisResponse(
            success=True,
            report=report,
            message="Capacity analysis completed successfully",
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Capacity analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/alerts", response_model=AlertsResponse)
async def get_capacity_alerts():
    """Get current capacity alerts"""
    if not planner:
        raise HTTPException(status_code=503, detail="Planner not initialized")

    try:
        alerts = await planner.get_capacity_alerts()

        return AlertsResponse(
            success=True,
            alerts=alerts,
            message=f"Found {len(alerts)} capacity alerts",
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Alert generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/forecasts")
async def get_capacity_forecasts():
    """Get capacity forecasts"""
    if not planner:
        raise HTTPException(status_code=503, detail="Planner not initialized")

    try:
        forecasts = {}

        # Generate forecasts for available models
        if 'transactions' in planner.forecaster.models:
            forecasts['transactions'] = planner.forecaster.forecast('transactions', days_ahead=30)

        if 'cpu_usage' in planner.forecaster.models:
            forecasts['cpu'] = planner.forecaster.forecast('cpu_usage', days_ahead=30)

        if 'memory_usage' in planner.forecaster.models:
            forecasts['memory'] = planner.forecaster.forecast('memory_usage', days_ahead=30)

        return {
            "success": True,
            "forecasts": forecasts,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Forecast generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train-models")
async def train_forecast_models(background_tasks: BackgroundTasks):
    """Train forecast models with latest data"""
    if not planner:
        raise HTTPException(status_code=503, detail="Planner not initialized")

    try:
        # Start background training task
        background_tasks.add_task(planner.run_forecast_training)

        return {
            "success": True,
            "message": "Model training started",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Model training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Get internal metrics"""
    return {
        "capacity_checks_total": CAPACITY_CHECKS._value.get(),
        "capacity_alerts_total": CAPACITY_ALERTS._value.get()
    }


async def send_capacity_alerts(recommendations: List[Dict]):
    """Send capacity alerts to notification channels"""
    try:
        # This would integrate with your notification system
        # For example, send to Slack, PagerDuty, etc.

        critical_count = len([r for r in recommendations if r['severity'] == 'critical'])
        high_count = len([r for r in recommendations if r['severity'] == 'high'])

        message = f"Capacity Planning Alert: {critical_count} critical and {high_count} high priority recommendations"

        logger.warning(f"Capacity alerts: {message}")

        # Placeholder for notification implementation
        # await send_slack_notification(f"🚨 {message}")
        # await send_pagerduty_alert(message)

    except Exception as e:
        logger.error(f"Failed to send capacity alerts: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "capacity_planning_system:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )
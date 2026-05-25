#!/usr/bin/env python3
"""
QuantumBeam Auto-scaling Configuration Manager
Comprehensive auto-scaling with multiple metrics, predictive scaling, and cost optimization.
"""

import os
import sys
import json
import yaml
import time
import logging
import asyncio
import statistics
import boto3
import kubernetes
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import numpy as np
import requests
from prometheus_api_client import PrometheusConnect
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ScalingMetric:
    """Auto-scaling metric configuration."""
    name: str
    prometheus_query: str
    target_value: float
    current_value: float
    threshold_up: float
    threshold_down: float
    scaling_factor: float
    evaluation_period: int  # seconds
    cooldown_period: int  # seconds

@dataclass
class ScalingPolicy:
    """Auto-scaling policy configuration."""
    name: str
    namespace: str
    deployment_name: str
    min_replicas: int
    max_replicas: int
    current_replicas: int
    target_replicas: int
    metrics: List[ScalingMetric]
    scaling_behavior: str  # step, linear, exponential
    stabilization_window: int  # seconds
    predictive_scaling: bool
    cost_optimization: bool

@dataclass
class ScalingEvent:
    """Auto-scaling event record."""
    timestamp: datetime
    policy_name: str
    action: str  # scale_up, scale_down, no_action
    old_replicas: int
    new_replicas: int
    trigger_metric: str
    trigger_value: float
    reason: str
    duration_ms: int

class MetricsCollector:
    """Collects metrics from various sources."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.prometheus_client = None
        self.k8s_client = None
        self.cloudwatch_client = None

        self._initialize_clients()

    def _initialize_clients(self):
        """Initialize metric collection clients."""
        # Initialize Prometheus client
        if self.config.get('prometheus'):
            try:
                self.prometheus_client = PrometheusConnect(
                    url=self.config['prometheus']['url'],
                    headers=self.config['prometheus'].get('headers', {})
                )
                logger.info("Prometheus client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Prometheus client: {e}")

        # Initialize Kubernetes client
        try:
            kubernetes.config.load_incluster_config()
        except kubernetes.config.ConfigException:
            kubernetes.config.load_kube_config()

        self.k8s_client = kubernetes.client.AppsV1Api()
        logger.info("Kubernetes client initialized")

        # Initialize CloudWatch client
        if self.config.get('cloudwatch'):
            try:
                self.cloudwatch_client = boto3.client(
                    'cloudwatch',
                    region_name=self.config['cloudwatch']['region']
                )
                logger.info("CloudWatch client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize CloudWatch client: {e}")

    def get_metric_value(self, metric: ScalingMetric) -> float:
        """Get current value for a scaling metric."""
        try:
            if self.prometheus_client and metric.prometheus_query:
                # Calculate time range for the query
                end_time = datetime.now()
                start_time = end_time - timedelta(seconds=metric.evaluation_period)

                result = self.prometheus_client.custom_query_range(
                    query=metric.prometheus_query,
                    start_time=start_time,
                    end_time=end_time,
                    step='60'  # 1 minute resolution
                )

                if result and len(result) > 0:
                    # Get the latest value
                    latest_data = result[0].get('values', [])
                    if latest_data:
                        latest_value = float(latest_data[-1][1])
                        return latest_value

            # Fallback to default value
            logger.warning(f"Could not retrieve metric {metric.name}, using default")
            return metric.target_value

        except Exception as e:
            logger.error(f"Failed to get metric {metric.name}: {e}")
            return metric.target_value

    def get_current_replicas(self, namespace: str, deployment_name: str) -> int:
        """Get current replica count for a deployment."""
        try:
            deployment = self.k8s_client.read_namespaced_deployment(
                name=deployment_name,
                namespace=namespace
            )
            return deployment.spec.replicas or 0
        except Exception as e:
            logger.error(f"Failed to get replica count for {deployment_name}: {e}")
            return 0

class PredictiveScaler:
    """Predictive auto-scaling based on historical patterns."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.historical_data = {}
        self.model_cache = {}

    def predict_load(self, policy_name: str, forecast_minutes: int = 15) -> Dict[str, float]:
        """Predict future load based on historical patterns."""
        try:
            # Get historical data for the policy
            if policy_name not in self.historical_data:
                return self._get_default_prediction(forecast_minutes)

            historical_values = self.historical_data[policy_name]
            if len(historical_values) < 10:
                return self._get_default_prediction(forecast_minutes)

            # Simple time series forecasting using moving average
            recent_values = historical_values[-24:]  # Last 24 data points
            if len(recent_values) < 4:
                return self._get_default_prediction(forecast_minutes)

            # Calculate trend
            if len(recent_values) >= 4:
                # Simple linear trend
                x = np.arange(len(recent_values))
                y = np.array(recent_values)
                slope, intercept = np.polyfit(x, y, 1)

                # Predict future values
                future_x = np.arange(len(recent_values), len(recent_values) + forecast_minutes)
                future_y = slope * future_x + intercept

                predicted_load = {
                    'avg_predicted': float(np.mean(future_y)),
                    'max_predicted': float(np.max(future_y)),
                    'min_predicted': float(np.min(future_y)),
                    'trend': slope,
                    'confidence': min(0.8, len(recent_values) / 100)  # Confidence based on data amount
                }

                # Ensure predictions are reasonable
                predicted_load['avg_predicted'] = max(0.1, predicted_load['avg_predicted'])
                predicted_load['max_predicted'] = max(0.1, predicted_load['max_predicted'])

                return predicted_load

            return self._get_default_prediction(forecast_minutes)

        except Exception as e:
            logger.error(f"Failed to predict load: {e}")
            return self._get_default_prediction(forecast_minutes)

    def _get_default_prediction(self, forecast_minutes: int) -> Dict[str, float]:
        """Get default prediction when historical data is insufficient."""
        return {
            'avg_predicted': 1.0,
            'max_predicted': 1.2,
            'min_predicted': 0.8,
            'trend': 0.0,
            'confidence': 0.3
        }

    def add_historical_data_point(self, policy_name: str, metric_value: float):
        """Add a new data point to historical data."""
        if policy_name not in self.historical_data:
            self.historical_data[policy_name] = []

        self.historical_data[policy_name].append(metric_value)

        # Keep only last 7 days of data (assuming 1-hour intervals)
        max_points = 24 * 7  # 168 points
        if len(self.historical_data[policy_name]) > max_points:
            self.historical_data[policy_name] = self.historical_data[policy_name][-max_points:]

class CostOptimizer:
    """Cost optimization for auto-scaling."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.instance_cost_per_hour = self.config.get('instance_cost_per_hour', 0.05)
        self.memory_gb_cost_per_hour = self.config.get('memory_gb_cost_per_hour', 0.01)

    def calculate_scaling_cost(self, current_replicas: int, target_replicas: int,
                             instance_resources: Dict[str, Any]) -> Dict[str, float]:
        """Calculate cost impact of scaling decision."""
        try:
            # Calculate hourly cost for current and target replicas
            current_cpu_cost = (instance_resources.get('cpu_millicores', 1000) / 1000) * self.instance_cost_per_hour
            current_memory_cost = (instance_resources.get('memory_mb', 512) / 1024) * self.memory_gb_cost_per_hour
            current_hourly_cost = (current_cpu_cost + current_memory_cost) * current_replicas

            target_hourly_cost = (current_cpu_cost + current_memory_cost) * target_replicas

            # Calculate monthly cost difference
            cost_difference = (target_hourly_cost - current_hourly_cost) * 24 * 30

            # Calculate cost per request (if metrics available)
            requests_per_hour = instance_resources.get('requests_per_hour', 1000)
            current_cost_per_request = current_hourly_cost / requests_per_hour if requests_per_hour > 0 else 0
            target_cost_per_request = target_hourly_cost / requests_per_hour if requests_per_hour > 0 else 0

            return {
                'current_hourly_cost': current_hourly_cost,
                'target_hourly_cost': target_hourly_cost,
                'cost_difference': cost_difference,
                'current_cost_per_request': current_cost_per_request,
                'target_cost_per_request': target_cost_per_request,
                'cost_efficiency': (target_cost_per_request / current_cost_per_request) if current_cost_per_request > 0 else 1.0
            }

        except Exception as e:
            logger.error(f"Failed to calculate scaling cost: {e}")
            return {
                'current_hourly_cost': 0,
                'target_hourly_cost': 0,
                'cost_difference': 0,
                'current_cost_per_request': 0,
                'target_cost_per_request': 0,
                'cost_efficiency': 1.0
            }

    def recommend_optimal_replicas(self, policy: ScalingPolicy,
                                 forecast: Dict[str, float],
                                 instance_resources: Dict[str, Any]) -> int:
        """Recommend optimal replica count based on cost and performance."""
        try:
            # Calculate cost for different replica counts
            min_replicas = policy.min_replicas
            max_replicas = min(policy.max_replicas, min_replicas + 10)  # Limit calculation range

            optimal_replicas = min_replicas
            best_efficiency = 0

            for replicas in range(min_replicas, max_replicas + 1):
                # Estimate if this replica count can handle the predicted load
                capacity_per_replica = 1.0  # Normalize capacity
                total_capacity = capacity_per_replica * replicas
                predicted_load = forecast.get('avg_predicted', 1.0)

                if total_capacity >= predicted_load * 1.1:  # 10% buffer
                    cost_info = self.calculate_scaling_cost(
                        policy.current_replicas, replicas, instance_resources
                    )

                    # Calculate efficiency (performance / cost)
                    performance_score = min(1.0, total_capacity / predicted_load) if predicted_load > 0 else 1.0
                    cost_efficiency = performance_score / max(cost_info['cost_efficiency'], 0.1)

                    if cost_efficiency > best_efficiency:
                        best_efficiency = cost_efficiency
                        optimal_replicas = replicas

            return optimal_replicas

        except Exception as e:
            logger.error(f"Failed to recommend optimal replicas: {e}")
            return policy.min_replicas

class AutoScalingManager:
    """Main auto-scaling manager."""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'autoscaling-config.yaml'
        self.config = self._load_config()
        self.metrics_collector = MetricsCollector(self.config.get('metrics', {}))
        self.predictive_scaler = PredictiveScaler(self.config.get('predictive_scaling', {}))
        self.cost_optimizer = CostOptimizer(self.config.get('cost_optimization', {}))

        self.policies = []
        self.scaling_events = []
        self._load_policies()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file."""
        config_path = Path(self.config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            # Return default configuration
            return {
                'metrics': {
                    'prometheus': {
                        'url': 'http://prometheus:9090',
                        'headers': {}
                    }
                },
                'predictive_scaling': {
                    'enabled': True,
                    'forecast_minutes': 15,
                    'confidence_threshold': 0.7
                },
                'cost_optimization': {
                    'instance_cost_per_hour': 0.05,
                    'memory_gb_cost_per_hour': 0.01,
                    'max_cost_increase_percent': 20
                },
                'scaling': {
                    'evaluation_interval': 60,  # seconds
                    'stabilization_window': 300,  # seconds
                    'max_scale_up_percent': 100,
                    'max_scale_down_percent': 50
                }
            }

    def _load_policies(self):
        """Load auto-scaling policies."""
        policies_config = self.config.get('policies', [])

        for policy_config in policies_config:
            # Create metrics objects
            metrics = []
            for metric_config in policy_config.get('metrics', []):
                metric = ScalingMetric(
                    name=metric_config['name'],
                    prometheus_query=metric_config['prometheus_query'],
                    target_value=metric_config['target_value'],
                    current_value=0.0,
                    threshold_up=metric_config['threshold_up'],
                    threshold_down=metric_config['threshold_down'],
                    scaling_factor=metric_config['scaling_factor'],
                    evaluation_period=metric_config.get('evaluation_period', 300),
                    cooldown_period=metric_config.get('cooldown_period', 300)
                )
                metrics.append(metric)

            # Create policy object
            policy = ScalingPolicy(
                name=policy_config['name'],
                namespace=policy_config['namespace'],
                deployment_name=policy_config['deployment_name'],
                min_replicas=policy_config['min_replicas'],
                max_replicas=policy_config['max_replicas'],
                current_replicas=0,
                target_replicas=0,
                metrics=metrics,
                scaling_behavior=policy_config.get('scaling_behavior', 'step'),
                stabilization_window=policy_config.get('stabilization_window', 300),
                predictive_scaling=policy_config.get('predictive_scaling', False),
                cost_optimization=policy_config.get('cost_optimization', False)
            )

            # Get current replica count
            policy.current_replicas = self.metrics_collector.get_current_replicas(
                policy.namespace, policy.deployment_name
            )
            policy.target_replicas = policy.current_replicas

            self.policies.append(policy)
            logger.info(f"Loaded scaling policy: {policy.name}")

    def evaluate_policies(self) -> List[ScalingEvent]:
        """Evaluate all auto-scaling policies."""
        scaling_events = []

        for policy in self.policies:
            try:
                event = self._evaluate_policy(policy)
                if event:
                    scaling_events.append(event)
                    self.scaling_events.append(event)
            except Exception as e:
                logger.error(f"Failed to evaluate policy {policy.name}: {e}")

        # Keep only last 100 events
        if len(self.scaling_events) > 100:
            self.scaling_events = self.scaling_events[-100:]

        return scaling_events

    def _evaluate_policy(self, policy: ScalingPolicy) -> Optional[ScalingEvent]:
        """Evaluate a single auto-scaling policy."""
        start_time = time.time()

        try:
            # Get current metric values
            for metric in policy.metrics:
                metric.current_value = self.metrics_collector.get_metric_value(metric)

            # Check if we're in cooldown period
            if self._is_in_cooldown(policy):
                return None

            # Determine scaling action
            action, target_replicas, trigger_metric, trigger_value = self._determine_scaling_action(policy)

            if action == 'no_action':
                return None

            # Validate target replica count
            target_replicas = max(policy.min_replicas, min(policy.max_replicas, target_replicas))

            # Apply predictive scaling if enabled
            if policy.predictive_scaling and self.config['predictive_scaling']['enabled']:
                forecast = self.predictive_scaler.predict_load(policy.name)
                if forecast['confidence'] > self.config['predictive_scaling']['confidence_threshold']:
                    predictive_replicas = self.cost_optimizer.recommend_optimal_replicas(
                        policy, forecast, self._get_instance_resources(policy)
                    )
                    # Blend predictive and reactive recommendations
                    target_replicas = int((target_replicas + predictive_replicas) / 2)

            # Apply cost optimization if enabled
            if policy.cost_optimization and self.config['cost_optimization']:
                cost_recommendation = self._optimize_for_cost(policy)
                if cost_recommendation:
                    target_replicas = cost_recommendation

            # Create scaling event
            event = ScalingEvent(
                timestamp=datetime.now(),
                policy_name=policy.name,
                action=action,
                old_replicas=policy.current_replicas,
                new_replicas=target_replicas,
                trigger_metric=trigger_metric,
                trigger_value=trigger_value,
                reason=self._generate_scaling_reason(policy, action, trigger_metric, trigger_value),
                duration_ms=int((time.time() - start_time) * 1000)
            )

            # Execute scaling action
            if self._execute_scaling_action(policy, target_replicas):
                policy.current_replicas = target_replicas
                policy.target_replicas = target_replicas

                # Add historical data point for predictive scaling
                if policy.metrics:
                    avg_metric_value = statistics.mean([m.current_value for m in policy.metrics])
                    self.predictive_scaler.add_historical_data_point(policy.name, avg_metric_value)

            return event

        except Exception as e:
            logger.error(f"Failed to evaluate policy {policy.name}: {e}")
            return None

    def _determine_scaling_action(self, policy: ScalingPolicy) -> Tuple[str, int, str, float]:
        """Determine scaling action based on metrics."""
        scale_up_factor = self.config['scaling']['max_scale_up_percent'] / 100
        scale_down_factor = self.config['scaling']['max_scale_down_percent'] / 100

        # Check scale-up conditions
        for metric in policy.metrics:
            if metric.current_value > metric.threshold_up:
                if policy.scaling_behavior == 'exponential':
                    new_replicas = int(policy.current_replicas * (1 + metric.scaling_factor))
                elif policy.scaling_behavior == 'linear':
                    new_replicas = int(policy.current_replicas + metric.scaling_factor)
                else:  # step
                    new_replicas = int(policy.current_replicas * (1 + min(scale_up_factor, metric.scaling_factor)))

                return 'scale_up', new_replicas, metric.name, metric.current_value

        # Check scale-down conditions
        for metric in policy.metrics:
            if metric.current_value < metric.threshold_down:
                if policy.scaling_behavior == 'exponential':
                    new_replicas = int(policy.current_replicas * (1 - metric.scaling_factor))
                elif policy.scaling_behavior == 'linear':
                    new_replicas = int(policy.current_replicas - metric.scaling_factor)
                else:  # step
                    new_replicas = int(policy.current_replicas * (1 - min(scale_down_factor, metric.scaling_factor)))

                return 'scale_down', new_replicas, metric.name, metric.current_value

        return 'no_action', policy.current_replicas, '', 0.0

    def _is_in_cooldown(self, policy: ScalingPolicy) -> bool:
        """Check if policy is in cooldown period."""
        if not policy.metrics:
            return False

        # Find the most recent scaling event for this policy
        recent_events = [
            e for e in self.scaling_events[-20:]  # Last 20 events
            if e.policy_name == policy.name
        ]

        if not recent_events:
            return False

        last_event = recent_events[-1]
        cooldown_elapsed = (datetime.now() - last_event.timestamp).total_seconds()

        # Use the longest cooldown period from metrics
        max_cooldown = max(m.cooldown_period for m in policy.metrics)

        return cooldown_elapsed < max_cooldown

    def _execute_scaling_action(self, policy: ScalingPolicy, target_replicas: int) -> bool:
        """Execute scaling action by updating deployment."""
        try:
            k8s_client = kubernetes.client.AppsV1Api()

            # Patch deployment with new replica count
            patch = {
                'spec': {
                    'replicas': target_replicas
                }
            }

            k8s_client.patch_namespaced_deployment_scale(
                name=policy.deployment_name,
                namespace=policy.namespace,
                body=patch
            )

            logger.info(f"Scaled {policy.deployment_name} from {policy.current_replicas} to {target_replicas} replicas")
            return True

        except Exception as e:
            logger.error(f"Failed to execute scaling action for {policy.name}: {e}")
            return False

    def _generate_scaling_reason(self, policy: ScalingPolicy, action: str,
                                  trigger_metric: str, trigger_value: float) -> str:
        """Generate human-readable reason for scaling action."""
        if action == 'scale_up':
            return f"Scaling up due to {trigger_metric} = {trigger_value:.2f} (threshold: {next(m.threshold_up for m in policy.metrics if m.name == trigger_metric)})"
        elif action == 'scale_down':
            return f"Scaling down due to {trigger_metric} = {trigger_value:.2f} (threshold: {next(m.threshold_down for m in policy.metrics if m.name == trigger_metric)})"
        else:
            return "No scaling action required"

    def _get_instance_resources(self, policy: ScalingPolicy) -> Dict[str, Any]:
        """Get instance resource requirements."""
        try:
            k8s_client = kubernetes.client.AppsV1Api()
            deployment = k8s_client.read_namespaced_deployment(
                name=policy.deployment_name,
                namespace=policy.namespace
            )

            if deployment.spec.template.spec.containers:
                container = deployment.spec.template.spec.containers[0]
                resources = container.resources or {}
                requests = resources.requests or {}

                cpu_millicores = 1000  # Default
                memory_mb = 512  # Default

                if requests.get('cpu'):
                    cpu_millicores = self._parse_cpu(requests['cpu'])
                if requests.get('memory'):
                    memory_mb = self._parse_memory(requests['memory'])

                return {
                    'cpu_millicores': cpu_millicores,
                    'memory_mb': memory_mb,
                    'requests_per_hour': 1000  # Would need actual metrics
                }

        except Exception as e:
            logger.error(f"Failed to get instance resources: {e}")

        return {
            'cpu_millicores': 1000,
            'memory_mb': 512,
            'requests_per_hour': 1000
        }

    def _parse_cpu(self, cpu_str: str) -> float:
        """Parse CPU string to millicores."""
        if not cpu_str:
            return 1000

        cpu_str = cpu_str.lower().strip()
        if cpu_str.endswith('m'):
            return float(cpu_str[:-1])
        else:
            return float(cpu_str) * 1000

    def _parse_memory(self, memory_str: str) -> float:
        """Parse memory string to MB."""
        if not memory_str:
            return 512

        memory_str = memory_str.upper().strip()
        if memory_str.endswith('KI'):
            return float(memory_str[:-2]) / 1024
        elif memory_str.endswith('MI'):
            return float(memory_str[:-2])
        elif memory_str.endswith('GI'):
            return float(memory_str[:-2]) * 1024
        elif memory_str.endswith('K'):
            return float(memory_str[:-1]) / 1024
        elif memory_str.endswith('M'):
            return float(memory_str[:-1])
        elif memory_str.endswith('G'):
            return float(memory_str[:-1]) * 1024
        else:
            return float(memory_str) / (1024 * 1024)

    def _optimize_for_cost(self, policy: ScalingPolicy) -> Optional[int]:
        """Optimize replica count for cost efficiency."""
        try:
            forecast = self.predictive_scaler.predict_load(policy.name)
            instance_resources = self._get_instance_resources(policy)

            # Calculate cost efficiency for different replica counts
            current_cost = self.cost_optimizer.calculate_scaling_cost(
                policy.current_replicas, policy.current_replicas, instance_resources
            )

            max_cost_increase = self.config['cost_optimization']['max_cost_increase_percent'] / 100
            max_allowed_cost = current_cost['current_hourly_cost'] * (1 + max_cost_increase)

            # Find the most cost-effective replica count that can handle the load
            optimal_replicas = policy.current_replicas
            best_efficiency = 0

            for replicas in range(policy.min_replicas, min(policy.max_replicas, policy.current_replicas + 5)):
                cost_info = self.cost_optimizer.calculate_scaling_cost(
                    policy.current_replicas, replicas, instance_resources
                )

                if cost_info['target_hourly_cost'] <= max_allowed_cost:
                    # Check if this replica count can handle the predicted load
                    capacity_factor = replicas / policy.current_replicas
                    predicted_load = forecast.get('max_predicted', 1.0)

                    if capacity_factor >= predicted_load:
                        efficiency = 1.0 / max(cost_info['cost_efficiency'], 0.1)
                        if efficiency > best_efficiency:
                            best_efficiency = efficiency
                            optimal_replicas = replicas

            if optimal_replicas != policy.current_replicas:
                logger.info(f"Cost optimization recommends {optimal_replicas} replicas (current: {policy.current_replicas})")
                return optimal_replicas

            return None

        except Exception as e:
            logger.error(f"Failed to optimize for cost: {e}")
            return None

    def run_continuous_evaluation(self, interval_seconds: int = 60):
        """Run continuous evaluation of auto-scaling policies."""
        logger.info(f"Starting continuous auto-scaling evaluation (interval: {interval_seconds}s)")

        while True:
            try:
                logger.info("Evaluating auto-scaling policies...")
                events = self.evaluate_policies()

                if events:
                    for event in events:
                        logger.info(f"Scaling event: {event.policy_name} - {event.action} from {event.old_replicas} to {event.new_replicas} replicas")

                # Generate report
                self._generate_scaling_report()

            except Exception as e:
                logger.error(f"Error in scaling evaluation: {e}")

            # Wait for next evaluation
            time.sleep(interval_seconds)

    def _generate_scaling_report(self):
        """Generate auto-scaling performance report."""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_dir = Path('./reports')
            report_dir.mkdir(exist_ok=True)

            report_file = report_dir / f'autoscaling-report-{timestamp}.json'

            # Prepare report data
            report = {
                'timestamp': datetime.now().isoformat(),
                'policies': [],
                'recent_events': [asdict(e) for e in self.scaling_events[-50:]],
                'summary': {
                    'total_policies': len(self.policies),
                    'total_events_today': len([e for e in self.scaling_events if e.timestamp.date() == datetime.now().date()]),
                    'scale_up_events_today': len([e for e in self.scaling_events if e.action == 'scale_up' and e.timestamp.date() == datetime.now().date()]),
                    'scale_down_events_today': len([e for e in self.scaling_events if e.action == 'scale_down' and e.timestamp.date() == datetime.now().date()])
                }
            }

            # Add policy details
            for policy in self.policies:
                policy_data = {
                    'name': policy.name,
                    'namespace': policy.namespace,
                    'deployment_name': policy.deployment_name,
                    'current_replicas': policy.current_replicas,
                    'min_replicas': policy.min_replicas,
                    'max_replicas': policy.max_replicas,
                    'metrics': [
                        {
                            'name': m.name,
                            'current_value': m.current_value,
                            'target_value': m.target_value,
                            'threshold_up': m.threshold_up,
                            'threshold_down': m.threshold_down
                        } for m in policy.metrics
                    ],
                    'predictive_scaling': policy.predictive_scaling,
                    'cost_optimization': policy.cost_optimization
                }
                report['policies'].append(policy_data)

            # Save report
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            logger.info(f"Auto-scaling report generated: {report_file}")

        except Exception as e:
            logger.error(f"Failed to generate scaling report: {e}")

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Auto-scaling Manager')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--action', choices=['evaluate', 'continuous', 'report'], default='evaluate',
                       help='Action to perform')
    parser.add_argument('--interval', type=int, default=60, help='Evaluation interval in seconds (for continuous mode)')

    args = parser.parse_args()

    try:
        # Initialize auto-scaling manager
        autoscaler = AutoScalingManager(args.config)

        if args.action == 'evaluate':
            # Run single evaluation
            events = autoscaler.evaluate_policies()
            if events:
                print(f"Generated {len(events)} scaling events:")
                for event in events:
                    print(f"  - {event.policy_name}: {event.action} ({event.old_replicas} → {event.new_replicas})")
            else:
                print("No scaling actions required")

        elif args.action == 'continuous':
            # Run continuous evaluation
            autoscaler.run_continuous_evaluation(args.interval)

        elif args.action == 'report':
            # Generate report
            autoscaler._generate_scaling_report()
            print("Auto-scaling report generated")

    except Exception as e:
        logger.error(f"Auto-scaling failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
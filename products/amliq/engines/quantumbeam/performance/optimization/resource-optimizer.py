#!/usr/bin/env python3
"""
QuantumBeam Resource Optimization and Right-sizing Tool
Analyzes resource usage patterns and provides optimization recommendations.
"""

import os
import sys
import json
import yaml
import time
import logging
import argparse
import statistics
import requests
import boto3
import kubernetes
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import concurrent.futures
import pandas as pd
import numpy as np
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
class ResourceMetrics:
    """Resource usage metrics."""
    timestamp: datetime
    cpu_usage_percent: float
    memory_usage_percent: float
    cpu_request_millicores: float
    memory_request_mb: float
    cpu_limit_millicores: float
    memory_limit_mb: float
    pod_count: int
    node_count: int
    request_count: int
    response_time_ms: float
    error_rate: float

@dataclass
class ResourceRecommendation:
    """Resource optimization recommendation."""
    resource_type: str
    resource_name: str
    current_request_cpu: float
    current_request_memory: float
    recommended_request_cpu: float
    recommended_request_memory: float
    current_limit_cpu: float
    current_limit_memory: float
    recommended_limit_cpu: float
    recommended_limit_memory: float
    potential_savings_percent: float
    confidence_score: float
    rationale: str
    implementation_complexity: str

@dataclass
class OptimizationReport:
    """Complete optimization report."""
    namespace: str
    analysis_period_start: datetime
    analysis_period_end: datetime
    total_recommendations: int
    estimated_monthly_savings: float
    recommendations: List[ResourceRecommendation]
    summary: Dict[str, Any]

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

        self.k8s_client = kubernetes.client.CoreV1Api()
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

    def collect_prometheus_metrics(self, query: str, start_time: datetime,
                                  end_time: datetime, step: str = '5m') -> List[Dict]:
        """Collect metrics from Prometheus."""
        if not self.prometheus_client:
            logger.warning("Prometheus client not available")
            return []

        try:
            result = self.prometheus_client.custom_query_range(
                query=query,
                start_time=start_time,
                end_time=end_time,
                step=step
            )
            return result
        except Exception as e:
            logger.error(f"Failed to collect Prometheus metrics: {e}")
            return []

    def collect_kubernetes_metrics(self, namespace: str) -> List[Dict]:
        """Collect Kubernetes resource metrics."""
        if not self.k8s_client:
            logger.warning("Kubernetes client not available")
            return []

        metrics = []

        try:
            # Get pods in namespace
            pods = self.k8s_client.list_namespaced_pod(namespace)

            for pod in pods.items:
                pod_metrics = {
                    'name': pod.metadata.name,
                    'namespace': pod.metadata.namespace,
                    'cpu_request': 0,
                    'memory_request': 0,
                    'cpu_limit': 0,
                    'memory_limit': 0
                }

                # Calculate resource requests and limits
                if pod.spec.containers:
                    for container in pod.spec.containers:
                        resources = container.resources or {}
                        requests = resources.requests or {}
                        limits = resources.limits or {}

                        # CPU requests/limits
                        if requests.get('cpu'):
                            pod_metrics['cpu_request'] += self._parse_cpu(requests['cpu'])
                        if limits.get('cpu'):
                            pod_metrics['cpu_limit'] += self._parse_cpu(limits['cpu'])

                        # Memory requests/limits
                        if requests.get('memory'):
                            pod_metrics['memory_request'] += self._parse_memory(requests['memory'])
                        if limits.get('memory'):
                            pod_metrics['memory_limit'] += self._parse_memory(limits['memory'])

                metrics.append(pod_metrics)

        except Exception as e:
            logger.error(f"Failed to collect Kubernetes metrics: {e}")

        return metrics

    def _parse_cpu(self, cpu_str: str) -> float:
        """Parse CPU string to millicores."""
        if not cpu_str:
            return 0

        cpu_str = cpu_str.lower().strip()
        if cpu_str.endswith('m'):
            return float(cpu_str[:-1])
        else:
            return float(cpu_str) * 1000

    def _parse_memory(self, memory_str: str) -> float:
        """Parse memory string to MB."""
        if not memory_str:
            return 0

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
            return float(memory_str) / (1024 * 1024)  # Assume bytes

    def collect_cloudwatch_metrics(self, namespace: str, start_time: datetime,
                                 end_time: datetime) -> List[Dict]:
        """Collect CloudWatch metrics."""
        if not self.cloudwatch_client:
            logger.warning("CloudWatch client not available")
            return []

        metrics = []

        try:
            # EKS cluster metrics
            if self.config.get('cloudwatch', {}).get('cluster_name'):
                cluster_name = self.config['cloudwatch']['cluster_name']

                # CPU utilization
                cpu_metrics = self.cloudwatch_client.get_metric_statistics(
                    Namespace='ContainerInsights',
                    MetricName='cpu_utilization',
                    Dimensions=[
                        {'Name': 'ClusterName', 'Value': cluster_name},
                        {'Name': 'Namespace', 'Value': namespace}
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=300,  # 5 minutes
                    Statistics=['Average', 'Maximum', 'Minimum']
                )

                # Memory utilization
                memory_metrics = self.cloudwatch_client.get_metric_statistics(
                    Namespace='ContainerInsights',
                    MetricName='memory_utilization',
                    Dimensions=[
                        {'Name': 'ClusterName', 'Value': cluster_name},
                        {'Name': 'Namespace', 'Value': namespace}
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=300,
                    statistics=['Average', 'Maximum', 'Minimum']
                )

                metrics.extend(cpu_metrics['Datapoints'])
                metrics.extend(memory_metrics['Datapoints'])

        except Exception as e:
            logger.error(f"Failed to collect CloudWatch metrics: {e}")

        return metrics

class ResourceAnalyzer:
    """Analyzes resource usage and generates recommendations."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics_collector = MetricsCollector(config)

    def analyze_namespace(self, namespace: str, analysis_days: int = 7) -> OptimizationReport:
        """Analyze resource usage for a namespace."""
        logger.info(f"Analyzing namespace: {namespace}")

        end_time = datetime.now()
        start_time = end_time - timedelta(days=analysis_days)

        # Collect metrics
        prometheus_metrics = self._collect_usage_metrics(namespace, start_time, end_time)
        k8s_metrics = self.metrics_collector.collect_kubernetes_metrics(namespace)

        # Generate recommendations
        recommendations = self._generate_recommendations(prometheus_metrics, k8s_metrics)

        # Calculate potential savings
        total_savings = self._calculate_savings(recommendations)

        # Create report
        report = OptimizationReport(
            namespace=namespace,
            analysis_period_start=start_time,
            analysis_period_end=end_time,
            total_recommendations=len(recommendations),
            estimated_monthly_savings=total_savings,
            recommendations=recommendations,
            summary=self._generate_summary(recommendations, prometheus_metrics)
        )

        return report

    def _collect_usage_metrics(self, namespace: str, start_time: datetime,
                              end_time: datetime) -> Dict[str, List[float]]:
        """Collect resource usage metrics."""
        metrics = {
            'cpu_usage': [],
            'memory_usage': [],
            'request_count': [],
            'response_time': [],
            'error_rate': []
        }

        if not self.metrics_collector.prometheus_client:
            logger.warning("Prometheus not available, using mock data")
            return self._generate_mock_metrics()

        try:
            # CPU usage
            cpu_query = f'rate(container_cpu_usage_seconds_total{{namespace="{namespace}"}}[5m]) * 100'
            cpu_result = self.metrics_collector.collect_prometheus_metrics(
                cpu_query, start_time, end_time
            )
            for metric in cpu_result:
                if metric.get('values'):
                    values = [float(v[1]) for v in metric['values']]
                    metrics['cpu_usage'].extend(values)

            # Memory usage
            memory_query = f'(container_memory_working_set_bytes{{namespace="{namespace}"}} / container_spec_memory_limit_bytes{{namespace="{namespace}"}}) * 100'
            memory_result = self.metrics_collector.collect_prometheus_metrics(
                memory_query, start_time, end_time
            )
            for metric in memory_result:
                if metric.get('values'):
                    values = [float(v[1]) for v in metric['values']]
                    metrics['memory_usage'].extend(values)

            # Request count (if applicable)
            request_query = f'rate(http_requests_total{{namespace="{namespace}"}}[5m])'
            request_result = self.metrics_collector.collect_prometheus_metrics(
                request_query, start_time, end_time
            )
            for metric in request_result:
                if metric.get('values'):
                    values = [float(v[1]) for v in metric['values']]
                    metrics['request_count'].extend(values)

            # Response time
            response_time_query = f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{namespace="{namespace}"}}[5m])) * 1000'
            response_time_result = self.metrics_collector.collect_prometheus_metrics(
                response_time_query, start_time, end_time
            )
            for metric in response_time_result:
                if metric.get('values'):
                    values = [float(v[1]) for v in metric['values']]
                    metrics['response_time'].extend(values)

            # Error rate
            error_query = f'rate(http_requests_total{{namespace="{namespace}",status=~"5.."}}[5m]) / rate(http_requests_total{{namespace="{namespace}"}}[5m]) * 100'
            error_result = self.metrics_collector.collect_prometheus_metrics(
                error_query, start_time, end_time
            )
            for metric in error_result:
                if metric.get('values'):
                    values = [float(v[1]) for v in metric['values']]
                    metrics['error_rate'].extend(values)

        except Exception as e:
            logger.error(f"Failed to collect usage metrics: {e}")
            return self._generate_mock_metrics()

        return metrics

    def _generate_mock_metrics(self) -> Dict[str, List[float]]:
        """Generate mock metrics for testing."""
        import random
        return {
            'cpu_usage': [random.uniform(20, 80) for _ in range(100)],
            'memory_usage': [random.uniform(30, 70) for _ in range(100)],
            'request_count': [random.uniform(50, 200) for _ in range(100)],
            'response_time': [random.uniform(100, 500) for _ in range(100)],
            'error_rate': [random.uniform(0, 2) for _ in range(100)]
        }

    def _generate_recommendations(self, prometheus_metrics: Dict[str, List[float]],
                                  k8s_metrics: List[Dict]) -> List[ResourceRecommendation]:
        """Generate resource optimization recommendations."""
        recommendations = []

        for pod_metric in k8s_metrics:
            # Calculate usage statistics
            cpu_usage = statistics.mean(prometheus_metrics['cpu_usage']) if prometheus_metrics['cpu_usage'] else 50
            memory_usage = statistics.mean(prometheus_metrics['memory_usage']) if prometheus_metrics['memory_usage'] else 50
            cpu_usage_p95 = np.percentile(prometheus_metrics['cpu_usage'], 95) if prometheus_metrics['cpu_usage'] else 80
            memory_usage_p95 = np.percentile(prometheus_metrics['memory_usage'], 95) if prometheus_metrics['memory_usage'] else 80

            current_cpu_request = pod_metric['cpu_request']
            current_memory_request = pod_metric['memory_request']
            current_cpu_limit = pod_metric['cpu_limit']
            current_memory_limit = pod_metric['memory_limit']

            # Calculate recommended requests (P95 usage + buffer)
            recommended_cpu_request = cpu_usage_p95 * 1.2  # 20% buffer
            recommended_memory_request = memory_usage_p95 * 1.2

            # Calculate recommended limits (higher buffer for burst capacity)
            recommended_cpu_limit = cpu_usage_p95 * 2.0  # 100% buffer
            recommended_memory_limit = memory_usage_p95 * 1.5  # 50% buffer

            # Calculate potential savings
            cpu_savings = max(0, current_cpu_request - recommended_cpu_request)
            memory_savings = max(0, current_memory_request - recommended_memory_request)

            # Convert to cost (simplified calculation)
            cost_per_cpu_millicore = 0.014  # $0.014 per vCPU-hour = $0.000014 per millicore-hour
            cost_per_mb = 0.000016  # $0.016 per GB-hour = $0.000016 per MB-hour

            monthly_cpu_savings = (cpu_savings / 1000) * 24 * 30 * cost_per_cpu_millicore
            monthly_memory_savings = memory_savings * 24 * 30 * cost_per_mb
            total_monthly_savings = monthly_cpu_savings + monthly_memory_savings

            # Calculate potential savings percentage
            current_monthly_cost = ((current_cpu_request / 1000) * 24 * 30 * cost_per_cpu_millicore +
                                   current_memory_request * 24 * 30 * cost_per_mb)
            potential_savings_percent = (total_monthly_savings / current_monthly_cost * 100) if current_monthly_cost > 0 else 0

            # Determine rationale and confidence
            rationale_parts = []
            confidence_score = 0.5

            if current_cpu_request > 0 and cpu_usage_p95 < (current_cpu_request * 0.7):
                rationale_parts.append(f"CPU usage ({cpu_usage_p95:.1f}%) significantly below request ({current_cpu_request}m)")
                confidence_score += 0.2

            if current_memory_request > 0 and memory_usage_p95 < (current_memory_request * 0.7):
                rationale_parts.append(f"Memory usage ({memory_usage_p95:.1f}%) significantly below request ({current_memory_request}MB)")
                confidence_score += 0.2

            if len(prometheus_metrics['cpu_usage']) > 50:
                rationale_parts.append("Sufficient data points collected (7-day analysis)")
                confidence_score += 0.1

            if cpu_usage_p95 < 30:
                rationale_parts.append("Consistently low CPU utilization")
                confidence_score += 0.1

            if memory_usage_p95 < 40:
                rationale_parts.append("Consistently low memory utilization")
                confidence_score += 0.1

            # Only generate recommendation if there's significant over-provisioning
            if potential_savings_percent > 10:
                recommendation = ResourceRecommendation(
                    resource_type="pod",
                    resource_name=pod_metric['name'],
                    current_request_cpu=current_cpu_request,
                    current_request_memory=current_memory_request,
                    recommended_request_cpu=recommended_cpu_request,
                    recommended_request_memory=recommended_memory_request,
                    current_limit_cpu=current_cpu_limit,
                    current_limit_memory=current_memory_limit,
                    recommended_limit_cpu=recommended_cpu_limit,
                    recommended_limit_memory=recommended_memory_limit,
                    potential_savings_percent=potential_savings_percent,
                    confidence_score=min(confidence_score, 1.0),
                    rationale="; ".join(rationale_parts) if rationale_parts else "Resource optimization based on usage patterns",
                    implementation_complexity="low" if potential_savings_percent < 30 else "medium"
                )
                recommendations.append(recommendation)

        return recommendations

    def _calculate_savings(self, recommendations: List[ResourceRecommendation]) -> float:
        """Calculate total estimated monthly savings."""
        total_savings = 0.0
        cost_per_cpu_millicore = 0.014  # $0.014 per vCPU-hour
        cost_per_mb = 0.000016  # $0.016 per GB-hour

        for rec in recommendations:
            cpu_savings = max(0, rec.current_request_cpu - rec.recommended_request_cpu)
            memory_savings = max(0, rec.current_request_memory - rec.recommended_request_memory)

            monthly_cpu_savings = (cpu_savings / 1000) * 24 * 30 * cost_per_cpu_millicore
            monthly_memory_savings = memory_savings * 24 * 30 * cost_per_mb
            total_savings += monthly_cpu_savings + monthly_memory_savings

        return total_savings

    def _generate_summary(self, recommendations: List[ResourceRecommendation],
                         prometheus_metrics: Dict[str, List[float]]) -> Dict[str, Any]:
        """Generate summary statistics."""
        total_recommendations = len(recommendations)
        high_confidence_recs = [r for r in recommendations if r.confidence_score > 0.8]
        low_complexity_recs = [r for r in recommendations if r.implementation_complexity == "low"]

        avg_cpu_usage = statistics.mean(prometheus_metrics['cpu_usage']) if prometheus_metrics['cpu_usage'] else 0
        avg_memory_usage = statistics.mean(prometheus_metrics['memory_usage']) if prometheus_metrics['memory_usage'] else 0

        return {
            'total_recommendations': total_recommendations,
            'high_confidence_recommendations': len(high_confidence_recs),
            'low_complexity_recommendations': len(low_complexity_recs),
            'average_cpu_usage_percent': round(avg_cpu_usage, 2),
            'average_memory_usage_percent': round(avg_memory_usage, 2),
            'recommendations_by_complexity': {
                'low': len([r for r in recommendations if r.implementation_complexity == "low"]),
                'medium': len([r for r in recommendations if r.implementation_complexity == "medium"]),
                'high': len([r for r in recommendations if r.implementation_complexity == "high"])
            },
            'potential_savings_distribution': {
                'under_20_percent': len([r for r in recommendations if r.potential_savings_percent < 20]),
                '20_to_50_percent': len([r for r in recommendations if 20 <= r.potential_savings_percent < 50]),
                'over_50_percent': len([r for r in recommendations if r.potential_savings_percent >= 50])
            }
        }

class OptimizationReporter:
    """Generates optimization reports."""

    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

    def generate_report(self, report: OptimizationReport, format: str = "html") -> str:
        """Generate optimization report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format.lower() == "html":
            return self._generate_html_report(report, timestamp)
        elif format.lower() == "json":
            return self._generate_json_report(report, timestamp)
        elif format.lower() == "csv":
            return self._generate_csv_report(report, timestamp)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def _generate_html_report(self, report: OptimizationReport, timestamp: str) -> str:
        """Generate HTML report."""
        report_file = self.output_dir / f"resource-optimization-{report.namespace}-{timestamp}.html"

        html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam Resource Optimization Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #2c3e50; color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 8px 8px 0 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-card h3 { margin: 0 0 10px 0; font-size: 16px; }
        .metric-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .metric-label { font-size: 14px; opacity: 0.9; }
        .section { margin: 30px 0; }
        .section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .recommendation { background: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .recommendation.high-savings { border-left-color: #e74c3c; }
        .recommendation.medium-savings { border-left-color: #f39c12; }
        .recommendation.low-savings { border-left-color: #27ae60; }
        .confidence-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 10px; }
        .confidence-high { background-color: #d4edda; color: #155724; }
        .confidence-medium { background-color: #fff3cd; color: #856404; }
        .confidence-low { background-color: #f8d7da; color: #721c24; }
        .complexity-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 5px; }
        .complexity-low { background-color: #d1ecf1; color: #0c5460; }
        .complexity-medium { background-color: #fff3cd; color: #856404; }
        .complexity-high { background-color: #f8d7da; color: #721c24; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .chart-container { margin: 20px 0; }
        .savings-positive { color: #27ae60; font-weight: bold; }
        .savings-negative { color: #e74c3c; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QuantumBeam Resource Optimization Report</h1>
            <p>Namespace: <strong>{{ namespace }}</strong></p>
            <p>Analysis Period: <strong>{{ analysis_period_start }}</strong> to <strong>{{ analysis_period_end }}</strong></p>
            <p>Generated: <strong>{{ generation_time }}</strong></p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <h3>Total Recommendations</h3>
                <div class="metric-value">{{ total_recommendations }}</div>
                <div class="metric-label">Optimization opportunities</div>
            </div>
            <div class="metric-card">
                <h3>Estimated Monthly Savings</h3>
                <div class="metric-value">${{ estimated_monthly_savings }}</div>
                <div class="metric-label">Potential cost reduction</div>
            </div>
            <div class="metric-card">
                <h3>Average CPU Usage</h3>
                <div class="metric-value">{{ avg_cpu_usage }}%</div>
                <div class="metric-label">Current utilization</div>
            </div>
            <div class="metric-card">
                <h3>Average Memory Usage</h3>
                <div class="metric-value">{{ avg_memory_usage }}%</div>
                <div class="metric-label">Current utilization</div>
            </div>
        </div>

        <div class="section">
            <h2>Recommendations Overview</h2>
            <div class="chart-container">
                <canvas id="savingsChart" width="400" height="200"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="complexityChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="section">
            <h2>Detailed Recommendations</h2>
            {% for rec in recommendations %}
            <div class="recommendation {% if rec.potential_savings_percent > 50 %}high-savings{% elif rec.potential_savings_percent > 20 %}medium-savings{% else %}low-savings{% endif %}">
                <h4>{{ rec.resource_name }}
                    <span class="confidence-badge confidence-{{ 'high' if rec.confidence_score > 0.8 else 'medium' if rec.confidence_score > 0.5 else 'low' }}">
                        {{ (rec.confidence_score * 100)|int }}% confidence
                    </span>
                    <span class="complexity-badge complexity-{{ rec.implementation_complexity }}">
                        {{ rec.implementation_complexity }} complexity
                    </span>
                </h4>
                <p><strong>Potential Savings:</strong>
                    <span class="savings-positive">{{ "%.1f"|format(rec.potential_savings_percent) }}%</span>
                </p>
                <p><strong>Rationale:</strong> {{ rec.rationale }}</p>

                <table style="width: 100%; margin-top: 15px;">
                    <tr>
                        <th>Resource</th>
                        <th>Current Request</th>
                        <th>Recommended Request</th>
                        <th>Current Limit</th>
                        <th>Recommended Limit</th>
                    </tr>
                    <tr>
                        <td>CPU</td>
                        <td>{{ "%.0f"|format(rec.current_request_cpu) }}m</td>
                        <td><span class="savings-positive">{{ "%.0f"|format(rec.recommended_request_cpu) }}m</span></td>
                        <td>{{ "%.0f"|format(rec.current_limit_cpu) }}m</td>
                        <td><span class="savings-positive">{{ "%.0f"|format(rec.recommended_limit_cpu) }}m</span></td>
                    </tr>
                    <tr>
                        <td>Memory</td>
                        <td>{{ "%.0f"|format(rec.current_request_memory) }}MB</td>
                        <td><span class="savings-positive">{{ "%.0f"|format(rec.recommended_request_memory) }}MB</span></td>
                        <td>{{ "%.0f"|format(rec.current_limit_memory) }}MB</td>
                        <td><span class="savings-positive">{{ "%.0f"|format(rec.recommended_limit_memory) }}MB</span></td>
                    </tr>
                </table>
            </div>
            {% endfor %}
        </div>

        <div class="section">
            <h2>Summary Statistics</h2>
            <table>
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td>High Confidence Recommendations</td><td>{{ summary.high_confidence_recommendations }}</td></tr>
                <tr><td>Low Complexity Recommendations</td><td>{{ summary.low_complexity_recommendations }}</td></tr>
                <tr><td>Recommendations with < 20% Savings</td><td>{{ summary.potential_savings_distribution.under_20_percent }}</td></tr>
                <tr><td>Recommendations with 20-50% Savings</td><td>{{ summary.potential_savings_distribution.20_to_50_percent }}</td></tr>
                <tr><td>Recommendations with > 50% Savings</td><td>{{ summary.potential_savings_distribution.over_50_percent }}</td></tr>
            </table>
        </div>
    </div>

    <script>
        // Savings distribution chart
        const savingsCtx = document.getElementById('savingsChart').getContext('2d');
        new Chart(savingsCtx, {
            type: 'pie',
            data: {
                labels: ['< 20% Savings', '20-50% Savings', '> 50% Savings'],
                datasets: [{
                    data: [
                        {{ summary.potential_savings_distribution.under_20_percent }},
                        {{ summary.potential_savings_distribution.20_to_50_percent }},
                        {{ summary.potential_savings_distribution.over_50_percent }}
                    ],
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Savings Distribution'
                    }
                }
            }
        });

        // Complexity distribution chart
        const complexityCtx = document.getElementById('complexityChart').getContext('2d');
        new Chart(complexityCtx, {
            type: 'bar',
            data: {
                labels: ['Low Complexity', 'Medium Complexity', 'High Complexity'],
                datasets: [{
                    label: 'Number of Recommendations',
                    data: [
                        {{ summary.recommendations_by_complexity.low }},
                        {{ summary.recommendations_by_complexity.medium }},
                        {{ summary.recommendations_by_complexity.high }}
                    ],
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Implementation Complexity Distribution'
                    }
                }
            }
        });
    </script>
</body>
</html>
        """

        # Prepare template data
        from jinja2 import Template
        template = Template(html_template)

        html_content = template.render(
            namespace=report.namespace,
            analysis_period_start=report.analysis_period_start.strftime('%Y-%m-%d'),
            analysis_period_end=report.analysis_period_end.strftime('%Y-%m-%d'),
            generation_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            total_recommendations=report.total_recommendations,
            estimated_monthly_savings=f"{report.estimated_monthly_savings:.2f}",
            avg_cpu_usage=report.summary.get('average_cpu_usage_percent', 0),
            avg_memory_usage=report.summary.get('average_memory_usage_percent', 0),
            recommendations=report.recommendations,
            summary=report.summary
        )

        with open(report_file, 'w') as f:
            f.write(html_content)

        logger.info(f"HTML report generated: {report_file}")
        return str(report_file)

    def _generate_json_report(self, report: OptimizationReport, timestamp: str) -> str:
        """Generate JSON report."""
        report_file = self.output_dir / f"resource-optimization-{report.namespace}-{timestamp}.json"

        # Convert datetime objects to strings for JSON serialization
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        with open(report_file, 'w') as f:
            json.dump(asdict(report), f, indent=2, default=json_serializer)

        logger.info(f"JSON report generated: {report_file}")
        return str(report_file)

    def _generate_csv_report(self, report: OptimizationReport, timestamp: str) -> str:
        """Generate CSV report."""
        report_file = self.output_dir / f"resource-optimization-{report.namespace}-{timestamp}.csv"

        import csv

        if not report.recommendations:
            logger.warning("No recommendations to export")
            return str(report_file)

        with open(report_file, 'w', newline='') as f:
            fieldnames = [
                'resource_name', 'current_request_cpu', 'recommended_request_cpu',
                'current_request_memory', 'recommended_request_memory',
                'current_limit_cpu', 'recommended_limit_cpu',
                'current_limit_memory', 'recommended_limit_memory',
                'potential_savings_percent', 'confidence_score',
                'implementation_complexity', 'rationale'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for rec in report.recommendations:
                row = {
                    'resource_name': rec.resource_name,
                    'current_request_cpu': rec.current_request_cpu,
                    'recommended_request_cpu': rec.recommended_request_cpu,
                    'current_request_memory': rec.current_request_memory,
                    'recommended_request_memory': rec.recommended_request_memory,
                    'current_limit_cpu': rec.current_limit_cpu,
                    'recommended_limit_cpu': rec.recommended_limit_cpu,
                    'current_limit_memory': rec.current_limit_memory,
                    'recommended_limit_memory': rec.recommended_limit_memory,
                    'potential_savings_percent': rec.potential_savings_percent,
                    'confidence_score': rec.confidence_score,
                    'implementation_complexity': rec.implementation_complexity,
                    'rationale': rec.rationale
                }
                writer.writerow(row)

        logger.info(f"CSV report generated: {report_file}")
        return str(report_file)

class ResourceOptimizer:
    """Main resource optimization tool."""

    def __init__(self, config_file: str = None):
        """Initialize resource optimizer."""
        self.config_file = config_file or 'resource-optimizer-config.yaml'
        self.config = self._load_config()
        self.analyzer = ResourceAnalyzer(self.config)
        self.reporter = OptimizationReporter(self.config.get('output_dir', './reports'))

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file."""
        config_path = Path(self.config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            # Return default configuration
            return {
                'prometheus': {
                    'url': 'http://prometheus:9090',
                    'headers': {}
                },
                'cloudwatch': {
                    'region': 'us-east-1',
                    'cluster_name': 'quantumbeam-cluster'
                },
                'output_dir': './reports',
                'cost_calculation': {
                    'cost_per_cpu_millicore': 0.014,
                    'cost_per_mb': 0.000016
                },
                'optimization_thresholds': {
                    'min_savings_percent': 10,
                    'high_confidence_threshold': 0.8,
                    'usage_buffer_percent': 20
                }
            }

    def optimize_namespace(self, namespace: str, analysis_days: int = 7,
                          output_format: str = "html") -> str:
        """Run optimization analysis for a namespace."""
        logger.info(f"Starting resource optimization for namespace: {namespace}")

        # Analyze resources
        report = self.analyzer.analyze_namespace(namespace, analysis_days)

        # Generate report
        report_file = self.reporter.generate_report(report, output_format)

        logger.info(f"Optimization analysis completed. Report: {report_file}")
        return report_file

    def optimize_all_namespaces(self, namespaces: List[str] = None,
                               analysis_days: int = 7,
                               output_format: str = "html") -> List[str]:
        """Run optimization analysis for all namespaces."""
        if not namespaces:
            # Get all namespaces
            try:
                kubernetes.config.load_incluster_config()
            except kubernetes.config.ConfigException:
                kubernetes.config.load_kube_config()

            v1 = kubernetes.client.CoreV1Api()
            namespaces = [ns.metadata.name for ns in v1.list_namespace().items
                         if not ns.metadata.name.startswith('kube-')]

        report_files = []
        for namespace in namespaces:
            try:
                report_file = self.optimize_namespace(namespace, analysis_days, output_format)
                report_files.append(report_file)
            except Exception as e:
                logger.error(f"Failed to analyze namespace {namespace}: {e}")

        return report_files

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Resource Optimization Tool')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--namespace', help='Namespace to analyze')
    parser.add_argument('--all-namespaces', action='store_true', help='Analyze all namespaces')
    parser.add_argument('--analysis-days', type=int, default=7, help='Number of days to analyze')
    parser.add_argument('--output-format', choices=['html', 'json', 'csv'], default='html', help='Report format')
    parser.add_argument('--output-dir', default='./reports', help='Output directory for reports')

    args = parser.parse_args()

    try:
        # Initialize optimizer
        optimizer = ResourceOptimizer(args.config)

        if args.namespace:
            # Analyze specific namespace
            report_file = optimizer.optimize_namespace(
                args.namespace,
                args.analysis_days,
                args.output_format
            )
            print(f"Optimization report generated: {report_file}")

        elif args.all_namespaces:
            # Analyze all namespaces
            report_files = optimizer.optimize_all_namespaces(
                analysis_days=args.analysis_days,
                output_format=args.output_format
            )
            print(f"Generated {len(report_files)} optimization reports:")
            for report_file in report_files:
                print(f"  - {report_file}")

        else:
            print("Please specify either --namespace or --all-namespaces")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Resource optimization failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
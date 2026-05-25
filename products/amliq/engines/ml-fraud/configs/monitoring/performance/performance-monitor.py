#!/usr/bin/env python3
"""
QuantumBeam Performance Monitoring and Alerting System
Advanced performance monitoring with intelligent alerting and anomaly detection.
"""

import os
import sys
import json
import yaml
import time
import logging
import asyncio
import statistics
import smtplib
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Callable
from dataclasses import dataclass, asdict
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import boto3
from botocore.exceptions import ClientError
import prometheus_api_client
import numpy as np
import pandas as pd
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
class PerformanceMetric:
    """Performance metric definition."""
    name: str
    description: str
    prometheus_query: str
    unit: str
    thresholds: Dict[str, float]  # warning, critical, info
    aggregation: str  # avg, max, min, sum, count
    evaluation_period: int  # seconds
    labels: Dict[str, str]

@dataclass
class PerformanceAlert:
    """Performance alert definition."""
    name: str
    description: str
    severity: str  # info, warning, critical
    metric_name: str
    condition: str  # gt, lt, eq, ne
    threshold: float
    duration: int  # seconds
    labels: Dict[str, str]
    channels: List[str]  # email, slack, pagerduty, webhook
    enabled: bool

@dataclass
class AlertRule:
    """Alert rule with conditions and actions."""
    name: str
    description: str
    metrics: List[PerformanceMetric]
    alerts: List[PerformanceAlert]
    evaluation_window: int  # seconds
    consecutive_fails: int
    cooldown_period: int  # seconds
    enabled: bool

@dataclass
class AlertEvent:
    """Alert event record."""
    timestamp: datetime
    rule_name: str
    alert_name: str
    severity: str
    status: str  # firing, resolved
    metric_value: float
    threshold: float
    message: str
    labels: Dict[str, str]
    channels: List[str]
    duration_seconds: int

class MetricsCollector:
    """Collects performance metrics from Prometheus."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.prometheus_client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize Prometheus client."""
        try:
            self.prometheus_client = PrometheusConnect(
                url=self.config['prometheus']['url'],
                headers=self.config['prometheus'].get('headers', {})
            )
            logger.info("Prometheus client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Prometheus client: {e}")
            raise

    def collect_metric(self, metric: PerformanceMetric,
                         start_time: datetime = None,
                         end_time: datetime = None) -> Dict[str, Any]:
        """Collect metric data from Prometheus."""
        try:
            if not start_time:
                start_time = datetime.now() - timedelta(seconds=metric.evaluation_period)
            if not end_time:
                end_time = datetime.now()

            result = self.prometheus_client.custom_query_range(
                query=metric.prometheus_query,
                start_time=start_time,
                end_time=end_time,
                step='60'  # 1 minute resolution
            )

            if result and len(result) > 0:
                # Process results based on aggregation
                values = []
                for data_point in result[0].get('values', []):
                    try:
                        values.append(float(data_point[1]))
                    except (ValueError, IndexError):
                        continue

                if values:
                    aggregated_value = self._aggregate_values(values, metric.aggregation)

                    # Check thresholds
                    threshold_status = self._check_thresholds(aggregated_value, metric.thresholds)

                    return {
                        'value': aggregated_value,
                        'values': values,
                        'threshold_status': threshold_status,
                        'timestamp': end_time,
                        'evaluation_period': metric.evaluation_period,
                        'unit': metric.unit
                    }

            return {
                'value': 0.0,
                'values': [],
                'threshold_status': 'unknown',
                'timestamp': end_time,
                'evaluation_period': metric.evaluation_period,
                'unit': metric.unit
            }

        except Exception as e:
            logger.error(f"Failed to collect metric {metric.name}: {e}")
            return {
                'value': 0.0,
                'values': [],
                'threshold_status': 'error',
                'timestamp': datetime.now(),
                'evaluation_period': metric.evaluation_period,
                'unit': metric.unit
            }

    def _aggregate_values(self, values: List[float], aggregation: str) -> float:
        """Aggregate metric values."""
        if not values:
            return 0.0

        if aggregation == 'avg':
            return statistics.mean(values)
        elif aggregation == 'max':
            return max(values)
        elif aggregation == 'min':
            return min(values)
        elif aggregation == 'sum':
            return sum(values)
        elif aggregation == 'count':
            return len(values)
        else:
            return statistics.mean(values)

    def _check_thresholds(self, value: float, thresholds: Dict[str, float]) -> str:
        """Check if value crosses any thresholds."""
        if thresholds.get('critical') and value >= thresholds['critical']:
            return 'critical'
        elif thresholds.get('warning') and value >= thresholds['warning']:
            return 'warning'
        elif thresholds.get('info') and value >= thresholds['info']:
            return 'info'
        else:
            return 'normal'

class AlertManager:
    """Manages alert rules and notifications."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.rules = []
        self.active_alerts = {}  # alert_name -> AlertEvent
        self.alert_history = []
        self._initialize_rules()
        self._initialize_channels()

    def _initialize_rules(self):
        """Initialize alert rules from configuration."""
        rules_config = self.config.get('rules', [])

        for rule_config in rules_config:
            # Create metrics
            metrics = []
            for metric_config in rule_config.get('metrics', []):
                metric = PerformanceMetric(
                    name=metric_config['name'],
                    description=metric_config.get('description', ''),
                    prometheus_query=metric_config['prometheus_query'],
                    unit=metric_config.get('unit', ''),
                    thresholds=metric_config.get('thresholds', {}),
                    aggregation=metric_config.get('aggregation', 'avg'),
                    evaluation_period=metric_config.get('evaluation_period', 300),
                    labels=metric_config.get('labels', {})
                )
                metrics.append(metric)

            # Create alerts
            alerts = []
            for alert_config in rule_config.get('alerts', []):
                alert = PerformanceAlert(
                    name=alert_config['name'],
                    description=alert_config.get('description', ''),
                    severity=alert_config.get('severity', 'warning'),
                    metric_name=alert_config['metric_name'],
                    condition=alert_config.get('condition', 'gt'),
                    threshold=alert_config.get('threshold', 0),
                    duration=alert_config.get('duration', 300),
                    labels=alert_config.get('labels', {}),
                    channels=alert_config.get('channels', ['email']),
                    enabled=alert_config.get('enabled', True)
                )
                alerts.append(alert)

            # Create rule
            rule = AlertRule(
                name=rule_config['name'],
                description=rule_config.get('description', ''),
                metrics=metrics,
                alerts=alerts,
                evaluation_window=rule_config.get('evaluation_window', 300),
                consecutive_fails=rule_config.get('consecutive_fails', 2),
                cooldown_period=rule_config.get('cooldown_period', 900),
                enabled=rule_config.get('enabled', True)
            )
            self.rules.append(rule)

        logger.info(f"Loaded {len(self.rules)} alert rules")

    def _initialize_channels(self):
        """Initialize notification channels."""
        # Initialize email channel
        if self.config.get('channels', {}).get('email', {}).get('enabled', True):
            self.email_config = self.config['channels']['email']
            logger.info("Email notification channel initialized")

        # Initialize Slack channel
        if self.config.get('channels', {}).get('slack', {}).get('enabled', True):
            self.slack_config = self.config['channels']['slack']
            logger.info("Slack notification channel initialized")

        # Initialize PagerDuty channel
        if self.config.get('channels', {}).get('pagerduty', {}).get('enabled', True):
            self.pagerduty_config = self.config['channels']['pagerduty']
            logger.info("PagerDuty notification channel initialized")

        # Initialize webhook channel
        if self.config.get('channels', {}).get('webhook', {}).get('enabled', True):
            self.webhook_config = self.config['channels']['webhook']
            logger.info("Webhook notification channel initialized")

    def evaluate_rules(self, metrics_collector: MetricsCollector) -> List[AlertEvent]:
        """Evaluate all alert rules and generate events."""
        events = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            try:
                event = self._evaluate_rule(rule, metrics_collector)
                if event:
                    events.append(event)
                    self._process_alert_event(event)
            except Exception as e:
                logger.error(f"Failed to evaluate rule {rule.name}: {e}")

        # Update alert history
        self.alert_history.extend(events)
        if len(self.alert_history) > 1000:
            self.alert_history = self.alert_history[-1000:]

        return events

    def _evaluate_rule(self, rule: AlertRule, metrics_collector: MetricsCollector) -> Optional[AlertEvent]:
        """Evaluate a single alert rule."""
        # Check if we're in cooldown period
        if self._is_in_cooldown(rule):
            return None

        # Check if alert is already active
        for alert in rule.alerts:
            if alert.name in self.active_alerts:
                active_event = self.active_alerts[alert.name]
                # Check if alert should be resolved
                if self._should_resolve_alert(active_event, alert, metrics_collector):
                    return self._resolve_alert(active_event)

        # Evaluate each alert in the rule
        for alert in rule.alerts:
            if not alert.enabled:
                continue

            # Find the corresponding metric
            metric = next((m for m in rule.metrics if m.name == alert.metric_name), None)
            if not metric:
                logger.warning(f"Metric {alert.metric_name} not found for alert {alert.name}")
                continue

            # Collect metric data
            metric_data = metrics_collector.collect_metric(metric)

            # Check if alert condition is met
            condition_met = self._check_condition(
                metric_data['value'], alert.condition, alert.threshold
            )

            if condition_met:
                # Check if alert should fire
                if self._should_fire_alert(rule, alert, metric_data):
                    event = AlertEvent(
                        timestamp=datetime.now(),
                        rule_name=rule.name,
                        alert_name=alert.name,
                        severity=alert.severity,
                        status='firing',
                        metric_value=metric_data['value'],
                        threshold=alert.threshold,
                        message=self._generate_alert_message(alert, metric_data),
                        labels=alert.labels,
                        channels=alert.channels,
                        duration_seconds=0
                    )
                    return event

        return None

    def _check_condition(self, value: float, condition: str, threshold: float) -> bool:
        """Check if a condition is met."""
        if condition == 'gt':
            return value > threshold
        elif condition == 'lt':
            return value < threshold
        elif condition == 'eq':
            return abs(value - threshold) < 0.001
        elif condition == 'ne':
            return abs(value - threshold) >= 0.001
        else:
            return False

    def _is_in_cooldown(self, rule: AlertRule) -> bool:
        """Check if rule is in cooldown period."""
        for alert_name, event in self.active_alerts.items():
            if event.rule_name == rule.name:
                cooldown_elapsed = (datetime.now() - event.timestamp).total_seconds()
                return cooldown_elapsed < rule.cooldown_period
        return False

    def _should_fire_alert(self, rule: AlertRule, alert: PerformanceAlert,
                           metric_data: Dict[str, Any]) -> bool:
        """Determine if alert should fire based on consecutive failures and duration."""
        if alert_name in self.active_alerts:
            # Alert is already active
            return False

        # Check consecutive failures
        # This would require tracking rule evaluation history
        # For now, we'll use a simplified approach based on duration
        if metric_data['threshold_status'] in ['warning', 'critical']:
            return True

        return False

    def _should_resolve_alert(self, active_event: AlertEvent, alert: PerformanceAlert,
                          metrics_collector: MetricsCollector) -> bool:
        """Determine if alert should be resolved."""
        # Find the corresponding metric
        metric = next((m for m in self.metrics_collector.rules
                         if m.name == alert.metric_name), None)
        if not metric:
            return False

        # Collect current metric data
        metric_data = metrics_collector.collect_metric(metric)

        # Check if condition is no longer met
        condition_met = self._check_condition(
            metric_data['value'], alert.condition, alert.threshold
        )

        return not condition_met

    def _resolve_alert(self, active_event: AlertEvent) -> AlertEvent:
        """Create a resolved alert event."""
        resolved_event = AlertEvent(
            timestamp=datetime.now(),
            rule_name=active_event.rule_name,
            alert_name=active_event.alert_name,
            severity=active_event.severity,
            status='resolved',
            metric_value=active_event.metric_value,
            threshold=active_event.threshold,
            message=f"Alert resolved: {active_event.message}",
            labels=active_event.labels,
            channels=active_event.channels,
            duration_seconds=int((datetime.now() - active_event.timestamp).total_seconds())
        )

        # Remove from active alerts
        if active_event.alert_name in self.active_alerts:
            del self.active_alerts[active_event.alert_name]

        return resolved_event

    def _process_alert_event(self, event: AlertEvent):
        """Process an alert event (send notifications)."""
        # Add to active alerts if firing
        if event.status == 'firing':
            self.active_alerts[event.alert_name] = event

        # Send notifications through configured channels
        for channel in event.channels:
            try:
                if channel == 'email':
                    self._send_email_notification(event)
                elif channel == 'slack':
                    self._send_slack_notification(event)
                elif channel == 'pagerduty':
                    self._send_pagerduty_notification(event)
                elif channel == 'webhook':
                    self._send_webhook_notification(event)
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {e}")

    def _send_email_notification(self, event: AlertEvent):
        """Send email notification."""
        if not hasattr(self, 'email_config'):
            return

        try:
            msg = MIMEMultipart()
            msg['From'] = self.email_config['sender']
            msg['To'] = ', '.join(self.email_config['recipients'])
            msg['Subject'] = f"[{event.severity.upper()}] QuantumBeam Alert: {event.alert_name}"

            # Create HTML body
            html_body = f"""
            <html>
            <body>
                <h2>QuantumBeam Performance Alert</h2>
                <table border="1" cellpadding="5" cellspacing="0">
                    <tr>
                        <td><strong>Alert Name:</strong></td>
                        <td>{event.alert_name}</td>
                    </tr>
                    <tr>
                        <td><strong>Severity:</strong></td>
                        <td>{event.severity.upper()}</td>
                    </tr>
                    <tr>
                        <td><strong>Status:</strong></td>
                        <td>{event.status.upper()}</td>
                    </tr>
                    <tr>
                        <td><strong>Metric Value:</strong></td>
                        <td>{event.metric_value}</td>
                    </tr>
                    <tr>
                        <td><strong>Threshold:</strong></td>
                        <td>{event.threshold}</td>
                    </tr>
                    <tr>
                        <td><strong>Time:</strong></td>
                        <td>{event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}</td>
                    </tr>
                    <tr>
                        <td><strong>Duration:</strong></td>
                        <td>{event.duration_seconds} seconds</td>
                    </tr>
                </table>

                <h3>Message:</h3>
                <p>{event.message}</p>

                <p><em>This alert was generated by the QuantumBeam Performance Monitoring System.</em></p>
            </body>
            </html>
            """

            msg.attach(MIMEText(html_body, 'html'))
            msg['Subject'] = f"[{event.severity.upper()}] QuantumBeam Alert: {event.alert_name}"

            # Send email
            smtp_server = smtplib.SMTP(
                host=self.email_config['smtp_server'],
                port=self.email_config.get('smtp_port', 587),
                timeout=self.email_config.get('timeout', 30)
            )

            if self.email_config.get('use_tls', True):
                smtp_server.starttls()

            if self.email_config.get('username') and self.email_config.get('password'):
                smtp_server.login(
                    self.email_config['username'],
                    self.email_config['password']
                )

            smtp_server.send_message(msg)
            logger.info(f"Email notification sent for alert: {event.alert_name}")

        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")

    def _send_slack_notification(self, event: AlertEvent):
        """Send Slack notification."""
        if not hasattr(self, 'slack_config'):
            return

        try:
            webhook_url = self.slack_config['webhook_url']

            color = {
                'critical': 'danger',
                'warning': 'warning',
                'info': 'good'
            }.get(event.severity, 'warning')

            payload = {
                "attachments": [
                    {
                        "color": color,
                        "fields": [
                            {
                                "title": "Alert",
                                "value": event.alert_name,
                                "short": False
                            },
                            {
                                "title": "Severity",
                                "value": event.severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Status",
                                "value": event.status.upper(),
                                "short": True
                            },
                            {
                                "title": "Metric Value",
                                "value": f"{event.metric_value:.2f}",
                                "short": True
                            },
                            {
                                "title": "Threshold",
                                "value": f"{event.threshold:.2f}",
                                "short": True
                            },
                            {
                                "title": "Message",
                                "value": event.message,
                                "short": False
                            }
                        ],
                        "footer": f"Timestamp: {event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
                    }
                ]
            }

            response = requests.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Slack notification sent for alert: {event.alert_name}")

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")

    def _send_pagerduty_notification(self, event: Event):
        """Send PagerDuty notification."""
        if not hasattr(self, 'pagerduty_config'):
            return

        try:
            integration_key = self.pagerduty_config['integration_key']
            service_key = self.pagerduty_config.get('service_key')

            # Create PagerDuty event
            payload = {
                "routing_key": integration_key,
                "event_action": "trigger",
                "payload": {
                    "summary": f"QuantumBeam Alert: {event.alert_name}",
                    "source": "performance-monitor",
                    "severity": event.severity,
                    "timestamp": event.timestamp.isoformat(),
                    "custom_details": {
                        "rule_name": event.rule_name,
                        "alert_name": event.alert_name,
                        "metric_value": event.metric_value,
                        "threshold": event.threshold,
                        "message": event.message
                    }
                }
            }

            if service_key:
                payload["payload"]["service_key"] = service_key

            response = requests.post(
                "https://events.pagerduty.com/v2/enqueue",
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"PagerDuty notification sent for alert: {event.alert_name}")

        except Exception as e:
            logger.error(f"Failed to send PagerDuty notification: {e}")

    def _send_webhook_notification(self, event: AlertEvent):
        """Send webhook notification."""
        if not hasattr(self, 'webhook_config'):
            return

        try:
            webhook_url = self.webhook_config['url']
            headers = self.webhook_config.get('headers', {})

            payload = {
                "alert_name": event.alert_name,
                "severity": event.severity,
                "status": event.status,
                "timestamp": event.timestamp.isoformat(),
                "metric_value": event.metric_value,
                "threshold": event.threshold,
                "message": event.message,
                "labels": event.labels,
                "rule_name": event.rule_name
            }

            response = requests.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Webhook notification sent for alert: {event.alert_name}")

        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")

    def _generate_alert_message(self, alert: PerformanceAlert,
                              metric_data: Dict[str, Any]) -> str:
        """Generate alert message."""
        return f"{alert.description} - Current value: {metric_data['value']:.2f} (threshold: {alert.threshold:.2f})"

class AnomalyDetector:
    """Detects performance anomalies using statistical methods."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metric_history = {}
        self.anomaly_models = {}

    def detect_anomalies(self, metric_name: str, current_value: float,
                          historical_data: List[float] = None) -> Dict[str, Any]:
        """Detect anomalies in metric data."""
        try:
            if historical_data is None:
                if metric_name in self.metric_history:
                    historical_data = self.metric_history[metric_name]
                else:
                    return self._get_default_anomaly_result()

            if len(historical_data) < 10:
                return self._get_default_anomaly_result()

            # Use Z-score for anomaly detection
            mean = statistics.mean(historical_data)
            std_dev = statistics.stdev(historical_data)

            if std_dev == 0:
                return self._get_default_anomaly_result()

            z_score = (current_value - mean) / std_dev
            is_anomaly = abs(z_score) > 3.0  # 3-sigma rule

            # Calculate anomaly score
            anomaly_score = min(abs(z_score) / 3.0, 1.0)

            return {
                'is_anomaly': is_anomaly,
                'anomaly_score': anomaly_score,
                'z_score': z_score,
                'mean': mean,
                'std_dev': std_dev,
                'current_value': current_value,
                'threshold': 3.0,
                'method': 'z_score'
            }

        except Exception as e:
            logger.error(f"Failed to detect anomalies: {e}")
            return self._get_default_anomaly_result()

    def _get_default_anomaly_result(self) -> Dict[str, Any]:
        """Get default anomaly detection result."""
        return {
            'is_anomaly': False,
            'anomaly_score': 0.0,
            'z_score': 0.0,
            'mean': 0.0,
            'std_dev': 0.0,
            'current_value': 0.0,
            'threshold': 3.0,
            'method': 'none'
        }

    def add_metric_data_point(self, metric_name: str, value: float):
        """Add a data point to metric history."""
        if metric_name not in self.metric_history:
            self.metric_history[metric_name] = []

        self.metric_history[metric_name].append(value)

        # Keep only last 100 data points
        if len(self.metric_history[metric_name]) > 100:
            self.metric_history[metric_name] = self.metric_history[metric_name][-100:]

class PerformanceMonitor:
    """Main performance monitoring system."""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'performance-monitor-config.yaml'
        self.config = self._load_config()
        self.metrics_collector = MetricsCollector(self.config.get('prometheus', {}))
        self.alert_manager = AlertManager(self.config)
        self.anomaly_detector = AnomalyDetector(self.config.get('anomaly_detection', {}))

        self.performance_history = []
        self.monitoring_active = False

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
                'evaluation_interval': 60,  # seconds
                'history_retention_hours': 168,  # 7 days
                'anomaly_detection': {
                    'enabled': True,
                    'z_score_threshold': 3.0
                },
                'channels': {
                    'email': {
                        'enabled': True,
                        'smtp_server': 'smtp.gmail.com',
                        'smtp_port': 587,
                        'use_tls': True,
                        'sender': 'alerts@quantumbeam.io',
                        'recipients': ['team@quantumbeam.io']
                    },
                    'slack': {
                        'enabled': True,
                        'webhook_url': 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
                    },
                    'pagerduty': {
                        'enabled': False,
                        'integration_key': 'your-integration-key',
                        'service_key': 'your-service-key'
                    },
                    'webhook': {
                        'enabled': False,
                        'url': 'https://your-webhook-endpoint.com/alerts'
                    }
                },
                'rules': [
                    {
                        'name': 'high_cpu_usage',
                        'description': 'High CPU utilization',
                        'metrics': [
                            {
                                'name': 'cpu_utilization',
                                'description': 'Average CPU utilization',
                                'prometheus_query': 'rate(container_cpu_usage_seconds_total{namespace="quantumbeam"}[5m]) * 100',
                                'unit': 'percent',
                                'thresholds': {
                                    'warning': 70.0,
                                    'critical': 90.0
                                },
                                'aggregation': 'avg',
                                'evaluation_period': 300,
                                'labels': {'component': 'system'}
                            }
                        ],
                        'alerts': [
                            {
                                'name': 'cpu_high',
                                'description': 'CPU utilization is high',
                                'severity': 'warning',
                                'metric_name': 'cpu_utilization',
                                'condition': 'gt',
                                'threshold': 70.0,
                                'duration': 300,
                                'channels': ['email', 'slack'],
                                'enabled': True
                            },
                            {
                                'name': 'cpu_critical',
                                'description': 'CPU utilization is critical',
                                'severity': 'critical',
                                'metric_name': 'cpu_utilization',
                                'condition': 'gt',
                                'threshold': 90.0,
                                'duration': 300,
                                'channels': ['email', 'slack', 'pagerduty'],
                                'enabled': True
                            }
                        ],
                        'evaluation_window': 300,
                        'consecutive_fails': 2,
                        'cooldown_period': 900,
                        'enabled': True
                    }
                ]
            }

    def start_monitoring(self, interval_seconds: int = 60):
        """Start continuous performance monitoring."""
        logger.info(f"Starting performance monitoring (interval: {interval_seconds}s)")
        self.monitoring_active = True

        async def monitoring_loop():
            while self.monitoring_active:
                    try:
                        logger.info("Evaluating performance metrics...")

                        # Evaluate alert rules
                        events = self.alert_manager.evaluate_rules(self.metrics_collector)

                        if events:
                            logger.info(f"Generated {len(events)} alert events:")
                            for event in events:
                                logger.info(f"  - {event.alert_name} ({event.severity}): {event.message}")

                        # Check for anomalies
                        if self.config['anomaly_detection']['enabled']:
                            self._check_anomalies()

                        # Record performance snapshot
                        self._record_performance_snapshot()

                        # Clean up old data
                        self._cleanup_old_data()

                    except Exception as e:
                        logger.error(f"Error in monitoring loop: {e}")

                    # Wait for next evaluation
                    await asyncio.sleep(interval_seconds)

        # Start monitoring loop
        asyncio.create_task(monitoring_loop())

    def stop_monitoring(self):
        """Stop performance monitoring."""
        logger.info("Stopping performance monitoring")
        self.monitoring_active = False

    def _check_anomalies(self):
        """Check for performance anomalies."""
        try:
            # Get metrics with historical data
            for rule in self.alert_manager.rules:
                for metric in rule.metrics:
                    if metric.name in self.anomaly_detector.metric_history:
                        historical_data = self.anomaly_detector.metric_history[metric.name]

                        # Get current metric value
                        current_data = self.metrics_collector.collect_metric(metric)
                        current_value = current_data['value']

                        # Detect anomalies
                        anomaly_result = self.anomaly_detector.detect_anomalies(
                            metric.name, current_value, historical_data
                        )

                        if anomaly_result['is_anomaly']:
                            logger.warning(
                                f"Anomaly detected in {metric.name}: "
                                f"value={current_value:.2f}, "
                                f"z-score={anomaly_result['z_score']:.2f}"
                            )

                            # Create anomaly alert if not already active
                            anomaly_alert_name = f"{metric.name}_anomaly"
                            if anomaly_alert_name not in self.alert_manager.active_alerts:
                                anomaly_event = AlertEvent(
                                    timestamp=datetime.now(),
                                    rule_name=f"{rule.name}_anomaly",
                                    alert_name=anomaly_alert_name,
                                    severity='warning',
                                    status='firing',
                                    metric_value=current_value,
                                    threshold=anomaly_result['threshold'],
                                    message=f"Anomaly detected: {anomaly_result['method']} "
                                           f"(value={current_value:.2f}, "
                                           f"z-score={anomaly_result['z_score']:.2f})",
                                    labels={'detection_method': anomaly_result['method']},
                                    channels=['slack', 'email'],
                                    duration_seconds=0
                                )
                                self.alert_manager._process_alert_event(anomaly_event)

        except Exception as e:
            logger.error(f"Failed to check anomalies: {e}")

    def _record_performance_snapshot(self):
        """Record current performance snapshot."""
        try:
            snapshot = {
                'timestamp': datetime.now().isoformat(),
                'metrics': {},
                'active_alerts': len(self.alert_manager.active_alerts),
                'total_alerts_today': len([e for e in self.alert_manager.alert_history
                                           if e.timestamp.date() == datetime.now().date()])
            }

            # Collect current metric values
            for rule in self.alert_manager.rules:
                for metric in rule.metrics:
                    metric_data = self.metrics_collector.collect_metric(metric)
                    snapshot['metrics'][metric.name] = {
                        'value': metric_data['value'],
                        'status': metric_data['threshold_status'],
                        'unit': metric_data['unit']
                    }

            self.performance_history.append(snapshot)

            # Keep only last 24 hours of snapshots
            max_snapshots = (24 * 60 * 60) // self.config['evaluation_interval']
            if len(self.performance_history) > max_snapshots:
                self.performance_history = self.performance_history[-max_snapshots:]

        except Exception as e:
            logger.error(f"Failed to record performance snapshot: {e}")

    def _cleanup_old_data(self):
        """Clean up old monitoring data."""
        try:
            retention_hours = self.config.get('history_retention_hours', 168)
            cutoff_time = datetime.now() - timedelta(hours=retention_hours)

            # Clean up performance history
            self.performance_history = [
                s for s in self.performance_history
                if datetime.fromisoformat(s['timestamp']) > cutoff_time
            ]

            # Clean up alert history
            self.alert_manager.alert_history = [
                e for e in self.alert_manager.alert_history
                if e.timestamp > cutoff_time
            ]

            # Clean up anomaly detection history
            for metric_name in list(self.anomaly_detector.metric_history.keys()):
                # Keep only recent data
                max_points = 100
                if len(self.anomaly_detector.metric_history[metric_name]) > max_points:
                    self.anomaly_detector.metric_history[metric_name] = \
                        self.anomaly_detector.metric_history[metric_name][-max_points:]

        except Exception as e:
            logger.error(f"Failed to clean up old data: {e}")

    def generate_performance_report(self, output_file: str = None) -> str:
        """Generate comprehensive performance report."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if not output_file:
            output_file = f'performance-report-{timestamp}.json'

        try:
            # Prepare report data
            report = {
                'timestamp': datetime.now().isoformat(),
                'monitoring_status': 'active' if self.monitoring_active else 'inactive',
                'configuration': {
                    'evaluation_interval': self.config['evaluation_interval'],
                    'history_retention_hours': self.config['history_retention_hours'],
                    'anomaly_detection_enabled': self.config['anomaly_detection']['enabled']
                },
                'summary': {
                    'total_rules': len(self.alert_manager.rules),
                    'active_alerts': len(self.alert_manager.active_alerts),
                    'total_alerts_today': len([e for e in self.alert_manager.alert_history
                                               if e.timestamp.date() == datetime.now().date()]),
                    'anomalies_detected': len(self._get_recent_anomalies())
                },
                'rules': self._get_rules_summary(),
                'active_alerts': [asdict(e) for e in self.alert_manager.active_alerts.values()],
                'recent_alerts': [asdict(e) for e in self.alert_manager.alert_history[-50:]],
                'performance_trends': self._calculate_performance_trends(),
                'anomaly_summary': self._get_anomaly_summary()
            }

            # Save report
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2, default=str)

            logger.info(f"Performance report generated: {output_file}")
            return output_file

        except Exception as e:
            logger.error(f"Failed to generate performance report: {e}")
            return None

    def _get_rules_summary(self) -> List[Dict[str, Any]]:
        """Get summary of alert rules."""
        rules_summary = []

        for rule in self.alert_manager.rules:
            rules_summary.append({
                'name': rule.name,
                'description': rule.description,
                'enabled': rule.enabled,
                'metrics_count': len(rule.metrics),
                'alerts_count': len(rule.alerts),
                'evaluation_window': rule.evaluation_window,
                'cooldown_period': rule.cooldown_period
            })

        return rules_summary

    def _get_recent_anomalies(self) -> List[Dict[str, Any]]:
        """Get recent anomaly detections."""
        recent_anomalies = []
        cutoff_time = datetime.now() - timedelta(hours=1)

        for metric_name, historical_data in self.anomaly_detector.metric_history.items():
            if len(historical_data) < 10:
                continue

            # Simple anomaly detection on recent data
            recent_data = historical_data[-20:]  # Last 20 points
            if len(recent_data) < 5:
                continue

            mean = statistics.mean(recent_data)
            std_dev = statistics.stdev(recent_data)

            # Check last few points for anomalies
            for i, value in enumerate(recent_data[-5:]):
                if std_dev > 0:
                    z_score = (value - mean) / std_dev
                    if abs(z_score) > 3.0:
                        recent_anomalies.append({
                            'metric_name': metric_name,
                            'timestamp': (datetime.now() - timedelta(minutes=len(recent_data) - i)).isoformat(),
                            'value': value,
                            'z_score': z_score,
                            'threshold': 3.0
                        })

        return recent_anomalies

    def _calculate_performance_trends(self) -> Dict[str, Any]:
        """Calculate performance trends from historical data."""
        try:
            trends = {}

            for rule in self.alert_manager.rules:
                for metric in rule.metrics:
                    if metric.name in self.metrics_collector.metric_history:
                        historical_values = self.metrics_collector.metric_history[metric.name]
                        if len(historical_values) >= 10:
                            # Calculate trend using linear regression
                            x = list(range(len(historical_values)))
                            y = historical_values

                            slope, intercept = np.polyfit(x, y, 1)

                            # Calculate trend direction and strength
                            if abs(slope) < 0.01:
                                trend_direction = 'stable'
                            elif slope > 0:
                                trend_direction = 'increasing'
                            else:
                                trend_direction = 'decreasing'

                            trends[metric.name] = {
                                'trend_direction': trend_direction,
                                'slope': slope,
                                'r_squared': np.corrcoef(x, y) ** 2 if len(x) > 1 else 0,
                                'data_points': len(historical_values),
                                'time_range_hours': len(historical_values) * 5 / 60  # Assuming 5-minute intervals
                            }

            return trends

        except Exception as e:
            logger.error(f"Failed to calculate performance trends: {e}")
            return {}

    def _get_anomaly_summary(self) -> Dict[str, Any]:
        """Get summary of anomaly detection."""
        summary = {
            'total_metrics_tracked': len(self.anomaly_detector.metric_history),
            'anomalies_last_hour': len(self._get_recent_anomalies()),
            'detection_method': 'z_score',
            'threshold': self.config['anomaly_detection']['z_score_threshold']
        }

        return summary

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Performance Monitor')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--action', choices=['monitor', 'report', 'anomalies'], default='monitor',
                       help='Action to perform')
    parser.add_argument('--interval', type=int, default=60, help='Monitoring interval in seconds')
    parser.add_argument('--output', help='Output file for reports')

    args = parser.parse_args()

    try:
        # Initialize performance monitor
        monitor = PerformanceMonitor(args.config)

        if args.action == 'monitor':
            # Start continuous monitoring
            if args.interval:
                monitor.start_monitoring(args.interval)
            else:
                monitor.start_monitoring()

            print("Performance monitoring started. Press Ctrl+C to stop.")

            # Keep running until interrupted
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nStopping performance monitoring...")
                monitor.stop_monitoring()

        elif args.action == 'report':
            # Generate performance report
            report_file = monitor.generate_performance_report(args.output)
            print(f"Performance report generated: {report_file}")

        elif args.action == 'anomalies':
            # Check for current anomalies
            anomalies = monitor._get_recent_anomalies()
            if anomalies:
                print(f"Recent anomalies detected: {len(anomalies)}")
                for anomaly in anomalies:
                    print(f"  - {anomaly['metric_name']}: {anomaly['value']:.2f} "
                          f"(z-score: {anomaly['z_score']:.2f}) at {anomaly['timestamp']}")
            else:
                print("No anomalies detected in the last hour")

    except Exception as e:
        logger.error(f"Performance monitoring failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
"""
AI-Powered Health Monitor
Predictive database health monitoring with anomaly detection
"""

import time
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import deque
import threading
import json
import psycopg2
import psycopg2.extras

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.cluster import DBSCAN
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from .config import AIConfig

@dataclass
class HealthMetric:
    """Individual health metric data point"""
    timestamp: float
    name: str
    value: float
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class HealthAlert:
    """Health alert/anomaly detection result"""
    timestamp: float
    severity: str  # 'low', 'medium', 'high', 'critical'
    metric_name: str
    current_value: float
    expected_range: Tuple[float, float]
    message: str
    confidence: float
    suggestions: List[str] = field(default_factory=list)

@dataclass
class HealthReport:
    """Comprehensive health report"""
    timestamp: float
    overall_score: float  # 0-100
    alerts: List[HealthAlert] = field(default_factory=list)
    trends: Dict[str, str] = field(default_factory=dict)  # improving/degrading/stable
    recommendations: List[str] = field(default_factory=list)
    metrics_summary: Dict[str, Any] = field(default_factory=dict)

class HealthMonitor:
    """AI-driven predictive database health monitoring"""
    
    def __init__(self, conn_params: Dict[str, str], config: Optional[AIConfig] = None):
        self.conn_params = conn_params
        self.config = config or AIConfig.create_default()
        self.monitoring_active = False
        self.monitoring_thread = None
        
        # Data storage
        self.metrics_history = deque(maxlen=10000)  # Keep last 10k data points
        self.alerts_history = deque(maxlen=1000)
        
        # ML models
        self.anomaly_detector = None
        self.scaler = None
        self.last_model_update = 0
        self.model_update_interval = 3600  # 1 hour
        
        # Metric definitions
        self.metric_definitions = self._define_metrics()
        
        # Baseline values (learned from historical data)
        self.baselines = {}
        
    def _define_metrics(self) -> Dict[str, Dict]:
        """Define the metrics we monitor"""
        return {
            'active_connections': {
                'query': "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'",
                'type': 'gauge',
                'critical_threshold': 100,
                'warning_threshold': 50
            },
            'idle_connections': {
                'query': "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'",
                'type': 'gauge',
                'critical_threshold': 200,
                'warning_threshold': 100
            },
            'blocked_queries': {
                'query': "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'",
                'type': 'gauge',
                'critical_threshold': 10,
                'warning_threshold': 5
            },
            'cache_hit_ratio': {
                'query': '''
                    SELECT 
                        CASE 
                            WHEN (sum(heap_blks_hit) + sum(heap_blks_read)) = 0 THEN 100
                            ELSE sum(heap_blks_hit) * 100.0 / (sum(heap_blks_hit) + sum(heap_blks_read))
                        END as ratio
                    FROM pg_statio_user_tables
                ''',
                'type': 'percentage',
                'critical_threshold': 80,  # Below 80% is critical
                'warning_threshold': 90,   # Below 90% is warning
                'inverted': True  # Lower values are worse
            },
            'database_size': {
                'query': "SELECT pg_database_size(current_database())",
                'type': 'bytes',
                'growth_rate_warning': 0.1,  # 10% growth rate warning
                'growth_rate_critical': 0.2   # 20% growth rate critical
            },
            'table_bloat': {
                'query': '''
                    SELECT 
                        AVG(CASE 
                            WHEN relpages > 0 THEN (relpages - otta)::float / relpages 
                            ELSE 0 
                        END) * 100 as avg_bloat_ratio
                    FROM (
                        SELECT 
                            schemaname, tablename, 
                            relpages::bigint AS relpages,
                            GREATEST(ottalign, 1) AS otta
                        FROM pg_stats 
                        JOIN pg_class ON pg_class.relname = pg_stats.tablename
                        WHERE schemaname = 'public'
                        GROUP BY schemaname, tablename, relpages, ottalign
                    ) AS bloat_stats
                ''',
                'type': 'percentage',
                'critical_threshold': 30,
                'warning_threshold': 20
            },
            'slow_queries': {
                'query': '''
                    SELECT count(*) 
                    FROM pg_stat_activity 
                    WHERE state = 'active' 
                    AND now() - query_start > interval '30 seconds'
                ''',
                'type': 'gauge',
                'critical_threshold': 5,
                'warning_threshold': 2
            },
            'deadlocks': {
                'query': "SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()",
                'type': 'counter',
                'delta_critical': 1,  # Any deadlock is critical
                'delta_warning': 1
            },
            'temp_files': {
                'query': "SELECT temp_files FROM pg_stat_database WHERE datname = current_database()",
                'type': 'counter',
                'growth_rate_warning': 10,   # 10 temp files per minute
                'growth_rate_critical': 50   # 50 temp files per minute
            },
            'checkpoint_frequency': {
                'query': "SELECT checkpoints_timed + checkpoints_req FROM pg_stat_bgwriter",
                'type': 'counter',
                'optimal_rate': 300,  # Every 5 minutes
                'warning_deviation': 0.5
            }
        }
    
    def start_monitoring(self, interval: int = 60):
        """Start health monitoring in background thread"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.monitoring_thread = threading.Thread(
            target=self._monitoring_loop,
            args=(interval,),
            daemon=True
        )
        self.monitoring_thread.start()
    
    def stop_monitoring(self):
        """Stop health monitoring"""
        self.monitoring_active = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
    
    def _monitoring_loop(self, interval: int):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                # Collect all metrics
                self._collect_metrics()
                
                # Update ML models periodically
                if time.time() - self.last_model_update > self.model_update_interval:
                    self._update_models()
                
                # Detect anomalies
                self._detect_anomalies()
                
                # Sleep until next collection
                time.sleep(interval)
                
            except Exception as e:
                print(f"Error in health monitoring: {e}")
                time.sleep(interval)
    
    def _collect_metrics(self):
        """Collect all defined metrics"""
        timestamp = time.time()
        
        try:
            with psycopg2.connect(**self.conn_params) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    
                    for metric_name, metric_def in self.metric_definitions.items():
                        try:
                            cur.execute(metric_def['query'])
                            result = cur.fetchone()
                            
                            if result:
                                # Extract value (first column or specific key)
                                if len(result) == 1:
                                    value = float(list(result.values())[0] or 0)
                                else:
                                    value = float(result.get('ratio', result.get('avg_bloat_ratio', 0)) or 0)
                                
                                metric = HealthMetric(
                                    timestamp=timestamp,
                                    name=metric_name,
                                    value=value,
                                    metadata={'type': metric_def.get('type', 'gauge')}
                                )
                                
                                self.metrics_history.append(metric)
                                
                        except Exception as e:
                            print(f"Error collecting metric {metric_name}: {e}")
                            
        except Exception as e:
            print(f"Error connecting to database for metrics: {e}")
    
    def _update_models(self):
        """Update ML models for anomaly detection"""
        if not SKLEARN_AVAILABLE:
            return
        
        # Get recent metrics for training
        recent_metrics = self._get_recent_metrics(hours=24)
        
        if len(recent_metrics) < 50:  # Not enough data
            return
        
        try:
            # Prepare feature matrix
            features = self._prepare_features(recent_metrics)
            
            if features is not None and len(features) > 10:
                # Update scaler
                self.scaler = StandardScaler()
                features_scaled = self.scaler.fit_transform(features)
                
                # Update anomaly detector
                self.anomaly_detector = IsolationForest(
                    contamination=0.05,  # Expect 5% anomalies
                    random_state=42
                )
                self.anomaly_detector.fit(features_scaled)
                
                # Update baselines
                self._update_baselines(recent_metrics)
                
                self.last_model_update = time.time()
                
        except Exception as e:
            print(f"Error updating ML models: {e}")
    
    def _prepare_features(self, metrics: List[HealthMetric]) -> Optional[np.ndarray]:
        """Prepare feature matrix for ML models"""
        if not metrics:
            return None
        
        # Group metrics by timestamp
        timestamp_groups = {}
        for metric in metrics:
            ts = int(metric.timestamp // 60) * 60  # Round to minute
            if ts not in timestamp_groups:
                timestamp_groups[ts] = {}
            timestamp_groups[ts][metric.name] = metric.value
        
        # Create feature vectors
        feature_names = list(self.metric_definitions.keys())
        features = []
        
        for ts, values in timestamp_groups.items():
            feature_vector = []
            for name in feature_names:
                feature_vector.append(values.get(name, 0))
            features.append(feature_vector)
        
        return np.array(features) if features else None
    
    def _update_baselines(self, metrics: List[HealthMetric]):
        """Update baseline values from historical data"""
        metric_groups = {}
        for metric in metrics:
            if metric.name not in metric_groups:
                metric_groups[metric.name] = []
            metric_groups[metric.name].append(metric.value)
        
        for name, values in metric_groups.items():
            if values:
                self.baselines[name] = {
                    'mean': np.mean(values),
                    'std': np.std(values),
                    'median': np.median(values),
                    'p95': np.percentile(values, 95),
                    'p99': np.percentile(values, 99)
                }
    
    def _detect_anomalies(self):
        """Detect anomalies in recent metrics"""
        # Get latest metrics
        latest_metrics = self._get_recent_metrics(minutes=5)
        
        if not latest_metrics:
            return
        
        # Group by metric name
        current_values = {}
        for metric in latest_metrics:
            if metric.name not in current_values:
                current_values[metric.name] = []
            current_values[metric.name].append(metric.value)
        
        # Average recent values
        for name, values in current_values.items():
            current_values[name] = np.mean(values)
        
        # Check for anomalies
        alerts = []
        
        # Rule-based detection
        alerts.extend(self._rule_based_detection(current_values))
        
        # ML-based detection (if available)
        if self.anomaly_detector and SKLEARN_AVAILABLE:
            alerts.extend(self._ml_based_detection(current_values))
        
        # Store alerts
        for alert in alerts:
            self.alerts_history.append(alert)
    
    def _rule_based_detection(self, current_values: Dict[str, float]) -> List[HealthAlert]:
        """Rule-based anomaly detection"""
        alerts = []
        timestamp = time.time()
        
        for metric_name, value in current_values.items():
            metric_def = self.metric_definitions.get(metric_name, {})
            
            # Check thresholds
            critical_threshold = metric_def.get('critical_threshold')
            warning_threshold = metric_def.get('warning_threshold')
            inverted = metric_def.get('inverted', False)
            
            if critical_threshold is not None:
                if (not inverted and value >= critical_threshold) or (inverted and value <= critical_threshold):
                    alert = HealthAlert(
                        timestamp=timestamp,
                        severity='critical',
                        metric_name=metric_name,
                        current_value=value,
                        expected_range=(0, critical_threshold),
                        message=f"{metric_name} is critically high: {value:.2f}",
                        confidence=0.9,
                        suggestions=self._get_suggestions(metric_name, value, 'critical')
                    )
                    alerts.append(alert)
                    continue
            
            if warning_threshold is not None:
                if (not inverted and value >= warning_threshold) or (inverted and value <= warning_threshold):
                    alert = HealthAlert(
                        timestamp=timestamp,
                        severity='medium',
                        metric_name=metric_name,
                        current_value=value,
                        expected_range=(0, warning_threshold),
                        message=f"{metric_name} is elevated: {value:.2f}",
                        confidence=0.7,
                        suggestions=self._get_suggestions(metric_name, value, 'warning')
                    )
                    alerts.append(alert)
        
        return alerts
    
    def _ml_based_detection(self, current_values: Dict[str, float]) -> List[HealthAlert]:
        """ML-based anomaly detection"""
        alerts = []
        
        if not self.scaler or not self.anomaly_detector:
            return alerts
        
        try:
            # Prepare feature vector
            feature_names = list(self.metric_definitions.keys())
            feature_vector = [current_values.get(name, 0) for name in feature_names]
            
            # Scale features
            feature_scaled = self.scaler.transform([feature_vector])
            
            # Predict anomaly
            anomaly_score = self.anomaly_detector.decision_function(feature_scaled)[0]
            is_anomaly = self.anomaly_detector.predict(feature_scaled)[0] == -1
            
            if is_anomaly:
                # Find which metrics are most anomalous
                for i, name in enumerate(feature_names):
                    value = current_values.get(name, 0)
                    baseline = self.baselines.get(name, {})
                    
                    if baseline:
                        # Calculate z-score
                        mean = baseline.get('mean', 0)
                        std = baseline.get('std', 1)
                        z_score = abs((value - mean) / std) if std > 0 else 0
                        
                        if z_score > 2:  # Significant deviation
                            severity = 'critical' if z_score > 3 else 'medium'
                            confidence = min(0.9, z_score / 4)
                            
                            alert = HealthAlert(
                                timestamp=time.time(),
                                severity=severity,
                                metric_name=name,
                                current_value=value,
                                expected_range=(mean - 2*std, mean + 2*std),
                                message=f"ML detected anomaly in {name}: {value:.2f} (z-score: {z_score:.2f})",
                                confidence=confidence,
                                suggestions=self._get_suggestions(name, value, 'anomaly')
                            )
                            alerts.append(alert)
            
        except Exception as e:
            print(f"Error in ML-based detection: {e}")
        
        return alerts
    
    def _get_suggestions(self, metric_name: str, value: float, severity: str) -> List[str]:
        """Get suggestions based on metric and severity"""
        suggestions = []
        
        if metric_name == 'active_connections':
            suggestions = [
                "Consider connection pooling (PgBouncer)",
                "Review application connection management",
                "Check for connection leaks",
                "Scale connection limits if needed"
            ]
        elif metric_name == 'blocked_queries':
            suggestions = [
                "Identify blocking queries with pg_blocking_pids()",
                "Review transaction duration",
                "Consider query optimization",
                "Check for lock contention"
            ]
        elif metric_name == 'cache_hit_ratio':
            suggestions = [
                "Increase shared buffers",
                "Review query patterns",
                "Consider adding indexes",
                "Monitor buffer usage"
            ]
        elif metric_name == 'database_size':
            suggestions = [
                "Run VACUUM FULL on large tables",
                "Archive old data",
                "Consider partitioning",
                "Monitor disk space"
            ]
        elif metric_name == 'slow_queries':
            suggestions = [
                "Identify slow queries with pg stat statements",
                "Optimize query performance",
                "Add missing indexes",
                "Consider query rewriting"
            ]
        else:
            suggestions = [
                f"Monitor {metric_name} trends",
                "Review PostgreSQL configuration",
                "Check system resources",
                "Consider performance tuning"
            ]
        
        return suggestions
    
    def _get_recent_metrics(self, minutes: Optional[int] = None, hours: Optional[int] = None) -> List[HealthMetric]:
        """Get recent metrics within specified time window"""
        if minutes:
            cutoff = time.time() - (minutes * 60)
        elif hours:
            cutoff = time.time() - (hours * 3600)
        else:
            cutoff = time.time() - 3600  # Default 1 hour
        
        return [metric for metric in self.metrics_history if metric.timestamp >= cutoff]
    
    def generate_health_report(self) -> HealthReport:
        """Generate comprehensive health report"""
        timestamp = time.time()
        recent_alerts = [alert for alert in self.alerts_history 
                        if alert.timestamp > timestamp - 3600]  # Last hour
        
        # Calculate overall health score
        overall_score = self._calculate_health_score(recent_alerts)
        
        # Analyze trends
        trends = self._analyze_trends()
        
        # Generate recommendations
        recommendations = self._generate_recommendations(recent_alerts, trends)
        
        # Create metrics summary
        metrics_summary = self._create_metrics_summary()
        
        return HealthReport(
            timestamp=timestamp,
            overall_score=overall_score,
            alerts=recent_alerts,
            trends=trends,
            recommendations=recommendations,
            metrics_summary=metrics_summary
        )
    
    def _calculate_health_score(self, alerts: List[HealthAlert]) -> float:
        """Calculate overall health score (0-100)"""
        if not alerts:
            return 100.0
        
        # Weight alerts by severity
        score_impact = 0
        for alert in alerts:
            if alert.severity == 'critical':
                score_impact += 30
            elif alert.severity == 'high':
                score_impact += 20
            elif alert.severity == 'medium':
                score_impact += 10
            else:
                score_impact += 5
        
        # Cap at 0
        return float(max(0, 100 - score_impact))
    
    def _analyze_trends(self) -> Dict[str, str]:
        """Analyze metric trends"""
        trends = {}
        
        # Get metrics from last 2 hours
        recent_metrics = self._get_recent_metrics(hours=2)
        
        if len(recent_metrics) < 10:
            return trends
        
        # Group by metric name
        metric_groups = {}
        for metric in recent_metrics:
            if metric.name not in metric_groups:
                metric_groups[metric.name] = []
            metric_groups[metric.name].append((metric.timestamp, metric.value))
        
        # Analyze each metric trend
        for name, values in metric_groups.items():
            if len(values) >= 5:
                # Sort by timestamp
                values.sort(key=lambda x: x[0])
                
                # Simple linear trend analysis
                recent_avg = np.mean([v[1] for v in values[-5:]])
                earlier_avg = np.mean([v[1] for v in values[:5]])
                
                if abs(recent_avg - earlier_avg) < 0.1:
                    trends[name] = 'stable'
                elif recent_avg > earlier_avg:
                    trends[name] = 'increasing'
                else:
                    trends[name] = 'decreasing'
        
        return trends
    
    def _generate_recommendations(self, alerts: List[HealthAlert], trends: Dict[str, str]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Based on alerts
        critical_metrics = set()
        for alert in alerts:
            if alert.severity in ['critical', 'high']:
                critical_metrics.add(alert.metric_name)
        
        if 'active_connections' in critical_metrics:
            recommendations.append("Implement connection pooling to manage database connections")
        
        if 'cache_hit_ratio' in critical_metrics:
            recommendations.append("Increase shared_buffers to improve cache performance")
        
        if 'blocked_queries' in critical_metrics:
            recommendations.append("Review and optimize long-running transactions")
        
        # Based on trends
        for metric, trend in trends.items():
            if trend == 'increasing' and metric in ['database_size', 'slow_queries']:
                recommendations.append(f"Monitor {metric.replace('_', ' ')} growth and plan for optimization")
        
        # General recommendations
        if len(alerts) > 10:
            recommendations.append("Schedule comprehensive database performance review")
        
        if not recommendations:
            recommendations.append("Database health is good - continue regular monitoring")
        
        return recommendations
    
    def _create_metrics_summary(self) -> Dict[str, Any]:
        """Create summary of current metrics"""
        summary = {}
        
        # Get latest value for each metric
        latest_metrics = self._get_recent_metrics(minutes=5)
        
        for metric in latest_metrics:
            if metric.name not in summary:
                summary[metric.name] = {
                    'current_value': metric.value,
                    'timestamp': metric.timestamp,
                    'baseline': self.baselines.get(metric.name, {})
                }
        
        return summary
    
    def get_metric_history(self, metric_name: str, hours: int = 24) -> List[HealthMetric]:
        """Get history for a specific metric"""
        cutoff = time.time() - (hours * 3600)
        return [
            metric for metric in self.metrics_history 
            if metric.name == metric_name and metric.timestamp >= cutoff
        ]
    
    def get_active_alerts(self) -> List[HealthAlert]:
        """Get currently active alerts"""
        cutoff = time.time() - 300  # Last 5 minutes
        return [alert for alert in self.alerts_history if alert.timestamp >= cutoff]
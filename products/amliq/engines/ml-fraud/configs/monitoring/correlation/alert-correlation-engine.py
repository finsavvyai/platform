#!/usr/bin/env python3
"""
Alert Correlation Engine for QuantumBeam Production
Intelligently correlates and suppresses duplicate alerts to reduce noise
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
import aiohttp
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus Metrics
ALERTS_RECEIVED = Counter('correlation_alerts_received_total', 'Total alerts received', ['severity'])
ALERTS_SUPPRESSED = Counter('correlation_alerts_suppressed_total', 'Total alerts suppressed', ['reason'])
ALERTS_PROCESSED = Counter('correlation_alerts_processed_total', 'Total alerts processed')
CORRELATION_LATENCY = Histogram('correlation_processing_duration_seconds', 'Alert correlation processing time')
ACTIVE_CORRELATIONS = Gauge('correlation_active_correlations', 'Number of active alert correlations')

@dataclass
class Alert:
    """Alert data structure"""
    alertname: str
    severity: str
    instance: str
    job: str
    namespace: str
    cluster: str
    service: Optional[str] = None
    component: Optional[str] = None
    fingerprint: str = ""
    starts_at: datetime = None
    ends_at: Optional[datetime] = None
    annotations: Dict[str, str] = None
    labels: Dict[str, str] = None
    status: str = "firing"

    def __post_init__(self):
        if self.starts_at is None:
            self.starts_at = datetime.utcnow()
        if self.annotations is None:
            self.annotations = {}
        if self.labels is None:
            self.labels = {}
        if not self.fingerprint:
            self.fingerprint = self._generate_fingerprint()

    def _generate_fingerprint(self) -> str:
        """Generate unique fingerprint for alert"""
        import hashlib
        key_parts = [
            self.alertname,
            self.instance,
            self.job,
            self.namespace,
            self.cluster,
            self.severity
        ]
        key = "|".join(filter(None, key_parts))
        return hashlib.md5(key.encode()).hexdigest()

@dataclass
class CorrelationRule:
    """Alert correlation rule"""
    name: str
    description: str
    conditions: Dict[str, str]
    correlation_keys: List[str]
    suppression_window: timedelta
    action: str  # 'suppress', 'group', 'escalate'
    priority: int = 0

    def matches(self, alert: Alert) -> bool:
        """Check if alert matches correlation rule"""
        for key, value in self.conditions.items():
            if getattr(alert, key, None) != value:
                return False
        return True

class AlertCorrelationEngine:
    """Main alert correlation engine"""

    def __init__(self, redis_url: str, alertmanager_url: str):
        self.redis_url = redis_url
        self.alertmanager_url = alertmanager_url
        self.redis_client: Optional[redis.Redis] = None
        self.session: Optional[aiohttp.ClientSession] = None

        # Correlation state
        self.active_correlations: Dict[str, Dict] = {}
        self.suppression_windows: Dict[str, datetime] = {}
        self.alert_groups: Dict[str, List[Alert]] = defaultdict(list)

        # Load correlation rules
        self.correlation_rules = self._load_correlation_rules()

        # Maintenance windows
        self.maintenance_windows: Dict[str, Dict] = {}

    async def start(self):
        """Start the correlation engine"""
        logger.info("Starting Alert Correlation Engine")

        # Initialize Redis
        self.redis_client = redis.from_url(self.redis_url)

        # Initialize HTTP session
        self.session = aiohttp.ClientSession()

        # Start metrics server
        start_http_server(9095)

        # Start background tasks
        asyncio.create_task(self._cleanup_task())
        asyncio.create_task(self._sync_with_alertmanager())

        logger.info("Alert Correlation Engine started successfully")

    async def stop(self):
        """Stop the correlation engine"""
        logger.info("Stopping Alert Correlation Engine")

        if self.session:
            await self.session.close()
        if self.redis_client:
            await self.redis_client.close()

    def _load_correlation_rules(self) -> List[CorrelationRule]:
        """Load correlation rules from configuration"""
        return [
            # Database connection issues correlation
            CorrelationRule(
                name="database_connection_issues",
                description="Correlate database connection problems",
                conditions={"service": "database"},
                correlation_keys=["instance", "database"],
                suppression_window=timedelta(minutes=10),
                action="suppress",
                priority=100
            ),

            # Node issues correlation
            CorrelationRule(
                name="node_outage_cascade",
                description="Correlate alerts from failed nodes",
                conditions={"alertname": "NodeDown"},
                correlation_keys=["instance"],
                suppression_window=timedelta(minutes=5),
                action="group",
                priority=90
            ),

            # High CPU usage correlation
            CorrelationRule(
                name="high_cpu_usage_cascade",
                description="Correlate high CPU usage alerts",
                conditions={"alertname": "HighCPUUsage"},
                correlation_keys=["instance"],
                suppression_window=timedelta(minutes=3),
                action="suppress",
                priority=70
            ),

            # Memory pressure correlation
            CorrelationRule(
                name="memory_pressure_cascade",
                description="Correlate memory pressure alerts",
                conditions={"alertname": "HighMemoryUsage"},
                correlation_keys=["instance"],
                suppression_window=timedelta(minutes=5),
                action="suppress",
                priority=70
            ),

            # Pod restart correlation
            CorrelationRule(
                name="pod_restart_cascade",
                description="Correlate pod restart alerts",
                conditions={"alertname": "PodCrashLooping"},
                correlation_keys=["namespace", "pod"],
                suppression_window=timedelta(minutes=15),
                action="group",
                priority=80
            ),

            # Network issues correlation
            CorrelationRule(
                name="network_connectivity_issues",
                description="Correlate network connectivity problems",
                conditions={"service": "network"},
                correlation_keys=["source", "target"],
                suppression_window=timedelta(minutes=5),
                action="suppress",
                priority=60
            ),

            # Storage issues correlation
            CorrelationRule(
                name="storage_space_issues",
                description="Correlate storage space alerts",
                conditions={"alertname": "DiskSpaceLow"},
                correlation_keys=["instance", "mountpoint"],
                suppression_window=timedelta(minutes=10),
                action="suppress",
                priority=75
            ),

            # Service deployment correlation
            CorrelationRule(
                name="deployment_issues",
                description="Correlate deployment-related alerts",
                conditions={"alertname": "DeploymentFailed"},
                correlation_keys=["namespace", "deployment"],
                suppression_window=timedelta(minutes=20),
                action="group",
                priority=85
            ),

            # API rate limiting correlation
            CorrelationRule(
                name="api_rate_limiting",
                description="Correlate API rate limiting alerts",
                conditions={"alertname": "HighErrorRate", "service": "api"},
                correlation_keys=["endpoint"],
                suppression_window=timedelta(minutes=2),
                action="suppress",
                priority=65
            ),

            # SSL certificate correlation
            CorrelationRule(
                name="ssl_certificate_expiry",
                description="Correlate SSL certificate expiration alerts",
                conditions={"alertname": "CertificateExpiring"},
                correlation_keys=["domain", "certificate"],
                suppression_window=timedelta(hours=24),
                action="suppress",
                priority=40
            )
        ]

    @CORRELATION_LATENCY.time()
    async def process_alert(self, alert_data: Dict) -> Optional[Dict]:
        """Process incoming alert and apply correlation logic"""
        try:
            ALERTS_RECEIVED.labels(severity=alert_data.get('labels', {}).get('severity', 'unknown')).inc()

            alert = Alert(
                alertname=alert_data['labels']['alertname'],
                severity=alert_data['labels']['severity'],
                instance=alert_data['labels'].get('instance', ''),
                job=alert_data['labels'].get('job', ''),
                namespace=alert_data['labels'].get('namespace', ''),
                cluster=alert_data['labels'].get('cluster', 'production'),
                service=alert_data['labels'].get('service', ''),
                component=alert_data['labels'].get('component', ''),
                annotations=alert_data.get('annotations', {}),
                labels=alert_data.get('labels', {}),
                status=alert_data.get('status', 'firing')
            )

            # Check maintenance windows
            if await self._is_in_maintenance_window(alert):
                logger.info(f"Alert {alert.alertname} suppressed due to maintenance window")
                ALERTS_SUPPRESSED.labels(reason='maintenance_window').inc()
                return None

            # Apply correlation rules
            processed_alert = await self._apply_correlation_rules(alert)
            if processed_alert is None:
                return None

            # Check suppression windows
            if await self._is_suppressed(alert):
                ALERTS_SUPPRESSED.labels(reason='suppression_window').inc()
                return None

            # Update active correlations
            await self._update_active_correlations(alert)

            ALERTS_PROCESSED.inc()
            return self._alert_to_dict(processed_alert)

        except Exception as e:
            logger.error(f"Error processing alert: {e}")
            return alert_data

    async def _apply_correlation_rules(self, alert: Alert) -> Optional[Alert]:
        """Apply correlation rules to alert"""
        # Sort rules by priority (highest first)
        rules = sorted(self.correlation_rules, key=lambda x: x.priority, reverse=True)

        for rule in rules:
            if rule.matches(alert):
                correlation_key = self._get_correlation_key(alert, rule.correlation_keys)

                if rule.action == 'suppress':
                    # Check if we should suppress this alert
                    if await self._should_suppress_alert(alert, rule, correlation_key):
                        logger.info(f"Alert {alert.alertname} suppressed by rule {rule.name}")
                        return None

                elif rule.action == 'group':
                    # Group similar alerts
                    await self._group_alert(alert, correlation_key)
                    return alert

                elif rule.action == 'escalate':
                    # Escalate alert immediately
                    await self._escalate_alert(alert, rule)
                    return alert

        return alert

    def _get_correlation_key(self, alert: Alert, keys: List[str]) -> str:
        """Generate correlation key for alert"""
        key_parts = []
        for key in keys:
            value = getattr(alert, key, None) or alert.labels.get(key, '')
            key_parts.append(str(value))
        return "|".join(filter(None, key_parts))

    async def _should_suppress_alert(self, alert: Alert, rule: CorrelationRule, correlation_key: str) -> bool:
        """Check if alert should be suppressed"""
        redis_key = f"correlation:suppress:{rule.name}:{correlation_key}"

        # Check if we have a recent alert with same correlation key
        last_alert_time = await self.redis_client.get(redis_key)
        if last_alert_time:
            last_time = datetime.fromisoformat(last_alert_time.decode())
            if datetime.utcnow() - last_time < rule.suppression_window:
                return True

        # Set suppression window
        await self.redis_client.setex(
            redis_key,
            int(rule.suppression_window.total_seconds()),
            datetime.utcnow().isoformat()
        )

        return False

    async def _group_alert(self, alert: Alert, correlation_key: str):
        """Group alerts by correlation key"""
        group_key = f"correlation:group:{correlation_key}"

        # Add alert to group
        alert_data = self._alert_to_dict(alert)
        await self.redis_client.lpush(group_key, json.dumps(alert_data))
        await self.redis_client.expire(group_key, 3600)  # Expire after 1 hour

        # Update group size
        await self.redis_client.incr(f"correlation:group:size:{correlation_key}")
        await self.redis_client.expire(f"correlation:group:size:{correlation_key}", 3600)

    async def _escalate_alert(self, alert: Alert, rule: CorrelationRule):
        """Escalate alert immediately"""
        # Add escalation annotation
        alert.annotations['escalation_reason'] = rule.description
        alert.annotations['escalation_priority'] = str(rule.priority)

        # Create escalation task
        escalation_key = f"correlation:escalate:{alert.fingerprint}"
        await self.redis_client.setex(
            escalation_key,
            3600,  # 1 hour
            json.dumps({
                'rule_name': rule.name,
                'escalation_time': datetime.utcnow().isoformat(),
                'priority': rule.priority
            })
        )

    async def _is_in_maintenance_window(self, alert: Alert) -> bool:
        """Check if alert is in a maintenance window"""
        for window_name, window_config in self.maintenance_windows.items():
            if self._matches_maintenance_window(alert, window_config):
                return True
        return False

    def _matches_maintenance_window(self, alert: Alert, window_config: Dict) -> bool:
        """Check if alert matches maintenance window criteria"""
        # Check service match
        if 'services' in window_config and alert.service not in window_config['services']:
            return False

        # Check namespace match
        if 'namespaces' in window_config and alert.namespace not in window_config['namespaces']:
            return False

        # Check time window
        now = datetime.utcnow()
        start_time = datetime.fromisoformat(window_config['start_time'])
        end_time = datetime.fromisoformat(window_config['end_time'])

        return start_time <= now <= end_time

    async def _is_suppressed(self, alert: Alert) -> bool:
        """Check if alert is in suppression window"""
        suppression_key = f"correlation:suppress:{alert.fingerprint}"
        return await self.redis_client.exists(suppression_key) > 0

    async def _update_active_correlations(self, alert: Alert):
        """Update active correlations tracking"""
        correlation_key = f"{alert.alertname}:{alert.instance}"

        self.active_correlations[correlation_key] = {
            'alertname': alert.alertname,
            'instance': alert.instance,
            'severity': alert.severity,
            'starts_at': alert.starts_at.isoformat(),
            'service': alert.service,
            'namespace': alert.namespace
        }

        ACTIVE_CORRELATIONS.set(len(self.active_correlations))

        # Store in Redis for persistence
        await self.redis_client.hset(
            "correlation:active",
            correlation_key,
            json.dumps(self.active_correlations[correlation_key])
        )

        # Set expiration
        await self.redis_client.expire("correlation:active", 86400)  # 24 hours

    async def _cleanup_task(self):
        """Background task to cleanup old correlations"""
        while True:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes

                # Clean up old active correlations
                current_time = datetime.utcnow()
                expired_keys = []

                for key, correlation in self.active_correlations.items():
                    start_time = datetime.fromisoformat(correlation['starts_at'])
                    if current_time - start_time > timedelta(hours=24):
                        expired_keys.append(key)

                for key in expired_keys:
                    del self.active_correlations[key]
                    await self.redis_client.hdel("correlation:active", key)

                ACTIVE_CORRELATIONS.set(len(self.active_correlations))

                if expired_keys:
                    logger.info(f"Cleaned up {len(expired_keys)} expired correlations")

            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def _sync_with_alertmanager(self):
        """Sync correlation state with AlertManager"""
        while True:
            try:
                await asyncio.sleep(60)  # Sync every minute

                # Get silences from AlertManager
                silences = await self._get_alertmanager_silences()

                # Update local suppression windows based on silences
                for silence in silences:
                    if silence['status'] == 'active':
                        await self._process_alertmanager_silence(silence)

            except Exception as e:
                logger.error(f"Error syncing with AlertManager: {e}")

    async def _get_alertmanager_silences(self) -> List[Dict]:
        """Get active silences from AlertManager"""
        try:
            async with self.session.get(
                f"{self.alertmanager_url}/api/v1/silences",
                params={"filter": "state=active"}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
        except Exception as e:
            logger.error(f"Error getting AlertManager silences: {e}")

        return []

    async def _process_alertmanager_silence(self, silence: Dict):
        """Process AlertManager silence"""
        # Create suppression entry based on silence
        silence_id = silence['id']
        matchers = silence.get('matchers', [])

        for matcher in matchers:
            if matcher.get('name') == 'alertname':
                alertname = matcher.get('value', '')
                suppression_key = f"correlation:silence:{silence_id}:{alertname}"

                # Set suppression for silence duration
                ends_at = datetime.fromisoformat(silence['endsAt'].replace('Z', '+00:00'))
                ttl = int((ends_at - datetime.utcnow()).total_seconds())

                if ttl > 0:
                    await self.redis_client.setex(suppression_key, ttl, "silence")

    def _alert_to_dict(self, alert: Alert) -> Dict:
        """Convert Alert object back to dictionary format"""
        return {
            'labels': {
                'alertname': alert.alertname,
                'severity': alert.severity,
                'instance': alert.instance,
                'job': alert.job,
                'namespace': alert.namespace,
                'cluster': alert.cluster,
                **({k: v for k, v in alert.labels.items() if k not in ['alertname', 'severity', 'instance', 'job', 'namespace', 'cluster']})
            },
            'annotations': alert.annotations,
            'startsAt': alert.starts_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            'status': {'state': alert.status}
        }

    async def add_maintenance_window(self, name: str, config: Dict):
        """Add a maintenance window"""
        self.maintenance_windows[name] = config

        # Store in Redis
        await self.redis_client.hset(
            "correlation:maintenance",
            name,
            json.dumps(config)
        )
        await self.redis_client.expire("correlation:maintenance", 604800)  # 7 days

    async def remove_maintenance_window(self, name: str):
        """Remove a maintenance window"""
        if name in self.maintenance_windows:
            del self.maintenance_windows[name]
            await self.redis_client.hdel("correlation:maintenance", name)

    async def get_correlation_stats(self) -> Dict:
        """Get correlation statistics"""
        stats = {
            'active_correlations': len(self.active_correlations),
            'suppression_windows': len(self.suppression_windows),
            'maintenance_windows': len(self.maintenance_windows),
            'correlation_rules': len(self.correlation_rules)
        }

        # Add Prometheus metrics
        stats['prometheus_metrics'] = {
            'alerts_received': ALERTS_RECEIVED._value._value,
            'alerts_suppressed': ALERTS_SUPPRESSED._value._value,
            'alerts_processed': ALERTS_PROCESSED._value._value,
            'active_correlations': ACTIVE_CORRELATIONS._value.get()
        }

        return stats

# API Server for Alert Correlation Engine
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="Alert Correlation Engine API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global correlation engine
correlation_engine: Optional[AlertCorrelationEngine] = None

class AlertRequest(BaseModel):
    alerts: List[Dict[str, Any]]

class MaintenanceWindowRequest(BaseModel):
    name: str
    services: List[str]
    namespaces: List[str]
    start_time: str  # ISO format
    end_time: str    # ISO format
    description: str

@app.on_event("startup")
async def startup_event():
    global correlation_engine
    # Configuration from environment variables
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    alertmanager_url = os.getenv("ALERTMANAGER_URL", "http://alertmanager:9093")

    correlation_engine = AlertCorrelationEngine(redis_url, alertmanager_url)
    await correlation_engine.start()

@app.on_event("shutdown")
async def shutdown_event():
    global correlation_engine
    if correlation_engine:
        await correlation_engine.stop()

@app.post("/alerts")
async def process_alerts(request: AlertRequest):
    """Process incoming alerts"""
    if not correlation_engine:
        raise HTTPException(status_code=503, detail="Correlation engine not available")

    processed_alerts = []
    for alert_data in request.alerts:
        processed_alert = await correlation_engine.process_alert(alert_data)
        if processed_alert:
            processed_alerts.append(processed_alert)

    return {"alerts": processed_alerts}

@app.post("/maintenance-windows")
async def add_maintenance_window(request: MaintenanceWindowRequest):
    """Add a maintenance window"""
    if not correlation_engine:
        raise HTTPException(status_code=503, detail="Correlation engine not available")

    config = {
        'services': request.services,
        'namespaces': request.namespaces,
        'start_time': request.start_time,
        'end_time': request.end_time,
        'description': request.description
    }

    await correlation_engine.add_maintenance_window(request.name, config)
    return {"message": f"Maintenance window {request.name} added successfully"}

@app.delete("/maintenance-windows/{window_name}")
async def remove_maintenance_window(window_name: str):
    """Remove a maintenance window"""
    if not correlation_engine:
        raise HTTPException(status_code=503, detail="Correlation engine not available")

    await correlation_engine.remove_maintenance_window(window_name)
    return {"message": f"Maintenance window {window_name} removed successfully"}

@app.get("/stats")
async def get_stats():
    """Get correlation statistics"""
    if not correlation_engine:
        raise HTTPException(status_code=503, detail="Correlation engine not available")

    stats = await correlation_engine.get_correlation_stats()
    return stats

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    import os

    uvicorn.run(
        "alert_correlation_engine:app",
        host="0.0.0.0",
        port=8080,
        reload=False
    )
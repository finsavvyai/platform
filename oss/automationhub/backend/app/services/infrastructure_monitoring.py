"""
Real-time Infrastructure Monitoring and Auto-scaling Service
Monitors deployed infrastructure and provides intelligent auto-scaling capabilities
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from app.services.llm_service import llm_service, LLMRequest, ModelSize, PromptTemplate
from app.services.infrastructure_deployment import (
    infrastructure_deployment_service,
    DeploymentPlatform,
    DeploymentStatus
)

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of infrastructure metrics"""
    CPU_USAGE = "cpu_usage"
    MEMORY_USAGE = "memory_usage"
    DISK_USAGE = "disk_usage"
    NETWORK_IN = "network_in"
    NETWORK_OUT = "network_out"
    REQUEST_COUNT = "request_count"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    CUSTOM = "custom"


class AlertSeverity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ScalingDirection(Enum):
    """Auto-scaling directions"""
    UP = "up"
    DOWN = "down"
    MAINTAIN = "maintain"


class MonitoringStatus(Enum):
    """Monitoring status states"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ALERTING = "alerting"
    SCALING = "scaling"
    ERROR = "error"


@dataclass
class MetricData:
    """Infrastructure metric data point"""
    deployment_id: UUID
    metric_type: MetricType
    value: float
    unit: str
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)
    source: str = "system"


@dataclass
class AlertRule:
    """Alert rule configuration"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    deployment_id: Optional[UUID] = None
    metric_type: MetricType = MetricType.CPU_USAGE
    threshold: float = 80.0
    comparison: str = ">"  # >, <, >=, <=, ==, !=
    duration: int = 300  # seconds
    severity: AlertSeverity = AlertSeverity.MEDIUM
    enabled: bool = True
    actions: List[str] = field(default_factory=list)


@dataclass
class ScalingPolicy:
    """Auto-scaling policy configuration"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    deployment_id: UUID = None
    platform: DeploymentPlatform = DeploymentPlatform.AWS
    min_instances: int = 1
    max_instances: int = 10
    target_cpu: float = 70.0
    target_memory: float = 80.0
    scale_up_threshold: float = 80.0
    scale_down_threshold: float = 30.0
    scale_up_cooldown: int = 300  # seconds
    scale_down_cooldown: int = 600  # seconds
    enabled: bool = True


@dataclass
class Alert:
    """Alert instance"""
    id: UUID = field(default_factory=uuid4)
    rule_id: UUID = None
    deployment_id: UUID = None
    severity: AlertSeverity = AlertSeverity.MEDIUM
    message: str = ""
    metric_value: float = 0.0
    threshold: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)
    acknowledged: bool = False
    resolved: bool = False
    resolution_timestamp: Optional[datetime] = None


@dataclass
class ScalingAction:
    """Auto-scaling action result"""
    id: UUID = field(default_factory=uuid4)
    deployment_id: UUID = None
    direction: ScalingDirection = ScalingDirection.MAINTAIN
    current_instances: int = 0
    target_instances: int = 0
    reason: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    success: bool = False
    error_message: Optional[str] = None


@dataclass
class MonitoringReport:
    """Infrastructure monitoring report"""
    deployment_id: UUID
    period_start: datetime
    period_end: datetime
    metrics_summary: Dict[str, Any]
    alerts_summary: Dict[str, Any]
    scaling_actions: List[ScalingAction]
    recommendations: List[str]
    cost_analysis: Dict[str, Any]
    performance_score: float


class InfrastructureMonitoringService:
    """
    Real-time infrastructure monitoring service with intelligent
    auto-scaling and predictive analytics
    """

    def __init__(self):
        self.monitoring_sessions: Dict[UUID, Dict] = {}
        self.alert_rules: Dict[UUID, AlertRule] = {}
        self.scaling_policies: Dict[UUID, ScalingPolicy] = {}
        self.active_alerts: Dict[UUID, Alert] = {}
        self.metrics_buffer: List[MetricData] = []
        self.scaling_history: List[ScalingAction] = []
        self._initialize_llm_templates()
        self._initialize_default_rules()

    def _initialize_llm_templates(self):
        """Initialize LLM templates for monitoring analysis"""
        monitoring_analysis_template = """You are an expert infrastructure monitoring analyst.

Analyze the following infrastructure metrics and provide intelligent recommendations:

**Deployment Info:**
- Platform: {{ platform }}
- Environment: {{ environment }}
- Current Instance Count: {{ current_instances }}

**Current Metrics (last {{ time_window }} minutes):**
{% for metric in metrics %}
- {{ metric.type }}: {{ metric.value }}{{ metric.unit }} ({{ metric.trend }})
{% endfor %}

**Recent Alerts:**
{% for alert in recent_alerts %}
- {{ alert.severity }}: {{ alert.message }} ({{ alert.timestamp }})
{% endfor %}

**Scaling History:**
{% for action in recent_scaling %}
- {{ action.direction }}: {{ action.current_instances }} → {{ action.target_instances }} ({{ action.reason }})
{% endfor %}

**Analysis Required:**
1. Assess current infrastructure health and performance
2. Identify potential bottlenecks or issues
3. Recommend optimal scaling actions
4. Predict future resource needs
5. Suggest cost optimization opportunities
6. Identify security or reliability concerns

Provide response in JSON format:
{
  "health_score": 0-100,
  "performance_assessment": "excellent|good|fair|poor|critical",
  "bottlenecks": ["list of identified bottlenecks"],
  "scaling_recommendation": {
    "action": "scale_up|scale_down|maintain",
    "target_instances": number,
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "cost_optimization": ["list of cost optimization suggestions"],
  "predictive_analysis": {
    "next_hour_load": "high|medium|low",
    "resource_forecast": "description of expected resource needs",
    "recommended_schedule": "optimal scaling schedule"
  },
  "alerts_assessment": ["analysis of current alerts and urgency"],
  "recommendations": ["prioritized list of action items"]
}"""

        llm_service.add_template(PromptTemplate(
            name="infrastructure_monitoring_analysis",
            template=monitoring_analysis_template,
            description="Intelligent infrastructure monitoring and scaling analysis",
            required_vars=["platform", "environment", "current_instances", "metrics", "time_window"],
            optional_vars=["recent_alerts", "recent_scaling"],
            category="monitoring",
            model_size=ModelSize.LARGE
        ))

    def _initialize_default_rules(self):
        """Initialize default monitoring rules"""
        default_rules = [
            AlertRule(
                name="High CPU Usage",
                metric_type=MetricType.CPU_USAGE,
                threshold=85.0,
                comparison=">",
                duration=300,
                severity=AlertSeverity.HIGH,
                actions=["scale_up", "notify_admin"]
            ),
            AlertRule(
                name="High Memory Usage",
                metric_type=MetricType.MEMORY_USAGE,
                threshold=90.0,
                comparison=">",
                duration=600,
                severity=AlertSeverity.CRITICAL,
                actions=["scale_up", "notify_admin", "dump_memory"]
            ),
            AlertRule(
                name="High Error Rate",
                metric_type=MetricType.ERROR_RATE,
                threshold=5.0,
                comparison=">",
                duration=60,
                severity=AlertSeverity.HIGH,
                actions=["notify_admin", "check_logs"]
            ),
            AlertRule(
                name="Low CPU Usage",
                metric_type=MetricType.CPU_USAGE,
                threshold=10.0,
                comparison="<",
                duration=1800,
                severity=AlertSeverity.LOW,
                actions=["scale_down"]
            )
        ]

        for rule in default_rules:
            self.alert_rules[rule.id] = rule

    async def start_monitoring(self, deployment_id: UUID, config: Dict[str, Any] = None) -> Dict[str, Any]:
        """Start monitoring a deployment"""
        try:
            logger.info(f"Starting monitoring for deployment {deployment_id}")

            # Get deployment info
            deployment = await infrastructure_deployment_service.get_deployment_status(deployment_id)
            if not deployment:
                raise ValueError(f"Deployment {deployment_id} not found")

            if deployment.status != DeploymentStatus.DEPLOYED:
                raise ValueError(f"Cannot monitor deployment with status {deployment.status}")

            # Initialize monitoring session
            monitoring_config = {
                "deployment_id": deployment_id,
                "platform": deployment.platform,
                "environment": deployment.environment,
                "started_at": datetime.now(),
                "status": MonitoringStatus.ACTIVE,
                "config": config or {},
                "metrics_interval": config.get("metrics_interval", 60) if config else 60,
                "alert_rules": [rule.id for rule in self.alert_rules.values()],
                "scaling_enabled": config.get("scaling_enabled", False) if config else False
            }

            self.monitoring_sessions[deployment_id] = monitoring_config

            # Start background monitoring task
            asyncio.create_task(self._monitoring_loop(deployment_id))

            return {
                "deployment_id": str(deployment_id),
                "status": "monitoring_started",
                "config": monitoring_config,
                "message": "Real-time monitoring activated"
            }

        except Exception as e:
            logger.error(f"Failed to start monitoring: {e}")
            raise

    async def stop_monitoring(self, deployment_id: UUID) -> Dict[str, Any]:
        """Stop monitoring a deployment"""
        try:
            if deployment_id not in self.monitoring_sessions:
                raise ValueError(f"No active monitoring session for deployment {deployment_id}")

            session = self.monitoring_sessions[deployment_id]
            session["status"] = MonitoringStatus.INACTIVE
            session["stopped_at"] = datetime.now()

            # Generate final report
            report = await self.generate_monitoring_report(
                deployment_id,
                session["started_at"],
                datetime.now()
            )

            # Clean up
            del self.monitoring_sessions[deployment_id]

            return {
                "deployment_id": str(deployment_id),
                "status": "monitoring_stopped",
                "final_report": report,
                "message": "Monitoring session ended"
            }

        except Exception as e:
            logger.error(f"Failed to stop monitoring: {e}")
            raise

    async def _monitoring_loop(self, deployment_id: UUID):
        """Main monitoring loop for a deployment"""
        try:
            session = self.monitoring_sessions.get(deployment_id)
            if not session:
                return

            while (session.get("status") == MonitoringStatus.ACTIVE and
                   deployment_id in self.monitoring_sessions):

                try:
                    # Collect metrics
                    metrics = await self._collect_metrics(deployment_id)
                    for metric in metrics:
                        self.metrics_buffer.append(metric)

                    # Evaluate alert rules
                    await self._evaluate_alerts(deployment_id, metrics)

                    # Check scaling policies
                    if session.get("scaling_enabled"):
                        await self._evaluate_scaling(deployment_id, metrics)

                    # Sleep until next collection
                    await asyncio.sleep(session.get("metrics_interval", 60))

                except Exception as e:
                    logger.error(f"Error in monitoring loop for {deployment_id}: {e}")
                    await asyncio.sleep(60)  # Wait before retrying

        except Exception as e:
            logger.error(f"Monitoring loop failed for {deployment_id}: {e}")
            if deployment_id in self.monitoring_sessions:
                self.monitoring_sessions[deployment_id]["status"] = MonitoringStatus.ERROR

    async def _collect_metrics(self, deployment_id: UUID) -> List[MetricData]:
        """Collect metrics from deployment infrastructure"""
        try:
            session = self.monitoring_sessions.get(deployment_id)
            if not session:
                return []

            platform = session["platform"]
            metrics = []

            # Simulate metric collection (in production, integrate with actual monitoring systems)
            if platform == DeploymentPlatform.AWS:
                metrics.extend(await self._collect_aws_metrics(deployment_id))
            elif platform == DeploymentPlatform.KUBERNETES:
                metrics.extend(await self._collect_k8s_metrics(deployment_id))
            elif platform == DeploymentPlatform.GCP:
                metrics.extend(await self._collect_gcp_metrics(deployment_id))
            else:
                metrics.extend(await self._collect_generic_metrics(deployment_id))

            return metrics

        except Exception as e:
            logger.error(f"Failed to collect metrics for {deployment_id}: {e}")
            return []

    async def _collect_aws_metrics(self, deployment_id: UUID) -> List[MetricData]:
        """Collect AWS CloudWatch metrics"""
        # Simulate AWS CloudWatch metric collection
        import random

        metrics = []
        timestamp = datetime.now()

        base_metrics = [
            (MetricType.CPU_USAGE, random.uniform(20, 90), "%"),
            (MetricType.MEMORY_USAGE, random.uniform(30, 85), "%"),
            (MetricType.NETWORK_IN, random.uniform(100, 1000), "MB/s"),
            (MetricType.NETWORK_OUT, random.uniform(50, 500), "MB/s"),
            (MetricType.REQUEST_COUNT, random.uniform(100, 5000), "req/min"),
            (MetricType.RESPONSE_TIME, random.uniform(50, 500), "ms"),
            (MetricType.ERROR_RATE, random.uniform(0, 10), "%")
        ]

        for metric_type, value, unit in base_metrics:
            metrics.append(MetricData(
                deployment_id=deployment_id,
                metric_type=metric_type,
                value=value,
                unit=unit,
                timestamp=timestamp,
                source="cloudwatch",
                tags={"platform": "aws", "region": "us-west-2"}
            ))

        return metrics

    async def _collect_k8s_metrics(self, deployment_id: UUID) -> List[MetricData]:
        """Collect Kubernetes metrics"""
        # Simulate Kubernetes metrics collection
        import random

        metrics = []
        timestamp = datetime.now()

        k8s_metrics = [
            (MetricType.CPU_USAGE, random.uniform(15, 80), "%"),
            (MetricType.MEMORY_USAGE, random.uniform(25, 75), "%"),
            (MetricType.REQUEST_COUNT, random.uniform(200, 3000), "req/min"),
            (MetricType.RESPONSE_TIME, random.uniform(30, 300), "ms"),
            (MetricType.ERROR_RATE, random.uniform(0, 8), "%")
        ]

        for metric_type, value, unit in k8s_metrics:
            metrics.append(MetricData(
                deployment_id=deployment_id,
                metric_type=metric_type,
                value=value,
                unit=unit,
                timestamp=timestamp,
                source="prometheus",
                tags={"platform": "kubernetes", "namespace": "default"}
            ))

        return metrics

    async def _collect_gcp_metrics(self, deployment_id: UUID) -> List[MetricData]:
        """Collect Google Cloud metrics"""
        # Simulate GCP monitoring metric collection
        import random

        metrics = []
        timestamp = datetime.now()

        gcp_metrics = [
            (MetricType.CPU_USAGE, random.uniform(25, 85), "%"),
            (MetricType.MEMORY_USAGE, random.uniform(35, 80), "%"),
            (MetricType.DISK_USAGE, random.uniform(40, 90), "%"),
            (MetricType.REQUEST_COUNT, random.uniform(150, 4000), "req/min"),
            (MetricType.RESPONSE_TIME, random.uniform(40, 400), "ms")
        ]

        for metric_type, value, unit in gcp_metrics:
            metrics.append(MetricData(
                deployment_id=deployment_id,
                metric_type=metric_type,
                value=value,
                unit=unit,
                timestamp=timestamp,
                source="stackdriver",
                tags={"platform": "gcp", "zone": "us-central1-a"}
            ))

        return metrics

    async def _collect_generic_metrics(self, deployment_id: UUID) -> List[MetricData]:
        """Collect generic system metrics"""
        import random

        metrics = []
        timestamp = datetime.now()

        generic_metrics = [
            (MetricType.CPU_USAGE, random.uniform(10, 70), "%"),
            (MetricType.MEMORY_USAGE, random.uniform(20, 60), "%"),
            (MetricType.DISK_USAGE, random.uniform(30, 80), "%")
        ]

        for metric_type, value, unit in generic_metrics:
            metrics.append(MetricData(
                deployment_id=deployment_id,
                metric_type=metric_type,
                value=value,
                unit=unit,
                timestamp=timestamp,
                source="system",
                tags={"platform": "generic"}
            ))

        return metrics

    async def _evaluate_alerts(self, deployment_id: UUID, metrics: List[MetricData]):
        """Evaluate alert rules against current metrics"""
        try:
            for rule in self.alert_rules.values():
                if not rule.enabled:
                    continue

                if rule.deployment_id and rule.deployment_id != deployment_id:
                    continue

                # Find matching metrics
                matching_metrics = [m for m in metrics if m.metric_type == rule.metric_type]

                for metric in matching_metrics:
                    if self._check_threshold(metric.value, rule.threshold, rule.comparison):
                        await self._trigger_alert(rule, metric, deployment_id)

        except Exception as e:
            logger.error(f"Failed to evaluate alerts for {deployment_id}: {e}")

    def _check_threshold(self, value: float, threshold: float, comparison: str) -> bool:
        """Check if metric value meets threshold condition"""
        if comparison == ">":
            return value > threshold
        elif comparison == "<":
            return value < threshold
        elif comparison == ">=":
            return value >= threshold
        elif comparison == "<=":
            return value <= threshold
        elif comparison == "==":
            return value == threshold
        elif comparison == "!=":
            return value != threshold
        return False

    async def _trigger_alert(self, rule: AlertRule, metric: MetricData, deployment_id: UUID):
        """Trigger an alert based on rule violation"""
        try:
            alert = Alert(
                rule_id=rule.id,
                deployment_id=deployment_id,
                severity=rule.severity,
                message=f"{rule.name}: {metric.metric_type.value} is {metric.value}{metric.unit} "
                       f"(threshold: {rule.threshold})",
                metric_value=metric.value,
                threshold=rule.threshold,
                timestamp=datetime.now()
            )

            self.active_alerts[alert.id] = alert

            # Execute alert actions
            for action in rule.actions:
                await self._execute_alert_action(action, alert, deployment_id)

            logger.warning(f"Alert triggered: {alert.message}")

        except Exception as e:
            logger.error(f"Failed to trigger alert: {e}")

    async def _execute_alert_action(self, action: str, alert: Alert, deployment_id: UUID):
        """Execute alert action"""
        try:
            if action == "scale_up":
                await self._auto_scale(deployment_id, ScalingDirection.UP, f"Alert: {alert.message}")
            elif action == "scale_down":
                await self._auto_scale(deployment_id, ScalingDirection.DOWN, f"Alert: {alert.message}")
            elif action == "notify_admin":
                logger.critical(f"ADMIN NOTIFICATION: {alert.message}")
            elif action == "check_logs":
                logger.info(f"LOG CHECK REQUESTED: {alert.message}")
            elif action == "dump_memory":
                logger.info(f"MEMORY DUMP REQUESTED: {alert.message}")

        except Exception as e:
            logger.error(f"Failed to execute alert action {action}: {e}")

    async def _evaluate_scaling(self, deployment_id: UUID, metrics: List[MetricData]):
        """Evaluate auto-scaling policies"""
        try:
            policies = [p for p in self.scaling_policies.values()
                       if p.deployment_id == deployment_id and p.enabled]

            for policy in policies:
                decision = await self._make_scaling_decision(policy, metrics)
                if decision["action"] != ScalingDirection.MAINTAIN:
                    await self._auto_scale(
                        deployment_id,
                        decision["action"],
                        decision["reason"],
                        decision["target_instances"]
                    )

        except Exception as e:
            logger.error(f"Failed to evaluate scaling for {deployment_id}: {e}")

    async def _make_scaling_decision(self, policy: ScalingPolicy, metrics: List[MetricData]) -> Dict[str, Any]:
        """Make intelligent scaling decision using AI analysis"""
        try:
            # Get recent metrics for analysis
            cpu_metrics = [m for m in metrics if m.metric_type == MetricType.CPU_USAGE]
            memory_metrics = [m for m in metrics if m.metric_type == MetricType.MEMORY_USAGE]

            if not cpu_metrics:
                return {"action": ScalingDirection.MAINTAIN, "reason": "No CPU metrics available"}

            avg_cpu = sum(m.value for m in cpu_metrics) / len(cpu_metrics)
            avg_memory = sum(m.value for m in memory_metrics) / len(memory_metrics) if memory_metrics else 0

            # Simple rule-based decision (can be enhanced with AI)
            current_instances = 3  # Would get from actual deployment

            if avg_cpu > policy.scale_up_threshold:
                target_instances = min(current_instances + 1, policy.max_instances)
                return {
                    "action": ScalingDirection.UP,
                    "target_instances": target_instances,
                    "reason": f"CPU usage {avg_cpu:.1f}% exceeds threshold {policy.scale_up_threshold}%"
                }
            elif avg_cpu < policy.scale_down_threshold and current_instances > policy.min_instances:
                target_instances = max(current_instances - 1, policy.min_instances)
                return {
                    "action": ScalingDirection.DOWN,
                    "target_instances": target_instances,
                    "reason": f"CPU usage {avg_cpu:.1f}% below threshold {policy.scale_down_threshold}%"
                }

            return {"action": ScalingDirection.MAINTAIN, "reason": "Metrics within acceptable range"}

        except Exception as e:
            logger.error(f"Failed to make scaling decision: {e}")
            return {"action": ScalingDirection.MAINTAIN, "reason": f"Decision error: {str(e)}"}

    async def _auto_scale(self, deployment_id: UUID, direction: ScalingDirection,
                         reason: str, target_instances: int = None):
        """Execute auto-scaling action"""
        try:
            current_instances = 3  # Would get from actual deployment
            if not target_instances:
                target_instances = current_instances + (1 if direction == ScalingDirection.UP else -1)

            scaling_action = ScalingAction(
                deployment_id=deployment_id,
                direction=direction,
                current_instances=current_instances,
                target_instances=target_instances,
                reason=reason,
                timestamp=datetime.now()
            )

            # Simulate scaling execution
            await asyncio.sleep(0.1)  # Simulate scaling time
            scaling_action.success = True

            self.scaling_history.append(scaling_action)

            logger.info(f"Auto-scaling executed: {direction.value} from {current_instances} to {target_instances}")

        except Exception as e:
            logger.error(f"Auto-scaling failed: {e}")
            scaling_action.success = False
            scaling_action.error_message = str(e)

    async def get_monitoring_status(self, deployment_id: UUID) -> Dict[str, Any]:
        """Get current monitoring status for a deployment"""
        try:
            if deployment_id not in self.monitoring_sessions:
                return {"status": "not_monitored", "message": "No active monitoring session"}

            session = self.monitoring_sessions[deployment_id]

            # Get recent metrics
            recent_metrics = [m for m in self.metrics_buffer
                            if m.deployment_id == deployment_id and
                            m.timestamp > datetime.now() - timedelta(minutes=10)]

            # Get active alerts
            active_alerts = [a for a in self.active_alerts.values()
                           if a.deployment_id == deployment_id and not a.resolved]

            # Get recent scaling actions
            recent_scaling = [s for s in self.scaling_history
                            if s.deployment_id == deployment_id and
                            s.timestamp > datetime.now() - timedelta(hours=1)]

            return {
                "deployment_id": str(deployment_id),
                "status": session["status"].value,
                "started_at": session["started_at"].isoformat(),
                "platform": session["platform"].value,
                "environment": session["environment"],
                "metrics_count": len(recent_metrics),
                "active_alerts": len(active_alerts),
                "recent_scaling_actions": len(recent_scaling),
                "config": session["config"]
            }

        except Exception as e:
            logger.error(f"Failed to get monitoring status: {e}")
            raise

    async def generate_monitoring_report(self, deployment_id: UUID,
                                       start_time: datetime, end_time: datetime) -> MonitoringReport:
        """Generate comprehensive monitoring report"""
        try:
            # Get metrics for period
            period_metrics = [m for m in self.metrics_buffer
                            if m.deployment_id == deployment_id and
                            start_time <= m.timestamp <= end_time]

            # Get alerts for period
            period_alerts = [a for a in self.active_alerts.values()
                           if a.deployment_id == deployment_id and
                           start_time <= a.timestamp <= end_time]

            # Get scaling actions for period
            period_scaling = [s for s in self.scaling_history
                            if s.deployment_id == deployment_id and
                            start_time <= s.timestamp <= end_time]

            # Generate AI-powered analysis
            analysis = await self._generate_ai_analysis(deployment_id, period_metrics,
                                                      period_alerts, period_scaling)

            # Create metrics summary
            metrics_summary = self._create_metrics_summary(period_metrics)
            alerts_summary = self._create_alerts_summary(period_alerts)
            cost_analysis = self._analyze_costs(period_metrics, period_scaling)

            return MonitoringReport(
                deployment_id=deployment_id,
                period_start=start_time,
                period_end=end_time,
                metrics_summary=metrics_summary,
                alerts_summary=alerts_summary,
                scaling_actions=period_scaling,
                recommendations=analysis.get("recommendations", []),
                cost_analysis=cost_analysis,
                performance_score=analysis.get("health_score", 85)
            )

        except Exception as e:
            logger.error(f"Failed to generate monitoring report: {e}")
            raise

    async def _generate_ai_analysis(self, deployment_id: UUID, metrics: List[MetricData],
                                  alerts: List[Alert], scaling_actions: List[ScalingAction]) -> Dict[str, Any]:
        """Generate AI-powered monitoring analysis"""
        try:
            session = self.monitoring_sessions.get(deployment_id)
            if not session:
                return {"health_score": 0, "recommendations": ["No monitoring session found"]}

            # Prepare data for LLM analysis
            llm_request = LLMRequest(
                prompt="",
                template_name="infrastructure_monitoring_analysis",
                template_vars={
                    "platform": session["platform"].value,
                    "environment": session["environment"],
                    "current_instances": 3,  # Would get from actual deployment
                    "metrics": [
                        {
                            "type": m.metric_type.value,
                            "value": m.value,
                            "unit": m.unit,
                            "trend": "stable"  # Would calculate trend
                        } for m in metrics[-10:]  # Last 10 metrics
                    ],
                    "time_window": 60,
                    "recent_alerts": [
                        {
                            "severity": a.severity.value,
                            "message": a.message,
                            "timestamp": a.timestamp.isoformat()
                        } for a in alerts[-5:]  # Last 5 alerts
                    ],
                    "recent_scaling": [
                        {
                            "direction": s.direction.value,
                            "current_instances": s.current_instances,
                            "target_instances": s.target_instances,
                            "reason": s.reason
                        } for s in scaling_actions[-3:]  # Last 3 scaling actions
                    ]
                },
                model_size=ModelSize.LARGE,
                temperature=0.2,
                max_tokens=3000,
                use_cache=True
            )

            response = await llm_service.generate_completion(llm_request)

            # Parse JSON response
            import re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {
                    "health_score": 75,
                    "recommendations": ["Manual analysis recommended - AI parsing failed"]
                }

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return {
                "health_score": 50,
                "recommendations": [f"Analysis error: {str(e)}"]
            }

    def _create_metrics_summary(self, metrics: List[MetricData]) -> Dict[str, Any]:
        """Create metrics summary"""
        if not metrics:
            return {}

        summary = {}
        for metric_type in MetricType:
            type_metrics = [m for m in metrics if m.metric_type == metric_type]
            if type_metrics:
                values = [m.value for m in type_metrics]
                summary[metric_type.value] = {
                    "count": len(values),
                    "avg": sum(values) / len(values),
                    "min": min(values),
                    "max": max(values),
                    "unit": type_metrics[0].unit
                }

        return summary

    def _create_alerts_summary(self, alerts: List[Alert]) -> Dict[str, Any]:
        """Create alerts summary"""
        if not alerts:
            return {"total": 0}

        severity_counts = {}
        for severity in AlertSeverity:
            severity_counts[severity.value] = len([a for a in alerts if a.severity == severity])

        return {
            "total": len(alerts),
            "by_severity": severity_counts,
            "resolved": len([a for a in alerts if a.resolved]),
            "acknowledged": len([a for a in alerts if a.acknowledged])
        }

    def _analyze_costs(self, metrics: List[MetricData], scaling_actions: List[ScalingAction]) -> Dict[str, Any]:
        """Analyze infrastructure costs"""
        # Simplified cost analysis
        total_instance_hours = len(scaling_actions) * 1  # Simplified calculation
        estimated_hourly_cost = 0.10  # $0.10 per instance hour

        return {
            "estimated_cost": total_instance_hours * estimated_hourly_cost,
            "instance_hours": total_instance_hours,
            "scaling_efficiency": len([s for s in scaling_actions if s.success]) / max(len(scaling_actions), 1),
            "cost_optimization_potential": "medium"
        }

    async def health_check(self) -> Dict[str, Any]:
        """Health check for monitoring service"""
        return {
            "service": "healthy",
            "active_monitoring_sessions": len(self.monitoring_sessions),
            "alert_rules": len(self.alert_rules),
            "scaling_policies": len(self.scaling_policies),
            "active_alerts": len(self.active_alerts),
            "metrics_buffer_size": len(self.metrics_buffer),
            "timestamp": datetime.now().isoformat()
        }


# Service instance
infrastructure_monitoring_service = InfrastructureMonitoringService()
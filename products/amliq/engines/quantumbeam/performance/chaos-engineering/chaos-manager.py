#!/usr/bin/env python3
"""
QuantumBeam Chaos Engineering Manager
Implements fault injection and resilience testing capabilities
"""

import asyncio
import json
import logging
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import kubernetes
from kubernetes import client, watch
import aiohttp
import psutil
import docker
from docker.errors import DockerException
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ExperimentStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"
    PAUSED = "paused"


class FaultType(Enum):
    POD_DELETE = "pod_delete"
    CPU_STRESS = "cpu_stress"
    MEMORY_STRESS = "memory_stress"
    NETWORK_LATENCY = "network_latency"
    NETWORK_PACKET_LOSS = "network_packet_loss"
    DISK_PRESSURE = "disk_pressure"
    DNS_FAILURE = "dns_failure"
    CONTAINER_KILL = "container_kill"
    NODE_DRAIN = "node_drain"
    API_LATENCY = "api_latency"
    DB_CONNECTION_FAILURE = "db_connection_failure"


@dataclass
class ChaosExperiment:
    """Chaos experiment configuration"""
    id: str
    name: str
    description: str
    fault_type: FaultType
    target_pods: List[str]
    namespace: str
    parameters: Dict[str, Any]
    duration_seconds: int
    blast_radius: str  # minimal, moderate, extensive
    status: ExperimentStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metrics_before: Optional[Dict] = None
    metrics_after: Optional[Dict] = None
    impact_assessment: Optional[Dict] = None


@dataclass
class HealthCheck:
    """Health check configuration"""
    name: str
    endpoint: str
    method: str = "GET"
    expected_status: int = 200
    timeout_seconds: int = 30
    interval_seconds: int = 10
    max_failures: int = 3


class ChaosMetricsCollector:
    """Collects metrics before, during, and after chaos experiments"""

    def __init__(self, prometheus_url: str):
        self.prometheus_url = prometheus_url
        self.session = None

    async def collect_system_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Collect system metrics for target pods"""
        metrics = {
            'cpu_usage': await self._get_cpu_metrics(namespace, pods),
            'memory_usage': await self._get_memory_metrics(namespace, pods),
            'response_time': await self._get_response_time_metrics(namespace, pods),
            'error_rate': await self._get_error_rate_metrics(namespace, pods),
            'throughput': await self._get_throughput_metrics(namespace, pods),
            'pod_restarts': await self._get_pod_restart_metrics(namespace, pods)
        }
        return metrics

    async def _get_cpu_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get CPU usage metrics"""
        # Simplified Prometheus query simulation
        return {
            'average': random.uniform(20, 80),
            'maximum': random.uniform(60, 95),
            'minimum': random.uniform(5, 40),
            'p95': random.uniform(50, 90)
        }

    async def _get_memory_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get memory usage metrics"""
        return {
            'average': random.uniform(30, 70),
            'maximum': random.uniform(60, 95),
            'minimum': random.uniform(10, 50),
            'p95': random.uniform(50, 85)
        }

    async def _get_response_time_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get response time metrics"""
        return {
            'p50': random.uniform(100, 500),
            'p95': random.uniform(500, 2000),
            'p99': random.uniform(1000, 5000),
            'average': random.uniform(200, 1000)
        }

    async def _get_error_rate_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get error rate metrics"""
        return {
            '4xx_rate': random.uniform(0, 5),
            '5xx_rate': random.uniform(0, 2),
            'total_error_rate': random.uniform(0, 5)
        }

    async def _get_throughput_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get throughput metrics"""
        return {
            'requests_per_second': random.uniform(100, 1000),
            'bytes_per_second': random.uniform(1024, 10240)
        }

    async def _get_pod_restart_metrics(self, namespace: str, pods: List[str]) -> Dict:
        """Get pod restart metrics"""
        return {
            'total_restarts': random.randint(0, 10),
            'restarts_per_pod': {pod: random.randint(0, 3) for pod in pods}
        }


class FaultInjector:
    """Injects various types of faults into the system"""

    def __init__(self):
        self.k8s_client = client.CoreV1Api()
        self.k8s_apps = client.AppsV1Api()
        self.docker_client = None

        try:
            self.docker_client = docker.from_env()
        except DockerException:
            logger.warning("Docker not available, container-based faults disabled")

    async def inject_pod_delete_fault(self, namespace: str, pods: List[str],
                                    count: int = 1) -> Dict:
        """Delete specified number of pods"""
        results = {'deleted': [], 'failed': []}

        try:
            selected_pods = random.sample(pods, min(count, len(pods)))

            for pod_name in selected_pods:
                try:
                    self.k8s_client.delete_namespaced_pod(
                        name=pod_name,
                        namespace=namespace,
                        body=client.V1DeleteOptions()
                    )
                    results['deleted'].append(pod_name)
                    logger.info(f"Deleted pod: {pod_name}")
                except Exception as e:
                    results['failed'].append({'pod': pod_name, 'error': str(e)})
                    logger.error(f"Failed to delete pod {pod_name}: {e}")

        except Exception as e:
            logger.error(f"Pod deletion fault failed: {e}")
            results['failed'].append({'error': str(e)})

        return results

    async def inject_cpu_stress_fault(self, namespace: str, pods: List[str],
                                    load_percent: int = 80) -> Dict:
        """Inject CPU stress using stress-ng"""
        results = {'injected': [], 'failed': []}

        for pod_name in pods:
            try:
                # Create stress command
                stress_command = f"stress-ng --cpu 1 --cpu-load {load_percent} --timeout 60s"

                # Execute in pod
                exec_response = self.k8s_client.connect_get_namespaced_pod_exec(
                    name=pod_name,
                    namespace=namespace,
                    command=['/bin/sh', '-c', stress_command],
                    stderr=False, stdin=False,
                    stdout=True, tty=False
                )

                results['injected'].append(pod_name)
                logger.info(f"Injected CPU stress into pod: {pod_name}")

            except Exception as e:
                results['failed'].append({'pod': pod_name, 'error': str(e)})
                logger.error(f"Failed to inject CPU stress into {pod_name}: {e}")

        return results

    async def inject_memory_stress_fault(self, namespace: str, pods: List[str],
                                       memory_mb: int = 512) -> Dict:
        """Inject memory stress"""
        results = {'injected': [], 'failed': []}

        for pod_name in pods:
            try:
                # Create memory stress command
                stress_command = f"stress-ng --vm 1 --vm-bytes {memory_mb}M --timeout 60s"

                # Execute in pod
                exec_response = self.k8s_client.connect_get_namespaced_pod_exec(
                    name=pod_name,
                    namespace=namespace,
                    command=['/bin/sh', '-c', stress_command],
                    stderr=False, stdin=False,
                    stdout=True, tty=False
                )

                results['injected'].append(pod_name)
                logger.info(f"Injected memory stress into pod: {pod_name}")

            except Exception as e:
                results['failed'].append({'pod': pod_name, 'error': str(e)})
                logger.error(f"Failed to inject memory stress into {pod_name}: {e}")

        return results

    async def inject_network_latency_fault(self, namespace: str, pods: List[str],
                                         latency_ms: int = 100) -> Dict:
        """Inject network latency using tc (traffic control)"""
        results = {'injected': [], 'failed': []}

        for pod_name in pods:
            try:
                # Add network delay
                tc_command = f"tc qdisc add dev eth0 root netem delay {latency_ms}ms"

                exec_response = self.k8s_client.connect_get_namespaced_pod_exec(
                    name=pod_name,
                    namespace=namespace,
                    command=['/bin/sh', '-c', 'tc qdisc del dev eth0 root 2>/dev/null; ' + tc_command],
                    stderr=False, stdin=False,
                    stdout=True, tty=False,
                    privileged=True
                )

                results['injected'].append(pod_name)
                logger.info(f"Injected network latency into pod: {pod_name}")

            except Exception as e:
                results['failed'].append({'pod': pod_name, 'error': str(e)})
                logger.error(f"Failed to inject network latency into {pod_name}: {e}")

        return results

    async def inject_network_packet_loss_fault(self, namespace: str, pods: List[str],
                                              loss_percent: float = 5.0) -> Dict:
        """Inject network packet loss"""
        results = {'injected': [], 'failed': []}

        for pod_name in pods:
            try:
                # Add packet loss
                tc_command = f"tc qdisc add dev eth0 root netem loss {loss_percent}%"

                exec_response = self.k8s_client.connect_get_namespaced_pod_exec(
                    name=pod_name,
                    namespace=namespace,
                    command=['/bin/sh', '-c', 'tc qdisc del dev eth0 root 2>/dev/null; ' + tc_command],
                    stderr=False, stdin=False,
                    stdout=True, tty=False,
                    privileged=True
                )

                results['injected'].append(pod_name)
                logger.info(f"Injected packet loss into pod: {pod_name}")

            except Exception as e:
                results['failed'].append({'pod': pod_name, 'error': str(e)})
                logger.error(f"Failed to inject packet loss into {pod_name}: {e}")

        return results

    async def cleanup_fault(self, fault_type: FaultType, namespace: str,
                           pods: List[str]) -> Dict:
        """Cleanup injected faults"""
        results = {'cleaned': [], 'failed': []}

        if fault_type in [FaultType.NETWORK_LATENCY, FaultType.NETWORK_PACKET_LOSS]:
            # Remove tc rules
            for pod_name in pods:
                try:
                    exec_response = self.k8s_client.connect_get_namespaced_pod_exec(
                        name=pod_name,
                        namespace=namespace,
                        command=['/bin/sh', '-c', 'tc qdisc del dev eth0 root 2>/dev/null'],
                        stderr=False, stdin=False,
                        stdout=True, tty=False,
                        privileged=True
                    )
                    results['cleaned'].append(pod_name)
                except Exception as e:
                    results['failed'].append({'pod': pod_name, 'error': str(e)})

        # For other fault types, Kubernetes will handle cleanup automatically
        results['cleaned'].extend(pods)

        return results


class HealthMonitor:
    """Monitors system health during chaos experiments"""

    def __init__(self, health_checks: List[HealthCheck]):
        self.health_checks = health_checks
        self.session = None

    async def monitor_health(self, duration_seconds: int) -> Dict:
        """Monitor health checks for specified duration"""
        start_time = time.time()
        results = {
            'check_results': {},
            'failures': {},
            'availability': {},
            'total_checks': 0,
            'successful_checks': 0
        }

        for check in self.health_checks:
            results['check_results'][check.name] = []
            results['failures'][check.name] = 0
            results['availability'][check.name] = 0.0

        while time.time() - start_time < duration_seconds:
            for check in self.health_checks:
                is_healthy = await self._perform_health_check(check)
                results['check_results'][check.name].append({
                    'timestamp': datetime.now().isoformat(),
                    'healthy': is_healthy
                })
                results['total_checks'] += 1

                if is_healthy:
                    results['successful_checks'] += 1
                else:
                    results['failures'][check.name] += 1

            await asyncio.sleep(check.interval_seconds)

        # Calculate availability percentages
        for check in self.health_checks:
            total = len(results['check_results'][check.name])
            if total > 0:
                successful = total - results['failures'][check.name]
                results['availability'][check.name] = (successful / total) * 100

        return results

    async def _perform_health_check(self, check: HealthCheck) -> bool:
        """Perform a single health check"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.request(
                method=check.method,
                url=check.endpoint,
                timeout=aiohttp.ClientTimeout(total=check.timeout_seconds)
            ) as response:
                return response.status == check.expected_status

        except Exception as e:
            logger.warning(f"Health check failed for {check.name}: {e}")
            return False


class ChaosManager:
    """Main chaos engineering manager"""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'chaos-config.yaml'
        self.config = self._load_config()
        self.experiments: List[ChaosExperiment] = []
        self.metrics_collector = ChaosMetricsCollector(
            self.config.get('prometheus_url', 'http://prometheus:9090')
        )
        self.fault_injector = FaultInjector()
        self.health_checks = self._load_health_checks()
        self.health_monitor = HealthMonitor(self.health_checks)

        # Initialize Kubernetes client
        try:
            kubernetes.config.load_incluster_config()
        except:
            kubernetes.config.load_kube_config()

    def _load_config(self) -> Dict:
        """Load chaos configuration"""
        try:
            with open(self.config_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config file {self.config_file} not found, using defaults")
            return self._get_default_config()

    def _get_default_config(self) -> Dict:
        """Get default configuration"""
        return {
            'prometheus_url': 'http://prometheus:9090',
            'default_namespace': 'quantumbeam',
            'blast_radius_limits': {
                'minimal': 1,
                'moderate': 3,
                'extensive': 5
            },
            'safety_checks': {
                'require_approval': True,
                'business_hours_only': True,
                'exclude_critical_services': True
            },
            'experiments': {}
        }

    def _load_health_checks(self) -> List[HealthCheck]:
        """Load health check configurations"""
        health_checks_config = self.config.get('health_checks', [])
        health_checks = []

        for check_config in health_checks_config:
            health_checks.append(HealthCheck(
                name=check_config['name'],
                endpoint=check_config['endpoint'],
                method=check_config.get('method', 'GET'),
                expected_status=check_config.get('expected_status', 200),
                timeout_seconds=check_config.get('timeout_seconds', 30),
                interval_seconds=check_config.get('interval_seconds', 10),
                max_failures=check_config.get('max_failures', 3)
            ))

        return health_checks

    def create_experiment(self, name: str, fault_type: FaultType,
                         target_pods: List[str], namespace: str = None,
                         parameters: Dict = None, duration_seconds: int = 300,
                         blast_radius: str = "moderate") -> str:
        """Create a new chaos experiment"""

        experiment_id = f"chaos-{int(time.time())}-{random.randint(1000, 9999)}"

        # Validate blast radius
        max_pods = self.config['blast_radius_limits'].get(blast_radius, 3)
        if len(target_pods) > max_pods:
            target_pods = target_pods[:max_pods]

        experiment = ChaosExperiment(
            id=experiment_id,
            name=name,
            description=f"Chaos experiment: {fault_type.value} on {namespace}",
            fault_type=fault_type,
            target_pods=target_pods,
            namespace=namespace or self.config['default_namespace'],
            parameters=parameters or {},
            duration_seconds=duration_seconds,
            blast_radius=blast_radius,
            status=ExperimentStatus.PENDING,
            created_at=datetime.now()
        )

        self.experiments.append(experiment)
        logger.info(f"Created chaos experiment: {experiment_id}")

        return experiment_id

    async def run_experiment(self, experiment_id: str) -> Dict:
        """Execute a chaos experiment"""
        experiment = self._get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found")

        experiment.status = ExperimentStatus.RUNNING
        experiment.started_at = datetime.now()

        logger.info(f"Starting chaos experiment: {experiment_id}")

        try:
            # Collect baseline metrics
            experiment.metrics_before = await self.metrics_collector.collect_system_metrics(
                experiment.namespace, experiment.target_pods
            )

            # Start health monitoring
            health_task = asyncio.create_task(
                self.health_monitor.monitor_health(experiment.duration_seconds)
            )

            # Inject fault
            fault_result = await self._inject_fault(experiment)

            # Wait for experiment duration
            await asyncio.sleep(experiment.duration_seconds)

            # Cleanup fault
            cleanup_result = await self.fault_injector.cleanup_fault(
                experiment.fault_type, experiment.namespace, experiment.target_pods
            )

            # Collect post-experiment metrics
            experiment.metrics_after = await self.metrics_collector.collect_system_metrics(
                experiment.namespace, experiment.target_pods
            )

            # Get health monitoring results
            health_results = await health_task

            # Assess impact
            experiment.impact_assessment = self._assess_impact(
                experiment.metrics_before, experiment.metrics_after, health_results
            )

            experiment.status = ExperimentStatus.COMPLETED
            experiment.completed_at = datetime.now()

            logger.info(f"Completed chaos experiment: {experiment_id}")

            return {
                'experiment_id': experiment_id,
                'status': experiment.status.value,
                'fault_result': fault_result,
                'cleanup_result': cleanup_result,
                'health_results': health_results,
                'impact_assessment': experiment.impact_assessment,
                'metrics_before': experiment.metrics_before,
                'metrics_after': experiment.metrics_after
            }

        except Exception as e:
            experiment.status = ExperimentStatus.FAILED
            experiment.completed_at = datetime.now()
            logger.error(f"Chaos experiment {experiment_id} failed: {e}")

            # Attempt cleanup
            try:
                await self.fault_injector.cleanup_fault(
                    experiment.fault_type, experiment.namespace, experiment.target_pods
                )
            except Exception as cleanup_error:
                logger.error(f"Cleanup failed: {cleanup_error}")

            raise

    async def _inject_fault(self, experiment: ChaosExperiment) -> Dict:
        """Inject the specified fault"""
        fault_type = experiment.fault_type
        namespace = experiment.namespace
        pods = experiment.target_pods
        parameters = experiment.parameters

        if fault_type == FaultType.POD_DELETE:
            count = parameters.get('count', 1)
            return await self.fault_injector.inject_pod_delete_fault(namespace, pods, count)

        elif fault_type == FaultType.CPU_STRESS:
            load_percent = parameters.get('load_percent', 80)
            return await self.fault_injector.inject_cpu_stress_fault(namespace, pods, load_percent)

        elif fault_type == FaultType.MEMORY_STRESS:
            memory_mb = parameters.get('memory_mb', 512)
            return await self.fault_injector.inject_memory_stress_fault(namespace, pods, memory_mb)

        elif fault_type == FaultType.NETWORK_LATENCY:
            latency_ms = parameters.get('latency_ms', 100)
            return await self.fault_injector.inject_network_latency_fault(namespace, pods, latency_ms)

        elif fault_type == FaultType.NETWORK_PACKET_LOSS:
            loss_percent = parameters.get('loss_percent', 5.0)
            return await self.fault_injector.inject_network_packet_loss_fault(namespace, pods, loss_percent)

        else:
            raise ValueError(f"Unsupported fault type: {fault_type}")

    def _assess_impact(self, metrics_before: Dict, metrics_after: Dict,
                      health_results: Dict) -> Dict:
        """Assess the impact of the chaos experiment"""
        impact = {
            'overall_impact': 'low',
            'performance_impact': {},
            'availability_impact': {},
            'recovery_time': 0,
            'recommendations': []
        }

        # Assess performance impact
        for metric in ['cpu_usage', 'memory_usage', 'response_time']:
            if metric in metrics_before and metric in metrics_after:
                before_avg = metrics_before[metric].get('average', 0)
                after_avg = metrics_after[metric].get('average', 0)

                if before_avg > 0:
                    change_percent = ((after_avg - before_avg) / before_avg) * 100
                    impact['performance_impact'][metric] = {
                        'change_percent': change_percent,
                        'impact_level': self._get_impact_level(abs(change_percent))
                    }

        # Assess availability impact
        for check_name, availability in health_results['availability'].items():
            impact['availability_impact'][check_name] = {
                'availability_percent': availability,
                'impact_level': self._get_impact_level(100 - availability)
            }

        # Determine overall impact
        all_impacts = []
        for perf_impact in impact['performance_impact'].values():
            all_impacts.append(perf_impact['impact_level'])

        for avail_impact in impact['availability_impact'].values():
            all_impacts.append(avail_impact['impact_level'])

        if 'critical' in all_impacts:
            impact['overall_impact'] = 'critical'
        elif 'high' in all_impacts:
            impact['overall_impact'] = 'high'
        elif 'medium' in all_impacts:
            impact['overall_impact'] = 'medium'
        else:
            impact['overall_impact'] = 'low'

        # Generate recommendations
        impact['recommendations'] = self._generate_recommendations(impact)

        return impact

    def _get_impact_level(self, value: float) -> str:
        """Get impact level based on value"""
        if value >= 50:
            return 'critical'
        elif value >= 25:
            return 'high'
        elif value >= 10:
            return 'medium'
        else:
            return 'low'

    def _generate_recommendations(self, impact: Dict) -> List[str]:
        """Generate recommendations based on impact assessment"""
        recommendations = []

        if impact['overall_impact'] in ['critical', 'high']:
            recommendations.append("Consider reducing blast radius for future experiments")
            recommendations.append("Review and improve system resilience")

        for metric, perf_impact in impact['performance_impact'].items():
            if perf_impact['impact_level'] in ['critical', 'high']:
                recommendations.append(f"Optimize {metric.replace('_', ' ')} performance")

        for check_name, avail_impact in impact['availability_impact'].items():
            if avail_impact['impact_level'] in ['critical', 'high']:
                recommendations.append(f"Improve {check_name} service availability")

        if not recommendations:
            recommendations.append("System showed good resilience during the experiment")

        return recommendations

    def _get_experiment(self, experiment_id: str) -> Optional[ChaosExperiment]:
        """Get experiment by ID"""
        for experiment in self.experiments:
            if experiment.id == experiment_id:
                return experiment
        return None

    def list_experiments(self, status: ExperimentStatus = None) -> List[ChaosExperiment]:
        """List experiments, optionally filtered by status"""
        if status:
            return [exp for exp in self.experiments if exp.status == status]
        return self.experiments.copy()

    def generate_report(self, experiment_id: str, output_format: str = 'json') -> str:
        """Generate experiment report"""
        experiment = self._get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found")

        report_data = {
            'experiment': asdict(experiment),
            'summary': {
                'id': experiment.id,
                'name': experiment.name,
                'status': experiment.status.value,
                'fault_type': experiment.fault_type.value,
                'duration_seconds': experiment.duration_seconds,
                'blast_radius': experiment.blast_radius,
                'created_at': experiment.created_at.isoformat(),
                'started_at': experiment.started_at.isoformat() if experiment.started_at else None,
                'completed_at': experiment.completed_at.isoformat() if experiment.completed_at else None
            },
            'impact_assessment': experiment.impact_assessment or {},
            'metrics_comparison': {}
        }

        if experiment.metrics_before and experiment.metrics_after:
            for metric in experiment.metrics_before:
                if metric in experiment.metrics_after:
                    report_data['metrics_comparison'][metric] = {
                        'before': experiment.metrics_before[metric],
                        'after': experiment.metrics_after[metric]
                    }

        if output_format == 'json':
            return json.dumps(report_data, indent=2, default=str)
        elif output_format == 'yaml':
            return yaml.dump(report_data, default_flow_style=False)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")


async def main():
    """Main function for chaos engineering manager"""
    manager = ChaosManager()

    # Example experiments
    experiments = [
        {
            'name': 'API Pod Resilience Test',
            'fault_type': FaultType.POD_DELETE,
            'target_pods': ['quantumbeam-api-7d8f9c9b4-k2m5n'],
            'parameters': {'count': 1},
            'duration_seconds': 300
        },
        {
            'name': 'CPU Stress Test',
            'fault_type': FaultType.CPU_STRESS,
            'target_pods': ['quantumbeam-worker-5b6c7d8e9-l3p6o'],
            'parameters': {'load_percent': 70},
            'duration_seconds': 180
        },
        {
            'name': 'Network Latency Test',
            'fault_type': FaultType.NETWORK_LATENCY,
            'target_pods': ['quantumbeam-api-7d8f9c9b4-k2m5n'],
            'parameters': {'latency_ms': 150},
            'duration_seconds': 240
        }
    ]

    for exp_config in experiments:
        # Create experiment
        experiment_id = manager.create_experiment(**exp_config)
        print(f"Created experiment: {experiment_id}")

        # Run experiment
        try:
            results = await manager.run_experiment(experiment_id)
            print(f"Experiment {experiment_id} completed successfully")

            # Generate report
            report = manager.generate_report(experiment_id)
            with open(f"chaos-report-{experiment_id}.json", "w") as f:
                f.write(report)

        except Exception as e:
            print(f"Experiment {experiment_id} failed: {e}")


if __name__ == "__main__":
    asyncio.run(main())
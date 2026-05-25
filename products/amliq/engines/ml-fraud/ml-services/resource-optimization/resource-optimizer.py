#!/usr/bin/env python3
"""
Resource Optimization and Right-sizing Automation System
Automated monitoring, analysis, and optimization of Kubernetes resource utilization
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
from kubernetes import client, config, watch
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
OPTIMIZATION_RUNS = Counter('resource_optimization_runs_total', 'Total optimization runs', ['result'])
RESOURCE_UTILIZATION = Gauge('resource_utilization_current', 'Current resource utilization', ['resource', 'namespace', 'pod'])
OPTIMIZATION_RECOMMENDATIONS = Counter('optimization_recommendations_total', 'Total optimization recommendations', ['type', 'severity'])
COST_SAVINGS = Gauge('estimated_cost_savings_usd', 'Estimated cost savings from optimizations')

class ResourceMetricsCollector:
    """Collects detailed resource metrics from Prometheus and Kubernetes"""

    def __init__(self, prometheus_url: str):
        self.prometheus_url = prometheus_url
        self.k8s_apps_v1 = None
        self.k8s_core_v1 = None
        self.session = None

    async def __aenter__(self):
        # Initialize Kubernetes client
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()

        self.k8s_apps_v1 = client.AppsV1Api()
        self.k8s_core_v1 = client.CoreV1Api()

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

    async def get_historical_metrics(self, query: str, hours: int = 168) -> List[Tuple]:
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

    async def get_pod_resource_metrics(self, namespace: str = "production") -> Dict:
        """Collect current resource utilization metrics for all pods"""
        metrics = {
            'cpu': {},
            'memory': {},
            'storage': {},
            'network': {}
        }

        try:
            # CPU utilization per pod
            cpu_query = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{namespace}", container!=""POD"}}[5m])) by (pod)'
            cpu_data = await self.query_prometheus(cpu_query)
            if cpu_data.get('data', {}).get('result'):
                for item in cpu_data['data']['result']:
                    pod = item['metric']['pod']
                    value = float(item['value'][1])
                    metrics['cpu'][pod] = value

            # Memory utilization per pod
            memory_query = f'sum(container_memory_working_set_bytes{{namespace="{namespace}", container!=""POD"}}) by (pod) / 1024 / 1024'  # MB
            memory_data = await self.query_prometheus(memory_query)
            if memory_data.get('data', {}).get('result'):
                for item in memory_data['data']['result']:
                    pod = item['metric']['pod']
                    value = float(item['value'][1])
                    metrics['memory'][pod] = value

            # Storage utilization per pod
            storage_query = f'sum(kubelet_volume_stats_used_bytes{{namespace="{namespace}"}}) by (pod) / 1024 / 1024'  # MB
            storage_data = await self.query_prometheus(storage_query)
            if storage_data.get('data', {}).get('result'):
                for item in storage_data['data']['result']:
                    pod = item['metric']['pod']
                    value = float(item['value'][1])
                    metrics['storage'][pod] = value

            # Network metrics per pod
            network_tx_query = f'sum(rate(container_network_transmit_bytes_total{{namespace="{namespace}", container!=""POD"}}[5m])) by (pod)'
            network_rx_query = f'sum(rate(container_network_receive_bytes_total{{namespace="{namespace}", container!=""POD"}}[5m])) by (pod)'

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
            logger.error(f"Error collecting pod resource metrics: {e}")

        return metrics

    async def get_kubernetes_resources(self, namespace: str = "production") -> Dict:
        """Get Kubernetes resource specifications for all pods"""
        resources = {}

        try:
            # Get all pods in namespace
            pods = self.k8s_core_v1.list_namespaced_pod(namespace=namespace)

            for pod in pods.items:
                pod_name = pod.metadata.name
                resources[pod_name] = {
                    'spec': {
                        'containers': []
                    },
                    'status': {
                        'phase': pod.status.phase,
                        'qos_class': pod.status.qos_class
                    }
                }

                for container in pod.spec.containers:
                    container_resources = {
                        'name': container.name,
                        'requests': container.resources.requests or {},
                        'limits': container.resources.limits or {}
                    }
                    resources[pod_name]['spec']['containers'].append(container_resources)

        except Exception as e:
            logger.error(f"Error getting Kubernetes resources: {e}")

        return resources

    async def get_node_metrics(self) -> Dict:
        """Get node-level resource metrics"""
        node_metrics = {}

        try:
            # Get node CPU utilization
            cpu_query = 'sum(rate(container_cpu_usage_seconds_total{container!=""POD"}[5m])) by (instance)'
            cpu_data = await self.query_prometheus(cpu_query)

            # Get node memory utilization
            memory_query = 'sum(container_memory_working_set_bytes{container!=""POD"}) by (instance) / 1024 / 1024'  # MB
            memory_data = await self.query_prometheus(memory_query)

            if cpu_data.get('data', {}).get('result'):
                for item in cpu_data['data']['result']:
                    instance = item['metric']['instance']
                    node = instance.split(':')[0]  # Extract node name from instance:port
                    cpu_value = float(item['value'][1])

                    if node not in node_metrics:
                        node_metrics[node] = {}
                    node_metrics[node]['cpu'] = cpu_value

            if memory_data.get('data', {}).get('result'):
                for item in memory_data['data']['result']:
                    instance = item['metric']['instance']
                    node = instance.split(':')[0]
                    memory_value = float(item['value'][1])

                    if node not in node_metrics:
                        node_metrics[node] = {}
                    node_metrics[node]['memory'] = memory_value

        except Exception as e:
            logger.error(f"Error getting node metrics: {e}")

        return node_metrics


class ResourceAnalyzer:
    """Analyzes resource utilization patterns and identifies optimization opportunities"""

    def __init__(self, config: Dict):
        self.config = config
        self.thresholds = config.get('thresholds', {})
        self.optimization_rules = config.get('optimization_rules', {})

    def analyze_pod_utilization(self, pod_metrics: Dict, pod_resources: Dict) -> Dict:
        """Analyze individual pod resource utilization and generate recommendations"""
        analysis = {
            'pod_name': None,
            'current_resources': {},
            'utilization_analysis': {},
            'recommendations': [],
            'potential_savings': 0.0
        }

        try:
            # Find pod in resources data
            pod_name = None
            for name in pod_metrics.get('cpu', {}):
                if name in pod_resources:
                    pod_name = name
                    break

            if not pod_name:
                return analysis

            analysis['pod_name'] = pod_name

            # Analyze each container
            pod_resource_data = pod_resources[pod_name]
            for container in pod_resource_data['spec']['containers']:
                container_name = container['name']
                container_analysis = {
                    'name': container_name,
                    'cpu': {},
                    'memory': {},
                    'recommendations': []
                }

                # Analyze CPU utilization
                cpu_analysis = self._analyze_cpu_utilization(
                    container_name,
                    container['requests'],
                    container['limits'],
                    pod_metrics.get('cpu', {})
                )
                container_analysis['cpu'] = cpu_analysis

                # Analyze memory utilization
                memory_analysis = self._analyze_memory_utilization(
                    container_name,
                    container['requests'],
                    container['limits'],
                    pod_metrics.get('memory', {})
                )
                container_analysis['memory'] = memory_analysis

                # Combine recommendations
                container_analysis['recommendations'] = (
                    cpu_analysis.get('recommendations', []) +
                    memory_analysis.get('recommendations', [])
                )

                analysis['utilization_analysis'][container_name] = container_analysis

                # Add to overall recommendations
                analysis['recommendations'].extend(container_analysis['recommendations'])

            # Calculate potential savings
            analysis['potential_savings'] = self._calculate_savings(analysis['recommendations'])

        except Exception as e:
            logger.error(f"Error analyzing pod utilization: {e}")

        return analysis

    def _analyze_cpu_utilization(self, container_name: str, requests: Dict, limits: Dict, cpu_metrics: Dict) -> Dict:
        """Analyze CPU utilization for a container"""
        analysis = {
            'current_request': self._parse_resource(requests.get('cpu', '0')),
            'current_limit': self._parse_resource(limits.get('cpu', '0')),
            'current_utilization': 0.0,
            'utilization_ratio': 0.0,
            'recommendations': []
        }

        try:
            # Get current utilization (average over last hour)
            if container_name in cpu_metrics:
                analysis['current_utilization'] = cpu_metrics[container_name]

                if analysis['current_request'] > 0:
                    analysis['utilization_ratio'] = analysis['current_utilization'] / analysis['current_request']

            # Generate recommendations
            if analysis['current_request'] > 0:
                if analysis['utilization_ratio'] < self.thresholds.get('cpu', {}).get('underutilization', 0.2):
                    # CPU is underutilized
                    recommended_request = max(
                        analysis['current_utilization'] * 1.5,  # Add 50% buffer
                        0.1  # Minimum 0.1 CPU
                    )

                    analysis['recommendations'].append({
                        'type': 'rightsize',
                        'resource': 'cpu_request',
                        'severity': 'medium',
                        'current': analysis['current_request'],
                        'recommended': recommended_request,
                        'reason': f"CPU utilization is low ({analysis['utilization_ratio']:.1%})",
                        'potential_savings': (analysis['current_request'] - recommended_request) * 10  # $10 per CPU unit
                    })

                elif analysis['utilization_ratio'] > self.thresholds.get('cpu', {}).get('overutilization', 0.8):
                    # CPU is overutilized
                    recommended_request = analysis['current_utilization'] * 1.5  # Add 50% buffer

                    analysis['recommendations'].append({
                        'type': 'scale_up',
                        'resource': 'cpu_request',
                        'severity': 'high',
                        'current': analysis['current_request'],
                        'recommended': recommended_request,
                        'reason': f"CPU utilization is high ({analysis['utilization_ratio']:.1%})",
                        'potential_savings': 0  # No savings, performance improvement
                    })

            # Check limits vs requests
            if analysis['current_limit'] > 0 and analysis['current_request'] > 0:
                if analysis['current_limit'] > analysis['current_request'] * 2:
                    # Limit is much higher than request
                    analysis['recommendations'].append({
                        'type': 'optimize_limit',
                        'resource': 'cpu_limit',
                        'severity': 'low',
                        'current': analysis['current_limit'],
                        'recommended': analysis['current_request'] * 1.5,
                        'reason': "CPU limit is unnecessarily high",
                        'potential_savings': (analysis['current_limit'] - analysis['current_request'] * 1.5) * 5
                    })

        except Exception as e:
            logger.error(f"Error analyzing CPU utilization: {e}")

        return analysis

    def _analyze_memory_utilization(self, container_name: str, requests: Dict, limits: Dict, memory_metrics: Dict) -> Dict:
        """Analyze memory utilization for a container"""
        analysis = {
            'current_request': self._parse_resource(requests.get('memory', '0Mi')),
            'current_limit': self._parse_resource(limits.get('memory', '0Mi')),
            'current_utilization': 0.0,
            'utilization_ratio': 0.0,
            'recommendations': []
        }

        try:
            # Get current utilization
            if container_name in memory_metrics:
                analysis['current_utilization'] = memory_metrics[container_name]  # Already in MB

                if analysis['current_request'] > 0:
                    analysis['utilization_ratio'] = analysis['current_utilization'] / analysis['current_request']

            # Generate recommendations
            if analysis['current_request'] > 0:
                if analysis['utilization_ratio'] < self.thresholds.get('memory', {}).get('underutilization', 0.3):
                    # Memory is underutilized
                    recommended_request = max(
                        analysis['current_utilization'] * 2,  # Add 100% buffer
                        128  # Minimum 128MB
                    )

                    analysis['recommendations'].append({
                        'type': 'rightsize',
                        'resource': 'memory_request',
                        'severity': 'medium',
                        'current': analysis['current_request'],
                        'recommended': recommended_request,
                        'reason': f"Memory utilization is low ({analysis['utilization_ratio']:.1%})",
                        'potential_savings': (analysis['current_request'] - recommended_request) * 0.002  # $0.002 per MB
                    })

                elif analysis['utilization_ratio'] > self.thresholds.get('memory', {}).get('overutilization', 0.85):
                    # Memory is overutilized
                    recommended_request = analysis['current_utilization'] * 1.5  # Add 50% buffer

                    analysis['recommendations'].append({
                        'type': 'scale_up',
                        'resource': 'memory_request',
                        'severity': 'high',
                        'current': analysis['current_request'],
                        'recommended': recommended_request,
                        'reason': f"Memory utilization is high ({analysis['utilization_ratio']:.1%})",
                        'potential_savings': 0  # No savings, performance improvement
                    })

            # Check limits vs requests
            if analysis['current_limit'] > 0 and analysis['current_request'] > 0:
                if analysis['current_limit'] > analysis['current_request'] * 2:
                    # Limit is much higher than request
                    analysis['recommendations'].append({
                        'type': 'optimize_limit',
                        'resource': 'memory_limit',
                        'severity': 'low',
                        'current': analysis['current_limit'],
                        'recommended': analysis['current_request'] * 1.5,
                        'reason': "Memory limit is unnecessarily high",
                        'potential_savings': (analysis['current_limit'] - analysis['current_request'] * 1.5) * 0.001
                    })

        except Exception as e:
            logger.error(f"Error analyzing memory utilization: {e}")

        return analysis

    def _parse_resource(self, resource_str: str) -> float:
        """Parse Kubernetes resource string to numeric value"""
        if not resource_str:
            return 0.0

        resource_str = resource_str.strip()

        # Handle CPU resources
        if resource_str.endswith('m'):
            return float(resource_str[:-1]) / 1000
        elif resource_str.endswith(''):
            return float(resource_str[:-1])
        else:
            # Handle memory resources
            if resource_str.endswith('Ki'):
                return float(resource_str[:-2])
            elif resource_str.endswith('Mi'):
                return float(resource_str[:-2])
            elif resource_str.endswith('Gi'):
                return float(resource_str[:-2]) * 1024
            elif resource_str.endswith('k'):
                return float(resource_str[:-1])
            elif resource_str.endswith('M'):
                return float(resource_str[:-1])
            elif resource_str.endswith('G'):
                return float(resource_str[:-1]) * 1024
            else:
                return float(resource_str)

    def _calculate_savings(self, recommendations: List[Dict]) -> float:
        """Calculate potential cost savings from recommendations"""
        total_savings = 0.0

        for rec in recommendations:
            if 'potential_savings' in rec:
                total_savings += rec['potential_savings']

        return total_savings

    def analyze_cluster_utilization(self, pod_metrics: Dict, node_metrics: Dict) -> Dict:
        """Analyze cluster-level utilization patterns"""
        analysis = {
            'cluster_utilization': {},
            'node_utilization': {},
            'optimization_opportunities': [],
            'cluster_recommendations': []
        }

        try:
            # Calculate overall cluster utilization
            total_cpu = sum(pod_metrics.get('cpu', {}).values())
            total_memory = sum(pod_metrics.get('memory', {}).values())

            analysis['cluster_utilization'] = {
                'total_cpu_cores': total_cpu,
                'total_memory_mb': total_memory,
                'pod_count': len(pod_metrics.get('cpu', {}))
            }

            # Analyze node utilization
            for node_name, node_metrics_data in node_metrics.items():
                node_analysis = {
                    'cpu_utilization': node_metrics_data.get('cpu', 0),
                    'memory_utilization': node_metrics_data.get('memory', 0),
                    'pod_count': len([p for p in pod_metrics.get('cpu', {}).keys() if p.startswith(node_name)])
                }
                analysis['node_utilization'][node_name] = node_analysis

                # Identify underutilized nodes
                if node_analysis['cpu_utilization'] < 1.0:  # Less than 1 CPU core
                    analysis['optimization_opportunities'].append({
                        'type': 'node_consolidation',
                        'node': node_name,
                        'cpu_utilization': node_analysis['cpu_utilization'],
                        'memory_utilization': node_analysis['memory_utilization'],
                        'recommendation': 'Consider consolidating workloads or scaling down node pool'
                    })

            # Generate cluster-level recommendations
            if len(pod_metrics.get('cpu', {})) < 10:
                analysis['cluster_recommendations'].append({
                    'type': 'cluster_rightsize',
                    'severity': 'medium',
                    'message': f"Low pod count ({len(pod_metrics.get('cpu', {}))} pods). Consider node pool optimization",
                    'action': 'Review node pool sizing and consider spot instances'
                })

            if total_cpu < 5.0:  # Less than 5 CPU cores utilized
                analysis['cluster_recommendations'].append({
                    'type': 'cost_optimization',
                    'severity': 'medium',
                    'message': f"Low cluster CPU utilization ({total_cpu:.1f} cores)",
                    'action': 'Consider using smaller instance types or spot instances'
                })

        except Exception as e:
            logger.error(f"Error analyzing cluster utilization: {e}")

        return analysis


class OptimizationEngine:
    """Generates and applies resource optimization recommendations"""

    def __init__(self, config: Dict):
        self.config = config
        self.auto_apply = config.get('auto_apply', False)
        self.dry_run = config.get('dry_run', True)

    async def generate_recommendations(self, analyses: List[Dict]) -> Dict:
        """Generate prioritized optimization recommendations"""
        recommendations = {
            'total_savings': 0.0,
            'pod_recommendations': [],
            'cluster_recommendations': [],
            'priority_actions': []
        }

        try:
            all_pod_recommendations = []
            total_savings = 0.0

            # Collect and categorize recommendations
            for analysis in analyses:
                if 'recommendations' in analysis:
                    for rec in analysis['recommendations']:
                        rec['pod_name'] = analysis.get('pod_name', 'unknown')
                        rec['timestamp'] = datetime.utcnow().isoformat()
                        all_pod_recommendations.append(rec)
                        total_savings += rec.get('potential_savings', 0.0)

            # Sort by potential savings (descending)
            all_pod_recommendations.sort(key=lambda x: x.get('potential_savings', 0), reverse=True)

            # Categorize by severity
            high_severity = [r for r in all_pod_recommendations if r.get('severity') == 'high']
            medium_severity = [r for r in all_pod_recommendations if r.get('severity') == 'medium']
            low_severity = [r for r in all_pod_recommendations if r.get('severity') == 'low']

            recommendations['pod_recommendations'] = {
                'high_priority': high_severity[:10],  # Top 10 high-priority
                'medium_priority': medium_severity[:20],  # Top 20 medium-priority
                'low_priority': low_severity[:30]  # Top 30 low-priority
            }

            recommendations['total_savings'] = total_savings

            # Generate priority actions
            if high_severity:
                recommendations['priority_actions'].append({
                    'type': 'urgent_scaling',
                    'message': f"{len(high_severity)} high-severity scaling issues detected",
                    'action': 'Review and apply high-priority scaling recommendations',
                    'estimated_impact': 'Immediate performance improvement'
                })

            if total_savings > 100:  # $100+ monthly savings
                recommendations['priority_actions'].append({
                    'type': 'cost_optimization',
                    'message': f"Potential monthly savings: ${total_savings:.2f}",
                    'action': 'Apply resource right-sizing recommendations',
                    'estimated_impact': f"${total_savings:.2f}/month cost reduction"
                })

        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")

        return recommendations

    async def apply_recommendations(self, recommendations: List[Dict]) -> Dict:
        """Apply optimization recommendations (if auto_apply is enabled)"""
        results = {
            'applied_count': 0,
            'failed_count': 0,
            'skipped_count': 0,
            'details': []
        }

        if not self.auto_apply or not recommendations:
            return results

        try:
            # Initialize Kubernetes client
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            k8s_apps_v1 = client.AppsV1Api()

            for rec in recommendations[:5]:  # Limit to top 5 recommendations for safety
                try:
                    if rec['type'] == 'rightsize' and rec['resource'].endswith('_request'):
                        result = await self._apply_resource_request(rec, k8s_apps_v1)
                        results['details'].append(result)
                        if result['success']:
                            results['applied_count'] += 1
                        else:
                            results['failed_count'] += 1
                    else:
                        results['skipped_count'] += 1
                        results['details'].append({
                            'recommendation': rec,
                            'skipped': True,
                            'reason': 'Recommendation type not supported for auto-apply'
                        })

                except Exception as e:
                    logger.error(f"Error applying recommendation {rec}: {e}")
                    results['failed_count'] += 1
                    results['details'].append({
                        'recommendation': rec,
                        'success': False,
                        'error': str(e)
                    })

        except Exception as e:
            logger.error(f"Error in apply_recommendations: {e}")

        return results

    async def _apply_resource_request(self, recommendation: Dict, k8s_apps_v1) -> Dict:
        """Apply a resource request change to a deployment"""
        result = {
            'recommendation': recommendation,
            'success': False,
            'applied': False,
            'details': {}
        }

        try:
            pod_name = recommendation.get('pod_name')
            if not pod_name:
                result['error'] = 'No pod name specified'
                return result

            # Find the deployment that owns this pod
            deployment = await self._find_deployment_for_pod(pod_name, k8s_apps_v1)
            if not deployment:
                result['error'] = f'Could not find deployment for pod {pod_name}'
                return result

            # Update the resource request
            if self.dry_run:
                result['applied'] = False
                result['details'] = {
                    'deployment': deployment.metadata.name,
                    'namespace': deployment.metadata.namespace,
                    'action': 'DRY RUN: Would update resource request',
                    'resource': recommendation['resource'],
                    'from': recommendation['current'],
                    'to': recommendation['recommended']
                }
                result['success'] = True
            else:
                # Actually apply the change
                patch_result = await self._patch_deployment_resource(
                    deployment,
                    recommendation['container_name'],
                    recommendation['resource'],
                    recommendation['recommended'],
                    k8s_apps_v1
                )

                if patch_result['success']:
                    result['applied'] = True
                    result['details'] = patch_result['details']
                    result['success'] = True
                else:
                    result['error'] = patch_result.get('error', 'Unknown error')

        except Exception as e:
            logger.error(f"Error applying resource request: {e}")
            result['error'] = str(e)

        return result

    async def _find_deployment_for_pod(self, pod_name: str, k8s_apps_v1) -> Optional[Dict]:
        """Find the deployment that owns a specific pod"""
        try:
            # Get owner references from pod
            k8s_core_v1 = client.CoreV1Api()

            # Extract pod name components (remove hash suffix if present)
            base_pod_name = '-'.join(pod_name.split('-')[:-2]) if '-' in pod_name else pod_name

            # Search for deployments
            deployments = k8s_apps_v1.list_namespaced_deployment(namespace='production')

            for deployment in deployments.items:
                if deployment.metadata.name.startswith(base_pod_name):
                    return deployment

        except Exception as e:
            logger.error(f"Error finding deployment for pod {pod_name}: {e}")

        return None

    async def _patch_deployment_resource(self, deployment, container_name: str, resource_type: str, new_value: float, k8s_apps_v1) -> Dict:
        """Patch a deployment with new resource request"""
        result = {'success': False, 'details': {}}

        try:
            # Find the container in the deployment
            container_found = False
            for container in deployment.spec.template.spec.containers:
                if container.name == container_name:
                    container_found = True

                    # Update the resource request
                    if resource_type == 'cpu_request':
                        if not container.resources.requests:
                            container.resources.requests = {}
                        container.resources.requests['cpu'] = f"{new_value}m"
                    elif resource_type == 'memory_request':
                        if not container.resources.requests:
                            container.resources.requests = {}
                        container.resources.requests['memory'] = f"{int(new_value)}Mi"

                    break

            if not container_found:
                result['error'] = f"Container {container_name} not found in deployment"
                return result

            # Apply the patch
            patch_body = {
                'spec': {
                    'template': {
                        'spec': {
                            'containers': [container for container in deployment.spec.template.spec.containers if container.name == container_name]
                        }
                    }
                }
            }

            # Apply the patch
            patch_result = k8s_apps_v1.patch_namespaced_deployment(
                name=deployment.metadata.name,
                namespace=deployment.metadata.namespace,
                body=patch_body
            )

            result['success'] = True
            result['details'] = {
                'deployment': deployment.metadata.name,
                'namespace': deployment.metadata.namespace,
                'container': container_name,
                'resource_type': resource_type,
                'new_value': new_value,
                'patch_applied': True
            }

        except Exception as e:
            logger.error(f"Error patching deployment: {e}")
            result['error'] = str(e)

        return result


class ResourceOptimizer:
    """Main resource optimization system"""

    def __init__(self, config_path: str = "/app/config/config.yaml"):
        self.config = self._load_config(config_path)
        self.metrics_collector = None
        self.analyzer = ResourceAnalyzer(self.config)
        self.optimizer = OptimizationEngine(self.config)

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return self._get_default_config()

    def _get_default_config(self) -> Dict:
        """Get default configuration"""
        return {
            'prometheus': {'url': 'http://prometheus.observability.svc.cluster.local:9090'},
            'thresholds': {
                'cpu': {'underutilization': 0.2, 'overutilization': 0.8},
                'memory': {'underutilization': 0.3, 'overutilization': 0.85}
            },
            'auto_apply': False,
            'dry_run': True,
            'optimization_rules': {
                'min_cpu_request': 0.1,
                'min_memory_request': 128,
                'max_recommendations_per_run': 20
            }
        }

    async def run_optimization_analysis(self) -> Dict:
        """Run complete resource optimization analysis"""
        start_time = datetime.now()
        logger.info("Starting resource optimization analysis")

        try:
            async with self.metrics_collector as collector:
                # Collect current metrics
                pod_metrics = await collector.get_pod_resource_metrics()
                pod_resources = await collector.get_kubernetes_resources()
                node_metrics = await collector.get_node_metrics()

                # Update Prometheus metrics
                for resource, values in pod_metrics.items():
                    if 'cpu' in values:
                        RESOURCE_UTILIZATION.labels(resource='cpu', namespace='production', pod=resource).set(values['cpu'])
                    if 'memory' in values:
                        RESOURCE_UTILIZATION.labels(resource='memory', namespace='production', pod=resource).set(values['memory'])

                # Analyze each pod
                analyses = []
                for pod_name in pod_metrics.get('cpu', {}).keys():
                    filtered_metrics = {resource: {pod_name: values[pod_name]} for resource, values in pod_metrics.items() if pod_name in values}
                    pod_analysis = self.analyzer.analyze_pod_utilization(
                        filtered_metrics,
                        pod_resources
                    )
                    analyses.append(pod_analysis)

                # Analyze cluster utilization
                cluster_analysis = self.analyzer.analyze_cluster_utilization(pod_metrics, node_metrics)

                # Generate recommendations
                recommendations = await self.optimizer.generate_recommendations(analyses)

                # Apply recommendations if auto-apply is enabled
                apply_results = {}
                if self.config.get('auto_apply', False):
                    all_recommendations = []
                    for category in recommendations['pod_recommendations'].values():
                        all_recommendations.extend(category)

                    apply_results = await self.optimizer.apply_recommendations(all_recommendations)

                # Calculate analysis duration
                duration = (datetime.now() - start_time).total_seconds()

                # Update metrics
                OPTIMIZATION_RUNS.labels(result='success').inc()
                COST_SAVINGS.set(recommendations.get('total_savings', 0))

                # Generate report
                report = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'duration_seconds': duration,
                    'summary': {
                        'total_pods_analyzed': len(analyses),
                        'total_recommendations': sum(len(category) for category in recommendations['pod_recommendations'].values()),
                        'total_potential_savings': recommendations.get('total_savings', 0),
                        'applied_recommendations': apply_results.get('applied_count', 0)
                    },
                    'pod_analyses': analyses,
                    'cluster_analysis': cluster_analysis,
                    'recommendations': recommendations,
                    'apply_results': apply_results,
                    'configuration': {
                        'auto_apply_enabled': self.config.get('auto_apply', False),
                        'dry_run_enabled': self.config.get('dry_run', True)
                    }
                }

                logger.info(f"Resource optimization analysis completed in {duration:.2f}s")
                return report

        except Exception as e:
            logger.error(f"Resource optimization analysis failed: {e}")
            OPTIMIZATION_RUNS.labels(result='failure').inc()
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'status': 'failed'
            }


# FastAPI application for HTTP endpoints
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="Resource Optimization API",
    description="API for resource optimization and right-sizing automation",
    version="1.0.0"
)

optimizer = None

class OptimizationResponse(BaseModel):
    success: bool
    report: Optional[Dict] = None
    message: str
    timestamp: str

@app.on_event("startup")
async def startup_event():
    global optimizer
    optimizer = ResourceOptimizer()
    optimizer.metrics_collector = ResourceMetricsCollector(
        optimizer.config['prometheus']['url']
    )

    # Start Prometheus metrics server
    start_http_server(8081)

    logger.info("Resource optimizer started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/ready")
async def ready_check():
    """Ready check endpoint"""
    try:
        if optimizer and optimizer.metrics_collector:
            return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}
        else:
            return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}
    except Exception:
        return {"status": "not_ready", "timestamp": datetime.utcnow().isoformat()}

@app.get("/analyze", response_model=OptimizationResponse)
async def run_optimization_analysis():
    """Run resource optimization analysis and return recommendations"""
    if not optimizer:
        raise HTTPException(status_code=503, detail="Optimizer not initialized")

    try:
        report = await optimizer.run_optimization_analysis()

        return OptimizationResponse(
            success=True,
            report=report,
            message="Resource optimization analysis completed successfully",
            timestamp=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Resource optimization analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommendations")
async def get_recommendations():
    """Get current optimization recommendations"""
    if not optimizer:
        raise HTTPException(status_code=503, detail="Optimizer not initialized")

    try:
        # Run analysis and return only recommendations
        report = await optimizer.run_optimization_analysis()

        return {
            "success": True,
            "recommendations": report.get('recommendations', {}),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/apply-recommendations")
async def apply_optimization_recommendations(background_tasks: BackgroundTasks):
    """Apply optimization recommendations"""
    if not optimizer:
        raise HTTPException(status_code=503, detail="Optimizer not initialized")

    try:
        # Run analysis first to get recommendations
        report = await optimizer.run_optimization_analysis()

        if not optimizer.config.get('auto_apply', False):
            raise HTTPException(
                status_code=400,
                detail="Auto-apply is disabled. Enable it in configuration."
            )

        # Apply recommendations in background
        background_tasks.add_task(
            apply_recommendations_task,
            report.get('recommendations', {})
        )

        return {
            "success": True,
            "message": "Recommendation application started",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to apply recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Get internal metrics"""
    return {
        "optimization_runs_total": OPTIMIZATION_RUNS._value.get(),
        "estimated_cost_savings": COST_SAVINGS._value.get()
    }


async def apply_recommendations_task(recommendations: Dict):
    """Background task to apply recommendations"""
    try:
        logger.info("Starting recommendation application task")

        all_recommendations = []
        for category in recommendations.get('pod_recommendations', {}).values():
            all_recommendations.extend(category)

        results = await optimizer.apply_recommendations(all_recommendations)

        logger.info(f"Recommendation application completed: {results}")

    except Exception as e:
        logger.error(f"Background recommendation application failed: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "resource_optimizer:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )
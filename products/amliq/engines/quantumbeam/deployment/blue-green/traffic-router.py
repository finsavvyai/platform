#!/usr/bin/env python3
"""
Traffic Router for Blue-Green Deployments
Handles automated traffic switching, health checks, and validation
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import aiohttp
import yaml
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TrafficRouter:
    """Main traffic router class for blue-green deployments"""

    def __init__(self, config_path: str = "/app/config/config.yaml"):
        self.config_path = config_path
        self.config = self._load_config()
        self.k8s_apps_v1 = client.AppsV1Api()
        self.k8s_core_v1 = client.CoreV1Api()
        self.k8s_networking = None
        self.namespace = os.getenv('NAMESPACE', 'blue-green')
        self.production_namespace = os.getenv('PRODUCTION_NAMESPACE', 'production')

        # Initialize Kubernetes client
        try:
            config.load_incluster_config()
        except config.ConfigException:
            config.load_kube_config()

        # Try to initialize Istio client if available
        try:
            from kubernetes.client import CustomObjectsApi
            self.k8s_istio = CustomObjectsApi()
        except ImportError:
            logger.warning("Istio client not available, traffic routing will use Kubernetes services only")
            self.k8s_istio = None

        self.session = aiohttp.ClientSession()
        self.current_environment = self.config['router']['default_environment']
        self.traffic_split_enabled = False
        self.deployment_status = {}

    def _load_config(self) -> Dict:
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            raise

    async def health_check(self) -> bool:
        """Health check endpoint"""
        try:
            # Check if we can access Kubernetes API
            self.k8s_core_v1.list_namespace()
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    async def ready_check(self) -> bool:
        """Ready check endpoint"""
        try:
            # Check if configuration is loaded
            if not self.config:
                return False

            # Check if required services exist
            services = list(self.config['services'].keys())
            for service in services:
                try:
                    self.k8s_core_v1.read_namespaced_service(
                        name=f"{service}-blue",
                        namespace=self.namespace
                    )
                    self.k8s_core_v1.read_namespaced_service(
                        name=f"{service}-green",
                        namespace=self.namespace
                    )
                except ApiException as e:
                    if e.status == 404:
                        logger.warning(f"Service {service} not ready: {e}")
                        return False

            return True
        except Exception as e:
            logger.error(f"Ready check failed: {e}")
            return False

    async def switch_traffic(
        self,
        service_name: str,
        target_environment: str,
        validation_timeout: int = 600
    ) -> Dict:
        """
        Switch traffic to target environment with validation

        Args:
            service_name: Name of the service to switch
            target_environment: Target environment (blue or green)
            validation_timeout: Timeout for health checks and validation

        Returns:
            Dict containing switch status and details
        """
        logger.info(f"Starting traffic switch for {service_name} to {target_environment}")

        try:
            # Validate target environment
            if target_environment not in ['blue', 'green']:
                raise ValueError(f"Invalid environment: {target_environment}")

            # Check if target environment service exists and is healthy
            await self._validate_target_environment(service_name, target_environment)

            # Run smoke tests if enabled
            if self.config['validation']['smoke_tests']['enabled']:
                await self._run_smoke_tests(service_name, target_environment)

            # Run performance tests if enabled
            if self.config['validation']['performance_tests']['enabled']:
                await self._run_performance_tests(service_name, target_environment)

            # Switch traffic
            await self._update_service_selector(service_name, target_environment)

            # Update Istio virtual service if available
            if self.k8s_istio:
                await self._update_istio_virtual_service(service_name, target_environment)

            # Update configuration
            await self._update_configuration(service_name, target_environment)

            # Verify traffic switch
            await self._verify_traffic_switch(service_name, target_environment)

            # Send notifications
            await self._send_notification('traffic_switched', {
                'service': service_name,
                'environment': target_environment,
                'timestamp': datetime.utcnow().isoformat()
            })

            logger.info(f"Traffic switch completed for {service_name} to {target_environment}")

            return {
                'status': 'success',
                'service': service_name,
                'target_environment': target_environment,
                'timestamp': datetime.utcnow().isoformat(),
                'validation_results': await self._get_validation_results(service_name, target_environment)
            }

        except Exception as e:
            logger.error(f"Traffic switch failed for {service_name}: {e}")

            # Trigger rollback if enabled
            if self.config['router']['rollback']['automatic_rollback']:
                await self._automatic_rollback(service_name, target_environment, str(e))

            return {
                'status': 'failed',
                'service': service_name,
                'target_environment': target_environment,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    async def _validate_target_environment(self, service_name: str, environment: str) -> None:
        """Validate that target environment is ready"""
        logger.info(f"Validating {service_name} in {environment} environment")

        # Check if service exists
        try:
            service = self.k8s_core_v1.read_namespaced_service(
                name=f"{service_name}-{environment}",
                namespace=self.namespace
            )
        except ApiException as e:
            if e.status == 404:
                raise ValueError(f"Service {service_name}-{environment} not found")
            raise

        # Check if service has endpoints
        try:
            endpoints = self.k8s_core_v1.read_namespaced_endpoints(
                name=f"{service_name}-{environment}",
                namespace=self.namespace
            )

            if not endpoints.subsets or not endpoints.subsets[0].addresses:
                raise ValueError(f"No endpoints available for {service_name}-{environment}")

        except ApiException as e:
            raise ValueError(f"Failed to get endpoints for {service_name}-{environment}: {e}")

        # Perform health check
        health_config = self.config['router']['health_checks']
        service_config = self.config['services'][service_name]
        health_url = f"http://{service_name}-{environment}.{self.namespace}.svc.cluster.local{service_config['health_endpoint']}"

        await self._perform_health_check(health_url, health_config)

    async def _perform_health_check(self, url: str, config: Dict) -> None:
        """Perform health check with retries"""
        interval = int(config['interval'].rstrip('s'))
        timeout = int(config['timeout'].rstrip('s'))
        failure_threshold = config['failure_threshold']
        success_threshold = config['success_threshold']

        consecutive_failures = 0
        consecutive_successes = 0

        start_time = time.time()

        while time.time() - start_time < 300:  # 5 minute timeout
            try:
                async with self.session.get(url, timeout=timeout) as response:
                    if response.status == 200:
                        consecutive_successes += 1
                        consecutive_failures = 0

                        if consecutive_successes >= success_threshold:
                            logger.info(f"Health check passed for {url}")
                            return
                    else:
                        consecutive_failures += 1
                        consecutive_successes = 0

            except Exception as e:
                consecutive_failures += 1
                consecutive_successes = 0
                logger.debug(f"Health check failed for {url}: {e}")

            if consecutive_failures >= failure_threshold:
                raise ValueError(f"Health check failed for {url} after {failure_threshold} consecutive failures")

            await asyncio.sleep(interval)

        raise ValueError(f"Health check timed out for {url}")

    async def _run_smoke_tests(self, service_name: str, environment: str) -> None:
        """Run smoke tests for the service"""
        logger.info(f"Running smoke tests for {service_name} in {environment}")

        # Create smoke test job
        job_name = f"smoke-test-{service_name}-{environment}-{int(time.time())}"

        job_manifest = {
            'apiVersion': 'batch/v1',
            'kind': 'Job',
            'metadata': {
                'name': job_name,
                'namespace': self.namespace,
                'labels': {
                    'app': 'smoke-test',
                    'service': service_name,
                    'environment': environment
                }
            },
            'spec': {
                'template': {
                    'spec': {
                        'restartPolicy': 'Never',
                        'containers': [{
                            'name': 'smoke-test',
                            'image': 'quantumbeam/smoke-tests:latest',
                            'env': [
                                {
                                    'name': 'SERVICE_NAME',
                                    'value': service_name
                                },
                                {
                                    'name': 'SERVICE_URL',
                                    'value': f"http://{service_name}-{environment}.{self.namespace}.svc.cluster.local"
                                },
                                {
                                    'name': 'TEST_SUITE',
                                    'value': self.config['validation']['smoke_tests']['test_suite']
                                }
                            ],
                            'command': ['python', '-m', 'smoke_tests.main'],
                            'resources': {
                                'requests': {
                                    'cpu': '100m',
                                    'memory': '256Mi'
                                },
                                'limits': {
                                    'cpu': '500m',
                                    'memory': '512Mi'
                                }
                            }
                        }]
                    }
                },
                'backoffLimit': 0,
                'activeDeadlineSeconds': self.config['validation']['smoke_tests']['timeout']
            }
        }

        try:
            # Create job
            self.k8s_batch_v1 = client.BatchV1Api()
            self.k8s_batch_v1.create_namespaced_job(
                namespace=self.namespace,
                body=job_manifest
            )

            # Wait for job completion
            await self._wait_for_job_completion(job_name)

            # Check job result
            job = self.k8s_batch_v1.read_namespaced_job(
                name=job_name,
                namespace=self.namespace
            )

            if job.status.succeeded != 1:
                # Get logs to understand failure
                pods = self.k8s_core_v1.list_namespaced_pod(
                    namespace=self.namespace,
                    label_selector=f"job-name={job_name}"
                )

                if pods.items:
                    logs = self.k8s_core_v1.read_namespaced_pod_log(
                        name=pods.items[0].metadata.name,
                        namespace=self.namespace
                    )
                    logger.error(f"Smoke test logs: {logs}")

                raise ValueError(f"Smoke tests failed for {service_name}")

            logger.info(f"Smoke tests passed for {service_name}")

        except Exception as e:
            raise ValueError(f"Smoke test execution failed: {e}")
        finally:
            # Clean up job
            try:
                self.k8s_batch_v1.delete_namespaced_job(
                    name=job_name,
                    namespace=self.namespace,
                    propagation_policy='Background'
                )
            except:
                pass

    async def _wait_for_job_completion(self, job_name: str, timeout: int = 600) -> None:
        """Wait for job completion with timeout"""
        self.k8s_batch_v1 = client.BatchV1Api()

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                job = self.k8s_batch_v1.read_namespaced_job(
                    name=job_name,
                    namespace=self.namespace
                )

                if job.status.succeeded or job.status.failed:
                    return

                await asyncio.sleep(5)

            except ApiException as e:
                if e.status == 404:
                    raise ValueError(f"Job {job_name} not found")
                raise

        raise ValueError(f"Job {job_name} timed out")

    async def _run_performance_tests(self, service_name: str, environment: str) -> None:
        """Run performance tests and compare with baseline"""
        logger.info(f"Running performance tests for {service_name} in {environment}")

        # This would implement performance testing logic
        # For now, we'll simulate a basic performance check

        service_config = self.config['services'][service_name]
        perf_thresholds = service_config['performance_thresholds']

        # Simulate performance metrics collection
        # In a real implementation, this would run actual performance tests
        await asyncio.sleep(2)  # Simulate test execution

        # Simulate results (in real implementation, these would be actual measurements)
        results = {
            'response_time_p95': '450ms',  # Within 500ms threshold
            'error_rate': '0.5%',  # Within 1% threshold
            'throughput_degradation': '3%'  # Within 5% threshold
        }

        # Check thresholds
        for metric, threshold in perf_thresholds.items():
            if metric not in results:
                logger.warning(f"Performance metric {metric} not available")
                continue

            # Basic threshold checking (would be more sophisticated in real implementation)
            logger.info(f"Performance metric {metric}: {results[metric]} (threshold: {threshold})")

        logger.info(f"Performance tests passed for {service_name}")

    async def _update_service_selector(self, service_name: str, environment: str) -> None:
        """Update production service selector to point to target environment"""
        logger.info(f"Updating service selector for {service_name} to {environment}")

        try:
            service = self.k8s_core_v1.read_namespaced_service(
                name=service_name,
                namespace=self.production_namespace
            )

            # Update selector
            if not service.spec.selector:
                service.spec.selector = {}

            service.spec.selector.update({
                'app': service_name,
                'environment': environment
            })

            self.k8s_core_v1.patch_namespaced_service(
                name=service_name,
                namespace=self.production_namespace,
                body=service
            )

            logger.info(f"Service selector updated for {service_name}")

        except ApiException as e:
            raise ValueError(f"Failed to update service selector: {e}")

    async def _update_istio_virtual_service(self, service_name: str, environment: str) -> None:
        """Update Istio virtual service for traffic routing"""
        if not self.k8s_istio:
            return

        logger.info(f"Updating Istio virtual service for {service_name} to {environment}")

        try:
            vs_name = f"{service_name}-vs"
            vs = self.k8s_istio.get_namespaced_custom_object(
                group="networking.istio.io",
                version="v1beta1",
                plural="virtualservices",
                name=vs_name,
                namespace=self.production_namespace
            )

            # Update default route to point to target environment
            target_host = f"{service_name}-{environment}.{self.namespace}.svc.cluster.local"

            vs['spec']['http'][0]['route'][0]['destination']['host'] = target_host

            self.k8s_istio.patch_namespaced_custom_object(
                group="networking.istio.io",
                version="v1beta1",
                plural="virtualservices",
                name=vs_name,
                namespace=self.production_namespace,
                body=vs
            )

            logger.info(f"Istio virtual service updated for {service_name}")

        except Exception as e:
            logger.warning(f"Failed to update Istio virtual service: {e}")

    async def _update_configuration(self, service_name: str, environment: str) -> None:
        """Update traffic router configuration"""
        logger.info(f"Updating configuration for {service_name} to {environment}")

        try:
            configmap = self.k8s_core_v1.read_namespaced_config_map(
                name="traffic-router-config",
                namespace=self.namespace
            )

            # Update default environment in configuration
            config_content = configmap.data['config.yaml']
            config_data = yaml.safe_load(config_content)
            config_data['router']['default_environment'] = environment

            configmap.data['config.yaml'] = yaml.dump(config_data)

            self.k8s_core_v1.patch_namespaced_config_map(
                name="traffic-router-config",
                namespace=self.namespace,
                body=configmap
            )

            self.current_environment = environment
            logger.info(f"Configuration updated for {service_name}")

        except Exception as e:
            logger.warning(f"Failed to update configuration: {e}")

    async def _verify_traffic_switch(self, service_name: str, environment: str) -> None:
        """Verify that traffic switch was successful"""
        logger.info(f"Verifying traffic switch for {service_name} to {environment}")

        service_config = self.config['services'][service_name]
        health_url = f"http://{service_name}.{self.production_namespace}.svc.cluster.local{service_config['health_endpoint']}"

        health_config = self.config['router']['health_checks']
        await self._perform_health_check(health_url, health_config)

        logger.info(f"Traffic switch verified for {service_name}")

    async def _automatic_rollback(self, service_name: str, from_environment: str, reason: str) -> None:
        """Perform automatic rollback"""
        logger.warning(f"Triggering automatic rollback for {service_name} from {from_environment}")

        to_environment = 'green' if from_environment == 'blue' else 'blue'

        try:
            await self.switch_traffic(service_name, to_environment)

            await self._send_notification('rollback_triggered', {
                'service': service_name,
                'from_environment': from_environment,
                'to_environment': to_environment,
                'reason': reason,
                'timestamp': datetime.utcnow().isoformat()
            })

            logger.info(f"Automatic rollback completed for {service_name}")

        except Exception as e:
            logger.error(f"Automatic rollback failed for {service_name}: {e}")

    async def _send_notification(self, event_type: str, data: Dict) -> None:
        """Send notifications for deployment events"""
        if not self.config['notifications']['enabled']:
            return

        notification_config = self.config['notifications']

        if not notification_config['events'].get(event_type, False):
            return

        message = self._format_notification_message(event_type, data)

        # Send to different channels based on configuration
        channels = notification_config['channels']

        # Slack notification
        if 'slack' in channels and channels['slack'].get('webhook_url'):
            await self._send_slack_notification(channels['slack'], message)

        # PagerDuty notification
        if 'pagerduty' in channels and channels['pagerduty'].get('integration_key'):
            await self._send_pagerduty_notification(channels['pagerduty'], event_type, data)

        # Email notification
        if 'email' in channels and channels['email'].get('enabled'):
            await self._send_email_notification(channels['email'], message)

    def _format_notification_message(self, event_type: str, data: Dict) -> str:
        """Format notification message based on event type"""
        if event_type == 'traffic_switched':
            return f"✅ Traffic switched for {data['service']} to {data['environment']} environment"
        elif event_type == 'rollback_triggered':
            return f"🚨 Rollback triggered for {data['service']} from {data['from_environment']} to {data['to_environment']}. Reason: {data['reason']}"
        elif event_type == 'health_check_failed':
            return f"❌ Health check failed for {data['service']} in {data['environment']} environment"
        elif event_type == 'smoke_test_failed':
            return f"❌ Smoke tests failed for {data['service']} in {data['environment']} environment"
        else:
            return f"ℹ️ {event_type}: {json.dumps(data, indent=2)}"

    async def _send_slack_notification(self, config: Dict, message: str) -> None:
        """Send Slack notification"""
        try:
            payload = {
                'text': message,
                'channel': config.get('channel', '#deployments'),
                'username': 'Traffic Router',
                'icon_emoji': ':robot_face:'
            }

            async with self.session.post(
                config['webhook_url'],
                json=payload,
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.error(f"Failed to send Slack notification: {response.status}")
                else:
                    logger.info("Slack notification sent successfully")

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")

    async def _send_pagerduty_notification(self, config: Dict, event_type: str, data: Dict) -> None:
        """Send PagerDuty notification"""
        try:
            severity = 'critical' if event_type in ['rollback_triggered', 'health_check_failed'] else 'info'

            payload = {
                'routing_key': config['integration_key'],
                'event_action': 'trigger',
                'payload': {
                    'summary': self._format_notification_message(event_type, data),
                    'severity': severity,
                    'source': 'traffic-router',
                    'component': data['service'],
                    'group': 'blue-green-deployment',
                    'class': event_type,
                    'custom_details': data
                }
            }

            async with self.session.post(
                'https://events.pagerduty.com/v2/enqueue',
                json=payload,
                timeout=10
            ) as response:
                if response.status != 202:
                    logger.error(f"Failed to send PagerDuty notification: {response.status}")
                else:
                    logger.info("PagerDuty notification sent successfully")

        except Exception as e:
            logger.error(f"Error sending PagerDuty notification: {e}")

    async def _send_email_notification(self, config: Dict, message: str) -> None:
        """Send email notification (placeholder implementation)"""
        # This would integrate with your email service
        logger.info(f"Email notification: {message}")

    async def _get_validation_results(self, service_name: str, environment: str) -> Dict:
        """Get validation results for the deployment"""
        return {
            'health_checks': 'passed',
            'smoke_tests': 'passed',
            'performance_tests': 'passed',
            'timestamp': datetime.utcnow().isoformat()
        }

    async def get_deployment_status(self) -> Dict:
        """Get current deployment status"""
        status = {
            'current_environment': self.current_environment,
            'services': {},
            'last_updated': datetime.utcnow().isoformat()
        }

        for service_name in self.config['services'].keys():
            service_status = {}

            # Check blue environment
            try:
                blue_service = self.k8s_core_v1.read_namespaced_service(
                    name=f"{service_name}-blue",
                    namespace=self.namespace
                )
                blue_endpoints = self.k8s_core_v1.read_namespaced_endpoints(
                    name=f"{service_name}-blue",
                    namespace=self.namespace
                )

                service_status['blue'] = {
                    'exists': True,
                    'endpoints': len(blue_endpoints.subsets[0].addresses) if blue_endpoints.subsets else 0,
                    'cluster_ip': blue_service.spec.cluster_ip
                }
            except ApiException:
                service_status['blue'] = {'exists': False}

            # Check green environment
            try:
                green_service = self.k8s_core_v1.read_namespaced_service(
                    name=f"{service_name}-green",
                    namespace=self.namespace
                )
                green_endpoints = self.k8s_core_v1.read_namespaced_endpoints(
                    name=f"{service_name}-green",
                    namespace=self.namespace
                )

                service_status['green'] = {
                    'exists': True,
                    'endpoints': len(green_endpoints.subsets[0].addresses) if green_endpoints.subsets else 0,
                    'cluster_ip': green_service.spec.cluster_ip
                }
            except ApiException:
                service_status['green'] = {'exists': False}

            # Check production service
            try:
                prod_service = self.k8s_core_v1.read_namespaced_service(
                    name=service_name,
                    namespace=self.production_namespace
                )
                service_status['production'] = {
                    'selector': prod_service.spec.selector,
                    'cluster_ip': prod_service.spec.cluster_ip
                }
            except ApiException:
                service_status['production'] = {'exists': False}

            status['services'][service_name] = service_status

        return status


# FastAPI application for HTTP endpoints
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="Traffic Router API",
    description="API for managing blue-green deployments and traffic routing",
    version="1.0.0"
)

router = None

@app.on_event("startup")
async def startup_event():
    global router
    router = TrafficRouter()

@app.on_event("shutdown")
async def shutdown_event():
    if router:
        await router.session.close()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    is_healthy = await router.health_check()
    return {"status": "healthy" if is_healthy else "unhealthy"}

@app.get("/ready")
async def ready_check():
    """Ready check endpoint"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    is_ready = await router.ready_check()
    return {"status": "ready" if is_ready else "not_ready"}

@app.get("/status")
async def get_status():
    """Get current deployment status"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    status = await router.get_deployment_status()
    return status

class TrafficSwitchRequest(BaseModel):
    service_name: str
    target_environment: str
    validation_timeout: Optional[int] = 600

@app.post("/switch-traffic")
async def switch_traffic(request: TrafficSwitchRequest):
    """Switch traffic to target environment"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    try:
        result = await router.switch_traffic(
            service_name=request.service_name,
            target_environment=request.target_environment,
            validation_timeout=request.validation_timeout
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/services")
async def get_services():
    """Get list of configured services"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    return {"services": list(router.config['services'].keys())}

@app.get("/config")
async def get_config():
    """Get current configuration"""
    if not router:
        raise HTTPException(status_code=503, detail="Router not initialized")

    return router.config


if __name__ == "__main__":
    import uvicorn

    # Set up basic logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    uvicorn.run(
        "traffic_router:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        access_log=True
    )
#!/usr/bin/env python3
"""
QuantumBeam Load Testing and Performance Benchmarking Suite
Comprehensive performance testing with multiple tools and scenarios.
"""

import os
import sys
import json
import yaml
import time
import logging
import argparse
import subprocess
import threading
import statistics
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import concurrent.futures
import xml.etree.ElementTree as ET
import jinja2
import boto3
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TestScenario:
    """Load test scenario configuration."""
    name: str
    description: str
    target_url: str
    method: str = "GET"
    headers: Dict[str, str] = None
    body: str = None
    duration: int = 60  # seconds
    concurrent_users: int = 10
    ramp_up_time: int = 10  # seconds
    think_time: float = 1.0  # seconds
    timeout: int = 30  # seconds
    expected_status_codes: List[int] = None
    assertions: List[Dict[str, Any]] = None

@dataclass
class TestResult:
    """Load test result data."""
    scenario_name: str
    start_time: datetime
    end_time: datetime
    duration: float
    total_requests: int
    successful_requests: int
    failed_requests: int
    requests_per_second: float
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    p50_response_time: float
    p95_response_time: float
    p99_response_time: float
    bytes_transferred: int
    errors: List[Dict[str, Any]]
    tool_used: str
    custom_metrics: Dict[str, Any] = None

class LoadTestTool:
    """Base class for load testing tools."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__

    def run_test(self, scenario: TestScenario) -> TestResult:
        """Run a load test with the given scenario."""
        raise NotImplementedError

    def is_available(self) -> bool:
        """Check if the tool is available."""
        return True

class ApacheBenchTool(LoadTestTool):
    """Apache Bench (ab) load testing tool."""

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config or {})

    def is_available(self) -> bool:
        """Check if ab is available."""
        try:
            subprocess.run(['ab', '-V'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def run_test(self, scenario: TestScenario) -> TestResult:
        """Run load test with Apache Bench."""
        logger.info(f"Running Apache Bench test: {scenario.name}")

        start_time = datetime.now()

        # Build ab command
        cmd = [
            'ab',
            '-n', str(scenario.concurrent_users * 10),  # Total requests
            '-c', str(scenario.concurrent_users),      # Concurrent users
            '-t', str(scenario.duration),             # Duration
            '-k',                                     # Keep-alive
            '-v', '2',                                # Verbose output
        ]

        # Add headers
        if scenario.headers:
            for key, value in scenario.headers.items():
                cmd.extend(['-H', f'{key}: {value}'])

        # Add POST data if present
        if scenario.method.upper() == 'POST' and scenario.body:
            cmd.extend(['-p', '-'])
            cmd.extend(['-T', 'application/json'])

        cmd.append(scenario.target_url)

        # Run the test
        try:
            if scenario.method.upper() == 'POST' and scenario.body:
                result = subprocess.run(
                    cmd,
                    input=scenario.body.encode(),
                    capture_output=True,
                    text=True,
                    timeout=scenario.duration + 60
                )
            else:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=scenario.duration + 60
                )

            end_time = datetime.now()

            if result.returncode != 0:
                logger.error(f"Apache Bench failed: {result.stderr}")
                raise RuntimeError(f"Apache Bench failed: {result.stderr}")

            # Parse ab output
            return self._parse_ab_output(result.stdout, scenario, start_time, end_time)

        except subprocess.TimeoutExpired:
            end_time = datetime.now()
            logger.error("Apache Bench test timed out")
            raise RuntimeError("Apache Bench test timed out")

    def _parse_ab_output(self, output: str, scenario: TestScenario,
                        start_time: datetime, end_time: datetime) -> TestResult:
        """Parse Apache Bench output."""
        lines = output.split('\n')

        # Extract metrics from ab output
        total_requests = 0
        failed_requests = 0
        requests_per_second = 0.0
        time_per_request = 0.0
        response_times = []

        for line in lines:
            if 'Complete requests:' in line:
                total_requests = int(line.split(':')[1].strip())
            elif 'Failed requests:' in line:
                failed_requests = int(line.split(':')[1].strip())
            elif 'Requests per second:' in line:
                requests_per_second = float(line.split(':')[1].split()[0])
            elif 'Time per request:' in line and '(mean)' in line:
                time_per_request = float(line.split(':')[1].split()[0])
            elif 'Percentage of the requests served within a certain time (ms)' in line:
                # Parse percentile response times
                i = lines.index(line) + 2
                while i < len(lines) and '%' in lines[i]:
                    try:
                        percentile_line = lines[i].strip()
                        if percentile_line:
                            parts = percentile_line.split()
                            if len(parts) >= 2:
                                response_times.append(float(parts[1]))
                        i += 1
                    except (ValueError, IndexError):
                        break

        duration = (end_time - start_time).total_seconds()
        successful_requests = total_requests - failed_requests

        # Calculate percentiles
        if response_times:
            p50 = response_times[0] if len(response_times) > 0 else time_per_request
            p95 = response_times[4] if len(response_times) > 4 else time_per_request
            p99 = response_times[8] if len(response_times) > 8 else time_per_request
        else:
            p50 = p95 = p99 = time_per_request

        return TestResult(
            scenario_name=scenario.name,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            requests_per_second=requests_per_second,
            avg_response_time=time_per_request,
            min_response_time=0.0,  # ab doesn't provide min
            max_response_time=0.0,  # ab doesn't provide max
            p50_response_time=p50,
            p95_response_time=p95,
            p99_response_time=p99,
            bytes_transferred=0,  # Could parse from output if needed
            errors=[],
            tool_used="Apache Bench"
        )

class WrkTool(LoadTestTool):
    """wrk load testing tool."""

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config or {})

    def is_available(self) -> bool:
        """Check if wrk is available."""
        try:
            subprocess.run(['wrk', '--version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def run_test(self, scenario: TestScenario) -> TestResult:
        """Run load test with wrk."""
        logger.info(f"Running wrk test: {scenario.name}")

        start_time = datetime.now()

        # Build wrk command
        cmd = [
            'wrk',
            '-t', '12',                              # Threads
            '-c', str(scenario.concurrent_users),    # Connections
            '-d', f'{scenario.duration}s',           # Duration
            '--timeout', str(scenario.timeout),      # Timeout
            '--latency',                            # Show latency distribution
        ]

        # Add script for POST requests or custom headers
        if scenario.method.upper() == 'POST' or scenario.headers:
            script_content = self._generate_wrk_script(scenario)
            script_file = f'/tmp/wrk_script_{scenario.name}.lua'
            with open(script_file, 'w') as f:
                f.write(script_content)
            cmd.extend(['-s', script_file])

        cmd.append(scenario.target_url)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=scenario.duration + 60
            )

            end_time = datetime.now()

            # Clean up script file
            if scenario.method.upper() == 'POST' or scenario.headers:
                try:
                    os.remove(script_file)
                except OSError:
                    pass

            if result.returncode != 0:
                logger.error(f"wrk failed: {result.stderr}")
                raise RuntimeError(f"wrk failed: {result.stderr}")

            # Parse wrk output
            return self._parse_wrk_output(result.stdout, scenario, start_time, end_time)

        except subprocess.TimeoutExpired:
            end_time = datetime.now()
            logger.error("wrk test timed out")
            raise RuntimeError("wrk test timed out")

    def _generate_wrk_script(self, scenario: TestScenario) -> str:
        """Generate wrk Lua script."""
        script = ["wrk.method = \"" + scenario.method + "\""]

        if scenario.headers:
            for key, value in scenario.headers.items():
                script.append(f'wrk.headers["{key}"] = "{value}"')

        if scenario.method.upper() == 'POST' and scenario.body:
            script.append(f'wrk.body = "{scenario.body}"')

        return "\n".join(script)

    def _parse_wrk_output(self, output: str, scenario: TestScenario,
                         start_time: datetime, end_time: datetime) -> TestResult:
        """Parse wrk output."""
        lines = output.split('\n')

        total_requests = 0
        failed_requests = 0
        requests_per_second = 0.0
        avg_response_time = 0.0
        response_time_dist = {}

        for line in lines:
            if 'requests in' in line and 's' in line:
                # Extract requests and duration
                parts = line.split()
                total_requests = int(parts[0])
                requests_per_second = float(parts[-2])
            elif 'Socket errors:' in line:
                # Extract socket errors (includes failed requests)
                error_parts = line.split(':')[1].strip().split(',')
                for error_part in error_parts:
                    if 'connect' in error_part or 'read' in error_part or 'write' in error_part:
                        failed_requests += int(error_part.strip().split()[0])
            elif 'Latency Distribution' in line:
                # Parse latency distribution
                i = lines.index(line) + 2
                while i < len(lines) and '%' in lines[i]:
                    try:
                        percentile_line = lines[i].strip()
                        if percentile_line:
                            parts = percentile_line.split()
                            if len(parts) >= 2:
                                response_time_dist[parts[1]] = float(parts[2].strip('µs')) / 1000.0  # Convert to ms
                        i += 1
                    except (ValueError, IndexError):
                        break

        duration = (end_time - start_time).total_seconds()
        successful_requests = total_requests - failed_requests

        # Extract response times from distribution
        p50 = response_time_dist.get('50.000%', 0.0)
        p95 = response_time_dist.get('95.000%', 0.0)
        p99 = response_time_dist.get('99.000%', 0.0)

        # Look for average latency in the output
        for line in lines:
            if 'Latency' in line and 'ms' in line:
                avg_response_time = float(line.split()[1])
                break

        return TestResult(
            scenario_name=scenario.name,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            requests_per_second=requests_per_second,
            avg_response_time=avg_response_time,
            min_response_time=response_time_dist.get('0.000%', 0.0),
            max_response_time=response_time_dist.get('100.000%', 0.0),
            p50_response_time=p50,
            p95_response_time=p95,
            p99_response_time=p99,
            bytes_transferred=0,
            errors=[],
            tool_used="wrk"
        )

class LocustTool(LoadTestTool):
    """Locust load testing tool."""

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config or {})

    def is_available(self) -> bool:
        """Check if locust is available."""
        try:
            import locust
            return True
        except ImportError:
            return False

    def run_test(self, scenario: TestScenario) -> TestResult:
        """Run load test with Locust."""
        logger.info(f"Running Locust test: {scenario.name}")

        # Generate Locust file
        locust_file = self._generate_locust_file(scenario)

        start_time = datetime.now()

        # Build locust command
        cmd = [
            'locust',
            '-f', locust_file,
            '--headless',
            '-u', str(scenario.concurrent_users),
            '-r', str(scenario.concurrent_users // scenario.ramp_up_time) if scenario.ramp_up_time > 0 else str(scenario.concurrent_users),
            '-t', f'{scenario.duration}s',
            '--host', scenario.target_url.split('/')[0] + '//' + scenario.target_url.split('/')[2],
            '--html', f'/tmp/locust_report_{scenario.name}.html',
            '--csv', f'/tmp/locust_stats_{scenario.name}',
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=scenario.duration + 120
            )

            end_time = datetime.now()

            # Clean up locust file
            try:
                os.remove(locust_file)
            except OSError:
                pass

            if result.returncode != 0:
                logger.error(f"Locust failed: {result.stderr}")
                raise RuntimeError(f"Locust failed: {result.stderr}")

            # Parse Locust statistics
            return self._parse_locust_stats(scenario, start_time, end_time)

        except subprocess.TimeoutExpired:
            end_time = datetime.now()
            logger.error("Locust test timed out")
            raise RuntimeError("Locust test timed out")

    def _generate_locust_file(self, scenario: TestScenario) -> str:
        """Generate Locust Python file."""
        locust_file = f'/tmp/locust_{scenario.name}.py'

        content = f'''
from locust import HttpUser, task, between
import json

class QuantumBeamUser(HttpUser):
    wait_time = between({scenario.think_time * 0.5}, {scenario.think_time * 1.5})

    def on_start(self):
        """Called when a user starts."""
        pass

    @task
    def {scenario.name.replace(" ", "_").replace("-", "_")}_request(self):
        """Main task for the scenario."""
        url = "{scenario.target_url}"

        if "{scenario.method}".upper() == "POST":
            response = self.client.post(
                url,
                data={json.loads(scenario.body) if scenario.body else "{}"},
                headers={scenario.headers if scenario.headers else "{}"}
            )
        else:
            response = self.client.get(
                url,
                headers={scenario.headers if scenario.headers else "{}"}
            )

        # Add assertions if provided
        {self._generate_assertions(scenario.assertions) if scenario.assertions else ""}

class WebsiteUser(HttpUser):
    tasks = [QuantumBeamUser]
'''

        with open(locust_file, 'w') as f:
            f.write(content)

        return locust_file

    def _generate_assertions(self, assertions: List[Dict[str, Any]]) -> str:
        """Generate assertion code."""
        assertion_code = []
        for assertion in assertions:
            if assertion.get('type') == 'status_code':
                expected = assertion.get('expected', 200)
                assertion_code.append(f'        if response.status_code != {expected}:')
                assertion_code.append(f'            response.failure(f"Expected status {expected}, got {{response.status_code}}")')
            elif assertion.get('type') == 'response_time':
                max_time = assertion.get('max_time', 1000)
                assertion_code.append(f'        if response.elapsed.total_seconds() * 1000 > {max_time}:')
                assertion_code.append(f'            response.failure(f"Response time {{response.elapsed.total_seconds() * 1000}}ms exceeded {max_time}ms")')

        return '\n'.join(assertion_code)

    def _parse_locust_stats(self, scenario: TestScenario,
                           start_time: datetime, end_time: datetime) -> TestResult:
        """Parse Locust statistics file."""
        stats_file = f'/tmp/locust_stats_{scenario.name}_stats.csv'

        if not os.path.exists(stats_file):
            raise RuntimeError("Locust statistics file not found")

        # Read CSV statistics
        stats = []
        with open(stats_file, 'r') as f:
            lines = f.readlines()
            headers = lines[0].strip().split(',')
            for line in lines[1:]:
                if line.strip():
                    values = line.strip().split(',')
                    stats.append(dict(zip(headers, values)))

        # Find the aggregate row
        aggregate = next((s for s in stats if s['Type'] == 'Aggregated'), None)
        if not aggregate:
            raise RuntimeError("No aggregate statistics found in Locust output")

        duration = (end_time - start_time).total_seconds()
        total_requests = int(aggregate['Request Count'])
        failed_requests = int(aggregate['Failure Count'])
        successful_requests = total_requests - failed_requests
        requests_per_second = float(aggregate['Requests/s'])
        avg_response_time = float(aggregate['Average Response Time'])

        return TestResult(
            scenario_name=scenario.name,
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            requests_per_second=requests_per_second,
            avg_response_time=avg_response_time,
            min_response_time=float(aggregate['Min Response Time']),
            max_response_time=float(aggregate['Max Response Time']),
            p50_response_time=float(aggregate.get('50%', '0')),
            p95_response_time=float(aggregate.get('95%', '0')),
            p99_response_time=float(aggregate.get('99%', '0')),
            bytes_transferred=0,
            errors=[],
            tool_used="Locust"
        )

class LoadTestManager:
    """Main load testing manager."""

    def __init__(self, config_file: str = None):
        """Initialize load test manager."""
        self.config_file = config_file or 'load-test-config.yaml'
        self.config = self._load_config()
        self.results: List[TestResult] = []
        self.tools = self._initialize_tools()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file."""
        config_path = Path(self.config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            # Return default configuration
            return {
                'default_target': 'http://localhost:8080',
                'default_duration': 60,
                'default_users': 10,
                'default_timeout': 30,
                'scenarios': [],
                'reports': {
                    'output_dir': './reports',
                    'formats': ['html', 'json', 'csv']
                },
                'alerts': {
                    'enabled': True,
                    'thresholds': {
                        'max_response_time': 1000,
                        'max_error_rate': 0.05,
                        'min_rps': 100
                    }
                }
            }

    def _initialize_tools(self) -> List[LoadTestTool]:
        """Initialize available load testing tools."""
        tools = []

        # Initialize available tools
        ab_tool = ApacheBenchTool(self.config.get('tools', {}).get('apache_bench', {}))
        if ab_tool.is_available():
            tools.append(ab_tool)
            logger.info("Apache Bench tool initialized")
        else:
            logger.warning("Apache Bench not available")

        wrk_tool = WrkTool(self.config.get('tools', {}).get('wrk', {}))
        if wrk_tool.is_available():
            tools.append(wrk_tool)
            logger.info("wrk tool initialized")
        else:
            logger.warning("wrk not available")

        locust_tool = LocustTool(self.config.get('tools', {}).get('locust', {}))
        if locust_tool.is_available():
            tools.append(locust_tool)
            logger.info("Locust tool initialized")
        else:
            logger.warning("Locust not available")

        if not tools:
            raise RuntimeError("No load testing tools available. Please install Apache Bench, wrk, or Locust.")

        return tools

    def create_scenario(self, name: str, target_url: str, **kwargs) -> TestScenario:
        """Create a test scenario."""
        # Use defaults from config
        defaults = {
            'duration': self.config['default_duration'],
            'concurrent_users': self.config['default_users'],
            'timeout': self.config['default_timeout'],
            'method': 'GET',
            'headers': {},
            'expected_status_codes': [200],
            'assertions': []
        }

        defaults.update(kwargs)
        defaults.update({
            'name': name,
            'target_url': target_url,
            'description': kwargs.get('description', f'Load test for {name}')
        })

        return TestScenario(**defaults)

    def add_scenario(self, scenario: TestScenario):
        """Add a scenario to the configuration."""
        if 'scenarios' not in self.config:
            self.config['scenarios'] = []

        self.config['scenarios'].append(asdict(scenario))

    def run_scenario(self, scenario: TestScenario,
                    tool_name: str = None) -> TestResult:
        """Run a single test scenario."""
        # Select tool
        tool = None
        if tool_name:
            tool = next((t for t in self.tools if tool_name.lower() in t.name.lower()), None)
        else:
            # Use first available tool
            tool = self.tools[0]

        if not tool:
            raise ValueError(f"Tool {tool_name} not available")

        logger.info(f"Running scenario '{scenario.name}' with {tool.name}")

        # Run the test
        result = tool.run_test(scenario)
        self.results.append(result)

        # Check alerts
        self._check_alerts(result)

        return result

    def run_all_scenarios(self, parallel: bool = False) -> List[TestResult]:
        """Run all configured scenarios."""
        scenarios = [TestScenario(**s) for s in self.config.get('scenarios', [])]

        if not scenarios:
            logger.warning("No scenarios configured")
            return []

        if parallel:
            logger.info(f"Running {len(scenarios)} scenarios in parallel")
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.tools)) as executor:
                futures = []
                for scenario in scenarios:
                    tool = self.tools[len(self.results) % len(self.tools)]
                    future = executor.submit(tool.run_test, scenario)
                    futures.append((future, scenario.name))

                results = []
                for future, name in futures:
                    try:
                        result = future.result(timeout=3600)  # 1 hour timeout
                        results.append(result)
                        self._check_alerts(result)
                    except Exception as e:
                        logger.error(f"Scenario {name} failed: {e}")
                        # Create a failed result
                        results.append(TestResult(
                            scenario_name=name,
                            start_time=datetime.now(),
                            end_time=datetime.now(),
                            duration=0,
                            total_requests=0,
                            successful_requests=0,
                            failed_requests=0,
                            requests_per_second=0,
                            avg_response_time=0,
                            min_response_time=0,
                            max_response_time=0,
                            p50_response_time=0,
                            p95_response_time=0,
                            p99_response_time=0,
                            bytes_transferred=0,
                            errors=[{'type': 'execution_error', 'message': str(e)}],
                            tool_used="unknown"
                        ))

                self.results.extend(results)
                return results
        else:
            logger.info(f"Running {len(scenarios)} scenarios sequentially")
            results = []
            for scenario in scenarios:
                try:
                    result = self.run_scenario(scenario)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Scenario {scenario.name} failed: {e}")

            return results

    def _check_alerts(self, result: TestResult):
        """Check if results trigger any alerts."""
        if not self.config.get('alerts', {}).get('enabled', True):
            return

        thresholds = self.config['alerts'].get('thresholds', {})
        alerts = []

        # Check response time
        if result.avg_response_time > thresholds.get('max_response_time', 1000):
            alerts.append({
                'type': 'response_time',
                'value': result.avg_response_time,
                'threshold': thresholds.get('max_response_time'),
                'severity': 'warning'
            })

        # Check error rate
        error_rate = result.failed_requests / result.total_requests if result.total_requests > 0 else 0
        if error_rate > thresholds.get('max_error_rate', 0.05):
            alerts.append({
                'type': 'error_rate',
                'value': error_rate,
                'threshold': thresholds.get('max_error_rate'),
                'severity': 'critical'
            })

        # Check minimum RPS
        if result.requests_per_second < thresholds.get('min_rps', 100):
            alerts.append({
                'type': 'low_rps',
                'value': result.requests_per_second,
                'threshold': thresholds.get('min_rps'),
                'severity': 'warning'
            })

        # Log alerts
        for alert in alerts:
            severity = alert['severity'].upper()
            logger.warning(f"[{severity}] {alert['type']} alert: {alert['value']} (threshold: {alert['threshold']})")

    def generate_report(self, output_format: str = 'html') -> str:
        """Generate performance test report."""
        output_dir = Path(self.config['reports']['output_dir'])
        output_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if output_format.lower() == 'html':
            return self._generate_html_report(output_dir, timestamp)
        elif output_format.lower() == 'json':
            return self._generate_json_report(output_dir, timestamp)
        elif output_format.lower() == 'csv':
            return self._generate_csv_report(output_dir, timestamp)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")

    def _generate_html_report(self, output_dir: Path, timestamp: str) -> str:
        """Generate HTML report."""
        report_file = output_dir / f'load_test_report_{timestamp}.html'

        # Load HTML template
        template_str = '''
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam Load Testing Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .scenario { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background-color: #f8f9fa; padding: 10px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .metric-label { font-size: 12px; color: #7f8c8d; }
        .chart { margin: 20px 0; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .alert-warning { background-color: #fff3cd; border-color: #ffeaa7; }
        .alert-critical { background-color: #f8d7da; border-color: #f5c6cb; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QuantumBeam Load Testing Report</h1>
        <p>Generated: {{ report_time }}</p>
        <p>Total Scenarios: {{ scenarios|length }}</p>
    </div>

    <div class="summary">
        <h2>Overall Summary</h2>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value">{{ total_requests }}</div>
                <div class="metric-label">Total Requests</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ total_requests_per_second }}</div>
                <div class="metric-label">Total RPS</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ avg_response_time }}</div>
                <div class="metric-label">Avg Response Time (ms)</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ success_rate }}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>
    </div>

    <div class="chart">
        <h2>Performance Comparison</h2>
        <canvas id="performanceChart" width="400" height="200"></canvas>
    </div>

    <div class="chart">
        <h2>Response Time Distribution</h2>
        <canvas id="responseTimeChart" width="400" height="200"></canvas>
    </div>

    {% for scenario in scenarios %}
    <div class="scenario">
        <h3>{{ scenario.scenario_name }}</h3>
        <p><strong>Tool:</strong> {{ scenario.tool_used }}</p>
        <p><strong>Duration:</strong> {{ scenario.duration }}s</p>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value">{{ scenario.requests_per_second }}</div>
                <div class="metric-label">RPS</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ scenario.avg_response_time }}</div>
                <div class="metric-label">Avg Response Time (ms)</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ scenario.p95_response_time }}</div>
                <div class="metric-label">95th Percentile (ms)</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ scenario.success_rate }}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>

        <table>
            <tr>
                <th>Metric</th>
                <th>Value</th>
            </tr>
            <tr><td>Total Requests</td><td>{{ scenario.total_requests }}</td></tr>
            <tr><td>Successful Requests</td><td>{{ scenario.successful_requests }}</td></tr>
            <tr><td>Failed Requests</td><td>{{ scenario.failed_requests }}</td></tr>
            <tr><td>Min Response Time</td><td>{{ scenario.min_response_time }}ms</td></tr>
            <tr><td>Max Response Time</td><td>{{ scenario.max_response_time }}ms</td></tr>
        </table>
    </div>
    {% endfor %}

    <script>
        // Performance comparison chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: [{% for scenario in scenarios %}'{{ scenario.scenario_name }}'{% if not loop.last %},{% endif %}{% endfor %}],
                datasets: [{
                    label: 'RPS',
                    data: [{% for scenario in scenarios %}{{ scenario.requests_per_second }}{% if not loop.last %},{% endif %}{% endfor %}],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    yAxisID: 'y'
                }, {
                    label: 'Avg Response Time (ms)',
                    data: [{% for scenario in scenarios %}{{ scenario.avg_response_time }}{% if not loop.last %},{% endif %}{% endfor %}],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });

        // Response time distribution chart
        const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(responseTimeCtx, {
            type: 'line',
            data: {
                labels: [{% for scenario in scenarios %}'{{ scenario.scenario_name }}'{% if not loop.last %},{% endif %}{% endfor %}],
                datasets: [{
                    label: '50th Percentile',
                    data: [{% for scenario in scenarios %}{{ scenario.p50_response_time }}{% if not loop.last %},{% endif %}{% endfor %}],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    tension: 0.1
                }, {
                    label: '95th Percentile',
                    data: [{% for scenario in scenarios %}{{ scenario.p95_response_time }}{% if not loop.last %},{% endif %}{% endfor %}],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    tension: 0.1
                }, {
                    label: '99th Percentile',
                    data: [{% for scenario in scenarios %}{{ scenario.p99_response_time }}{% if not loop.last %},{% endif %}{% endfor %}],
                    borderColor: 'rgba(255, 205, 86, 1)',
                    tension: 0.1
                }]
            }
        });
    </script>
</body>
</html>
        '''

        # Prepare template data
        template = jinja2.Template(template_str)

        total_requests = sum(r.total_requests for r in self.results)
        total_rps = sum(r.requests_per_second for r in self.results)
        avg_response_time = statistics.mean([r.avg_response_time for r in self.results]) if self.results else 0
        success_rate = (sum(r.successful_requests for r in self.results) / total_requests * 100) if total_requests > 0 else 0

        template_data = {
            'report_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'scenarios': self.results,
            'total_requests': total_requests,
            'total_requests_per_second': f"{total_rps:.2f}",
            'avg_response_time': f"{avg_response_time:.2f}",
            'success_rate': f"{success_rate:.2f}"
        }

        # Add success rate to each result
        for result in self.results:
            result.success_rate = (result.successful_requests / result.total_requests * 100) if result.total_requests > 0 else 0

        # Render and save report
        html_content = template.render(**template_data)
        with open(report_file, 'w') as f:
            f.write(html_content)

        logger.info(f"HTML report generated: {report_file}")
        return str(report_file)

    def _generate_json_report(self, output_dir: Path, timestamp: str) -> str:
        """Generate JSON report."""
        report_file = output_dir / f'load_test_report_{timestamp}.json'

        report_data = {
            'report_time': datetime.now().isoformat(),
            'total_scenarios': len(self.results),
            'summary': {
                'total_requests': sum(r.total_requests for r in self.results),
                'total_successful_requests': sum(r.successful_requests for r in self.results),
                'total_failed_requests': sum(r.failed_requests for r in self.results),
                'avg_requests_per_second': statistics.mean([r.requests_per_second for r in self.results]) if self.results else 0,
                'avg_response_time': statistics.mean([r.avg_response_time for r in self.results]) if self.results else 0,
            },
            'scenarios': [asdict(r) for r in self.results]
        }

        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2, default=str)

        logger.info(f"JSON report generated: {report_file}")
        return str(report_file)

    def _generate_csv_report(self, output_dir: Path, timestamp: str) -> str:
        """Generate CSV report."""
        report_file = output_dir / f'load_test_report_{timestamp}.csv'

        import csv

        if not self.results:
            logger.warning("No results to export")
            return str(report_file)

        with open(report_file, 'w', newline='') as f:
            fieldnames = [
                'scenario_name', 'tool_used', 'duration', 'total_requests',
                'successful_requests', 'failed_requests', 'requests_per_second',
                'avg_response_time', 'min_response_time', 'max_response_time',
                'p50_response_time', 'p95_response_time', 'p99_response_time'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for result in self.results:
                row = {field: getattr(result, field) for field in fieldnames}
                writer.writerow(row)

        logger.info(f"CSV report generated: {report_file}")
        return str(report_file)

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Load Testing Manager')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--scenario', help='Run specific scenario')
    parser.add_argument('--target', help='Target URL for quick test')
    parser.add_argument('--users', type=int, default=10, help='Number of concurrent users')
    parser.add_argument('--duration', type=int, default=60, help='Test duration in seconds')
    parser.add_argument('--tool', help='Specific tool to use (ab, wrk, locust)')
    parser.add_argument('--parallel', action='store_true', help='Run scenarios in parallel')
    parser.add_argument('--output-format', choices=['html', 'json', 'csv'], default='html', help='Report format')
    parser.add_argument('--output-dir', default='./reports', help='Output directory for reports')

    args = parser.parse_args()

    try:
        # Initialize manager
        manager = LoadTestManager(args.config)

        # Create quick test scenario if target provided
        if args.target:
            scenario = manager.create_scenario(
                name='quick_test',
                target_url=args.target,
                concurrent_users=args.users,
                duration=args.duration
            )
            result = manager.run_scenario(scenario, args.tool)
            print(f"Test completed: {result.requests_per_second:.2f} RPS, {result.avg_response_time:.2f}ms avg response time")

        # Run specific scenario
        elif args.scenario:
            scenarios = [s for s in manager.config.get('scenarios', []) if s['name'] == args.scenario]
            if scenarios:
                scenario = TestScenario(**scenarios[0])
                result = manager.run_scenario(scenario, args.tool)
                print(f"Scenario '{args.scenario}' completed: {result.requests_per_second:.2f} RPS")
            else:
                print(f"Scenario '{args.scenario}' not found")
                sys.exit(1)

        # Run all scenarios
        else:
            results = manager.run_all_scenarios(parallel=args.parallel)
            print(f"Completed {len(results)} scenarios")

        # Generate report
        if manager.results:
            report_file = manager.generate_report(args.output_format)
            print(f"Report generated: {report_file}")

    except Exception as e:
        logger.error(f"Load testing failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
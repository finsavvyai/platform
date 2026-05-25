"""
Network Simulation Service

Provides network simulation capabilities including bandwidth throttling,
latency simulation, offline testing, and network condition testing.
"""

import asyncio
import logging
import time
import random
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

import psutil
import aiohttp
from playwright.async_api import Page, BrowserContext

logger = logging.getLogger(__name__)


class NetworkCondition(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    SLOW_3G = "slow_3g"
    FAST_3G = "fast_3g"
    SLOW_2G = "slow_2g"
    DIALUP = "dialup"
    WIFI = "wifi"
    HIGH_LATENCY = "high_latency"
    UNSTABLE = "unstable"
    CUSTOM = "custom"


class ThrottleType(str, Enum):
    DOWNLOAD = "download"
    UPLOAD = "upload"
    BOTH = "both"
    LATENCY = "latency"
    PACKET_LOSS = "packet_loss"


@dataclass
class NetworkProfile:
    """Network condition profile"""
    name: str
    download_throughput: int  # bytes per second
    upload_throughput: int    # bytes per second
    latency: int              # milliseconds
    packet_loss: float        # percentage 0-100
    jitter: int              # milliseconds
    description: str = ""
    tags: List[str] = field(default_factory=list)


@dataclass
class NetworkTestConfig:
    """Configuration for network testing"""
    test_duration_seconds: int = 60
    sample_interval_ms: int = 1000
    test_urls: List[str] = field(default_factory=lambda: [
        "https://httpbin.org/json",
        "https://jsonplaceholder.typicode.com/posts/1",
        "https://api.github.com/users/octocat"
    ])
    concurrent_requests: int = 5
    enable_packet_capture: bool = False
    metrics_to_collect: List[str] = field(default_factory=lambda: [
        "response_time", "throughput", "packet_loss", "connection_time"
    ])


@dataclass
class NetworkMetrics:
    """Network performance metrics"""
    timestamp: datetime
    download_throughput: float  # Mbps
    upload_throughput: float    # Mbps
    latency: float              # milliseconds
    packet_loss: float          # percentage
    jitter: float               # milliseconds
    connection_time: float      # milliseconds
    dns_resolution_time: float  # milliseconds
    error_rate: float           # percentage
    active_connections: int
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NetworkTestResult:
    """Result of network performance test"""
    test_id: str
    profile_name: str
    start_time: datetime
    end_time: datetime
    total_duration_ms: int
    metrics: List[NetworkMetrics]
    summary: Dict[str, Any]
    errors: List[str] = field(default_factory=list)
    success: bool = True


class NetworkSimulationService:
    """Service for network simulation and testing"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.active_simulations = {}
        self.predefined_profiles = self._create_predefined_profiles()
        self.network_stats = {}

    def _create_predefined_profiles(self) -> Dict[str, NetworkProfile]:
        """Create predefined network condition profiles"""
        return {
            # Online profiles
            NetworkCondition.ONLINE.value: NetworkProfile(
                name="Online",
                download_throughput=50 * 1024 * 1024,  # 50 Mbps
                upload_throughput=20 * 1024 * 1024,    # 20 Mbps
                latency=10,
                packet_loss=0.0,
                jitter=2,
                description="Standard broadband connection",
                tags=["fast", "stable"]
            ),

            NetworkCondition.WIFI.value: NetworkProfile(
                name="WiFi",
                download_throughput=25 * 1024 * 1024,  # 25 Mbps
                upload_throughput=10 * 1024 * 1024,    # 10 Mbps
                latency=20,
                packet_loss=0.1,
                jitter=5,
                description="Standard WiFi connection",
                tags=["wireless", "moderate"]
            ),

            # Mobile profiles
            NetworkCondition.FAST_3G.value: NetworkProfile(
                name="Fast 3G",
                download_throughput=1.5 * 1024 * 1024,  # 1.5 Mbps
                upload_throughput=750 * 1024,          # 750 kbps
                latency=300,
                packet_loss=0.5,
                jitter=20,
                description="Fast 3G mobile connection",
                tags=["mobile", "3g", "slow"]
            ),

            NetworkCondition.SLOW_3G.value: NetworkProfile(
                name="Slow 3G",
                download_throughput=500 * 1024,    # 500 kbps
                upload_throughput=300 * 1024,     # 300 kbps
                latency=800,
                packet_loss=1.5,
                jitter=50,
                description="Slow 3G mobile connection",
                tags=["mobile", "3g", "very_slow"]
            ),

            NetworkCondition.SLOW_2G.value: NetworkProfile(
                name="Slow 2G",
                download_throughput=250 * 1024,    # 250 kbps
                upload_throughput=50 * 1024,      # 50 kbps
                latency=2000,
                packet_loss=3.0,
                jitter=100,
                description="Slow 2G mobile connection",
                tags=["mobile", "2g", "extremely_slow"]
            ),

            NetworkCondition.DIALUP.value: NetworkProfile(
                name="Dialup",
                download_throughput=56 * 1024,     # 56 kbps
                upload_throughput=33 * 1024,      # 33 kbps
                latency=3000,
                packet_loss=5.0,
                jitter=200,
                description="Dialup connection",
                tags=["legacy", "extremely_slow"]
            ),

            # Special conditions
            NetworkCondition.HIGH_LATENCY.value: NetworkProfile(
                name="High Latency",
                download_throughput=10 * 1024 * 1024,  # 10 Mbps
                upload_throughput=5 * 1024 * 1024,     # 5 Mbps
                latency=2000,
                packet_loss=0.2,
                jitter=100,
                description="High latency connection",
                tags=["satellite", "high_latency"]
            ),

            NetworkCondition.UNSTABLE.value: NetworkProfile(
                name="Unstable",
                download_throughput=5 * 1024 * 1024,   # 5 Mbps
                upload_throughput=2 * 1024 * 1024,     # 2 Mbps
                latency=500,
                packet_loss=5.0,
                jitter=300,
                description="Unstable connection with high jitter",
                tags=["unstable", "wireless"]
            ),

            NetworkCondition.OFFLINE.value: NetworkProfile(
                name="Offline",
                download_throughput=0,
                upload_throughput=0,
                latency=0,
                packet_loss=100.0,
                jitter=0,
                description="No network connection",
                tags=["offline", "no_connection"]
            )
        }

    async def apply_network_conditions(
        self,
        context: BrowserContext,
        condition: Union[NetworkCondition, NetworkProfile, str],
        test_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Apply network conditions to browser context"""
        try:
            if isinstance(condition, str):
                if condition in self.predefined_profiles:
                    profile = self.predefined_profiles[condition]
                else:
                    raise ValueError(f"Unknown network condition: {condition}")
            else:
                profile = condition

            test_id = test_id or f"network_test_{int(time.time())}"

            # Create CDP (Chrome DevTools Protocol) conditions
            conditions = {
                "offline": profile.download_throughput == 0,
                "downloadThroughput": profile.download_throughput,
                "uploadThroughput": profile.upload_throughput,
                "latency": profile.latency
            }

            # Apply network conditions
            await context.route("**", lambda route: self._apply_throttling(route, profile))

            # Store simulation info
            self.active_simulations[test_id] = {
                "profile": profile,
                "start_time": datetime.now(),
                "context_id": id(context)
            }

            self.logger.info(f"Applied network conditions '{profile.name}' to context {test_id}")

            return {
                "success": True,
                "test_id": test_id,
                "profile_name": profile.name,
                "conditions": conditions,
                "applied_at": datetime.now().isoformat()
            }

        except Exception as e:
            self.logger.error(f"Error applying network conditions: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def _apply_throttling(self, route, profile: NetworkProfile):
        """Apply throttling to network requests"""
        try:
            # Simulate packet loss
            if profile.packet_loss > 0 and random.random() < (profile.packet_loss / 100):
                route.abort()
                return

            # Simulate latency
            if profile.latency > 0:
                # Add jitter
                actual_latency = profile.latency + random.uniform(-profile.jitter, profile.jitter)
                actual_latency = max(0, actual_latency)  # Ensure non-negative

                # Schedule request with delay
                asyncio.create_task(self._delayed_request(route, actual_latency / 1000))
            else:
                route.continue_()

        except Exception as e:
            self.logger.error(f"Error applying throttling: {e}")
            route.continue_()

    async def _delayed_request(self, route, delay: float):
        """Execute request with delay"""
        try:
            await asyncio.sleep(delay)
            await route.continue_()
        except Exception as e:
            self.logger.error(f"Error in delayed request: {e}")

    async def remove_network_conditions(self, context: BrowserContext, test_id: str) -> Dict[str, Any]:
        """Remove network conditions from browser context"""
        try:
            # Remove all routes
            await context.unroute("**")

            # Remove from active simulations
            if test_id in self.active_simulations:
                simulation = self.active_simulations.pop(test_id)
                duration = datetime.now() - simulation["start_time"]

                self.logger.info(f"Removed network conditions from context {test_id} after {duration}")

                return {
                    "success": True,
                    "test_id": test_id,
                    "duration_seconds": duration.total_seconds(),
                    "profile_name": simulation["profile"].name
                }
            else:
                return {
                    "success": False,
                    "error": f"Network simulation {test_id} not found"
                }

        except Exception as e:
            self.logger.error(f"Error removing network conditions: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def test_network_performance(
        self,
        context: BrowserContext,
        profile: Union[NetworkCondition, NetworkProfile],
        config: NetworkTestConfig,
        test_id: Optional[str] = None
    ) -> NetworkTestResult:
        """Test network performance under specific conditions"""
        test_id = test_id or f"perf_test_{int(time.time())}"
        start_time = datetime.now()
        metrics = []
        errors = []

        try:
            # Apply network conditions
            apply_result = await self.apply_network_conditions(context, profile, test_id)
            if not apply_result["success"]:
                raise Exception(f"Failed to apply network conditions: {apply_result['error']}")

            self.logger.info(f"Starting network performance test {test_id} with profile {profile}")

            # Run test for specified duration
            end_time = start_time + timedelta(seconds=config.test_duration_seconds)

            while datetime.now() < end_time:
                try:
                    # Collect metrics
                    metric = await self._collect_network_metrics(context, config)
                    metrics.append(metric)

                    # Wait for next sample
                    await asyncio.sleep(config.sample_interval_ms / 1000)

                except Exception as e:
                    errors.append(f"Error collecting metrics: {e}")
                    self.logger.warning(f"Error collecting metrics: {e}")

            # Remove network conditions
            await self.remove_network_conditions(context, test_id)

            # Calculate summary
            summary = self._calculate_summary_metrics(metrics)

            end_time = datetime.now()
            total_duration = int((end_time - start_time).total_seconds() * 1000)

            result = NetworkTestResult(
                test_id=test_id,
                profile_name=profile.name if isinstance(profile, NetworkProfile) else profile,
                start_time=start_time,
                end_time=end_time,
                total_duration_ms=total_duration,
                metrics=metrics,
                summary=summary,
                errors=errors,
                success=len(errors) == 0
            )

            self.logger.info(f"Network performance test {test_id} completed successfully")
            return result

        except Exception as e:
            self.logger.error(f"Error in network performance test {test_id}: {e}")

            # Clean up
            try:
                await self.remove_network_conditions(context, test_id)
            except:
                pass

            end_time = datetime.now()
            total_duration = int((end_time - start_time).total_seconds() * 1000)

            return NetworkTestResult(
                test_id=test_id,
                profile_name=profile.name if isinstance(profile, NetworkProfile) else profile,
                start_time=start_time,
                end_time=end_time,
                total_duration_ms=total_duration,
                metrics=metrics,
                summary={},
                errors=errors + [str(e)],
                success=False
            )

    async def _collect_network_metrics(self, context: BrowserContext, config: NetworkTestConfig) -> NetworkMetrics:
        """Collect current network metrics"""
        try:
            start_time = time.time()

            # Test network performance
            test_url = random.choice(config.test_urls)
            metrics = {}

            if "response_time" in config.metrics_to_collect:
                metrics["response_time"] = await self._measure_response_time(test_url)

            if "throughput" in config.metrics_to_collect:
                metrics["download_throughput"], metrics["upload_throughput"] = await self._measure_throughput(test_url)

            if "packet_loss" in config.metrics_to_collect:
                metrics["packet_loss"] = await self._measure_packet_loss(test_url)

            if "connection_time" in config.metrics_to_collect:
                metrics["connection_time"] = await self._measure_connection_time(test_url)

            # Get system network stats
            net_io = psutil.net_io_counters()
            active_connections = len(psutil.net_connections())

            return NetworkMetrics(
                timestamp=datetime.now(),
                download_throughput=metrics.get("download_throughput", 0.0),
                upload_throughput=metrics.get("upload_throughput", 0.0),
                latency=metrics.get("response_time", 0.0),
                packet_loss=metrics.get("packet_loss", 0.0),
                jitter=0.0,  # Would need multiple measurements to calculate
                connection_time=metrics.get("connection_time", 0.0),
                dns_resolution_time=0.0,  # Would need DNS-specific test
                error_rate=0.0,
                active_connections=active_connections,
                metadata=metrics
            )

        except Exception as e:
            self.logger.error(f"Error collecting network metrics: {e}")
            return NetworkMetrics(
                timestamp=datetime.now(),
                download_throughput=0.0,
                upload_throughput=0.0,
                latency=0.0,
                packet_loss=0.0,
                jitter=0.0,
                connection_time=0.0,
                dns_resolution_time=0.0,
                error_rate=100.0,
                active_connections=0,
                metadata={"error": str(e)}
            )

    async def _measure_response_time(self, url: str) -> float:
        """Measure response time for a URL"""
        try:
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    await response.read()
            return (time.time() - start_time) * 1000  # Convert to milliseconds
        except:
            return float('inf')  # Timeout or error

    async def _measure_throughput(self, url: str) -> tuple[float, float]:
        """Measure download and upload throughput in Mbps"""
        try:
            # Download test
            start_time = time.time()
            download_size = 0

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    async for data in response.content.iter_chunked(8192):
                        download_size += len(data)

            download_time = time.time() - start_time
            download_throughput = (download_size * 8) / (download_time * 1024 * 1024)  # Mbps

            # Upload test (small data to avoid excessive upload)
            upload_data = b"x" * 1024 * 100  # 100KB
            start_time = time.time()

            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=upload_data, timeout=10) as response:
                    await response.read()

            upload_time = time.time() - start_time
            upload_throughput = (len(upload_data) * 8) / (upload_time * 1024 * 1024)  # Mbps

            return download_throughput, upload_throughput

        except:
            return 0.0, 0.0

    async def _measure_packet_loss(self, url: str) -> float:
        """Measure packet loss percentage"""
        try:
            # Make multiple requests and count failures
            total_requests = 10
            failed_requests = 0

            for _ in range(total_requests):
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url, timeout=5) as response:
                            await response.read()
                except:
                    failed_requests += 1

            return (failed_requests / total_requests) * 100

        except:
            return 100.0

    async def _measure_connection_time(self, url: str) -> float:
        """Measure connection establishment time"""
        try:
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    pass  # Just establish connection
            return (time.time() - start_time) * 1000  # Convert to milliseconds
        except:
            return float('inf')

    def _calculate_summary_metrics(self, metrics: List[NetworkMetrics]) -> Dict[str, Any]:
        """Calculate summary statistics from collected metrics"""
        if not metrics:
            return {}

        try:
            summary = {
                "sample_count": len(metrics),
                "duration_minutes": (metrics[-1].timestamp - metrics[0].timestamp).total_seconds() / 60,
            }

            # Calculate averages
            summary["avg_download_throughput"] = sum(m.download_throughput for m in metrics) / len(metrics)
            summary["avg_upload_throughput"] = sum(m.upload_throughput for m in metrics) / len(metrics)
            summary["avg_latency"] = sum(m.latency for m in metrics if m.latency != float('inf')) / len([m for m in metrics if m.latency != float('inf')]) or 0
            summary["avg_packet_loss"] = sum(m.packet_loss for m in metrics) / len(metrics)
            summary["avg_connection_time"] = sum(m.connection_time for m in metrics if m.connection_time != float('inf')) / len([m for m in metrics if m.connection_time != float('inf')]) or 0

            # Calculate min/max
            summary["min_download_throughput"] = min(m.download_throughput for m in metrics)
            summary["max_download_throughput"] = max(m.download_throughput for m in metrics)
            summary["min_upload_throughput"] = min(m.upload_throughput for m in metrics)
            summary["max_upload_throughput"] = max(m.upload_throughput for m in metrics)
            summary["min_latency"] = min(m.latency for m in metrics if m.latency != float('inf')) or 0
            summary["max_latency"] = max(m.latency for m in metrics if m.latency != float('inf')) or 0

            # Calculate percentiles (if we have enough data)
            if len(metrics) >= 10:
                sorted_latency = sorted([m.latency for m in metrics if m.latency != float('inf')])
                if sorted_latency:
                    summary["p50_latency"] = sorted_latency[len(sorted_latency) // 2]
                    summary["p95_latency"] = sorted_latency[int(len(sorted_latency) * 0.95)]
                    summary["p99_latency"] = sorted_latency[int(len(sorted_latency) * 0.99)]

            return summary

        except Exception as e:
            self.logger.error(f"Error calculating summary metrics: {e}")
            return {"error": str(e)}

    def get_available_profiles(self) -> Dict[str, NetworkProfile]:
        """Get all available network profiles"""
        return self.predefined_profiles.copy()

    def create_custom_profile(
        self,
        name: str,
        download_mbps: float,
        upload_mbps: float,
        latency_ms: int,
        packet_loss_percent: float = 0.0,
        jitter_ms: int = 0,
        description: str = ""
    ) -> NetworkProfile:
        """Create a custom network profile"""
        profile = NetworkProfile(
            name=name,
            download_throughput=int(download_mbps * 1024 * 1024),
            upload_throughput=int(upload_mbps * 1024 * 1024),
            latency=latency_ms,
            packet_loss=packet_loss_percent,
            jitter=jitter_ms,
            description=description,
            tags=["custom"]
        )

        self.predefined_profiles[name] = profile
        return profile

    async def simulate_connection_drops(self, context: BrowserContext, drop_interval_ms: int, drop_duration_ms: int, test_duration_seconds: int) -> Dict[str, Any]:
        """Simulate periodic connection drops"""
        test_id = f"connection_drops_{int(time.time())}"
        start_time = datetime.now()
        end_time = start_time + timedelta(seconds=test_duration_seconds)

        self.logger.info(f"Starting connection drop simulation for test {test_id}")

        try:
            while datetime.now() < end_time:
                # Normal connectivity
                await asyncio.sleep(drop_interval_ms / 1000)

                # Simulate connection drop
                await context.route("**", lambda route: route.abort())
                await asyncio.sleep(drop_duration_ms / 1000)

                # Restore connectivity
                await context.unroute("**")

            duration = datetime.now() - start_time
            self.logger.info(f"Connection drop simulation {test_id} completed after {duration}")

            return {
                "success": True,
                "test_id": test_id,
                "duration_seconds": duration.total_seconds(),
                "drop_interval_ms": drop_interval_ms,
                "drop_duration_ms": drop_duration_ms
            }

        except Exception as e:
            self.logger.error(f"Error in connection drop simulation: {e}")
            return {
                "success": False,
                "test_id": test_id,
                "error": str(e)
            }
        finally:
            # Clean up
            try:
                await context.unroute("**")
            except:
                pass

    def get_active_simulations(self) -> Dict[str, Any]:
        """Get information about active network simulations"""
        active = {}
        for test_id, sim in self.active_simulations.items():
            duration = datetime.now() - sim["start_time"]
            active[test_id] = {
                "profile_name": sim["profile"].name,
                "duration_seconds": duration.total_seconds(),
                "start_time": sim["start_time"].isoformat()
            }
        return active
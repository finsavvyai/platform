#!/usr/bin/env python3
"""
FinSavvyAI Network Scanner and Manager
Automatically discovers and manages worker nodes on the network
"""

import asyncio
import ipaddress
import json
import os
import socket
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List

import aiohttp


@dataclass
class DiscoveredWorker:
    """Represents a discovered worker"""

    ip: str
    port: int
    hostname: str
    status: str
    last_seen: datetime
    info: dict = None


class NetworkScanner:
    """Scans network for workers and manages connections"""

    def __init__(self, master_host="localhost", master_port=8000):
        self.master_host = master_host
        self.master_port = master_port
        self.discovered_workers: Dict[str, DiscoveredWorker] = {}
        self.session = None

    async def scan_network(self, network_range: str = "192.168.1.0/24"):
        """Scan network for potential workers"""
        print(f"🔍 Scanning network: {network_range}")

        # Get local network range if not specified
        if network_range == "auto":
            network_range = await self._get_local_network()

        workers = []
        network = ipaddress.ip_network(network_range, strict=False)

        print(f"🌐 Scanning {network.num_addresses} addresses...")

        # Check common ports for workers
        worker_ports = [8001, 8002, 8003, 8004, 8005]

        tasks = []
        for ip in network.hosts():
            ip_str = str(ip)
            for port in worker_ports:
                task = self._check_worker(ip_str, port)
                tasks.append(task)

        # Run scans concurrently with timeout
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter successful discoveries
        for result in results:
            if isinstance(result, DiscoveredWorker):
                workers.append(result)
                print(f"✅ Found worker: {result.hostname} ({result.ip}:{result.port})")

        return workers

    async def _get_local_network(self) -> str:
        """Detect local network range"""
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)

            # Get netmask
            import platform

            if platform.system() == "Windows":
                result = subprocess.run(["ipconfig"], capture_output=True, text=True)
                # Parse Windows ipconfig output
            else:
                result = subprocess.run(["ifconfig"], capture_output=True, text=True)
                # Parse Unix ifconfig output

            # Default to common home network
            return "192.168.1.0/24"

        except:
            return "192.168.1.0/24"

    async def _check_worker(
        self, ip: str, port: int, timeout: float = 2.0
    ) -> DiscoveredWorker:
        """Check if there's a worker at this IP:port"""
        try:
            future = asyncio.open_connection(ip, port)
            reader, writer = await asyncio.wait_for(future, timeout=timeout)
            writer.close()
            await writer.wait_closed()

            # Test HTTP endpoint
            async with aiohttp.ClientSession() as session:
                url = f"http://{ip}:{port}/health"
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=1)
                ) as response:
                    if response.status == 200:
                        info = await response.json()
                        return DiscoveredWorker(
                            ip=ip,
                            port=port,
                            hostname=info.get("node_name", f"worker-{ip}"),
                            status="online",
                            last_seen=datetime.now(),
                            info=info,
                        )
                    else:
                        return None

        except:
            return None

    async def register_discovered_workers(self, workers: List[DiscoveredWorker]):
        """Register discovered workers with the master"""
        if not workers:
            print("❌ No workers found")
            return

        print(f"📝 Registering {len(workers)} workers with master...")

        async with aiohttp.ClientSession() as session:
            for worker in workers:
                try:
                    # This would be done by the workers themselves when they connect
                    # For now, just store the information
                    self.discovered_workers[f"{worker.ip}:{worker.port}"] = worker
                    print(f"✅ {worker.hostname} - {worker.ip}:{worker.port}")

                except Exception as e:
                    print(f"❌ Failed to register {worker.hostname}: {e}")

    async def monitor_workers(self):
        """Continuously monitor worker status"""
        print("📊 Starting worker monitoring...")

        while True:
            try:
                # Check all known workers
                offline_workers = []
                for worker_key, worker in self.discovered_workers.items():
                    try:
                        async with aiohttp.ClientSession() as session:
                            url = f"http://{worker.ip}:{worker.port}/health"
                            async with session.get(
                                url, timeout=aiohttp.ClientTimeout(total=2)
                            ) as response:
                                if response.status == 200:
                                    info = await response.json()
                                    worker.status = info.get("status", "unknown")
                                    worker.last_seen = datetime.now()
                                    worker.info = info
                                else:
                                    offline_workers.append(worker_key)
                    except:
                        offline_workers.append(worker_key)

                # Remove offline workers
                for worker_key in offline_workers:
                    worker = self.discovered_workers[worker_key]
                    print(f"⚠️ Worker offline: {worker.hostname}")
                    del self.discovered_workers[worker_key]

                # Print status
                if self.discovered_workers:
                    print(f"📊 {len(self.discovered_workers)} workers online")
                    for worker_key, worker in self.discovered_workers.items():
                        uptime = worker.info.get("uptime", 0) if worker.info else 0
                        requests = (
                            worker.info.get("request_count", 0) if worker.info else 0
                        )
                        print(
                            f"   🤖 {worker.hostname}: {requests} requests, {uptime:.0f}s uptime"
                        )
                else:
                    print("⚠️ No workers online")

                await asyncio.sleep(30)

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"❌ Monitor error: {e}")
                await asyncio.sleep(5)

    async def auto_discover_and_connect(self):
        """Full discovery and connection process"""
        print("🔍 Starting automatic worker discovery...")

        # Scan network
        workers = await self.scan_network()

        # Register with master
        await self.register_discovered_workers(workers)

        # Start monitoring
        await self.monitor_workers()


class WorkerManager:
    """Manages adding/removing workers"""

    def __init__(self, master_host="localhost", master_port=8000):
        self.master_host = master_host
        self.master_port = master_port

    async def add_worker(self, worker_info: dict):
        """Manually add a worker"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://{worker_info['ip']}:{worker_info['port']}/health"
                async with session.get(url) as response:
                    if response.status == 200:
                        info = await response.json()
                        print(f"✅ Worker found: {info['node_name']}")
                        return True
                    else:
                        print(f"❌ Worker not responding: {response.status}")
                        return False
        except Exception as e:
            print(f"❌ Error connecting to worker: {e}")
            return False

    async def get_cluster_status(self):
        """Get overall cluster status"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://{self.master_host}:{self.master_port}/cluster/status"
                async with session.get(url) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        return None
        except Exception as e:
            print(f"❌ Error getting cluster status: {e}")
            return None


async def main():
    """Main scanner function"""
    import argparse

    parser = argparse.ArgumentParser(description="FinSavvyAI Network Scanner")
    parser.add_argument("--scan", action="store_true", help="Scan network for workers")
    parser.add_argument(
        "--monitor", action="store_true", help="Monitor workers continuously"
    )
    parser.add_argument(
        "--master",
        default=os.environ.get("FINSAVVYAI_MASTER_HOST", "localhost"),
        help="Master host address",
    )
    parser.add_argument(
        "--network", default="192.168.1.0/24", help="Network range to scan"
    )

    args = parser.parse_args()

    scanner = NetworkScanner(args.master)

    if args.scan or args.monitor:
        await scanner.auto_discover_and_connect()
    else:
        # Show cluster status
        manager = WorkerManager(args.master)
        status = await manager.get_cluster_status()
        if status:
            print(json.dumps(status, indent=2))
        else:
            print("❌ Could not get cluster status")


if __name__ == "__main__":
    asyncio.run(main())

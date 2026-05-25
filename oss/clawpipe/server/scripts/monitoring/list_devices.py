#!/usr/bin/env python3
"""
FinSavvyAI Device Listing Utility
Complete device and system information for your cluster
"""

import asyncio
import json
import os
import platform
import socket
import subprocess
from datetime import datetime

import aiohttp
import psutil


async def list_devices():
    """Comprehensive device listing"""

    print("🖥️  FINSAVVYAI DEVICE INVENTORY")
    print("=" * 50)
    print()

    # Local device information
    print("📱 LOCAL DEVICE")
    print("-" * 20)
    print(f"Hostname: {socket.gethostname()}")
    print(f"IP Address: {get_local_ip()}")
    print(f"Platform: {platform.system()} {platform.release()}")
    print(f"Architecture: {platform.machine()}")
    print(f"Python Version: {platform.python_version()}")

    # CPU and Memory info
    print(f"\n💻 SYSTEM RESOURCES")
    print("-" * 25)
    print(f"CPU Cores: {psutil.cpu_count()}")
    print(f"CPU Usage: {psutil.cpu_percent()}%")
    memory = psutil.virtual_memory()
    print(f"Memory: {memory.total // (1024**3)}GB total, {memory.percent}% used")

    disk = psutil.disk_usage("/")
    print(
        f"Disk: {disk.total // (1024**3)}GB total, {(disk.used / disk.total) * 100:.1f}% used"
    )

    print()

    # Cluster devices
    await show_cluster_devices()

    # Network scan
    await scan_network_devices()


def get_local_ip():
    """Get local IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except:
        return "127.0.0.1"
    finally:
        s.close()


async def show_cluster_devices():
    """Show FinSavvyAI cluster devices"""
    print("🌐 FINSAVVYAI CLUSTER DEVICES")
    print("-" * 35)

    try:
        async with aiohttp.ClientSession() as session:
            master_host = os.environ.get("FINSAVVYAI_MASTER_HOST", "localhost")
            master_port = os.environ.get("FINSAVVYAI_MASTER_PORT", "8000")
            async with session.get(
                f"http://{master_host}:{master_port}/cluster/nodes"
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    nodes = data.get("nodes", [])

                    if nodes:
                        print(f"Total nodes in cluster: {len(nodes)}")
                        print()

                        for i, node in enumerate(nodes, 1):
                            print(f"📟 NODE {i}: {node.get('name', 'Unknown')}")
                            print(f"   ID: {node.get('id', 'N/A')}")
                            print(
                                f"   Host: {node.get('host', 'N/A')}:{node.get('port', 'N/A')}"
                            )
                            print(f"   Status: {node.get('status', 'Unknown')}")
                            print(
                                f"   Load: {node.get('load', 0)}/{node.get('max_load', 100)}"
                            )
                            print(f"   Models: {', '.join(node.get('models', []))}")
                            print(
                                f"   Last Heartbeat: {node.get('last_heartbeat', 'Never')}"
                            )

                            # Show capabilities if available
                            caps = node.get("capabilities", {})
                            if caps:
                                sys_info = caps.get("system", {})
                                if sys_info:
                                    print(
                                        f"   System: {sys_info.get('platform', 'Unknown')} ({sys_info.get('cpu_count', 0)} cores)"
                                    )
                                    memory_gb = sys_info.get("memory_total", 0) // (
                                        1024**3
                                    )
                                    print(f"   Memory: {memory_gb}GB total")

                            print()
                    else:
                        print("❌ No nodes found in cluster")
                        print(
                            "💡 Tip: Start services with: finsavvyai start service all"
                        )
                else:
                    print("❌ Cannot connect to cluster master")
                    print("💡 Tip: Make sure master service is running")

    except Exception as e:
        print(f"❌ Error connecting to cluster: {e}")
        print("💡 Tip: Start the cluster with: finsavvyai start service all")

    print()


async def scan_network_devices():
    """Scan for devices on the local network"""
    print("🔍 NETWORK SCAN")
    print("-" * 20)

    try:
        local_ip = get_local_ip()
        network = ".".join(local_ip.split(".")[:-1]) + ".0/24"

        print(f"Scanning network: {network}")
        print("Looking for FinSavvyAI workers...")

        found_devices = []

        # Common FinSavvyAI ports to check
        ports = [8001, 8002, 8003, 8004, 8005]

        for i in range(1, 255):  # Scan .1 to .254
            host = f"10.0.0.{i}"

            for port in ports:
                try:
                    # Quick port check
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(0.1)
                    result = sock.connect_ex((host, port))
                    sock.close()

                    if result == 0:
                        # Found open port, try to identify
                        try:
                            async with aiohttp.ClientSession(
                                timeout=aiohttp.ClientTimeout(total=2)
                            ) as session:
                                async with session.get(
                                    f"http://{host}:{port}/health"
                                ) as resp:
                                    if resp.status == 200:
                                        data = await resp.json()
                                        if (
                                            "node_id" in data
                                            or "worker" in str(data).lower()
                                        ):
                                            found_devices.append(
                                                {
                                                    "host": host,
                                                    "port": port,
                                                    "name": data.get(
                                                        "node_name", f"Worker-{host}"
                                                    ),
                                                    "status": "FinSavvyAI Worker",
                                                }
                                            )
                        except:
                            # Port is open but not a FinSavvyAI worker
                            pass

                except:
                    continue

        if found_devices:
            print(f"✅ Found {len(found_devices)} FinSavvyAI device(s):")
            for device in found_devices:
                print(
                    f"   📟 {device['name']} - {device['host']}:{device['port']} ({device['status']})"
                )
        else:
            print("📭 No additional FinSavvyAI devices found on network")
            print("💡 To add devices:")
            print("   1. Run ./install_worker.sh on other computers")
            print(
                "   2. Or share this command: curl -sSL https://your-repo/install_worker.sh | bash"
            )

    except Exception as e:
        print(f"❌ Network scan failed: {e}")

    print()


def show_process_info():
    """Show running FinSavvyAI processes"""
    print("⚙️  RUNNING PROCESSES")
    print("-" * 25)

    try:
        # Check for master process
        result = subprocess.run(["lsof", "-i", ":8000"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Master service running on port 8000")
            for line in result.stdout.strip().split("\n")[1:]:  # Skip header
                if line.strip():
                    print(f"   {line}")
        else:
            print("❌ Master service not running")

        # Check for worker processes
        result = subprocess.run(["lsof", "-i", ":8001"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Worker service running on port 8001")
            for line in result.stdout.strip().split("\n")[1:]:  # Skip header
                if line.strip():
                    print(f"   {line}")
        else:
            print("❌ Worker service not running")

        # Check for other potential workers
        for port in [8002, 8003, 8004, 8005]:
            result = subprocess.run(
                ["lsof", "-i", f":{port}"], capture_output=True, text=True
            )
            if result.returncode == 0:
                print(f"✅ Additional service running on port {port}")

    except Exception as e:
        print(f"❌ Error checking processes: {e}")

    print()


if __name__ == "__main__":
    print("Scanning FinSavvyAI devices and system information...")
    print()

    show_process_info()
    asyncio.run(list_devices())

    print("💡 QUICK COMMANDS:")
    print("   finsavvyai describe nodes              # List cluster devices")
    print("   finsavvyai describe nodes --detailed   # Detailed device info")
    print("   finsavvyai describe services           # Service status")
    print("   finsavvyai --output json describe nodes # JSON format")
    print("   ./install_worker.sh                    # Install on other devices")
    print()

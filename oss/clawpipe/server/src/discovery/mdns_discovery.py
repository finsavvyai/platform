"""Auto-discover LM Studio instances via mDNS/Bonjour."""

import asyncio
import logging
from typing import List, Optional

from .models import DiscoveredInstance
from .network_scan import scan_network

logger = logging.getLogger("finsavvyai.discovery")


class LMStudioDiscovery:
    """
    Discover LM Studio instances on the local network.

    Uses mDNS/Bonjour to find instances broadcasting their presence.
    Falls back to scanning common ports if mDNS fails.
    """

    LMSTUDIO_SERVICE = "_lmstudio._tcp.local."
    DEFAULT_PORT = 1234

    def __init__(self):
        self.zeroconf = None
        self.browser = None

    async def discover(
        self,
        timeout: int = 5,
        scan_range: Optional[str] = None,
    ) -> List[DiscoveredInstance]:
        """
        Discover LM Studio instances.

        Args:
            timeout: Seconds to wait for discovery
            scan_range: IP range to scan (e.g., "192.168.1.0/24")
                       If None, only mDNS is used

        Returns:
            List of discovered instances
        """
        instances: List[DiscoveredInstance] = []

        # Try mDNS first
        try:
            instances.extend(await self._discover_mdns(timeout))
        except Exception as e:
            logger.warning(f"mDNS discovery failed: {e}")

        # Fallback to port scan if requested
        if scan_range:
            logger.info(f"Scanning network range: {scan_range}")
            instances.extend(await self._scan_network(scan_range))

        # Remove duplicates
        seen: set = set()
        unique_instances: List[DiscoveredInstance] = []
        for instance in instances:
            key = (instance.host, instance.port)
            if key not in seen:
                seen.add(key)
                unique_instances.append(instance)

        logger.info(f"Discovered {len(unique_instances)} LM Studio instance(s)")
        return unique_instances

    async def _discover_mdns(self, timeout: int) -> List[DiscoveredInstance]:
        """Discover instances via mDNS."""
        instances: List[DiscoveredInstance] = []

        try:
            from zeroconf import ServiceBrowser, Zeroconf
        except ImportError:
            logger.warning("zeroconf not installed, skipping mDNS discovery")
            logger.info("Install with: pip install zeroconf")
            return instances

        def on_service_change(zeroconf, service_type, name):
            try:
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    host = info.parsed_addresses()[0]
                    port = info.port
                    instances.append(DiscoveredInstance(
                        name=name,
                        host=host,
                        port=port,
                        url=f"http://{host}:{port}",
                        models=[],
                    ))
                    logger.info(f"Discovered LM Studio at {host}:{port}")
            except Exception as e:
                logger.warning(f"Error processing service: {e}")

        zeroconf = Zeroconf()
        browser = ServiceBrowser(
            zeroconf,
            self.LMSTUDIO_SERVICE,
            handlers=[on_service_change],
        )

        await asyncio.sleep(timeout)

        zeroconf.close()
        return instances

    async def _scan_network(self, network: str) -> List[DiscoveredInstance]:
        """Scan network for LM Studio instances (delegates to network_scan)."""
        return await scan_network(network, self.DEFAULT_PORT)

    async def query_models(self, instance: DiscoveredInstance) -> List[str]:
        """Query available models from discovered instance."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{instance.url}/v1/models")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m["id"] for m in data.get("data", [])]
                    instance.models = models
                    return models
        except Exception as e:
            logger.warning(f"Failed to query models from {instance.url}: {e}")

        return []


async def main():
    """Test discovery functionality."""
    logging.basicConfig(level=logging.INFO)

    discovery = LMStudioDiscovery()

    print("Discovering LM Studio instances...")
    instances = await discovery.discover(timeout=5)

    if instances:
        print(f"\nFound {len(instances)} instance(s):")
        for instance in instances:
            print(f"\n  {instance.name}")
            print(f"  URL: {instance.url}")

            # Query models
            models = await discovery.query_models(instance)
            if models:
                print(f"  Models ({len(models)}):")
                for model in models[:3]:  # Show first 3
                    print(f"    - {model}")
                if len(models) > 3:
                    print(f"    ... and {len(models) - 3} more")
    else:
        print("\nNo LM Studio instances found.")
        print("\nMake sure:")
        print("  1. LM Studio is running")
        print("  2. API server is enabled")
        print("  3. You're on the same network")


if __name__ == "__main__":
    asyncio.run(main())

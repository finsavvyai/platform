"""Network scanning for LM Studio instances."""

import asyncio
import logging
from typing import List

from .models import DiscoveredInstance

logger = logging.getLogger("finsavvyai.discovery")

DEFAULT_PORT = 1234


async def scan_network(
    network: str,
    default_port: int = DEFAULT_PORT,
) -> List[DiscoveredInstance]:
    """Scan network for LM Studio instances.

    Args:
        network: CIDR range to scan (e.g., "192.168.1.0/24")
        default_port: Port to check on each host

    Returns:
        List of discovered instances
    """
    instances: List[DiscoveredInstance] = []

    try:
        import httpx
    except ImportError:
        logger.warning("httpx not installed, skipping network scan")
        return instances

    # Parse network range (simple implementation for /24)
    base_ip = network.rsplit('.', 1)[0]

    async def check_host(i: int) -> DiscoveredInstance | None:
        host = f"{base_ip}.{i}"
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                resp = await client.get(
                    f"http://{host}:{default_port}/v1/models",
                    timeout=1.0,
                )
                if resp.status_code == 200:
                    return DiscoveredInstance(
                        name=f"LM Studio at {host}",
                        host=host,
                        port=default_port,
                        url=f"http://{host}:{default_port}",
                        models=[],
                    )
        except Exception:
            return None

    # Scan last octet 1-254 in batches
    logger.info("Scanning network (this may take a minute...)")
    batch_size = 50

    for start in range(1, 255, batch_size):
        end = min(start + batch_size, 255)
        tasks = [check_host(i) for i in range(start, end)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if result and not isinstance(result, Exception):
                instances.append(result)
                logger.info(f"Found LM Studio at {result.host}")

        # Small delay between batches
        await asyncio.sleep(0.1)

    return instances

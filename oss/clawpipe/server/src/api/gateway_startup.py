"""Startup entry point for the API Gateway."""

import argparse
import os


async def main():
    """Parse CLI arguments and start the API Gateway."""
    parser = argparse.ArgumentParser(description="FinSavvyAI API Gateway")
    parser.add_argument(
        "--host",
        default=os.environ.get("FINSAVVYAI_GATEWAY_HOST", "0.0.0.0"),
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("FINSAVVYAI_GATEWAY_PORT", "8080")),
    )
    parser.add_argument(
        "--master-host",
        default=os.environ.get("FINSAVVYAI_MASTER_HOST", "localhost"),
    )
    parser.add_argument(
        "--master-port",
        type=int,
        default=int(os.environ.get("FINSAVVYAI_MASTER_PORT", "8000")),
    )
    args = parser.parse_args()

    # Lazy import to avoid circular dependency
    from src.api.gateway import APIGateway

    gateway = APIGateway(master_host=args.master_host, master_port=args.master_port)
    await gateway.start(host=args.host, port=args.port)

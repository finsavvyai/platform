#!/usr/bin/env python3
"""
FinSavvyAI Master Server Entry Point
Starts the cluster master server
"""

import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from src.core.master_server import MasterServer


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="FinSavvyAI Cluster Master")
    parser.add_argument("--host", default=None, help="Host to bind to (default: auto-detect)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to (default: 8000)")
    
    args = parser.parse_args()
    
    server = MasterServer(host=args.host, port=args.port)
    await server.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Master server stopped")
        sys.exit(0)


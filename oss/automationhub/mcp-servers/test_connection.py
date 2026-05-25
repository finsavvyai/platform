#!/usr/bin/env python3
"""
Quick test script to verify Cloudflare API connection
"""

import os
import asyncio
from cloudflare_mcp_server import CloudflareMCPServer

async def test_cloudflare_connection():
    server = CloudflareMCPServer()

    print("🔍 Testing Cloudflare API connection...")

    try:
        # Test getting zone info for primary domain
        result = await server.get_zone_info({"domain": "upm.plus"})
        if "error" in result:
            print(f"❌ Connection failed: {result['error']}")
            return False
        else:
            print(f"✅ Connection successful!")
            print(f"   Domain: upm.plus")
            print(f"   Zone ID: {os.getenv('CLOUDFLARE_ZONE_ID_UPM_PLUS', 'Not found')}")
            return True

    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_cloudflare_connection())
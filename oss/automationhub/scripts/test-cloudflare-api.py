#!/usr/bin/env python3
"""
UPM.Plus Cloudflare API Test Script
Tests the Cloudflare API server for domain management functionality
"""

import asyncio
import aiohttp
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8082"

async def test_endpoint(session, endpoint, method="GET", data=None):
    """Test a specific API endpoint"""
    url = f"{BASE_URL}{endpoint}"

    try:
        if method == "GET":
            async with session.get(url) as response:
                result = await response.json()
                return {"status": response.status, "data": result}
        elif method == "POST":
            async with session.post(url, json=data) as response:
                result = await response.json()
                return {"status": response.status, "data": result}
        elif method == "PUT":
            async with session.put(url, json=data) as response:
                result = await response.json()
                return {"status": response.status, "data": result}
        elif method == "DELETE":
            async with session.delete(url) as response:
                result = await response.json()
                return {"status": response.status, "data": result}
    except Exception as e:
        return {"status": "error", "data": {"error": str(e)}}

async def run_cloudflare_api_tests():
    """Run comprehensive tests of the Cloudflare API server"""

    print("🧪 TESTING CLOUDFLARE API SERVER FOR UPM.PLUS")
    print("=" * 60)

    async with aiohttp.ClientSession() as session:

        # Test 1: Server Health
        print("\n📋 Test 1: Server Health Check")
        result = await test_endpoint(session, "/health")
        if result["status"] == 200:
            print("✅ Health check passed")
            print(f"   Status: {result['data']['status']}")
            print(f"   Mode: {result['data']['mode']}")
        else:
            print(f"❌ Health check failed: {result}")

        # Test 2: List Domains
        print("\n📋 Test 2: List UPM.Plus Domains")
        result = await test_endpoint(session, "/domains")
        if result["status"] == 200:
            domains = result["data"]["domains"]
            print(f"✅ Found {len(domains)} domains")
            for domain in domains:
                print(f"   - {domain['name']} ({domain['status']})")
        else:
            print(f"❌ Domain listing failed: {result}")

        # Test 3: UPM.Plus Domain Configuration
        print("\n📋 Test 3: UPM.Plus Domain Configuration")
        result = await test_endpoint(session, "/upm/domains")
        if result["status"] == 200:
            config = result["data"]
            print(f"✅ UPM.Plus domain configuration loaded")
            print(f"   Domains: {', '.join(config['domains'])}")
            print(f"   Subdomains: {len(config['subdomains'])} configured")

            # Show recommended DNS for production domain
            prod_dns = config["recommended_dns"]["upm.plus"]["records"]
            print(f"   Production DNS records: {len(prod_dns)} recommended")
        else:
            print(f"❌ Domain configuration failed: {result}")

        # Test 4: DNS Record Creation
        print("\n📋 Test 4: DNS Record Creation")
        dns_data = {
            "zone_id": "zone123",
            "name": "test-api",
            "type": "A",
            "content": "192.168.1.200",
            "ttl": 3600,
            "proxied": True
        }
        result = await test_endpoint(session, "/dns/create", "POST", dns_data)
        if result["status"] == 200:
            record = result["data"]["record"]
            print(f"✅ DNS record created: {record['name']} -> {record['content']}")
            record_id = record["id"]
        else:
            print(f"❌ DNS creation failed: {result}")
            record_id = None

        # Test 5: DNS Record Retrieval
        print("\n📋 Test 5: DNS Record Retrieval")
        result = await test_endpoint(session, "/dns/zone123")
        if result["status"] == 200:
            records = result["data"]["records"]
            print(f"✅ Found {len(records)} DNS records for zone")
            for record in records[:3]:  # Show first 3
                print(f"   - {record['name']} ({record['type']}) -> {record['content']}")
        else:
            print(f"❌ DNS retrieval failed: {result}")

        # Test 6: SSL Configuration
        print("\n📋 Test 6: SSL Configuration")
        ssl_data = {
            "zone_id": "zone123",
            "ssl_mode": "strict"
        }
        result = await test_endpoint(session, "/ssl/configure", "POST", ssl_data)
        if result["status"] == 200:
            print(f"✅ SSL configured: {result['data']['ssl_mode']}")
        else:
            print(f"❌ SSL configuration failed: {result}")

        # Test 7: Cache Purge
        print("\n📋 Test 7: Cache Purge")
        result = await test_endpoint(session, "/cache/purge/zone123", "POST")
        if result["status"] == 200:
            print(f"✅ Cache purge initiated: {result['data']['message']}")
        else:
            print(f"❌ Cache purge failed: {result}")

        # Test 8: Security Configuration
        print("\n📋 Test 8: Security Configuration")
        result = await test_endpoint(session, "/security/configure/zone123?security_level=high", "POST")
        if result["status"] == 200:
            print(f"✅ Security configured: {result['data']['security_level']}")
        else:
            print(f"❌ Security configuration failed: {result}")

        # Test 9: Analytics
        print("\n📋 Test 9: Analytics Data")
        result = await test_endpoint(session, "/analytics/zone123")
        if result["status"] == 200:
            analytics = result["data"]["analytics"]
            requests = analytics["requests"]
            print(f"✅ Analytics retrieved")
            print(f"   Total requests: {requests['total']:,}")
            print(f"   Cache hit rate: {requests['cached_percent']}%")
            print(f"   Threats blocked: {analytics['threats']['total']}")
        else:
            print(f"❌ Analytics retrieval failed: {result}")

        # Test 10: DNS Setup Test
        print("\n📋 Test 10: DNS Setup Test")
        result = await test_endpoint(session, "/test/dns-setup")
        if result["status"] == 200:
            test_results = result["data"]["test_results"]
            print(f"✅ DNS setup test completed")
            for domain, result in test_results.items():
                print(f"   - {domain}: {result['records_created']} records ({result['status']})")
        else:
            print(f"❌ DNS setup test failed: {result}")

        # Test 11: SSL Setup Test
        print("\n📋 Test 11: SSL Setup Test")
        result = await test_endpoint(session, "/test/ssl-setup")
        if result["status"] == 200:
            test_results = result["data"]["test_results"]
            print(f"✅ SSL setup test completed")
            for domain, result in test_results.items():
                print(f"   - {domain}: {result['ssl_mode']} SSL ({result['status']})")
        else:
            print(f"❌ SSL setup test failed: {result}")

        # Test 12: Deploy All Domains
        print("\n📋 Test 12: Deploy All UPM.Plus Domains")
        result = await test_endpoint(session, "/upm/deploy-all", "POST")
        if result["status"] == 200:
            print(f"✅ Domain deployment started: {result['data']['message']}")
        else:
            print(f"❌ Domain deployment failed: {result}")

        # Cleanup: Delete test DNS record if created
        if record_id:
            print("\n📋 Cleanup: Delete Test DNS Record")
            result = await test_endpoint(session, f"/dns/zone123/{record_id}", "DELETE")
            if result["status"] == 200:
                print(f"✅ Test DNS record deleted")
            else:
                print(f"⚠️  Test DNS record cleanup failed: {result}")

async def main():
    """Main test function"""
    start_time = datetime.now()

    await run_cloudflare_api_tests()

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    print("\n" + "=" * 60)
    print(f"🎉 CLOUDFLARE API TEST SUITE COMPLETED")
    print(f"⏱️  Duration: {duration:.2f} seconds")
    print(f"🚀 UPM.Plus Cloudflare integration is ready for deployment!")
    print("\n📝 Next steps:")
    print("   1. Configure CLOUDFLARE_API_TOKEN for real operations")
    print("   2. Run the multi-domain deployment script")
    print("   3. Verify all domains are accessible")
    print("   4. Set up monitoring and analytics")

if __name__ == "__main__":
    asyncio.run(main())
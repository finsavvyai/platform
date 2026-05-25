#!/usr/bin/env python3
"""
Quick integration test for browser automation service
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

async def test_browser_integration():
    """Test browser automation integration with main API"""
    print("🔍 Testing Browser Automation Integration")
    print("=" * 50)

    base_url = "http://localhost:8001/api/v1"

    async with aiohttp.ClientSession() as session:
        try:
            # Test 1: Health check
            print("1. Testing API health...")
            async with session.get(f"{base_url}/health/") as response:
                if response.status == 200:
                    print("   ✅ API is running")
                else:
                    print(f"   ❌ API health check failed: {response.status}")
                    return False

            # Test 2: Browser service health
            print("2. Testing browser service health...")
            async with session.get(f"{base_url}/browser/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"   ✅ Browser service healthy: {data}")
                else:
                    print(f"   ❌ Browser service health failed: {response.status}")
                    return False

            # Test 3: Get browser templates
            print("3. Testing browser templates...")
            async with session.get(f"{base_url}/browser/templates") as response:
                if response.status == 200:
                    templates = await response.json()
                    print(f"   ✅ Found {len(templates)} browser templates")
                    for template in templates[:3]:  # Show first 3
                        print(f"      - {template['name']}: {template['description']}")
                else:
                    print(f"   ❌ Templates request failed: {response.status}")
                    return False

            # Test 4: Create a simple workflow
            print("4. Testing workflow creation...")
            workflow_data = {
                "name": "Integration Test Workflow",
                "description": "Simple test workflow for integration testing",
                "template": "web_scraping",
                "parameters": {
                    "url": "https://httpbin.org/html",
                    "selectors": {
                        "title": "title",
                        "heading": "h1"
                    }
                },
                "browser_config": {
                    "headless": True,
                    "timeout": 30000
                }
            }

            async with session.post(
                f"{base_url}/browser/workflows",
                json=workflow_data
            ) as response:
                if response.status == 200:
                    workflow = await response.json()
                    workflow_id = workflow['id']
                    print(f"   ✅ Workflow created: {workflow_id}")

                    # Test 5: Execute the workflow
                    print("5. Testing workflow execution...")
                    async with session.post(
                        f"{base_url}/browser/workflows/{workflow_id}/execute"
                    ) as exec_response:
                        if exec_response.status == 200:
                            result = await exec_response.json()
                            print(f"   ✅ Workflow executed successfully")
                            print(f"      Status: {result.get('status', 'unknown')}")
                            if result.get('data'):
                                print(f"      Data extracted: {len(result['data'])} items")
                        else:
                            print(f"   ❌ Workflow execution failed: {exec_response.status}")
                            error_text = await exec_response.text()
                            print(f"      Error: {error_text}")

                    # Test 6: Get workflow status
                    print("6. Testing workflow status...")
                    async with session.get(
                        f"{base_url}/browser/workflows/{workflow_id}/status"
                    ) as status_response:
                        if status_response.status == 200:
                            status = await status_response.json()
                            print(f"   ✅ Workflow status: {status.get('status', 'unknown')}")
                            print(f"      Last updated: {status.get('updated_at', 'unknown')}")
                        else:
                            print(f"   ❌ Status check failed: {status_response.status}")
                else:
                    print(f"   ❌ Workflow creation failed: {response.status}")
                    error_text = await response.text()
                    print(f"      Error: {error_text}")
                    return False

            print("\n🎉 Browser Integration Test Complete!")
            return True

        except Exception as e:
            print(f"❌ Integration test failed with exception: {e}")
            return False

async def main():
    """Main test runner"""
    print(f"🚀 Starting Browser Integration Test at {datetime.now()}")

    success = await test_browser_integration()

    if success:
        print("\n✅ All tests passed! Browser automation is properly integrated.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
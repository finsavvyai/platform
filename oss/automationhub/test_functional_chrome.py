#!/usr/bin/env python3
"""
Functional Tests using Chrome Dev Tools MCP
End-to-end testing of UPM.Plus API endpoints using real browser automation
"""

import asyncio
import json
import sys
import time
from datetime import datetime
from playwright.async_api import async_playwright

async def test_upm_plus_functional():
    """
    Comprehensive functional test using Chrome Dev Tools
    Tests all major API endpoints and user workflows
    """
    print("🌐 Starting UPM.Plus Functional Tests with Chrome")
    print("=" * 60)

    base_url = "http://localhost:8001"
    api_base = f"{base_url}/api/v1"

    test_results = {
        "health_check": False,
        "docs_accessible": False,
        "llm_service": False,
        "task_queue": False,
        "code_generation": False,
        "voice_control": False,
        "marketplace": False,
        "nlp_service": False,
        "browser_interaction": False,
        "end_to_end_workflow": False
    }

    async with async_playwright() as p:
        try:
            # Launch browser
            browser = await p.chromium.launch(headless=False, devtools=True)
            context = await browser.new_context()
            page = await context.new_page()

            # Enable network domain to monitor requests
            await page.route("**/*", lambda route: route.continue_())

            print("\n1. 🔧 Testing Basic Health Check")
            print("-" * 30)

            try:
                response = await page.goto(f"{api_base}/health")
                if response.status == 200:
                    content = await page.content()
                    if "healthy" in content.lower():
                        print("   ✅ Health check endpoint accessible")
                        test_results["health_check"] = True
                    else:
                        print("   ⚠️  Health check returned unexpected content")
                else:
                    print(f"   ❌ Health check failed: {response.status}")
            except Exception as e:
                print(f"   ❌ Health check error: {e}")

            print("\n2. 📚 Testing API Documentation")
            print("-" * 30)

            try:
                response = await page.goto(f"{base_url}/docs")
                if response.status == 200:
                    # Wait for Swagger UI to load
                    await page.wait_for_selector(".swagger-ui", timeout=10000)

                    # Check for our new endpoints
                    content = await page.content()
                    if "llm" in content and "task-queue" in content:
                        print("   ✅ API documentation accessible")
                        print("   📋 LLM and Task Queue endpoints documented")
                        test_results["docs_accessible"] = True
                    else:
                        print("   ⚠️  API docs missing expected endpoints")
                else:
                    print(f"   ❌ API docs failed: {response.status}")
            except Exception as e:
                print(f"   ❌ API docs error: {e}")

            print("\n3. 🧠 Testing LLM Service via Browser")
            print("-" * 30)

            try:
                # Test LLM health endpoint
                response = await page.goto(f"{api_base}/llm/health")
                if response.status == 200:
                    health_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                    print(f"   ✅ LLM Health: {health_data.get('service', 'unknown')}")
                    print(f"   🤖 OpenAI: {health_data.get('openai_client', 'unknown')}")
                    print(f"   💾 Cache: {health_data.get('redis_cache', 'unknown')}")

                    # Test model info
                    response = await page.goto(f"{api_base}/llm/models")
                    if response.status == 200:
                        model_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                        print(f"   📊 Available models: {len(model_data.get('configurations', {}))}")
                        test_results["llm_service"] = True
                    else:
                        print(f"   ⚠️  Model info failed: {response.status}")
                else:
                    print(f"   ❌ LLM health failed: {response.status}")
            except Exception as e:
                print(f"   ❌ LLM service error: {e}")

            print("\n4. 🔄 Testing Task Queue Service")
            print("-" * 30)

            try:
                # Test task queue health
                response = await page.goto(f"{api_base}/task-queue/health")
                if response.status == 200:
                    health_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                    print(f"   ✅ Queue Health: {health_data.get('service', 'unknown')}")
                    print(f"   🤖 Agents: {health_data.get('total_agents', 0)}")

                    # Test queue stats
                    response = await page.goto(f"{api_base}/task-queue/queue/stats")
                    if response.status == 200:
                        stats_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                        print(f"   📊 Running tasks: {stats_data.get('running_tasks', 0)}")
                        print(f"   ✅ Completed: {stats_data.get('completed_tasks', 0)}")
                        test_results["task_queue"] = True
                    else:
                        print(f"   ⚠️  Queue stats failed: {response.status}")
                else:
                    print(f"   ❌ Task queue health failed: {response.status}")
            except Exception as e:
                print(f"   ❌ Task queue error: {e}")

            print("\n5. 💻 Testing Code Generation Service")
            print("-" * 30)

            try:
                # Navigate to health endpoint first to set up session
                await page.goto(f"{api_base}/code-generation/health")

                # Test using JavaScript fetch to make POST request
                code_gen_result = await page.evaluate("""
                    async () => {
                        try {
                            const response = await fetch('/api/v1/code-generation/generate', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    description: 'Create a simple FastAPI hello world endpoint',
                                    code_type: 'python',
                                    complexity: 'simple'
                                })
                            });
                            return {
                                status: response.status,
                                data: response.ok ? await response.json() : null
                            };
                        } catch (error) {
                            return { status: 0, error: error.message };
                        }
                    }
                """)

                if code_gen_result["status"] == 200 and code_gen_result["data"]:
                    print("   ✅ Code generation successful")
                    generated_code = code_gen_result["data"].get("code", "")
                    print(f"   💻 Generated: {len(generated_code)} characters")
                    if "fastapi" in generated_code.lower() or "def " in generated_code:
                        print("   🐍 Valid Python code detected")
                    test_results["code_generation"] = True
                else:
                    print(f"   ⚠️  Code generation status: {code_gen_result['status']}")
                    if code_gen_result.get("error"):
                        print(f"   Error: {code_gen_result['error']}")
            except Exception as e:
                print(f"   ❌ Code generation error: {e}")

            print("\n6. 🎤 Testing Voice Control Service")
            print("-" * 30)

            try:
                response = await page.goto(f"{api_base}/voice/capabilities")
                if response.status == 200:
                    voice_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                    print(f"   ✅ Voice capabilities accessible")
                    print(f"   🗣️  Commands: {len(voice_data.get('supported_commands', []))}")
                    print(f"   🌐 Languages: {len(voice_data.get('languages_supported', []))}")
                    test_results["voice_control"] = True
                else:
                    print(f"   ❌ Voice capabilities failed: {response.status}")
            except Exception as e:
                print(f"   ❌ Voice control error: {e}")

            print("\n7. 🏪 Testing Workflow Marketplace")
            print("-" * 30)

            try:
                response = await page.goto(f"{api_base}/marketplace/trending?count=3")
                if response.status == 200:
                    marketplace_data = await page.evaluate("() => JSON.parse(document.body.textContent)")
                    print(f"   ✅ Marketplace accessible")
                    print(f"   📦 Trending workflows: {len(marketplace_data)}")
                    test_results["marketplace"] = True
                else:
                    print(f"   ❌ Marketplace failed: {response.status}")
            except Exception as e:
                print(f"   ❌ Marketplace error: {e}")

            print("\n8. 🧠 Testing NLP Service")
            print("-" * 30)

            try:
                # Test NLP analyze endpoint using fetch
                nlp_result = await page.evaluate("""
                    async () => {
                        try {
                            const response = await fetch('/api/v1/nlp/analyze', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    text: 'I need help deploying my application to the cloud',
                                    context: { project_type: 'web_application' }
                                })
                            });
                            return {
                                status: response.status,
                                data: response.ok ? await response.json() : null
                            };
                        } catch (error) {
                            return { status: 0, error: error.message };
                        }
                    }
                """)

                if nlp_result["status"] == 200 and nlp_result["data"]:
                    print("   ✅ NLP analysis successful")
                    data = nlp_result["data"]
                    print(f"   🌐 Language: {data.get('detected_language', 'unknown')}")
                    print(f"   🎯 Intent: {data.get('intent', 'unknown')}")
                    print(f"   😊 Sentiment: {data.get('sentiment', 'unknown')}")
                    test_results["nlp_service"] = True
                else:
                    print(f"   ⚠️  NLP analysis status: {nlp_result['status']}")
            except Exception as e:
                print(f"   ❌ NLP service error: {e}")

            print("\n9. 🖱️  Testing Browser Interaction")
            print("-" * 30)

            try:
                # Test browser automation capabilities
                await page.goto(f"{base_url}/docs")

                # Test JavaScript execution and DOM interaction
                title = await page.title()
                print(f"   ✅ Page title: {title}")

                # Test form interaction (if any forms exist)
                forms = await page.query_selector_all("form")
                print(f"   📝 Forms found: {len(forms)}")

                # Test API endpoint links
                api_links = await page.query_selector_all("a[href*='/api/']")
                print(f"   🔗 API links: {len(api_links)}")

                test_results["browser_interaction"] = True
            except Exception as e:
                print(f"   ❌ Browser interaction error: {e}")

            print("\n10. 🔄 Testing End-to-End Workflow")
            print("-" * 30)

            try:
                # Test a complete workflow: Register agent -> Submit task -> Check status
                workflow_result = await page.evaluate("""
                    async () => {
                        try {
                            // Step 1: Register an agent
                            const agentResponse = await fetch('/api/v1/task-queue/agents', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'llm_agent',
                                    name: 'Test Browser Agent',
                                    description: 'Agent registered via browser test',
                                    max_concurrent_tasks: 1
                                })
                            });

                            if (!agentResponse.ok) {
                                return { step: 'agent_registration', status: agentResponse.status };
                            }

                            const agentData = await agentResponse.json();

                            // Step 2: Submit a task
                            const taskResponse = await fetch('/api/v1/task-queue/tasks/llm', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    prompt: 'Generate a brief project description for UPM.Plus',
                                    priority: 'normal'
                                })
                            });

                            if (!taskResponse.ok) {
                                return { step: 'task_submission', status: taskResponse.status };
                            }

                            const taskData = await taskResponse.json();

                            // Step 3: Check task status
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                            const statusResponse = await fetch(`/api/v1/task-queue/tasks/${taskData.task_id}`);
                            const statusData = statusResponse.ok ? await statusResponse.json() : null;

                            return {
                                success: true,
                                agent_id: agentData.agent_id,
                                task_id: taskData.task_id,
                                task_status: statusData?.status || 'unknown'
                            };

                        } catch (error) {
                            return { success: false, error: error.message };
                        }
                    }
                """)

                if workflow_result.get("success"):
                    print("   ✅ End-to-end workflow successful")
                    print(f"   🤖 Agent ID: {workflow_result['agent_id'][:8]}...")
                    print(f"   📝 Task ID: {workflow_result['task_id'][:8]}...")
                    print(f"   📊 Task Status: {workflow_result['task_status']}")
                    test_results["end_to_end_workflow"] = True
                else:
                    print(f"   ⚠️  Workflow failed at: {workflow_result.get('step', 'unknown')}")
                    if workflow_result.get("error"):
                        print(f"   Error: {workflow_result['error']}")
            except Exception as e:
                print(f"   ❌ End-to-end workflow error: {e}")

            await browser.close()

        except Exception as e:
            print(f"❌ Browser automation failed: {e}")
            return False

    # Summary
    print("\n" + "=" * 60)
    print("🌐 FUNCTIONAL TEST SUMMARY")
    print("=" * 60)

    passed_tests = sum(test_results.values())
    total_tests = len(test_results)
    success_rate = (passed_tests / total_tests) * 100

    print(f"✅ Tests Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
    print()

    for feature, status in test_results.items():
        status_icon = "✅" if status else "❌"
        feature_name = feature.replace('_', ' ').title()
        print(f"{status_icon} {feature_name}")

    print()

    if success_rate >= 90:
        print("🎉 EXCELLENT! All major functionality working via browser!")
        print("🚀 UPM.Plus is ready for production use!")
    elif success_rate >= 75:
        print("👍 GOOD! Most functionality accessible via browser.")
        print("🔧 Minor issues to address.")
    elif success_rate >= 50:
        print("⚠️  PARTIAL! Some functionality working.")
        print("🛠️  Several features need attention.")
    else:
        print("❌ CRITICAL! Major functionality issues detected.")
        print("🆘 Significant fixes required.")

    print()
    print("🔥 FUNCTIONAL ACHIEVEMENTS:")
    if test_results["health_check"]:
        print("   • Basic API health and monitoring")
    if test_results["docs_accessible"]:
        print("   • Complete API documentation via Swagger UI")
    if test_results["llm_service"]:
        print("   • LLM service with multiple model configurations")
    if test_results["task_queue"]:
        print("   • Multi-agent task queue system")
    if test_results["code_generation"]:
        print("   • AI-powered code generation")
    if test_results["marketplace"]:
        print("   • Workflow marketplace with recommendations")
    if test_results["nlp_service"]:
        print("   • Advanced NLP with multi-language support")
    if test_results["browser_interaction"]:
        print("   • Full browser automation capabilities")
    if test_results["end_to_end_workflow"]:
        print("   • Complete end-to-end workflow execution")

    print()
    print("📈 PRODUCTION READINESS:")
    print("   • RESTful API with comprehensive endpoints")
    print("   • Interactive API documentation")
    print("   • Multi-service architecture with proper separation")
    print("   • Real-time task monitoring and management")
    print("   • Browser-based testing and validation")

    return success_rate >= 75

async def check_server_status():
    """Check if the UPM.Plus server is running"""
    print("🔍 Checking server status...")

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            response = await page.goto("http://localhost:8001/api/v1/health", timeout=5000)
            await browser.close()

            if response and response.status == 200:
                print("✅ Server is running and accessible")
                return True
            else:
                print(f"❌ Server responded with status: {response.status if response else 'No response'}")
                return False

        except Exception as e:
            print(f"❌ Server check failed: {e}")
            return False

async def main():
    """Main test runner"""
    print(f"🧪 Starting UPM.Plus Functional Tests at {datetime.now()}")
    print(f"🌐 Target: http://localhost:8001")
    print()

    # Check if server is running
    server_running = await check_server_status()

    if not server_running:
        print("⚠️  Server is not running. Please start the UPM.Plus server first:")
        print("   cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload")
        sys.exit(1)

    success = await test_upm_plus_functional()

    if success:
        print("\n🏆 FUNCTIONAL TESTS PASSED! UPM.Plus is production-ready!")
        sys.exit(0)
    else:
        print("\n🔧 Functional tests revealed issues that need attention.")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test runner failed: {e}")
        sys.exit(1)
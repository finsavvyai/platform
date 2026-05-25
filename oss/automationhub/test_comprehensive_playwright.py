"""
Comprehensive Playwright Test Suite for UPM.Plus Platform

Tests all major features including:
- API endpoints and functionality
- MCP integration and tool execution
- Workflow engine and execution
- Knowledge management and document processing
- Conversational AI and RAG capabilities
- Authentication and user management
- Real browser automation scenarios
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from typing import Any, Dict
from uuid import uuid4

import pytest
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Set test environment
os.environ['ENVIRONMENT'] = 'test'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./test_comprehensive.db'
os.environ['SECRET_KEY'] = 'test_secret_comprehensive_key'
os.environ['REDIS_URL'] = 'redis://localhost:6379/1'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UPMPlusTestSuite:
    """Comprehensive test suite for UPM.Plus platform."""

    def __init__(self):
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        self.api_base_url = "http://localhost:8000"
        self.test_user_token = None
        self.test_results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "test_details": [],
            "performance_metrics": {}
        }

    async def setup(self):
        """Set up test environment and browser."""
        logger.info("🚀 Setting up UPM.Plus comprehensive test environment...")

        # Start Playwright
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()

        # Set up API client
        await self.page.route("**/*", self._handle_network_requests)

        logger.info("✅ Test environment ready")

    async def _handle_network_requests(self, route, request):
        """Handle and monitor network requests."""
        # Log API calls for debugging
        if self.api_base_url in request.url:
            logger.debug(f"API Request: {request.method} {request.url}")

        await route.continue_()

    async def teardown(self):
        """Clean up test environment."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    def log_test_result(self, test_name: str, success: bool, details: str = "", duration_ms: int = 0):
        """Log test result."""
        self.test_results["total_tests"] += 1
        if success:
            self.test_results["passed_tests"] += 1
            status = "✅ PASS"
        else:
            self.test_results["failed_tests"] += 1
            status = "❌ FAIL"

        self.test_results["test_details"].append({
            "name": test_name,
            "status": status,
            "details": details,
            "duration_ms": duration_ms
        })

        logger.info(f"{status} {test_name}: {details}")

    async def test_api_endpoints(self):
        """Test all API endpoints functionality."""
        logger.info("\n🧪 Testing API Endpoints...")

        try:
            # Test health endpoint
            start_time = datetime.utcnow()
            response = await self.page.request.get(f"{self.api_base_url}/api/v1/health/")
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                self.log_test_result(
                    "Health Endpoint",
                    True,
                    f"Status: {data.get('status', 'unknown')}, Response time: {duration}ms",
                    duration
                )
            else:
                self.log_test_result("Health Endpoint", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("Health Endpoint", False, f"Error: {str(e)}")

        # Test API documentation endpoint
        try:
            start_time = datetime.utcnow()
            response = await self.page.request.get(f"{self.api_base_url}/docs")
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            success = response.status == 200
            self.log_test_result(
                "API Documentation",
                success,
                f"HTTP {response.status}, Response time: {duration}ms",
                duration
            )

        except Exception as e:
            self.log_test_result("API Documentation", False, f"Error: {str(e)}")

    async def test_user_authentication(self):
        """Test user authentication and registration."""
        logger.info("\n🔐 Testing Authentication System...")

        try:
            # Test user registration
            start_time = datetime.utcnow()
            test_user = {
                "email": f"test_{uuid4().hex[:8]}@example.com",
                "password": "testpassword123",
                "full_name": "Test User"
            }

            response = await self.page.request.post(
                f"{self.api_base_url}/api/v1/auth/register",
                data=json.dumps(test_user),
                headers={"Content-Type": "application/json"}
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 201:
                self.log_test_result(
                    "User Registration",
                    True,
                    f"User created successfully, Response time: {duration}ms",
                    duration
                )

                # Test login
                start_time = datetime.utcnow()
                login_data = {
                    "username": test_user["email"],
                    "password": test_user["password"]
                }

                response = await self.page.request.post(
                    f"{self.api_base_url}/api/v1/auth/login",
                    data=f"username={login_data['username']}&password={login_data['password']}",
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status == 200:
                    data = await response.json()
                    self.test_user_token = data.get("access_token")
                    self.log_test_result(
                        "User Login",
                        True,
                        f"Login successful, Token received, Response time: {duration}ms",
                        duration
                    )
                else:
                    self.log_test_result("User Login", False, f"HTTP {response.status}")

            else:
                self.log_test_result("User Registration", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("User Authentication", False, f"Error: {str(e)}")

    async def test_workflow_engine(self):
        """Test workflow creation and execution."""
        logger.info("\n⚙️ Testing Workflow Engine...")

        if not self.test_user_token:
            self.log_test_result("Workflow Engine", False, "No authentication token available")
            return

        try:
            headers = {
                "Authorization": f"Bearer {self.test_user_token}",
                "Content-Type": "application/json"
            }

            # Create a test workflow
            start_time = datetime.utcnow()
            workflow_data = {
                "name": "Playwright Test Workflow",
                "description": "A test workflow created by Playwright",
                "nodes": [
                    {
                        "id": "start_1",
                        "type": "start",
                        "name": "Start",
                        "position": {"x": 100, "y": 100}
                    },
                    {
                        "id": "transform_1",
                        "type": "transform",
                        "name": "Transform Data",
                        "config": {
                            "transform_type": "javascript",
                            "script": "return {message: 'Hello from Playwright test!'}"
                        },
                        "position": {"x": 300, "y": 100}
                    },
                    {
                        "id": "end_1",
                        "type": "end",
                        "name": "End",
                        "position": {"x": 500, "y": 100}
                    }
                ],
                "connections": [
                    {
                        "source_node_id": "start_1",
                        "source_output": "default",
                        "target_node_id": "transform_1",
                        "target_input": "default"
                    },
                    {
                        "source_node_id": "transform_1",
                        "source_output": "default",
                        "target_node_id": "end_1",
                        "target_input": "default"
                    }
                ]
            }

            response = await self.page.request.post(
                f"{self.api_base_url}/api/v1/workflows/",
                data=json.dumps(workflow_data),
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                workflow_id = data.get("workflow_id")
                self.log_test_result(
                    "Workflow Creation",
                    True,
                    f"Workflow created: {workflow_id}, Response time: {duration}ms",
                    duration
                )

                # Test workflow execution
                start_time = datetime.utcnow()
                execution_data = {
                    "input_data": {"test_input": "Playwright test data"}
                }

                response = await self.page.request.post(
                    f"{self.api_base_url}/api/v1/workflows/{workflow_id}/execute",
                    data=json.dumps(execution_data),
                    headers=headers
                )
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status == 200:
                    data = await response.json()
                    execution_id = data.get("execution_id")
                    self.log_test_result(
                        "Workflow Execution",
                        True,
                        f"Execution started: {execution_id}, Response time: {duration}ms",
                        duration
                    )

                    # Wait and check execution status
                    await asyncio.sleep(2)

                    response = await self.page.request.get(
                        f"{self.api_base_url}/api/v1/workflows/executions/{execution_id}",
                        headers=headers
                    )

                    if response.status == 200:
                        data = await response.json()
                        status = data.get("status")
                        self.log_test_result(
                            "Workflow Status Check",
                            True,
                            f"Execution status: {status}",
                            0
                        )
                    else:
                        self.log_test_result("Workflow Status Check", False, f"HTTP {response.status}")

                else:
                    self.log_test_result("Workflow Execution", False, f"HTTP {response.status}")

            else:
                self.log_test_result("Workflow Creation", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("Workflow Engine", False, f"Error: {str(e)}")

    async def test_mcp_integration(self):
        """Test MCP server integration and tool execution."""
        logger.info("\n🔧 Testing MCP Integration...")

        if not self.test_user_token:
            self.log_test_result("MCP Integration", False, "No authentication token available")
            return

        try:
            headers = {
                "Authorization": f"Bearer {self.test_user_token}",
                "Content-Type": "application/json"
            }

            # Test MCP servers listing
            start_time = datetime.utcnow()
            response = await self.page.request.get(
                f"{self.api_base_url}/api/v1/mcp/servers",
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                servers_count = len(data)
                self.log_test_result(
                    "MCP Servers Listing",
                    True,
                    f"Found {servers_count} servers, Response time: {duration}ms",
                    duration
                )

                # Test MCP tools listing
                start_time = datetime.utcnow()
                response = await self.page.request.get(
                    f"{self.api_base_url}/api/v1/mcp/tools",
                    headers=headers
                )
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status == 200:
                    data = await response.json()
                    tools_count = len(data)
                    self.log_test_result(
                        "MCP Tools Listing",
                        True,
                        f"Found {tools_count} tools, Response time: {duration}ms",
                        duration
                    )
                else:
                    self.log_test_result("MCP Tools Listing", False, f"HTTP {response.status}")

            else:
                self.log_test_result("MCP Servers Listing", False, f"HTTP {response.status}")

            # Test MCP service health
            start_time = datetime.utcnow()
            response = await self.page.request.get(
                f"{self.api_base_url}/api/v1/mcp/health",
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                status = data.get("status")
                self.log_test_result(
                    "MCP Health Check",
                    True,
                    f"Status: {status}, Response time: {duration}ms",
                    duration
                )
            else:
                self.log_test_result("MCP Health Check", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("MCP Integration", False, f"Error: {str(e)}")

    async def test_knowledge_management(self):
        """Test knowledge management and document processing."""
        logger.info("\n📚 Testing Knowledge Management...")

        if not self.test_user_token:
            self.log_test_result("Knowledge Management", False, "No authentication token available")
            return

        try:
            headers = {
                "Authorization": f"Bearer {self.test_user_token}"
            }

            # Test document upload
            start_time = datetime.utcnow()
            test_content = "This is a test document about artificial intelligence and machine learning. It contains information about neural networks, deep learning algorithms, and AI applications in business automation and workflow optimization."

            form_data = {
                "file": ("test_document.txt", test_content, "text/plain"),
                "metadata": (None, json.dumps({"category": "AI/ML", "source": "playwright_test"})),
                "tags": (None, json.dumps(["ai", "machine-learning", "test"]))
            }

            response = await self.page.request.post(
                f"{self.api_base_url}/api/v1/knowledge/documents/upload",
                form=form_data,
                headers={"Authorization": f"Bearer {self.test_user_token}"}
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                document_id = data.get("document_id")
                self.log_test_result(
                    "Document Upload",
                    True,
                    f"Document uploaded: {document_id}, Response time: {duration}ms",
                    duration
                )

                # Wait for processing
                await asyncio.sleep(2)

                # Test document listing
                start_time = datetime.utcnow()
                response = await self.page.request.get(
                    f"{self.api_base_url}/api/v1/knowledge/documents",
                    headers=headers
                )
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status == 200:
                    data = await response.json()
                    docs_count = len(data)
                    self.log_test_result(
                        "Document Listing",
                        True,
                        f"Found {docs_count} documents, Response time: {duration}ms",
                        duration
                    )

                    # Test knowledge search
                    start_time = datetime.utcnow()
                    search_data = {
                        "query": "artificial intelligence machine learning",
                        "max_results": 5,
                        "similarity_threshold": 0.5
                    }

                    response = await self.page.request.post(
                        f"{self.api_base_url}/api/v1/knowledge/search",
                        data=json.dumps(search_data),
                        headers={**headers, "Content-Type": "application/json"}
                    )
                    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                    if response.status == 200:
                        data = await response.json()
                        results_count = len(data.get("results", []))
                        self.log_test_result(
                            "Knowledge Search",
                            True,
                            f"Found {results_count} results, Response time: {duration}ms",
                            duration
                        )
                    else:
                        self.log_test_result("Knowledge Search", False, f"HTTP {response.status}")

                else:
                    self.log_test_result("Document Listing", False, f"HTTP {response.status}")

            else:
                self.log_test_result("Document Upload", False, f"HTTP {response.status}")

            # Test knowledge statistics
            start_time = datetime.utcnow()
            response = await self.page.request.get(
                f"{self.api_base_url}/api/v1/knowledge/stats",
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                total_docs = data.get("documents", {}).get("total", 0)
                self.log_test_result(
                    "Knowledge Statistics",
                    True,
                    f"Total documents: {total_docs}, Response time: {duration}ms",
                    duration
                )
            else:
                self.log_test_result("Knowledge Statistics", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("Knowledge Management", False, f"Error: {str(e)}")

    async def test_conversational_ai(self):
        """Test conversational AI and chat functionality."""
        logger.info("\n🤖 Testing Conversational AI...")

        if not self.test_user_token:
            self.log_test_result("Conversational AI", False, "No authentication token available")
            return

        try:
            headers = {
                "Authorization": f"Bearer {self.test_user_token}",
                "Content-Type": "application/json"
            }

            # Test chat functionality
            start_time = datetime.utcnow()
            chat_data = {
                "message": "Hello! Can you help me create a workflow for automating data processing tasks?",
                "context": {"source": "playwright_test"}
            }

            response = await self.page.request.post(
                f"{self.api_base_url}/api/v1/chat/chat",
                data=json.dumps(chat_data),
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                conversation_id = data.get("conversation_id")
                message_length = len(data.get("message", ""))
                suggestions_count = len(data.get("suggested_actions", []))

                self.log_test_result(
                    "Chat Message",
                    True,
                    f"Response: {message_length} chars, {suggestions_count} suggestions, Response time: {duration}ms",
                    duration
                )

                # Test follow-up message
                start_time = datetime.utcnow()
                followup_data = {
                    "message": "What about integrating with external APIs?",
                    "conversation_id": conversation_id
                }

                response = await self.page.request.post(
                    f"{self.api_base_url}/api/v1/chat/chat",
                    data=json.dumps(followup_data),
                    headers=headers
                )
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                if response.status == 200:
                    data = await response.json()
                    self.log_test_result(
                        "Chat Follow-up",
                        True,
                        f"Follow-up response received, Response time: {duration}ms",
                        duration
                    )

                    # Test conversation history
                    start_time = datetime.utcnow()
                    response = await self.page.request.get(
                        f"{self.api_base_url}/api/v1/chat/conversations/{conversation_id}/messages",
                        headers=headers
                    )
                    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                    if response.status == 200:
                        data = await response.json()
                        messages_count = len(data)
                        self.log_test_result(
                            "Conversation History",
                            True,
                            f"Retrieved {messages_count} messages, Response time: {duration}ms",
                            duration
                        )
                    else:
                        self.log_test_result("Conversation History", False, f"HTTP {response.status}")

                else:
                    self.log_test_result("Chat Follow-up", False, f"HTTP {response.status}")

            else:
                self.log_test_result("Chat Message", False, f"HTTP {response.status}")

            # Test conversation suggestions
            start_time = datetime.utcnow()
            response = await self.page.request.get(
                f"{self.api_base_url}/api/v1/chat/suggestions?query=automation",
                headers=headers
            )
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            if response.status == 200:
                data = await response.json()
                starters_count = len(data.get("starters", []))
                self.log_test_result(
                    "Chat Suggestions",
                    True,
                    f"Retrieved {starters_count} conversation starters, Response time: {duration}ms",
                    duration
                )
            else:
                self.log_test_result("Chat Suggestions", False, f"HTTP {response.status}")

        except Exception as e:
            self.log_test_result("Conversational AI", False, f"Error: {str(e)}")

    async def test_browser_automation(self):
        """Test browser automation capabilities."""
        logger.info("\n🌐 Testing Browser Automation...")

        try:
            # Test basic browser navigation
            start_time = datetime.utcnow()
            await self.page.goto("https://example.com")

            # Wait for page load
            await self.page.wait_for_load_state("networkidle")
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            title = await self.page.title()
            self.log_test_result(
                "Browser Navigation",
                True,
                f"Loaded page: '{title}', Load time: {duration}ms",
                duration
            )

            # Test element interaction
            start_time = datetime.utcnow()
            h1_element = await self.page.query_selector("h1")
            if h1_element:
                text_content = await h1_element.text_content()
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                self.log_test_result(
                    "Element Interaction",
                    True,
                    f"Found H1: '{text_content}', Query time: {duration}ms",
                    duration
                )
            else:
                self.log_test_result("Element Interaction", False, "No H1 element found")

            # Test JavaScript execution
            start_time = datetime.utcnow()
            result = await self.page.evaluate("() => window.location.hostname")
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            self.log_test_result(
                "JavaScript Execution",
                True,
                f"Hostname: {result}, Execution time: {duration}ms",
                duration
            )

            # Test screenshot capability
            start_time = datetime.utcnow()
            screenshot_path = "/tmp/upm_plus_test_screenshot.png"
            await self.page.screenshot(path=screenshot_path)
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Check if screenshot file exists
            if os.path.exists(screenshot_path):
                file_size = os.path.getsize(screenshot_path)
                self.log_test_result(
                    "Screenshot Capture",
                    True,
                    f"Screenshot saved: {file_size} bytes, Capture time: {duration}ms",
                    duration
                )
                # Clean up
                os.remove(screenshot_path)
            else:
                self.log_test_result("Screenshot Capture", False, "Screenshot file not created")

        except Exception as e:
            self.log_test_result("Browser Automation", False, f"Error: {str(e)}")

    async def test_performance_benchmarks(self):
        """Test system performance and load handling."""
        logger.info("\n⚡ Testing Performance Benchmarks...")

        if not self.test_user_token:
            self.log_test_result("Performance Benchmarks", False, "No authentication token available")
            return

        try:
            headers = {
                "Authorization": f"Bearer {self.test_user_token}",
                "Content-Type": "application/json"
            }

            # Test concurrent API requests
            concurrent_requests = 10
            start_time = datetime.utcnow()

            tasks = []
            for i in range(concurrent_requests):
                task = self.page.request.get(
                    f"{self.api_base_url}/api/v1/health/",
                    headers=headers
                )
                tasks.append(task)

            responses = await asyncio.gather(*tasks, return_exceptions=True)
            duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            successful_requests = sum(1 for r in responses if hasattr(r, 'status') and r.status == 200)
            avg_response_time = duration / concurrent_requests

            self.log_test_result(
                "Concurrent Requests",
                successful_requests == concurrent_requests,
                f"{successful_requests}/{concurrent_requests} successful, Avg: {avg_response_time:.1f}ms",
                duration
            )

            # Test API response time consistency
            response_times = []
            for _ in range(5):
                start_time = datetime.utcnow()
                response = await self.page.request.get(f"{self.api_base_url}/api/v1/health/")
                duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                response_times.append(duration)
                await asyncio.sleep(0.1)

            avg_time = sum(response_times) / len(response_times)
            max_time = max(response_times)
            min_time = min(response_times)

            # Performance is good if average response time is under 2 seconds
            performance_good = avg_time < 2000

            self.log_test_result(
                "Response Time Consistency",
                performance_good,
                f"Avg: {avg_time:.1f}ms, Min: {min_time}ms, Max: {max_time}ms",
                int(avg_time)
            )

            # Store performance metrics
            self.test_results["performance_metrics"] = {
                "concurrent_requests_success_rate": successful_requests / concurrent_requests,
                "average_response_time_ms": avg_time,
                "min_response_time_ms": min_time,
                "max_response_time_ms": max_time,
                "response_time_variance": max_time - min_time
            }

        except Exception as e:
            self.log_test_result("Performance Benchmarks", False, f"Error: {str(e)}")

    async def generate_test_report(self):
        """Generate comprehensive test report."""
        logger.info("\n📊 Generating Test Report...")

        report = {
            "test_execution": {
                "timestamp": datetime.utcnow().isoformat(),
                "total_tests": self.test_results["total_tests"],
                "passed_tests": self.test_results["passed_tests"],
                "failed_tests": self.test_results["failed_tests"],
                "success_rate": (self.test_results["passed_tests"] / self.test_results["total_tests"] * 100) if self.test_results["total_tests"] > 0 else 0
            },
            "performance_metrics": self.test_results["performance_metrics"],
            "test_details": self.test_results["test_details"],
            "system_info": {
                "browser": "Chromium",
                "test_environment": "Playwright",
                "api_base_url": self.api_base_url
            }
        }

        # Save report to file
        report_filename = f"upm_plus_test_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w') as f:
            json.dump(report, f, indent=2)

        # Print summary
        print("\n" + "="*80)
        print("🎯 UPM.Plus Comprehensive Test Results")
        print("="*80)
        print(f"📊 Total Tests: {report['test_execution']['total_tests']}")
        print(f"✅ Passed: {report['test_execution']['passed_tests']}")
        print(f"❌ Failed: {report['test_execution']['failed_tests']}")
        print(f"📈 Success Rate: {report['test_execution']['success_rate']:.1f}%")

        if self.test_results["performance_metrics"]:
            print(f"\n⚡ Performance Metrics:")
            metrics = self.test_results["performance_metrics"]
            print(f"   • Average Response Time: {metrics.get('average_response_time_ms', 0):.1f}ms")
            print(f"   • Concurrent Request Success: {metrics.get('concurrent_requests_success_rate', 0)*100:.1f}%")

        print(f"\n📋 Detailed Results:")
        for test in self.test_results["test_details"]:
            print(f"   {test['status']} {test['name']}: {test['details']}")

        print(f"\n📄 Full report saved to: {report_filename}")
        print("="*80)

        return report

    async def run_all_tests(self):
        """Run all test suites."""
        logger.info("🚀 Starting UPM.Plus Comprehensive Test Suite...")

        try:
            await self.setup()

            # Run all test suites
            await self.test_api_endpoints()
            await self.test_user_authentication()
            await self.test_workflow_engine()
            await self.test_mcp_integration()
            await self.test_knowledge_management()
            await self.test_conversational_ai()
            await self.test_browser_automation()
            await self.test_performance_benchmarks()

            # Generate final report
            report = await self.generate_test_report()

            return report

        except Exception as e:
            logger.error(f"Test suite execution failed: {e}")
            raise
        finally:
            await self.teardown()


async def main():
    """Main test execution function."""
    test_suite = UPMPlusTestSuite()

    try:
        # Start the FastAPI server in background if needed
        logger.info("🔧 Starting UPM.Plus server for testing...")

        # Note: In a real scenario, you'd start the server here
        # For this test, we assume the server is already running

        # Run comprehensive tests
        report = await test_suite.run_all_tests()

        # Determine overall success
        success_rate = report["test_execution"]["success_rate"]
        if success_rate >= 80:
            logger.info(f"🎉 TEST SUITE PASSED! Success rate: {success_rate:.1f}%")
            return 0
        else:
            logger.error(f"❌ TEST SUITE FAILED! Success rate: {success_rate:.1f}%")
            return 1

    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
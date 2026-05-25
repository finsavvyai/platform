#!/usr/bin/env python3
"""
Smoke tests for blue-green deployment validation
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional

import aiohttp
import pytest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SmokeTestSuite:
    """Comprehensive smoke test suite for service validation"""

    def __init__(self):
        self.service_name = os.getenv('SERVICE_NAME', 'quantumbeam-api')
        self.service_url = os.getenv('SERVICE_URL', 'http://localhost:8080')
        self.test_suite = os.getenv('TEST_SUITE', 'basic')
        self.timeout = int(os.getenv('TEST_TIMEOUT', '600'))
        self.session = None
        self.test_results = {}

    async def run_all_tests(self) -> Dict:
        """Run all smoke tests and return results"""
        logger.info(f"Starting smoke tests for {self.service_name} at {self.service_url}")

        start_time = time.time()

        try:
            # Create HTTP session
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)

            # Run basic connectivity test first
            await self.test_connectivity()

            # Run service-specific tests based on test suite
            if self.test_suite == 'basic':
                await self.run_basic_tests()
            elif self.test_suite == 'comprehensive':
                await self.run_comprehensive_tests()
            elif self.test_suite == 'api':
                await self.run_api_tests()
            elif self.test_suite == 'fraud-detection':
                await self.run_fraud_detection_tests()

            # Calculate total duration
            duration = time.time() - start_time
            self.test_results['duration'] = duration
            self.test_results['timestamp'] = datetime.utcnow().isoformat()

            # Check if all tests passed
            all_passed = all(
                result.get('status') == 'passed'
                for result in self.test_results.get('tests', {}).values()
            )

            self.test_results['overall_status'] = 'passed' if all_passed else 'failed'

            logger.info(f"Smoke tests completed in {duration:.2f}s. Status: {self.test_results['overall_status']}")

            return self.test_results

        except Exception as e:
            logger.error(f"Smoke test execution failed: {e}")
            return {
                'overall_status': 'failed',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

        finally:
            if self.session:
                await self.session.close()

    async def test_connectivity(self):
        """Test basic connectivity to the service"""
        logger.info("Testing connectivity")

        start_time = time.time()

        try:
            async with self.session.get(f"{self.service_url}/health") as response:
                if response.status == 200:
                    health_data = await response.json()
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['connectivity'] = {
                        'status': 'passed',
                        'duration': duration,
                        'response_time': f"{duration:.3f}s",
                        'health_status': health_data
                    }

                    logger.info(f"Connectivity test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Health check returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['connectivity'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            raise Exception(f"Connectivity test failed: {e}")

    async def run_basic_tests(self):
        """Run basic service tests"""
        logger.info("Running basic tests")

        # Test readiness
        await self.test_readiness()

        # Test basic API endpoints
        await self.test_api_endpoints()

        # Test service info
        await self.test_service_info()

    async def run_comprehensive_tests(self):
        """Run comprehensive test suite"""
        logger.info("Running comprehensive tests")

        # Run all basic tests first
        await self.run_basic_tests()

        # Test authentication flow
        await self.test_authentication()

        # Test database connectivity
        await self.test_database_connectivity()

        # Test external service dependencies
        await self.test_external_dependencies()

        # Test basic business logic
        await self.test_business_logic()

    async def run_api_tests(self):
        """Run API-specific tests"""
        logger.info("Running API tests")

        # Test CRUD operations
        await self.test_crud_operations()

        # Test input validation
        await self.test_input_validation()

        # Test rate limiting
        await self.test_rate_limiting()

        # Test error handling
        await self.test_error_handling()

    async def run_fraud_detection_tests(self):
        """Run fraud detection service-specific tests"""
        logger.info("Running fraud detection tests")

        # Test ML model loading
        await self.test_ml_model_loading()

        # Test fraud detection endpoint
        await self.test_fraud_detection()

        # Test cache connectivity
        await self.test_cache_connectivity()

        # Test quantum processing
        await self.test_quantum_processing()

    async def test_readiness(self):
        """Test service readiness endpoint"""
        logger.info("Testing readiness")

        start_time = time.time()

        try:
            async with self.session.get(f"{self.service_url}/ready") as response:
                if response.status == 200:
                    ready_data = await response.json()
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['readiness'] = {
                        'status': 'passed',
                        'duration': duration,
                        'ready_status': ready_data
                    }

                    logger.info(f"Readiness test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Readiness check returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['readiness'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Readiness test failed: {e}")

    async def test_api_endpoints(self):
        """Test basic API endpoints"""
        logger.info("Testing API endpoints")

        endpoints = [
            {'path': '/health', 'method': 'GET', 'expected_status': 200},
            {'path': '/ready', 'method': 'GET', 'expected_status': 200},
            {'path': '/metrics', 'method': 'GET', 'expected_status': 200},
            {'path': '/info', 'method': 'GET', 'expected_status': 200},
            {'path': '/version', 'method': 'GET', 'expected_status': 200},
        ]

        results = {}

        for endpoint in endpoints:
            start_time = time.time()
            endpoint_name = endpoint['path'].replace('/', '_').strip('_')

            try:
                url = f"{self.service_url}{endpoint['path']}"
                async with self.session.request(endpoint['method'], url) as response:
                    duration = time.time() - start_time

                    if response.status == endpoint['expected_status']:
                        results[endpoint_name] = {
                            'status': 'passed',
                            'duration': duration,
                            'response_status': response.status
                        }
                        logger.info(f"Endpoint {endpoint['path']} test passed in {duration:.3f}s")
                    else:
                        raise Exception(f"Expected status {endpoint['expected_status']}, got {response.status}")

            except Exception as e:
                results[endpoint_name] = {
                    'status': 'failed',
                    'error': str(e),
                    'duration': time.time() - start_time
                }
                logger.warning(f"Endpoint {endpoint['path']} test failed: {e}")

        self.test_results.setdefault('tests', {})['api_endpoints'] = {
            'status': 'passed' if all(r['status'] == 'passed' for r in results.values()) else 'failed',
            'endpoints': results
        }

    async def test_service_info(self):
        """Test service info endpoint"""
        logger.info("Testing service info")

        start_time = time.time()

        try:
            async with self.session.get(f"{self.service_url}/info") as response:
                if response.status == 200:
                    info_data = await response.json()
                    duration = time.time() - start_time

                    # Validate required fields
                    required_fields = ['name', 'version', 'environment']
                    missing_fields = [field for field in required_fields if field not in info_data]

                    if not missing_fields:
                        self.test_results.setdefault('tests', {})['service_info'] = {
                            'status': 'passed',
                            'duration': duration,
                            'service_info': info_data
                        }
                        logger.info(f"Service info test passed in {duration:.3f}s")
                    else:
                        raise Exception(f"Missing required fields: {missing_fields}")

                else:
                    raise Exception(f"Info endpoint returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['service_info'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Service info test failed: {e}")

    async def test_authentication(self):
        """Test authentication flow"""
        logger.info("Testing authentication")

        start_time = time.time()

        try:
            # Test login endpoint
            login_data = {
                'username': 'test_user',
                'password': 'test_password'
            }

            async with self.session.post(
                f"{self.service_url}/auth/login",
                json=login_data
            ) as response:
                if response.status in [200, 401]:  # 401 is also acceptable for invalid credentials
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['authentication'] = {
                        'status': 'passed',
                        'duration': duration,
                        'login_response_status': response.status
                    }
                    logger.info(f"Authentication test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Login endpoint returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['authentication'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Authentication test failed: {e}")

    async def test_database_connectivity(self):
        """Test database connectivity"""
        logger.info("Testing database connectivity")

        start_time = time.time()

        try:
            async with self.session.get(f"{self.service_url}/health/database") as response:
                if response.status == 200:
                    db_data = await response.json()
                    duration = time.time() - start_time

                    if db_data.get('status') == 'healthy':
                        self.test_results.setdefault('tests', {})['database_connectivity'] = {
                            'status': 'passed',
                            'duration': duration,
                            'database_status': db_data
                        }
                        logger.info(f"Database connectivity test passed in {duration:.3f}s")
                    else:
                        raise Exception(f"Database not healthy: {db_data}")

                else:
                    raise Exception(f"Database health check returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['database_connectivity'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Database connectivity test failed: {e}")

    async def test_external_dependencies(self):
        """Test external service dependencies"""
        logger.info("Testing external dependencies")

        dependencies = ['redis', 'cache', 'external-api']
        results = {}

        for dependency in dependencies:
            start_time = time.time()

            try:
                async with self.session.get(f"{self.service_url}/health/{dependency}") as response:
                    if response.status == 200:
                        dep_data = await response.json()
                        duration = time.time() - start_time

                        results[dependency] = {
                            'status': 'passed',
                            'duration': duration,
                            'dependency_status': dep_data
                        }
                        logger.info(f"Dependency {dependency} test passed in {duration:.3f}s")
                    else:
                        raise Exception(f"Dependency health check returned status {response.status}")

            except Exception as e:
                results[dependency] = {
                    'status': 'failed',
                    'error': str(e),
                    'duration': time.time() - start_time
                }
                logger.warning(f"Dependency {dependency} test failed: {e}")

        self.test_results.setdefault('tests', {})['external_dependencies'] = {
            'status': 'passed' if all(r['status'] == 'passed' for r in results.values()) else 'failed',
            'dependencies': results
        }

    async def test_business_logic(self):
        """Test basic business logic"""
        logger.info("Testing business logic")

        start_time = time.time()

        try:
            # Test a simple business operation
            test_data = {
                'transaction_id': 'test_123',
                'amount': 100.0,
                'currency': 'USD'
            }

            async with self.session.post(
                f"{self.service_url}/api/test/business-logic",
                json=test_data
            ) as response:
                if response.status in [200, 201]:
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['business_logic'] = {
                        'status': 'passed',
                        'duration': duration,
                        'response_status': response.status
                    }
                    logger.info(f"Business logic test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Business logic test returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['business_logic'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Business logic test failed: {e}")

    async def test_crud_operations(self):
        """Test CRUD operations"""
        logger.info("Testing CRUD operations")

        start_time = time.time()

        try:
            # Create
            create_data = {'name': 'test_item', 'value': 123}
            async with self.session.post(f"{self.service_url}/api/test/items", json=create_data) as response:
                if response.status == 201:
                    created_item = await response.json()
                    item_id = created_item.get('id')

                    # Read
                    async with self.session.get(f"{self.service_url}/api/test/items/{item_id}") as response:
                        if response.status == 200:
                            # Update
                            update_data = {'name': 'updated_item'}
                            async with self.session.put(
                                f"{self.service_url}/api/test/items/{item_id}",
                                json=update_data
                            ) as response:
                                if response.status == 200:
                                    # Delete
                                    async with self.session.delete(
                                        f"{self.service_url}/api/test/items/{item_id}"
                                    ) as response:
                                        if response.status == 204:
                                            duration = time.time() - start_time

                                            self.test_results.setdefault('tests', {})['crud_operations'] = {
                                                'status': 'passed',
                                                'duration': duration
                                            }
                                            logger.info(f"CRUD operations test passed in {duration:.3f}s")
                                            return

            raise Exception("CRUD operations test failed")

        except Exception as e:
            self.test_results.setdefault('tests', {})['crud_operations'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"CRUD operations test failed: {e}")

    async def test_input_validation(self):
        """Test input validation"""
        logger.info("Testing input validation")

        start_time = time.time()

        try:
            # Test invalid input
            invalid_data = {'invalid_field': 'invalid_value'}

            async with self.session.post(
                f"{self.service_url}/api/test/validate",
                json=invalid_data
            ) as response:
                if response.status == 400:  # Bad Request is expected
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['input_validation'] = {
                        'status': 'passed',
                        'duration': duration,
                        'validation_response_status': response.status
                    }
                    logger.info(f"Input validation test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Expected 400 status, got {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['input_validation'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Input validation test failed: {e}")

    async def test_rate_limiting(self):
        """Test rate limiting"""
        logger.info("Testing rate limiting")

        start_time = time.time()

        try:
            # Make multiple rapid requests
            responses = []
            for _ in range(10):
                async with self.session.get(f"{self.service_url}/api/test/rate-limit") as response:
                    responses.append(response.status)
                    await asyncio.sleep(0.1)

            # Check if any request was rate limited (429)
            rate_limited = any(status == 429 for status in responses)

            duration = time.time() - start_time

            self.test_results.setdefault('tests', {})['rate_limiting'] = {
                'status': 'passed',
                'duration': duration,
                'rate_limited': rate_limited,
                'response_statuses': responses
            }
            logger.info(f"Rate limiting test passed in {duration:.3f}s")

        except Exception as e:
            self.test_results.setdefault('tests', {})['rate_limiting'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Rate limiting test failed: {e}")

    async def test_error_handling(self):
        """Test error handling"""
        logger.info("Testing error handling")

        start_time = time.time()

        try:
            # Test 404 error
            async with self.session.get(f"{self.service_url}/api/nonexistent") as response:
                if response.status == 404:
                    # Test 500 error
                    async with self.session.get(f"{self.service_url}/api/test/error") as response:
                        if response.status in [500, 503]:
                            duration = time.time() - start_time

                            self.test_results.setdefault('tests', {})['error_handling'] = {
                                'status': 'passed',
                                'duration': duration,
                                'error_responses': [404, response.status]
                            }
                            logger.info(f"Error handling test passed in {duration:.3f}s")
                        else:
                            raise Exception(f"Expected error status, got {response.status}")
                else:
                    raise Exception(f"Expected 404 status, got {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['error_handling'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Error handling test failed: {e}")

    async def test_ml_model_loading(self):
        """Test ML model loading"""
        logger.info("Testing ML model loading")

        start_time = time.time()

        try:
            async with self.session.get(f"{self.service_url}/api/models/status") as response:
                if response.status == 200:
                    model_data = await response.json()
                    duration = time.time() - start_time

                    if model_data.get('loaded', False):
                        self.test_results.setdefault('tests', {})['ml_model_loading'] = {
                            'status': 'passed',
                            'duration': duration,
                            'model_status': model_data
                        }
                        logger.info(f"ML model loading test passed in {duration:.3f}s")
                    else:
                        raise Exception("ML models not loaded")

                else:
                    raise Exception(f"Model status endpoint returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['ml_model_loading'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"ML model loading test failed: {e}")

    async def test_fraud_detection(self):
        """Test fraud detection functionality"""
        logger.info("Testing fraud detection")

        start_time = time.time()

        try:
            test_transaction = {
                'transaction_id': 'test_456',
                'amount': 1000.0,
                'currency': 'USD',
                'merchant': 'test_merchant',
                'card_number': '4111111111111111'
            }

            async with self.session.post(
                f"{self.service_url}/api/fraud-detect",
                json=test_transaction
            ) as response:
                if response.status == 200:
                    fraud_result = await response.json()
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['fraud_detection'] = {
                        'status': 'passed',
                        'duration': duration,
                        'fraud_result': fraud_result
                    }
                    logger.info(f"Fraud detection test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Fraud detection endpoint returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['fraud_detection'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Fraud detection test failed: {e}")

    async def test_cache_connectivity(self):
        """Test cache connectivity"""
        logger.info("Testing cache connectivity")

        start_time = time.time()

        try:
            # Test cache set
            cache_data = {'key': 'test_key', 'value': 'test_value'}
            async with self.session.post(
                f"{self.service_url}/api/cache/set",
                json=cache_data
            ) as response:
                if response.status == 200:
                    # Test cache get
                    async with self.session.get(
                        f"{self.service_url}/api/cache/get/test_key"
                    ) as response:
                        if response.status == 200:
                            duration = time.time() - start_time

                            self.test_results.setdefault('tests', {})['cache_connectivity'] = {
                                'status': 'passed',
                                'duration': duration
                            }
                            logger.info(f"Cache connectivity test passed in {duration:.3f}s")
                        else:
                            raise Exception(f"Cache get failed with status {response.status}")
                else:
                    raise Exception(f"Cache set failed with status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['cache_connectivity'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Cache connectivity test failed: {e}")

    async def test_quantum_processing(self):
        """Test quantum processing functionality"""
        logger.info("Testing quantum processing")

        start_time = time.time()

        try:
            quantum_data = {
                'algorithm': 'grover',
                'data': [1, 2, 3, 4, 5],
                'iterations': 10
            }

            async with self.session.post(
                f"{self.service_url}/api/quantum/process",
                json=quantum_data
            ) as response:
                if response.status == 200:
                    quantum_result = await response.json()
                    duration = time.time() - start_time

                    self.test_results.setdefault('tests', {})['quantum_processing'] = {
                        'status': 'passed',
                        'duration': duration,
                        'quantum_result': quantum_result
                    }
                    logger.info(f"Quantum processing test passed in {duration:.3f}s")
                else:
                    raise Exception(f"Quantum processing endpoint returned status {response.status}")

        except Exception as e:
            self.test_results.setdefault('tests', {})['quantum_processing'] = {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
            logger.warning(f"Quantum processing test failed: {e}")


async def main():
    """Main function to run smoke tests"""
    suite = SmokeTestSuite()

    try:
        results = await suite.run_all_tests()

        # Print results
        print(json.dumps(results, indent=2))

        # Exit with appropriate code
        if results.get('overall_status') == 'passed':
            sys.exit(0)
        else:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Smoke test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
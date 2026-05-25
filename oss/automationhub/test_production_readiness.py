#!/usr/bin/env python3
"""
Production Readiness Test Suite
Tests all critical production components
"""

import sys
from pathlib import Path
import asyncio
import pytest
import time
import json
from fastapi.testclient import TestClient

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

class ProductionReadinessTest:
    """Comprehensive production readiness test suite"""
    
    def __init__(self):
        self.results = {
            "database": False,
            "api_endpoints": False,
            "authentication": False,
            "agent_system": False,
            "error_handling": False,
            "logging": False,
            "security": False,
            "performance": False
        }
        self.client = None
        self.app = None
    
    async def setup(self):
        """Setup test environment"""
        try:
            from app.main import app
            from app.core.database import create_tables, drop_tables
            
            self.app = app
            self.client = TestClient(app)
            
            # Clean and recreate database
            await drop_tables()
            await create_tables()
            
            print("✅ Test environment setup complete")
            return True
        except Exception as e:
            print(f"❌ Test environment setup failed: {e}")
            return False
    
    def test_database_functionality(self):
        """Test database operations"""
        try:
            # Test database connection and basic operations
            response = self.client.get("/health", headers={"Host": "testserver"})
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get("database") == "connected":
                    self.results["database"] = True
                    print("✅ Database functionality: PASS")
                    return True
            
            print(f"❌ Database functionality: FAIL - Status: {response.status_code}")
            if response.status_code == 400:
                try:
                    print(f"   Error: {response.json()}")
                except:
                    print(f"   Error: {response.text}")
            return False
        except Exception as e:
            print(f"❌ Database functionality failed: {e}")
            return False
    
    def test_api_endpoints(self):
        """Test critical API endpoints"""
        try:
            endpoints_to_test = [
                ("/health", 200),
                ("/api/v1/agents", 200),
                ("/api/v1/tasks", 200),
                ("/api/v1/workflows", 200),
                ("/docs", 200),
            ]
            
            passed = 0
            for endpoint, expected_status in endpoints_to_test:
                try:
                    response = self.client.get(endpoint, headers={"Host": "testserver"})
                    if response.status_code == expected_status:
                        passed += 1
                        print(f"  ✅ {endpoint}: {response.status_code}")
                    else:
                        print(f"  ❌ {endpoint}: {response.status_code} (expected {expected_status})")
                except Exception as e:
                    print(f"  ❌ {endpoint}: Exception - {e}")
            
            if passed >= len(endpoints_to_test) * 0.8:  # 80% pass rate
                self.results["api_endpoints"] = True
                print("✅ API endpoints: PASS")
                return True
            else:
                print("❌ API endpoints: FAIL")
                return False
                
        except Exception as e:
            print(f"❌ API endpoints test failed: {e}")
            return False
    
    def test_authentication(self):
        """Test authentication system"""
        try:
            # Test user registration
            user_data = {
                "email": "test@example.com",
                "password": "testpassword123",
                "full_name": "Test User"
            }
            
            response = self.client.post(
                "/api/v1/auth/register",
                json=user_data,
                headers={"Host": "testserver"}
            )
            
            if response.status_code in [200, 201]:
                print("  ✅ User registration working")
                
                # Test login
                login_data = {
                    "username": user_data["email"],
                    "password": user_data["password"]
                }
                
                response = self.client.post(
                    "/api/v1/auth/login",
                    data=login_data,
                    headers={"Host": "testserver"}
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    if "access_token" in token_data:
                        self.results["authentication"] = True
                        print("✅ Authentication: PASS")
                        return True
            
            print("❌ Authentication: FAIL")
            return False
            
        except Exception as e:
            print(f"❌ Authentication test failed: {e}")
            return False
    
    def test_agent_system(self):
        """Test agent system functionality"""
        try:
            # Test agent listing
            response = self.client.get("/api/v1/agents", headers={"Host": "testserver"})
            if response.status_code == 200:
                agents = response.json()
                if isinstance(agents, list) and len(agents) > 0:
                    print(f"  ✅ Found {len(agents)} agents")
                    
                    # Test agent health
                    response = self.client.get("/api/v1/agents/health", headers={"Host": "testserver"})
                    if response.status_code == 200:
                        self.results["agent_system"] = True
                        print("✅ Agent system: PASS")
                        return True
            
            print("❌ Agent system: FAIL")
            return False
            
        except Exception as e:
            print(f"❌ Agent system test failed: {e}")
            return False
    
    def test_error_handling(self):
        """Test error handling"""
        try:
            # Test 404 handling
            response = self.client.get("/nonexistent", headers={"Host": "testserver"})
            if response.status_code == 404:
                print("  ✅ 404 handling working")
                
                # Test invalid JSON handling
                response = self.client.post(
                    "/api/v1/tasks",
                    data="invalid json",
                    headers={"Host": "testserver", "Content-Type": "application/json"}
                )
                
                if response.status_code in [400, 422]:
                    self.results["error_handling"] = True
                    print("✅ Error handling: PASS")
                    return True
            
            print("❌ Error handling: FAIL")
            return False
            
        except Exception as e:
            print(f"❌ Error handling test failed: {e}")
            return False
    
    def test_logging(self):
        """Test logging system"""
        try:
            # Check if logging is configured
            import logging
            logger = logging.getLogger("app")
            
            if logger.handlers and logger.level != logging.NOTSET:
                self.results["logging"] = True
                print("✅ Logging: PASS")
                return True
            
            print("❌ Logging: FAIL")
            return False
            
        except Exception as e:
            print(f"❌ Logging test failed: {e}")
            return False
    
    def test_security(self):
        """Test security features"""
        try:
            # Test CORS headers
            response = self.client.options("/api/v1/agents", headers={"Host": "testserver"})
            
            # Test security headers
            response = self.client.get("/health", headers={"Host": "testserver"})
            headers = response.headers
            
            security_checks = 0
            if "x-content-type-options" in headers:
                security_checks += 1
            if "x-frame-options" in headers:
                security_checks += 1
            
            if security_checks >= 1:  # At least some security headers
                self.results["security"] = True
                print("✅ Security: PASS")
                return True
            
            print("❌ Security: FAIL")
            return False
            
        except Exception as e:
            print(f"❌ Security test failed: {e}")
            return False
    
    def test_performance(self):
        """Test basic performance"""
        try:
            # Test response times
            start_time = time.time()
            response = self.client.get("/health", headers={"Host": "testserver"})
            response_time = time.time() - start_time
            
            if response.status_code == 200 and response_time < 1.0:  # Under 1 second
                self.results["performance"] = True
                print(f"✅ Performance: PASS (response time: {response_time:.3f}s)")
                return True
            
            print(f"❌ Performance: FAIL (response time: {response_time:.3f}s)")
            return False
            
        except Exception as e:
            print(f"❌ Performance test failed: {e}")
            return False
    
    def generate_report(self):
        """Generate production readiness report"""
        passed = sum(self.results.values())
        total = len(self.results)
        percentage = (passed / total) * 100
        
        print("\n" + "="*60)
        print("🏭 PRODUCTION READINESS REPORT")
        print("="*60)
        
        for test_name, result in self.results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title():<25} {status}")
        
        print("-"*60)
        print(f"Overall Score: {passed}/{total} ({percentage:.1f}%)")
        
        if percentage >= 80:
            print("🎉 PRODUCTION READY!")
        elif percentage >= 60:
            print("⚠️  NEEDS IMPROVEMENT")
        else:
            print("❌ NOT PRODUCTION READY")
        
        print("="*60)
        
        return percentage >= 80

async def main():
    """Run production readiness tests"""
    print("🧪 Starting Production Readiness Test Suite...")
    print("="*60)
    
    test_suite = ProductionReadinessTest()
    
    # Setup
    if not await test_suite.setup():
        print("❌ Setup failed, cannot continue")
        return False
    
    # Run all tests
    tests = [
        test_suite.test_database_functionality,
        test_suite.test_api_endpoints,
        test_suite.test_authentication,
        test_suite.test_agent_system,
        test_suite.test_error_handling,
        test_suite.test_logging,
        test_suite.test_security,
        test_suite.test_performance,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
    
    # Generate report
    return test_suite.generate_report()

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)

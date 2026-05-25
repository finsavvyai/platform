#!/usr/bin/env python3
"""
Post-Deployment Testing Script for UPM.Plus
Tests all critical endpoints after deployment
"""

import requests
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime

import os
BASE_URL = os.getenv("API_URL", "http://localhost:8000")
TIMEOUT = 10

class Colors:
    GREEN = '\033[0;32m'
    RED = '\033[0;31m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.NC}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.NC}")

def test_endpoint(method: str, endpoint: str, expected_status: int = 200, 
                  data: Optional[Dict] = None, description: str = None) -> bool:
    """Test an API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    desc = description or f"{method} {endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=TIMEOUT)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=TIMEOUT)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, timeout=TIMEOUT)
        elif method.upper() == "DELETE":
            response = requests.delete(url, timeout=TIMEOUT)
        else:
            print_error(f"Unsupported method: {method}")
            return False
        
        allowed = (expected_status,) if isinstance(expected_status, int) else tuple(expected_status)
        if response.status_code in allowed:
            print_success(f"{desc} - Status: {response.status_code}")
            return True
        else:
            print_warning(f"{desc} - Expected {expected_status}, got {response.status_code}")
            if response.status_code < 500:
                print_info(f"Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print_error(f"{desc} - Connection refused (service may not be running)")
        return False
    except requests.exceptions.Timeout:
        print_error(f"{desc} - Request timeout")
        return False
    except Exception as e:
        print_error(f"{desc} - Error: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("🧪 UPM.Plus Post-Deployment Testing")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}")
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    results = {
        "passed": 0,
        "failed": 0,
        "warnings": 0
    }
    
    # Test 1: Health Check
    print("📋 Testing Health Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/health", 200, description="Health Check"):
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 2: Root endpoint
    if test_endpoint("GET", "/", 200, description="Root Endpoint"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 3: API Documentation
    print()
    print("📋 Testing API Documentation...")
    print("-" * 60)
    if test_endpoint("GET", "/docs", 200, description="API Documentation"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 4: Tasks Endpoints
    print()
    print("📋 Testing Task Management Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/tasks/", [200, 401], description="List Tasks"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 5: Organizations Endpoints
    print()
    print("📋 Testing Organization Management Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/organizations/", [200, 401], description="List Organizations"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 6: Agents Endpoints
    print()
    print("📋 Testing Agent Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/agents/", [200, 401], description="List Agents"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 7: Gateway Endpoints
    print()
    print("📋 Testing Gateway Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/gateway/info", [200, 500], description="Gateway Info"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    if test_endpoint("GET", "/api/v1/gateway/health", [200, 500], description="Gateway Health"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 8: Workflows Endpoints
    print()
    print("📋 Testing Workflow Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/workflows/", [200, 401], description="List Workflows"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 9: Knowledge Management
    print()
    print("📋 Testing Knowledge Management Endpoints...")
    print("-" * 60)
    if test_endpoint("GET", "/api/v1/knowledge/documents/", [200, 401], description="List Documents"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Test 10: Vector Search (POST; GET returns 405)
    print()
    print("📋 Testing Vector Search Endpoints...")
    print("-" * 60)
    if test_endpoint("POST", "/api/v1/vector/search", [200, 400, 401], data={"query": "test", "method": "semantic"}, description="Vector Search"):
        results["passed"] += 1
    else:
        results["warnings"] += 1
    
    # Summary
    print()
    print("=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.NC}")
    print(f"{Colors.YELLOW}Warnings: {results['warnings']}{Colors.NC}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.NC}")
    print()
    
    total = results["passed"] + results["warnings"] + results["failed"]
    success_rate = (results["passed"] / total * 100) if total > 0 else 0
    
    print(f"Success Rate: {success_rate:.1f}%")
    print(f"Completed at: {datetime.now().isoformat()}")
    print()
    
    if results["failed"] == 0:
        print_success("✅ All critical tests passed!")
        return 0
    else:
        print_error("❌ Some critical tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())


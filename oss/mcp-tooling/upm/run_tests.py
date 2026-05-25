#!/usr/bin/env python3
"""
Test runner for the Universal Dependency Platform.

Runs unit tests, functional tests, and performance tests with proper
configuration and reporting.
"""

import os
import sys
import subprocess
import argparse
import time
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

def run_command(command, description):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    end_time = time.time()
    
    print(f"Exit code: {result.returncode}")
    print(f"Duration: {end_time - start_time:.2f} seconds")
    
    if result.stdout:
        print("\nSTDOUT:")
        print(result.stdout)
    
    if result.stderr:
        print("\nSTDERR:")
        print(result.stderr)
    
    return result.returncode == 0

def run_unit_tests():
    """Run unit tests."""
    command = "python -m pytest tests/unit/ -v --tb=short --durations=10"
    return run_command(command, "Unit Tests")

def run_functional_tests():
    """Run functional tests."""
    command = "python -m pytest tests/functional/ -v --tb=short --durations=10"
    return run_command(command, "Functional Tests")

def run_performance_tests():
    """Run performance tests."""
    command = "python -m pytest tests/performance/ -v --tb=short --durations=10 -m performance"
    return run_command(command, "Performance Tests")

def run_all_tests():
    """Run all tests."""
    command = "python -m pytest tests/ -v --tb=short --durations=10"
    return run_command(command, "All Tests")

def run_coverage_tests():
    """Run tests with coverage."""
    command = "python -m pytest tests/ --cov=src/udp --cov-report=html --cov-report=term-missing -v"
    return run_command(command, "Tests with Coverage")

def run_specific_test(test_path):
    """Run a specific test."""
    command = f"python -m pytest {test_path} -v --tb=short"
    return run_command(command, f"Specific Test: {test_path}")

def run_tests_by_marker(marker):
    """Run tests by marker."""
    command = f"python -m pytest tests/ -m {marker} -v --tb=short"
    return run_command(command, f"Tests with marker: {marker}")

def check_dependencies():
    """Check if required dependencies are installed."""
    required_packages = [
        "pytest",
        "pytest_asyncio",
        "pytest_cov",
        "httpx",
        "fastapi",
        "numpy",
        "sklearn",
        "psutil"
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"Missing required packages: {', '.join(missing_packages)}")
        print("Please install them using: pip install " + " ".join(missing_packages))
        return False
    
    return True

def main():
    """Main test runner function."""
    parser = argparse.ArgumentParser(description="Run tests for the Universal Dependency Platform")
    parser.add_argument("--unit", action="store_true", help="Run unit tests")
    parser.add_argument("--functional", action="store_true", help="Run functional tests")
    parser.add_argument("--performance", action="store_true", help="Run performance tests")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    parser.add_argument("--coverage", action="store_true", help="Run tests with coverage")
    parser.add_argument("--test", type=str, help="Run a specific test file or test")
    parser.add_argument("--marker", type=str, help="Run tests with specific marker")
    parser.add_argument("--check-deps", action="store_true", help="Check dependencies")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Check dependencies if requested
    if args.check_deps:
        if not check_dependencies():
            sys.exit(1)
        print("All dependencies are installed!")
        return
    
    # Set environment variables
    os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
    os.environ["PYTHONPATH"] = str(Path(__file__).parent / "src")
    
    # Run tests based on arguments
    success = True
    
    if args.unit:
        success &= run_unit_tests()
    elif args.functional:
        success &= run_functional_tests()
    elif args.performance:
        success &= run_performance_tests()
    elif args.all:
        success &= run_all_tests()
    elif args.coverage:
        success &= run_coverage_tests()
    elif args.test:
        success &= run_specific_test(args.test)
    elif args.marker:
        success &= run_tests_by_marker(args.marker)
    else:
        # Default: run all tests
        success &= run_all_tests()
    
    # Print summary
    print(f"\n{'='*60}")
    if success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed!")
    print(f"{'='*60}")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
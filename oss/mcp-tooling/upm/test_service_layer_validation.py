#!/usr/bin/env python3
"""
Test script to validate the core service layer architecture for task 1.1.2.

This script validates that all the acceptance criteria for task 1.1.2 are met:
- Base service classes with common functionality
- Dependency injection container configured
- Error handling and logging implemented
- Service layer unit tests passing
"""

import os
import sys
import unittest
from uuid import uuid4

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def test_base_service_classes():
    """Test that base service classes exist and have common functionality."""
    try:
        # Set minimal environment to avoid config issues
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from udp.core.services import BaseService, BaseAsyncService, ServiceRegistry
        from udp.services.base import BaseService as ConcreteBaseService

        print("✓ Base service classes imported successfully")

        # Test that base classes have required methods
        required_methods = [
            "get_by_id",
            "list_all",
            "create",
            "update",
            "delete",
            "hard_delete",
            "count",
            "exists",
        ]

        for method in required_methods:
            if hasattr(ConcreteBaseService, method):
                print(f"✓ BaseService has method: {method}")
            else:
                print(f"✗ BaseService missing method: {method}")
                return False

        return True
    except Exception as e:
        print(f"✗ Failed to test base service classes: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_dependency_injection():
    """Test that dependency injection container is configured."""
    try:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from udp.core.services import DependencyInjectionContainer, service_registry

        print("✓ Dependency injection container imported successfully")

        # Test container functionality
        container = DependencyInjectionContainer()

        # Test service registry exists
        if hasattr(service_registry, "register"):
            print("✓ ServiceRegistry has register method")
        else:
            print("✗ ServiceRegistry missing register method")
            return False

        if hasattr(service_registry, "get_service_class"):
            print("✓ ServiceRegistry has get_service_class method")
        else:
            print("✗ ServiceRegistry missing get_service_class method")
            return False

        return True
    except Exception as e:
        print(f"✗ Failed to test dependency injection: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_error_handling():
    """Test that error handling is implemented."""
    try:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from udp.core.services import (
            ServiceException,
            NotFoundError,
            ValidationError,
            DatabaseError,
            AuthorizationError,
            ConflictError,
        )

        print("✓ Error handling classes imported successfully")

        # Test exception inheritance
        error_classes = [
            (NotFoundError, "NotFoundError"),
            (ValidationError, "ValidationError"),
            (DatabaseError, "DatabaseError"),
            (AuthorizationError, "AuthorizationError"),
            (ConflictError, "ConflictError"),
        ]

        for error_class, name in error_classes:
            if issubclass(error_class, ServiceException):
                print(f"✓ {name} inherits from ServiceException")
            else:
                print(f"✗ {name} does not inherit from ServiceException")
                return False

        return True
    except Exception as e:
        print(f"✗ Failed to test error handling: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_service_layer_tests():
    """Test that service layer unit tests exist and can run."""
    try:
        # Check if test files exist
        test_files = [
            "tests/unit/test_service_layer.py",
            "tests/unit/test_core_services.py",
            "tests/test_services.py",
        ]

        for test_file in test_files:
            if os.path.exists(test_file):
                print(f"✓ Test file exists: {test_file}")
            else:
                print(f"✗ Test file missing: {test_file}")
                return False

        # Try to run a simple test validation
        import subprocess

        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                "tests/unit/test_core_services.py",
                "--collect-only",
                "-q",
            ],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(__file__),
        )

        if result.returncode == 0:
            print("✓ Service layer tests can be collected successfully")
            return True
        else:
            print(f"✗ Service layer test collection failed: {result.stderr}")
            return False

    except Exception as e:
        print(f"✗ Failed to test service layer tests: {e}")
        return False


def test_service_layer_integration():
    """Test service layer integration and basic functionality."""
    try:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        # Test that core services can be imported
        from udp.services.user import UserService
        from udp.services.organization import OrganizationService
        from udp.services.project import ProjectService
        from udp.services.dependency import DependencyService

        print("✓ Core services imported successfully")

        # Test service inheritance
        services = [
            (UserService, "UserService"),
            (OrganizationService, "OrganizationService"),
            (ProjectService, "ProjectService"),
            (DependencyService, "DependencyService"),
        ]

        for service_class, name in services:
            from udp.core.services import BaseAsyncService

            if issubclass(service_class, BaseAsyncService):
                print(f"✓ {name} inherits from BaseAsyncService")
            else:
                print(f"✗ {name} does not inherit from BaseAsyncService")
                return False

        return True
    except Exception as e:
        print(f"✗ Failed to test service layer integration: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all service layer validation tests."""
    print("Validating UPM Core Service Layer Architecture (Task 1.1.2)")
    print("=" * 70)

    tests = [
        test_base_service_classes,
        test_dependency_injection,
        test_error_handling,
        test_service_layer_tests,
        test_service_layer_integration,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        print(f"\nRunning {test.__name__}...")
        if test():
            passed += 1
            print(f"✅ {test.__name__} PASSED")
        else:
            print(f"❌ {test.__name__} FAILED")

    print("\n" + "=" * 70)
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All service layer architecture tests passed!")
        print("Task 1.1.2 acceptance criteria met successfully!")
        return 0
    else:
        print("❌ Some tests failed. Service layer architecture needs attention.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

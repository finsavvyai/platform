#!/usr/bin/env python3
"""
Test script for database schema validation.

This script tests that all database models can be created
and that the basic relationships work correctly.
"""

import os
import sys
import unittest
from uuid import uuid4
from datetime import datetime

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))


def test_models_import():
    """Test that all models can be imported successfully."""
    try:
        # Set minimal environment to avoid config issues
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from udp.core.models.base import Base, BaseModel

        # Then import models individually to isolate issues
        from udp.core.models.user import User
        from udp.core.models.project import Project
        from udp.core.models.package import Package, PackageVersion

        print("✓ Core models imported successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to import models: {e}")
        return False


def test_table_creation():
    """Test that all tables can be created successfully."""
    try:
        # Set minimal environment to avoid config issues
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from sqlalchemy import create_engine
        from udp.core.models.base import Base

        # Use in-memory SQLite for testing
        engine = create_engine("sqlite:///:memory:", echo=False)

        # Create all tables
        Base.metadata.create_all(engine)

        print("✓ All database tables created successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to create tables: {e}")
        return False


def test_model_relationships():
    """Test basic model relationships."""
    try:
        # Set minimal environment to avoid config issues
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from uuid import uuid4

        from udp.core.models.base import Base, BaseModel
        from udp.core.models.user import User
        from udp.core.models.project import Project

        # Use in-memory SQLite for testing
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine)

        Session = sessionmaker(bind=engine)
        session = Session()

        # Create test user
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            full_name="Test User",
        )
        session.add(user)
        session.commit()

        # Create test organization
        org = Organization(
            name="Test Organization", slug="test-org", created_by=user.id
        )
        session.add(org)
        session.commit()

        # Create test project
        project = Project(
            name="Test Project", slug="test-project", organization_id=org.id
        )
        session.add(project)
        session.commit()

        # Test relationships
        assert project.organization_id == org.id
        assert org.created_by == user.id

        print("✓ Model relationships working correctly")
        session.close()
        return True
    except Exception as e:
        print(f"✗ Failed to test model relationships: {e}")
        return False


def main():
    """Run all database schema tests."""
    print("Testing UPM Database Schema")
    print("=" * 40)

    tests = [
        test_models_import,
        test_table_creation,
        test_model_relationships,
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All database schema tests passed!")
        return 0
    else:
        print("❌ Some tests failed. Check the database schema implementation.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

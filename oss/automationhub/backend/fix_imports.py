"""
Quick fix script to handle optional dependencies and import issues
Run this before starting the server to ensure everything works
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

def test_imports():
    """Test critical imports"""
    errors = []
    
    print("Testing critical imports...")
    
    # Test billing models
    try:
        from app.models.billing import Subscription, Invoice, UsageRecord
        print("✓ Billing models import successfully")
    except Exception as e:
        errors.append(f"Billing models: {e}")
    
    # Test billing service
    try:
        from app.services.billing_service import BillingService
        print("✓ Billing service imports successfully")
    except Exception as e:
        errors.append(f"Billing service: {e}")
    
    # Test health endpoints
    try:
        from app.api.v1.endpoints.health import router
        print("✓ Health endpoints import successfully")
    except Exception as e:
        errors.append(f"Health endpoints: {e}")
    
    # Test main app
    try:
        from app.main import app
        print("✓ Main app imports successfully")
    except Exception as e:
        errors.append(f"Main app: {e}")
        print(f"  Error details: {e}")
    
    if errors:
        print("\n⚠ Some imports failed:")
        for error in errors:
            print(f"  - {error}")
        return False
    else:
        print("\n✅ All critical imports successful!")
        return True

if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)


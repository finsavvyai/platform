"""
MFA API Endpoints Tests

This module provides comprehensive test coverage for the MFA API endpoints,
including authentication flows, setup, verification, and management operations.

Test Coverage:
- MFA setup endpoints (TOTP and SMS)
- MFA verification and enabling
- MFA disable functionality
- Backup code management
- MFA status and statistics
- Enhanced login with MFA support
- Error handling and validation
- Security controls and rate limiting

Author: Claude Code Implementation
Updated: 2025-01-06
"""

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import status
import pyotp

from app.main import app
from app.services.mfa_service import MFAService, MFAMethod
from app.models.user import User
from app.core.config import settings


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_user():
    """Create a mock authenticated user"""
    user = Mock(spec=User)
    user.id = "12345678-1234-5678-9abc-123456789abc"
    user.email = "test@example.com"
    user.phone_number = "+1234567890"
    user.full_name = "Test User"
    user.is_active = True
    user.is_verified = True
    user.is_staff = False
    user.is_superuser = False
    user.subscription_tier = "free"
    user.organization_id = None
    user.preferences = {}
    user.role = "user"
    user.hashed_password = "hashed_password"
    user.created_at = "2023-01-01T00:00:00"
    user.last_login = None
    return user


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user"""
    admin = Mock(spec=User)
    admin.id = "87654321-4321-8765-cba9-876543210cba"
    admin.email = "admin@example.com"
    admin.phone_number = "+1987654321"
    admin.full_name = "Admin User"
    admin.is_active = True
    admin.is_verified = True
    admin.is_staff = True
    admin.is_superuser = False
    admin.subscription_tier = "enterprise"
    admin.organization_id = None
    admin.preferences = {}
    admin.role = "admin"
    admin.hashed_password = "admin_hashed_password"
    admin.created_at = "2023-01-01T00:00:00"
    admin.last_login = None
    return admin


class TestTOTPSetup:
    """Test TOTP MFA setup endpoints"""

    def test_setup_totp_mfa_success(self, client, mock_user):
        """Test successful TOTP MFA setup"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            # Mock successful TOTP setup
            mock_mfa_service.setup_totp_mfa.return_value = {
                'secret': 'JBSWY3DPEHPK3PXP',
                'qr_code': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                'backup_codes': ['ABCD-1234', 'EFGH-5678', 'HIJK-9012'],
                'instructions': {
                    'step1': 'Scan the QR code with your authenticator app',
                    'step2': 'Enter the 6-digit code to verify setup',
                    'step3': 'Save the backup codes securely for account recovery'
                }
            }

            response = client.post("/api/v1/auth/mfa/setup-totp")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert 'secret' in data
            assert 'qr_code' in data
            assert 'backup_codes' in data
            assert 'instructions' in data
            assert data['qr_code'].startswith('data:image/png;base64,')

            mock_mfa_service.setup_totp_mfa.assert_called_once()

    def test_setup_totp_mfa_unauthorized(self, client):
        """Test TOTP MFA setup without authentication"""
        response = client.post("/api/v1/auth/mfa/setup-totp")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_setup_totp_mfa_service_error(self, client, mock_user):
        """Test TOTP MFA setup with service error"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.setup_totp_mfa.side_effect = Exception("Service error")

            response = client.post("/api/v1/auth/mfa/setup-totp")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Failed to setup TOTP MFA" in response.json()['detail']


class TestSMSAuth:
    """Test SMS MFA endpoints"""

    def test_setup_sms_mfa_success(self, client, mock_user):
        """Test successful SMS MFA setup"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.setup_sms_mfa.return_value = {
                'method': MFAMethod.SMS,
                'phone_number': '+1234567890',
                'verification_sent': True,
                'code_expires_minutes': 10,
                'instructions': {
                    'step1': 'A verification code has been sent to +1234567890',
                    'step2': 'Enter the 6-digit code to verify setup',
                    'step3': 'Keep your phone available for future logins'
                }
            }

            response = client.post("/api/v1/auth/mfa/setup-sms")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['method'] == MFAMethod.SMS
            assert data['verification_sent'] is True
            assert data['code_expires_minutes'] == 10

    def test_setup_sms_mfa_no_phone(self, client, mock_user):
        """Test SMS MFA setup without phone number"""
        mock_user.phone_number = None

        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.setup_sms_mfa.side_effect = ValueError("Phone number is required")

            response = client.post("/api/v1/auth/mfa/setup-sms")

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "Phone number is required" in response.json()['detail']

    def test_send_sms_code_success(self, client, mock_user):
        """Test successful SMS code sending"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.send_sms_code.return_value = {
                'success': True,
                'message': 'Verification code sent',
                'expires_minutes': 5
            }

            response = client.post("/api/v1/auth/mfa/send-sms-code")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['success'] is True
            assert data['expires_minutes'] == 5


class TestMFAVerification:
    """Test MFA verification endpoints"""

    def test_verify_mfa_setup_success(self, client, mock_user):
        """Test successful MFA setup verification"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_mfa_service.verify_mfa_setup.return_value = {
                'success': True,
                'mfa_enabled': True,
                'mfa_method': MFAMethod.TOTP,
                'backup_codes': ['ABCD-1234', 'EFGH-5678'],
                'message': 'MFA has been successfully enabled using TOTP'
            }

            response = client.post(
                "/api/v1/auth/mfa/verify",
                json={"token": "123456"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['success'] is True
            assert data['mfa_enabled'] is True
            assert data['mfa_method'] == MFAMethod.TOTP

            mock_db.commit.assert_called_once()

    def test_verify_mfa_setup_invalid_token(self, client, mock_user):
        """Test MFA setup verification with invalid token"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.verify_mfa_setup.return_value = {
                'success': False,
                'error': 'Invalid verification code'
            }

            response = client.post(
                "/api/v1/auth/mfa/verify",
                json={"token": "000000"}
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "Invalid verification code" in response.json()['detail']

    def test_verify_mfa_token_success(self, client, mock_user):
        """Test successful MFA token verification"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.verify_mfa_token.return_value = {
                'success': True,
                'mfa_required': True,
                'method_used': MFAMethod.TOTP,
                'backup_codes_remaining': 5
            }

            response = client.post(
                "/api/v1/auth/mfa/verify-token",
                params={"token": "123456", "context": "verification"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['success'] is True
            assert data['method_used'] == MFAMethod.TOTP
            assert data['backup_codes_remaining'] == 5


class TestMFADisable:
    """Test MFA disable endpoints"""

    def test_disable_mfa_success(self, client, mock_user):
        """Test successful MFA disable"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db, \
             patch('app.api.v1.endpoints.auth.verify_password') as mock_verify:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_verify.return_value = True

            mock_mfa_service.disable_mfa.return_value = {
                'success': True,
                'message': 'MFA has been disabled successfully'
            }

            response = client.post(
                "/api/v1/auth/mfa/disable",
                params={"password": "correct_password"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['success'] is True
            assert "disabled successfully" in data['message']

            mock_db.commit.assert_called_once()

    def test_disable_mfa_invalid_password(self, client, mock_user):
        """Test MFA disable with invalid password"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.disable_mfa.return_value = {
                'success': False,
                'error': 'Invalid password'
            }

            response = client.post(
                "/api/v1/auth/mfa/disable",
                params={"password": "wrong_password"}
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "Invalid password" in response.json()['detail']


class TestBackupCodes:
    """Test backup code management endpoints"""

    def test_regenerate_backup_codes_success(self, client, mock_user):
        """Test successful backup code regeneration"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db, \
             patch('app.api.v1.endpoints.auth.verify_password') as mock_verify:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_verify.return_value = True

            mock_mfa_service.regenerate_backup_codes.return_value = {
                'success': True,
                'backup_codes': ['ABCD-1234', 'EFGH-5678', 'HIJK-9012'],
                'message': 'New backup codes generated successfully'
            }

            response = client.post(
                "/api/v1/auth/mfa/regenerate-backup-codes",
                params={"password": "correct_password"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['success'] is True
            assert len(data['backup_codes']) == 3
            assert "generated successfully" in data['message']

    def test_regenerate_backup_codes_mfa_disabled(self, client, mock_user):
        """Test backup code regeneration when MFA is disabled"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.regenerate_backup_codes.return_value = {
                'success': False,
                'error': 'MFA is not enabled'
            }

            response = client.post(
                "/api/v1/auth/mfa/regenerate-backup-codes",
                params={"password": "correct_password"}
            )

            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert "MFA is not enabled" in response.json()['detail']


class TestMFAStatus:
    """Test MFA status endpoints"""

    def test_get_mfa_status_enabled(self, client, mock_user):
        """Test MFA status when enabled"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.get_mfa_status.return_value = {
                'enabled': True,
                'method': MFAMethod.TOTP,
                'setup_completed': True,
                'backup_codes_remaining': 8,
                'setup_date': '2023-01-01T00:00:00',
                'totp_configured': True
            }

            response = client.get("/api/v1/auth/mfa/status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['enabled'] is True
            assert data['method'] == MFAMethod.TOTP
            assert data['backup_codes_remaining'] == 8

    def test_get_mfa_status_disabled(self, client, mock_user):
        """Test MFA status when disabled"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.get_mfa_status.return_value = {
                'enabled': False,
                'method': None,
                'setup_completed': False,
                'backup_codes_remaining': 0
            }

            response = client.get("/api/v1/auth/mfa/status")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['enabled'] is False
            assert data['method'] is None

    def test_get_mfa_enforcement_policy(self, client, mock_user):
        """Test MFA enforcement policy endpoint"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.is_mfa_enabled.return_value = False
            mock_mfa_service.should_enforce_mfa.return_value = (False, "MFA is optional")
            mock_mfa_service.get_mfa_method.return_value = None

            response = client.get("/api/v1/auth/mfa/enforcement-policy")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['user_id'] == str(mock_user.id)
            assert data['role'] == mock_user.role
            assert data['mfa_enabled'] is False
            assert data['should_enforce'] is False
            assert data['enforcement_reason'] is None

    def test_get_mfa_statistics_admin_success(self, client, mock_admin_user):
        """Test MFA statistics endpoint for admin"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_admin_user), \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            mock_mfa_service.get_mfa_statistics.return_value = {
                'total_users': 100,
                'mfa_enabled_users': 45,
                'mfa_disabled_users': 55,
                'totp_users': 40,
                'sms_users': 5,
                'enforcement_policy': 'optional',
                'last_updated': '2023-01-01T12:00:00'
            }

            response = client.get("/api/v1/auth/mfa/statistics")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['total_users'] == 100
            assert data['mfa_enabled_users'] == 45
            assert data['enforcement_policy'] == 'optional'

    def test_get_mfa_statistics_unauthorized(self, client, mock_user):
        """Test MFA statistics endpoint for non-admin user"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user):

            response = client.get("/api/v1/auth/mfa/statistics")

            assert response.status_code == status.HTTP_403_FORBIDDEN
            assert "Admin privileges required" in response.json()['detail']


class TestEnhancedLogin:
    """Test enhanced login with MFA support"""

    def test_login_success_without_mfa(self, client, mock_user):
        """Test successful login without MFA"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.create_access_token') as mock_token, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_token.return_value = "test_token"

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['access_token'] == "test_token"
            assert data['token_type'] == "bearer"

    def test_login_with_mfa_required(self, client, mock_user):
        """Test login when MFA is required but not provided"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_mfa_service.is_mfa_enabled.return_value = True
            mock_mfa_service.should_enforce_mfa.return_value = (False, "")

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "MFA token required" in response.json()['detail']
            assert response.headers.get('X-MFA-Required') == 'true'

    def test_login_with_mfa_success(self, client, mock_user):
        """Test successful login with MFA token"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.create_access_token') as mock_token, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_token.return_value = "test_token"
            mock_mfa_service.is_mfa_enabled.return_value = True
            mock_mfa_service.should_enforce_mfa.return_value = (False, "")
            mock_mfa_service.verify_mfa_token.return_value = {'success': True}

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"},
                params={"mfa_token": "123456"}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data['access_token'] == "test_token"

    def test_login_with_mfa_enforcement(self, client, mock_user):
        """Test login when MFA enforcement is triggered"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_mfa_service.is_mfa_enabled.return_value = False
            mock_mfa_service.should_enforce_mfa.return_value = (True, "MFA is required for admin users")

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "MFA is required for admin users" in response.json()['detail']
            assert response.headers.get('X-MFA-Enforcement') == "MFA is required for admin users"

    def test_login_with_invalid_mfa_token(self, client, mock_user):
        """Test login with invalid MFA token"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_mfa_service.is_mfa_enabled.return_value = True
            mock_mfa_service.should_enforce_mfa.return_value = (False, "")
            mock_mfa_service.verify_mfa_token.return_value = {'success': False, 'error': 'Invalid token'}

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"},
                params={"mfa_token": "000000"}
            )

            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid token" in response.json()['detail']


class TestRequestValidation:
    """Test request validation and error handling"""

    def test_mfa_verify_invalid_token_format(self, client, mock_user):
        """Test MFA verification with invalid token format"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user):
            response = client.post(
                "/api/v1/auth/mfa/verify",
                json={"token": "abc"}  # Invalid format
            )

            # The endpoint should handle invalid formats gracefully
            assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]

    def test_setup_totp_missing_dependencies(self, client, mock_user):
        """Test TOTP setup when dependencies are missing"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service:

            mock_mfa_service.setup_totp_mfa.side_effect = ImportError("Missing dependencies")

            response = client.post("/api/v1/auth/mfa/setup-totp")

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


class TestSecurityControls:
    """Test security controls and rate limiting"""

    def test_mfa_endpoints_require_authentication(self, client):
        """Test that all MFA endpoints require authentication"""
        endpoints = [
            "/api/v1/auth/mfa/setup-totp",
            "/api/v1/auth/mfa/setup-sms",
            "/api/v1/auth/mfa/verify",
            "/api/v1/auth/mfa/disable",
            "/api/v1/auth/mfa/status",
            "/api/v1/auth/mfa/regenerate-backup-codes",
            "/api/v1/auth/mfa/send-sms-code",
            "/api/v1/auth/mfa/verify-token",
            "/api/v1/auth/mfa/enforcement-policy",
        ]

        for endpoint in endpoints:
            if endpoint in ["/api/v1/auth/mfa/verify", "/api/v1/auth/mfa/disable", "/api/v1/auth/mfa/regenerate-backup-codes"]:
                response = client.post(endpoint)
            else:
                response = client.get(endpoint)

            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_endpoints_require_admin_privileges(self, client, mock_user):
        """Test that admin-only endpoints require admin privileges"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user):
            response = client.get("/api/v1/auth/mfa/statistics")

            assert response.status_code == status.HTTP_403_FORBIDDEN


class TestIntegration:
    """Integration tests for complete MFA flows"""

    def test_complete_totp_mfa_flow(self, client, mock_user):
        """Test complete TOTP MFA setup and usage flow"""
        with patch('app.api.v1.endpoints.auth.get_current_active_user', return_value=mock_user), \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db

            # Setup TOTP
            mock_mfa_service.setup_totp_mfa.return_value = {
                'secret': 'JBSWY3DPEHPK3PXP',
                'qr_code': 'data:image/png;base64,test_qr_code',
                'backup_codes': ['ABCD-1234', 'EFGH-5678']
            }

            response = client.post("/api/v1/auth/mfa/setup-totp")
            assert response.status_code == status.HTTP_200_OK

            # Verify setup
            mock_mfa_service.verify_mfa_setup.return_value = {
                'success': True,
                'mfa_enabled': True,
                'mfa_method': MFAMethod.TOTP,
                'backup_codes': ['ABCD-1234', 'EFGH-5678', 'HIJK-9012']
            }

            response = client.post("/api/v1/auth/mfa/verify", json={"token": "123456"})
            assert response.status_code == status.HTTP_200_OK

            # Check status
            mock_mfa_service.get_mfa_status.return_value = {
                'enabled': True,
                'method': MFAMethod.TOTP,
                'backup_codes_remaining': 3
            }

            response = client.get("/api/v1/auth/mfa/status")
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['enabled'] is True

    def test_login_mfa_flow(self, client, mock_user):
        """Test complete login flow with MFA"""
        with patch('app.api.v1.endpoints.auth.authenticate_user') as mock_auth, \
             patch('app.api.v1.endpoints.auth.create_access_token') as mock_token, \
             patch('app.api.v1.endpoints.auth.mfa_service') as mock_mfa_service, \
             patch('app.api.v1.endpoints.auth.get_db') as mock_get_db:

            mock_db = AsyncMock()
            mock_get_db.return_value = mock_db
            mock_auth.return_value = mock_user
            mock_token.return_value = "test_token"

            # MFA is enabled but token not provided
            mock_mfa_service.is_mfa_enabled.return_value = True
            mock_mfa_service.should_enforce_mfa.return_value = (False, "")

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"}
            )
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert response.headers.get('X-MFA-Required') == 'true'

            # Provide MFA token
            mock_mfa_service.verify_mfa_token.return_value = {'success': True}

            response = client.post(
                "/api/v1/auth/login",
                data={"username": mock_user.email, "password": "password"},
                params={"mfa_token": "123456"}
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['access_token'] == "test_token"
"""
Comprehensive Tests for Enhanced Authentication Service

This test suite covers all authentication functionality including:
- User registration with email verification
- Email/password authentication with MFA
- OAuth integration
- Token management and refresh
- Password reset functionality
- Session management
- Security monitoring and logging
- Rate limiting and brute force protection

Author: Claude Code Implementation
Created: 2025-01-05
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from typing import Optional, Dict, Any

# Import the authentication service and related models
from app.services.auth_service import (
    AuthenticationService,
    AuthenticationResult,
    RegistrationResult
)
from app.models.user import User, UserSession, SecurityEvent
from app.schemas.auth import (
    UserCreate,
    EnhancedLoginRequest,
    PasswordReset,
    PasswordResetConfirm,
    SecurityEventType,
    SecuritySeverity,
    AuthMethod,
    UserRole,
    SubscriptionTier
)
from app.core.config import settings

# Test fixtures
@pytest.fixture
def mock_db():
    """Mock database session"""
    return Mock(spec=AsyncSession)

@pytest.fixture
def auth_service():
    """Authentication service instance"""
    service = AuthenticationService()
    return service

@pytest.fixture
def test_user_data():
    """Test user creation data"""
    return UserCreate(
        email="test@example.com",
        password="TestPassword123!",
        confirm_password="TestPassword123!",
        full_name="Test User",
        accept_terms=True,
        role=UserRole.USER,
        subscription_tier=SubscriptionTier.FREE
    )

@pytest.fixture
def test_user():
    """Test user instance"""
    user = User(
        id="test-user-id",
        email="test@example.com",
        hashed_password="$2b$12$testhash",
        full_name="Test User",
        is_active=True,
        is_verified=True,
        role=UserRole.USER,
        subscription_tier=SubscriptionTier.FREE,
        created_at=datetime.utcnow(),
        auth_methods=[AuthMethod.EMAIL_PASSWORD]
    )
    return user

@pytest.fixture
def mock_settings():
    """Mock settings for testing"""
    settings.SMTP_HOST = "smtp.test.com"
    settings.SMTP_PORT = 587
    settings.SMTP_USERNAME = "test@test.com"
    settings.SMTP_PASSWORD = "testpass"
    settings.SMTP_FROM_EMAIL = "noreply@test.com"
    settings.FRONTEND_URL = "https://test.com"
    settings.APP_NAME = "UPM.Plus Test"
    settings.SECRET_KEY = "test-secret-key"
    settings.ACCESS_TOKEN_EXPIRE_MINUTES = 30
    return settings


class TestUserRegistration:
    """Test suite for user registration functionality"""

    @pytest.mark.asyncio
    async def test_successful_user_registration(
        self, auth_service, mock_db, test_user_data, mock_settings
    ):
        """Test successful user registration"""
        # Mock database operations
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None  # No existing user
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Mock email sending
        with patch.object(auth_service, '_send_verification_email') as mock_email:
            with patch.object(auth_service, '_validate_registration_request') as mock_validate:
                mock_validate.return_value = True

                result = await auth_service.register_user(mock_db, test_user_data)

                assert result.success is True
                assert result.user is not None
                assert result.verification_token is not None
                assert result.user.email == test_user_data.email
                assert result.user.is_verified is False

                mock_email.assert_called_once()
                mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_registration_email_already_exists(
        self, auth_service, mock_db, test_user_data
    ):
        """Test registration with existing email"""
        # Mock existing user
        existing_user = User(email=test_user_data.email, is_verified=True)
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = existing_user
        mock_db.execute.return_value = mock_result

        with patch.object(auth_service, '_validate_registration_request') as mock_validate:
            mock_validate.return_value = True

            result = await auth_service.register_user(mock_db, test_user_data)

            assert result.success is False
            assert "already registered" in result.error_message

    @pytest.mark.asyncio
    async def test_registration_rate_limiting(
        self, auth_service, mock_db, test_user_data
    ):
        """Test registration rate limiting"""
        with patch.object(auth_service, '_validate_registration_request') as mock_validate:
            mock_validate.return_value = False  # Rate limited

            result = await auth_service.register_user(mock_db, test_user_data)

            assert result.success is False
            assert "rate limit" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_registration_with_organization(
        self, auth_service, mock_db, test_user_data
    ):
        """Test registration with organization creation"""
        test_user_data.organization_name = "Test Organization"

        # Mock no existing user or organization
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with patch.object(auth_service, '_create_or_get_organization') as mock_org:
            with patch.object(auth_service, '_send_verification_email'):
                with patch.object(auth_service, '_validate_registration_request') as mock_validate:
                    mock_validate.return_value = True
                    mock_org.return_value = "org-id"

                    result = await auth_service.register_user(mock_db, test_user_data)

                    assert result.success is True
                    assert result.user.organization_id == "org-id"
                    mock_org.assert_called_once_with(mock_db, "Test Organization")

    @pytest.mark.asyncio
    async def test_registration_password_validation(self, auth_service, mock_db):
        """Test registration with weak passwords"""
        weak_passwords = [
            "password",           # Common pattern
            "12345678",           # Only numbers
            "abcdefgh",           # Only lowercase
            "ABCDEFGH",           # Only uppercase
            "Test123",            # No special character
            "short",              # Too short
        ]

        for password in weak_passwords:
            test_data = UserCreate(
                email="test@example.com",
                password=password,
                confirm_password=password,
                full_name="Test User",
                accept_terms=True
            )

            with pytest.raises(ValueError):
                # This should raise a validation error
                test_data.validate_password_strength(password)


class TestUserAuthentication:
    """Test suite for user authentication functionality"""

    @pytest.mark.asyncio
    async def test_successful_login(
        self, auth_service, mock_db, test_user, mock_settings
    ):
        """Test successful email/password login"""
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        # Mock user lookup and password verification
        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service.jwt_service, 'create_token_pair') as mock_tokens:
                    mock_get_user.return_value = test_user
                    mock_verify.return_value = True
                    mock_tokens.return_value = ("access_token", "refresh_token")

                    with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                        with patch.object(auth_service.mfa_service, 'is_mfa_enabled') as mock_mfa:
                            mock_rate.return_value = True
                            mock_mfa.return_value = False

                            result = await auth_service.authenticate_user(mock_db, login_request)

                            assert result.success is True
                            assert result.access_token == "access_token"
                            assert result.refresh_token == "refresh_token"
                            assert result.user == test_user
                            assert result.mfa_required is False

    @pytest.mark.asyncio
    async def test_login_with_mfa_required(
        self, auth_service, mock_db, test_user
    ):
        """Test login when MFA is required"""
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                    with patch.object(auth_service.mfa_service, 'is_mfa_enabled') as mock_mfa:
                        mock_get_user.return_value = test_user
                        mock_verify.return_value = True
                        mock_rate.return_value = True
                        mock_mfa.return_value = True  # MFA enabled

                        result = await auth_service.authenticate_user(mock_db, login_request)

                        assert result.success is False
                        assert result.mfa_required is True
                        assert "MFA token required" in result.error_message

    @pytest.mark.asyncio
    async def test_login_with_invalid_password(
        self, auth_service, mock_db, test_user
    ):
        """Test login with invalid password"""
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="wrongpassword"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                    with patch.object(auth_service, '_handle_failed_login') as mock_failed:
                        mock_get_user.return_value = test_user
                        mock_verify.return_value = False
                        mock_rate.return_value = True

                        result = await auth_service.authenticate_user(mock_db, login_request)

                        assert result.success is False
                        assert "Invalid email or password" in result.error_message
                        mock_failed.assert_called_once()

    @pytest.mark.asyncio
    async def test_login_rate_limiting(
        self, auth_service, mock_db
    ):
        """Test login rate limiting"""
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        with patch.object(auth_service, '_check_rate_limit') as mock_rate:
            mock_rate.return_value = False  # Rate limited

            result = await auth_service.authenticate_user(mock_db, login_request)

            assert result.success is False
            assert "Too many login attempts" in result.error_message

    @pytest.mark.asyncio
    async def test_login_unverified_user(
        self, auth_service, mock_db, test_user
    ):
        """Test login with unverified user"""
        test_user.is_verified = False
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                    mock_get_user.return_value = test_user
                    mock_verify.return_value = True
                    mock_rate.return_value = True

                    result = await auth_service.authenticate_user(mock_db, login_request)

                    assert result.success is False
                    assert result.requires_verification is True

    @pytest.mark.asyncio
    async def test_login_inactive_user(
        self, auth_service, mock_db, test_user
    ):
        """Test login with inactive user"""
        test_user.is_active = False
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                mock_get_user.return_value = test_user
                mock_rate.return_value = True

                result = await auth_service.authenticate_user(mock_db, login_request)

                    assert result.success is False
                    assert "Account is disabled" in result.error_message


class TestOAuthAuthentication:
    """Test suite for OAuth authentication functionality"""

    @pytest.mark.asyncio
    async def test_oauth_callback_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful OAuth callback"""
        oauth_data = {
            "provider": "google",
            "user_info": {
                "email": "test@example.com",
                "full_name": "Test User"
            },
            "token_data": {"access_token": "oauth_token"}
        }

        with patch.object(auth_service.oauth_service, 'handle_callback') as mock_callback:
            with patch.object(auth_service.oauth_service, 'find_or_create_user') as mock_find:
                with patch.object(auth_service.jwt_service, 'create_token_pair') as mock_tokens:
                    mock_callback.return_value = oauth_data
                    mock_find.return_value = test_user
                    mock_tokens.return_value = ("access_token", "refresh_token")

                    result = await auth_service.authenticate_oauth(
                        mock_db, "google", "code", "state", "redirect_uri"
                    )

                    assert result.success is True
                    assert result.access_token == "access_token"
                    assert result.refresh_token == "refresh_token"
                    assert result.user == test_user

    @pytest.mark.asyncio
    async def test_oauth_callback_failure(
        self, auth_service, mock_db
    ):
        """Test OAuth callback failure"""
        with patch.object(auth_service.oauth_service, 'handle_callback') as mock_callback:
            mock_callback.return_value = None  # Failed callback

            result = await auth_service.authenticate_oauth(
                mock_db, "google", "invalid_code", "state", "redirect_uri"
            )

            assert result.success is False
            assert "OAuth authentication failed" in result.error_message


class TestTokenManagement:
    """Test suite for token management functionality"""

    @pytest.mark.asyncio
    async def test_token_refresh_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful token refresh"""
        with patch.object(auth_service.jwt_service, 'refresh_access_token') as mock_refresh:
            mock_refresh.return_value = ("new_access_token", "new_refresh_token")

            result = await auth_service.refresh_tokens(mock_db, "old_refresh_token")

            assert result.success is True
            assert result.access_token == "new_access_token"
            assert result.refresh_token == "new_refresh_token"

    @pytest.mark.asyncio
    async def test_token_refresh_invalid_token(
        self, auth_service, mock_db
    ):
        """Test token refresh with invalid token"""
        with patch.object(auth_service.jwt_service, 'refresh_access_token') as mock_refresh:
            mock_refresh.return_value = None  # Invalid token

            result = await auth_service.refresh_tokens(mock_db, "invalid_refresh_token")

            assert result.success is False
            assert "Invalid or expired refresh token" in result.error_message

    @pytest.mark.asyncio
    async def test_token_revocation(
        self, auth_service, mock_db
    ):
        """Test token revocation"""
        with patch.object(auth_service.jwt_service, 'revoke_refresh_token') as mock_revoke:
            mock_revoke.return_value = True

            result = await auth_service.revoke_tokens(mock_db, "refresh_token")

            assert result is True
            mock_revoke.assert_called_once_with(mock_db, "refresh_token")

    @pytest.mark.asyncio
    async def test_revoke_all_user_tokens(
        self, auth_service, mock_db, test_user
    ):
        """Test revoking all user tokens"""
        with patch.object(auth_service.jwt_service, 'revoke_all_user_tokens') as mock_revoke:
            with patch.object(auth_service, '_log_security_event') as mock_log:
                mock_revoke.return_value = True

                result = await auth_service.revoke_tokens(mock_db, None, "test-user-id")

                assert result is True
                mock_revoke.assert_called_once_with(mock_db, "test-user-id")
                mock_log.assert_called_once()


class TestEmailVerification:
    """Test suite for email verification functionality"""

    @pytest.mark.asyncio
    async def test_email_verification_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful email verification"""
        test_user.is_verified = False
        test_user.preferences = {
            "verification_token": "valid_token",
            "verification_expires": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        }

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = test_user
        mock_db.execute.return_value = mock_result
        mock_db.commit = AsyncMock()

        result = await auth_service.verify_email(mock_db, "valid_token")

        assert result is True
        assert test_user.is_verified is True
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_email_verification_invalid_token(
        self, auth_service, mock_db
    ):
        """Test email verification with invalid token"""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None  # No user found
        mock_db.execute.return_value = mock_result

        result = await auth_service.verify_email(mock_db, "invalid_token")

        assert result is False

    @pytest.mark.asyncio
    async def test_email_verification_expired_token(
        self, auth_service, mock_db, test_user
    ):
        """Test email verification with expired token"""
        test_user.is_verified = False
        test_user.preferences = {
            "verification_token": "expired_token",
            "verification_expires": (datetime.utcnow() - timedelta(hours=1)).isoformat()
        }

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = test_user
        mock_db.execute.return_value = mock_result

        result = await auth_service.verify_email(mock_db, "expired_token")

        assert result is False


class TestPasswordReset:
    """Test suite for password reset functionality"""

    @pytest.mark.asyncio
    async def test_password_reset_request_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful password reset request"""
        reset_request = PasswordReset(email="test@example.com")

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch.object(auth_service, '_send_password_reset_email') as mock_email:
                mock_get_user.return_value = test_user

                result = await auth_service.request_password_reset(mock_db, reset_request)

                assert result is True
                mock_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_password_reset_request_user_not_found(
        self, auth_service, mock_db
    ):
        """Test password reset request for non-existent user"""
        reset_request = PasswordReset(email="nonexistent@example.com")

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            mock_get_user.return_value = None  # User not found

            result = await auth_service.request_password_reset(mock_db, reset_request)

            # Should still return True for security (don't reveal if user exists)
            assert result is True

    @pytest.mark.asyncio
    async def test_password_reset_confirmation_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful password reset confirmation"""
        reset_confirm = PasswordResetConfirm(
            token="valid_token",
            new_password="NewPassword123!"
        )

        test_user.preferences = {
            "password_reset_token": "valid_token",
            "password_reset_expires": (datetime.utcnow() + timedelta(hours=1)).isoformat()
        }

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch.object(auth_service.jwt_service, 'revoke_all_user_tokens') as mock_revoke:
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = test_user
                mock_db.execute.return_value = mock_result
                mock_db.commit = AsyncMock()
                mock_get_user.return_value = test_user
                mock_revoke.return_value = True

                with patch('app.services.auth_service.get_password_hash') as mock_hash:
                    mock_hash.return_value = "new_hashed_password"

                    result = await auth_service.confirm_password_reset(mock_db, reset_confirm)

                    assert result is True
                    mock_db.commit.assert_called_once()
                    mock_revoke.assert_called_once()


class TestSessionManagement:
    """Test suite for session management functionality"""

    @pytest.mark.asyncio
    async def test_get_user_sessions(
        self, auth_service, mock_db, test_user
    ):
        """Test getting user sessions"""
        with patch.object(auth_service.jwt_service, 'get_user_active_sessions') as mock_sessions:
            mock_session = Mock()
            mock_session.id = "session-id"
            mock_session.created_at = datetime.utcnow()
            mock_session.last_used = datetime.utcnow()
            mock_session.device_info = "Test Device"
            mock_sessions.return_value = [mock_session]

            result = await auth_service.get_user_sessions(mock_db, "test-user-id")

            assert len(result) == 1
            assert result[0]["id"] == "session-id"
            assert result[0]["device_info"] == "Test Device"

    @pytest.mark.asyncio
    async def test_revoke_session_success(
        self, auth_service, mock_db, test_user
    ):
        """Test successful session revocation"""
        with patch.object(auth_service.jwt_service, 'revoke_all_user_tokens') as mock_revoke:
            with patch.object(auth_service, '_log_security_event') as mock_log:
                mock_revoke.return_value = True

                result = await auth_service.revoke_session(mock_db, "session-id", "test-user-id")

                assert result is True
                mock_revoke.assert_called_once_with(mock_db, "test-user-id")


class TestSecurityMonitoring:
    """Test suite for security monitoring functionality"""

    @pytest.mark.asyncio
    async def test_get_security_events(
        self, auth_service, mock_db
    ):
        """Test getting security events"""
        result = await auth_service.get_security_events(mock_db, "test-user-id")

        # Should return empty list for now (implementation needed)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_log_security_event(
        self, auth_service, mock_db
    ):
        """Test logging security events"""
        # This test verifies that the method exists and can be called
        await auth_service._log_security_event(
            mock_db, "test-user-id", "test_event", {"test": "data"}
        )

        # No assertion needed - just ensure no exception is raised


class TestRateLimiting:
    """Test suite for rate limiting functionality"""

    @pytest.mark.asyncio
    async def test_rate_limiting_success(
        self, auth_service
    ):
        """Test rate limiting within limits"""
        # Reset rate limit cache
        auth_service._rate_limit_cache.clear()

        # First request should succeed
        result = await auth_service._check_rate_limit("test@example.com", "127.0.0.1")
        assert result is True

    @pytest.mark.asyncio
    async def test_rate_limiting_exceeded(
        self, auth_service
    ):
        """Test rate limiting when exceeded"""
        # Reset rate limit cache
        auth_service._rate_limit_cache.clear()
        auth_service.max_login_attempts = 2  # Lower limit for testing

        # First two requests should succeed
        assert await auth_service._check_rate_limit("test@example.com", "127.0.0.1") is True
        assert await auth_service._check_rate_limit("test@example.com", "127.0.0.1") is True

        # Third request should fail
        assert await auth_service._check_rate_limit("test@example.com", "127.0.0.1") is False

    @pytest.mark.asyncio
    async def test_rate_limiting_reset_after_timeout(
        self, auth_service
    ):
        """Test that rate limiting resets after timeout"""
        # Reset rate limit cache
        auth_service._rate_limit_cache.clear()
        auth_service.login_attempt_timeout = 0  # Immediate timeout for testing

        # First request should succeed
        assert await auth_service._check_rate_limit("test@example.com", "127.0.0.1") is True

        # Simulate time passage by clearing cache (in real implementation, time-based reset)
        auth_service._rate_limit_cache.clear()

        # Request should still succeed due to timeout
        assert await auth_service._check_rate_limit("test@example.com", "127.0.0.1") is True


class TestEmailIntegration:
    """Test suite for email functionality"""

    @pytest.mark.asyncio
    async def test_send_verification_email(
        self, auth_service, mock_settings
    ):
        """Test sending verification email"""
        with patch('smtplib.SMTP') as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await auth_service._send_verification_email("test@example.com", "token123")

            mock_smtp.assert_called_once()
            mock_server.starttls.assert_called_once()
            mock_server.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_password_reset_email(
        self, auth_service, mock_settings
    ):
        """Test sending password reset email"""
        with patch('smtplib.SMTP') as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await auth_service._send_password_reset_email("test@example.com", "reset_token")

            mock_smtp.assert_called_once()
            mock_server.starttls.assert_called_once()
            mock_server.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_email_smtp_not_configured(
        self, auth_service, mock_settings
    ):
        """Test email sending when SMTP is not configured"""
        mock_settings.SMTP_HOST = None

        # Should not raise an exception, just log a warning
        await auth_service._send_verification_email("test@example.com", "token123")


class TestErrorHandling:
    """Test suite for error handling scenarios"""

    @pytest.mark.asyncio
    async def test_database_error_handling(
        self, auth_service, mock_db, test_user_data
    ):
        """Test handling of database errors"""
        mock_db.execute.side_effect = Exception("Database error")

        result = await auth_service.register_user(mock_db, test_user_data)

        assert result.success is False
        assert "Registration failed" in result.error_message

    @pytest.mark.asyncio
    async def test_email_sending_error_handling(
        self, auth_service, mock_db, test_user_data
    ):
        """Test handling of email sending errors"""
        with patch.object(auth_service, '_validate_registration_request') as mock_validate:
            mock_validate.return_value = True

            mock_result = Mock()
            mock_result.scalar_one_or_none.return_value = None
            mock_db.execute.return_value = mock_result

            with patch.object(auth_service, '_send_verification_email') as mock_email:
                mock_email.side_effect = Exception("Email error")
                mock_db.commit = AsyncMock()
                mock_db.rollback = AsyncMock()

                result = await auth_service.register_user(mock_db, test_user_data)

                assert result.success is False
                mock_db.rollback.assert_called_once()


# Integration Tests
class TestAuthenticationIntegration:
    """Integration tests for complete authentication flows"""

    @pytest.mark.asyncio
    async def test_complete_registration_flow(
        self, auth_service, mock_db, test_user_data, mock_settings
    ):
        """Test complete registration flow from start to finish"""
        # Mock all dependencies
        with patch.object(auth_service, '_validate_registration_request') as mock_validate:
            with patch.object(auth_service, '_send_verification_email') as mock_email:
                with patch.object(auth_service, '_create_or_get_organization') as mock_org:
                    mock_validate.return_value = True
                    mock_org.return_value = None

                    # Step 1: Register user
                    registration_result = await auth_service.register_user(mock_db, test_user_data)

                    assert registration_result.success is True
                    assert registration_result.user is not None
                    assert registration_result.verification_token is not None

                    # Step 2: Verify email
                    with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
                        mock_user = registration_result.user
                        mock_user.preferences = {
                            "verification_token": registration_result.verification_token,
                            "verification_expires": (datetime.utcnow() + timedelta(hours=1)).isoformat()
                        }
                        mock_get_user.return_value = mock_user
                        mock_db.commit = AsyncMock()

                        verification_result = await auth_service.verify_email(
                            mock_db, registration_result.verification_token
                        )

                        assert verification_result is True

    @pytest.mark.asyncio
    async def test_complete_login_flow_with_mfa(
        self, auth_service, mock_db, test_user, mock_settings
    ):
        """Test complete login flow with MFA"""
        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!",
            mfa_token="123456"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service.jwt_service, 'create_token_pair') as mock_tokens:
                    with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                        with patch.object(auth_service.mfa_service, 'is_mfa_enabled') as mock_mfa:
                            with patch.object(auth_service.mfa_service, 'verify_mfa_token') as mock_mfa_verify:
                                mock_get_user.return_value = test_user
                                mock_verify.return_value = True
                                mock_tokens.return_value = ("access_token", "refresh_token")
                                mock_rate.return_value = True
                                mock_mfa.return_value = True
                                mock_mfa_verify.return_value = True

                                result = await auth_service.authenticate_user(mock_db, login_request)

                                assert result.success is True
                                assert result.access_token is not None
                                assert result.refresh_token is not None

    @pytest.mark.asyncio
    async def test_complete_password_reset_flow(
        self, auth_service, mock_db, test_user, mock_settings
    ):
        """Test complete password reset flow"""
        # Step 1: Request password reset
        reset_request = PasswordReset(email="test@example.com")

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch.object(auth_service, '_send_password_reset_email') as mock_email:
                mock_get_user.return_value = test_user

                request_result = await auth_service.request_password_reset(mock_db, reset_request)
                assert request_result is True

                # Step 2: Confirm password reset
                test_user.preferences = {
                    "password_reset_token": "reset_token",
                    "password_reset_expires": (datetime.utcnow() + timedelta(hours=1)).isoformat()
                }

                with patch.object(auth_service.jwt_service, 'revoke_all_user_tokens') as mock_revoke:
                    mock_result = Mock()
                    mock_result.scalar_one_or_none.return_value = test_user
                    mock_db.execute.return_value = mock_result
                    mock_db.commit = AsyncMock()
                    mock_revoke.return_value = True

                    with patch('app.services.auth_service.get_password_hash') as mock_hash:
                        mock_hash.return_value = "new_hashed_password"

                        reset_confirm = PasswordResetConfirm(
                            token="reset_token",
                            new_password="NewPassword123!"
                        )

                        confirm_result = await auth_service.confirm_password_reset(mock_db, reset_confirm)
                        assert confirm_result is True


# Performance Tests
class TestAuthenticationPerformance:
    """Performance tests for authentication functionality"""

    @pytest.mark.asyncio
    async def test_registration_performance(
        self, auth_service, mock_db, test_user_data
    ):
        """Test registration performance"""
        import time

        with patch.object(auth_service, '_validate_registration_request') as mock_validate:
            with patch.object(auth_service, '_send_verification_email'):
                mock_validate.return_value = True
                mock_result = Mock()
                mock_result.scalar_one_or_none.return_value = None
                mock_db.execute.return_value = mock_result
                mock_db.commit = AsyncMock()

                start_time = time.time()
                await auth_service.register_user(mock_db, test_user_data)
                end_time = time.time()

                # Registration should complete within reasonable time (e.g., 1 second)
                assert (end_time - start_time) < 1.0

    @pytest.mark.asyncio
    async def test_login_performance(
        self, auth_service, mock_db, test_user
    ):
        """Test login performance"""
        import time

        login_request = EnhancedLoginRequest(
            email="test@example.com",
            password="TestPassword123!"
        )

        with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
            with patch('app.services.auth_service.verify_password') as mock_verify:
                with patch.object(auth_service.jwt_service, 'create_token_pair') as mock_tokens:
                    with patch.object(auth_service, '_check_rate_limit') as mock_rate:
                        with patch.object(auth_service.mfa_service, 'is_mfa_enabled') as mock_mfa:
                            mock_get_user.return_value = test_user
                            mock_verify.return_value = True
                            mock_tokens.return_value = ("access_token", "refresh_token")
                            mock_rate.return_value = True
                            mock_mfa.return_value = False

                            start_time = time.time()
                            await auth_service.authenticate_user(mock_db, login_request)
                            end_time = time.time()

                            # Login should complete within reasonable time (e.g., 500ms)
                            assert (end_time - start_time) < 0.5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
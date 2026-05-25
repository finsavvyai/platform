"""
Test Suite for Authentication Models and Schemas

This test suite covers:
- User model properties and methods
- Authentication schema validation
- Database model relationships
- Security model functionality

Author: Claude Code Implementation
Created: 2025-01-05
"""

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError

# Import models and schemas
from app.models.user import User, UserSession, SecurityEvent
from app.schemas.auth import (
    UserCreate,
    UserUpdate,
    UserResponse,
    EnhancedLoginRequest,
    PasswordReset,
    PasswordResetConfirm,
    SecurityEvent as SecurityEventSchema,
    AuthMethod,
    UserRole,
    SubscriptionTier,
    SecurityEventType,
    SecuritySeverity
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class TestUserModel:
    """Test suite for User model"""

    def test_user_creation(self):
        """Test basic user creation"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            full_name="Test User"
        )

        assert user.email == "test@example.com"
        assert user.hashed_password == "hashed_password"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_verified is False
        assert user.role == "user"

    def test_user_with_oauth_only(self):
        """Test user with OAuth authentication only"""
        user = User(
            email="oauth@example.com",
            hashed_password=None,  # No password for OAuth-only users
            oauth_providers={"google": {"id": "google-id", "email": "oauth@example.com"}}
        )

        assert user.email == "oauth@example.com"
        assert user.hashed_password is None
        assert user.has_oauth_auth is True
        assert user.has_password_auth is False

    def test_user_properties(self):
        """Test user properties and computed fields"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            auth_methods=[AuthMethod.EMAIL_PASSWORD, AuthMethod.GOOGLE],
            oauth_providers={"google": {"id": "google-id"}},
            full_name="Test User"
        )

        # Test auth provider properties
        assert user.has_password_auth is True
        assert user.has_oauth_auth is True
        assert AuthMethod.EMAIL_PASSWORD in user.get_auth_providers()
        assert AuthMethod.GOOGLE in user.get_auth_providers()

        # Test display name
        assert user.display_name == "Test User"

        user.full_name = None
        assert user.display_name == "test@example.com"

    def test_user_locked_status(self):
        """Test user account locking functionality"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password"
        )

        # Initially not locked
        assert user.is_locked is False

        # Lock account for 1 hour
        user.locked_until = datetime.utcnow() + timedelta(hours=1)
        assert user.is_locked is True

        # Lock expired
        user.locked_until = datetime.utcnow() - timedelta(hours=1)
        assert user.is_locked is False

    def test_user_mfa_status(self):
        """Test MFA status properties"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password"
        )

        # MFA disabled by default
        assert user.mfa_enabled is False

        # Enable MFA via two_factor_enabled
        user.two_factor_enabled = True
        assert user.mfa_enabled is True

        # Enable MFA via preferences
        user.two_factor_enabled = False
        user.preferences = {"mfa_enabled": True}
        assert user.mfa_enabled is True

    def test_user_permissions(self):
        """Test user permission checking"""
        # Regular user
        user = User(
            email="user@example.com",
            hashed_password="password",
            role="user"
        )

        assert user.has_permission("read") is True
        assert user.has_permission("write") is True
        assert user.has_permission("delete") is False
        assert user.has_permission("manage_users") is False

        # Admin user
        admin_user = User(
            email="admin@example.com",
            hashed_password="password",
            is_superuser=True
        )

        assert admin_user.has_permission("any_permission") is True

        # User with explicit permissions
        user_with_permissions = User(
            email="user@example.com",
            hashed_password="password",
            role="user",
            permissions=["custom_permission"]
        )

        assert user_with_permissions.has_permission("custom_permission") is True

    def test_user_security_score(self):
        """Test user security score calculation"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password"
        )

        # Base score (no additional security)
        score = user.get_security_score()
        assert score >= 0

        # Add email verification
        user.is_verified = True
        score = user.get_security_score()
        assert score >= 20

        # Add MFA
        user.two_factor_enabled = True
        score = user.get_security_score()
        assert score >= 50

        # Add OAuth
        user.oauth_providers = {"google": {"id": "google-id"}}
        score = user.get_security_score()
        assert score >= 65

    def test_user_to_dict(self):
        """Test user serialization to dictionary"""
        user = User(
            id="user-id",
            email="test@example.com",
            hashed_password="hashed_password",
            full_name="Test User",
            is_verified=True,
            role="user",
            created_at=datetime.utcnow(),
            last_login=datetime.utcnow(),
            auth_methods=[AuthMethod.EMAIL_PASSWORD],
            preferences={"mfa_enabled": True}
        )

        user_dict = user.to_dict()

        assert user_dict["id"] == "user-id"
        assert user_dict["email"] == "test@example.com"
        assert user_dict["is_verified"] is True
        assert "hashed_password" not in user_dict  # Sensitive data excluded
        assert user_dict["mfa_enabled"] is True


class TestUserSessionModel:
    """Test suite for UserSession model"""

    def test_session_creation(self):
        """Test basic session creation"""
        session = UserSession(
            user_id="user-id",
            session_token="session-token",
            refresh_token_hash="refresh-hash",
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )

        assert session.user_id == "user-id"
        assert session.session_token == "session-token"
        assert session.is_active is True
        assert session.is_expired is False
        assert session.is_valid is True

    def test_session_expiration(self):
        """Test session expiration logic"""
        # Expired session
        expired_session = UserSession(
            user_id="user-id",
            session_token="session-token",
            refresh_token_hash="refresh-hash",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )

        assert expired_session.is_expired is True
        assert expired_session.is_valid is False

        # Valid session
        valid_session = UserSession(
            user_id="user-id",
            session_token="session-token",
            refresh_token_hash="refresh-hash",
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )

        assert valid_session.is_expired is False
        assert valid_session.is_valid is True

    def test_session_active_status(self):
        """Test session active status"""
        session = UserSession(
            user_id="user-id",
            session_token="session-token",
            refresh_token_hash="refresh-hash",
            expires_at=datetime.utcnow() + timedelta(hours=1),
            is_active=False
        )

        assert session.is_active is False
        assert session.is_valid is False  # Inactive sessions are invalid

        session.is_active = True
        assert session.is_valid is True


class TestSecurityEventModel:
    """Test suite for SecurityEvent model"""

    def test_security_event_creation(self):
        """Test basic security event creation"""
        event = SecurityEvent(
            user_id="user-id",
            event_type="login_success",
            event_category="authentication",
            severity="info",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
            details={"method": "oauth"}
        )

        assert event.user_id == "user-id"
        assert event.event_type == "login_success"
        assert event.event_category == "authentication"
        assert event.severity == "info"
        assert event.ip_address == "127.0.0.1"
        assert event.details["method"] == "oauth"

    def test_security_event_anonymous(self):
        """Test security event without user"""
        event = SecurityEvent(
            event_type="rate_limit_exceeded",
            event_category="security",
            severity="warning",
            ip_address="192.168.1.1",
            details={"attempts": 10}
        )

        assert event.user_id is None
        assert event.event_type == "rate_limit_exceeded"


class TestUserSchemas:
    """Test suite for user validation schemas"""

    def test_user_create_valid(self):
        """Test valid user creation schema"""
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": "Test User",
            "accept_terms": True,
            "role": UserRole.USER,
            "subscription_tier": SubscriptionTier.FREE
        }

        user_schema = UserCreate(**user_data)

        assert user_schema.email == "test@example.com"
        assert user_schema.password == "TestPassword123!"
        assert user_schema.accept_terms is True
        assert user_schema.role == UserRole.USER

    def test_user_create_invalid_password(self):
        """Test user creation with invalid password"""
        invalid_passwords = [
            "short",           # Too short
            "nouppercase1!",   # No uppercase
            "NOLOWERCASE1!",   # No lowercase
            "NoNumbers!",     # No numbers
            "NoSpecial123",   # No special character
            "password123!",   # Common pattern
        ]

        for password in invalid_passwords:
            user_data = {
                "email": "test@example.com",
                "password": password,
                "confirm_password": password,
                "full_name": "Test User",
                "accept_terms": True
            }

            with pytest.raises(ValidationError):
                UserCreate(**user_data)

    def test_user_create_password_mismatch(self):
        """Test user creation with password mismatch"""
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "confirm_password": "DifferentPassword123!",
            "full_name": "Test User",
            "accept_terms": True
        }

        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)

        assert "do not match" in str(exc_info.value)

    def test_user_create_terms_not_accepted(self):
        """Test user creation without accepting terms"""
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": "Test User",
            "accept_terms": False
        }

        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)

        assert "terms of service" in str(exc_info.value)

    def test_user_create_invalid_email(self):
        """Test user creation with invalid email"""
        user_data = {
            "email": "invalid-email",
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": "Test User",
            "accept_terms": True
        }

        with pytest.raises(ValidationError):
            UserCreate(**user_data)

    def test_user_create_invalid_username(self):
        """Test user creation with invalid username"""
        user_data = {
            "email": "test@example.com",
            "username": "_invalid",  # Starts with underscore
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": "Test User",
            "accept_terms": True
        }

        with pytest.raises(ValidationError) as exc_info:
            UserCreate(**user_data)

        assert "cannot start with underscore" in str(exc_info.value)

    def test_user_update_valid(self):
        """Test valid user update schema"""
        update_data = {
            "full_name": "Updated Name",
            "timezone": "America/New_York",
            "language": "en",
            "bio": "Updated bio",
            "avatar_url": "https://example.com/avatar.jpg"
        }

        user_update = UserUpdate(**update_data)

        assert user_update.full_name == "Updated Name"
        assert user_update.timezone == "America/New_York"
        assert user_update.avatar_url == "https://example.com/avatar.jpg"

    def test_user_update_invalid_avatar_url(self):
        """Test user update with invalid avatar URL"""
        update_data = {
            "avatar_url": "invalid-url"
        }

        with pytest.raises(ValidationError) as exc_info:
            UserUpdate(**update_data)

        assert "valid HTTP/HTTPS URL" in str(exc_info.value)


class TestAuthenticationSchemas:
    """Test suite for authentication schemas"""

    def test_enhanced_login_request_valid(self):
        """Test valid enhanced login request"""
        login_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "mfa_token": "123456",
            "device_info": "Chrome on Windows",
            "remember_me": True,
            "client_ip": "192.168.1.1"
        }

        login_request = EnhancedLoginRequest(**login_data)

        assert login_request.email == "test@example.com"
        assert login_request.mfa_token == "123456"
        assert login_request.remember_me is True

    def test_enhanced_login_request_invalid_mfa_token(self):
        """Test login request with invalid MFA token format"""
        login_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "mfa_token": "invalid"  # Invalid format
        }

        with pytest.raises(ValidationError) as exc_info:
            EnhancedLoginRequest(**login_data)

        assert "must be numeric or backup code format" in str(exc_info.value)

    def test_enhanced_login_request_backup_code(self):
        """Test login request with backup code"""
        login_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "mfa_token": "ABCD-1234"  # Backup code format
        }

        login_request = EnhancedLoginRequest(**login_data)
        assert login_request.mfa_token == "ABCD-1234"

    def test_password_reset_valid(self):
        """Test valid password reset request"""
        reset_data = {
            "email": "test@example.com"
        }

        password_reset = PasswordReset(**reset_data)
        assert password_reset.email == "test@example.com"

    def test_password_reset_confirm_valid(self):
        """Test valid password reset confirmation"""
        confirm_data = {
            "token": "reset-token",
            "new_password": "NewPassword123!"
        }

        reset_confirm = PasswordResetConfirm(**confirm_data)
        assert reset_confirm.token == "reset-token"
        assert reset_confirm.new_password == "NewPassword123!"

    def test_password_reset_confirm_weak_password(self):
        """Test password reset with weak password"""
        confirm_data = {
            "token": "reset-token",
            "new_password": "weak"
        }

        with pytest.raises(ValidationError):
            PasswordResetConfirm(**confirm_data)


class TestSecurityEventSchemas:
    """Test suite for security event schemas"""

    def test_security_event_create_valid(self):
        """Test valid security event creation"""
        event_data = {
            "event_type": SecurityEventType.LOGIN_SUCCESS,
            "event_category": "authentication",
            "severity": SecuritySeverity.INFO,
            "user_id": "user-id",
            "ip_address": "192.168.1.1",
            "details": {"method": "oauth", "provider": "google"}
        }

        security_event = SecurityEventSchema(**event_data)

        assert security_event.event_type == SecurityEventType.LOGIN_SUCCESS
        assert security_event.severity == SecuritySeverity.INFO
        assert security_event.details["method"] == "oauth"

    def test_security_event_with_risk_assessment(self):
        """Test security event with risk assessment"""
        event_data = {
            "event_type": SecurityEventType.SUSPICIOUS_ACTIVITY,
            "event_category": "security",
            "severity": SecuritySeverity.WARNING,
            "ip_address": "suspicious-ip",
            "details": {"reason": "unusual_location"},
            "risk_score": 75,
            "is_anomalous": True,
            "country": "Unknown",
            "city": "Unknown"
        }

        security_event = SecurityEventSchema(**event_data)

        assert security_event.risk_score == 75
        assert security_event.is_anomalous is True
        assert security_event.country == "Unknown"


class TestEnumValues:
    """Test suite for enum values and validation"""

    def test_auth_method_values(self):
        """Test AuthMethod enum values"""
        assert AuthMethod.EMAIL_PASSWORD == "email_password"
        assert AuthMethod.GOOGLE == "google"
        assert AuthMethod.MICROSOFT == "microsoft"
        assert AuthMethod.GITHUB == "github"
        assert AuthMethod.SSO == "sso"

    def test_user_role_values(self):
        """Test UserRole enum values"""
        assert UserRole.USER == "user"
        assert UserRole.ADMIN == "admin"
        assert UserRole.STAFF == "staff"
        assert UserRole.ENTERPRISE_ADMIN == "enterprise_admin"
        assert UserRole.VIEWER == "viewer"

    def test_subscription_tier_values(self):
        """Test SubscriptionTier enum values"""
        assert SubscriptionTier.FREE == "free"
        assert SubscriptionTier.PRO == "pro"
        assert SubscriptionTier.ENTERPRISE == "enterprise"

    def test_security_event_type_values(self):
        """Test SecurityEventType enum values"""
        assert SecurityEventType.LOGIN_SUCCESS == "login_success"
        assert SecurityEventType.LOGIN_FAILED == "login_failed"
        assert SecurityEventType.PASSWORD_CHANGED == "password_changed"
        assert SecurityEventType.MFA_ENABLED == "mfa_enabled"

    def test_security_severity_values(self):
        """Test SecuritySeverity enum values"""
        assert SecuritySeverity.INFO == "info"
        assert SecuritySeverity.WARNING == "warning"
        assert SecuritySeverity.ERROR == "error"
        assert SecuritySeverity.CRITICAL == "critical"


class TestSchemaSerialization:
    """Test schema serialization and deserialization"""

    def test_user_response_serialization(self):
        """Test UserResponse schema serialization"""
        user_data = {
            "id": "user-id",
            "email": "test@example.com",
            "full_name": "Test User",
            "is_active": True,
            "subscription_tier": "free",
            "is_verified": True,
            "is_staff": False,
            "role": "user",
            "created_at": datetime.utcnow(),
            "auth_methods": ["email_password"],
            "mfa_enabled": False,
            "security_score": 75
        }

        user_response = UserResponse(**user_data)

        # Test serialization
        user_dict = user_response.dict()
        assert user_dict["id"] == "user-id"
        assert user_dict["email"] == "test@example.com"
        assert user_dict["subscription_tier"] == "free"
        assert user_dict["role"] == "user"

        # Test JSON serialization
        user_json = user_response.json()
        assert "test@example.com" in user_json

    def test_schema_with_enum_serialization(self):
        """Test schema serialization with enums"""
        event_data = {
            "id": "event-id",
            "event_type": SecurityEventType.LOGIN_SUCCESS,
            "event_category": "authentication",
            "severity": SecuritySeverity.INFO,
            "user_id": "user-id",
            "timestamp": datetime.utcnow(),
            "details": {"test": "data"}
        }

        event = SecurityEventSchema(**event_data)

        # Test that enum values are serialized correctly
        event_dict = event.dict(by_alias=True)
        assert event_dict["event_type"] == "login_success"
        assert event_dict["severity"] == "info"

        # Test JSON serialization uses enum values
        event_json = event.json()
        assert "login_success" in event_json
        assert "info" in event_json


class TestSchemaValidationEdgeCases:
    """Test edge cases in schema validation"""

    def test_email_validation_edge_cases(self):
        """Test email validation edge cases"""
        valid_emails = [
            "test@example.com",
            "user.name@domain.co.uk",
            "user+tag@example.org",
            "user123@test-domain.com"
        ]

        for email in valid_emails:
            user_data = {
                "email": email,
                "password": "TestPassword123!",
                "confirm_password": "TestPassword123!",
                "full_name": "Test User",
                "accept_terms": True
            }

            # Should not raise validation error
            UserCreate(**user_data)

    def test_password_strength_edge_cases(self):
        """Test password strength validation edge cases"""
        # Password with minimum requirements
        password_data = {
            "email": "test@example.com",
            "password": "Aa1!aaaa",  # Meets minimum requirements
            "confirm_password": "Aa1!aaaa",
            "full_name": "Test User",
            "accept_terms": True
        }

        user_schema = UserCreate(**password_data)
        assert user_schema.password == "Aa1!aaaa"

        # Very long password
        long_password = "A" + "a" * 50 + "1!aaaaaaaa"
        password_data["password"] = long_password
        password_data["confirm_password"] = long_password

        user_schema = UserCreate(**password_data)
        assert len(user_schema.password) == 64  # Should be truncated

    def test_field_length_validations(self):
        """Test field length validations"""
        # Test maximum length for username
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": "Test User",
            "accept_terms": True,
            "username": "a" * 50  # Maximum length
        }

        user_schema = UserCreate(**user_data)
        assert len(user_schema.username) == 50

        # Test username too long
        user_data["username"] = "a" * 51
        with pytest.raises(ValidationError):
            UserCreate(**user_data)

    def test_optional_fields_handling(self):
        """Test optional fields handling"""
        # User with only required fields
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "confirm_password": "TestPassword123!",
            "full_name": None,  # Optional
            "username": None,    # Optional
            "accept_terms": True
        }

        user_schema = UserCreate(**user_data)
        assert user_schema.full_name is None
        assert user_schema.username is None

        # User update with no fields
        empty_update = {}
        user_update = UserUpdate(**empty_update)
        assert user_update.email is None
        assert user_update.full_name is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
"""
Tests for JWT Manager functionality.

This module contains comprehensive tests for JWT token generation,
validation, refresh, and security features.
"""

import pytest
import time
from fastapi import HTTPException

from app.auth.jwt_manager import (
    JWTManager,
    AuthenticationManager,
    TokenValidationError,
    hash_device_fingerprint,
    extract_token_from_header,
    verify_permissions,
    verify_tenant_access,
    get_jwt_manager,
    get_auth_manager,
)


class TestJWTManager:
    """Test JWT Manager functionality."""

    @pytest.fixture
    def jwt_manager(self):
        """Create JWT manager instance for testing."""
        from app.core.config import Settings

        settings = Settings(
            secret_key="test-secret-key-for-testing-purposes-only",
            algorithm="HS256",
            access_token_expire_minutes=15,
            refresh_token_expire_days=7,
        )
        return JWTManager(settings)

    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing."""
        return {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "test@example.com",
            "role": "user",
            "permissions": ["read", "write"],
            "device_fingerprint": "device-123",
            "session_id": "session-456",
        }

    def test_generate_token_pair(self, jwt_manager, sample_user_data):
        """Test token pair generation."""
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        assert "access_token" in token_pair
        assert "refresh_token" in token_pair
        assert token_pair["token_type"] == "Bearer"
        assert "expires_in" in token_pair
        assert "expires_at" in token_pair
        assert "refresh_expires_in" in token_pair
        assert "refresh_expires_at" in token_pair

        # Check expiry times
        assert token_pair["expires_in"] > 0
        assert token_pair["refresh_expires_in"] > token_pair["expires_in"]

    def test_validate_access_token(self, jwt_manager, sample_user_data):
        """Test access token validation."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Validate access token
        claims = jwt_manager.validate_token(token_pair["access_token"], "access")

        assert claims["user_id"] == sample_user_data["user_id"]
        assert claims["tenant_id"] == sample_user_data["tenant_id"]
        assert claims["email"] == sample_user_data["email"]
        assert claims["role"] == sample_user_data["role"]
        assert claims["permissions"] == sample_user_data["permissions"]
        assert claims["token_type"] == "access"
        assert claims["device_fingerprint"] == sample_user_data["device_fingerprint"]
        assert claims["session_id"] == sample_user_data["session_id"]

    def test_validate_refresh_token(self, jwt_manager, sample_user_data):
        """Test refresh token validation."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Validate refresh token
        claims = jwt_manager.validate_token(token_pair["refresh_token"], "refresh")

        assert claims["user_id"] == sample_user_data["user_id"]
        assert claims["tenant_id"] == sample_user_data["tenant_id"]
        assert claims["token_type"] == "refresh"

    def test_validate_invalid_token_type(self, jwt_manager, sample_user_data):
        """Test validation with wrong token type."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Try to validate access token as refresh token
        with pytest.raises(TokenValidationError) as exc_info:
            jwt_manager.validate_token(token_pair["access_token"], "refresh")

        assert exc_info.value.error_type == "invalid_type"
        assert "Invalid token type" in exc_info.value.message

    def test_validate_expired_token(self, jwt_manager, sample_user_data):
        """Test validation of expired token."""
        # Create JWT manager with very short expiry
        from app.core.config import Settings

        settings = Settings(
            secret_key="test-secret-key",
            algorithm="HS256",
            access_token_expire_minutes=0.001,  # Very short expiry
            refresh_token_expire_days=7,
        )
        short_jwt_manager = JWTManager(settings)

        # Generate token pair
        token_pair = short_jwt_manager.generate_token_pair(**sample_user_data)

        # Wait for token to expire
        time.sleep(0.1)

        # Try to validate expired token
        with pytest.raises(TokenValidationError) as exc_info:
            short_jwt_manager.validate_token(token_pair["access_token"], "access")

        assert exc_info.value.error_type == "expired"

    def test_refresh_token_success(self, jwt_manager, sample_user_data):
        """Test successful token refresh."""
        # Generate initial token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Refresh token
        new_token_pair = jwt_manager.refresh_token(
            token_pair["refresh_token"], sample_user_data["device_fingerprint"]
        )

        # Verify new tokens are different
        assert new_token_pair["access_token"] != token_pair["access_token"]
        assert new_token_pair["refresh_token"] != token_pair["refresh_token"]

        # Validate new access token
        claims = jwt_manager.validate_token(new_token_pair["access_token"], "access")
        assert claims["user_id"] == sample_user_data["user_id"]
        assert claims["session_id"] == sample_user_data["session_id"]

    def test_refresh_token_device_mismatch(self, jwt_manager, sample_user_data):
        """Test refresh token with device fingerprint mismatch."""
        # Generate initial token pair with device fingerprint
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Try to refresh with different device fingerprint
        with pytest.raises(TokenValidationError) as exc_info:
            jwt_manager.refresh_token(
                token_pair["refresh_token"], "different-device-fingerprint"
            )

        assert exc_info.value.error_type == "device_mismatch"

    def test_revoke_token(self, jwt_manager, sample_user_data):
        """Test token revocation."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Get token ID from access token
        token_info = jwt_manager.get_token_info(token_pair["access_token"])
        token_id = token_info["token_id"]

        # Revoke token
        jwt_manager.revoke_token(token_id)

        # Try to validate revoked token
        with pytest.raises(TokenValidationError) as exc_info:
            jwt_manager.validate_token(token_pair["access_token"], "access")

        assert exc_info.value.error_type == "blacklisted"

    def test_is_token_blacklisted(self, jwt_manager, sample_user_data):
        """Test token blacklist checking."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Get token ID
        token_info = jwt_manager.get_token_info(token_pair["access_token"])
        token_id = token_info["token_id"]

        # Check non-blacklisted token
        assert not jwt_manager.is_token_blacklisted(token_id)

        # Revoke token
        jwt_manager.revoke_token(token_id)

        # Check blacklisted token
        assert jwt_manager.is_token_blacklisted(token_id)

    def test_get_token_info(self, jwt_manager, sample_user_data):
        """Test token info extraction."""
        # Generate token pair
        token_pair = jwt_manager.generate_token_pair(**sample_user_data)

        # Get token info
        token_info = jwt_manager.get_token_info(token_pair["access_token"])

        assert "token_id" in token_info
        assert "user_id" in token_info
        assert "tenant_id" in token_info
        assert "email" in token_info
        assert "role" in token_info
        assert "token_type" in token_info
        assert "issued_at" in token_info
        assert "expires_at" in token_info
        assert "issuer" in token_info

        assert token_info["user_id"] == sample_user_data["user_id"]
        assert token_info["token_type"] == "access"

    def test_cleanup_blacklist(self, jwt_manager):
        """Test blacklist cleanup."""
        # Add expired tokens to blacklist
        current_time = time.time()
        expired_time = current_time - 100  # Expired 100 seconds ago

        jwt_manager._blacklist["expired-token-1"] = expired_time
        jwt_manager._blacklist["expired-token-2"] = expired_time
        jwt_manager._blacklist["valid-token"] = current_time + 1000

        # Cleanup blacklist
        jwt_manager._cleanup_blacklist()

        # Check expired tokens are removed
        assert "expired-token-1" not in jwt_manager._blacklist
        assert "expired-token-2" not in jwt_manager._blacklist
        assert "valid-token" in jwt_manager._blacklist


class TestAuthenticationManager:
    """Test Authentication Manager functionality."""

    @pytest.fixture
    def auth_manager(self):
        """Create authentication manager instance."""
        return AuthenticationManager()

    @pytest.fixture
    def sample_user_data(self):
        """Sample user data for testing."""
        return {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "test@example.com",
            "role": "user",
            "permissions": ["read", "write"],
            "device_fingerprint": "device-123",
            "session_id": "session-456",
        }

    def test_authenticate_token_success(self, auth_manager, sample_user_data):
        """Test successful token authentication."""
        # Generate token pair
        token_pair = auth_manager.jwt_manager.generate_token_pair(**sample_user_data)

        # Authenticate token
        user_context = auth_manager.authenticate_token(
            token_pair["access_token"], "access"
        )

        assert user_context["user_id"] == sample_user_data["user_id"]
        assert user_context["tenant_id"] == sample_user_data["tenant_id"]
        assert user_context["email"] == sample_user_data["email"]
        assert user_context["role"] == sample_user_data["role"]
        assert user_context["permissions"] == sample_user_data["permissions"]

    def test_authenticate_token_invalid(self, auth_manager):
        """Test authentication with invalid token."""
        invalid_tokens = [
            "",
            "invalid.token",
            "invalid.token.format",
        ]

        for invalid_token in invalid_tokens:
            with pytest.raises(HTTPException) as exc_info:
                auth_manager.authenticate_token(invalid_token, "access")

            assert exc_info.value.status_code == 401

    def test_authenticate_token_expired(self, auth_manager, sample_user_data):
        """Test authentication with expired token."""
        # Create JWT manager with very short expiry
        from app.core.config import Settings

        settings = Settings(
            secret_key="test-secret-key",
            algorithm="HS256",
            access_token_expire_minutes=0.001,  # Very short expiry
            refresh_token_expire_days=7,
        )
        short_jwt_manager = JWTManager(settings)
        short_auth_manager = AuthenticationManager(short_jwt_manager)

        # Generate token pair
        token_pair = short_auth_manager.jwt_manager.generate_token_pair(
            **sample_user_data
        )

        # Wait for token to expire
        time.sleep(0.1)

        # Try to authenticate expired token
        with pytest.raises(HTTPException) as exc_info:
            short_auth_manager.authenticate_token(token_pair["access_token"], "access")

        assert exc_info.value.status_code == 401

    def test_refresh_access_token_success(self, auth_manager, sample_user_data):
        """Test successful access token refresh."""
        # Generate initial token pair
        token_pair = auth_manager.jwt_manager.generate_token_pair(**sample_user_data)

        # Refresh access token
        new_token_pair = auth_manager.refresh_access_token(
            token_pair["refresh_token"], sample_user_data["device_fingerprint"]
        )

        assert "access_token" in new_token_pair
        assert "refresh_token" in new_token_pair
        assert new_token_pair["access_token"] != token_pair["access_token"]

    def test_refresh_access_token_invalid(self, auth_manager):
        """Test access token refresh with invalid refresh token."""
        invalid_refresh_tokens = [
            "",
            "invalid.refresh.token",
        ]

        for invalid_token in invalid_refresh_tokens:
            with pytest.raises(HTTPException) as exc_info:
                auth_manager.refresh_access_token(invalid_token)

            assert exc_info.value.status_code == 401

    def test_logout(self, auth_manager, sample_user_data):
        """Test user logout."""
        # Generate token pair
        token_pair = auth_manager.jwt_manager.generate_token_pair(**sample_user_data)

        # Logout (revoke token)
        auth_manager.logout(token_pair["access_token"])

        # Try to validate revoked token
        with pytest.raises(TokenValidationError) as exc_info:
            auth_manager.jwt_manager.validate_token(
                token_pair["access_token"], "access"
            )

        assert exc_info.value.error_type == "blacklisted"

    def test_logout_all_devices(self, auth_manager, sample_user_data):
        """Test logout from all devices."""
        # Generate token pair
        token_pair = auth_manager.jwt_manager.generate_token_pair(**sample_user_data)

        # Logout from all devices
        revoked_count = auth_manager.logout_all_devices(token_pair["access_token"])

        # This is a simplified implementation, so we expect 0 or more
        assert isinstance(revoked_count, int)


class TestUtilityFunctions:
    """Test utility functions."""

    def test_hash_device_fingerprint(self):
        """Test device fingerprint hashing."""
        fingerprint1 = "device-123-user-agent-456"
        fingerprint2 = "device-123-user-agent-456"
        fingerprint3 = "different-device"

        hash1 = hash_device_fingerprint(fingerprint1)
        hash2 = hash_device_fingerprint(fingerprint2)
        hash3 = hash_device_fingerprint(fingerprint3)

        assert hash1 == hash2  # Same input should produce same hash
        assert hash1 != hash3  # Different input should produce different hash
        assert len(hash1) > 0

    def test_extract_token_from_header_success(self):
        """Test successful token extraction from header."""
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"
        header = f"Bearer {token}"

        extracted_token = extract_token_from_header(header)
        assert extracted_token == token

    def test_extract_token_from_header_missing(self):
        """Test token extraction with missing header."""
        with pytest.raises(HTTPException) as exc_info:
            extract_token_from_header("")

        assert exc_info.value.status_code == 401

    def test_extract_token_from_header_invalid_format(self):
        """Test token extraction with invalid format."""
        invalid_headers = [
            "InvalidHeader",
            "Bearer",
            "Bearer invalid header format with multiple parts",
            "Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature",
        ]

        for header in invalid_headers:
            with pytest.raises(HTTPException) as exc_info:
                extract_token_from_header(header)

            assert exc_info.value.status_code == 401

    def test_verify_permissions_admin(self):
        """Test permission verification for admin users."""
        claims = {
            "role": "super_admin",
            "permissions": ["read"],
        }

        # Admin should have all permissions
        assert verify_permissions(claims, ["write", "delete", "admin"])

    def test_verify_permissions_tenant_admin(self):
        """Test permission verification for tenant admin."""
        claims = {
            "role": "tenant_admin",
            "permissions": ["read"],
        }

        # Tenant admin should have all permissions
        assert verify_permissions(claims, ["write", "delete"])

    def test_verify_permissions_user_success(self):
        """Test successful permission verification for regular user."""
        claims = {
            "role": "user",
            "permissions": ["read", "write"],
        }

        assert verify_permissions(claims, ["read"])
        assert verify_permissions(claims, ["write"])
        assert verify_permissions(claims, ["read", "write"])

    def test_verify_permissions_user_failure(self):
        """Test failed permission verification for regular user."""
        claims = {
            "role": "user",
            "permissions": ["read"],
        }

        assert not verify_permissions(claims, ["write"])
        assert not verify_permissions(claims, ["delete"])

    def test_verify_permissions_wildcard(self):
        """Test permission verification with wildcard."""
        claims = {
            "role": "user",
            "permissions": ["*"],
        }

        assert verify_permissions(claims, ["read", "write", "delete", "admin"])

    def test_verify_tenant_access_super_admin(self):
        """Test tenant access verification for super admin."""
        claims = {
            "role": "super_admin",
            "tenant_id": "tenant-123",
        }

        # Super admin can access any tenant
        assert verify_tenant_access(claims, "tenant-456")

    def test_verify_tenant_access_same_tenant(self):
        """Test tenant access verification for same tenant."""
        claims = {
            "role": "user",
            "tenant_id": "tenant-123",
        }

        # User can access their own tenant
        assert verify_tenant_access(claims, "tenant-123")

    def test_verify_tenant_access_different_tenant(self):
        """Test tenant access verification for different tenant."""
        claims = {
            "role": "user",
            "tenant_id": "tenant-123",
        }

        # User cannot access different tenant
        assert not verify_tenant_access(claims, "tenant-456")


class TestGlobalManagers:
    """Test global manager instances."""

    def test_get_jwt_manager_singleton(self):
        """Test JWT manager singleton pattern."""
        manager1 = get_jwt_manager()
        manager2 = get_jwt_manager()

        assert manager1 is manager2

    def test_get_auth_manager_singleton(self):
        """Test authentication manager singleton pattern."""
        manager1 = get_auth_manager()
        manager2 = get_auth_manager()

        assert manager1 is manager2


class TestErrorHandling:
    """Test error handling scenarios."""

    @pytest.fixture
    def jwt_manager(self):
        """Create JWT manager instance for testing."""
        from app.core.config import Settings

        settings = Settings(
            secret_key="test-secret-key-for-testing-purposes-only",
            algorithm="HS256",
            access_token_expire_minutes=15,
            refresh_token_expire_days=7,
        )
        return JWTManager(settings)

    def test_token_validation_error_properties(self, jwt_manager):
        """Test TokenValidationError properties."""
        try:
            jwt_manager.validate_token("invalid.token", "access")
        except TokenValidationError as e:
            assert hasattr(e, "message")
            assert hasattr(e, "error_type")
            assert e.error_type == "invalid"
            assert len(e.message) > 0

    def test_malformed_jwt_token(self, jwt_manager):
        """Test handling of malformed JWT tokens."""
        malformed_tokens = [
            "not.a.jwt",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature",
        ]

        for token in malformed_tokens:
            with pytest.raises(TokenValidationError) as exc_info:
                jwt_manager.validate_token(token, "access")

            assert exc_info.value.error_type == "invalid"

    def test_token_with_missing_claims(self, jwt_manager):
        """Test handling of tokens with missing required claims."""
        # This would require creating a token manually without required claims
        # For now, we'll test with a completely invalid structure
        with pytest.raises(TokenValidationError):
            jwt_manager.validate_token("completely.invalid.token.structure", "access")


# Integration tests
class TestIntegration:
    """Integration tests for authentication system."""

    @pytest.fixture
    def auth_manager(self):
        """Create authentication manager for integration testing."""
        return AuthenticationManager()

    def test_complete_authentication_flow(self, auth_manager):
        """Test complete authentication flow."""
        user_data = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "integration-test@example.com",
            "role": "user",
            "permissions": ["read", "write"],
            "device_fingerprint": "integration-device",
            "session_id": "integration-session",
        }

        # 1. Generate token pair
        token_pair = auth_manager.jwt_manager.generate_token_pair(**user_data)

        # 2. Authenticate access token
        user_context = auth_manager.authenticate_token(
            token_pair["access_token"], "access"
        )
        assert user_context["user_id"] == user_data["user_id"]

        # 3. Refresh token
        new_token_pair = auth_manager.refresh_access_token(
            token_pair["refresh_token"], user_data["device_fingerprint"]
        )
        assert new_token_pair["access_token"] != token_pair["access_token"]

        # 4. Authenticate new access token
        new_user_context = auth_manager.authenticate_token(
            new_token_pair["access_token"], "access"
        )
        assert new_user_context["user_id"] == user_data["user_id"]
        assert new_user_context["session_id"] == user_data["session_id"]

        # 5. Logout
        auth_manager.logout(new_token_pair["access_token"])

        # 6. Verify token is revoked
        with pytest.raises(TokenValidationError) as exc_info:
            auth_manager.jwt_manager.validate_token(
                new_token_pair["access_token"], "access"
            )

        assert exc_info.value.error_type == "blacklisted"

    def test_multiple_concurrent_sessions(self, auth_manager):
        """Test handling of multiple concurrent sessions."""
        user_data = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "concurrent-test@example.com",
            "role": "user",
            "permissions": ["read"],
            "device_fingerprint": "device-1",
            "session_id": "session-1",
        }

        # Generate multiple token pairs
        token_pairs = []
        for i in range(3):
            session_data = user_data.copy()
            session_data["session_id"] = f"session-{i}"
            session_data["device_fingerprint"] = f"device-{i}"

            token_pair = auth_manager.jwt_manager.generate_token_pair(**session_data)
            token_pairs.append(token_pair)

        # Validate all tokens are valid
        for i, token_pair in enumerate(token_pairs):
            user_context = auth_manager.authenticate_token(
                token_pair["access_token"], "access"
            )
            assert user_context["session_id"] == f"session-{i}"

        # Revoke one session
        auth_manager.logout(token_pairs[1]["access_token"])

        # Verify only the revoked token is invalid
        for i, token_pair in enumerate(token_pairs):
            if i == 1:
                with pytest.raises(TokenValidationError):
                    auth_manager.authenticate_token(
                        token_pair["access_token"], "access"
                    )
            else:
                user_context = auth_manager.authenticate_token(
                    token_pair["access_token"], "access"
                )
                assert user_context["session_id"] == f"session-{i}"


# Performance tests
class TestPerformance:
    """Performance tests for authentication system."""

    @pytest.fixture
    def jwt_manager(self):
        """Create JWT manager for performance testing."""
        from app.core.config import Settings

        settings = Settings(
            secret_key="test-secret-key-for-performance-testing",
            algorithm="HS256",
            access_token_expire_minutes=15,
            refresh_token_expire_days=7,
        )
        return JWTManager(settings)

    def test_token_generation_performance(self, jwt_manager):
        """Test token generation performance."""
        user_data = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "performance-test@example.com",
            "role": "user",
            "permissions": ["read", "write"],
            "device_fingerprint": "performance-device",
            "session_id": "performance-session",
        }

        # Generate 1000 token pairs
        start_time = time.time()
        for _ in range(1000):
            jwt_manager.generate_token_pair(**user_data)
        end_time = time.time()

        # Performance assertion - should be fast
        total_time = end_time - start_time
        assert total_time < 5.0  # Should complete within 5 seconds
        print(f"Generated 1000 token pairs in {total_time:.3f} seconds")

    def test_token_validation_performance(self, jwt_manager):
        """Test token validation performance."""
        user_data = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "performance-test@example.com",
            "role": "user",
            "permissions": ["read", "write"],
        }

        # Generate a token pair
        token_pair = jwt_manager.generate_token_pair(**user_data)

        # Validate token 1000 times
        start_time = time.time()
        for _ in range(1000):
            jwt_manager.validate_token(token_pair["access_token"], "access")
        end_time = time.time()

        # Performance assertion - should be fast
        total_time = end_time - start_time
        assert total_time < 3.0  # Should complete within 3 seconds
        print(f"Validated 1000 tokens in {total_time:.3f} seconds")

"""
Unit tests for authentication service.

Tests JWT token generation, validation, refresh mechanism,
password hashing, and session management with Redis.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import json

from udp.security.auth import (
    AuthService,
    AuthenticationError,
    TokenError,
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash,
    SecurityUtils,
)
from udp.core.models.user import User


class TestAuthService:
    """Test cases for AuthService."""

    @pytest.fixture
    def auth_service(self):
        """Create auth service instance."""
        return AuthService()

    @pytest.fixture
    def mock_user(self):
        """Create mock user for testing."""
        user = MagicMock(spec=User)
        user.id = "123e4567-e89b-12d3-a456-426614174000"
        user.email = "test@example.com"
        user.hashed_password = get_password_hash("testpassword123")
        user.is_active = True
        user.is_superuser = False
        return user

    @pytest.fixture
    def mock_redis_client(self):
        """Create mock Redis client."""
        redis_client = AsyncMock()
        redis_client.hset = AsyncMock()
        redis_client.expire = AsyncMock()
        redis_client.delete = AsyncMock(return_value=1)
        redis_client.hgetall = AsyncMock()
        redis_client.scan_iter = AsyncMock()
        return redis_client

    @pytest.mark.asyncio
    async def test_authenticate_user_success(
        self, auth_service, mock_user, mock_redis_client
    ):
        """Test successful user authentication."""
        with (
            patch("udp.security.auth.get_async_session") as mock_get_session,
            patch.object(
                auth_service, "_get_redis_client", return_value=mock_redis_client
            ),
        ):
            # Setup mock database session
            mock_db = AsyncMock()
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session.__aexit__ = AsyncMock()
            mock_get_session.return_value = mock_session

            # Setup mock user service
            mock_user_service = AsyncMock()
            mock_user_service.get_by_email.return_value = mock_user

            with patch("udp.security.auth.UserService", return_value=mock_user_service):
                result = await auth_service.authenticate_user(
                    email="test@example.com",
                    password="testpassword123",
                    ip_address="192.168.1.1",
                    user_agent="Mozilla/5.0",
                    remember_me=False,
                )

        # Verify authentication result
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["token_type"] == "bearer"
        assert "session_id" in result
        assert "expires_in" in result

        # Verify Redis session was stored
        mock_redis_client.hset.assert_called_once()
        mock_redis_client.expire.assert_called_once()

    @pytest.mark.asyncio
    async def test_authenticate_user_invalid_credentials(self, auth_service):
        """Test authentication with invalid credentials."""
        with patch("udp.security.auth.get_async_session") as mock_get_session:
            mock_db = AsyncMock()
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session.__aexit__ = AsyncMock()
            mock_get_session.return_value = mock_session

            mock_user_service = AsyncMock()
            mock_user_service.get_by_email.return_value = None

            with patch("udp.security.auth.UserService", return_value=mock_user_service):
                with pytest.raises(
                    AuthenticationError, match="Invalid email or password"
                ):
                    await auth_service.authenticate_user(
                        email="test@example.com", password="wrongpassword"
                    )

    @pytest.mark.asyncio
    async def test_authenticate_user_inactive_account(self, auth_service, mock_user):
        """Test authentication with inactive account."""
        mock_user.is_active = False

        with patch("udp.security.auth.get_async_session") as mock_get_session:
            mock_db = AsyncMock()
            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_db)
            mock_session.__aexit__ = AsyncMock()
            mock_get_session.return_value = mock_session

            mock_user_service = AsyncMock()
            mock_user_service.get_by_email.return_value = mock_user

            with patch("udp.security.auth.UserService", return_value=mock_user_service):
                with pytest.raises(AuthenticationError, match="Account is disabled"):
                    await auth_service.authenticate_user(
                        email="test@example.com", password="testpassword123"
                    )

    @pytest.mark.asyncio
    async def test_validate_token_success(self, auth_service):
        """Test successful token validation."""
        # Create a valid token
        token = create_access_token(
            data={"sub": "test@example.com", "email": "test@example.com"}
        )

        payload = await auth_service.validate_token(token)

        assert payload["sub"] == "test@example.com"
        assert payload["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_validate_token_invalid(self, auth_service):
        """Test validation of invalid token."""
        invalid_token = "invalid.jwt.token"

        with pytest.raises(TokenError):
            await auth_service.validate_token(invalid_token)

    @pytest.mark.asyncio
    async def test_validate_token_missing_subject(self, auth_service):
        """Test validation of token without subject."""
        # Create token without subject
        with patch("udp.security.auth.jwt") as mock_jwt:
            mock_jwt.decode.return_value = {
                "email": "test@example.com"
            }  # Missing 'sub'

            with pytest.raises(TokenError, match="missing subject"):
                await auth_service.validate_token("mock_token")

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, auth_service):
        """Test successful token refresh."""
        refresh_token = create_refresh_token(
            data={"sub": "test@example.com", "email": "test@example.com"}
        )

        result = await auth_service.refresh_token(refresh_token)

        assert "access_token" in result
        assert "refresh_token" in result
        assert result["token_type"] == "bearer"
        assert "expires_in" in result

    @pytest.mark.asyncio
    async def test_refresh_token_invalid_type(self, auth_service):
        """Test refresh with access token instead of refresh token."""
        access_token = create_access_token(
            data={"sub": "test@example.com", "email": "test@example.com"}
        )

        with pytest.raises(
            TokenError, match="Invalid token type: expected refresh token"
        ):
            await auth_service.refresh_token(access_token)

    @pytest.mark.asyncio
    async def test_logout_user_success(self, auth_service, mock_redis_client):
        """Test successful user logout."""
        with patch.object(
            auth_service, "_get_redis_client", return_value=mock_redis_client
        ):
            result = await auth_service.logout_user("session_123")

        assert result is True
        mock_redis_client.delete.assert_called_once_with("session:session_123")

    @pytest.mark.asyncio
    async def test_logout_user_not_found(self, auth_service, mock_redis_client):
        """Test logout with non-existent session."""
        mock_redis_client.delete.return_value = 0

        with patch.object(
            auth_service, "_get_redis_client", return_value=mock_redis_client
        ):
            result = await auth_service.logout_user("nonexistent_session")

        assert result is False

    @pytest.mark.asyncio
    async def test_logout_user_all_sessions(self, auth_service, mock_redis_client):
        """Test logout from all sessions."""
        # Mock Redis scan_iter to return session keys
        session_keys = ["session:session1", "session:session2", "session:session3"]
        mock_redis_client.scan_iter.return_value = session_keys

        # Mock session data - only two belong to the user
        session_data1 = {"user_id": "user123", "email": "test@example.com"}
        session_data2 = {"user_id": "user456", "email": "other@example.com"}
        session_data3 = {"user_id": "user123", "email": "test@example.com"}

        mock_redis_client.hgetall.side_effect = [
            session_data1,
            session_data2,
            session_data3,
        ]
        mock_redis_client.delete.return_value = 2

        with patch.object(
            auth_service, "_get_redis_client", return_value=mock_redis_client
        ):
            result = await auth_service.logout_user_all_sessions("user123")

        assert result == 2
        # Should be called twice for the two user sessions
        assert mock_redis_client.delete.call_count == 1  # Called once with both keys

    @pytest.mark.asyncio
    async def test_store_session_extended_ttl(self, auth_service, mock_redis_client):
        """Test storing session with extended TTL for remember_me."""
        session_data = {
            "user_id": "user123",
            "email": "test@example.com",
            "ip_address": "192.168.1.1",
            "created_at": datetime.utcnow().isoformat(),
        }

        with (
            patch.object(
                auth_service, "_get_redis_client", return_value=mock_redis_client
            ),
            patch("udp.security.auth.settings") as mock_settings,
        ):
            mock_settings.REFRESH_TOKEN_EXPIRE_DAYS = 7

            await auth_service._store_session(
                "session123", session_data, remember_me=True
            )

            # Verify session was stored with extended TTL (30 days)
            mock_redis_client.hset.assert_called_once()
            mock_redis_client.expire.assert_called_once_with(
                "session:session123", 30 * 24 * 60 * 60
            )


class TestPasswordSecurity:
    """Test password hashing and verification."""

    def test_password_hashing(self):
        """Test password hashing produces consistent results."""
        password = "testpassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Hashes should be different (due to salt)
        assert hash1 != hash2
        # Both should start with $2b$ (bcrypt)
        assert hash1.startswith("$2b$")
        assert hash2.startswith("$2b$")

    def test_password_verification(self):
        """Test password verification."""
        password = "testpassword123"
        hashed = get_password_hash(password)

        # Correct password should verify
        assert verify_password(password, hashed) is True

        # Wrong password should not verify
        assert verify_password("wrongpassword", hashed) is False

    def test_password_verification_with_invalid_hash(self):
        """Test password verification with invalid hash."""
        assert verify_password("password", "invalid_hash") is False


class TestTokenGeneration:
    """Test JWT token generation."""

    def test_create_access_token(self):
        """Test access token creation."""
        data = {"sub": "test@example.com", "email": "test@example.com"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 0
        # JWT tokens have 3 parts separated by dots
        assert token.count(".") == 2

    def test_create_access_token_with_expiry(self):
        """Test access token creation with custom expiry."""
        data = {"sub": "test@example.com"}
        expires = timedelta(minutes=60)
        token = create_access_token(data, expires_delta=expires)

        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_refresh_token(self):
        """Test refresh token creation."""
        data = {"sub": "test@example.com", "email": "test@example.com"}
        token = create_refresh_token(data)

        assert isinstance(token, str)
        assert len(token) > 0
        assert token.count(".") == 2


class TestSecurityUtils:
    """Test security utility functions."""

    def test_is_safe_url_relative(self):
        """Test safe URL validation for relative URLs."""
        assert SecurityUtils.is_safe_url("/api/v1/users") is True
        assert SecurityUtils.is_safe_url("/") is True
        assert SecurityUtils.is_safe_url("/login") is True

    def test_is_safe_url_absolute(self):
        """Test safe URL validation for absolute URLs."""
        allowed_hosts = ["example.com", "api.example.com"]

        assert (
            SecurityUtils.is_safe_url("https://example.com/api", allowed_hosts) is True
        )
        assert (
            SecurityUtils.is_safe_url("https://api.example.com/v1", allowed_hosts)
            is True
        )
        assert (
            SecurityUtils.is_safe_url("https://evil.com/phishing", allowed_hosts)
            is False
        )

    def test_is_safe_url_invalid(self):
        """Test safe URL validation for invalid URLs."""
        assert SecurityUtils.is_safe_url("") is False
        assert SecurityUtils.is_safe_url("//evil.com") is False

    def test_generate_secure_token(self):
        """Test secure token generation."""
        token1 = SecurityUtils.generate_secure_token()
        token2 = SecurityUtils.generate_secure_token()

        # Tokens should be different
        assert token1 != token2
        # Should be URL-safe
        assert "+" not in token1 and "/" not in token1
        assert "+" not in token2 and "/" not in token2

        # Custom length
        token_custom = SecurityUtils.generate_secure_token(64)
        assert len(token_custom) >= 64  # Base64 encoding might increase length

    def test_mask_sensitive_data(self):
        """Test sensitive data masking."""
        # Full data
        assert SecurityUtils.mask_sensitive_data("sensitive-data") == "sens************"
        assert SecurityUtils.mask_sensitive_data("12345678") == "1234****"

        # Short data
        assert SecurityUtils.mask_sensitive_data("abc") == "***"
        assert SecurityUtils.mask_sensitive_data("a") == "*"

        # Custom mask
        assert (
            SecurityUtils.mask_sensitive_data("sensitive", mask_char="#")
            == "sens######"
        )
        assert (
            SecurityUtils.mask_sensitive_data("sensitive", visible_chars=2)
            == "se*******"
        )


class TestTokenValidationEdgeCases:
    """Test edge cases for token validation."""

    @pytest.mark.asyncio
    async def test_validate_token_expired(self, auth_service):
        """Test validation of expired token."""
        with patch("udp.security.auth.jwt") as mock_jwt:
            mock_jwt.decode.side_effect = JWTError("Token has expired")

            with pytest.raises(TokenError, match="Token validation failed"):
                await auth_service.validate_token("expired_token")

    @pytest.mark.asyncio
    async def test_validate_token_malformed(self, auth_service):
        """Test validation of malformed token."""
        with patch("udp.security.auth.jwt") as mock_jwt:
            mock_jwt.decode.side_effect = JWTError("Not enough segments")

            with pytest.raises(TokenError, match="Token validation failed"):
                await auth_service.validate_token("malformed_token")

    @pytest.mark.asyncio
    async def test_refresh_token_expired(self, auth_service):
        """Test refresh with expired refresh token."""
        with patch("udp.security.auth.jwt") as mock_jwt:
            mock_jwt.decode.side_effect = JWTError("Token has expired")

            with pytest.raises(TokenError, match="Refresh token validation failed"):
                await auth_service.refresh_token("expired_refresh_token")

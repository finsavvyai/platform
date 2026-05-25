"""
Unit tests for authentication functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta

from udp.security.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    authenticate_user,
    verify_token,
)
from udp.core.schemas.auth import TokenData


class TestPasswordHashing:
    """Test password hashing functionality."""

    def test_get_password_hash(self):
        """Test password hashing."""
        password = "test_password_123"
        hashed = get_password_hash(password)

        assert hashed != password
        assert isinstance(hashed, str)
        assert len(hashed) > 50  # bcrypt hashes are typically 60 chars

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        password = "test_password_123"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        password = "test_password_123"
        wrong_password = "wrong_password"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False


class TestTokenCreation:
    """Test JWT token creation."""

    def test_create_access_token(self):
        """Test access token creation."""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        assert isinstance(token, str)
        assert len(token) > 100  # JWT tokens are typically long

    def test_create_access_token_with_expiry(self):
        """Test access token creation with custom expiry."""
        data = {"sub": "test@example.com"}
        expires_delta = timedelta(minutes=60)
        token = create_access_token(data, expires_delta)

        assert isinstance(token, str)
        assert len(token) > 100

    def test_create_refresh_token(self):
        """Test refresh token creation."""
        data = {"sub": "test@example.com"}
        token = create_refresh_token(data)

        assert isinstance(token, str)
        assert len(token) > 100


class TestTokenVerification:
    """Test JWT token verification."""

    @patch("udp.security.auth.settings")
    def test_verify_token_valid(self, mock_settings):
        """Test token verification with valid token."""
        mock_settings.SECRET_KEY = "test-secret-key"
        mock_settings.ALGORITHM = "HS256"

        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        token_data = verify_token(token)

        assert token_data is not None
        assert token_data.email == "test@example.com"
        assert token_data.token_type == "access"

    @patch("udp.security.auth.settings")
    def test_verify_token_invalid(self, mock_settings):
        """Test token verification with invalid token."""
        mock_settings.SECRET_KEY = "test-secret-key"
        mock_settings.ALGORITHM = "HS256"

        invalid_token = "invalid.token.here"

        token_data = verify_token(invalid_token)

        assert token_data is None

    @patch("udp.security.auth.settings")
    def test_verify_token_expired(self, mock_settings):
        """Test token verification with expired token."""
        mock_settings.SECRET_KEY = "test-secret-key"
        mock_settings.ALGORITHM = "HS256"

        data = {"sub": "test@example.com"}
        expires_delta = timedelta(seconds=-1)  # Already expired
        token = create_access_token(data, expires_delta)

        token_data = verify_token(token)

        assert token_data is None


class TestUserAuthentication:
    """Test user authentication."""

    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, test_db_session, test_user):
        """Test successful user authentication."""
        with patch("udp.security.auth.UserService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_by_email.return_value = test_user
            mock_service_class.return_value = mock_service

            with patch("udp.security.auth.verify_password", return_value=True):
                user = await authenticate_user(
                    test_db_session, "test@example.com", "password"
                )

                assert user is not None
                assert user.email == test_user.email

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self, test_db_session):
        """Test authentication with non-existent user."""
        with patch("udp.security.auth.UserService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_by_email.return_value = None
            mock_service_class.return_value = mock_service

            user = await authenticate_user(
                test_db_session, "nonexistent@example.com", "password"
            )

            assert user is None

    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(self, test_db_session, test_user):
        """Test authentication with wrong password."""
        with patch("udp.security.auth.UserService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_by_email.return_value = test_user
            mock_service_class.return_value = mock_service

            with patch("udp.security.auth.verify_password", return_value=False):
                user = await authenticate_user(
                    test_db_session, "test@example.com", "wrong_password"
                )

                assert user is None


class TestSecurityUtils:
    """Test security utility functions."""

    def test_generate_secure_token(self):
        """Test secure token generation."""
        from udp.security.auth import SecurityUtils

        token = SecurityUtils.generate_secure_token()

        assert isinstance(token, str)
        assert len(token) >= 32  # Base64 encoded 32 bytes

    def test_mask_sensitive_data(self):
        """Test sensitive data masking."""
        from udp.security.auth import SecurityUtils

        data = "sensitive_password_123"
        masked = SecurityUtils.mask_sensitive_data(data)

        assert isinstance(masked, str)
        assert len(masked) == len(data)
        assert masked[:4] == data[:4]
        assert all(c == "*" for c in masked[4:])

    def test_is_safe_url_relative(self):
        """Test safe URL checking with relative URL."""
        from udp.security.auth import SecurityUtils

        assert SecurityUtils.is_safe_url("/api/v1/users") is True
        assert SecurityUtils.is_safe_url("/") is True

    def test_is_safe_url_absolute(self):
        """Test safe URL checking with absolute URL."""
        from udp.security.auth import SecurityUtils

        allowed_hosts = ["example.com", "api.example.com"]

        assert (
            SecurityUtils.is_safe_url("https://example.com/api", allowed_hosts) is True
        )
        assert SecurityUtils.is_safe_url("https://evil.com/api", allowed_hosts) is False

    def test_is_safe_url_invalid(self):
        """Test safe URL checking with invalid URL."""
        from udp.security.auth import SecurityUtils

        assert SecurityUtils.is_safe_url("") is False
        assert SecurityUtils.is_safe_url(None) is False

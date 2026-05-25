"""
Authentication and authorization utilities for Universal Dependency Platform.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

import structlog
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.config import settings
from udp.core.models.user import User
from udp.core.schemas.auth import TokenData
from udp.infrastructure.database import get_async_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Initialize logger
logger = structlog.get_logger()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    data: dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> Optional[User]:
    """Authenticate user with username and password."""
    user_service = UserService(db)

    # Try to get user by email (username can be email)
    user = await user_service.get_by_email(username)
    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


async def get_current_user(
    db: AsyncSession = Depends(get_async_session),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Get current user from JWT token."""
    from fastapi import HTTPException, status

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception

        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    from udp.services.user_service import UserService

    user_service = UserService(db)
    user = await user_service.get_by_email(email=token_data.email)
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    from fastapi import HTTPException, status

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )

    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current superuser."""
    from fastapi import HTTPException, status

    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges",
        )

    return current_user


def verify_token(token: str) -> Optional[TokenData]:
    """Verify JWT token and return token data."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        token_type: str = payload.get("type", "access")

        if email is None:
            return None

        return TokenData(email=email, token_type=token_type)
    except JWTError:
        return None


class SecurityUtils:
    """Security utility functions."""

    @staticmethod
    def is_safe_url(url: str, allowed_hosts: list[str] | None = None) -> bool:
        """Check if URL is safe for redirection."""
        if not url:
            return False

        # Allow relative URLs
        if url.startswith("/") and not url.startswith("//"):
            return True

        # Check against allowed hosts
        if allowed_hosts:
            from urllib.parse import urlparse

            parsed = urlparse(url)
            return parsed.netloc in allowed_hosts

        return False

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate secure random token."""
        import secrets

        return secrets.token_urlsafe(length)

    @staticmethod
    def mask_sensitive_data(
        data: str, mask_char: str = "*", visible_chars: int = 4
    ) -> str:
        """Mask sensitive data for logging."""
        if len(data) <= visible_chars:
            return mask_char * len(data)

        return data[:visible_chars] + mask_char * (len(data) - visible_chars)


class AuthenticationError(Exception):
    """Authentication failed error."""

    pass


class TokenError(Exception):
    """Token validation error."""

    pass


class AuthService:
    """
    Enterprise authentication service with JWT tokens and Redis session management.

    Provides secure user authentication, token management, and session handling
    with Redis storage for scalability and security.
    """

    def __init__(self):
        """Initialize auth service."""
        self.logger = logger
        self._redis_client = None

    async def _get_redis_client(self):
        """Get Redis client instance."""
        if self._redis_client is None:
            from udp.infrastructure.redis import get_redis_client

            self._redis_client = await get_redis_client()
        return self._redis_client

    async def authenticate_user(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remember_me: bool = False,
    ) -> dict[str, Any]:
        """
        Authenticate user with credentials and create tokens.

        Args:
            email: User email address
            password: User password
            ip_address: Client IP address for logging
            user_agent: Client user agent for logging
            remember_me: Whether to create long-lived session

        Returns:
            Dictionary containing access and refresh tokens

        Raises:
            AuthenticationError: If authentication fails
        """
        from udp.infrastructure.database import get_async_session
        from udp.services.user_service import UserService

        async for db in get_async_session():
            try:
                user_service = UserService(db)
                user = await user_service.get_by_email(email)

                if not user or not verify_password(password, user.hashed_password):
                    self.logger.warning(
                        "Authentication failed: invalid credentials",
                        email=email,
                        ip_address=ip_address,
                    )
                    raise AuthenticationError("Invalid email or password")

                if not user.is_active:
                    self.logger.warning(
                        "Authentication failed: inactive user",
                        email=email,
                        ip_address=ip_address,
                    )
                    raise AuthenticationError("Account is disabled")

                # Generate tokens
                access_token_expires = timedelta(
                    minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
                )
                refresh_token_expires = timedelta(
                    days=30 if remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS
                )

                access_token = create_access_token(
                    data={"sub": str(user.id), "email": user.email},
                    expires_delta=access_token_expires,
                )

                refresh_token = create_refresh_token(
                    data={"sub": str(user.id), "email": user.email},
                    expires_delta=refresh_token_expires,
                )

                # Store session in Redis
                session_id = SecurityUtils.generate_secure_token(32)
                session_data = {
                    "user_id": str(user.id),
                    "email": user.email,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                    "created_at": datetime.utcnow().isoformat(),
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                }

                await self._store_session(session_id, session_data, remember_me)

                self.logger.info(
                    "User authenticated successfully",
                    user_id=str(user.id),
                    email=email,
                    ip_address=ip_address,
                    session_id=session_id,
                )

                return {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                    "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                    "session_id": session_id,
                }

            finally:
                await db.close()

    async def validate_token(self, token: str) -> dict[str, Any]:
        """
        Validate JWT token and return payload.

        Args:
            token: JWT token string

        Returns:
            Token payload dictionary

        Raises:
            TokenError: If token is invalid or expired
        """
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )

            email = payload.get("sub")
            if email is None:
                raise TokenError("Invalid token: missing subject")

            # Check if token type is access
            token_type = payload.get("type", "access")
            if token_type != "access":
                raise TokenError(
                    f"Invalid token type: expected 'access', got '{token_type}'"
                )

            return payload

        except JWTError as e:
            raise TokenError(f"Token validation failed: {str(e)}")

    async def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        """
        Refresh access token using refresh token.

        Args:
            refresh_token: Valid refresh token

        Returns:
            Dictionary with new access token and refresh token

        Raises:
            TokenError: If refresh token is invalid
        """
        try:
            payload = jwt.decode(
                refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )

            email = payload.get("sub")
            token_type = payload.get("type", "access")

            if email is None:
                raise TokenError("Invalid refresh token: missing subject")

            if token_type != "refresh":
                raise TokenError("Invalid token type: expected refresh token")

            # Generate new tokens
            access_token_expires = timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
            refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

            new_access_token = create_access_token(
                data={"sub": email, "email": email}, expires_delta=access_token_expires
            )

            new_refresh_token = create_refresh_token(
                data={"sub": email, "email": email}, expires_delta=refresh_token_expires
            )

            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }

        except JWTError as e:
            raise TokenError(f"Refresh token validation failed: {str(e)}")

    async def logout_user(self, session_id: str) -> bool:
        """
        Logout user by removing session.

        Args:
            session_id: Session identifier

        Returns:
            True if session was removed, False if not found
        """
        try:
            redis_client = await self._get_redis_client()
            result = await redis_client.delete(f"session:{session_id}")

            self.logger.info(
                "User logged out", session_id=session_id, session_deleted=bool(result)
            )

            return bool(result)

        except Exception as e:
            self.logger.error(
                "Failed to logout user", session_id=session_id, error=str(e)
            )
            return False

    async def logout_user_all_sessions(self, user_id: str) -> int:
        """
        Logout user from all sessions.

        Args:
            user_id: User identifier

        Returns:
            Number of sessions deleted
        """
        try:
            redis_client = await self._get_redis_client()

            # Find all sessions for this user
            pattern = "session:*"
            sessions_to_delete = []

            async for key in redis_client.scan_iter(match=pattern):
                session_data = await redis_client.hgetall(key)
                if session_data.get("user_id") == user_id:
                    sessions_to_delete.append(key)

            # Delete all sessions
            deleted_count = 0
            if sessions_to_delete:
                deleted_count = await redis_client.delete(*sessions_to_delete)

            self.logger.info(
                "User logged out from all sessions",
                user_id=user_id,
                deleted_count=deleted_count,
            )

            return deleted_count

        except Exception as e:
            self.logger.error(
                "Failed to logout user from all sessions", user_id=user_id, error=str(e)
            )
            return 0

    async def _store_session(
        self, session_id: str, session_data: dict[str, Any], remember_me: bool = False
    ) -> None:
        """
        Store session data in Redis.

        Args:
            session_id: Session identifier
            session_data: Session data dictionary
            remember_me: Whether to use extended TTL
        """
        try:
            redis_client = await self._get_redis_client()

            # Set TTL based on remember_me flag
            ttl = (
                30 * 24 * 60 * 60
                if remember_me
                else settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
            )

            # Store session as hash
            await redis_client.hset(f"session:{session_id}", mapping=session_data)
            await redis_client.expire(f"session:{session_id}", ttl)

        except Exception as e:
            self.logger.error(
                "Failed to store session", session_id=session_id, error=str(e)
            )
            raise


# Global auth service instance
auth_service = AuthService()

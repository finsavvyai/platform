"""
Authentication utilities and JWT token management
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class AuthenticationError(Exception):
    """Authentication related errors"""
    pass


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError as e:
        logger.error(f"Token verification failed: {e}")
        raise AuthenticationError("Invalid token")


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password"""
    try:
        # Get user by email
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"Authentication failed: user not found for email {email}")
            return None
        
        if not user.is_active:
            logger.warning(f"Authentication failed: user {email} is not active")
            return None
        
        if not verify_password(password, user.hashed_password):
            logger.warning(f"Authentication failed: invalid password for user {email}")
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        await db.commit()
        
        logger.info(f"User {email} authenticated successfully")
        return user
        
    except Exception as e:
        logger.error(f"Authentication error for user {email}: {e}")
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = verify_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except AuthenticationError:
        raise credentials_exception
    
    # Get user from database
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if user is None:
            raise credentials_exception
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user"
            )
        
        return user
        
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise credentials_exception


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(current_user: User = Depends(get_current_user)) -> User:
    """Get the current superuser"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def check_user_permissions(user: User, required_permissions: list) -> bool:
    """Check if user has required permissions"""
    # For now, we'll use a simple role-based system
    # This can be expanded to a more granular permission system later
    
    if user.is_superuser:
        return True
    
    # Define role-based permissions
    role_permissions = {
        "admin": ["read", "write", "delete", "manage_users", "manage_workflows"],
        "user": ["read", "write", "create_workflows", "execute_workflows"],
        "viewer": ["read"]
    }
    
    # Get user role from subscription tier or explicit role
    user_role = getattr(user, 'role', user.subscription_tier)
    if user_role == "enterprise":
        user_role = "admin"
    elif user_role in ["pro", "free"]:
        user_role = "user"
    
    user_permissions = role_permissions.get(user_role, [])
    
    # Check if user has all required permissions
    return all(perm in user_permissions for perm in required_permissions)


class PermissionChecker:
    """Dependency class for checking permissions"""
    
    def __init__(self, required_permissions: list):
        self.required_permissions = required_permissions
    
    def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if not check_user_permissions(current_user, self.required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user


# Common permission dependencies
require_read = PermissionChecker(["read"])
require_write = PermissionChecker(["write"])
require_admin = PermissionChecker(["manage_users"])
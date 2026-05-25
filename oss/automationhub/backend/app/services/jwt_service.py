"""
Enhanced JWT Service with refresh token rotation and security features
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
import secrets
import hashlib
import logging

from app.core.config import settings
from app.models.user import User
from app.core.database import Base
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

logger = logging.getLogger(__name__)


class RefreshToken(Base):
    """Refresh token model for secure token rotation"""
    
    __tablename__ = "refresh_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, nullable=True)
    device_info = Column(String, nullable=True)  # User agent or device identifier


class JWTService:
    """Enhanced JWT service with refresh token rotation"""
    
    def __init__(self):
        self.algorithm = "HS256"
        self.access_token_expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        self.refresh_token_expire = timedelta(days=30)  # 30 days for refresh tokens
    
    def create_access_token(
        self, 
        data: Dict[str, Any], 
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token with enhanced security"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + self.access_token_expire
        
        # Add standard JWT claims
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "iss": settings.APP_NAME,
            "aud": "upm-plus-api",
            "jti": secrets.token_urlsafe(32)  # JWT ID for token tracking
        })
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self) -> str:
        """Create a secure refresh token"""
        return secrets.token_urlsafe(64)
    
    async def store_refresh_token(
        self,
        db: AsyncSession,
        user_id: str,
        refresh_token: str,
        device_info: Optional[str] = None
    ) -> RefreshToken:
        """Store refresh token in database with hash"""
        try:
            # Hash the refresh token for storage
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            
            # Create refresh token record
            db_refresh_token = RefreshToken(
                user_id=user_id,
                token_hash=token_hash,
                expires_at=datetime.utcnow() + self.refresh_token_expire,
                device_info=device_info
            )
            
            db.add(db_refresh_token)
            await db.commit()
            await db.refresh(db_refresh_token)
            
            return db_refresh_token
            
        except Exception as e:
            logger.error(f"Error storing refresh token: {e}")
            await db.rollback()
            raise
    
    async def create_token_pair(
        self,
        db: AsyncSession,
        user: User,
        device_info: Optional[str] = None
    ) -> Tuple[str, str]:
        """Create access and refresh token pair"""
        try:
            # Create access token
            access_token_data = {
                "sub": str(user.id),
                "email": user.email,
                "is_superuser": user.is_superuser,
                "subscription_tier": user.subscription_tier,
                "organization_id": str(user.organization_id) if user.organization_id else None
            }
            
            access_token = self.create_access_token(access_token_data)
            
            # Create and store refresh token
            refresh_token = self.create_refresh_token()
            await self.store_refresh_token(db, str(user.id), refresh_token, device_info)
            
            return access_token, refresh_token
            
        except Exception as e:
            logger.error(f"Error creating token pair for user {user.id}: {e}")
            raise
    
    def verify_access_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode access token"""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[self.algorithm],
                audience="upm-plus-api",
                issuer=settings.APP_NAME
            )
            return payload
        except JWTError as e:
            logger.error(f"Access token verification failed: {e}")
            raise
    
    async def verify_refresh_token(
        self, 
        db: AsyncSession, 
        refresh_token: str
    ) -> Optional[RefreshToken]:
        """Verify refresh token and return token record"""
        try:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            
            # Find refresh token in database
            result = await db.execute(
                select(RefreshToken)
                .where(RefreshToken.token_hash == token_hash)
                .where(RefreshToken.is_revoked == False)
                .where(RefreshToken.expires_at > datetime.utcnow())
            )
            
            db_refresh_token = result.scalar_one_or_none()
            
            if db_refresh_token:
                # Update last used timestamp
                db_refresh_token.last_used = datetime.utcnow()
                await db.commit()
            
            return db_refresh_token
            
        except Exception as e:
            logger.error(f"Error verifying refresh token: {e}")
            return None
    
    async def refresh_access_token(
        self,
        db: AsyncSession,
        refresh_token: str,
        device_info: Optional[str] = None
    ) -> Optional[Tuple[str, str]]:
        """Refresh access token using refresh token rotation"""
        try:
            # Verify current refresh token
            db_refresh_token = await self.verify_refresh_token(db, refresh_token)
            
            if not db_refresh_token:
                return None
            
            # Get user
            result = await db.execute(
                select(User).where(User.id == db_refresh_token.user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user or not user.is_active:
                return None
            
            # Revoke current refresh token (rotation)
            db_refresh_token.is_revoked = True
            
            # Create new token pair
            new_access_token, new_refresh_token = await self.create_token_pair(
                db, user, device_info
            )
            
            await db.commit()
            
            logger.info(f"Token refreshed for user {user.id}")
            return new_access_token, new_refresh_token
            
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            await db.rollback()
            return None
    
    async def revoke_refresh_token(
        self, 
        db: AsyncSession, 
        refresh_token: str
    ) -> bool:
        """Revoke a specific refresh token"""
        try:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            
            result = await db.execute(
                update(RefreshToken)
                .where(RefreshToken.token_hash == token_hash)
                .values(is_revoked=True)
            )
            
            await db.commit()
            return result.rowcount > 0
            
        except Exception as e:
            logger.error(f"Error revoking refresh token: {e}")
            await db.rollback()
            return False
    
    async def revoke_all_user_tokens(
        self, 
        db: AsyncSession, 
        user_id: str
    ) -> bool:
        """Revoke all refresh tokens for a user"""
        try:
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .values(is_revoked=True)
            )
            
            await db.commit()
            logger.info(f"All tokens revoked for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error revoking all tokens for user {user_id}: {e}")
            await db.rollback()
            return False
    
    async def cleanup_expired_tokens(self, db: AsyncSession) -> int:
        """Clean up expired refresh tokens"""
        try:
            result = await db.execute(
                delete(RefreshToken)
                .where(RefreshToken.expires_at < datetime.utcnow())
            )
            
            await db.commit()
            deleted_count = result.rowcount
            
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired refresh tokens")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired tokens: {e}")
            await db.rollback()
            return 0
    
    async def get_user_active_sessions(
        self, 
        db: AsyncSession, 
        user_id: str
    ) -> list:
        """Get active sessions for a user"""
        try:
            result = await db.execute(
                select(RefreshToken)
                .where(RefreshToken.user_id == user_id)
                .where(RefreshToken.is_revoked == False)
                .where(RefreshToken.expires_at > datetime.utcnow())
                .order_by(RefreshToken.last_used.desc())
            )
            
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error getting active sessions for user {user_id}: {e}")
            return []
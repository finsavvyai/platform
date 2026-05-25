"""
Enhanced Authentication Middleware with MFA and RBAC support
"""

from typing import Optional, Callable, List
from fastapi import Request, Response, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.database import get_db
from app.services.jwt_service import JWTService
from app.services.mfa_service import MFAService
from app.services.rbac_service import RBACService, Permission
from app.models.user import User
from sqlalchemy import select

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


class AuthenticationMiddleware:
    """Enhanced authentication middleware"""
    
    def __init__(self):
        self.jwt_service = JWTService()
        self.mfa_service = MFAService()
        self.rbac_service = RBACService()
    
    async def get_current_user(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        """Get current authenticated user with enhanced security"""
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        try:
            # Verify access token
            payload = self.jwt_service.verify_access_token(credentials.credentials)
            user_id: str = payload.get("sub")
            
            if user_id is None:
                raise credentials_exception
            
            # Get user from database
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
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
            logger.error(f"Authentication error: {e}")
            raise credentials_exception
    
    async def get_current_active_user(
        self,
        current_user: User = Depends(get_current_user)
    ) -> User:
        """Get current active user"""
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        return current_user
    
    def require_permissions(
        self, 
        permissions: List[Permission], 
        require_all: bool = True
    ) -> Callable:
        """Decorator to require specific permissions"""
        
        async def permission_checker(
            current_user: User = Depends(self.get_current_active_user),
            db: AsyncSession = Depends(get_db)
        ) -> User:
            # Check if user has required permissions
            has_permission = await self.rbac_service.check_permissions(
                db, str(current_user.id), permissions, require_all
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            
            return current_user
        
        return permission_checker
    
    def require_mfa_if_enabled(self) -> Callable:
        """Decorator to require MFA verification if enabled"""
        
        async def mfa_checker(
            request: Request,
            current_user: User = Depends(self.get_current_active_user)
        ) -> User:
            # Check if MFA is enabled for user
            if self.mfa_service.is_mfa_enabled(current_user):
                # Check if MFA was verified in this session
                mfa_verified = request.session.get("mfa_verified", False)
                mfa_user_id = request.session.get("mfa_user_id")
                
                if not mfa_verified or mfa_user_id != str(current_user.id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="MFA verification required",
                        headers={"X-MFA-Required": "true"}
                    )
            
            return current_user
        
        return mfa_checker
    
    async def verify_mfa_session(
        self,
        request: Request,
        user: User,
        mfa_token: str,
        db: AsyncSession
    ) -> bool:
        """Verify MFA token and set session"""
        try:
            if await self.mfa_service.verify_mfa_token(user, mfa_token):
                # Set MFA verification in session
                request.session["mfa_verified"] = True
                request.session["mfa_user_id"] = str(user.id)
                request.session["mfa_verified_at"] = datetime.utcnow().isoformat()
                
                logger.info(f"MFA verified for user {user.id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"MFA verification error for user {user.id}: {e}")
            return False


# Create global instance
auth_middleware = AuthenticationMiddleware()

# Common dependency functions
get_current_user = auth_middleware.get_current_user
get_current_active_user = auth_middleware.get_current_active_user
require_mfa = auth_middleware.require_mfa_if_enabled()

# Permission-based dependencies
require_admin = auth_middleware.require_permissions([Permission.SYSTEM_ADMIN])
require_user_management = auth_middleware.require_permissions([Permission.USER_MANAGE])
require_workflow_write = auth_middleware.require_permissions([Permission.WORKFLOW_WRITE])
require_workflow_execute = auth_middleware.require_permissions([Permission.WORKFLOW_EXECUTE])
require_document_write = auth_middleware.require_permissions([Permission.DOCUMENT_WRITE])
require_agent_execute = auth_middleware.require_permissions([Permission.AGENT_EXECUTE])
require_infra_deploy = auth_middleware.require_permissions([Permission.INFRA_DEPLOY])

# Combined dependencies
require_admin_with_mfa = auth_middleware.require_permissions([Permission.SYSTEM_ADMIN])
require_workflow_with_mfa = auth_middleware.require_permissions([Permission.WORKFLOW_WRITE])
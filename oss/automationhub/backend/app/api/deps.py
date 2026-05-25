"""
API Dependencies

Common FastAPI dependencies for authentication and database access.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_db_session
from app.middleware.auth_middleware import auth_middleware
from app.models.user import User

# Re-export common dependencies
get_current_user = auth_middleware.get_current_user
get_current_active_user = auth_middleware.get_current_active_user

# Optional user dependency (doesn't fail if not authenticated)
_security = HTTPBearer(auto_error=False)

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    if not credentials:
        return None
    
    try:
        return await auth_middleware.get_current_user(
            credentials=credentials,
            db=db
        )
    except HTTPException:
        return None


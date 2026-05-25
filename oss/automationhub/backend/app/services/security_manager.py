"""
Security Manager - Central security policy enforcement and configuration
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
import logging
import json
import hashlib
import secrets

from app.core.database import Base
from app.core.config import settings
from app.services.rbac_service import RBACService, Permission
from app.services.mfa_service import MFAService
from app.middleware.rate_limiting import RateLimiter
from sqlalchemy import Column, String, DateTime, Boolean, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid

logger = logging.getLogger(__name__)


class SecurityPolicy(Base):
    """Security policy configuration"""
    
    __tablename__ = "security_policies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    policy_type = Column(String(50), nullable=False)  # rate_limit, access_control, etc.
    configuration = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SecurityEvent(Base):
    """Security event logging"""
    
    __tablename__ = "security_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)  # low, medium, high, critical
    user_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    endpoint = Column(String(200), nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class SecurityIncident(Base):
    """Security incident tracking"""
    
    __tablename__ = "security_incidents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), default="open")  # open, investigating, resolved, closed
    user_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=True)
    description = Column(String(1000), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class SecurityManager:
    """Central security manager for policy enforcement"""
    
    def __init__(self):
        self.rbac_service = RBACService()
        self.mfa_service = MFAService()
        self.rate_limiter = RateLimiter()
        
        # Security thresholds
        self.security_thresholds = {
            "failed_login_attempts": 5,
            "failed_login_window": 900,  # 15 minutes
            "suspicious_requests": 10,
            "suspicious_window": 300,    # 5 minutes
            "brute_force_threshold": 20,
            "brute_force_window": 3600,  # 1 hour
        }
        
        # Default security policies
        self.default_policies = {
            "password_policy": {
                "min_length": 8,
                "require_uppercase": True,
                "require_lowercase": True,
                "require_numbers": True,
                "require_special_chars": True,
                "max_age_days": 90,
                "history_count": 5
            },
            "session_policy": {
                "max_session_duration": 28800,  # 8 hours
                "idle_timeout": 3600,           # 1 hour
                "concurrent_sessions": 5,
                "require_mfa_for_admin": True
            },
            "access_policy": {
                "max_failed_attempts": 5,
                "lockout_duration": 900,        # 15 minutes
                "require_2fa_for_sensitive": True,
                "ip_whitelist_admin": True
            }
        }
    
    async def initialize_security_policies(self, db: AsyncSession) -> None:
        """Initialize default security policies"""
        try:
            for policy_name, config in self.default_policies.items():
                # Check if policy exists
                result = await db.execute(
                    select(SecurityPolicy).where(SecurityPolicy.name == policy_name)
                )
                existing_policy = result.scalar_one_or_none()
                
                if not existing_policy:
                    policy = SecurityPolicy(
                        name=policy_name,
                        policy_type=policy_name.split("_")[0],
                        configuration=config
                    )
                    db.add(policy)
            
            await db.commit()
            logger.info("Security policies initialized")
            
        except Exception as e:
            logger.error(f"Error initializing security policies: {e}")
            await db.rollback()
    
    async def enforce_security_policies(
        self, 
        request: Request, 
        db: AsyncSession,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Enforce security policies for request"""
        try:
            security_context = {
                "allowed": True,
                "warnings": [],
                "actions_required": [],
                "risk_score": 0
            }
            
            # Check rate limiting
            await self._check_rate_limits(request, security_context, user_id)
            
            # Check for suspicious activity
            await self._check_suspicious_activity(request, db, security_context, user_id)
            
            # Check access patterns
            await self._check_access_patterns(request, db, security_context, user_id)
            
            # Log security event if needed
            if security_context["risk_score"] > 50:
                await self._log_security_event(
                    db, "high_risk_request", "medium", 
                    user_id, request, security_context
                )
            
            return security_context
            
        except Exception as e:
            logger.error(f"Error enforcing security policies: {e}")
            return {"allowed": True, "warnings": [], "actions_required": [], "risk_score": 0}
    
    async def _check_rate_limits(
        self, 
        request: Request, 
        context: Dict[str, Any],
        user_id: Optional[str]
    ) -> None:
        """Check rate limiting policies"""
        try:
            client_id = f"user:{user_id}" if user_id else f"ip:{request.client.host}"
            endpoint = request.url.path
            
            # Get user role for rate limiting
            user_role = getattr(request.state, "user_role", "anonymous")
            rate_config = self.rate_limiter.get_rate_limit_for_user(user_role, endpoint)
            
            # Check current rate limit status
            rate_key = f"rate_limit:{client_id}:{endpoint}"
            is_limited, rate_info = await self.rate_limiter.is_rate_limited(
                rate_key, rate_config["requests"], rate_config["window"]
            )
            
            if is_limited:
                context["allowed"] = False
                context["risk_score"] += 30
                context["warnings"].append("Rate limit exceeded")
            elif rate_info["remaining"] < rate_info["limit"] * 0.1:  # Less than 10% remaining
                context["risk_score"] += 10
                context["warnings"].append("Approaching rate limit")
                
        except Exception as e:
            logger.error(f"Error checking rate limits: {e}")
    
    async def _check_suspicious_activity(
        self, 
        request: Request, 
        db: AsyncSession,
        context: Dict[str, Any],
        user_id: Optional[str]
    ) -> None:
        """Check for suspicious activity patterns"""
        try:
            client_ip = request.client.host
            user_agent = request.headers.get("user-agent", "")
            
            # Check for suspicious user agents
            suspicious_agents = ["sqlmap", "nikto", "nmap", "masscan", "curl", "wget"]
            if any(agent in user_agent.lower() for agent in suspicious_agents):
                context["risk_score"] += 40
                context["warnings"].append("Suspicious user agent detected")
            
            # Check for rapid requests from same IP
            recent_events = await db.execute(
                select(SecurityEvent)
                .where(SecurityEvent.ip_address == client_ip)
                .where(SecurityEvent.timestamp > datetime.utcnow() - timedelta(minutes=5))
                .where(SecurityEvent.event_type.in_(["failed_login", "suspicious_request"]))
            )
            
            event_count = len(recent_events.scalars().all())
            if event_count > self.security_thresholds["suspicious_requests"]:
                context["risk_score"] += 50
                context["warnings"].append("High frequency of suspicious requests")
                
                # Create security incident
                await self._create_security_incident(
                    db, "suspicious_activity", "medium", client_ip,
                    f"High frequency requests: {event_count} in 5 minutes"
                )
            
        except Exception as e:
            logger.error(f"Error checking suspicious activity: {e}")
    
    async def _check_access_patterns(
        self, 
        request: Request, 
        db: AsyncSession,
        context: Dict[str, Any],
        user_id: Optional[str]
    ) -> None:
        """Check access patterns for anomalies"""
        try:
            if not user_id:
                return
            
            # Check for unusual access times
            current_hour = datetime.utcnow().hour
            if current_hour < 6 or current_hour > 22:  # Outside business hours
                context["risk_score"] += 5
                context["warnings"].append("Access outside normal hours")
            
            # Check for admin endpoint access
            if request.url.path.startswith("/api/v1/admin/"):
                context["risk_score"] += 10
                
                # Require MFA for admin actions
                mfa_verified = getattr(request.state, "mfa_verified", False)
                if not mfa_verified:
                    context["risk_score"] += 30
                    context["actions_required"].append("MFA verification required for admin access")
            
            # Check for sensitive operations
            sensitive_endpoints = [
                "/api/v1/users/delete",
                "/api/v1/workflows/delete",
                "/api/v1/infrastructure/deploy",
                "/api/v1/auth/mfa/disable"
            ]
            
            if any(request.url.path.startswith(endpoint) for endpoint in sensitive_endpoints):
                context["risk_score"] += 15
                context["actions_required"].append("Additional verification required for sensitive operation")
            
        except Exception as e:
            logger.error(f"Error checking access patterns: {e}")
    
    async def _log_security_event(
        self,
        db: AsyncSession,
        event_type: str,
        severity: str,
        user_id: Optional[str],
        request: Request,
        context: Dict[str, Any]
    ) -> None:
        """Log security event"""
        try:
            event = SecurityEvent(
                event_type=event_type,
                severity=severity,
                user_id=user_id,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                endpoint=request.url.path,
                details={
                    "method": request.method,
                    "risk_score": context["risk_score"],
                    "warnings": context["warnings"],
                    "headers": dict(request.headers)
                }
            )
            
            db.add(event)
            await db.commit()
            
        except Exception as e:
            logger.error(f"Error logging security event: {e}")
            await db.rollback()
    
    async def _create_security_incident(
        self,
        db: AsyncSession,
        incident_type: str,
        severity: str,
        ip_address: str,
        description: str,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Create security incident"""
        try:
            incident = SecurityIncident(
                incident_type=incident_type,
                severity=severity,
                ip_address=ip_address,
                description=description,
                details=details or {}
            )
            
            db.add(incident)
            await db.commit()
            
            logger.warning(f"Security incident created: {incident_type} - {description}")
            
        except Exception as e:
            logger.error(f"Error creating security incident: {e}")
            await db.rollback()
    
    async def validate_password_policy(self, password: str) -> Dict[str, Any]:
        """Validate password against security policy"""
        policy = self.default_policies["password_policy"]
        
        validation_result = {
            "valid": True,
            "errors": [],
            "strength_score": 0
        }
        
        # Check length
        if len(password) < policy["min_length"]:
            validation_result["valid"] = False
            validation_result["errors"].append(f"Password must be at least {policy['min_length']} characters")
        else:
            validation_result["strength_score"] += 10
        
        # Check character requirements
        if policy["require_uppercase"] and not any(c.isupper() for c in password):
            validation_result["valid"] = False
            validation_result["errors"].append("Password must contain uppercase letters")
        else:
            validation_result["strength_score"] += 10
        
        if policy["require_lowercase"] and not any(c.islower() for c in password):
            validation_result["valid"] = False
            validation_result["errors"].append("Password must contain lowercase letters")
        else:
            validation_result["strength_score"] += 10
        
        if policy["require_numbers"] and not any(c.isdigit() for c in password):
            validation_result["valid"] = False
            validation_result["errors"].append("Password must contain numbers")
        else:
            validation_result["strength_score"] += 10
        
        if policy["require_special_chars"] and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            validation_result["valid"] = False
            validation_result["errors"].append("Password must contain special characters")
        else:
            validation_result["strength_score"] += 10
        
        # Additional strength checks
        if len(password) > 12:
            validation_result["strength_score"] += 10
        if len(set(password)) > len(password) * 0.7:  # Character diversity
            validation_result["strength_score"] += 10
        
        return validation_result
    
    async def check_session_security(
        self, 
        request: Request, 
        user_id: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Check session security requirements"""
        session_result = {
            "valid": True,
            "warnings": [],
            "actions_required": []
        }
        
        # Check session age
        session_start = getattr(request.state, "session_start", None)
        if session_start:
            session_age = (datetime.utcnow() - session_start).total_seconds()
            max_duration = self.default_policies["session_policy"]["max_session_duration"]
            
            if session_age > max_duration:
                session_result["valid"] = False
                session_result["actions_required"].append("Session expired - re-authentication required")
        
        # Check for concurrent sessions
        # This would require session tracking in Redis or database
        
        return session_result
    
    async def get_security_dashboard_data(self, db: AsyncSession) -> Dict[str, Any]:
        """Get security dashboard data"""
        try:
            # Get recent security events
            recent_events = await db.execute(
                select(SecurityEvent)
                .where(SecurityEvent.timestamp > datetime.utcnow() - timedelta(hours=24))
                .order_by(SecurityEvent.timestamp.desc())
                .limit(100)
            )
            
            # Get open incidents
            open_incidents = await db.execute(
                select(SecurityIncident)
                .where(SecurityIncident.status.in_(["open", "investigating"]))
                .order_by(SecurityIncident.created_at.desc())
            )
            
            events = recent_events.scalars().all()
            incidents = open_incidents.scalars().all()
            
            # Calculate security metrics
            event_counts = {}
            for event in events:
                event_counts[event.event_type] = event_counts.get(event.event_type, 0) + 1
            
            return {
                "recent_events": len(events),
                "open_incidents": len(incidents),
                "event_breakdown": event_counts,
                "high_risk_events": len([e for e in events if e.severity in ["high", "critical"]]),
                "incidents_by_severity": {
                    "critical": len([i for i in incidents if i.severity == "critical"]),
                    "high": len([i for i in incidents if i.severity == "high"]),
                    "medium": len([i for i in incidents if i.severity == "medium"]),
                    "low": len([i for i in incidents if i.severity == "low"])
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting security dashboard data: {e}")
            return {
                "recent_events": 0,
                "open_incidents": 0,
                "event_breakdown": {},
                "high_risk_events": 0,
                "incidents_by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0}
            }
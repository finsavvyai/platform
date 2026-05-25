"""
Security Middleware for CORS, CSP, and other security headers
"""

from typing import Callable, List, Dict, Any
from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import re
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware:
    """Middleware to add security headers"""
    
    def __init__(self):
        self.security_headers = {
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Enable XSS protection
            "X-XSS-Protection": "1; mode=block",
            
            # Referrer policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Permissions policy
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            
            # Strict transport security (HTTPS only)
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        }
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Add security headers to response"""
        response = await call_next(request)
        
        # Add security headers
        for header, value in self.security_headers.items():
            response.headers[header] = value
        
        # Add CSP header based on environment
        csp_policy = self._get_csp_policy(request)
        if csp_policy:
            response.headers["Content-Security-Policy"] = csp_policy
        
        return response
    
    def _get_csp_policy(self, request: Request) -> str:
        """Generate Content Security Policy based on environment"""
        if settings.ENVIRONMENT == "development":
            # More permissive CSP for development
            return (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' ws: wss: https:; "
                "frame-ancestors 'none';"
            )
        else:
            # Strict CSP for production
            return (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; "
                "connect-src 'self'; "
                "font-src 'self'; "
                "object-src 'none'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )


class CORSSecurityMiddleware:
    """Enhanced CORS middleware with environment-specific origins"""
    
    def __init__(self):
        self.allowed_origins = self._get_allowed_origins()
        self.allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
        self.allowed_headers = [
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-CSRF-Token",
            "X-MFA-Token"
        ]
        self.expose_headers = [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-MFA-Required"
        ]
    
    def _get_allowed_origins(self) -> List[str]:
        """Get allowed origins based on environment"""
        if settings.ENVIRONMENT == "development":
            return [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8080",
                "http://127.0.0.1:8080",
            ]
        elif settings.ENVIRONMENT == "staging":
            return [
                "https://staging.upmplus.com",
                "https://staging-app.upmplus.com",
            ]
        else:  # production
            return [
                "https://upmplus.com",
                "https://app.upmplus.com",
                "https://www.upmplus.com",
            ]
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Handle CORS with security checks"""
        origin = request.headers.get("origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            if origin and self._is_origin_allowed(origin):
                return Response(
                    status_code=200,
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Methods": ", ".join(self.allowed_methods),
                        "Access-Control-Allow-Headers": ", ".join(self.allowed_headers),
                        "Access-Control-Expose-Headers": ", ".join(self.expose_headers),
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Max-Age": "86400",  # 24 hours
                    }
                )
            else:
                return Response(status_code=403, content="Origin not allowed")
        
        # Process actual request
        response = await call_next(request)
        
        # Add CORS headers to response
        if origin and self._is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Expose-Headers"] = ", ".join(self.expose_headers)
        
        return response
    
    def _is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is allowed"""
        # Exact match
        if origin in self.allowed_origins:
            return True
        
        # Pattern matching for development
        if settings.ENVIRONMENT == "development":
            # Allow localhost with any port
            if re.match(r"https?://localhost:\d+", origin):
                return True
            if re.match(r"https?://127\.0\.0\.1:\d+", origin):
                return True
        
        return False


class RequestValidationMiddleware:
    """Middleware for request validation and sanitization"""
    
    def __init__(self):
        self.max_request_size = 10 * 1024 * 1024  # 10MB
        self.blocked_user_agents = [
            "sqlmap",
            "nikto",
            "nmap",
            "masscan",
            "nessus",
            "openvas",
        ]
        self.suspicious_patterns = [
            r"<script[^>]*>.*?</script>",  # XSS
            r"javascript:",                # JavaScript protocol
            r"vbscript:",                 # VBScript protocol
            r"on\w+\s*=",                 # Event handlers
            r"union\s+select",            # SQL injection
            r"drop\s+table",              # SQL injection
            r"insert\s+into",             # SQL injection
            r"delete\s+from",             # SQL injection
        ]
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Validate and sanitize requests"""
        
        # Check request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_request_size:
            logger.warning(f"Request too large: {content_length} bytes from {request.client.host}")
            return JSONResponse(
                status_code=413,
                content={"error": "Request entity too large"}
            )
        
        # Check user agent
        user_agent = request.headers.get("user-agent", "").lower()
        if any(blocked in user_agent for blocked in self.blocked_user_agents):
            logger.warning(f"Blocked user agent: {user_agent} from {request.client.host}")
            return JSONResponse(
                status_code=403,
                content={"error": "Forbidden"}
            )
        
        # Validate query parameters and headers for suspicious content
        if self._contains_suspicious_content(request):
            logger.warning(f"Suspicious request detected from {request.client.host}")
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request"}
            )
        
        return await call_next(request)
    
    def _contains_suspicious_content(self, request: Request) -> bool:
        """Check for suspicious patterns in request"""
        # Check query parameters
        query_string = str(request.url.query)
        for pattern in self.suspicious_patterns:
            if re.search(pattern, query_string, re.IGNORECASE):
                return True
        
        # Check headers (excluding authorization and content-type)
        safe_headers = {"authorization", "content-type", "accept", "user-agent"}
        for name, value in request.headers.items():
            if name.lower() not in safe_headers:
                for pattern in self.suspicious_patterns:
                    if re.search(pattern, value, re.IGNORECASE):
                        return True
        
        return False


class IPWhitelistMiddleware:
    """IP whitelist middleware for admin endpoints"""
    
    def __init__(self, whitelist_paths: List[str] = None):
        self.whitelist_paths = whitelist_paths or [
            "/api/v1/admin",
            "/api/v1/system",
            "/metrics",
        ]
        self.allowed_ips = self._get_allowed_ips()
    
    def _get_allowed_ips(self) -> List[str]:
        """Get allowed IPs from configuration"""
        # In production, this should come from environment variables
        if settings.ENVIRONMENT == "development":
            return ["127.0.0.1", "::1", "localhost"]
        else:
            # Add your production admin IPs here
            admin_ips = getattr(settings, "ADMIN_ALLOWED_IPS", "").split(",")
            return [ip.strip() for ip in admin_ips if ip.strip()]
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Check IP whitelist for protected paths"""
        
        # Check if path requires IP whitelisting
        if any(request.url.path.startswith(path) for path in self.whitelist_paths):
            client_ip = self._get_client_ip(request)
            
            if client_ip not in self.allowed_ips:
                logger.warning(f"Unauthorized IP access attempt: {client_ip} to {request.url.path}")
                return JSONResponse(
                    status_code=403,
                    content={"error": "Access denied"}
                )
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP address"""
        # Check X-Forwarded-For header (from load balancer/proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fall back to direct connection IP
        return request.client.host


class SecurityEventLogger:
    """Log security events for monitoring"""
    
    def __init__(self):
        self.security_logger = logging.getLogger("security")
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Log security-relevant events"""
        
        # Log authentication attempts
        if request.url.path.startswith("/api/v1/auth/"):
            self._log_auth_event(request)
        
        # Log admin access
        if request.url.path.startswith("/api/v1/admin/"):
            self._log_admin_event(request)
        
        response = await call_next(request)
        
        # Log failed requests
        if response.status_code >= 400:
            self._log_error_event(request, response)
        
        return response
    
    def _log_auth_event(self, request: Request):
        """Log authentication events"""
        self.security_logger.info(
            "Authentication attempt",
            extra={
                "event_type": "auth_attempt",
                "endpoint": request.url.path,
                "method": request.method,
                "client_ip": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "timestamp": request.state.request_time if hasattr(request.state, 'request_time') else None
            }
        )
    
    def _log_admin_event(self, request: Request):
        """Log admin access events"""
        self.security_logger.info(
            "Admin access",
            extra={
                "event_type": "admin_access",
                "endpoint": request.url.path,
                "method": request.method,
                "client_ip": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "user_id": getattr(request.state, "user_id", None)
            }
        )
    
    def _log_error_event(self, request: Request, response: Response):
        """Log error events"""
        if response.status_code in [401, 403, 429]:  # Security-relevant errors
            self.security_logger.warning(
                f"Security event: {response.status_code}",
                extra={
                    "event_type": "security_error",
                    "status_code": response.status_code,
                    "endpoint": request.url.path,
                    "method": request.method,
                    "client_ip": request.client.host,
                    "user_agent": request.headers.get("user-agent"),
                    "user_id": getattr(request.state, "user_id", None)
                }
            )
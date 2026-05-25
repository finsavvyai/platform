"""Security headers middleware for all Python HTTP services."""

import aiohttp.web

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-XSS-Protection": "0",
    "Cache-Control": "no-store",
    "Content-Security-Policy": (
        "default-src 'none'; "
        "script-src 'self' 'unsafe-inline' cdn.redoc.ly; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    ),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
}


def security_headers_middleware_factory():
    """Return middleware that adds security headers to all responses."""

    @aiohttp.web.middleware
    async def security_headers_middleware(request, handler):
        response = await handler(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response

    return security_headers_middleware

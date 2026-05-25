
import { Context, Next } from 'hono';

export const securityHeaders = async (c: Context, next: Next) => {
    // 1. Strict Transport Security (HSTS)
    // Enforce HTTPS for 1 year and include subdomains
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // 2. Content Security Policy (CSP)
    // Allow scripts only from self and trusted CDNs (e.g. Stripe, LemonSqueezy if needed later)
    // Note: For API, CSP is less critical but still good practice.
    c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://assets.lemonsqueezy.com; connect-src 'self' https://api.stripe.com https://api.lemonsqueezy.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'self' https://js.stripe.com https://assets.lemonsqueezy.com; object-src 'none'; base-uri 'self';");

    // 3. X-Content-Type-Options
    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // 4. X-Frame-Options
    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY');

    // 5. Referrer Policy
    // Only send origin when navigating from HTTPS to HTTPS
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 6. Permissions Policy
    // Disable features not needed by the API
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self "https://js.stripe.com" "https://assets.lemonsqueezy.com")');

    // 7. Prevent XSS
    c.header('X-XSS-Protection', '1; mode=block');

    await next();
};

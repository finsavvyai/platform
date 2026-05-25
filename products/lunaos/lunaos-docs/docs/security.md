# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability within LunaOS, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: security@lunaos.ai

### What to Include

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

After you submit a report, we will:

1. Confirm receipt of your vulnerability report within 48 hours
2. Provide regular updates on our progress
3. Credit you in our security advisories (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

1. **Keep LunaOS Updated**: Always use the latest stable version
2. **Secure Configuration**: 
   - Use strong, unique secret keys
   - Enable HTTPS in production
   - Configure proper CORS settings
   - Use environment variables for sensitive data
3. **Network Security**:
   - Use firewalls to restrict access
   - Consider using VPNs for remote access
   - Monitor network traffic
4. **Database Security**:
   - Use strong database passwords
   - Enable SSL/TLS for database connections
   - Regular database backups
   - Limit database user permissions
5. **Plugin Security**:
   - Only install plugins from trusted sources
   - Review plugin code before installation
   - Keep plugins updated
   - Use plugin sandboxing when available

### For Developers

1. **Code Security**:
   - Follow secure coding practices
   - Use parameterized queries to prevent SQL injection
   - Validate and sanitize all inputs
   - Use HTTPS for all external communications
2. **Dependencies**:
   - Keep dependencies updated
   - Use tools like `safety` to check for known vulnerabilities
   - Pin dependency versions
3. **Authentication & Authorization**:
   - Implement proper authentication mechanisms
   - Use strong password policies
   - Implement rate limiting
   - Use secure session management
4. **Data Protection**:
   - Encrypt sensitive data at rest and in transit
   - Implement proper access controls
   - Log security-relevant events
   - Regular security audits

## Security Features

LunaOS includes several built-in security features:

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API key management
- Rate limiting

### Data Protection
- Encryption at rest and in transit
- Secure configuration management
- Input validation and sanitization
- SQL injection prevention

### Plugin Security
- Plugin signature verification
- Sandboxed plugin execution
- Plugin isolation
- Secure plugin loading

### Network Security
- CORS configuration with origin whitelist
- Security headers (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Permissions-Policy)
- HTTPS enforcement via Cloudflare TLS 1.3
- Request validation with Zod schemas
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-origin

## Security Configuration

### Environment Variables

Set these environment variables for production:

```bash
# Security
SECRET_KEY=your-very-secure-secret-key-here
DEBUG=false
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql://user:password@host:port/db?sslmode=require

# Plugin Security
PLUGIN_SIGNATURE_VERIFICATION=true
PLUGIN_SANDBOXING=true

# API Security
CORS_ORIGINS=["https://yourdomain.com"]
```

### Docker Security

When using Docker:

1. Use non-root users in containers
2. Keep base images updated
3. Use multi-stage builds to reduce attack surface
4. Scan images for vulnerabilities
5. Use secrets management for sensitive data

### Kubernetes Security

When deploying to Kubernetes:

1. Use Network Policies
2. Enable Pod Security Standards
3. Use RBAC for service accounts
4. Enable audit logging
5. Use admission controllers

## Security Monitoring

### Logging

LunaOS logs security-relevant events:

- Authentication attempts
- Authorization failures
- Plugin loading/execution
- API access patterns
- Error conditions

### Monitoring

Monitor these metrics:

- Failed authentication attempts
- Unusual API usage patterns
- Plugin execution errors
- Database connection issues
- Resource usage anomalies

## Incident Response

In case of a security incident:

1. **Immediate Response**:
   - Isolate affected systems
   - Preserve evidence
   - Notify stakeholders

2. **Investigation**:
   - Analyze logs and metrics
   - Identify root cause
   - Assess impact

3. **Recovery**:
   - Apply patches/fixes
   - Restore services
   - Verify security

4. **Post-Incident**:
   - Document lessons learned
   - Update security procedures
   - Improve monitoring

## Security Updates

We regularly release security updates. To stay informed:

1. Subscribe to our security mailing list
2. Follow our GitHub releases
3. Monitor our security advisories
4. Enable automatic updates where possible

## Contact

For security-related questions or concerns:

- Email: security@lunaos.ai
- Website: https://lunaos.ai/security
- GitHub: https://github.com/lunaos-ai/luna-os.ai/security

---

**Last Updated**: February 2026

# Qestro SaaS Platform - Security Hardening Guide

## Overview

This guide provides comprehensive security hardening procedures for the Qestro SaaS Platform. It covers infrastructure security, application security, data protection, and compliance requirements to ensure enterprise-grade security posture.

## Security Architecture Overview

### Defense in Depth Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    External Network Layer                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   WAF/CDN       │  │   DDoS Protection│  │   Rate Limiting │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   API Gateway   │  │   Load Balancer │  │   Web Firewall  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   App Services  │  │   Auth Service  │  │  Database Layer │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Encryption at  │  │   Backup &      │  │   Access        │ │
│  │    Rest         │  │   Recovery      │  │   Controls      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Security Zones

1. **Public Zone**: Internet-facing services (CDN, WAF, load balancers)
2. **DMZ Zone**: Application servers and API gateways
3. **Private Zone**: Database servers and internal services
4. **Data Zone**: Encrypted storage and backup systems

## Infrastructure Security

### Network Security

#### VPC Configuration
```yaml
# AWS VPC Configuration Example
VPC:
  CIDR: 10.0.0.0/16
  
Subnets:
  Public:
    - CIDR: 10.0.1.0/24
    - Availability Zone: us-east-1a
    - Route Table: Public Route Table
    
  Private:
    - CIDR: 10.0.2.0/24
    - Availability Zone: us-east-1a
    - Route Table: Private Route Table
    
  Database:
    - CIDR: 10.0.3.0/24
    - Availability Zone: us-east-1b
    - Route Table: Database Route Table

Security Groups:
  WebSG:
    Ingress:
      - Port: 443
        Protocol: TCP
        Source: 0.0.0.0/0
      - Port: 80
        Protocol: TCP
        Source: 0.0.0.0/0
        
  AppSG:
    Ingress:
      - Port: 8000
        Protocol: TCP
        Source: sg-websg-id
        
  DatabaseSG:
    Ingress:
      - Port: 5432
        Protocol: TCP
        Source: sg-appsg-id
```

#### Firewall Rules
```bash
# iptables Rules for Application Server
#!/bin/bash

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

# Set default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# Allow SSH from specific IPs
iptables -A INPUT -p tcp --dport 22 -s 192.168.1.0/24 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow application traffic from load balancer
iptables -A INPUT -p tcp --dport 8000 -s 10.0.1.0/24 -j ACCEPT

# Log dropped packets
iptables -A INPUT -j LOG --log-prefix "DROPPED: "

# Save rules
iptables-save > /etc/iptables/rules.v4
```

#### DDoS Protection
```yaml
# CloudFlare WAF Configuration
waf_rules:
  - name: "Rate Limiting"
    action: "rate_limit"
    rate_limit:
      requests_per_minute: 100
      burst_size: 200
      
  - name: "SQL Injection Protection"
    action: "block"
    match_expression: "sql_injection"
    
  - name: "XSS Protection"
    action: "block"
    match_expression: "xss_attack"
    
  - name: "Bad Bot Protection"
    action: "block"
    match_expression: "malicious_user_agent"
```

### Server Security

#### Operating System Hardening (Ubuntu 22.04 LTS)
```bash
#!/bin/bash
# Server Hardening Script

set -euo pipefail

# Update system
apt update && apt upgrade -y

# Remove unnecessary packages
apt remove -y telnet ftp rsh rlogin talk
apt autoremove -y

# Configure SSH security
cat > /etc/ssh/sshd_config << EOF
Port 22
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 2
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
EOF

# Restart SSH service
systemctl restart sshd

# Configure firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow from 192.168.1.0/24 to any port 22
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install security monitoring
apt install -y fail2ban unattended-upgrades auditd

# Configure fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Configure automatic security updates
cat > /etc/apt/apt.conf.d/50unattended-upgrades << EOF
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
    "\${distro_id}ESM:\${distro_codename}";
};
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Download-Upgradeable-Packages "1";' >> /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::AutocleanInterval "7";' >> /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

systemctl enable unattended-upgrades

# File system permissions
chmod 600 /etc/ssh/sshd_config
chmod 644 /etc/passwd
chmod 600 /etc/shadow
chmod 640 /etc/group
chmod 600 /etc/gshadow

# Create security user accounts
useradd -m -s /bin/bash security
usermod -L security

echo "Server hardening completed successfully"
```

#### Container Security (Docker)
```yaml
# Docker Security Configuration
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.security
    security_opt:
      - no-new-privileges:true
    read_only: true
    user: "1001:1001"
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
      - /var/run:noexec,nosuid,size=100m
    ulimits:
      nproc: 65535
      nofile:
        soft: 20000
        hard: 40000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

```dockerfile
# Dockerfile.security
FROM node:20-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install security tools
RUN apk add --no-cache dumb-init

# Set security headers
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS runner
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Set proper permissions
RUN chmod -R 755 /app && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

## Application Security

### Authentication & Authorization

#### JWT Security Configuration
```typescript
// JWT Security Configuration
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_CONFIG = {
  access_token: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: '15m',
    algorithm: 'HS256',
    issuer: 'qestro.io',
    audience: 'qestro-users',
  },
  refresh_token: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
    algorithm: 'HS256',
  }
};

class TokenService {
  // Generate secure random token IDs
  generateTokenId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Create access token with security claims
  createAccessToken(userId: string, sessionId: string): string {
    const tokenId = this.generateTokenId();
    
    return jwt.sign(
      {
        sub: userId,
        jti: tokenId,
        sid: sessionId,
        iat: Math.floor(Date.now() / 1000),
        type: 'access',
        scope: ['read', 'write'],
      },
      JWT_CONFIG.access_token.secret,
      {
        expiresIn: JWT_CONFIG.access_token.expiresIn,
        algorithm: JWT_CONFIG.access_token.algorithm as jwt.Algorithm,
        issuer: JWT_CONFIG.access_token.issuer,
        audience: JWT_CONFIG.access_token.audience,
      }
    );
  }

  // Verify token with comprehensive checks
  verifyToken(token: string, type: 'access' | 'refresh'): any {
    try {
      const config = type === 'access' ? JWT_CONFIG.access_token : JWT_CONFIG.refresh_token;
      
      const decoded = jwt.verify(token, config.secret, {
        algorithms: [config.algorithm as jwt.Algorithm],
        issuer: config.issuer,
        audience: config.audience,
      });

      // Additional security checks
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Refresh token rotation
  async rotateRefreshToken(oldRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const decoded = this.verifyToken(oldRefreshToken, 'refresh');
    
    // Check if refresh token is revoked
    const isRevoked = await this.isTokenRevoked(decoded.jti);
    if (isRevoked) {
      throw new Error('Refresh token has been revoked');
    }

    // Revoke old refresh token
    await this.revokeToken(decoded.jti);

    // Generate new tokens
    const sessionId = crypto.randomBytes(16).toString('hex');
    const accessToken = this.createAccessToken(decoded.sub, sessionId);
    const refreshToken = this.createRefreshToken(decoded.sub, sessionId);

    return { accessToken, refreshToken };
  }
}
```

#### Password Security
```typescript
// Password Security Configuration
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import z from 'zod';

const PasswordSchema = z.object({
  password: z.string()
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

class PasswordService {
  private readonly saltRounds = 12;

  // Hash password with bcrypt
  async hashPassword(password: string): Promise<string> {
    const validatedPassword = PasswordSchema.parse(password).password;
    return bcrypt.hash(validatedPassword, this.saltRounds);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate secure reset token
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Check password strength
  checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 12) score += 1;
    else feedback.push('Use at least 12 characters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    if (password.length >= 16) score += 1;
    
    // Check for common patterns
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push('Avoid repeated characters');

    return { score, feedback };
  }
}
```

### API Security

#### Rate Limiting Configuration
```typescript
// Advanced Rate Limiting
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const rateLimitConfig = {
  // General API rate limit
  general: rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:general:',
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '60 seconds',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip + ':' + (req.user?.id || 'anonymous');
    },
  }),

  // Authentication endpoints
  auth: rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:auth:',
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '15 minutes',
    },
    skipSuccessfulRequests: true,
  }),

  // Password reset
  passwordReset: rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:pwreset:',
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: {
      error: 'Too many password reset attempts',
      retryAfter: '1 hour',
    },
  }),

  // API key usage
  apiKey: rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:apikey:',
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Higher limit for API keys
    keyGenerator: (req) => `apikey:${req.headers['x-api-key']}`,
  }),
};
```

#### Input Validation & Sanitization
```typescript
// Comprehensive Input Validation
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// XSS Prevention
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
};

// SQL Injection Prevention
export const sanitizeSql = (input: string): string => {
  // Use parameterized queries instead of this in production
  return validator.escape(input);
};

// Email validation
export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .refine(email => {
    // Additional validation for common disposable email domains
    const disposableDomains = ['tempmail.com', '10minutemail.com'];
    const domain = email.split('@')[1].toLowerCase();
    return !disposableDomains.includes(domain);
  }, 'Disposable email domains not allowed');

// UUID validation
export const UUIDSchema = z.string()
  .uuid('Invalid UUID format');

// Secure file upload validation
export const FileUploadSchema = z.object({
  filename: z.string()
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename'),
  mimetype: z.enum([
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'text/plain',
    'application/json'
  ], 'Invalid file type'),
  size: z.number()
    .max(10 * 1024 * 1024, 'File too large (max 10MB)'),
});

// API Request validation middleware
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  };
};
```

### Security Headers
```typescript
// Security Headers Middleware
import helmet from 'helmet';

export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.qestro.io"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options
  noSniff: true,

  // Referrer Policy
  referrerPolicy: {
    policy: ['strict-origin-when-cross-origin'],
  },

  // Permissions Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
    },
  },
});
```

## Data Protection

### Encryption at Rest
```typescript
// Database Encryption Configuration
import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;

  // Generate encryption key
  generateKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  // Encrypt sensitive data
  encrypt(text: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, Buffer.from(key, 'hex'));
    cipher.setAAD(Buffer.from('qestro', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  // Decrypt sensitive data
  decrypt(encryptedData: string, key: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(this.algorithm, Buffer.from(key, 'hex'));
    decipher.setAAD(Buffer.from('qestro', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Database field encryption
export const encryptSensitiveFields = {
  // User PII encryption
  users: {
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
  },
  
  // Payment information encryption
  subscriptions: {
    paymentMethodId: true,
    lastFour: true,
  },
  
  // API key encryption
  apiKeys: {
    key: true,
  },
};
```

### Data Masking for Logs
```typescript
// Data Masking for Logging
class DataMaskingService {
  private readonly sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth',
    'email', 'phone', 'creditCard', 'ssn'
  ];

  // Mask sensitive data in logs
  maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return this.maskValue(String(data));
    }

    const masked = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        masked[key] = this.maskValue(String(value));
      } else if (typeof value === 'object') {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  private isSensitiveField(fieldName: string): boolean {
    return this.sensitiveFields.some(sensitive => 
      fieldName.toLowerCase().includes(sensitive.toLowerCase())
    );
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }
}

// Secure logging middleware
export const secureLogger = (req: Request, res: Response, next: NextFunction) => {
  const maskingService = new DataMaskingService();
  
  // Mask request body
  if (req.body) {
    req.body = maskingService.maskSensitiveData(req.body);
  }
  
  // Mask query parameters
  if (req.query) {
    req.query = maskingService.maskSensitiveData(req.query);
  }
  
  next();
};
```

### Backup & Recovery Security
```bash
#!/bin/bash
# Secure Backup Script

set -euo pipefail

# Configuration
BACKUP_DIR="/secure/backups/qestro"
ENCRYPTION_KEY_FILE="/secure/keys/backup.key"
RETENTION_DAYS=30
S3_BUCKET="qestro-backups-prod"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="qestro_backup_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

# Database backup
echo "Creating database backup..."
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/$BACKUP_FILE"

# Encrypt backup
echo "Encrypting backup..."
openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/$BACKUP_FILE" -out "$BACKUP_DIR/$ENCRYPTED_FILE" -pass file:"$ENCRYPTION_KEY_FILE"

# Remove unencrypted backup
rm "$BACKUP_DIR/$BACKUP_FILE"

# Upload to secure S3 bucket
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR/$ENCRYPTED_FILE" "s3://$S3_BUCKET/database/" --server-side-encryption AES256

# Verify upload
if aws s3 ls "s3://$S3_BUCKET/database/$ENCRYPTED_FILE" > /dev/null; then
    echo "Backup uploaded successfully"
    rm "$BACKUP_DIR/$ENCRYPTED_FILE"
else
    echo "ERROR: Backup upload failed"
    exit 1
fi

# Clean old backups
echo "Cleaning old backups..."
aws s3 ls "s3://$S3_BUCKET/database/" | while read -r line; do
    createDate=$(echo "$line" | awk '{print $1" "$2}')
    createDate=$(date -d "$createDate" +%s)
    olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
    
    if [[ $createDate -lt $olderThan ]]; then
        fileName=$(echo "$line" | awk '{print $4}')
        if [[ $fileName != "" ]]; then
            aws s3 rm "s3://$S3_BUCKET/database/$fileName"
        fi
    fi
done

echo "Backup completed successfully"
```

## Monitoring & Detection

### Security Monitoring
```typescript
// Security Monitoring Service
import { AuditLogger } from '../utils/audit-logger';

class SecurityMonitoringService {
  private auditLogger = new AuditLogger();

  // Monitor for suspicious activities
  async detectSuspiciousActivity(event: SecurityEvent): Promise<void> {
    const alerts = [];

    // Multiple failed logins
    if (event.type === 'login_failed') {
      const recentFailures = await this.getRecentFailedLogins(event.ip, event.email, 15); // 15 minutes
      if (recentFailures.length >= 5) {
        alerts.push({
          type: 'brute_force_attempt',
          severity: 'high',
          ip: event.ip,
          email: event.email,
          count: recentFailures.length,
        });
      }
    }

    // Unusual access patterns
    if (event.type === 'api_access') {
      const isUnusual = await this.detectUnusualAccess(event.userId, event.endpoint);
      if (isUnusual) {
        alerts.push({
          type: 'unusual_access_pattern',
          severity: 'medium',
          userId: event.userId,
          endpoint: event.endpoint,
        });
      }
    }

    // Privilege escalation attempts
    if (event.type === 'privilege_escalation_attempt') {
      alerts.push({
        type: 'privilege_escalation_attempt',
        severity: 'critical',
        userId: event.userId,
        targetRole: event.targetRole,
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processSecurityAlert(alert);
    }
  }

  // Process security alerts
  private async processSecurityAlert(alert: SecurityAlert): Promise<void> {
    // Log alert
    await this.auditLogger.logSecurityAlert(alert);

    // Take automatic actions based on severity
    switch (alert.severity) {
      case 'critical':
        // Immediately block IP/user
        await this.blockIP(alert.ip);
        await this.suspendUser(alert.userId);
        await this.notifySecurityTeam(alert);
        break;

      case 'high':
        // Temporary rate limiting
        await this.implementStrictRateLimit(alert.ip);
        await this.notifySecurityTeam(alert);
        break;

      case 'medium':
        // Enhanced monitoring
        await this.enhanceMonitoring(alert.userId);
        break;
    }
  }

  // Block malicious IP
  private async blockIP(ip: string): Promise<void> {
    // Add to firewall rules
    // Add to WAF block list
    // Add to rate limit blacklist
  }

  // Notify security team
  private async notifySecurityTeam(alert: SecurityAlert): Promise<void> {
    const message = `
      🚨 Security Alert: ${alert.type}
      
      Severity: ${alert.severity}
      IP: ${alert.ip}
      User: ${alert.userId}
      Time: ${new Date().toISOString()}
      
      Details: ${JSON.stringify(alert, null, 2)}
    `;

    // Send to Slack
    await this.sendSlackAlert(message);
    
    // Send email
    await this.sendEmailAlert(message);
    
    // Create incident ticket
    await this.createIncidentTicket(alert);
  }
}

// Security event types
interface SecurityEvent {
  type: string;
  userId?: string;
  ip: string;
  email?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip?: string;
  userId?: string;
  email?: string;
  details?: Record<string, any>;
}
```

### Intrusion Detection
```yaml
# Falco Rules for Container Security
- rule: Suspicious Network Activity
  desc: Detect suspicious network connections from container
  condition: >
    spawned_process and
    container and
    proc.name in (nc, ncat, netcat, wget, curl) and
    not fd.name in (localhost, 127.0.0.1)
  output: >
    Suspicious network activity detected
    (user=%user.name container=%container.name process=%proc.name
    connection=%fd.name)
  priority: HIGH
  tags: [network, container]

- rule: Unauthorized File Access
  desc: Detect access to sensitive files
  condition: >
    open_read and
    container and
    fd.name in (/etc/passwd, /etc/shadow, /etc/hosts, 
                /root/.ssh/, /home/.ssh/, /etc/ssl/)
  output: >
    Unauthorized file access detected
    (user=%user.name container=%container.name 
     file=%fd.name)
  priority: HIGH
  tags: [filesystem, container]

- rule: Privilege Escalation Attempt
  desc: Detect privilege escalation attempts
  condition: >
    spawned_process and
    container and
    proc.name in (sudo, su, pkexec, doas) and
    not proc.args contains "nobody"
  output: >
    Privilege escalation attempt detected
    (user=%user.name container=%container.name 
     process=%proc.name args=%proc.args)
  priority: CRITICAL
  tags: [privilege_escalation, container]
```

## Compliance & Auditing

### GDPR Compliance
```typescript
// GDPR Compliance Service
class GDPRService {
  // Data access request
  async handleDataAccessRequest(userId: string): Promise<UserDataExport> {
    const userData = await this.collectUserData(userId);
    
    // Log the request
    await this.auditLogger.logDataAccessRequest(userId);
    
    return {
      userId,
      exportDate: new Date(),
      data: userData,
      format: 'json',
    };
  }

  // Data deletion request (Right to be forgotten)
  async handleDataDeletionRequest(userId: string): Promise<void> {
    // Start transaction
    const transaction = await this.database.beginTransaction();
    
    try {
      // Anonymize user data
      await this.anonymizeUserData(userId, transaction);
      
      // Delete or anonymize related records
      await this.deleteUserActivity(userId, transaction);
      await this.deleteUserFiles(userId, transaction);
      await this.deleteUserSessions(userId, transaction);
      
      // Commit transaction
      await transaction.commit();
      
      // Log the deletion
      await this.auditLogger.logDataDeletionRequest(userId);
      
      // Confirm deletion to user
      await this.sendDeletionConfirmation(userId);
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Consent management
  async updateConsent(userId: string, consentData: ConsentData): Promise<void> {
    await this.database.query(`
      INSERT INTO user_consent (user_id, consent_type, granted, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, consentData.type, consentData.granted, consentData.ip, consentData.userAgent]);
  }

  // Data retention policy
  async enforceDataRetentionPolicy(): Promise<void> {
    const retentionPeriods = {
      user_activity: 365, // days
      audit_logs: 2555, // 7 years
      payment_data: 2555, // 7 years
      support_tickets: 1825, // 5 years
    };

    for (const [dataType, days] of Object.entries(retentionPeriods)) {
      await this.deleteOldData(dataType, days);
    }
  }
}
```

### SOC 2 Compliance
```typescript
// SOC 2 Compliance Monitoring
class SOC2Service {
  // Security controls monitoring
  async monitorSecurityControls(): Promise<ControlReport> {
    const controls = {
      access_control: await this.verifyAccessControls(),
      encryption: await this.verifyEncryptionControls(),
      monitoring: await this.verifyMonitoringControls(),
      incident_response: await this.verifyIncidentResponse(),
    };

    return {
      timestamp: new Date(),
      controls,
      overallStatus: this.calculateOverallStatus(controls),
    };
  }

  // Access control verification
  private async verifyAccessControls(): Promise<ControlStatus> {
    const checks = [
      await this.checkMFAEnforcement(),
      await this.checkPasswordPolicies(),
      await this.checkSessionManagement(),
      await this.checkRoleBasedAccess(),
    ];

    return {
      status: checks.every(check => check.passed) ? 'pass' : 'fail',
      checks,
    };
  }

  // Generate compliance report
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const report = {
      period: { startDate, endDate },
      securityControls: await this.monitorSecurityControls(),
      incidents: await this.getSecurityIncidents(startDate, endDate),
      accessReviews: await this.getAccessReviews(startDate, endDate),
      changes: await this.getSystemChanges(startDate, endDate),
      trainings: await this.getSecurityTraining(startDate, endDate),
    };

    return report;
  }
}
```

## Security Testing

### Penetration Testing
```bash
#!/bin/bash
# Security Testing Script

echo "Starting comprehensive security testing..."

# OWASP ZAP Baseline Scan
echo "Running OWASP ZAP scan..."
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:8000 \
  -J zap-report.json || true

# Nikto Web Scanner
echo "Running Nikto scan..."
nikto -h http://localhost:8000 -o nikto-report.html || true

# SQLMap Testing
echo "Running SQLMap tests..."
sqlmap -u "http://localhost:8000/api/test?id=1" \
  --batch --risk=1 --level=1 || true

# Nmap Port Scanning
echo "Running Nmap scan..."
nmap -sV -sC -oN nmap-report.txt localhost || true

# SSL/TLS Testing
echo "Running SSL/TLS test..."
testssl.sh https://qestro.io --htmlfile ssl-report.html || true

echo "Security testing completed. Check reports for vulnerabilities."
```

### Automated Security Testing
```javascript
// Security Tests (Jest)
describe('Security Tests', () => {
  describe('Authentication Security', () => {
    test('should prevent SQL injection in login', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput,
          password: 'password123',
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should implement rate limiting on auth endpoints', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Make multiple requests
      const requests = Array(11).fill().map(() => 
        request(app).post('/api/auth/login').send(loginData)
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];
      
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('API Security', () => {
    test('should prevent XSS attacks', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: xssPayload,
          description: 'Test project',
        });
      
      expect(response.body.data.project.name).not.toContain('<script>');
    });

    test('should validate input formats', async () => {
      const invalidUUID = 'not-a-uuid';
      
      const response = await request(app)
        .get(`/api/projects/${invalidUUID}`)
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## Security Checklists

### Daily Security Checklist
- [ ] Review security alerts and incidents
- [ ] Check system access logs for anomalies
- [ ] Verify backup completion and integrity
- [ ] Monitor system resource utilization
- [ ] Review failed login attempts
- [ ] Check SSL certificate expiration
- [ ] Update security patches if available

### Weekly Security Checklist
- [ ] Review user access permissions
- [ ] Analyze security monitoring reports
- [ ] Test backup restoration procedures
- [ ] Review and update firewall rules
- [ ] Check for vulnerable dependencies
- [ ] Conduct security team meeting
- [ ] Update security documentation

### Monthly Security Checklist
- [ ] Conduct comprehensive security scan
- [ ] Review and update security policies
- [ ] Perform penetration testing
- [ ] Update incident response procedures
- [ ] Conduct security awareness training
- [ ] Review compliance requirements
- [ ] Update risk assessment

## Incident Response

### Security Incident Response Plan
```typescript
// Incident Response Service
class IncidentResponseService {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // Phase 1: Detection and Analysis
    const severity = await this.assessIncidentSeverity(incident);
    
    // Phase 2: Containment
    await this.containIncident(incident, severity);
    
    // Phase 3: Eradication
    await this.eradicateThreat(incident);
    
    // Phase 4: Recovery
    await this.recoverFromIncident(incident);
    
    // Phase 5: Lessons Learned
    await this.documentLessonsLearned(incident);
  }

  private async assessIncidentSeverity(incident: SecurityIncident): Promise<string> {
    const factors = {
      dataSensitivity: incident.dataSensitivity,
      userImpact: incident.userImpact,
      systemImpact: incident.systemImpact,
      exploitability: incident.exploitability,
    };

    // Calculate severity score
    const score = this.calculateSeverityScore(factors);
    
    if (score >= 8) return 'critical';
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  private async containIncident(incident: SecurityIncident, severity: string): Promise<void> {
    switch (severity) {
      case 'critical':
        await this.isolateAffectedSystems(incident);
        await this.blockMaliciousIPs(incident);
        await this.suspendAffectedAccounts(incident);
        break;
        
      case 'high':
        await this.increaseMonitoring(incident);
        await this.blockMaliciousIPs(incident);
        break;
        
      case 'medium':
        await this.increaseMonitoring(incident);
        break;
    }
  }
}
```

## Conclusion

This security hardening guide provides a comprehensive framework for securing the Qestro SaaS Platform. Regular review and updates of security measures are essential to maintain a strong security posture.

### Key Security Principles
1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimum necessary access permissions
3. **Zero Trust**: Verify everything, trust nothing
4. **Continuous Monitoring**: Real-time threat detection and response
5. **Security by Design**: Built-in security from the ground up

### Regular Security Activities
- Quarterly security assessments
- Annual penetration testing
- Monthly security training
- Weekly security reviews
- Daily security monitoring

Remember that security is an ongoing process, not a one-time implementation. Stay informed about new threats and continuously improve your security posture.

---

*Last Updated: [Date]*  
*Security Team: security@qestro.io*  
*Emergency Contact: security-emergency@qestro.io*
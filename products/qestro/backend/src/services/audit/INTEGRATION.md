# Audit Log & Compliance System Integration Guide

## Overview
The Audit System provides comprehensive logging and compliance reporting for all system actions, including user authentication, test execution, configuration changes, and data access.

## Components

### AuditLogger
Central service for logging and querying audit entries:
- Log user actions and system events
- Query logs with flexible filtering
- Generate compliance reports
- Export logs to CSV
- Calculate user statistics

### AuditMiddleware
Express middleware for automatic request logging:
- Logs all HTTP requests
- Captures response status, duration, and IP
- Tracks user authentication state
- Extracts client information

## Quick Start

### 1. Initialize AuditLogger
```typescript
import { AuditLogger } from './services/audit/index.js';

const auditLogger = new AuditLogger();
```

### 2. Log an Action
```typescript
const entry = await auditLogger.log({
  userId: 'user-123',
  userEmail: 'user@example.com',
  action: 'test.executed',
  category: 'test_execution',
  projectId: 'proj-456',
  resourceId: 'test-789',
  resourceType: 'test',
  description: 'Executed test: Login Flow',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  status: 'success',
  metadata: {
    duration: 2345,
    resultCode: 'passed',
  },
});
```

### 3. Query Audit Logs
```typescript
const result = await auditLogger.query({
  userId: 'user-123',
  projectId: 'proj-456',
  category: 'test_execution',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  limit: 100,
  offset: 0,
});
```

### 4. Generate Compliance Report
```typescript
const report = await auditLogger.generateComplianceReport(
  'org-123',
  new Date('2026-01-01'),
  new Date('2026-03-31'),
  'admin-user-id'
);
```

## Audit Actions

Tracked actions include:

### Authentication
- `user.login` - User signed in
- `user.logout` - User signed out

### User Management
- `user.created` - New user registered
- `user.updated` - User profile modified
- `user.deleted` - User account deleted

### Project Management
- `project.created` - New project created
- `project.updated` - Project settings modified
- `project.deleted` - Project removed

### Test Execution
- `test.created` - New test case created
- `test.updated` - Test modified
- `test.executed` - Test run executed
- `test.deleted` - Test removed

### Configuration
- `webhook.created` - Webhook registered
- `webhook.updated` - Webhook modified
- `webhook.deleted` - Webhook removed
- `api_key.generated` - New API key created
- `api_key.revoked` - API key disabled
- `settings.changed` - System settings modified

### Security
- `role.assigned` - User role changed
- `permission.granted` - Permission added
- `permission.revoked` - Permission removed

### Data Management
- `report.generated` - Report created
- `export.executed` - Data export performed

## Audit Categories

Logs are categorized for reporting:
- `authentication` - Auth-related events
- `user_management` - User account changes
- `project_management` - Project changes
- `test_execution` - Test runs and modifications
- `configuration` - System config changes
- `security` - Security-related events
- `api_access` - API calls and access
- `data_export` - Data export operations
- `compliance` - Compliance-related actions

## Express Integration

### Add Audit Middleware
```typescript
import express from 'express';
import { createAuditMiddleware } from './services/audit/index.js';
import { auditRouter } from './services/audit/index.js';

const app = express();
const auditLogger = new AuditLogger();

// Mount audit middleware for request logging
app.use(createAuditMiddleware(auditLogger));

// Mount audit API routes
app.use('/api/audit', auditRouter);
```

## API Endpoints

### Query Logs
```
GET /api/audit/logs?userId=user-123&limit=100&offset=0
```

### User Activity
```
GET /api/audit/users/:userId/activity?days=30
```

### Compliance Report
```
GET /api/audit/compliance-report?startDate=2026-01-01&endDate=2026-03-31
```

### Export Logs
```
GET /api/audit/export?action=test.executed&format=csv
```

## Compliance Report

Includes:
- **Summary**: Total actions, success rate, unique users
- **Action Breakdown**: Count by category
- **User Activity**: Per-user statistics
- **Security Events**: Auth failures, permission changes
- **Data Access**: Read, write, delete operations
- **Metadata**: Report generation timestamp and creator

## Database Considerations

For production persistence:

```sql
CREATE TABLE audit_entries (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  project_id TEXT,
  resource_id TEXT,
  resource_type TEXT,
  description TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failure'
  error_message TEXT,
  changes TEXT, -- JSON
  metadata TEXT -- JSON
);

CREATE INDEX idx_audit_user ON audit_entries(user_id);
CREATE INDEX idx_audit_project ON audit_entries(project_id);
CREATE INDEX idx_audit_action ON audit_entries(action);
CREATE INDEX idx_audit_category ON audit_entries(category);
CREATE INDEX idx_audit_timestamp ON audit_entries(timestamp DESC);
CREATE INDEX idx_audit_status ON audit_entries(status);
```

## Data Retention

Recommended retention policies:
- **Audit Logs**: 12 months
- **Compliance Reports**: 7 years (per regulations)
- **Security Events**: 5 years
- **User Activity**: 2 years

## Compliance Standards

Supports reporting for:
- **SOC 2** - System and organization controls
- **HIPAA** - Healthcare data access auditing
- **GDPR** - Data subject access and deletion
- **PCI-DSS** - Payment card data access
- **ISO 27001** - Information security

## Filtering Examples

```typescript
// Failed login attempts
const failedLogins = await auditLogger.query({
  action: 'user.login',
  status: 'failure',
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
});

// Data exports
const exports = await auditLogger.query({
  action: 'export.executed',
  category: 'data_export',
  limit: 1000,
});

// Project changes by user
const projectChanges = await auditLogger.query({
  userId: 'user-123',
  category: 'project_management',
});
```

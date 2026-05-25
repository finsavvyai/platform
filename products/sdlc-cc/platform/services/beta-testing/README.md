# SDLC.ai Beta Testing Service Documentation

## Overview

The Beta Testing Service manages the comprehensive beta testing program for SDLC.ai v3. It handles user applications, onboarding, feedback collection, scenario-based testing, and program analytics.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Beta Users    │────▶│  Beta Service    │────▶│   Database      │
│                 │     │                  │     │                 │
│ - Application   │     │ - User Management│     │ - Beta Users    │
│ - Onboarding    │     │ - Feedback       │     │ - Feedback      │
│ - Testing       │     │ - Scenarios      │     │ - Scenarios     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AI Analysis    │
                       │                  │
                       │ - Categorization │
                       │ - Prioritization │
                       │ - Trend Analysis │
                       └──────────────────┘
```

## Features

### 1. User Management
- **Application Process**: Users apply with detailed information about their experience and use case
- **Approval Workflow**: Admin review and approval process with automated notifications
- **Onboarding**: Guided onboarding with first-steps scenarios
- **Phased Testing**: 5-phase testing program with progressive complexity

### 2. Feedback System
- **Multi-type Feedback**: Bug reports, feature requests, usability issues, performance problems
- **AI-powered Analysis**: Automatic categorization and prioritization using AI
- **Context Capture**: Rich context including environment, reproduction steps, attachments
- **Response Tracking**: Full lifecycle from submission to resolution
- **Reward System**: Credits awarded for valuable feedback

### 3. Testing Scenarios
- **Structured Testing**: Pre-defined scenarios for each phase
- **Progress Tracking**: Monitor completion and engagement
- **Points System**: Earn points for completing scenarios
- **Adaptive Path**: Scenarios unlock based on progress

### 4. Analytics & Insights
- **Real-time Metrics**: Track user engagement, feedback volume, completion rates
- **Trend Analysis**: Identify emerging issues and patterns
- **Sentiment Analysis**: Understand user sentiment across phases and features
- **Predictive Analytics**: Forecast feedback volume and trends

### 5. Community Features
- **Slack/Discord Integration**: Community chat and support
- **Office Hours**: Regular check-ins with the product team
- **Showcase Opportunities**: Highlight successful integrations
- **Peer Learning**: Share experiences and solutions

## API Reference

### Authentication
All API endpoints require either:
- JWT Bearer token: `Authorization: Bearer <token>`
- API Key: `X-API-Key: <key>`

### Endpoints

#### Beta Application
```http
POST /api/beta/apply
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "company": "Acme Corp",
  "experience": "expert",
  "useCase": "Building secure AI applications",
  "motivation": "Want to test DLP features",
  "technicalBackground": "10 years in software development",
  "agreeToTerms": true
}
```

#### Get Application Status
```http
GET /api/beta/application/status
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "status": "approved",
    "application": {
      "id": "beta-123",
      "applicationStatus": "approved",
      "testingPhase": "core"
    }
  }
}
```

#### Complete Onboarding
```http
POST /api/beta/onboarding/complete
Authorization: Bearer <token>

{
  "sdkUsed": "python",
  "firstApiCall": {
    "endpoint": "/api/health",
    "success": true,
    "responseTime": 150
  },
  "setupExperience": {
    "ease": 5,
    "comments": "Very smooth setup process"
  }
}
```

#### Get Testing Scenarios
```http
GET /api/beta/scenarios?phase=core
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "phase": "core",
    "scenarios": [
      {
        "id": "scenario-004",
        "name": "Vector Search Implementation",
        "description": "Implement vector search on processed documents",
        "completed": false,
        "points": 40,
        "estimatedTime": 30
      }
    ],
    "phaseProgress": {
      "total": 4,
      "completed": 1,
      "percentage": 25
    }
  }
}
```

#### Submit Feedback
```http
POST /api/beta/feedback
Authorization: Bearer <token>

{
  "type": "bug",
  "title": "Document upload fails for PDFs > 10MB",
  "description": "When uploading PDF files larger than 10MB, the upload fails with error 500",
  "context": {
    "feature": "document-upload",
    "endpoint": "/api/documents/upload",
    "environment": "production",
    "reproductionSteps": [
      "Select PDF file > 10MB",
      "Click upload",
      "Observe error"
    ]
  }
}
```

#### Get Dashboard Data
```http
GET /api/beta/dashboard
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "user": {
      "name": "John Doe",
      "testingPhase": "core",
      "engagementScore": 350,
      "rewardCredits": 750
    },
    "scenarios": {...},
    "summary": {
      "feedbackSubmitted": 12,
      "bugsReported": 5,
      "daysInBeta": 21
    }
  }
}
```

#### Admin: Get Metrics
```http
GET /api/beta/admin/metrics
Authorization: Bearer <admin-token>

Response:
{
  "success": true,
  "data": {
    "totalUsers": 85,
    "activeUsers": 72,
    "completionRate": 45,
    "averageEngagementScore": 280,
    "feedbackCount": 423,
    "bugsReported": 89,
    "featureRequests": 156,
    "npsScore": 62,
    "phaseDistribution": {
      "onboarding": 5,
      "core": 28,
      "advanced": 25,
      "load": 10,
      "integration": 4
    }
  }
}
```

## Testing Phases

### Phase 1: Onboarding (Week 1)
**Goal**: Get users set up and familiar with the platform

Scenarios:
1. Account setup and API key generation
2. SDK installation and first connection
3. Document upload and processing

**Success Criteria**: 
- Complete all 3 scenarios
- Submit at least 1 feedback item
- Join community Slack

### Phase 2: Core Features (Weeks 2-3)
**Goal**: Test core functionality

Scenarios:
1. Vector search implementation
2. RAG pipeline integration
3. DLP features testing
4. Multi-tenant isolation

**Success Criteria**:
- Complete 3 out of 4 scenarios
- Test with real use case data
- Report at least 2 bugs or feature requests

### Phase 3: Advanced Features (Weeks 4-5)
**Goal**: Explore advanced capabilities

Scenarios:
1. Custom embedding models
2. Advanced authentication methods
3. Audit and compliance features

**Success Criteria**:
- Complete 2 out of 3 scenarios
- Test compliance features
- Provide detailed feedback on advanced features

### Phase 4: Load Testing (Week 6)
**Goal**: Validate performance under load

Scenarios:
1. Concurrent user load test
2. Large document processing
3. High volume API calls

**Success Criteria**:
- Complete all load testing scenarios
- Document performance findings
- Suggest performance improvements

### Phase 5: Integration (Weeks 7-8)
**Goal**: Complete end-to-end integration

Scenarios:
1. End-to-end application integration
2. Third-party integration test

**Success Criteria**:
- Build complete application
- Test in staging environment
- Provide case study or testimonial

## Configuration

### Environment Variables

```bash
# General Settings
BETA_PROGRAM_NAME=SDLC.ai Beta Program v3
MAX_BETA_USERS=100
BETA_DURATION_WEEKS=8

# Reward Settings
REWARD_CREDITS_FEEDBACK=100
REWARD_CREDITS_BUG=500
REWARD_CREDITS_CRITICAL_BUG=1000

# Feature Flags
FEEDBACK_ANALYSIS_ENABLED=true
AUTO_TRIAGE_ENABLED=true
SENTIMENT_ANALYSIS_ENABLED=true

# Rate Limits
RATE_LIMIT_APPLY=10/hour
RATE_LIMIT_FEEDBACK=50/day
RATE_LIMIT_API=10000/day
```

### Feature Flags

| Feature | Flag | Default |
|---------|------|---------|
| AI Feedback Analysis | `ai_analysis.enabled` | true |
| Automated Triage | `auto_triage.enabled` | true |
| Sentiment Analysis | `sentiment_analysis.enabled` | true |
| Trend Prediction | `trend_prediction.enabled` | true |
| Community Integration | `community.enabled` | true |
| Rewards Program | `rewards.enabled` | true |

## Monitoring

### Metrics Tracked

1. **User Metrics**
   - Total beta users
   - Active users (last 7 days)
   - Completion rate
   - Engagement score

2. **Feedback Metrics**
   - Feedback volume by type
   - Response time
   - Resolution rate
   - Sentiment score

3. **Performance Metrics**
   - API response times
   - Error rates
   - Processing times
   - System health

4. **Business Metrics**
   - NPS score
   - User satisfaction
   - Feature adoption
   - Retention rate

### Alerts

1. **Critical Feedback Alert**
   - Trigger: Critical or urgent feedback submitted
   - Channels: Slack, Email
   - Recipients: Beta team, Engineering leads

2. **High Bug Volume Alert**
   - Trigger: >20 bugs in 24 hours
   - Channels: Slack
   - Recipients: Engineering team

3. **Low Engagement Alert**
   - Trigger: <50% active users in 7 days
   - Channels: Email
   - Recipients: Product team

## Deployment

### Prerequisites

1. Cloudflare Workers account
2. D1 database created
3. KV namespace provisioned
4. Environment variables configured

### Deployment Steps

```bash
# Install dependencies
npm install

# Run tests
npm test

# Deploy to staging
wrangler deploy --env staging

# Run smoke tests
npm run smoke-test

# Deploy to production
wrangler deploy --env production

# Verify deployment
curl https://beta.sdlc.cc/api/beta/health
```

### Database Migration

```bash
# Apply schema migrations
wrangler d1 execute beta-testing-db --file=migrations/001_beta_testing_schema.sql

# Verify tables
wrangler d1 execute beta-testing-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Security

1. **Authentication**
   - JWT tokens for users
   - API keys for service access
   - Role-based access control

2. **Authorization**
   - Beta users can only access their own data
   - Admin role for program management
   - Fine-grained permissions for sensitive operations

3. **Data Protection**
   - All feedback encrypted at rest
   - PII automatically redacted
   - Audit logging for all operations

4. **Rate Limiting**
   - Per-user rate limits
   - API endpoint throttling
   - DDoS protection

## Best Practices

1. **For Beta Testers**
   - Provide detailed, reproducible bug reports
   - Test with realistic data and use cases
   - Engage with the community
   - Complete scenarios systematically

2. **For Admins**
   - Review applications promptly (within 48 hours)
   - Respond to feedback within SLA
   - Monitor engagement metrics
   - Proactively reach out to inactive users

3. **For Developers**
   - Handle errors gracefully
   - Provide clear error messages
   - Monitor performance metrics
   - Implement proper logging

## Troubleshooting

### Common Issues

1. **Application Not Approved**
   - Check if program is at capacity
   - Verify application completeness
   - Contact beta-team@sdlc.cc

2. **Scenarios Not Unlocking**
   - Ensure previous phase is complete
   - Check system time synchronization
   - Refresh browser cache

3. **Feedback Not Submitting**
   - Check authentication token
   - Verify content length limits
   - Check attachment size limits

4. **Missing Credits**
   - Credits awarded after review
   - Check for duplicate submissions
   - Verify feedback quality

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will include detailed logs in responses (development only).

## Support

- **Email**: beta-support@sdlc.cc
- **Slack**: #beta-support
- **Documentation**: https://docs.sdlc.cc/beta
- **API Reference**: https://api.sdlc.cc/beta/docs

## Changelog

### v1.0.0 (2025-11-04)
- Initial release
- Complete beta testing program implementation
- AI-powered feedback analysis
- 5-phase testing structure
- Community integration
- Rewards program
- Comprehensive analytics
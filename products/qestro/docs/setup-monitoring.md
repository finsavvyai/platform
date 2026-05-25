# Monitoring and Analytics Setup for Questro

## 1. Google Analytics 4 Setup

### Create GA4 Property
1. Go to [Google Analytics](https://analytics.google.com)
2. Create new property for "Questro"
3. Set up data streams:
   - **Web Stream**: questro.io (landing page)
   - **Web Stream**: app.questro.io (dashboard)
4. Copy Measurement ID (G-XXXXXXXXXX)

### Implementation
Add to both landing page and dashboard:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Custom Events to Track
```javascript
// User Registration
gtag('event', 'sign_up', {
  method: 'email'
});

// Test Recording Started
gtag('event', 'test_recording_started', {
  event_category: 'engagement',
  test_type: 'mobile', // or 'web'
});

// Test Export
gtag('event', 'test_exported', {
  event_category: 'engagement',
  export_format: 'maestro', // or 'workflow-use'
});

// Agent Download
gtag('event', 'agent_download', {
  event_category: 'engagement',
  platform: 'macos', // or 'windows', 'linux'
});
```

## 2. Mixpanel Setup (Product Analytics)

### Create Project
1. Sign up at [Mixpanel](https://mixpanel.com)
2. Create project "Questro"
3. Copy Project Token

### Implementation
```javascript
// Initialize Mixpanel
mixpanel.init('YOUR_PROJECT_TOKEN');

// Track user properties
mixpanel.people.set({
  '$email': user.email,
  '$name': user.name,
  'plan': user.subscription_plan,
  'team_size': user.team_size
});

// Track events
mixpanel.track('Recording Session Started', {
  'Platform': 'iOS',
  'Device Model': 'iPhone 15 Pro',
  'Session Duration': 120
});

mixpanel.track('Test Suite Created', {
  'Test Count': 5,
  'Platforms': ['iOS', 'Web'],
  'Integration Type': 'Slack'
});
```

## 3. Sentry Error Monitoring

### Setup
1. Create account at [Sentry](https://sentry.io)
2. Create projects:
   - **questro-frontend** (React)
   - **questro-backend** (Node.js)
   - **questro-agent** (Node.js)

### Frontend Integration
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_FRONTEND_DSN",
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

### Backend Integration
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "YOUR_BACKEND_DSN",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

## 4. Uptime Monitoring

### Better Uptime
1. Sign up at [Better Uptime](https://betteruptime.com)
2. Create monitors for:
   - **questro.io** (Landing page)
   - **app.questro.io** (Dashboard)
   - **api.questro.io** (API)
   - **api.questro.io/health** (Health endpoint)

### Alerting
Set up alerts for:
- SMS/Email notifications
- Slack integration
- Status page updates

## 5. Performance Monitoring

### Web Vitals Tracking
```javascript
import {getCLS, getFID, getFCP, getLCP, getTTFB} from 'web-vitals';

function sendToAnalytics({name, delta, value, id}) {
  gtag('event', name, {
    event_category: 'Web Vitals',
    event_label: id,
    value: Math.round(name === 'CLS' ? delta * 1000 : delta),
    non_interaction: true,
  });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### API Performance
```javascript
// Express middleware for API monitoring
const responseTime = require('response-time');

app.use(responseTime((req, res, time) => {
  // Send metrics to monitoring service
  console.log(`${req.method} ${req.url} - ${time}ms`);
  
  // Track slow endpoints
  if (time > 1000) {
    Sentry.captureMessage(`Slow API endpoint: ${req.url}`, 'warning');
  }
}));
```

## 6. Business Metrics Dashboard

### Key Metrics to Track
1. **User Acquisition**
   - Signups per day/week/month
   - Traffic sources
   - Landing page conversion rate

2. **User Engagement**
   - Daily/Monthly active users
   - Test recordings per user
   - Session duration
   - Feature adoption rates

3. **Product Usage**
   - Tests created per day
   - Platform distribution (iOS/Android/Web)
   - Agent downloads
   - Export frequency

4. **Business Health**
   - Trial-to-paid conversion
   - Churn rate
   - Customer lifetime value
   - Support ticket volume

### Custom Dashboard
Create a custom dashboard combining:
- Google Analytics data
- Mixpanel user analytics
- Supabase user metrics
- Render deployment metrics

## 7. Alerting Rules

### Critical Alerts
```yaml
# API Response Time
alert: HighAPIResponseTime
expr: api_request_duration_seconds > 2.0
for: 5m
annotations:
  summary: "API response time is high"

# Error Rate
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
for: 2m
annotations:
  summary: "High error rate detected"

# User Registration Drop
alert: LowRegistrations
expr: daily_registrations < 5
for: 1d
annotations:
  summary: "Daily registrations below threshold"
```

## 8. Status Page

### Create Status Page
1. Use [Atlassian Statuspage](https://www.atlassian.com/software/statuspage)
2. Set up components:
   - Landing Page (questro.io)
   - Dashboard (app.questro.io)
   - API (api.questro.io)
   - Agent Downloads
   - Mobile Testing Services
   - Web Testing Services

### Integration
- Connect Better Uptime monitors
- Set up automated incident updates
- Configure maintenance windows

## 9. Environment Variables

Add these to your production environment:

```bash
# Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
MIXPANEL_TOKEN=your-mixpanel-token

# Error Monitoring
SENTRY_DSN_FRONTEND=https://xxx@sentry.io/xxx
SENTRY_DSN_BACKEND=https://xxx@sentry.io/xxx

# Monitoring
BETTER_UPTIME_API_KEY=your-api-key
STATUS_PAGE_ID=your-status-page-id

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx
```

## 10. Regular Reviews

### Weekly Reviews
- Performance metrics
- Error rates and incidents
- User feedback and support tickets
- Feature usage analytics

### Monthly Reviews
- Business KPIs
- User growth trends
- Revenue metrics
- Product roadmap adjustments

This monitoring setup provides comprehensive visibility into Questro's performance, user behavior, and business health!
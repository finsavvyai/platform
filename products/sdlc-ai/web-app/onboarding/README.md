# SDLC Customer Onboarding System

A comprehensive customer onboarding workflow for the SDLC Compliance Intelligence Platform. This system provides a seamless 5-minute setup experience for enterprise customers to get started with AI compliance.

## 🚀 Features

### Complete Onboarding Journey
- **Step 1**: Welcome and value proposition
- **Step 2**: Account creation with multiple signup methods
- **Step 3**: Industry selection with automatic compliance framework configuration
- **Step 4**: AI provider selection and connection
- **Step 5**: API key generation and security setup
- **Step 6**: Interactive compliance testing with real PII detection
- **Step 7**: Dashboard preview and analytics overview
- **Step 8**: Success confirmation and next steps

### Technical Features
- **Multi-provider support**: OpenAI, Anthropic, AWS Bedrock, Google AI, Azure
- **Real-time PII detection**: SSN, email, phone, credit cards, medical IDs
- **Compliance framework auto-configuration**: HIPAA, GDPR, FINRA, SOC2, PCI-DSS
- **Cryptographic audit trails**: SHA256 hashing and immutable logging
- **Responsive design**: Works on desktop, tablet, and mobile
- **Progress tracking**: Visual progress indicators and step validation
- **API integration**: Full backend with Cloudflare Workers

## 📁 Project Structure

```
onboarding/
├── index.html          # Main onboarding application
├── api.js              # Cloudflare Worker backend
├── wrangler.toml       # Cloudflare deployment config
├── README.md           # This file
└── assets/             # Static assets (CSS, JS, images)
```

## 🛠️ Setup & Deployment

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI installed

### Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Start local development server**
```bash
npx wrangler pages dev index.html --port 3000
```

3. **Start API worker locally**
```bash
npx wrangler dev api.js --port 8787
```

4. **Access the application**
- Frontend: http://localhost:3000
- API: http://localhost:8787

### Production Deployment

1. **Create KV namespaces**
```bash
# Create production KV namespaces
wrangler kv:namespace create "SDLC_USERS"
wrangler kv:namespace create "SDLC_API_KEYS"
wrangler kv:namespace create "SDLC_AUDIT_LOGS"
wrangler kv:namespace create "SDLC_ANALYTICS"

# Create preview KV namespaces
wrangler kv:namespace create "SDLC_USERS" --preview
wrangler kv:namespace create "SDLC_API_KEYS" --preview
wrangler kv:namespace create "SDLC_AUDIT_LOGS" --preview
wrangler kv:namespace create "SDLC_ANALYTICS" --preview
```

2. **Update wrangler.toml**
Add the KV namespace IDs from step 1 to your `wrangler.toml` file.

3. **Deploy API worker**
```bash
npx wrangler deploy --env production
```

4. **Deploy frontend to Cloudflare Pages**
```bash
npx wrangler pages deploy index.html --project-name sdlc-onboarding
```

5. **Configure custom domain**
```bash
# Add custom domain in Cloudflare dashboard
# or use Wrangler:
npx wrangler custom-domain create sdlc-onboarding
```

## 📊 API Endpoints

### Authentication & Onboarding
- `POST /api/onboarding/signup` - Create new account
- `POST /api/onboarding/verify-email` - Verify email address
- `POST /api/onboarding/api-keys` - Generate API keys
- `POST /api/onboarding/complete` - Complete onboarding process

### Configuration
- `GET /api/onboarding/config` - Get configuration options
- `PUT /api/onboarding/config` - Update tenant configuration
- `GET /api/onboarding/providers` - Get supported AI providers

### Testing & Validation
- `POST /api/onboarding/test-compliance` - Run compliance test
- `GET /api/onboarding/health` - Health check endpoint

## 🔧 Configuration

### Environment Variables
```toml
[vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://api.sdlc.finsavvyai.com"
DASHBOARD_URL = "https://dashboard.sdlc.finsavvyai.com"
```

### KV Namespace Structure

#### SDLC_USERS
- `email:{email}` - User data indexed by email
- `user:{userId}` - User data indexed by user ID
- `tenant:{tenantId}` - Tenant information

#### SDLC_API_KEYS
- `key:{apiKey}` - API key information and permissions

#### SDLC_AUDIT_LOGS
- `{auditId}` - Individual audit log entries

#### SDLC_ANALYTICS
- `onboarding:{tenantId}` - Onboarding analytics and metrics

## 🧪 Testing

### Run Local Tests
```bash
# Test the onboarding flow manually
# or run automated tests:
npm test
```

### API Testing
```bash
# Test health endpoint
curl https://onboarding.sdlc.finsavvyai.com/api/onboarding/health

# Test signup
curl -X POST https://onboarding.sdlc.finsavvyai.com/api/onboarding/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "company": "Test Company",
    "companySize": "50-100",
    "industry": "healthcare"
  }'
```

## 📈 Analytics & Monitoring

### Key Metrics Tracked
- **Conversion Rate**: Landing page → Sign up completion
- **Time to First API Call**: Average onboarding time
- **Provider Selection**: Most popular AI providers
- **Industry Distribution**: Customer industry breakdown
- **Geographic Distribution**: Customer locations
- **Error Rates**: Failed steps and error patterns

### Monitoring Setup
1. **Cloudflare Analytics** - Built-in performance metrics
2. **Custom Events** - Track onboarding step completion
3. **Error Tracking** - Monitor API failures and user drop-off
4. **User Analytics** - Track conversion funnels and user behavior

## 🔒 Security Considerations

### API Key Security
- Keys are generated using cryptographically secure random numbers
- Production and development keys have different prefixes
- Keys are stored encrypted in Cloudflare KV
- Rate limiting and usage quotas are enforced

### Data Protection
- All sensitive data is hashed using SHA-256
- PII is automatically detected and redacted
- Audit trails are immutable and cryptographically secured
- Email verification prevents account takeover

### Compliance
- GDPR compliant data handling
- Data residency options for different regions
- Audit trails for regulatory compliance
- Role-based access control

## 🚀 Performance Optimization

### Frontend Optimization
- Lazy loading of components
- Image optimization
- CSS and JavaScript minification
- CDN distribution via Cloudflare

### Backend Optimization
- Edge computing via Cloudflare Workers
- KV store for fast data access
- Efficient caching strategies
- Request deduplication

## 🔄 Integration with Other Services

### Email Service
Integration with email providers for:
- Welcome emails
- Email verification
- Trial expiration notices
- Support follow-ups

### Billing Service
Integration with payment processors:
- Trial activation
- Subscription management
- Usage-based billing
- Enterprise plan upgrades

### Analytics Service
Integration with analytics platforms:
- User behavior tracking
- Conversion funnel analysis
- Performance metrics
- Business intelligence

## 🛠️ Troubleshooting

### Common Issues

#### CORS Errors
Ensure proper CORS headers are set in the API worker:
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
```

#### KV Namespace Issues
Verify KV namespaces are properly configured in `wrangler.toml` and that the worker has the necessary bindings.

#### API Key Generation
Ensure the API key generation function has sufficient entropy and proper prefixing for different key types.

#### Email Verification
Check email service configuration and verify domain records (SPF, DKIM) for proper email delivery.

### Debug Mode
Enable debug logging by setting the environment variable:
```bash
export DEBUG=true
npx wrangler dev api.js
```

## 📚 Documentation

- [SDLC Platform Documentation](../README.md)
- [API Reference](./api.md)
- [Deployment Guide](./deployment.md)
- [Security Best Practices](./security.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is part of the SDLC Compliance Intelligence Platform. See the main project repository for licensing information.

## 🆘 Support

For support:
- Technical issues: Create a GitHub issue
- Customer support: support@sdlc.finsavvyai.com
- Sales inquiries: sales@sdlc.finsavvyai.com
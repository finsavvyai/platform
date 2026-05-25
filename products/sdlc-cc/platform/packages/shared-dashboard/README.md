# Unified Enterprise Dashboard

A comprehensive, real-time dashboard for monitoring and managing all enterprise products in the Finsavvy AI ecosystem.

## Features

### 🎯 Core Capabilities
- **Real-time Monitoring** - WebSocket-based live updates for all products
- **Unified Analytics** - Aggregated metrics across all enterprise products
- **Multi-Product Management** - Single pane of glass for all services
- **Advanced Security** - Production-ready JWT, API keys, and Cloudflare Access integration
- **Activity Tracking** - Comprehensive audit log and activity feed
- **Alert Management** - Real-time alerts and notifications

### 🔐 Security Features
- HMAC-signed JWT tokens with secure crypto
- PBKDF2 password hashing with 100,000 iterations
- Secure API key generation and hashing
- Role-based access control (RBAC)
- Permission-based authorization
- Session management with activity tracking
- Cloudflare Access integration

### 📊 Monitored Products
- **PipeWarden** - API Gateway & Security Platform
- **QuantumBeam** - Fraud Detection & AI Platform
- **MCPOverflow** - MCP Connector Generation Platform
- **Qestro** - Test Orchestration & QA Platform
- **SDLC.ai** - Secure Data Learning Platform
- **QueryFlux** - Cross-Platform Database Management
- **UPM** - Universal Package Manager
- **YallaBye** - Travel Booking Platform
- **Fintech Enterprise** - Unified Billing & Fraud Detection
- **QueryLens** - AI-Powered Query Analytics

## Architecture

### Backend (Cloudflare Workers)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQL)
- **Cache**: Cloudflare KV
- **Storage**: Cloudflare R2
- **Real-time**: Durable Objects with WebSockets
- **Analytics**: Cloudflare Analytics Engine

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand + Jotai
- **Data Fetching**: TanStack Query
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account with Workers enabled
- Configured D1 database

### Installation

1. **Clone and install dependencies**
   ```bash
   cd packages/shared-dashboard
   npm install
   ```

2. **Configure Cloudflare resources**
   ```bash
   # Create D1 database
   wrangler d1 create unified_dashboard

   # Create KV namespace
   wrangler kv:namespace create DASHBOARD_CACHE

   # Create R2 bucket
   wrangler r2 bucket create dashboard-assets
   ```

3. **Update wrangler.toml**
   Update the database_id and KV namespace ID in `wrangler.toml` with the values from step 2.

4. **Run database migrations**
   ```bash
   chmod +x scripts/migrate.sh
   ./scripts/migrate.sh production
   ```

5. **Configure environment variables**
   Create a `.env` file or use Cloudflare Secrets:
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put API_KEY_SECRET
   ```

### Development

1. **Start development server**
   ```bash
   npm run dev
   ```
   This starts the worker at http://localhost:8787

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Type checking**
   ```bash
   npm run type-check
   ```

4. **Linting**
   ```bash
   npm run lint:check  # Check for issues
   npm run lint:fix    # Auto-fix issues
   ```

5. **Testing**
   ```bash
   npm test              # Run tests
   npm run test:watch    # Watch mode
   npm run test:coverage # With coverage
   ```

### Deployment

1. **Deploy to Cloudflare Workers**
   ```bash
   npm run deploy
   ```

2. **Deploy with specific environment**
   ```bash
   wrangler deploy --env production
   ```

3. **Check deployment status**
   ```bash
   wrangler deployments list
   ```

## API Documentation

### Authentication Endpoints

#### POST /api/v1/auth/login
Login with email and password
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### POST /api/v1/auth/register
Register new user
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword",
  "organizationId": "org-id" // optional
}
```

#### POST /api/v1/auth/logout
Logout and destroy session (requires authentication)

#### GET /api/v1/auth/me
Get current user info (requires authentication)

#### POST /api/v1/auth/refresh
Refresh authentication token (requires authentication)

#### POST /api/v1/auth/api-keys
Generate new API key (requires authentication)
```json
{
  "name": "My API Key",
  "permissions": ["read", "write"],
  "expiresIn": 90 // days, optional
}
```

#### GET /api/v1/auth/api-keys
List user's API keys (requires authentication)

#### DELETE /api/v1/auth/api-keys/:id
Revoke API key (requires authentication)

### Product Endpoints

#### GET /api/v1/products/status
Get status of all products

#### GET /api/v1/products/:productId/metrics
Get real-time metrics for specific product

### Metrics Endpoints

#### GET /api/v1/metrics/aggregate
Get aggregate metrics across all products

### Activity Endpoints

#### GET /api/v1/activity/recent?limit=20
Get recent activity across all products

### Notification Endpoints

#### GET /api/v1/notifications
Get unread notifications

#### POST /api/v1/notifications/:id/read
Mark notification as read

### Real-time Endpoints

#### GET /api/v1/realtime/ws
WebSocket endpoint for real-time updates

#### POST /api/v1/realtime/broadcast
Broadcast message to all connected clients (requires authentication)

#### POST /api/v1/realtime/metrics
Broadcast metrics update

#### POST /api/v1/realtime/alert
Broadcast alert (requires authentication)

### Analytics Endpoints

#### GET /api/v1/analytics/dashboard?range=24h
Get dashboard analytics

## WebSocket Protocol

### Client Messages

**Ping**
```json
{
  "type": "ping"
}
```

**Subscribe to Product**
```json
{
  "type": "subscribe",
  "productId": "pipewarden"
}
```

**Unsubscribe from Product**
```json
{
  "type": "unsubscribe",
  "productId": "pipewarden"
}
```

### Server Messages

**Connected**
```json
{
  "type": "connected",
  "timestamp": "2024-12-26T10:00:00Z",
  "connectedClients": 5
}
```

**Metrics Update**
```json
{
  "type": "metrics_update",
  "data": {
    "productId": "pipewarden",
    "totalRequests": 12345,
    "uptime": 99.9
  },
  "timestamp": "2024-12-26T10:00:00Z"
}
```

**Alert**
```json
{
  "type": "alert",
  "data": {
    "id": "alert-123",
    "productId": "quantumbeam",
    "severity": "high",
    "title": "High Error Rate",
    "description": "Error rate exceeded threshold"
  },
  "timestamp": "2024-12-26T10:00:00Z"
}
```

**Heartbeat**
```json
{
  "type": "heartbeat",
  "connectedClients": 5,
  "timestamp": "2024-12-26T10:00:00Z"
}
```

## Database Schema

See [migrations/001_init.sql](migrations/001_init.sql) for complete schema.

### Main Tables
- `dashboard_users` - User accounts
- `dashboard_organizations` - Organization management
- `dashboard_products` - Product configuration
- `dashboard_activity` - Activity log
- `dashboard_notifications` - Notifications
- `dashboard_alerts` - Alerts and incidents
- `dashboard_metrics_snapshots` - Historical metrics
- `dashboard_sessions` - User sessions
- `dashboard_api_keys` - API keys
- `dashboard_user_preferences` - User preferences

## Security Best Practices

1. **JWT Secrets**
   - Use strong, random JWT secrets (32+ characters)
   - Store in Cloudflare Secrets, never in code
   - Rotate regularly (every 90 days)

2. **Password Requirements**
   - Minimum 12 characters
   - Hashed with PBKDF2 (100,000 iterations)
   - Never stored in plain text

3. **API Keys**
   - Generated with crypto.getRandomValues
   - Hashed with SHA-256 before storage
   - Only shown once on creation

4. **RBAC**
   - Admin: Full access
   - User: Standard access
   - Viewer: Read-only access

5. **Rate Limiting**
   - Configured per environment
   - Default: 120 requests/minute

## Monitoring & Observability

### Cloudflare Analytics
- Request volume and latency
- Error rates and status codes
- Geographic distribution
- Cache hit rates

### Custom Metrics
- Product health status
- Real-time user counts
- Revenue tracking
- System uptime

### Logging
- Structured JSON logs
- Error tracking with stack traces
- Audit logs for compliance
- Session tracking

## Troubleshooting

### Common Issues

**Database connection errors**
```bash
# Verify D1 database exists
wrangler d1 list

# Check database schema
wrangler d1 execute unified_dashboard --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**WebSocket connection fails**
- Check wrangler.toml Durable Object configuration
- Verify DASHBOARD_REALTIME binding exists
- Check browser console for errors

**Authentication issues**
- Verify JWT_SECRET is set
- Check token expiration
- Verify user exists in database

**Build errors**
- Clear node_modules and reinstall
- Check TypeScript version compatibility
- Verify all dependencies are installed

## Performance Optimization

- **Caching**: KV namespace for hot data (5min TTL)
- **CDN**: R2 for static assets
- **Database**: Indexed queries for fast lookups
- **Real-time**: Durable Objects for WebSocket connections
- **Compression**: Automatic response compression

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- GitHub Issues: [Create an issue](https://github.com/your-org/enterprise-dashboard/issues)
- Documentation: [Full docs](https://docs.finsavvyai.com)
- Email: support@finsavvyai.com

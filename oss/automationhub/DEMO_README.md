# UPM.Plus Production Features Demo

This demo showcases all the production-ready features of UPM.Plus including billing, subscriptions, usage tracking, and health monitoring.

## Quick Start

### Prerequisites

1. **Start the server**:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Install demo dependencies** (if not already installed):
   ```bash
   pip install httpx
   ```

### Running the Demo

#### Option 1: Python CLI Demo (Recommended)

```bash
python3 demo_production_features.py
```

This will:
- Authenticate with the API
- Check system health
- Display pricing information
- Show current subscription status
- Display usage tracking
- Demonstrate billing features

#### Option 2: Web Interface Demo

```bash
# Open in browser
open demo_web_interface.html
# or
xdg-open demo_web_interface.html
# or just double-click the file
```

The web interface provides:
- Interactive dashboard
- Real-time health monitoring
- Subscription management UI
- Usage visualization
- Pricing comparison

#### Option 3: Use the Demo Script

```bash
./run_demo.sh
```

This script will:
- Check if server is running
- Let you choose demo type
- Run the selected demo

## Demo Features

### 1. Health Checks
- Basic health endpoint
- Detailed health with dependencies
- System metrics
- Kubernetes probes

### 2. Pricing Information
- All 5 subscription tiers
- Monthly and yearly pricing
- Feature comparisons
- Usage limits per tier

### 3. Subscription Management
- View current subscription
- Create new subscriptions
- Update subscription tier
- Cancel subscriptions

### 4. Usage Tracking
- Real-time usage monitoring
- 7 usage metrics:
  - API requests
  - Workflow executions
  - Browser sessions
  - Storage (GB)
  - Agent executions
  - Document processing
  - LLM tokens
- Usage limit checking
- Visual usage bars

### 5. Billing Features
- Invoice listing
- Payment processing (with Stripe)
- Usage-based charges
- Billing period tracking

## Configuration

### API Endpoint

By default, the demo connects to `http://localhost:8000`. To change this:

**Python CLI**: Edit `BASE_URL` in `demo_production_features.py`

**Web Interface**: Update the API URL in the configuration section

### Authentication

The demo will:
1. Try to login with demo credentials
2. If login fails, register a new user
3. Use the access token for all API calls

**Default credentials:**
- Email: `demo@example.com`
- Password: `demo123456`

## What You'll See

### Python CLI Demo Output

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          UPM.Plus Production Features Demo                   ║
║                                                              ║
║     Showcasing: Billing • Usage • Health • Payments         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

============================================================
                    1. Authentication
============================================================

✓ Logged in as demo@example.com

============================================================
                      2. Health Checks
============================================================

✓ Basic health check passed
✓ Detailed health check passed
✓ Metrics retrieved

============================================================
                  3. Pricing Information
============================================================

✓ Pricing information retrieved

Available Subscription Tiers:

FREE            Monthly: $    0.00 | Yearly: $    0.00
STARTER         Monthly: $   29.00 | Yearly: $  290.00
PROFESSIONAL    Monthly: $   99.00 | Yearly: $  990.00
BUSINESS        Monthly: $  299.00 | Yearly: $2,990.00
ENTERPRISE      Monthly: $  999.00 | Yearly: $9,990.00

...and more!
```

### Web Interface Features

- **Real-time Dashboard**: Live health status, subscription info, usage metrics
- **Interactive Controls**: Create/cancel subscriptions, refresh data
- **Visual Usage Bars**: See usage at a glance
- **Pricing Comparison**: Side-by-side tier comparison
- **Responsive Design**: Works on desktop and mobile

## Troubleshooting

### Server Not Running

If you see connection errors:
```bash
cd backend
uvicorn app.main:app --reload
```

### Authentication Errors

If login fails:
1. Check that the server is running
2. Try registering a new user manually:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","password":"demo123456","full_name":"Demo User"}'
   ```

### Stripe Not Configured

Subscription creation will show a warning if Stripe is not configured. This is normal for demo purposes. To enable payments:

1. Get Stripe API keys from https://stripe.com
2. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
3. Restart the server

### Database Not Migrated

If you see database errors:
```bash
cd backend
alembic upgrade head
```

## Next Steps

After running the demo:

1. **Review the code**: See how features are implemented
2. **Check documentation**: Read `PRODUCTION_READY_GUIDE.md`
3. **Configure production**: Set up Stripe, database, etc.
4. **Deploy**: Follow deployment guide
5. **Start selling**: Your platform is ready!

## API Endpoints Demonstrated

- `GET /health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health
- `GET /api/v1/metrics` - System metrics
- `GET /api/v1/billing/pricing` - Pricing info
- `GET /api/v1/billing/subscriptions/current` - Current subscription
- `POST /api/v1/billing/subscriptions` - Create subscription
- `GET /api/v1/billing/usage/summary` - Usage summary
- `POST /api/v1/billing/usage/check` - Check specific usage
- `GET /api/v1/billing/invoices` - List invoices

## Support

For issues or questions:
- Check `PRODUCTION_READY_GUIDE.md`
- Review API docs at `/docs` (when server is running)
- Check health endpoint: `/health`

---

**Enjoy the demo!** 🚀


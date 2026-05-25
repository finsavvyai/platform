"""
UPM.Plus Production Features Demo

This demo showcases the production-ready features including:
- Billing and subscription management
- Usage tracking
- Health monitoring
- Payment processing

Run this demo to see all commercial features in action.
"""

import asyncio
import httpx
import json
from datetime import datetime
from typing import Dict, Any
import sys

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/v1"

# Demo user credentials (create these first via registration)
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo123456"

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(text: str):
    """Print formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")


def print_success(text: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")


def print_info(text: str):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")


def print_warning(text: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")


def print_error(text: str):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")


def print_json(data: Dict[Any, Any], title: str = ""):
    """Pretty print JSON data"""
    if title:
        print(f"\n{Colors.OKBLUE}{title}:{Colors.ENDC}")
    print(json.dumps(data, indent=2, default=str))


class UPMPLusDemo:
    """UPM.Plus Production Features Demo"""

    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.access_token = None
        self.user_id = None

    async def login(self) -> bool:
        """Login and get access token"""
        print_header("1. Authentication")
        
        try:
            # Try to login
            response = await self.client.post(
                f"{API_BASE}/auth/login",
                data={
                    "username": DEMO_EMAIL,
                    "password": DEMO_PASSWORD
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                print_success(f"Logged in as {DEMO_EMAIL}")
                return True
            else:
                print_warning("Login failed. Attempting registration...")
                return await self.register()
                
        except Exception as e:
            print_error(f"Login error: {e}")
            print_info("Make sure the server is running: uvicorn app.main:app --reload")
            return False

    async def register(self) -> bool:
        """Register new user"""
        try:
            response = await self.client.post(
                f"{API_BASE}/auth/register",
                json={
                    "email": DEMO_EMAIL,
                    "password": DEMO_PASSWORD,
                    "full_name": "Demo User"
                }
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.access_token = data.get("access_token")
                print_success(f"Registered and logged in as {DEMO_EMAIL}")
                return True
            else:
                print_error(f"Registration failed: {response.text}")
                return False
                
        except Exception as e:
            print_error(f"Registration error: {e}")
            return False

    def get_headers(self) -> Dict[str, str]:
        """Get request headers with auth"""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    async def check_health(self):
        """Check system health"""
        print_header("2. Health Checks")
        
        try:
            # Basic health check
            response = await self.client.get("/health")
            if response.status_code == 200:
                data = response.json()
                print_success("Basic health check passed")
                print_json(data, "Health Status")
            
            # Detailed health check
            response = await self.client.get(f"{API_BASE}/health/detailed")
            if response.status_code == 200:
                data = response.json()
                print_success("Detailed health check passed")
                print_json(data, "Detailed Health")
            
            # Metrics
            response = await self.client.get(f"{API_BASE}/metrics")
            if response.status_code == 200:
                data = response.json()
                print_success("Metrics retrieved")
                print_json(data, "System Metrics")
                
        except Exception as e:
            print_error(f"Health check error: {e}")

    async def get_pricing(self):
        """Get pricing information"""
        print_header("3. Pricing Information")
        
        try:
            response = await self.client.get(
                f"{API_BASE}/billing/pricing",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Pricing information retrieved")
                
                print(f"\n{Colors.BOLD}Available Subscription Tiers:{Colors.ENDC}\n")
                for tier, info in data.get("pricing", {}).items():
                    monthly = info.get("monthly", "0.00")
                    yearly = info.get("yearly", "0.00")
                    print(f"{Colors.OKGREEN}{tier.upper():15} {Colors.ENDC}Monthly: ${monthly:>8} | Yearly: ${yearly:>8}")
                
                print_json(data, "Full Pricing Details")
            else:
                print_error(f"Failed to get pricing: {response.text}")
                
        except Exception as e:
            print_error(f"Pricing error: {e}")

    async def get_current_subscription(self):
        """Get current subscription"""
        print_header("4. Current Subscription")
        
        try:
            response = await self.client.get(
                f"{API_BASE}/billing/subscriptions/current",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("subscription"):
                    sub = data["subscription"]
                    print_success("Current subscription found")
                    print(f"\n{Colors.BOLD}Subscription Details:{Colors.ENDC}")
                    print(f"  Tier: {Colors.OKGREEN}{sub.get('tier', 'N/A')}{Colors.ENDC}")
                    print(f"  Status: {Colors.OKGREEN}{sub.get('status', 'N/A')}{Colors.ENDC}")
                    print(f"  Billing Period: {sub.get('billing_period', 'N/A')}")
                    print(f"  Period End: {sub.get('current_period_end', 'N/A')}")
                    print_json(sub, "Full Subscription Details")
                else:
                    print_info("No active subscription (on free tier)")
                    print_json(data)
            else:
                print_error(f"Failed to get subscription: {response.text}")
                
        except Exception as e:
            print_error(f"Subscription error: {e}")

    async def create_subscription(self, tier: str = "starter", period: str = "monthly"):
        """Create a subscription"""
        print_header(f"5. Create Subscription ({tier.upper()} - {period.upper()})")
        
        try:
            response = await self.client.post(
                f"{API_BASE}/billing/subscriptions",
                headers=self.get_headers(),
                json={
                    "tier": tier,
                    "billing_period": period
                }
            )
            
            if response.status_code == 201:
                data = response.json()
                print_success(f"Subscription created successfully!")
                print_json(data, "Subscription Created")
                return data.get("id")
            else:
                print_warning(f"Subscription creation: {response.status_code}")
                print_info("Note: This requires Stripe configuration in production")
                print_json(response.json() if response.text else {}, "Response")
                return None
                
        except Exception as e:
            print_error(f"Subscription creation error: {e}")
            return None

    async def check_usage(self):
        """Check usage limits"""
        print_header("6. Usage Tracking")
        
        try:
            # Check usage summary
            response = await self.client.get(
                f"{API_BASE}/billing/usage/summary",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Usage summary retrieved")
                
                print(f"\n{Colors.BOLD}Usage Summary:{Colors.ENDC}\n")
                usage = data.get("usage", {})
                for metric, info in usage.items():
                    used = info.get("used", 0)
                    limit = info.get("limit", 0)
                    remaining = info.get("remaining", 0)
                    allowed = info.get("allowed", True)
                    
                    status_color = Colors.OKGREEN if allowed else Colors.WARNING
                    status_icon = "✓" if allowed else "⚠"
                    
                    print(f"{status_color}{status_icon} {Colors.ENDC}{metric:25} "
                          f"Used: {used:>8} / Limit: {limit:>8} | Remaining: {remaining:>8}")
                
                print_json(data, "Full Usage Details")
            else:
                print_error(f"Failed to get usage: {response.text}")
                
        except Exception as e:
            print_error(f"Usage check error: {e}")

    async def check_specific_usage(self, metric: str):
        """Check specific usage metric"""
        print_header(f"7. Check {metric.upper()} Usage")
        
        try:
            response = await self.client.post(
                f"{API_BASE}/billing/usage/check",
                headers=self.get_headers(),
                json={"metric": metric}
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Usage check for {metric}")
                print_json(data, f"{metric} Usage")
            else:
                print_error(f"Failed to check usage: {response.text}")
                
        except Exception as e:
            print_error(f"Usage check error: {e}")

    async def list_invoices(self):
        """List invoices"""
        print_header("8. Invoice Management")
        
        try:
            response = await self.client.get(
                f"{API_BASE}/billing/invoices",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                invoices = data.get("invoices", [])
                print_success(f"Found {len(invoices)} invoice(s)")
                
                if invoices:
                    print(f"\n{Colors.BOLD}Invoices:{Colors.ENDC}\n")
                    for invoice in invoices:
                        print(f"  Invoice ID: {invoice.get('id', 'N/A')}")
                        print(f"  Amount: ${invoice.get('amount', '0.00')}")
                        print(f"  Status: {invoice.get('status', 'N/A')}")
                        print(f"  Period: {invoice.get('period_start', 'N/A')} to {invoice.get('period_end', 'N/A')}")
                        print()
                else:
                    print_info("No invoices yet")
                
                print_json(data, "Full Invoice Data")
            else:
                print_error(f"Failed to get invoices: {response.text}")
                
        except Exception as e:
            print_error(f"Invoice error: {e}")

    async def run_full_demo(self):
        """Run complete demo"""
        print_header("UPM.Plus Production Features Demo")
        print_info("This demo showcases all production-ready features")
        print_info(f"Connecting to: {BASE_URL}\n")
        
        # Step 1: Login
        if not await self.login():
            print_error("Failed to authenticate. Exiting.")
            return
        
        # Step 2: Health checks
        await self.check_health()
        
        # Step 3: Pricing
        await self.get_pricing()
        
        # Step 4: Current subscription
        await self.get_current_subscription()
        
        # Step 5: Usage tracking
        await self.check_usage()
        
        # Step 6: Check specific metrics
        await self.check_specific_usage("api_requests")
        await self.check_specific_usage("workflow_executions")
        
        # Step 7: Invoices
        await self.list_invoices()
        
        # Step 8: Try to create subscription (will show warning if Stripe not configured)
        await self.create_subscription("starter", "monthly")
        
        print_header("Demo Complete!")
        print_success("All production features demonstrated")
        print_info("\nNext steps:")
        print_info("1. Configure Stripe API keys for payment processing")
        print_info("2. Run database migrations: alembic upgrade head")
        print_info("3. Deploy to production following PRODUCTION_READY_GUIDE.md")
        print_info("4. Start accepting customers and generating revenue!")
        
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


async def main():
    """Main demo function"""
    demo = UPMPLusDemo()
    
    try:
        await demo.run_full_demo()
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user")
    except Exception as e:
        print_error(f"Demo error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await demo.close()


if __name__ == "__main__":
    print(f"""
{Colors.HEADER}{Colors.BOLD}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          UPM.Plus Production Features Demo                   ║
║                                                              ║
║     Showcasing: Billing • Usage • Health • Payments         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
{Colors.ENDC}
    """)
    
    asyncio.run(main())


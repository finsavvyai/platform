#!/bin/bash

# UPM.Plus Cloudflare MCP Server Setup
# This script sets up the Cloudflare MCP server for automated domain management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 SETTING UP CLOUDFLARE MCP SERVER FOR UPM.PLUS${NC}"
echo -e "${BLUE}Automated domain management integration${NC}"
echo

# Check if required environment variables are set
echo -e "${CYAN}Checking environment variables...${NC}"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  CLOUDFLARE_API_TOKEN not found in environment${NC}"
    echo -e "${CYAN}Please set it with: export CLOUDFLARE_API_TOKEN=your_token_here${NC}"
    echo -e "${CYAN}Or create a .env file with the token${NC}"

    # Create .env file template
    cat > .env << EOF
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here

# UPM.Plus Domains
UPM_DOMAINS=upm.plus,upmplus.dev,upmplus.io,upmplus.ai
EOF
    echo -e "${GREEN}✅ Created .env template file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env with your actual Cloudflare credentials${NC}"
else
    echo -e "${GREEN}✅ CLOUDFLARE_API_TOKEN found${NC}"
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}⚠️  CLOUDFLARE_ACCOUNT_ID not found in environment${NC}"
else
    echo -e "${GREEN}✅ CLOUDFLARE_ACCOUNT_ID found${NC}"
fi

echo

# Install Python dependencies
echo -e "${CYAN}Installing Python dependencies...${NC}"

cd mcp-servers/cloudflare-mcp-server

if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi

cd ../..

echo

# Test the MCP server
echo -e "${CYAN}Testing Cloudflare MCP server...${NC}"

cd mcp-servers/cloudflare-mcp-server

# Create a simple test script
cat > test_mcp_server.py << 'EOF'
#!/usr/bin/env python3
"""
Test script for Cloudflare MCP server
"""
import asyncio
import json
import sys
import os
from pathlib import Path

# Add the server directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from cloudflare_mcp_server import CloudflareMCPServer

    async def test_server():
        # Create server instance
        server = CloudflareMCPServer()

        # Test initialization
        await server.initialize()
        print("✅ MCP Server initialized successfully")

        # Test listing tools
        tools = await server.list_tools()
        print(f"✅ Found {len(tools)} available tools:")
        for tool in tools:
            print(f"   - {tool.name}: {tool.description}")

        # Test getting domains (if API token is available)
        if os.getenv('CLOUDFLARE_API_TOKEN'):
            try:
                domains_result = await server.call_tool("get_domains", {})
                domains = json.loads(domains_result.content[0].text)
                print(f"✅ Found {len(domains.get('domains', []))} domains in account")
            except Exception as e:
                print(f"⚠️  Could not fetch domains: {e}")
        else:
            print("⚠️  No CLOUDFLARE_API_TOKEN found, skipping domain test")

        print("✅ MCP Server test completed successfully")

    if __name__ == "__main__":
        asyncio.run(test_server())

except ImportError as e:
    print(f"❌ Failed to import MCP server: {e}")
    print("Please ensure all dependencies are installed")
    sys.exit(1)
except Exception as e:
    print(f"❌ Server test failed: {e}")
    sys.exit(1)
EOF

python3 test_mcp_server.py
echo -e "${GREEN}✅ MCP server test completed${NC}"

cd ../..

echo

# Create Claude Desktop configuration
echo -e "${CYAN}Creating Claude Desktop configuration...${NC}"

# Create config directory if it doesn't exist
CLAUDE_CONFIG_DIR="$HOME/.config/claude-desktop"
mkdir -p "$CLAUDE_CONFIG_DIR"

# Copy the configuration file
cp mcp-servers/claude-desktop-config.json "$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

echo -e "${GREEN}✅ Claude Desktop configuration created${NC}"
echo -e "${CYAN}Config location: $CLAUDE_CONFIG_DIR/claude_desktop_config.json${NC}"

echo

# Create deployment verification script
echo -e "${CYAN}Creating deployment verification script...${NC}"

cat > scripts/verify-cloudflare-deployment.sh << 'EOF'
#!/bin/bash

# UPM.Plus Cloudflare Deployment Verification
# This script verifies the deployment across all UPM.Plus domains

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 VERIFYING CLOUDFLARE DEPLOYMENT FOR UPM.PLUS${NC}"
echo

# Define domains
DOMAINS=("upm.plus" "upmplus.dev" "upmplus.io" "upmplus.ai")
SUBDOMAINS=("www" "api" "app" "admin" "docs" "cdn" "dashboard" "staging" "dev")

echo -e "${CYAN}Testing DNS resolution for all domains...${NC}"

for domain in "${DOMAINS[@]}"; do
    echo -e "${YELLOW}Testing $domain:${NC}"

    # Test main domain
    if nslookup "$domain" >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ $domain resolves${NC}"
    else
        echo -e "   ${RED}❌ $domain does not resolve${NC}"
    fi

    # Test common subdomains
    for subdomain in "${SUBDOMAINS[@]}"; do
        full_domain="$subdomain.$domain"
        if nslookup "$full_domain" >/dev/null 2>&1; then
            echo -e "   ${GREEN}✅ $full_domain resolves${NC}"
        else
            echo -e "   ${YELLOW}⚠️  $full_domain does not resolve (may be intentional)${NC}"
        fi
    done
    echo
done

echo -e "${CYAN}Testing HTTPS connectivity...${NC}"

for domain in "${DOMAINS[@]}"; do
    echo -e "${YELLOW}Testing HTTPS for $domain:${NC}"

    if curl -s -I "https://$domain" | grep -q "200\|301\|302"; then
        echo -e "   ${GREEN}✅ HTTPS working for $domain${NC}"
    else
        echo -e "   ${RED}❌ HTTPS not working for $domain${NC}"
    fi
done

echo

echo -e "${CYAN}Testing API endpoints...${NC}"

# Test API endpoints on each domain
API_ENDPOINTS=("/api/health" "/api/v1/health" "/health")

for domain in "${DOMAINS[@]}"; do
    echo -e "${YELLOW}Testing API endpoints for $domain:${NC}"

    for endpoint in "${API_ENDPOINTS[@]}"; do
        url="https://api.$domain$endpoint"
        if curl -s "$url" | grep -q "healthy\|status\|UPM"; then
            echo -e "   ${GREEN}✅ API responding at $url${NC}"
        else
            echo -e "   ${YELLOW}⚠️  API not responding at $url${NC}"
        fi
    done
    echo
done

echo -e "${GREEN}✅ Deployment verification completed${NC}"
echo -e "${CYAN}Review the results above for any issues that need attention${NC}"
EOF

chmod +x scripts/verify-cloudflare-deployment.sh
echo -e "${GREEN}✅ Verification script created${NC}"

echo

# Create MCP integration test
echo -e "${CYAN}Creating MCP integration test...${NC}"

cat > scripts/test-mcp-integration.py << 'EOF'
#!/usr/bin/env python3
"""
UPM.Plus MCP Integration Test
Tests the Cloudflare MCP server integration with Claude
"""
import asyncio
import json
import subprocess
import sys
from pathlib import Path

async def test_mcp_integration():
    print("🧪 TESTING MCP INTEGRATION FOR UPM.PLUS")
    print()

    # Test 1: Verify MCP server can start
    print("📋 Test 1: MCP Server Startup")
    try:
        server_path = Path(__file__).parent.parent / "mcp-servers" / "cloudflare-mcp-server" / "cloudflare-mcp-server.py"

        # Start server process (in background)
        process = subprocess.Popen([
            sys.executable, str(server_path)
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        # Give it a moment to start
        await asyncio.sleep(2)

        # Check if process is still running
        if process.poll() is None:
            print("✅ MCP server starts successfully")
            process.terminate()
            process.wait()
        else:
            stdout, stderr = process.communicate()
            print(f"❌ MCP server failed to start")
            print(f"Error: {stderr}")
            return False
    except Exception as e:
        print(f"❌ Failed to test MCP server: {e}")
        return False

    print()

    # Test 2: Verify configuration files
    print("📋 Test 2: Configuration Files")

    config_files = [
        "mcp-servers/cloudflare-mcp-server/requirements.txt",
        "mcp-servers/claude-desktop-config.json",
        "deployment/cloudflare/domains.conf"
    ]

    for config_file in config_files:
        if Path(config_file).exists():
            print(f"✅ {config_file} exists")
        else:
            print(f"❌ {config_file} missing")
            return False

    print()

    # Test 3: Check environment setup
    print("📋 Test 3: Environment Setup")

    import os

    required_vars = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
    env_status = True

    for var in required_vars:
        if os.getenv(var):
            print(f"✅ {var} is set")
        else:
            print(f"⚠️  {var} is not set (may cause issues)")
            env_status = False

    if not env_status:
        print("⚠️  Some environment variables are missing")
        print("Please set them or create a .env file with the required values")

    print()

    # Test 4: Test deployment scripts
    print("📋 Test 4: Deployment Scripts")

    scripts = [
        "deployment/cloudflare/multi-domain-deploy.sh",
        "scripts/verify-cloudflare-deployment.sh"
    ]

    for script in scripts:
        script_path = Path(script)
        if script_path.exists() and os.access(script_path, os.X_OK):
            print(f"✅ {script} exists and is executable")
        else:
            print(f"❌ {script} missing or not executable")
            return False

    print()
    print("✅ MCP Integration test completed successfully")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_mcp_integration())
    if not success:
        sys.exit(1)
EOF

chmod +x scripts/test-mcp-integration.py
echo -e "${GREEN}✅ MCP integration test created${NC}"

echo
echo -e "${GREEN}🎉 CLOUDFLARE MCP SERVER SETUP COMPLETED!${NC}"
echo
echo -e "${CYAN}Next steps:${NC}"
echo -e "1. Set your Cloudflare credentials in .env or environment variables"
echo -e "2. Restart Claude Desktop to load the MCP configuration"
echo -e "3. Run './scripts/test-mcp-integration.py' to verify setup"
echo -e "4. Run './scripts/verify-cloudflare-deployment.sh' to check deployment"
echo
echo -e "${CYAN}Available MCP tools:${NC}"
echo -e "- get_domains: List all domains in your Cloudflare account"
echo -e "- create_dns_record: Create DNS records for UPM.Plus services"
echo -e "- update_ssl_settings: Configure SSL/TLS settings"
echo -e "- create_workers: Deploy Cloudflare Workers for edge routing"
echo -e "- purge_cache: Clear cache after deployment"
echo -e "- get_analytics: Retrieve domain analytics"
echo -e "- configure_security: Set up security features"
echo -e "- list_workers: Manage Cloudflare Workers"
echo -e "- get_dns_records: Query existing DNS records"
echo -e "- update_dns_record: Modify existing DNS records"
echo -e "- delete_dns_record: Remove DNS records"
echo
echo -e "${GREEN}Your UPM.Plus domains are now ready for automated Cloudflare management! 🚀${NC}"
#!/usr/bin/env python3
"""
Simple test to verify Cloudflare API connection
"""

import os
from dotenv import load_dotenv
import CloudFlare

# Load environment variables
load_dotenv()

def test_cloudflare_api():
    """Test Cloudflare API connection"""

    print("🔍 Testing Cloudflare API connection...")

    try:
        # Initialize CloudFlare client
        cf = CloudFlare.CloudFlare(api_token=os.getenv('CLOUDFLARE_API_TOKEN'))

        # Test API by getting user info
        user_info = cf.user.get()
        print(f"✅ API connection successful!")
        print(f"   User: {user_info.get('email', 'API Token User')}")

        # Test zone access for each domain
        domains = {
            'upm.plus': os.getenv('CLOUDFLARE_ZONE_ID_UPM_PLUS'),
            'upmplus.dev': os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_DEV'),
            'upmplus.io': os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_IO'),
            'upmplus.ai': os.getenv('CLOUDFLARE_ZONE_ID_UPMPLUS_AI')
        }

        print("\n🌐 Testing domain access:")
        for domain, zone_id in domains.items():
            try:
                zone_info = cf.zones.get(zone_id)
                print(f"✅ {domain} - Zone ID: {zone_id[:8]}... ({zone_info.get('name', 'Unknown')})")
            except Exception as e:
                print(f"❌ {domain} - Error: {e}")

        return True

    except Exception as e:
        print(f"❌ API connection failed: {e}")
        return False

if __name__ == "__main__":
    test_cloudflare_api()
#!/usr/bin/env python3
"""
UPM CLI Example - How developers would use UPM in their daily workflow
This demonstrates the actual API calls that would be made by the UPM CLI tool
"""

import requests
import json
import sys
from pathlib import Path

class UDPClient:
    def __init__(self, base_url="http://localhost:8040", api_key=None):
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json",
            "User-Agent": "UPM-CLI/1.0.0"
        }
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
    
    def health_check(self):
        """Check if UPM service is healthy"""
        try:
            response = requests.get(f"{self.base_url}/health/")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Health check failed: {e}")
            return None
    
    def get_supported_ecosystems(self):
        """Get list of supported package ecosystems"""
        try:
            response = requests.get(f"{self.base_url}/api/v1/dependencies/ecosystems/supported")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get supported ecosystems: {e}")
            return None
    
    def analyze_dependencies(self, manifest_path, organization_id):
        """Analyze dependencies from a manifest file"""
        try:
            with open(manifest_path, 'rb') as f:
                files = {'manifest': f}
                data = {'organization_id': organization_id}
                response = requests.post(
                    f"{self.base_url}/api/v1/dependencies/analyze",
                    files=files,
                    data=data,
                    headers={"Authorization": self.headers.get("Authorization")}
                )
                response.raise_for_status()
                return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to analyze dependencies: {e}")
            return None
        except FileNotFoundError:
            print(f"❌ Manifest file not found: {manifest_path}")
            return None
    
    def get_dependencies(self, organization_id, project_id=None):
        """Get dependencies for an organization or project"""
        try:
            params = {'organization_id': organization_id}
            if project_id:
                params['project_id'] = project_id
            
            response = requests.get(
                f"{self.base_url}/api/v1/dependencies/",
                params=params
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get dependencies: {e}")
            return None
    
    def get_analytics(self, organization_id):
        """Get analytics overview for an organization"""
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/analytics/overview",
                params={'organization_id': organization_id}
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get analytics: {e}")
            return None

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("UPM CLI - Universal Dependency Platform")
        print("Usage: python udp-cli-example.py <command> [options]")
        print("\nCommands:")
        print("  health                    - Check UPM service health")
        print("  ecosystems               - List supported ecosystems")
        print("  analyze <manifest>       - Analyze dependencies from manifest")
        print("  dependencies <org-id>    - Get dependencies for organization")
        print("  analytics <org-id>       - Get analytics overview")
        print("\nExamples:")
        print("  python udp-cli-example.py health")
        print("  python udp-cli-example.py ecosystems")
        print("  python udp-cli-example.py analyze package.json 123e4567-e89b-12d3-a456-426614174000")
        print("  python udp-cli-example.py dependencies 123e4567-e89b-12d3-a456-426614174000")
        print("  python udp-cli-example.py analytics 123e4567-e89b-12d3-a456-426614174000")
        return
    
    command = sys.argv[1]
    client = UDPClient()
    
    if command == "health":
        print("🔍 Checking UPM service health...")
        result = client.health_check()
        if result:
            print("✅ UPM Service Status:")
            print(f"   Status: {result['status']}")
            print(f"   Version: {result['version']}")
            print(f"   Environment: {result['environment']}")
            print(f"   Timestamp: {result['timestamp']}")
    
    elif command == "ecosystems":
        print("🌐 Getting supported ecosystems...")
        result = client.get_supported_ecosystems()
        if result:
            print("✅ Supported Ecosystems:")
            for ecosystem in result['ecosystems']:
                print(f"   • {ecosystem['name']} ({ecosystem['type']})")
                print(f"     Description: {ecosystem['description']}")
                print(f"     Extensions: {', '.join(ecosystem['supported_extensions'])}")
                print()
            print(f"Total: {result['total']} ecosystems, {result['total_extensions']} extensions")
    
    elif command == "analyze":
        if len(sys.argv) < 4:
            print("❌ Usage: analyze <manifest-file> <organization-id>")
            return
        
        manifest_path = sys.argv[2]
        organization_id = sys.argv[3]
        
        print(f"🔍 Analyzing dependencies from {manifest_path}...")
        result = client.analyze_dependencies(manifest_path, organization_id)
        if result:
            print("✅ Analysis completed:")
            print(json.dumps(result, indent=2))
    
    elif command == "dependencies":
        if len(sys.argv) < 3:
            print("❌ Usage: dependencies <organization-id> [project-id]")
            return
        
        organization_id = sys.argv[2]
        project_id = sys.argv[3] if len(sys.argv) > 3 else None
        
        print(f"📦 Getting dependencies for organization {organization_id}...")
        result = client.get_dependencies(organization_id, project_id)
        if result:
            print("✅ Dependencies retrieved:")
            print(json.dumps(result, indent=2))
    
    elif command == "analytics":
        if len(sys.argv) < 3:
            print("❌ Usage: analytics <organization-id>")
            return
        
        organization_id = sys.argv[2]
        
        print(f"📊 Getting analytics for organization {organization_id}...")
        result = client.get_analytics(organization_id)
        if result:
            print("✅ Analytics Overview:")
            print(f"   Organization: {result['organization_id']}")
            print(f"   Period: {result['period']['days']} days")
            print(f"   Total Packages: {result['package_statistics']['total_packages']}")
            print(f"   Vulnerabilities: {result['vulnerability_statistics']['total_vulnerabilities']}")
            print(f"   Dependency Graphs: {result['dependency_statistics']['total_dependency_graphs']}")
            print(f"   Generated: {result['generated_at']}")
    
    else:
        print(f"❌ Unknown command: {command}")
        print("Run without arguments to see usage information.")

if __name__ == "__main__":
    main()

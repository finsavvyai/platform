#!/usr/bin/env python3
"""
FinSavvyAI API Key Management Tool
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from src.core.auth import APIKeyManager
import argparse


def main():
    parser = argparse.ArgumentParser(description="Manage FinSavvyAI API Keys")
    parser.add_argument("command", choices=["create", "list", "disable", "enable", "rotate"], help="Command to execute")
    parser.add_argument("--name", help="Key name (for create)")
    parser.add_argument("--description", help="Key description (for create)")
    parser.add_argument("--key-name", help="Key name (for disable/enable)")
    
    args = parser.parse_args()
    
    manager = APIKeyManager()
    
    if args.command == "create":
        name = args.name or "api-key"
        description = args.description or ""
        key_data = manager.generate_key(name, description)
        print(f"✅ API Key created successfully!")
        print(f"   Name: {key_data['name']}")
        print(f"   Key: {key_data['key']}")
        print(f"   ⚠️  Save this key securely! It won't be shown again.")
    
    elif args.command == "list":
        keys = manager.list_keys()
        if not keys:
            print("No API keys found.")
        else:
            print(f"Found {len(keys)} API key(s):")
            for key in keys:
                status = "✅ Enabled" if key.get("enabled", True) else "❌ Disabled"
                print(f"  - {key.get('name', 'Unknown')}: {status}")
                if key.get("description"):
                    print(f"    Description: {key['description']}")
                if key.get("last_used"):
                    print(f"    Last used: {key['last_used']}")
                print()
    
    elif args.command in ["disable", "enable"]:
        if not args.key_name:
            print("Error: --key-name required for disable/enable")
            sys.exit(1)

        # Find and update key
        found = False
        for key in manager.keys.get("keys", []):
            if key.get("name") == args.key_name:
                key["enabled"] = args.command == "enable"
                manager._save_keys()
                print(f"Key '{args.key_name}' {args.command}d successfully")
                found = True
                break

        if not found:
            print(f"Error: Key '{args.key_name}' not found")
            sys.exit(1)

    elif args.command == "rotate":
        if not args.key_name:
            print("Error: --key-name required for rotate")
            sys.exit(1)
        result = manager.rotate_key(args.key_name)
        if result:
            print(f"Key '{args.key_name}' rotated.")
            print(f"New key: {result['key']}")
            print("Save this key securely!")
        else:
            print(f"Error: Key '{args.key_name}' not found or already disabled")
            sys.exit(1)


if __name__ == "__main__":
    main()


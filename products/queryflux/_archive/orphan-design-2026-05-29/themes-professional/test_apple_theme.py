#!/usr/bin/env python3
"""
Test script for Apple-style theme detection and colors
"""

import subprocess
import platform
from typing import Tuple

def is_dark_mode() -> bool:
    """Detect if macOS is in dark mode"""
    if platform.system() != 'Darwin':
        print("❌ Not on macOS - using default dark mode")
        return True

    try:
        result = subprocess.run(
            ['defaults', 'read', '-g', 'AppleInterfaceStyle'],
            capture_output=True,
            text=True
        )
        is_dark = result.returncode == 0
        print(f"🎨 macOS theme: {'Dark' if is_dark else 'Light'}")
        return is_dark
    except Exception as e:
        print(f"❌ Error detecting theme: {e}")
        return True

def get_accent_color() -> Tuple[int, int, int]:
    """Get macOS accent color"""
    if platform.system() != 'Darwin':
        print("❌ Not on macOS - using default blue accent")
        return (0, 122, 255)

    try:
        result = subprocess.run(
            ['defaults', 'read', '-g', 'AppleAccentColor'],
            capture_output=True,
            text=True
        )

        accent_map = {
            '-1': ('Graphite', (142, 142, 147)),
            '0': ('Red', (255, 59, 48)),
            '1': ('Orange', (255, 149, 0)),
            '2': ('Yellow', (255, 204, 0)),
            '3': ('Green', (52, 199, 89)),
            '4': ('Blue', (0, 122, 255)),
            '5': ('Purple', (88, 86, 214)),
            '6': ('Pink', (255, 45, 85)),
        }

        color_id = result.stdout.strip()
        color_name, rgb = accent_map.get(color_id, ('Blue', (0, 122, 255)))
        print(f"🎨 macOS accent color: {color_name} {rgb}")
        return rgb
    except Exception as e:
        print(f"❌ Error detecting accent color: {e}")
        return (0, 122, 255)

def test_dependencies():
    """Test if required dependencies are available"""
    try:
        import dearpygui
        print("✅ DearPyGui available")
    except ImportError:
        print("❌ DearPyGui not installed")

    try:
        import psycopg2
        print("✅ psycopg2 available")
    except ImportError:
        print("❌ psycopg2 not installed")

def main():
    print("🧪 Testing Apple-style UI enhancements")
    print("=" * 40)

    print(f"🖥️  Platform: {platform.system()} {platform.release()}")

    # Test theme detection
    dark_mode = is_dark_mode()

    # Test accent color detection
    accent_color = get_accent_color()

    # Test dependencies
    test_dependencies()

    print("\n🎯 Theme Configuration:")
    print(f"   Dark Mode: {dark_mode}")
    print(f"   Accent RGB: {accent_color}")
    print(f"   Accent Hex: #{accent_color[0]:02x}{accent_color[1]:02x}{accent_color[2]:02x}")

    print("\n🚀 Ready to launch modern_db_manager.py with Apple-style theming!")

if __name__ == "__main__":
    main()
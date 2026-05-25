#!/usr/bin/env python3
"""
Simple launcher for the Ultimate Apple Database Manager
This script handles virtual environment activation and launches the desktop app
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Launch the Ultimate Database Manager desktop application"""
    
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    
    # Path to the main application
    app_path = script_dir / 'apps' / 'ultimate_apple_db_manager.py'
    
    # Path to virtual environment
    venv_path = script_dir / 'venv'
    venv_python = venv_path / 'bin' / 'python'
    
    print("🚀 Launching Ultimate Database Manager...")
    print(f"📁 App directory: {script_dir}")
    print(f"🐍 Using Python: {venv_python}")
    
    # Check if virtual environment exists
    if not venv_python.exists():
        print("❌ Virtual environment not found!")
        print("Please run the following commands to set up the environment:")
        print(f"cd {script_dir}")
        print("python3 -m venv venv")
        print("source venv/bin/activate")
        print("pip install PySide6 psycopg2-binary pymongo redis docker")
        return 1
    
    # Check if main app exists
    if not app_path.exists():
        print(f"❌ Main application not found at: {app_path}")
        return 1
    
    try:
        # Launch the application using the virtual environment Python
        print("✅ Starting Ultimate Database Manager...")
        result = subprocess.run([str(venv_python), str(app_path)], 
                              cwd=str(script_dir),
                              check=False)
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n👋 Application terminated by user")
        return 0
    except Exception as e:
        print(f"❌ Error launching application: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())

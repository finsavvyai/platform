#!/usr/bin/env python3
"""
🚀 Ultimate Multi-Database Manager - macOS App Packaging Configuration
Complete macOS application packaging with code signing and notarization
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Any

# py2app configuration for macOS packaging
APP_CONFIG = {
    'app': ['../apps/ultimate_multi_db_manager.py'],
    'data_files': [
        ('lib', ['../lib']),
        ('resources', ['../resources']),
        ('icons', ['../icons']),
    ],
    'options': {
        'py2app': {
            'argv_emulation': True,
            'plist': {
                'CFBundleName': 'Ultimate Database Manager',
                'CFBundleDisplayName': 'Ultimate Database Manager',
                'CFBundleGetInfoString': 'Ultimate Multi-Database Manager with Docker Integration',
                'CFBundleIdentifier': 'com.ultimatedb.manager',
                'CFBundleVersion': '3.0.0',
                'CFBundleShortVersionString': '3.0.0',
                'NSHumanReadableCopyright': 'Copyright © 2024 Ultimate DB Tools. All rights reserved.',
                'NSHighResolutionCapable': True,
                'LSMinimumSystemVersion': '12.0',
                'NSRequiresAquaSystemAppearance': False,
                'NSSupportsAutomaticGraphicsSwitching': True,
                'LSApplicationCategoryType': 'public.app-category.developer-tools',
                'NSDocumentTypes': [
                    {
                        'CFBundleTypeName': 'SQL File',
                        'CFBundleTypeExtensions': ['sql'],
                        'CFBundleTypeRole': 'Editor',
                        'LSHandlerRank': 'Owner'
                    },
                    {
                        'CFBundleTypeName': 'Database Dump',
                        'CFBundleTypeExtensions': ['dump', 'sql', 'csv', 'json'],
                        'CFBundleTypeRole': 'Editor',
                        'LSHandlerRank': 'Owner'
                    }
                ],
                'NSServices': [
                    {
                        'NSMenuItem': {
                            'default': 'Open with Ultimate DB Manager'
                        },
                        'NSMessage': 'openFile',
                        'NSRequiredContext': {
                            'NSTextContent': 'FilenamesPboardType'
                        },
                        'NSSendTypes': ['NSFilenamesPboardType']
                    }
                ]
            },
            'iconfile': '../icons/app_icon.icns',
            'resources': [
                '../resources/',
                '../icons/',
                '../lib/'
            ],
            'includes': [
                'PySide6',
                'psycopg2',
                'docker',
                'keyring',
                'pandas',
                'openpyxl',
                'pymongo',
                'redis',
                'mysql.connector'
            ],
            'excludes': [
                'tkinter',
                'matplotlib',
                'scipy',
                'numpy.distutils',
                'distutils'
            ],
            'packages': [
                'PySide6',
                'psycopg2',
                'docker'
            ],
            'optimize': 2,
            'compressed': True,
            'semi_standalone': False,
            'site_packages': True
        }
    },
    'setup_requires': ['py2app']
}

class MacOSPackager:
    """macOS application packaging and distribution manager"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent
        self.build_dir = self.project_root / "build"
        self.dist_dir = self.project_root / "dist"
        self.app_name = "Ultimate Database Manager.app"
        
        # Code signing configuration
        self.developer_id = os.getenv('DEVELOPER_ID', 'Developer ID Application: Your Name (TEAM_ID)')
        self.installer_id = os.getenv('INSTALLER_ID', 'Developer ID Installer: Your Name (TEAM_ID)')
        self.notarization_profile = os.getenv('NOTARIZATION_PROFILE', 'notarization-profile')
        
    def clean_build(self):
        """Clean previous build artifacts"""
        print("🧹 Cleaning build artifacts...")
        
        if self.build_dir.exists():
            shutil.rmtree(self.build_dir)
        if self.dist_dir.exists():
            shutil.rmtree(self.dist_dir)
        
        print("✅ Build artifacts cleaned")
    
    def install_dependencies(self):
        """Install packaging dependencies"""
        print("📦 Installing packaging dependencies...")
        
        dependencies = [
            'py2app',
            'dmgbuild',
            'altgraph',
            'macholib'
        ]
        
        for dep in dependencies:
            subprocess.run([sys.executable, '-m', 'pip', 'install', dep], check=True)
        
        print("✅ Dependencies installed")
    
    def create_app_bundle(self):
        """Create macOS app bundle using py2app"""
        print("🏗️ Creating macOS app bundle...")
        
        # Change to project directory
        os.chdir(self.project_root)
        
        # Run py2app
        setup_py_content = f"""
from setuptools import setup
import py2app

APP = {APP_CONFIG['app']}
DATA_FILES = {APP_CONFIG['data_files']}
OPTIONS = {APP_CONFIG['options']}

setup(
    app=APP,
    data_files=DATA_FILES,
    options=OPTIONS,
    setup_requires={APP_CONFIG['setup_requires']},
)
"""
        
        # Write temporary setup.py
        setup_py_path = self.project_root / "setup_temp.py"
        with open(setup_py_path, 'w') as f:
            f.write(setup_py_content)
        
        try:
            # Build app
            subprocess.run([
                sys.executable, 'setup_temp.py', 'py2app'
            ], check=True)
            
            print("✅ App bundle created successfully")
            
        finally:
            # Clean up temporary setup.py
            if setup_py_path.exists():
                setup_py_path.unlink()
    
    def code_sign_app(self):
        """Code sign the application"""
        print("🔐 Code signing application...")
        
        app_path = self.dist_dir / self.app_name
        if not app_path.exists():
            raise FileNotFoundError(f"App bundle not found: {app_path}")
        
        # Sign all binaries in the app bundle
        self._sign_binaries_recursively(app_path)
        
        # Sign the main app bundle
        subprocess.run([
            'codesign',
            '--force',
            '--verify',
            '--verbose',
            '--sign', self.developer_id,
            '--options', 'runtime',
            '--entitlements', str(self.project_root / 'packaging' / 'entitlements.plist'),
            str(app_path)
        ], check=True)
        
        print("✅ Application code signed")
    
    def _sign_binaries_recursively(self, app_path: Path):
        """Recursively sign all binaries in the app bundle"""
        frameworks_path = app_path / "Contents" / "Frameworks"
        macos_path = app_path / "Contents" / "MacOS"
        
        # Sign frameworks
        if frameworks_path.exists():
            for framework in frameworks_path.rglob("*"):
                if framework.is_file() and (framework.suffix in ['.dylib', '.so'] or 
                                          framework.stat().st_mode & 0o111):
                    try:
                        subprocess.run([
                            'codesign',
                            '--force',
                            '--sign', self.developer_id,
                            '--options', 'runtime',
                            str(framework)
                        ], check=True, capture_output=True)
                    except subprocess.CalledProcessError:
                        # Some files might already be signed or not signable
                        pass
        
        # Sign executables in MacOS directory
        if macos_path.exists():
            for executable in macos_path.iterdir():
                if executable.is_file():
                    try:
                        subprocess.run([
                            'codesign',
                            '--force',
                            '--sign', self.developer_id,
                            '--options', 'runtime',
                            str(executable)
                        ], check=True, capture_output=True)
                    except subprocess.CalledProcessError:
                        pass
    
    def create_dmg(self):
        """Create DMG installer"""
        print("💿 Creating DMG installer...")
        
        dmg_config = {
            'filename': f'{self.dist_dir}/Ultimate Database Manager.dmg',
            'volume_name': 'Ultimate Database Manager',
            'format': 'UDBZ',
            'size': '500M',
            'files': [
                str(self.dist_dir / self.app_name)
            ],
            'symlinks': {
                'Applications': '/Applications'
            },
            'icon_locations': {
                self.app_name: (140, 120),
                'Applications': (500, 120)
            },
            'background': str(self.project_root / 'packaging' / 'dmg_background.png'),
            'show_status_bar': False,
            'show_tab_view': False,
            'show_toolbar': False,
            'show_pathbar': False,
            'show_sidebar': False,
            'sidebar_width': 180,
            'window_rect': ((100, 100), (640, 280)),
            'default_view': 'icon-view',
            'show_icon_preview': False,
            'include_icon_view_settings': 'auto',
            'include_list_view_settings': 'auto',
            'arrange_by': None,
            'grid_offset': (0, 0),
            'grid_spacing': 100,
            'scroll_position': (0, 0),
            'label_pos': 'bottom',
            'text_size': 16,
            'icon_size': 128
        }
        
        # Create dmgbuild settings file
        settings_content = f"""
import os.path

filename = '{dmg_config["filename"]}'
volume_name = '{dmg_config["volume_name"]}'
format = '{dmg_config["format"]}'
size = '{dmg_config["size"]}'

files = {dmg_config["files"]}
symlinks = {dmg_config["symlinks"]}

icon_locations = {dmg_config["icon_locations"]}

background = '{dmg_config["background"]}'

show_status_bar = {dmg_config["show_status_bar"]}
show_tab_view = {dmg_config["show_tab_view"]}
show_toolbar = {dmg_config["show_toolbar"]}
show_pathbar = {dmg_config["show_pathbar"]}
show_sidebar = {dmg_config["show_sidebar"]}
sidebar_width = {dmg_config["sidebar_width"]}

window_rect = {dmg_config["window_rect"]}
default_view = '{dmg_config["default_view"]}'

show_icon_preview = {dmg_config["show_icon_preview"]}
include_icon_view_settings = '{dmg_config["include_icon_view_settings"]}'
include_list_view_settings = '{dmg_config["include_list_view_settings"]}'

arrange_by = {dmg_config["arrange_by"]}
grid_offset = {dmg_config["grid_offset"]}
grid_spacing = {dmg_config["grid_spacing"]}
scroll_position = {dmg_config["scroll_position"]}
label_pos = '{dmg_config["label_pos"]}'
text_size = {dmg_config["text_size"]}
icon_size = {dmg_config["icon_size"]}
"""
        
        settings_path = self.project_root / "dmg_settings.py"
        with open(settings_path, 'w') as f:
            f.write(settings_content)
        
        try:
            # Build DMG
            subprocess.run([
                'dmgbuild',
                '-s', str(settings_path),
                dmg_config['volume_name'],
                dmg_config['filename']
            ], check=True)
            
            print("✅ DMG created successfully")
            
        finally:
            # Clean up settings file
            if settings_path.exists():
                settings_path.unlink()
    
    def sign_dmg(self):
        """Code sign the DMG"""
        print("🔐 Signing DMG...")
        
        dmg_path = self.dist_dir / "Ultimate Database Manager.dmg"
        
        subprocess.run([
            'codesign',
            '--force',
            '--sign', self.developer_id,
            str(dmg_path)
        ], check=True)
        
        print("✅ DMG signed")
    
    def notarize_app(self):
        """Submit app for notarization"""
        print("📋 Submitting for notarization...")
        
        dmg_path = self.dist_dir / "Ultimate Database Manager.dmg"
        
        # Submit for notarization
        result = subprocess.run([
            'xcrun', 'notarytool', 'submit',
            str(dmg_path),
            '--keychain-profile', self.notarization_profile,
            '--wait'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Notarization successful")
            
            # Staple the notarization
            subprocess.run([
                'xcrun', 'stapler', 'staple',
                str(dmg_path)
            ], check=True)
            
            print("✅ Notarization stapled")
        else:
            print(f"❌ Notarization failed: {result.stderr}")
            raise subprocess.CalledProcessError(result.returncode, result.args)
    
    def verify_app(self):
        """Verify the signed and notarized app"""
        print("🔍 Verifying application...")
        
        app_path = self.dist_dir / self.app_name
        dmg_path = self.dist_dir / "Ultimate Database Manager.dmg"
        
        # Verify app signature
        subprocess.run([
            'codesign', '--verify', '--verbose=2',
            str(app_path)
        ], check=True)
        
        # Verify DMG signature
        subprocess.run([
            'codesign', '--verify', '--verbose=2',
            str(dmg_path)
        ], check=True)
        
        # Check notarization
        subprocess.run([
            'spctl', '--assess', '--verbose=2',
            str(app_path)
        ], check=True)
        
        print("✅ Application verification successful")
    
    def create_entitlements_file(self):
        """Create entitlements.plist file"""
        entitlements_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>"""
        
        entitlements_path = self.project_root / "packaging" / "entitlements.plist"
        entitlements_path.parent.mkdir(exist_ok=True)
        
        with open(entitlements_path, 'w') as f:
            f.write(entitlements_content)
        
        print("✅ Entitlements file created")
    
    def build_complete_package(self):
        """Build complete macOS package"""
        print("🚀 Starting complete macOS packaging process...")
        
        try:
            self.clean_build()
            self.install_dependencies()
            self.create_entitlements_file()
            self.create_app_bundle()
            self.code_sign_app()
            self.create_dmg()
            self.sign_dmg()
            
            # Only notarize if credentials are available
            if self.notarization_profile and os.getenv('SKIP_NOTARIZATION') != '1':
                self.notarize_app()
            else:
                print("⚠️ Skipping notarization (credentials not configured)")
            
            self.verify_app()
            
            print("🎉 macOS packaging completed successfully!")
            print(f"📦 App bundle: {self.dist_dir / self.app_name}")
            print(f"💿 DMG installer: {self.dist_dir / 'Ultimate Database Manager.dmg'}")
            
        except Exception as e:
            print(f"❌ Packaging failed: {e}")
            raise


def main():
    """Main packaging function"""
    packager = MacOSPackager()
    packager.build_complete_package()


if __name__ == "__main__":
    main()

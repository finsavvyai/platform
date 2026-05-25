#!/usr/bin/env python3
"""
Setup script to create a proper macOS app bundle for Ultimate Database Manager
"""

from setuptools import setup
import py2app
import os

APP = ['apps/ultimate_apple_db_manager.py']
DATA_FILES = []
OPTIONS = {
    'argv_emulation': False,
    'iconfile': 'resources/app_icon.icns',  # We'll create this
    'plist': {
        'CFBundleName': 'Ultimate Database Manager',
        'CFBundleDisplayName': 'Ultimate Database Manager',
        'CFBundleGetInfoString': 'Ultimate Database Manager - Multi-database tool with Apple design',
        'CFBundleIdentifier': 'com.ultimate-db.manager',
        'CFBundleVersion': '3.0.0',
        'CFBundleShortVersionString': '3.0.0',
        'NSHumanReadableCopyright': '© 2024 Ultimate DB Tools',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.14',
        'NSAppTransportSecurity': {
            'NSAllowsArbitraryLoads': True
        },
        'NSCameraUsageDescription': 'This app does not use the camera.',
        'NSMicrophoneUsageDescription': 'This app does not use the microphone.',
        'CFBundleDocumentTypes': [
            {
                'CFBundleTypeName': 'SQL Files',
                'CFBundleTypeExtensions': ['sql'],
                'CFBundleTypeRole': 'Editor',
                'CFBundleTypeIconFile': 'sql_icon'
            }
        ]
    },
    'packages': ['PySide6', 'psycopg2'],
    'includes': ['PySide6.QtCore', 'PySide6.QtGui', 'PySide6.QtWidgets', 'psycopg2'],
    'excludes': ['tkinter', 'matplotlib'],
    'resources': ['resources/'],
    'optimize': 2,
}

setup(
    app=APP,
    name='Ultimate Database Manager',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
    install_requires=['PySide6', 'psycopg2-binary']
)
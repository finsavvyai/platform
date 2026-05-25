#!/usr/bin/env python3
"""
Test entry point for Multi-Database Manager macOS application.
This is a minimal version to test the packaging system.
"""

import sys
import os
from pathlib import Path

def main():
    """Main application entry point"""
    try:
        # Test basic imports
        import PySide6
        from PySide6.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget
        from PySide6.QtCore import Qt
        
        print("PySide6 imported successfully")
        
        # Create a simple test application
        app = QApplication(sys.argv)
        
        # Create main window
        window = QMainWindow()
        window.setWindowTitle("Multi-Database Manager - Test Build")
        window.setGeometry(100, 100, 600, 400)
        
        # Create central widget
        central_widget = QWidget()
        window.setCentralWidget(central_widget)
        
        # Create layout
        layout = QVBoxLayout()
        central_widget.setLayout(layout)
        
        # Add test labels
        title_label = QLabel("Multi-Database Manager")
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("font-size: 24px; font-weight: bold; margin: 20px;")
        layout.addWidget(title_label)
        
        status_label = QLabel("✅ macOS App Bundle Test Successful!")
        status_label.setAlignment(Qt.AlignCenter)
        status_label.setStyleSheet("font-size: 16px; color: green; margin: 20px;")
        layout.addWidget(status_label)
        
        info_label = QLabel("This is a test build to verify the packaging system works correctly.")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setStyleSheet("font-size: 14px; color: gray; margin: 20px;")
        layout.addWidget(info_label)
        
        version_label = QLabel("Version: 2.0.0 (Development Build)")
        version_label.setAlignment(Qt.AlignCenter)
        version_label.setStyleSheet("font-size: 12px; color: gray; margin: 20px;")
        layout.addWidget(version_label)
        
        # Show window
        window.show()
        
        print("Test application window created and shown")
        
        # Run application
        return app.exec()
        
    except ImportError as e:
        print(f"Import error: {e}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())